import { supabase } from './supabaseClient';

// ── Shared delivery window helper (matches email template + confirmation page) ──
function getDeliveryWindow(createdAt?: string): string {
  const base = createdAt ? new Date(createdAt) : new Date();
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const lo = new Date(base);
  lo.setDate(lo.getDate() + 3);
  const hi = new Date(base);
  hi.setDate(hi.getDate() + 6);
  return `${fmt(lo)} – ${fmt(hi)}`;
}

export interface OrderItem {
  id: string;
  name: string;
  size: string;
  price: number;
  quantity: number;
  image: string;
}

export interface Order {
  id: string;          // order_number (display)
  rawId: string;       // Supabase UUID (for routing)
  date: string;
  status: string;
  items: OrderItem[];
  total: number;
  trackingNumber: string;
  deliveredAt?: string | null;
  currency?: string;
}

export interface CreateOrderParams {
  customerId?: string | null;
  items: Array<{
    productId?: string;
    name: string;
    size: string;
    price: number;
    currency?: string;
    image: string;
    quantity: number;
  }>;
  subtotal: number;
  shippingAddress?: any;
  status?: string;
  paymentMethod?: 'Cash on Delivery' | 'Pay Online' | 'COD';
  /** Initial payment status. Use 'pending' for online payments awaiting gateway confirmation. */
  paymentStatus?: 'pending_collection' | 'paid' | 'failed' | 'pending' | 'unpaid';
  notes?: string;
}

/**
 * Fetches all orders belonging to the specified customer ID with itemized order details.
 */
export async function getUserOrders(customerId: string): Promise<Order[]> {
  if (!customerId) return [];

  try {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        status,
        currency,
        subtotal,
        total,
        tracking_number,
        created_at,
        delivered_at,
        shipping_address_snapshot,
        items:order_items(
          id,
          product_name,
          variant_title,
          unit_price,
          quantity,
          total_price,
          image_url
        )
      `)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Supabase getUserOrders notice:', error.message);
      return [];
    }

    if (!data) return [];

    return data.map((orderRow) => {
      const items: OrderItem[] = (orderRow.items || []).map((itemRow: any) => {
        const sizeMatch = itemRow.variant_title?.match(/Size:\s*([^/,\s]+)/i);
        const size = sizeMatch ? sizeMatch[1] : itemRow.variant_title || 'M';

        return {
          id: itemRow.id,
          name: itemRow.product_name,
          size,
          price: Number(itemRow.unit_price),
          quantity: itemRow.quantity,
          image: itemRow.image_url || '/assets/products/black-shirt.jpeg'
        };
      });

      const dateObj = new Date(orderRow.created_at);
      const formattedDate = !isNaN(dateObj.getTime())
        ? dateObj.toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric'
          })
        : 'Recent';

      return {
        id: orderRow.order_number || orderRow.id,
        rawId: orderRow.id,
        date: formattedDate,
        status: orderRow.status,
        items,
        total: Number(orderRow.total),
        trackingNumber:
          orderRow.tracking_number || `DHL-${Math.floor(100000000 + Math.random() * 900000000)}`,
        deliveredAt: orderRow.delivered_at || null,
        currency: orderRow.currency || 'EGP'
      };
    });
  } catch (err) {
    console.warn('getUserOrders exception:', err);
    return [];
  }
}

/**
 * Creates a new order and associated order_items rows in Supabase.
 */
export async function createOrder({
  customerId,
  items,
  subtotal,
  shippingAddress,
  status = 'pending',
  paymentMethod = 'Cash on Delivery',
  notes
}: CreateOrderParams): Promise<{ order: any; error: string | null }> {
  if (!items || items.length === 0) {
    return { order: null, error: 'Cannot place order with an empty shopping bag.' };
  }

  try {
    const orderNumber = `VBF-${Math.floor(10000 + Math.random() * 90000)}`;
    const trackingNumber = `DHL-${Math.floor(100000000 + Math.random() * 900000000)}`;

    // Resolve real shipping address snapshot from Supabase if authenticated and not provided or placeholder
    let finalAddress = shippingAddress;
    if (customerId && (!finalAddress || !finalAddress.street || finalAddress.street === '742 Evergreen Terrace')) {
      const { data: defaultAddr } = await supabase
        .from('addresses')
        .select('*')
        .eq('customer_id', customerId)
        .eq('is_default', true)
        .limit(1)
        .maybeSingle();

      if (defaultAddr) {
        finalAddress = {
          name: defaultAddr.name || `${defaultAddr.first_name || ''} ${defaultAddr.last_name || ''}`.trim(),
          phone: defaultAddr.phone || '',
          street: defaultAddr.street || defaultAddr.street_line1 || '',
          building: defaultAddr.building || '',
          floor: defaultAddr.floor || '',
          landmark: defaultAddr.landmark || '',
          city: defaultAddr.city || '',
          governorate: defaultAddr.governorate || defaultAddr.state || '',
          country: defaultAddr.country || 'Egypt'
        };
      }
    }

    const isCOD = paymentMethod === 'COD' || paymentMethod === 'Cash on Delivery';
    const methodStr = isCOD ? 'COD' : 'Pay Online';
    const initialPaymentStatus = isCOD ? 'pending_collection' : 'paid';
    const orderNotes = notes || `Payment: ${methodStr} (${initialPaymentStatus})`;

    // PostgreSQL schema constraint check:
    // Base schema: CHECK (status IN ('pending', 'processing', 'in_transit', 'delivered', 'cancelled', 'refunded'))
    // Using 'pending' guarantees compatibility with both original and updated check constraints.
    const rawStatus = (status || 'pending').toLowerCase();
    const safeStatus = rawStatus === 'placed' ? 'pending' : rawStatus;

    // 1. Insert order record with COD and pending_collection
    const primaryPayload: any = {
      customer_id: customerId || null,
      order_number: orderNumber,
      status: safeStatus,
      currency: 'EGP',
      subtotal,
      total: subtotal,
      tracking_number: trackingNumber,
      shipping_address_snapshot: finalAddress || {},
      payment_method: methodStr,
      payment_status: initialPaymentStatus,
      notes: orderNotes
    };

    let { data: order, error: orderError } = await supabase
      .from('orders')
      .insert(primaryPayload)
      .select()
      .single();

    // If constraint or column error occurs, retry with fallback
    if (
      orderError &&
      (orderError.message.includes('payment_status') ||
        orderError.message.includes('payment_method') ||
        orderError.message.includes('orders_status_check') ||
        orderError.code === '42703' ||
        orderError.code === '23514')
    ) {
      console.warn('Retrying order insert with fallback payload (status=pending, payment_status=unpaid)...', orderError.message);
      const fallbackPayload: any = {
        customer_id: customerId || null,
        order_number: orderNumber,
        status: 'pending',
        currency: 'EGP',
        subtotal,
        total: subtotal,
        tracking_number: trackingNumber,
        shipping_address_snapshot: finalAddress || {},
        payment_status: isCOD ? 'unpaid' : 'paid',
        notes: `[Payment Method: ${methodStr} | Status: ${initialPaymentStatus}] ${orderNotes || ''}`
      };
      const fallbackRes = await supabase
        .from('orders')
        .insert(fallbackPayload)
        .select()
        .single();
      order = fallbackRes.data;
      orderError = fallbackRes.error;
    }

    // Secondary fallback: if still failing on status check, omit status entirely and let database default 'pending' handle it
    if (orderError && (orderError.message.includes('orders_status_check') || orderError.code === '23514')) {
      console.warn('Retrying order insert letting database DEFAULT status apply...');
      const noStatusPayload: any = {
        customer_id: customerId || null,
        order_number: orderNumber,
        currency: 'EGP',
        subtotal,
        total: subtotal,
        tracking_number: trackingNumber,
        shipping_address_snapshot: finalAddress || {},
        notes: `[Payment Method: ${methodStr} | Status: ${initialPaymentStatus}] ${orderNotes || ''}`
      };
      const noStatusRes = await supabase
        .from('orders')
        .insert(noStatusPayload)
        .select()
        .single();
      order = noStatusRes.data;
      orderError = noStatusRes.error;
    }

    if (orderError) {
      console.error('Failed to create order:', orderError.message);
      return { order: null, error: orderError.message };
    }

    // 2. Insert itemized lines into order_items
    const itemsPayload = items.map((item) => ({
      order_id: order.id,
      product_name: item.name,
      variant_title: `Size: ${item.size}`,
      unit_price: item.price,
      quantity: item.quantity,
      total_price: item.price * item.quantity,
      image_url: item.image
    }));

    const { error: itemsError } = await supabase.from('order_items').insert(itemsPayload);

    if (itemsError) {
      console.error('Failed to insert order items:', itemsError.message);
      return { order, error: itemsError.message };
    }

    // 3. Fire-and-forget confirmation email (only for COD or already paid orders)
    // Online pending payments will have confirmation emails sent via the webhook upon verified payment!
    if (isCOD || initialPaymentStatus === 'paid') {
      try {
        // Extract contact email from notes string  e.g. "... | Contact Email: foo@bar.com | ..."
        const emailMatch = (notes || '').match(/(?:Contact )?Email:\s*([^\s|]+)/i);
        const toEmail = emailMatch?.[1] || (finalAddress as any)?.email || '';
        const nameMatch = (finalAddress as any)?.name || '';

        if (toEmail && toEmail.includes('@')) {
          fetch('/api/email/send-confirmation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: toEmail,
              toName: nameMatch || 'Valued Client',
              orderNumber: order.order_number,
              orderId: order.id,
              trackingNumber: order.tracking_number || '',
              total: Number(order.total),
              currency: order.currency || 'EGP',
              paymentMethod: methodStr,
              paymentStatus: initialPaymentStatus,
              deliveryWindow: getDeliveryWindow(order.created_at),
              address: finalAddress,
              items: items.map((it) => ({
                name: it.name,
                size: it.size,
                quantity: it.quantity,
                price: it.price
              })),
              createdAt: order.created_at
            })
          }).catch((e) => console.warn('Email send failed (non-blocking):', e?.message));
        }
      } catch (emailErr) {
        // Never propagate email errors — order already created
        console.warn('Email trigger exception (non-blocking):', emailErr);
      }
    }

    return { order, error: null };
  } catch (err: any) {
    console.error('createOrder exception:', err);
    return { order: null, error: err?.message || 'An unexpected error occurred.' };
  }
}

/**
 * Converts a previously pending or failed online order into a Cash on Delivery order.
 * Updates order in Supabase and triggers the COD confirmation email.
 */
export async function convertOrderToCOD(
  orderIdentifier: string
): Promise<{ order: OrderDetail | null; error: string | null }> {
  if (!orderIdentifier) return { order: null, error: 'No order identifier provided.' };

  try {
    // 1. Fetch current order
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      orderIdentifier
    );
    const query = supabase.from('orders').select(`
      id,
      order_number,
      tracking_number,
      status,
      total,
      currency,
      created_at,
      notes,
      shipping_address_snapshot,
      items:order_items(
        id,
        product_name,
        variant_title,
        unit_price,
        quantity,
        total_price,
        image_url
      )
    `);

    const { data: orderData, error: fetchErr } = isUuid
      ? await query.eq('id', orderIdentifier).maybeSingle()
      : await query.eq('order_number', orderIdentifier).maybeSingle();

    if (fetchErr || !orderData) {
      return { order: null, error: fetchErr?.message || 'Order could not be located.' };
    }

    // 2. Update order to COD
    const newNotes = `${orderData.notes || ''} | Converted to Cash on Delivery (pending_collection)`.trim();
    const { error: updateErr } = await supabase
      .from('orders')
      .update({
        payment_method: 'COD',
        payment_status: 'pending_collection',
        notes: newNotes
      })
      .eq('id', orderData.id);

    if (updateErr) {
      return { order: null, error: updateErr.message };
    }

    // 3. Send confirmation email for the newly converted COD order
    try {
      const emailMatch = (orderData.notes || '').match(/(?:Contact )?Email:\s*([^\s|]+)/i);
      const toEmail = emailMatch?.[1] || (orderData.shipping_address_snapshot as any)?.email || '';
      const nameMatch = (orderData.shipping_address_snapshot as any)?.name || 'Valued Client';

      if (toEmail && toEmail.includes('@')) {
        fetch('/api/email/send-confirmation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: toEmail,
            toName: nameMatch,
            orderNumber: orderData.order_number,
            orderId: orderData.id,
            trackingNumber: orderData.tracking_number || '',
            total: Number(orderData.total),
            currency: orderData.currency || 'EGP',
            paymentMethod: 'COD',
            paymentStatus: 'pending_collection',
            deliveryWindow: getDeliveryWindow(orderData.created_at),
            address: orderData.shipping_address_snapshot,
            items: (orderData.items || []).map((it: any) => ({
              name: it.product_name,
              size: it.variant_title?.replace('Size: ', '') || 'One Size',
              quantity: it.quantity,
              price: it.unit_price
            })),
            createdAt: orderData.created_at
          })
        }).catch((e) => console.warn('Email trigger after COD conversion (non-blocking):', e?.message));
      }
    } catch (e) {
      console.warn('COD conversion email notice:', e);
    }

    // 4. Return formatted order
    return getOrderById(orderData.id);
  } catch (err: any) {
    return { order: null, error: err?.message || 'Failed to convert order.' };
  }
}

/**
 * Searches for an order by order number and verifies it against the customer's email or phone number.
 * Used by the guest /track-order page.
 */
export async function lookupOrderForGuest(
  orderNumber: string,
  emailOrPhone: string
): Promise<{ orderId: string | null; orderNumber: string | null; error: string | null }> {
  const cleanOrderNum = orderNumber.trim();
  const cleanContact = emailOrPhone.trim().toLowerCase().replace(/[\s\-()]/g, '');

  if (!cleanOrderNum) {
    return { orderId: null, orderNumber: null, error: 'Please enter your Order Reference (e.g. VBF-12345).' };
  }
  if (!cleanContact) {
    return { orderId: null, orderNumber: null, error: 'Please enter the email or phone number used during checkout.' };
  }

  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanOrderNum);
    const query = supabase
      .from('orders')
      .select('id, order_number, notes, shipping_address_snapshot');

    const { data: order, error } = isUuid
      ? await query.eq('id', cleanOrderNum).maybeSingle()
      : await query.ilike('order_number', cleanOrderNum).maybeSingle();

    if (error || !order) {
      return {
        orderId: null,
        orderNumber: null,
        error: 'No order found matching this reference. Please verify your order number.'
      };
    }

    // Verify ownership via contact info
    const addr = (order.shipping_address_snapshot as any) || {};
    const addrPhone = String(addr.phone || '').toLowerCase().replace(/[\s\-()]/g, '');
    const addrEmail = String(addr.email || '').toLowerCase();
    const notesStr = String(order.notes || '').toLowerCase();

    const isMatch =
      (addrEmail && addrEmail === cleanContact) ||
      (addrPhone && addrPhone.includes(cleanContact)) ||
      (cleanContact.length >= 7 && addrPhone.endsWith(cleanContact.slice(-7))) ||
      notesStr.includes(cleanContact);

    if (!isMatch) {
      return {
        orderId: null,
        orderNumber: null,
        error: 'The contact information provided does not match the records for this order.'
      };
    }

    return {
      orderId: order.id,
      orderNumber: order.order_number,
      error: null
    };
  } catch (err: any) {
    return { orderId: null, orderNumber: null, error: err?.message || 'Lookup failed.' };
  }
}


/**
 * Updates the payment_status (and optionally order status) for a given order by order_number.
 * Called by the frontend polling page after Paymob callback returns.
 */
export async function updateOrderPaymentStatus(
  orderNumber: string,
  paymentStatus: string,
  orderStatus?: string
): Promise<{ error: string | null }> {
  if (!orderNumber) return { error: 'No order number provided.' };

  const updatePayload: Record<string, string> = { payment_status: paymentStatus };
  if (orderStatus) updatePayload.status = orderStatus;

  const { error } = await supabase
    .from('orders')
    .update(updatePayload)
    .eq('order_number', orderNumber);

  if (error) {
    console.warn('updateOrderPaymentStatus error:', error.message);
    return { error: error.message };
  }

  return { error: null };
}

/**
 * Fetches a single order's payment_status by order_number.
 * Used by PaymentCallbackPage to poll until status resolves.
 */
export async function getOrderPaymentStatus(
  orderNumber: string
): Promise<{ paymentStatus: string | null; orderId: string | null; error: string | null }> {
  if (!orderNumber) return { paymentStatus: null, orderId: null, error: 'No order number.' };

  const { data, error } = await supabase
    .from('orders')
    .select('id, payment_status, order_number, total, tracking_number, status')
    .eq('order_number', orderNumber)
    .maybeSingle();

  if (error) return { paymentStatus: null, orderId: null, error: error.message };
  return {
    paymentStatus: data?.payment_status ?? null,
    orderId: data?.id ?? null,
    error: null
  };
}

/**
 * Full order detail record returned by getOrderById — includes items + address snapshot.
 */
export interface OrderDetail {
  id: string;
  orderNumber: string;
  trackingNumber: string;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  currency: string;
  subtotal: number;
  total: number;
  createdAt: string;
  notes: string;
  shippingAddress: {
    name?: string;
    phone?: string;
    street?: string;
    building?: string;
    floor?: string;
    landmark?: string;
    city?: string;
    governorate?: string;
    country?: string;
  } | null;
  items: OrderItem[];
}

/**
 * Fetches a single order by its Supabase UUID, including all line items.
 * Used by the /order-confirmation/:orderId page.
 */
export async function getOrderById(
  orderId: string
): Promise<{ order: OrderDetail | null; error: string | null }> {
  if (!orderId) return { order: null, error: 'No order ID provided.' };

  let { data, error } = await supabase
    .from('orders')
    .select(`
      id,
      order_number,
      tracking_number,
      status,
      payment_method,
      payment_status,
      currency,
      subtotal,
      total,
      notes,
      created_at,
      shipping_address_snapshot,
      items:order_items(
        id,
        product_name,
        variant_title,
        unit_price,
        quantity,
        total_price,
        image_url
      )
    `)
    .eq('id', orderId)
    .maybeSingle();

  // Resilience: If payment_method column does not exist yet in database, retry query without it
  if (error && (error.message?.includes('payment_method') || error.code === '42703')) {
    console.warn('[orders] Retrying getOrderById without payment_method column...');
    const retryRes = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        tracking_number,
        status,
        payment_status,
        currency,
        subtotal,
        total,
        notes,
        created_at,
        shipping_address_snapshot,
        items:order_items(
          id,
          product_name,
          variant_title,
          unit_price,
          quantity,
          total_price,
          image_url
        )
      `)
      .eq('id', orderId)
      .maybeSingle();
    data = retryRes.data ? ({ ...retryRes.data, payment_method: 'COD' } as any) : null;
    error = retryRes.error;
  }

  if (error) {
    console.warn('getOrderById error:', error.message);
    return { order: null, error: error.message };
  }

  if (!data) return { order: null, error: 'Order not found.' };

  const items: OrderItem[] = (data.items || []).map((row: any) => {
    const sizeMatch = row.variant_title?.match(/Size:\s*([^/,\s]+)/i);
    const size = sizeMatch ? sizeMatch[1] : row.variant_title || 'One Size';
    return {
      id: row.id,
      name: row.product_name,
      size,
      price: Number(row.unit_price),
      quantity: row.quantity,
      image: row.image_url || '/assets/products/black-shirt.jpeg'
    };
  });

  const order: OrderDetail = {
    id: data.id,
    orderNumber: data.order_number || data.id,
    trackingNumber: data.tracking_number || '',
    status: data.status || 'Placed',
    paymentMethod: data.payment_method || 'COD',
    paymentStatus: data.payment_status || 'pending_collection',
    currency: data.currency || 'EGP',
    subtotal: Number(data.subtotal),
    total: Number(data.total),
    notes: data.notes || '',
    createdAt: data.created_at,
    shippingAddress: data.shipping_address_snapshot || null,
    items
  };

  return { order, error: null };
}
