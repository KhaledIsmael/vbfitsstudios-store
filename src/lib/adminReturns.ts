import { adminSupabase } from './supabaseClient';
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
  refund_method?: string;
  refund_account_details?: any;
  refund_transaction_ref?: string;
  refund_completed_at?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Fetches all return requests from the database using the admin Supabase client.
 * Uses adminSupabase which has the admin's authenticated session,
 * allowing RLS policies to recognize the admin role.
 */
export async function fetchReturnRequests(): Promise<ReturnRequestItem[]> {
  try {
    // Use adminSupabase — NOT supabase — so the admin's auth session is attached
    // and RLS recognizes them as admin/support role
    const { data, error } = await adminSupabase
      .from('return_requests')
      .select('*, order:orders(order_number, total, shipping_address_snapshot)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('fetchReturnRequests DB error:', error.message, error.details);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    const dbItems: ReturnRequestItem[] = data.map((r: any) => {
      const addr = r.order?.shipping_address_snapshot || {};
      return {
        id: r.id,
        order_id: r.order_id,
        order_number: r.order?.order_number || r.order_id?.slice(0, 8),
        customer_id: r.customer_id,
        customer_name: addr.name || addr.full_name || 'Valued Client',
        customer_email: addr.email || '',
        customer_phone: addr.phone || '',
        reason: r.reason || 'wrong_size',
        reason_note: r.reason_note,
        status: (r.status as ReturnStatus) || 'pending',
        items: r.items || [],
        staff_notes: r.staff_notes,
        refund_amount: Number(r.refund_amount || r.order?.total || 0),
        refund_method: r.refund_method,
        refund_account_details: r.refund_account_details,
        refund_transaction_ref: r.refund_transaction_ref,
        refund_completed_at: r.refund_completed_at,
        created_at: r.created_at,
        updated_at: r.updated_at || r.created_at
      };
    });

    return dbItems;
  } catch (err) {
    console.error('fetchReturnRequests exception:', err);
    return [];
  }
}

/**
 * Updates the status of a return request using the admin client.
 */
export async function updateReturnRequestStatus(
  id: string,
  newStatus: ReturnStatus,
  staffNotes?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const payload: any = {
      status: newStatus,
      updated_at: new Date().toISOString()
    };
    if (staffNotes !== undefined) {
      payload.staff_notes = staffNotes;
    }

    const { error } = await adminSupabase
      .from('return_requests')
      .update(payload)
      .eq('id', id);

    if (error) {
      console.error('updateReturnRequestStatus DB error:', error.message);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error('updateReturnRequestStatus exception:', err);
    return { success: false, error: err.message };
  }
}

export async function issueDirectReturnRefund(
  returnRequestId: string,
  orderId: string,
  amount: number,
  transactionRef: string,
  reason: string = 'Return approved and collected',
  customerEmail?: string,
  customerName?: string,
  orderNumber?: string,
  refundMethod?: string
): Promise<{ success: boolean; error?: string }> {
  // 1. Mark return as refunded and save transaction details
  try {
    const payload = {
      status: 'refunded',
      updated_at: new Date().toISOString(),
      staff_notes: `Refund of $${amount.toFixed(2)} dispatched via ${refundMethod || 'cash'}. Ref: ${transactionRef}`,
      refund_transaction_ref: transactionRef,
      refund_completed_at: new Date().toISOString()
    };

    const { error } = await adminSupabase
      .from('return_requests')
      .update(payload)
      .eq('id', returnRequestId);

    if (error) throw error;
  } catch (err: any) {
    return { success: false, error: err.message };
  }

  // 2. Write refund to orders / refunds table
  try {
    await issueOrderRefund(
      orderId,
      amount,
      `Return claim #${returnRequestId.slice(0, 8)}: ${reason}`,
      `Triggered from /admin/returns workflow. Ref: ${transactionRef}`
    );
  } catch (err) {
    console.warn('issueDirectReturnRefund notice:', err);
  }

  // 3. Trigger confirmation email
  if (customerEmail) {
    try {
      await fetch('/api/email/return-refunded', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerEmail,
          customerName,
          orderNumber,
          amount,
          method: refundMethod,
          transactionRef
        })
      });
    } catch (e) {
      console.error('Failed to trigger refund email:', e);
    }
  }

  return { success: true };
}

