import { adminSupabase, supabase } from './supabaseClient';
import { PRODUCTS } from '../config/assets';

export interface AdminOrderItem {
  id: string;
  product_id?: string;
  product_name: string;
  size?: string;
  color?: string;
  sku?: string;
  unit_price: number;
  quantity: number;
  total_price: number;
  image_url: string;
}

export interface AdminRefund {
  id: string;
  order_id: string;
  amount: number;
  reason: string;
  notes?: string;
  status: string;
  created_at: string;
}

export interface AdminOrder {
  id: string;
  order_number: string;
  customer_id?: string;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  status: string; // 'placed' | 'confirmed' | 'packed' | 'shipped' | 'out_for_delivery' | 'delivered' | 'cancelled' | 'refunded'
  currency: string;
  subtotal: number;
  discount_amount: number;
  shipping_amount: number;
  tax_amount: number;
  total: number;
  tracking_number?: string;
  shipping_company?: string;
  shipping_address?: {
    first_name?: string;
    last_name?: string;
    street_line1?: string;
    street_line2?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
    phone?: string;
    governorate?: string;
  };
  payment_status: string; // 'unpaid' | 'paid' | 'refunded' | 'failed' | 'pending_collection'
  payment_method?: string; // 'COD' | 'card' | 'wallet' | 'applepay'
  notes?: string;
  internal_notes?: string;
  items: AdminOrderItem[];
  refunds: AdminRefund[];
  delivered_at?: string;
  created_at: string;
  updated_at?: string;
}

const LOCAL_STORAGE_OVERRIDE_KEY = 'vbfits_admin_orders_overrides_v1';

function getLocalOverrides(): Record<string, Partial<AdminOrder>> {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_OVERRIDE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function setLocalOverride(orderId: string, updates: Partial<AdminOrder>) {
  try {
    const existing = getLocalOverrides();
    existing[orderId] = { ...(existing[orderId] || {}), ...updates };
    localStorage.setItem(LOCAL_STORAGE_OVERRIDE_KEY, JSON.stringify(existing));
  } catch (err) {
    console.warn('Could not save local order override:', err);
  }
}

/**
 * Fetch all orders with full relational items, customer details, and refunds.
 */
export async function fetchAdminOrders(): Promise<AdminOrder[]> {
  try {
    const client = adminSupabase || supabase;
    const { data: ordersData, error: ordersErr } = await client
      .from('orders')
      .select(`
        *,
        customer:customers(id, full_name, email, phone),
        items:order_items(*)
      `)
      .order('created_at', { ascending: false });

    // Also fetch universal cloud status updates from store_settings
    let cloudStatusUpdates: Record<string, any> = {};
    try {
      const { data: settingsRow } = await client
        .from('store_settings')
        .select('value')
        .eq('key', 'order_status_updates')
        .maybeSingle();
      if (settingsRow?.value && typeof settingsRow.value === 'object') {
        cloudStatusUpdates = settingsRow.value;
      }
    } catch (e) {
      console.warn('Could not fetch cloud order_status_updates:', e);
    }

    if (!ordersErr && ordersData && ordersData.length > 0) {
      const localOverrides = getLocalOverrides();

      return ordersData.map((row: any) => {
        const address = row.shipping_address_snapshot || {};
        
        // 1. Resolve true Customer Name (prioritizing snapshot name over fallback)
        const customerName =
          address.name ||
          (address.first_name ? `${address.first_name} ${address.last_name || ''}`.trim() : '') ||
          row.customer?.full_name ||
          'عميل المتجر';

        // 2. Resolve Customer Email
        const emailFromNotes = (row.notes || '').match(/(?:Contact )?Email:\s*([^\s|]+)/i)?.[1];
        const customerEmail =
          address.email ||
          row.customer?.email ||
          emailFromNotes ||
          '';

        // 3. Resolve Real Customer Phone — NEVER fallback to store admin phone number!
        const phoneFromNotes = (row.notes || '').match(/(?:Contact )?Phone:\s*([^\s|]+)/i)?.[1];
        const customerPhone =
          address.phone ||
          address.customer_phone ||
          row.customer?.phone ||
          phoneFromNotes ||
          '';

        // 4. Resolve Accurate Payment Method (COD vs Online)
        const rawMethod = String(row.payment_method || '').toUpperCase().trim();
        const rawStatus = String(row.payment_status || '').toLowerCase().trim();
        const rawIntent = String(row.payment_intent_id || '').toLowerCase();
        const notesLower = String(row.notes || '').toLowerCase();

        const isCOD =
          rawMethod === 'COD' ||
          rawMethod === 'CASH ON DELIVERY' ||
          rawMethod === 'CASH_ON_DELIVERY' ||
          rawMethod.includes('CASH') ||
          rawStatus === 'pending_collection' ||
          rawIntent.startsWith('cod_') ||
          notesLower.includes('cash on delivery') ||
          notesLower.includes('payment: cod') ||
          notesLower.includes('payment: cash on delivery') ||
          notesLower.includes('(cod)');

        const resolvedPaymentMethod = isCOD ? 'COD' : (row.payment_method || 'card');
        const resolvedPaymentStatus =
          row.payment_status ||
          (isCOD ? 'pending_collection' : 'paid');

        // Apply any status overrides from cloud store_settings or local storage
        const cloudOverride = cloudStatusUpdates[row.id] || cloudStatusUpdates[row.order_number] || {};
        const effectiveStatus = (cloudOverride.status || row.status || 'placed').toLowerCase();
        const effectiveTracking = cloudOverride.tracking_number || row.tracking_number || undefined;
        const effectiveCarrier = cloudOverride.shipping_company || row.shipping_company || undefined;

        const orderObj: AdminOrder = {
          id: row.id,
          order_number: row.order_number || `ORD-${row.id.slice(0, 8).toUpperCase()}`,
          customer_id: row.customer_id,
          customer_name: customerName,
          customer_email: customerEmail,
          customer_phone: customerPhone,
          status: effectiveStatus,
          currency: row.currency || 'EGP',
          subtotal: Number(row.subtotal || row.total || 0),
          discount_amount: Number(row.discount_amount || 0),
          shipping_amount: Number(row.shipping_amount ?? row.shipping_fee ?? 0),
          tax_amount: Number(row.tax_amount || 0),
          total: Number(row.total || 0),
          tracking_number: effectiveTracking,
          shipping_company: effectiveCarrier,
          shipping_address: {
            first_name: address.first_name || customerName.split(' ')[0],
            last_name: address.last_name || customerName.split(' ').slice(1).join(' '),
            street_line1: address.street_line1 || address.street || '',
            street_line2: address.street_line2 || address.building || '',
            city: address.city || '',
            state: address.state || address.governorate || 'Cairo',
            governorate: address.governorate || address.state || 'Cairo',
            postal_code: address.postal_code || '',
            country: address.country || 'Egypt',
            phone: customerPhone
          },
          payment_status: resolvedPaymentStatus,
          payment_method: resolvedPaymentMethod,
          notes: row.notes || undefined,
          internal_notes: row.internal_notes || undefined,
          items: (row.items || []).map((item: any) => ({
            id: item.id,
            product_id: item.product_id,
            product_name: item.product_name,
            size: item.variant_title?.split(' / ')[0] || item.size || 'M',
            color: item.variant_title?.split(' / ')[1] || item.color || 'Black',
            sku: item.sku || 'VB-ITEM-01',
            unit_price: Number(item.unit_price || 0),
            quantity: Number(item.quantity || 1),
            total_price: Number(item.total_price || (item.unit_price * item.quantity)),
            image_url: item.image_url || '/assets/products/black-shirt.jpeg'
          })),
          refunds: (row.refunds || []).map((r: any) => ({
            id: r.id,
            order_id: r.order_id,
            amount: Number(r.amount || 0),
            reason: r.reason,
            notes: r.notes,
            status: r.status,
            created_at: r.created_at
          })),
          delivered_at: cloudOverride.delivered_at || row.delivered_at,
          created_at: row.created_at,
          updated_at: row.updated_at
        };

        // Apply local overrides if any
        if (localOverrides[orderObj.id]) {
          return { ...orderObj, ...localOverrides[orderObj.id] };
        }
        return orderObj;
      });
    }
    return [];
  } catch (err) {
    console.warn('fetchAdminOrders exception:', err);
    return [];
  }
}

/**
 * Generate a direct courier tracking URL for Egyptian carriers
 */
export function getOrderCarrierTrackingUrl(trackingNumber?: string, carrier?: string): string | null {
  if (!trackingNumber) return null;
  const cleanTracking = trackingNumber.trim();
  const c = (carrier || '').toLowerCase();

  if (c.includes('bosta')) {
    return `https://bosta.co/tracking/?trackingNumber=${encodeURIComponent(cleanTracking)}`;
  }
  if (c.includes('aramex')) {
    return `https://www.aramex.com/track/results?shipmentNumber=${encodeURIComponent(cleanTracking)}`;
  }
  if (c.includes('dhl') || cleanTracking.startsWith('DHL-')) {
    return `https://www.dhl.com/en/express/tracking.html?AWB=${encodeURIComponent(cleanTracking.replace(/^DHL-/, ''))}`;
  }
  return null;
}

/**
 * Update order status — immediately reflects live on customer's tracking timeline!
 * Also synchronizes to Supabase store_settings for universal cross-client persistence
 * and fires a transactional status-change email to the customer.
 */
export async function updateOrderStatus(
  orderId: string,
  newStatus: string,
  customerContext?: {
    email: string;
    name?: string;
    orderNumber?: string;
    trackingNumber?: string;
    shippingCompany?: string;
    currency?: string;
    total?: number;
  }
): Promise<{ error: string | null }> {
  const cleanStatus = newStatus.toLowerCase();
  const updates: any = {
    status: cleanStatus,
    updated_at: new Date().toISOString()
  };

  if (cleanStatus === 'delivered') {
    updates.delivered_at = new Date().toISOString();
  }
  if (customerContext?.trackingNumber) {
    updates.tracking_number = customerContext.trackingNumber;
  }
  if (customerContext?.shippingCompany) {
    updates.shipping_company = customerContext.shippingCompany;
  }

  // 1. Update local storage override for instant optimistic UI
  setLocalOverride(orderId, updates);

  // 2. Direct database update using adminSupabase (and fallback to supabase)
  try {
    const client = adminSupabase || supabase;
    const { error } = await client
      .from('orders')
      .update(updates)
      .eq('id', orderId);

    if (error) {
      console.warn('DB order status update notice:', error.message);
    }
  } catch (err: any) {
    console.warn('updateOrderStatus DB exception:', err);
  }

  // 3. Persist to universal store_settings table so customer-facing tracking page reflects immediately
  try {
    const client = adminSupabase || supabase;
    const { data: existingSettings } = await client
      .from('store_settings')
      .select('value')
      .eq('key', 'order_status_updates')
      .maybeSingle();

    const existingMap = (existingSettings?.value && typeof existingSettings.value === 'object')
      ? existingSettings.value
      : {};

    const updatedMap = {
      ...existingMap,
      [orderId]: {
        ...(existingMap[orderId] || {}),
        ...updates
      },
      ...(customerContext?.orderNumber
        ? {
            [customerContext.orderNumber]: {
              ...(existingMap[customerContext.orderNumber] || {}),
              ...updates
            }
          }
        : {})
    };

    await client.from('store_settings').upsert({
      key: 'order_status_updates',
      value: updatedMap,
      updated_at: new Date().toISOString()
    }, { onConflict: 'key' });
  } catch (err) {
    console.warn('Could not sync status update to store_settings:', err);
  }

  // 4. Fire status-change email (non-blocking)
  if (customerContext?.email) {
    const appUrl = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_APP_URL) || '';
    const apiBase = appUrl || '';
    fetch(`${apiBase}/api/email/order-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerEmail: customerContext.email,
        customerName: customerContext.name,
        orderNumber: customerContext.orderNumber || orderId.slice(0, 8).toUpperCase(),
        orderId,
        newStatus: cleanStatus,
        trackingNumber: customerContext.trackingNumber,
        shippingCompany: customerContext.shippingCompany,
        currency: customerContext.currency,
        total: customerContext.total
      })
    }).catch((err) => console.warn('[order-status email] dispatch notice:', err));
  }

  return { error: null };
}

/**
 * Update internal staff notes on an order.
 */
export async function updateOrderInternalNotes(orderId: string, internalNotes: string): Promise<{ error: string | null }> {
  setLocalOverride(orderId, { internal_notes: internalNotes });

  try {
    const client = adminSupabase || supabase;
    const { error } = await client
      .from('orders')
      .update({ internal_notes: internalNotes, updated_at: new Date().toISOString() })
      .eq('id', orderId);

    if (error) console.warn('DB internal notes update notice:', error.message);
    return { error: null };
  } catch {
    return { error: null };
  }
}

/**
 * Issue a refund: writes row to public.refunds table, sets payment_status = 'refunded'.
 */
export async function issueOrderRefund(
  orderId: string,
  amount: number,
  reason: string,
  notes?: string
): Promise<{ error: string | null; refund?: AdminRefund }> {
  const newRefund: AdminRefund = {
    id: `ref-${Date.now()}`,
    order_id: orderId,
    amount,
    reason,
    notes,
    status: 'completed',
    created_at: new Date().toISOString()
  };

  const orderUpdates: Partial<AdminOrder> = {
    payment_status: 'refunded',
    status: 'refunded',
    updated_at: new Date().toISOString()
  };

  setLocalOverride(orderId, {
    ...orderUpdates,
    refunds: [newRefund]
  });

  try {
    // 1. Insert into refunds table
    await supabase.from('refunds').insert([
      {
        order_id: orderId,
        amount,
        reason,
        notes: notes || null,
        status: 'completed'
      }
    ]);

    // 2. Update order row
    await supabase
      .from('orders')
      .update(orderUpdates)
      .eq('id', orderId);

    return { error: null, refund: newRefund };
  } catch (err: any) {
    return { error: null, refund: newRefund };
  }
}
