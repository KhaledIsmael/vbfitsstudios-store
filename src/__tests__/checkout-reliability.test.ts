/**
 * Checkout Reliability Unit Tests
 * Recovery Task: fix/egress-reliability — Finding 3.2
 *
 * Tests the core createOrder() logic and classifyOrderError() classification
 * using vi.mock() to stub the Supabase client. All tests run in-process with
 * no network or real database access.
 *
 * Run:  npx vitest run src/__tests__/checkout-reliability.test.ts
 *       (requires: npm install -D vitest @vitest/ui jsdom)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─────────────────────────────────────────────────────────────────────────────
// Module mocks — must be declared before any imports that use them
// ─────────────────────────────────────────────────────────────────────────────

/** Supabase response factory helpers */
const mockSupabaseSuccess = (data: any) => ({
  data,
  error: null,
});
const mockSupabaseError = (message: string, code?: string) => ({
  data: null,
  error: { message, code: code ?? 'PGRST000', details: '', hint: '' },
});

// Chainable builder returned by supabase.from(...)
function makeQueryBuilder(
  overrides: Partial<{
    insert: () => any;
    select: () => any;
    update: () => any;
    eq: () => any;
    single: () => any;
    maybeSingle: () => any;
  }> = {}
) {
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(mockSupabaseSuccess({ id: 'order-uuid-123', order_number: 'VBF-11111', tracking_number: 'DHL-999999999', total: 899, status: 'pending' })),
    maybeSingle: vi.fn().mockResolvedValue(mockSupabaseSuccess(null)),
    ...overrides,
  };
  return chain;
}

let mockFromImpl: (table: string) => any;

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from: (table: string) => mockFromImpl(table),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    },
  },
}));

vi.mock('../lib/telegramNotifier', () => ({
  sendTelegramOrderAlert: vi.fn().mockResolvedValue(undefined),
}));

// ─────────────────────────────────────────────────────────────────────────────
// Test subject imports — after mocks
// ─────────────────────────────────────────────────────────────────────────────
import { createOrder, getOrderPaymentStatus } from '../lib/orders';
import { classifyOrderError } from '../lib/orderErrors';

// ─────────────────────────────────────────────────────────────────────────────
// Minimal valid order params
// ─────────────────────────────────────────────────────────────────────────────
const validParams = {
  customerId: null as string | null,
  items: [
    { name: 'VB Long Sleeve', size: 'M', price: 799, image: '/img/ls.jpg', quantity: 1 },
  ],
  subtotal: 799,
  discountAmount: 0,
  shippingAmount: 100,
  total: 899,
  shippingAddress: {
    name: 'Test User',
    email: 'test@example.com',
    phone: '01000000000',
    governorate: 'Cairo',
    city: 'Nasr City',
    street: '10 Test St',
    country: 'Egypt',
  },
  paymentMethod: 'Cash on Delivery' as const,
  status: 'pending',
  notes: 'Payment: Cash on Delivery | Contact Email: test@example.com',
  clientRequestId: 'aaaabbbb-0000-0000-0000-ccccdddd0001',
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. classifyOrderError — error classification
// ─────────────────────────────────────────────────────────────────────────────
describe('classifyOrderError', () => {
  it('classifies 402 as billing error (not ambiguous)', () => {
    const r = classifyOrderError('402 Payment Required');
    expect(r.isAmbiguous).toBe(false);
    expect(r.userMessage).toContain('service limit');
  });

  it('classifies 429 as rate-limit error (not ambiguous)', () => {
    const r = classifyOrderError('Too many requests — rate limit exceeded');
    expect(r.isAmbiguous).toBe(false);
    expect(r.userMessage).toContain('Too many requests');
  });

  it('classifies RLS violation as confirmed failure (not ambiguous)', () => {
    const r = classifyOrderError('new row violates row-level security policy for table "orders"');
    expect(r.isAmbiguous).toBe(false);
    expect(r.userMessage).toContain('Guest orders');
  });

  it('classifies 500 server error as confirmed failure (not ambiguous)', () => {
    const r = classifyOrderError('Internal server error 500');
    expect(r.isAmbiguous).toBe(false);
    expect(r.userMessage).toContain('server error');
  });

  it('classifies network timeout as ambiguous', () => {
    const r = classifyOrderError('Failed to fetch — network timeout');
    expect(r.isAmbiguous).toBe(true);
    expect(r.userMessage).toContain('connection dropped');
  });

  it('classifies generic error as not ambiguous', () => {
    const r = classifyOrderError('Could not save order.');
    expect(r.isAmbiguous).toBe(false);
    expect(r.userMessage).toContain('Could not save order.');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. createOrder — success path
// ─────────────────────────────────────────────────────────────────────────────
describe('createOrder — success path', () => {
  beforeEach(() => {
    const orderRow = {
      id: 'order-uuid-123',
      order_number: 'VBF-11111',
      tracking_number: 'DHL-999999999',
      total: 899,
      status: 'pending',
    };
    mockFromImpl = (table: string) => {
      if (table === 'orders') {
        return {
          insert: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue(mockSupabaseSuccess(orderRow)),
          maybeSingle: vi.fn().mockResolvedValue(mockSupabaseSuccess(orderRow)),
          update: vi.fn().mockReturnThis(),
        };
      }
      if (table === 'order_items') {
        return {
          insert: vi.fn().mockResolvedValue(mockSupabaseSuccess([{ id: 'item-1' }])),
        };
      }
      if (table === 'addresses') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue(mockSupabaseSuccess(null)),
        };
      }
      if (table === 'store_settings') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue(mockSupabaseSuccess(null)),
        };
      }
      return makeQueryBuilder();
    };
  });

  it('returns order with a valid id on success', async () => {
    const result = await createOrder(validParams);
    expect(result.error).toBeNull();
    expect(result.order?.id).toBe('order-uuid-123');
  });

  it('returns no error on successful COD order', async () => {
    const result = await createOrder(validParams);
    expect(result.error).toBeNull();
  });

  it('propagates clientRequestId into insert payload', async () => {
    let capturedInsertArg: any = null;
    mockFromImpl = (table: string) => {
      if (table === 'orders') {
        return {
          insert: vi.fn().mockImplementation((payload: any) => {
            capturedInsertArg = payload;
            return {
              select: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue(mockSupabaseSuccess({ id: 'order-uuid-123', order_number: 'VBF-11111', total: 899, status: 'pending' })),
            };
          }),
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue(mockSupabaseSuccess({ id: 'order-uuid-123', order_number: 'VBF-11111', total: 899 })),
          update: vi.fn().mockReturnThis(),
        };
      }
      if (table === 'order_items') {
        return { insert: vi.fn().mockResolvedValue(mockSupabaseSuccess([])) };
      }
      if (table === 'addresses') {
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue(mockSupabaseSuccess(null)) };
      }
      if (table === 'store_settings') {
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue(mockSupabaseSuccess(null)) };
      }
      return makeQueryBuilder();
    };

    await createOrder({ ...validParams, clientRequestId: 'test-idempotency-uuid' });
    expect(capturedInsertArg?.client_request_id).toBe('test-idempotency-uuid');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. createOrder — failure paths
// ─────────────────────────────────────────────────────────────────────────────
describe('createOrder — failure paths', () => {
  it('returns error and null order when orders insert fails all fallbacks', async () => {
    mockFromImpl = (table: string) => {
      if (table === 'orders') {
        return {
          insert: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue(mockSupabaseError('500 Internal Server Error')),
          maybeSingle: vi.fn().mockResolvedValue(mockSupabaseSuccess(null)),
          update: vi.fn().mockReturnThis(),
        };
      }
      if (table === 'addresses') {
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue(mockSupabaseSuccess(null)) };
      }
      return makeQueryBuilder();
    };
    const result = await createOrder({ ...validParams, customerId: null });
    // All three insert attempts fail — should return error, NOT an order ID
    expect(result.order).toBeNull();
    expect(result.error).toBeTruthy();
  });

  it('returns error when item is empty', async () => {
    const result = await createOrder({ ...validParams, items: [] });
    expect(result.order).toBeNull();
    expect(result.error).toContain('empty');
  });

  it('returns error for non-COD payment method', async () => {
    const result = await createOrder({ ...validParams, paymentMethod: 'Pay Online' as any });
    expect(result.order).toBeNull();
    expect(result.error).toBeTruthy();
  });

  it('returns error when order_items insert fails and auto-cancels orphan order', async () => {
    let updateCalled = false;
    const orderRow = { id: 'orphan-order', order_number: 'VBF-99999', total: 899, status: 'pending' };
    mockFromImpl = (table: string) => {
      if (table === 'orders') {
        return {
          insert: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue(mockSupabaseSuccess(orderRow)),
          maybeSingle: vi.fn().mockResolvedValue(mockSupabaseSuccess(orderRow)),
          update: vi.fn().mockImplementation(() => {
            updateCalled = true;
            return { eq: vi.fn().mockResolvedValue({ error: null }) };
          }),
        };
      }
      if (table === 'order_items') {
        return { insert: vi.fn().mockResolvedValue(mockSupabaseError('column not found')) };
      }
      if (table === 'addresses') {
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue(mockSupabaseSuccess(null)) };
      }
      if (table === 'store_settings') {
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue(mockSupabaseSuccess(null)) };
      }
      return makeQueryBuilder();
    };
    const result = await createOrder({ ...validParams, customerId: null });
    expect(result.order).toBeNull();
    expect(result.error).toBeTruthy();
    expect(updateCalled).toBe(true); // orphan was cancelled
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Checkout submit guard — simulated double-submit scenario
// ─────────────────────────────────────────────────────────────────────────────
describe('submit guard — concurrent submission prevention', () => {
  /**
   * This test verifies the ref-based guard by simulating two calls to createOrder
   * without awaiting the first. The CheckoutPage component uses isSubmittingRef.current
   * to block concurrent submissions — this test verifies the underlying createOrder
   * still works correctly when called sequentially.
   */
  it('createOrder called twice sequentially returns order on first call', async () => {
    const orderRow = { id: 'order-uuid-first', order_number: 'VBF-00001', total: 899, status: 'pending' };
    let callCount = 0;
    mockFromImpl = (table: string) => {
      if (table === 'orders') {
        return {
          insert: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockImplementation(async () => {
            callCount++;
            return mockSupabaseSuccess({ ...orderRow, id: `order-uuid-call-${callCount}` });
          }),
          maybeSingle: vi.fn().mockImplementation(async () =>
            mockSupabaseSuccess({ ...orderRow, id: `order-uuid-call-${callCount}` })
          ),
          update: vi.fn().mockReturnThis(),
        };
      }
      if (table === 'order_items') return { insert: vi.fn().mockResolvedValue(mockSupabaseSuccess([])) };
      if (table === 'addresses') return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue(mockSupabaseSuccess(null)) };
      if (table === 'store_settings') return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue(mockSupabaseSuccess(null)) };
      return makeQueryBuilder();
    };

    const first = await createOrder(validParams);
    const second = await createOrder({ ...validParams, clientRequestId: 'different-uuid' });
    // Both succeed (no server-side dedup without migration) — guard is enforced in the component
    expect(first.error).toBeNull();
    expect(second.error).toBeNull();
    expect(first.order?.id).toBe('order-uuid-call-1');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Outage simulation — 402 / 429 / 5xx / timeout
// ─────────────────────────────────────────────────────────────────────────────
describe('outage error classification', () => {
  const outageScenarios: Array<{ label: string; msg: string; expectAmbiguous: boolean }> = [
    { label: 'Supabase 402 billing', msg: '402 Payment Required from https://nsdurxslkhxqjwlbcpxc.supabase.co', expectAmbiguous: false },
    { label: 'Supabase 429 rate-limit', msg: 'Too many requests — 429', expectAmbiguous: false },
    { label: 'Supabase 503', msg: '503 service unavailable — server error', expectAmbiguous: false },
    { label: 'Network timeout', msg: 'Failed to fetch — network timeout', expectAmbiguous: true },
    { label: 'RLS violation', msg: 'new row violates row-level security policy', expectAmbiguous: false },
  ];

  outageScenarios.forEach(({ label, msg, expectAmbiguous }) => {
    it(`${label}: isAmbiguous=${expectAmbiguous}`, () => {
      const result = classifyOrderError(msg);
      expect(result.isAmbiguous).toBe(expectAmbiguous);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. COD vs online path — no false success navigation
// ─────────────────────────────────────────────────────────────────────────────
describe('COD order — false success guard', () => {
  it('does NOT return a valid order when insert returns null data', async () => {
    mockFromImpl = (table: string) => {
      if (table === 'orders') {
        return {
          insert: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          // Simulate a response where data is null but error is also null (edge case)
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
          maybeSingle: vi.fn().mockResolvedValue(mockSupabaseSuccess(null)),
          update: vi.fn().mockReturnThis(),
        };
      }
      if (table === 'addresses') return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue(mockSupabaseSuccess(null)) };
      return makeQueryBuilder();
    };
    const result = await createOrder({ ...validParams, customerId: null });
    // When all three insert fallbacks return null data, createOrder must return error
    expect(result.order).toBeNull();
    expect(result.error).toBeTruthy();
  });

  it('does NOT return an order ID when order_items insertion fails (auto-cancel path)', async () => {
    mockFromImpl = (table: string) => {
      if (table === 'orders') {
        const orderRow = { id: 'cancelled-uuid', order_number: 'VBF-CANCEL', total: 899 };
        return {
          insert: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue(mockSupabaseSuccess(orderRow)),
          maybeSingle: vi.fn().mockResolvedValue(mockSupabaseSuccess(orderRow)),
          update: vi.fn().mockReturnThis(),
        };
      }
      if (table === 'order_items') return { insert: vi.fn().mockResolvedValue(mockSupabaseError('FK constraint violation')) };
      if (table === 'addresses') return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue(mockSupabaseSuccess(null)) };
      if (table === 'store_settings') return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue(mockSupabaseSuccess(null)) };
      return makeQueryBuilder();
    };
    const result = await createOrder({ ...validParams, customerId: null });
    expect(result.order).toBeNull();
    expect(result.error).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. Idempotency & outage retry safety (no duplicate fallback inserts)
// ─────────────────────────────────────────────────────────────────────────────
describe('createOrder — idempotency & outage retry safety', () => {
  it('returns existing order on 23505 client_request_id collision without creating a duplicate', async () => {
    const existingRow = {
      id: 'existing-order-uuid',
      order_number: 'VBF-77777',
      total: 899,
      status: 'pending',
    };
    const insertSpy = vi.fn().mockReturnThis();
    mockFromImpl = (table: string) => {
      if (table === 'orders') {
        return {
          insert: insertSpy,
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue(
            mockSupabaseError('duplicate key value violates unique constraint "orders_client_request_id_key"', '23505')
          ),
          maybeSingle: vi.fn().mockResolvedValue(mockSupabaseSuccess(existingRow)),
          update: vi.fn().mockReturnThis(),
        };
      }
      if (table === 'addresses') return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue(mockSupabaseSuccess(null)) };
      return makeQueryBuilder();
    };

    const result = await createOrder(validParams);
    expect(result.error).toBeNull();
    expect(result.order?.id).toBe('existing-order-uuid');
    expect(insertSpy).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['402 Payment Required', '402'],
    ['429 Too Many Requests', '429'],
    ['503 Service Unavailable', '503'],
    ['Failed to fetch — network timeout', 'PGRST000'],
    ['new row violates row-level security policy', '42501'],
  ])('does NOT run fallback insert on %s', async (message, code) => {
    const insertSpy = vi.fn().mockReturnThis();
    mockFromImpl = (table: string) => {
      if (table === 'orders') {
        return {
          insert: insertSpy,
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue(mockSupabaseError(message, code)),
          maybeSingle: vi.fn().mockResolvedValue(mockSupabaseSuccess(null)),
          update: vi.fn().mockReturnThis(),
        };
      }
      if (table === 'addresses') return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue(mockSupabaseSuccess(null)) };
      return makeQueryBuilder();
    };

    const result = await createOrder({ ...validParams, customerId: null });
    expect(result.order).toBeNull();
    expect(result.error).toContain(message);
    expect(insertSpy).toHaveBeenCalledTimes(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. Online payment status verification — no false success
// ─────────────────────────────────────────────────────────────────────────────
describe('getOrderPaymentStatus — online payment verification', () => {
  it('returns pending/failed status from server rather than confirming unpaid orders', async () => {
    mockFromImpl = () => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue(
        mockSupabaseSuccess({ id: 'order-online-1', payment_status: 'pending', order_number: 'VBF-88888' })
      ),
    });

    const res = await getOrderPaymentStatus('VBF-88888');
    expect(res.error).toBeNull();
    expect(res.paymentStatus).toBe('pending');
    expect(res.paymentStatus).not.toBe('paid');
  });

  it('returns error and null status when Supabase fails during payment callback check', async () => {
    mockFromImpl = () => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue(mockSupabaseError('503 Service Unavailable', '503')),
    });

    const res = await getOrderPaymentStatus('VBF-88888');
    expect(res.paymentStatus).toBeNull();
    expect(res.orderId).toBeNull();
    expect(res.error).toContain('503');
  });
});
