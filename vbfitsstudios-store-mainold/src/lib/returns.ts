import { supabase } from './supabaseClient';

// ─── Return window config ─────────────────────────────────────────────────────
export const RETURN_WINDOW_DAYS = 14;

export const RETURN_REASONS = [
  { value: 'wrong_size',       label: 'Wrong size received' },
  { value: 'wrong_item',       label: 'Wrong item received' },
  { value: 'damaged',          label: 'Item arrived damaged' },
  { value: 'not_as_described', label: 'Not as described' },
  { value: 'changed_mind',     label: 'Changed my mind' },
  { value: 'exchange_requested', label: 'Exchange requested' },
  { value: 'other',            label: 'Other reason' }
] as const;

export type ReturnReason = typeof RETURN_REASONS[number]['value'];

export const REFUND_METHODS = [
  { value: 'vodafone_cash', label: 'Vodafone Cash / E-Wallet' },
  { value: 'instapay', label: 'Instapay' },
  { value: 'bank_transfer', label: 'Bank Transfer (IBAN)' },
  { value: 'original_payment_method', label: 'Original Payment Method (Card)' }
] as const;

export type RefundMethod = typeof REFUND_METHODS[number]['value'];

export interface ReturnRequestItem {
  order_item_id: string;
  name: string;
  size: string;
  quantity_to_return: number;
}

export interface ReturnRequest {
  id: string;
  orderId: string;
  reason: ReturnReason;
  reasonNote?: string;
  refundMethod?: RefundMethod;
  refundAccountDetails?: Record<string, string>;
  refundTransactionRef?: string;
  items: ReturnRequestItem[];
  status: string;
  createdAt: string;
}

/**
 * Returns true if the order is within the return window.
 * Uses delivered_at if present, otherwise falls back to created_at.
 */
export function isWithinReturnWindow(
  deliveredAt: string | null | undefined,
  createdAt: string
): boolean {
  const base = deliveredAt
    ? new Date(deliveredAt)
    : new Date(createdAt);
  const now = new Date();
  const diffMs = now.getTime() - base.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays <= RETURN_WINDOW_DAYS;
}

/**
 * Creates a return_requests row via the secure server-side API endpoint.
 * The API uses SUPABASE_SERVICE_ROLE_KEY to bypass RLS policies,
 * permanently fixing the "new row violates row-level security policy" error.
 */
export async function createReturnRequest(params: {
  orderId: string;
  customerId: string | null;
  reason: ReturnReason;
  reasonNote?: string;
  refundMethod?: string;
  refundAccountDetails?: Record<string, string>;
  items: ReturnRequestItem[];
}): Promise<{ request: ReturnRequest | null; error: string | null }> {
  const { orderId, customerId, reason, reasonNote, refundMethod, refundAccountDetails, items } = params;

  if (!orderId) {
    return { request: null, error: 'Missing order ID.' };
  }
  if (items.length === 0) {
    return { request: null, error: 'Please select at least one item to return.' };
  }

  try {
    const response = await fetch('/api/returns/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId,
        customerId,
        reason,
        reasonNote: reasonNote || null,
        refundMethod: refundMethod || null,
        refundAccountDetails: refundAccountDetails || null,
        items
      })
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      console.error('createReturnRequest API error:', result.error);
      return { request: null, error: result.error || 'Failed to submit return request.' };
    }

    return { request: result.request, error: null };
  } catch (err: any) {
    console.error('createReturnRequest network error:', err);
    return { request: null, error: 'Network error. Please try again.' };
  }
}

/**
 * Fetches all return requests for a given customer.
 */
export async function getCustomerReturnRequests(
  customerId: string
): Promise<ReturnRequest[]> {
  if (!customerId) return [];

  const { data, error } = await supabase
    .from('return_requests')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('getCustomerReturnRequests error:', error.message);
    return [];
  }

  return (data || []).map((row) => ({
    id: row.id,
    orderId: row.order_id,
    reason: row.reason,
    reasonNote: row.reason_note,
    refundMethod: row.refund_method,
    refundAccountDetails: row.refund_account_details,
    refundTransactionRef: row.refund_transaction_ref,
    items: row.items || [],
    status: row.status,
    createdAt: row.created_at
  }));
}

/**
 * Checks if a return request already exists for a given order.
 */
export async function hasExistingReturnRequest(orderId: string): Promise<boolean> {
  if (!orderId) return false;
  const { data } = await supabase
    .from('return_requests')
    .select('id')
    .eq('order_id', orderId)
    .limit(1)
    .maybeSingle();
  return !!data;
}
