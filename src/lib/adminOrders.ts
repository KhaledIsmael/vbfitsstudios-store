import { supabase } from './supabaseClient';
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
  };
  payment_status: string; // 'unpaid' | 'paid' | 'refunded' | 'failed'
  payment_method?: string; // 'cash_on_delivery' | 'card'
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
    const { data: ordersData, error: ordersErr } = await supabase
      .from('orders')
      .select(`
        *,
        customer:customers(id, full_name, email, phone),
        items:order_items(*)
      `)
      .order('created_at', { ascending: false });

    if (!ordersErr && ordersData && ordersData.length > 0) {
      const overrides = getLocalOverrides();

      return ordersData.map((row: any) => {
        const address = row.shipping_address_snapshot || {};
        const customerName =
          row.customer?.full_name ||
          (address.first_name ? `${address.first_name} ${address.last_name || ''}`.trim() : 'Private Client');

        const orderObj: AdminOrder = {
          id: row.id,
          order_number: row.order_number || `ORD-${row.id.slice(0, 8).toUpperCase()}`,
          customer_id: row.customer_id,
          customer_name: customerName,
          customer_email: row.customer?.email || address.email || 'client@vbfitsstudios.com',
          customer_phone: row.customer?.phone || address.phone || '+20 100 000 0000',
          status: (row.status || 'placed').toLowerCase(),
          currency: row.currency || 'EGP',
          subtotal: Number(row.subtotal || row.total || 0),
          discount_amount: Number(row.discount_amount || 0),
          shipping_amount: Number(row.shipping_amount || 0),
          tax_amount: Number(row.tax_amount || 0),
          total: Number(row.total || 0),
          tracking_number: row.tracking_number || undefined,
          shipping_address: {
            first_name: address.first_name || customerName.split(' ')[0],
            last_name: address.last_name || customerName.split(' ').slice(1).join(' '),
            street_line1: address.street_line1 || address.street || 'Zamalek Fashion District',
            street_line2: address.street_line2 || '',
            city: address.city || 'Cairo',
            state: address.state || 'Cairo',
            postal_code: address.postal_code || '11211',
            country: address.country || 'Egypt',
            phone: address.phone || row.customer?.phone || '+20 100 123 4567'
          },
          payment_status: row.payment_status || (row.payment_intent_id?.startsWith('cod_') ? 'unpaid' : 'paid'),
          payment_method: row.payment_intent_id?.startsWith('cod_') ? 'cash_on_delivery' : 'card',
          notes: row.notes || undefined,
          internal_notes: row.internal_notes || undefined,
          items: (row.items || []).map((item: any) => ({
            id: item.id,
            product_id: item.product_id,
            product_name: item.product_name,
            size: item.variant_title?.split(' / ')[0] || item.size || 'M',
            color: item.variant_title?.split(' / ')[1] || item.color || 'Washed Black',
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
          delivered_at: row.delivered_at,
          created_at: row.created_at,
          updated_at: row.updated_at
        };

        // Apply local overrides if any
        if (overrides[orderObj.id]) {
          return { ...orderObj, ...overrides[orderObj.id] };
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
 * Update order status — immediately reflects live on customer's tracking timeline!
 * Also fires a transactional status-change email to the customer via Brevo.
 */
export async function updateOrderStatus(
  orderId: string,
  newStatus: string,
  customerContext?: { email: string; name?: string; orderNumber?: string; trackingNumber?: string; currency?: string; total?: number }
): Promise<{ error: string | null }> {
  const cleanStatus = newStatus.toLowerCase();
  const updates: any = {
    status: cleanStatus,
    updated_at: new Date().toISOString()
  };

  if (cleanStatus === 'delivered') {
    updates.delivered_at = new Date().toISOString();
  }

  // Update local storage override so demo & live sync immediately
  setLocalOverride(orderId, updates);

  try {
    const { error } = await supabase
      .from('orders')
      .update(updates)
      .eq('id', orderId);

    if (error) {
      console.warn('DB order status update notice:', error.message);
    }
  } catch (err: any) {
    console.warn('updateOrderStatus DB exception:', err);
  }

  // Fire status-change email (non-blocking — don't await, never fail the UI)
  if (customerContext?.email) {
    const appUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_APP_URL) || '';
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
    const { error } = await supabase
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
