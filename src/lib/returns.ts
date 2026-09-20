import { supabase } from './supabaseClient';

// ─── Return window config ─────────────────────────────────────────────────────
export const RETURN_WINDOW_DAYS = 14;

export const RETURN_REASONS = [
  { value: 'wrong_size',       label: 'Wrong size received' },
  { value: 'wrong_item',       label: 'Wrong item received' },
  { value: 'damaged',          label: 'Item arrived damaged' },
  { value: 'not_as_described', label: 'Not as described' },
  { value: 'changed_mind',     label: 'Changed my mind' },
  { value: 'other',            label: 'Other reason' }
] as const;

export type ReturnReason = typeof RETURN_REASONS[number]['value'];

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
 * Creates a return_requests row in Supabase.
 */
export async function createReturnRequest(params: {
  orderId: string;
  customerId: string;
  reason: ReturnReason;
  reasonNote?: string;
  items: ReturnRequestItem[];
}): Promise<{ request: ReturnRequest | null; error: string | null }> {
  const { orderId, customerId, reason, reasonNote, items } = params;

  if (!orderId || !customerId) {
    return { request: null, error: 'Missing order or customer ID.' };
  }
  if (items.length === 0) {
    return { request: null, error: 'Please select at least one item to return.' };
  }

  const { data, error } = await supabase
    .from('return_requests')
    .insert({
      order_id: orderId,
      customer_id: customerId,
      reason,
      reason_note: reasonNote || null,
      items
    })
    .select()
    .single();

  if (error) {
    console.error('createReturnRequest error:', error.message);
    return { request: null, error: error.message };
  }

  return {
    request: {
      id: data.id,
      orderId: data.order_id,
      reason: data.reason,
      reasonNote: data.reason_note,
      items: data.items,
      status: data.status,
      createdAt: data.created_at
    },
    error: null
  };
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
