import { supabase } from './supabaseClient';
import { issueOrderRefund, fetchAdminOrders } from './adminOrders';

export type ReturnStatus = 'pending' | 'approved' | 'rejected' | 'collected' | 'refunded';

export interface ReturnRequestItem {
  id: string;
  order_id: string;
  order_number: string;
  customer_id?: string;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  reason: string;
  reason_note?: string;
  status: ReturnStatus;
  items: Array<{
    name: string;
    size: string;
    color?: string;
    quantity_to_return: number;
    price?: number;
  }>;
  staff_notes?: string;
  refund_amount?: number;
  created_at: string;
  updated_at: string;
}

const LOCAL_RETURNS_KEY = 'vbfits_admin_returns_v1';

const DEFAULT_RETURNS: ReturnRequestItem[] = [];

function getLocalReturns(): ReturnRequestItem[] {
  try {
    const raw = localStorage.getItem(LOCAL_RETURNS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalReturns(items: ReturnRequestItem[]) {
  try {
    localStorage.setItem(LOCAL_RETURNS_KEY, JSON.stringify(items));
  } catch (err) {
    console.warn('Could not save local returns:', err);
  }
}

export async function fetchReturnRequests(): Promise<ReturnRequestItem[]> {
  try {
    const { data, error } = await supabase
      .from('return_requests')
      .select('*, order:orders(order_number, total, shipping_address)')
      .order('created_at', { ascending: false });

    if (!error && data && data.length > 0) {
      const local = getLocalReturns();
      const dbItems: ReturnRequestItem[] = data.map((r: any) => ({
        id: r.id,
        order_id: r.order_id,
        order_number: r.order?.order_number || r.order_id?.slice(0, 8),
        customer_id: r.customer_id,
        customer_name: r.customer_name || r.order?.shipping_address?.name || 'Valued Client',
        customer_email: r.customer_email || 'client@vbfits.com',
        customer_phone: r.customer_phone || r.order?.shipping_address?.phone,
        reason: r.reason || 'wrong_size',
        reason_note: r.reason_note,
        status: (r.status as ReturnStatus) || 'pending',
        items: r.items || [],
        staff_notes: r.staff_notes,
        refund_amount: Number(r.refund_amount || r.order?.total || 0),
        created_at: r.created_at,
        updated_at: r.updated_at || r.created_at
      }));

      // Combine with local overrides
      const merged = dbItems.map((db) => {
        const ovr = local.find((l) => l.id === db.id);
        return ovr ? { ...db, ...ovr } : db;
      });

      saveLocalReturns(merged);
      return merged;
    }
  } catch (err) {
    console.warn('fetchReturnRequests notice:', err);
  }

  return getLocalReturns();
}

export async function updateReturnRequestStatus(
  id: string,
  newStatus: ReturnStatus,
  staffNotes?: string
): Promise<{ success: boolean; error?: string }> {
  // Update local cache
  const local = getLocalReturns();
  const updated = local.map((item) =>
    item.id === id
      ? {
          ...item,
          status: newStatus,
          staff_notes: staffNotes !== undefined ? staffNotes : item.staff_notes,
          updated_at: new Date().toISOString()
        }
      : item
  );
  saveLocalReturns(updated);

  // Sync with Supabase
  try {
    const payload: any = {
      status: newStatus,
      updated_at: new Date().toISOString()
    };
    if (staffNotes !== undefined) {
      payload.staff_notes = staffNotes;
    }

    await supabase.from('return_requests').update(payload).eq('id', id);
  } catch (err) {
    console.warn('updateReturnRequestStatus DB notice:', err);
  }

  return { success: true };
}

export async function issueDirectReturnRefund(
  returnRequestId: string,
  orderId: string,
  amount: number,
  reason: string = 'Return approved and collected'
): Promise<{ success: boolean; error?: string }> {
  // 1. Mark return as refunded
  await updateReturnRequestStatus(
    returnRequestId,
    'refunded',
    `Refund of $${amount.toFixed(2)} dispatched to customer.`
  );

  // 2. Write refund to orders / refunds table
  try {
    await issueOrderRefund(
      orderId,
      amount,
      `Return claim #${returnRequestId.slice(0, 8)}: ${reason}`,
      `Triggered from /admin/returns workflow.`
    );
  } catch (err) {
    console.warn('issueDirectReturnRefund notice:', err);
  }

  return { success: true };
}
