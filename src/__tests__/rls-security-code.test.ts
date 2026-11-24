import { describe, it, expect, vi, beforeEach } from 'vitest';

const { rpcMock, fromMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
  fromMock: vi.fn(),
}));

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    rpc: rpcMock,
    from: fromMock,
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
  },
  adminSupabase: null,
}));

import {
  linkPastOrdersToCustomer,
  getUserOrders,
  lookupGuestOrder,
} from '../lib/orders';
import webhookHandler from '../../api/paymob/webhook';

describe('RLS Security Code Hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('linkPastOrdersToCustomer uses server RPC and never scans orders with customer_id IS NULL', async () => {
    rpcMock.mockResolvedValueOnce({ data: { linked_count: 2, error: null }, error: null });

    const res = await linkPastOrdersToCustomer('cust-123', 'Client@Example.com', '010 1234-5678');

    expect(rpcMock).toHaveBeenCalledWith('link_guest_orders_to_customer', {
      p_customer_id: 'cust-123',
      p_email: 'client@example.com',
      p_phone: '01012345678',
    });
    expect(fromMock).not.toHaveBeenCalled();
    expect(res).toEqual({ linkedCount: 2, error: null });
  });

  it('getUserOrders only queries own customer_id and never scans guest orders', async () => {
    rpcMock.mockResolvedValueOnce({ data: { linked_count: 0, error: null }, error: null });

    const isMock = vi.fn();
    const orderMock = vi.fn().mockResolvedValue({ data: [], error: null });
    const eqMock = vi.fn().mockReturnValue({ order: orderMock, is: isMock });
    const selectMock = vi.fn().mockReturnValue({ eq: eqMock, is: isMock });
    fromMock.mockReturnValue({ select: selectMock });

    const orders = await getUserOrders('cust-123', 'client@example.com');

    expect(orders).toEqual([]);
    expect(eqMock).toHaveBeenCalledWith('customer_id', 'cust-123');
    expect(isMock).not.toHaveBeenCalled();
  });

  it('lookupGuestOrder uses lookup_guest_order RPC and returns formatted order on match', async () => {
    rpcMock.mockResolvedValueOnce({
      data: {
        id: 'ord-1',
        order_number: 'VBF-10001',
        status: 'placed',
        currency: 'EGP',
        total: 500,
        tracking_number: 'DHL-123',
        delivered_at: null,
        created_at: '2026-11-24T10:00:00Z',
        order_items: [
          {
            id: 'item-1',
            product_name: 'Black Shirt',
            variant_title: 'Size: M',
            unit_price: 500,
            quantity: 1,
            total_price: 500,
            image_url: '/assets/products/black-shirt.webp',
          },
        ],
      },
      error: null,
    });

    const isMock = vi.fn();
    const singleMock = vi.fn().mockResolvedValue({ data: { value: {} }, error: null });
    const eqMock = vi.fn().mockReturnValue({ single: singleMock, maybeSingle: singleMock });
    fromMock.mockReturnValue({
      select: vi.fn().mockReturnValue({ eq: eqMock, is: isMock }),
    });

    const order = await lookupGuestOrder('vbf-10001', 'Guest@Example.com');

    expect(rpcMock).toHaveBeenCalledWith('lookup_guest_order', {
      p_order_number: 'VBF-10001',
      p_email: 'guest@example.com',
    });
    expect(order?.id).toBe('VBF-10001');
    expect(order?.items).toHaveLength(1);
  });

  it('Paymob webhook fails closed (HTTP 500) when SUPABASE_SERVICE_ROLE_KEY is missing', async () => {
    const prevHmac = process.env.PAYMOB_HMAC_SECRET;
    const prevUrl = process.env.SUPABASE_URL;
    const prevService = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const prevAnon = process.env.VITE_SUPABASE_ANON_KEY;

    process.env.PAYMOB_HMAC_SECRET = 'test-hmac';
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    process.env.VITE_SUPABASE_ANON_KEY = 'anon-key-should-not-be-used';

    const statusMock = vi.fn();
    const sendMock = vi.fn();
    statusMock.mockReturnValue({ send: sendMock });

    await webhookHandler({ method: 'POST', body: {} } as any, { status: statusMock } as any);

    expect(statusMock).toHaveBeenCalledWith(500);
    expect(sendMock).toHaveBeenCalledWith('Database not configured');

    if (prevHmac !== undefined) process.env.PAYMOB_HMAC_SECRET = prevHmac;
    else delete process.env.PAYMOB_HMAC_SECRET;
    if (prevUrl !== undefined) process.env.SUPABASE_URL = prevUrl;
    else delete process.env.SUPABASE_URL;
    if (prevService !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = prevService;
    if (prevAnon !== undefined) process.env.VITE_SUPABASE_ANON_KEY = prevAnon;
    else delete process.env.VITE_SUPABASE_ANON_KEY;
  });
});
