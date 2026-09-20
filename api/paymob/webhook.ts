import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import * as crypto from 'crypto';

/**
 * GET /api/paymob/webhook
 *
 * Paymob sends a GET callback to this URL after a transaction completes.
 * Query params include: obj, hmac, id, pending, success, is_auth, etc.
 *
 * Also handles server-to-server POST notifications.
 *
 * Security: HMAC signature is verified before any DB update.
 *
 * Paymob Docs:
 * https://developers.paymob.com/egypt/docs/transaction-webhooks
 */

// Fields used for HMAC calculation (Paymob v2 callback query string approach)
const HMAC_QUERY_FIELDS = [
  'amount_cents',
  'created_at',
  'currency',
  'error_occured',
  'has_parent_transaction',
  'id',
  'integration_id',
  'is_3d_secure',
  'is_auth',
  'is_capture',
  'is_refunded',
  'is_standalone_payment',
  'is_voided',
  'order',
  'owner',
  'pending',
  'source_data_pan',
  'source_data_sub_type',
  'source_data_type',
  'success'
] as const;

function verifyHmac(params: Record<string, string>, hmacSecret: string): boolean {
  // Build concatenated string in the exact field order Paymob specifies
  const concatenated = HMAC_QUERY_FIELDS.map((field) => params[field] ?? '').join('');
  const expected = crypto.createHmac('sha512', hmacSecret).update(concatenated).digest('hex');
  const received = params['hmac'] ?? '';
  // Use timingSafeEqual to prevent timing attacks
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(received, 'hex'));
  } catch {
    return false;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const hmacSecret = process.env.PAYMOB_HMAC_SECRET;
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!hmacSecret) {
    console.error('PAYMOB_HMAC_SECRET not set');
    return res.status(500).send('Webhook not configured');
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Supabase credentials not set for webhook');
    return res.status(500).send('Database not configured');
  }

  // Supabase client (server-side, uses service role key for elevated write access)
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // ─────────────────────────────────────────────────────────────────
  // Extract params from GET (transaction callback) or POST (server notification)
  // ─────────────────────────────────────────────────────────────────
  let params: Record<string, string> = {};
  let transactionObj: any = null;

  if (req.method === 'GET') {
    // Paymob sends GET request with query parameters after hosted page
    params = Object.fromEntries(
      Object.entries(req.query as Record<string, string | string[]>).map(([k, v]) => [
        k,
        Array.isArray(v) ? v[0] : v
      ])
    );
    transactionObj = params;
  } else if (req.method === 'POST') {
    // Paymob sends POST JSON for server-to-server notifications
    const body = req.body;
    if (body?.obj) {
      transactionObj = body.obj;
      // Flatten obj fields for HMAC calculation
      const objFlat: Record<string, string> = {};
      for (const [k, v] of Object.entries(body.obj)) {
        objFlat[k] = String(v ?? '');
      }
      if (body.obj.source_data) {
        objFlat['source_data_pan'] = String(body.obj.source_data.pan ?? '');
        objFlat['source_data_sub_type'] = String(body.obj.source_data.sub_type ?? '');
        objFlat['source_data_type'] = String(body.obj.source_data.type ?? '');
      }
      params = { ...objFlat, hmac: body.hmac ?? '' };
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // HMAC Verification — reject if signature doesn't match
  // ─────────────────────────────────────────────────────────────────
  const isValidHmac = verifyHmac(params, hmacSecret);
  if (!isValidHmac) {
    console.warn('Paymob webhook: HMAC verification failed', { params });
    // Return 200 to Paymob to prevent retries, but don't update DB
    // (Log the failure for monitoring)
    return res.status(200).send('HMAC_MISMATCH');
  }

  // ─────────────────────────────────────────────────────────────────
  // Extract transaction data
  // ─────────────────────────────────────────────────────────────────
  const isSuccess = String(transactionObj?.success) === 'true';
  const isPending = String(transactionObj?.pending) === 'true';
  const merchantOrderId = transactionObj?.order?.merchant_order_id || params?.order;
  const paymobTransactionId = transactionObj?.id || params?.id;

  if (!merchantOrderId) {
    console.warn('Paymob webhook: no merchant_order_id found in callback');
    return res.status(200).send('NO_ORDER_ID');
  }

  // Determine new payment status
  const newPaymentStatus = isPending ? 'pending' : isSuccess ? 'paid' : 'failed';
  const newOrderStatus = isSuccess ? 'Placed' : 'Placed'; // Keep as Placed; failed → keep Placed for retry

  console.log(
    `Paymob webhook: Order ${merchantOrderId} → payment_status=${newPaymentStatus} (txn ${paymobTransactionId})`
  );

  // ─────────────────────────────────────────────────────────────────
  // Update Supabase orders table
  // ─────────────────────────────────────────────────────────────────
  const { error: updateError } = await supabase
    .from('orders')
    .update({
      payment_status: newPaymentStatus,
      status: newOrderStatus,
      notes: `Paymob txn ${paymobTransactionId} | ${newPaymentStatus}`
    })
    .eq('order_number', merchantOrderId);

  if (updateError) {
    console.error('Webhook DB update failed:', updateError.message);
    // Return 200 to Paymob anyway — log failure for retry logic
  }

  // ─────────────────────────────────────────────────────────────────
  // Send Confirmation Email for Paid Online Orders
  // Fires ONLY when payment is successfully verified by the webhook!
  // ─────────────────────────────────────────────────────────────────
  if (isSuccess && newPaymentStatus === 'paid') {
    try {
      const { data: fullOrder } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          total,
          currency,
          tracking_number,
          created_at,
          notes,
          shipping_address_snapshot,
          items:order_items(
            product_name,
            variant_title,
            quantity,
            unit_price
          )
        `)
        .eq('order_number', merchantOrderId)
        .maybeSingle();

      if (fullOrder) {
        const addr = (fullOrder.shipping_address_snapshot as any) || {};
        const emailMatch = (fullOrder.notes || '').match(/(?:Contact )?Email:\s*([^\s|]+)/i);
        const toEmail = emailMatch?.[1] || addr.email || '';
        const toName = addr.name || 'Valued Client';

        const brevoKey = process.env.BREVO_API_KEY;
        const appUrl = process.env.VITE_APP_URL || 'https://vbfitsstudios.com';

        if (brevoKey && toEmail && toEmail.includes('@')) {
          const itemsList = (fullOrder.items || []).map((it: any) => ({
            name: it.product_name,
            size: it.variant_title?.replace('Size: ', '') || 'One Size',
            quantity: it.quantity,
            price: Number(it.unit_price)
          }));

          // Send confirmation via Brevo API
          const emailPayload = {
            to: toEmail,
            toName,
            orderNumber: fullOrder.order_number,
            orderId: fullOrder.id,
            trackingNumber: fullOrder.tracking_number || '',
            total: Number(fullOrder.total),
            currency: fullOrder.currency || 'USD',
            paymentMethod: 'Pay Online',
            paymentStatus: 'paid',
            address: addr,
            items: itemsList,
            createdAt: fullOrder.created_at
          };

          // Call internal email endpoint or directly send
          fetch(`${appUrl}/api/email/send-confirmation`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(emailPayload)
          }).catch((err) => {
            console.warn('Post-payment confirmation email trigger notice:', err?.message);
          });
        }
      }
    } catch (emailErr) {
      console.warn('Webhook post-payment email exception:', emailErr);
    }
  }

  // For GET callbacks (user redirect): redirect to confirmation page
  if (req.method === 'GET') {
    const appUrl = process.env.VITE_APP_URL || 'http://localhost:5173';
    // Find the Supabase order ID if possible for the redirect
    const { data: orderRow } = await supabase
      .from('orders')
      .select('id, order_number, total, tracking_number')
      .eq('order_number', merchantOrderId)
      .maybeSingle();

    const params_out = new URLSearchParams({
      order_number: merchantOrderId,
      payment_status: newPaymentStatus,
      txn_id: String(paymobTransactionId || '')
    });
    if (orderRow?.id) params_out.set('order_id', orderRow.id);

    return res.redirect(302, `${appUrl}/payment-callback?${params_out.toString()}`);
  }

  // For POST server notifications: return 200
  return res.status(200).json({ received: true, status: newPaymentStatus });
}
