import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

/**
 * POST /api/returns/submit
 *
 * Secure server-side endpoint for submitting return/exchange requests.
 * Uses SUPABASE_SERVICE_ROLE_KEY to bypass RLS policies safely.
 *
 * Request body:
 * {
 *   orderId: string;       // UUID of the order
 *   customerId?: string;   // UUID of the customer (null for guest orders)
 *   reason: string;        // Return reason code
 *   reasonNote?: string;   // Optional free-text note
 *   items: Array<{         // Items to return
 *     order_item_id: string;
 *     name: string;
 *     size: string;
 *     quantity_to_return: number;
 *   }>;
 *   refundMethod?: string;
 *   refundAccountDetails?: Record<string, string>;
 * }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  // Validate environment
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    return res.status(500).json({ error: 'Server configuration error.' });
  }

  // Create admin Supabase client that bypasses RLS
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  // Parse and validate body
  const { orderId, customerId, reason, reasonNote, refundMethod, refundAccountDetails, items } = req.body || {};

  if (!orderId) {
    return res.status(400).json({ error: 'Missing order ID.' });
  }
  if (!reason) {
    return res.status(400).json({ error: 'Missing return reason.' });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Please select at least one item to return.' });
  }

  // Verify the order exists before inserting
  const { data: orderCheck, error: orderError } = await supabaseAdmin
    .from('orders')
    .select('id')
    .eq('id', orderId)
    .single();

  if (orderError || !orderCheck) {
    return res.status(404).json({ error: 'Order not found.' });
  }

  // Insert the return request using the service role (bypasses RLS)
  const { data, error } = await supabaseAdmin
    .from('return_requests')
    .insert({
      order_id: orderId,
      customer_id: customerId || null,
      reason,
      reason_note: reasonNote || null,
      refund_method: refundMethod || null,
      refund_account_details: refundAccountDetails || null,
      items,
      status: 'pending'  // Explicit — matches admin dashboard enum exactly
    })
    .select()
    .single();

  if (error) {
    console.error('Return request insert error:', error);
    return res.status(500).json({ error: error.message });
  }

  return res.status(201).json({
    success: true,
    request: {
      id: data.id,
      orderId: data.order_id,
      reason: data.reason,
      reasonNote: data.reason_note,
      refundMethod: data.refund_method,
      refundAccountDetails: data.refund_account_details,
      items: data.items,
      status: data.status,
      createdAt: data.created_at
    }
  });
}
