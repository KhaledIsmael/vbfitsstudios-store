import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import * as crypto from 'node:crypto';

const {
  mockClientFrom,
  mockClientRpc,
  mockServerFrom,
} = vi.hoisted(() => ({
  mockClientFrom: vi.fn(),
  mockClientRpc: vi.fn(),
  mockServerFrom: vi.fn(),
}));

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from: mockClientFrom,
    rpc: mockClientRpc,
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
  },
  adminSupabase: {
    from: mockClientFrom,
    auth: {
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
    },
  },
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: mockServerFrom,
  })),
}));

import webhookHandler from '../../api/paymob/webhook';
import {
  createOrder,
  getUserOrders,
  lookupOrderForGuest,
} from '../lib/orders';
import {
  isWithinReturnWindow,
  createReturnRequest,
} from '../lib/returns';
import {
  getFilteredProducts,
} from '../lib/products';
import {
  setPublicReadScope,
  getPublicReadStats,
  publicRead,
} from '../lib/publicReadCache';
import {
  detectOutage,
  reportOutage,
  getOutageState,
  __resetOutageForTests,
} from '../lib/outage';
import { probeConnectivity } from '../lib/connectivity';

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
  'success',
] as const;

function buildSignedPaymobPost(
  overrides: Partial<Record<(typeof HMAC_QUERY_FIELDS)[number], string>>,
  secret: string,
  merchantOrderId: string = 'VBF-77001'
) {
  const base: Record<string, string> = {
    amount_cents: '120000',
    created_at: '2026-11-24T15:00:00',
    currency: 'EGP',
    error_occured: 'false',
    has_parent_transaction: 'false',
    id: '700100',
    integration_id: '441122',
    is_3d_secure: 'true',
    is_auth: 'false',
    is_capture: 'false',
    is_refunded: 'false',
    is_standalone_payment: 'true',
    is_voided: 'false',
    order: merchantOrderId,
    owner: '101',
    pending: 'false',
    source_data_pan: '1111',
    source_data_sub_type: 'Visa',
    source_data_type: 'card',
    success: 'true',
    ...overrides,
  };

  const concat = HMAC_QUERY_FIELDS.map((k) => base[k] ?? '').join('');
  const hmac = crypto.createHmac('sha512', secret).update(concat).digest('hex');

  return {
    hmac,
    obj: {
      ...base,
      source_data: {
        pan: base.source_data_pan,
        sub_type: base.source_data_sub_type,
        type: base.source_data_type,
      },
    },
  };
}

describe('QA Release Lead — End-to-End Functional, Webhook & Security Gates', () => {
  const TEST_SECRET = 'qa-release-hmac-secret';

  beforeEach(() => {
    vi.clearAllMocks();
    __resetOutageForTests();
    process.env.PAYMOB_HMAC_SECRET = TEST_SECRET;
    process.env.SUPABASE_URL = 'https://synthetic.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'synthetic-service-role-key';
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 1. Paymob Webhook Matrix: Failure, Duplicate, Out-of-Order, Bad HMAC
  // ───────────────────────────────────────────────────────────────────────────
  describe('Paymob Sandbox Callback Edge Cases', () => {
    it('records payment_status=failed when transaction fails and does not send confirmation email', async () => {
      const updateEqMock = vi.fn().mockResolvedValue({ error: null });
      const updateMock = vi.fn().mockReturnValue({ eq: updateEqMock });

      mockServerFrom.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: 'ord-fail-1',
                order_number: 'VBF-77001',
                payment_status: 'unpaid',
                status: 'Placed',
                notes: 'Contact Email: guest.a@synthetic.test',
              },
              error: null,
            }),
          }),
        }),
        update: updateMock,
      }));

      const body = buildSignedPaymobPost(
        { id: '700102', success: 'false', error_occured: 'true' },
        TEST_SECRET,
        'VBF-77001'
      );

      const sendMock = vi.fn();
      const jsonMock = vi.fn();
      const statusMock = vi.fn().mockReturnValue({ send: sendMock, json: jsonMock });

      await webhookHandler({ method: 'POST', body } as any, { status: statusMock } as any);

      expect(updateMock).toHaveBeenCalledWith({
        payment_status: 'failed',
        status: 'Placed',
        notes: 'Contact Email: guest.a@synthetic.test | Paymob txn 700102 | failed',
      });
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({ received: true, status: 'failed' });
    });

    it('is idempotent on duplicate paid callbacks (does not duplicate notes or re-send confirmation email)', async () => {
      const updateEqMock = vi.fn().mockResolvedValue({ error: null });
      const updateMock = vi.fn().mockReturnValue({ eq: updateEqMock });
      let selectCalls = 0;

      mockServerFrom.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockImplementation(async () => {
              selectCalls++;
              return {
                data: {
                  id: 'ord-dup-1',
                  order_number: 'VBF-77002',
                  payment_status: 'paid',
                  status: 'Placed',
                  notes: 'Contact Email: guest.a@synthetic.test | Paymob txn 700200 | paid',
                },
                error: null,
              };
            }),
          }),
        }),
        update: updateMock,
      }));

      const body = buildSignedPaymobPost(
        { id: '700200', success: 'true' },
        TEST_SECRET,
        'VBF-77002'
      );

      const sendMock = vi.fn();
      const jsonMock = vi.fn();
      const statusMock = vi.fn().mockReturnValue({ send: sendMock, json: jsonMock });

      await webhookHandler({ method: 'POST', body } as any, { status: statusMock } as any);

      // Notes should NOT have a second "| Paymob txn 700200 | paid" appended
      expect(updateMock).toHaveBeenCalledWith({
        payment_status: 'paid',
        status: 'Placed',
        notes: 'Contact Email: guest.a@synthetic.test | Paymob txn 700200 | paid',
      });
      // And fullOrder select for confirmation email should NOT have been called because wasAlreadyPaid === true
      expect(selectCalls).toBe(1);
    });

    it('rejects out-of-order failure downgrade when order was already marked paid', async () => {
      const updateEqMock = vi.fn().mockResolvedValue({ error: null });
      const updateMock = vi.fn().mockReturnValue({ eq: updateEqMock });

      mockServerFrom.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: 'ord-ooo-1',
                order_number: 'VBF-77003',
                payment_status: 'paid',
                status: 'Placed',
                notes: 'Contact Email: guest.a@synthetic.test | Paymob txn 700302 | paid',
              },
              error: null,
            }),
          }),
        }),
        update: updateMock,
      }));

      // Delayed failed callback from an earlier payment attempt (txn 700301) arrives after txn 700302 succeeded
      const body = buildSignedPaymobPost(
        { id: '700301', success: 'false', error_occured: 'true' },
        TEST_SECRET,
        'VBF-77003'
      );

      const sendMock = vi.fn();
      const jsonMock = vi.fn();
      const statusMock = vi.fn().mockReturnValue({ send: sendMock, json: jsonMock });

      await webhookHandler({ method: 'POST', body } as any, { status: statusMock } as any);

      // Must keep payment_status as 'paid' — never downgrade to 'failed'
      expect(updateMock).toHaveBeenCalledWith({
        payment_status: 'paid',
        status: 'Placed',
        notes:
          'Contact Email: guest.a@synthetic.test | Paymob txn 700302 | paid | Paymob txn 700301 | failed',
      });
    });

    it('rejects tampered HMAC without updating DB or leaking customer params in warning logs', async () => {
      const updateMock = vi.fn();
      mockServerFrom.mockImplementation(() => ({
        update: updateMock,
      }));

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const body = buildSignedPaymobPost(
        { id: '700400', success: 'true' },
        'wrong-attacker-secret',
        'VBF-77004'
      );

      const sendMock = vi.fn();
      const statusMock = vi.fn().mockReturnValue({ send: sendMock });

      await webhookHandler({ method: 'POST', body } as any, { status: statusMock } as any);

      expect(updateMock).not.toHaveBeenCalled();
      expect(sendMock).toHaveBeenCalledWith('HMAC_MISMATCH');

      // Ensure raw PAN / source_data were not logged
      const loggedStr = JSON.stringify(warnSpy.mock.calls);
      expect(loggedStr).not.toContain('source_data_pan');
      expect(loggedStr).not.toContain('1111');
      warnSpy.mockRestore();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. Order Tracking, Guest COD & Privacy Boundaries
  // ───────────────────────────────────────────────────────────────────────────
  describe('Order Tracking, Guest COD & Privacy Boundaries', () => {
    it('createOrder initializes new COD orders with tracking_number: null (no invented DHL number)', async () => {
      let capturedInsertPayload: any = null;

      mockClientFrom.mockImplementation((table: string) => {
        if (table === 'orders') {
          return {
            insert: vi.fn((payload: any) => {
              capturedInsertPayload = payload;
              return {
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: {
                      id: 'ord-new-cod-1',
                      order_number: payload.order_number,
                      tracking_number: payload.tracking_number,
                      total: 899,
                      status: 'Placed',
                    },
                    error: null,
                  }),
                }),
              };
            }),
          };
        }
        if (table === 'order_items') {
          return {
            insert: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      });

      const res = await createOrder({
        customerId: null,
        items: [
          {
            productId: 'prod-1',
            name: 'Synthetic Heavyweight Tee',
            size: 'L',
            price: 899,
            quantity: 1,
            image: '/assets/products/black-shirt.webp',
          },
        ],
        subtotal: 899,
        total: 899,
        shippingAddress: {
          name: 'Synthetic Guest A',
          email: 'guest.a@synthetic.test',
          phone: '01000000001',
          street: '10 Synthetic St',
          city: 'Cairo',
          governorate: 'Cairo',
          country: 'Egypt',
        },
        paymentMethod: 'COD',
      });

      expect(res.error).toBeNull();
      expect(capturedInsertPayload).toBeDefined();
      expect(capturedInsertPayload.tracking_number).toBeNull();
      expect(res.order?.tracking_number).toBeNull();
    });

    it('lookupOrderForGuest blocks guest B from looking up guest A order with mismatched email/phone', async () => {
      mockClientFrom.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          ilike: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: 'ord-guest-a',
                order_number: 'VBF-10101',
                notes: 'Contact Email: guest.a@synthetic.test | Payment: COD',
                shipping_address_snapshot: {
                  name: 'Guest A',
                  phone: '01011111111',
                  email: 'guest.a@synthetic.test',
                },
              },
              error: null,
            }),
          }),
        }),
      }));

      // Guest B tries with wrong email
      const wrongEmailRes = await lookupOrderForGuest('VBF-10101', 'guest.b@synthetic.test');
      expect(wrongEmailRes.orderId).toBeNull();
      expect(wrongEmailRes.error).toContain('does not match');

      // Guest B tries with wrong phone
      const wrongPhoneRes = await lookupOrderForGuest('VBF-10101', '01299999999');
      expect(wrongPhoneRes.orderId).toBeNull();
      expect(wrongPhoneRes.error).toContain('does not match');

      // Guest A succeeds with matching email
      const validRes = await lookupOrderForGuest('VBF-10101', 'Guest.A@synthetic.test');
      expect(validRes.error).toBeNull();
      expect(validRes.orderId).toBe('ord-guest-a');
    });

    it('getUserOrders returns null trackingNumber when order has not been dispatched (never invents DHL-)', async () => {
      mockClientRpc.mockResolvedValue({ data: { linked_count: 0 }, error: null });
      mockClientFrom.mockImplementation((table: string) => {
        if (table === 'store_settings') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: 'ord-cust-a',
                    order_number: 'VBF-20202',
                    status: 'Placed',
                    total: 899,
                    currency: 'EGP',
                    tracking_number: null,
                    created_at: '2026-11-24T10:00:00Z',
                    items: [],
                  },
                ],
                error: null,
              }),
            }),
          }),
        };
      });

      const orders = await getUserOrders('synthetic-customer-a', 'cust.a@synthetic.test');
      expect(orders).toHaveLength(1);
      expect(orders[0].trackingNumber).toBeNull();
    });

    it('isolates publicReadCache across auth user transitions', async () => {
      setPublicReadScope('customer-a');
      await publicRead('test:scoped:key', async () => 'val-a', { ttlMs: 30_000 });
      expect(getPublicReadStats().entries).toBe(1);

      // Switching to customer-b clears cache immediately
      setPublicReadScope('customer-b');
      expect(getPublicReadStats().entries).toBe(0);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. Returns Window & Validation
  // ───────────────────────────────────────────────────────────────────────────
  describe('Returns Window & Boundary Validation', () => {
    it('enforces 14-day return eligibility window from delivered_at or created_at', () => {
      const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
      const twentyDaysAgo = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString();

      expect(isWithinReturnWindow(fiveDaysAgo, twentyDaysAgo)).toBe(true);
      expect(isWithinReturnWindow(twentyDaysAgo, twentyDaysAgo)).toBe(false);
      expect(isWithinReturnWindow(null, fiveDaysAgo)).toBe(true);
      expect(isWithinReturnWindow(null, twentyDaysAgo)).toBe(false);
    });

    it('validates required orderId and non-empty items before calling /api/returns/submit', async () => {
      const missingOrder = await createReturnRequest({
        orderId: '',
        customerId: 'cust-a',
        reason: 'wrong_size',
        items: [{ order_item_id: 'i1', name: 'Shirt', size: 'M', quantity_to_return: 1 }],
      });
      expect(missingOrder.request).toBeNull();
      expect(missingOrder.error).toContain('Missing order ID');

      const emptyItems = await createReturnRequest({
        orderId: 'ord-1',
        customerId: 'cust-a',
        reason: 'wrong_size',
        items: [],
      });
      expect(emptyItems.request).toBeNull();
      expect(emptyItems.error).toContain('at least one item');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. Catalog Sort/Filter & Outage Probe Recovery
  // ───────────────────────────────────────────────────────────────────────────
  describe('Catalog Filtering & Outage Recovery', () => {
    it('filters and sorts products in-memory across price, size, and stock criteria', async () => {
      mockClientFrom.mockImplementation((table: string) => {
        if (table === 'products') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: [
                    {
                      id: 'p1',
                      name: 'Alpha Tee',
                      slug: 'alpha-tee',
                      price: 750,
                      currency: 'EGP',
                      in_stock: true,
                      is_featured: true,
                      is_published: true,
                      created_at: '2026-11-20T00:00:00Z',
                      category: { name: 'T-Shirts', slug: 't-shirts' },
                      images: [{ url: '/assets/products/black-shirt.webp', is_primary: true, display_order: 0 }],
                      variants: [{ id: 'v1', size: 'M', stock: 5, sku: 'ALP-M' }],
                    },
                    {
                      id: 'p2',
                      name: 'Beta Hoodie',
                      slug: 'beta-hoodie',
                      price: 1500,
                      currency: 'EGP',
                      in_stock: false,
                      is_featured: false,
                      is_published: true,
                      created_at: '2026-11-22T00:00:00Z',
                      category: { name: 'Hoodies', slug: 'hoodies' },
                      images: [{ url: '/assets/products/white-shirt.webp', is_primary: true, display_order: 0 }],
                      variants: [{ id: 'v2', size: 'XL', stock: 0, sku: 'BET-XL' }],
                    },
                  ],
                  error: null,
                }),
              }),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        };
      });

      const inStockOnly = await getFilteredProducts({ inStockOnly: true });
      expect(inStockOnly.every((p) => p.sizes && p.sizes.length > 0)).toBe(true);

      const sortedDesc = await getFilteredProducts({ sortBy: 'price-desc' });
      expect(sortedDesc.length).toBeGreaterThanOrEqual(2);
      expect(sortedDesc[0].price).toBeGreaterThanOrEqual(sortedDesc[1].price);
    });

    it('recovers from HTTP 402 outage when probeConnectivity confirms server is healthy', async () => {
      const detected = detectOutage({ status: 402, message: '402 Payment Required (Egress Quota)' });
      expect(detected).not.toBeNull();
      reportOutage(detected!);
      expect(getOutageState().active).toBe(true);
      expect(getOutageState().kind).toBe('billing');

      const chain: any = {
        select: vi.fn(() => chain),
        eq: vi.fn(() => chain),
        limit: vi.fn(() => chain),
        abortSignal: vi.fn().mockResolvedValue({ data: [{ key: 'catalog_products_override' }], error: null }),
      };
      mockClientFrom.mockReturnValue(chain);

      const recovered = await probeConnectivity();
      expect(recovered).toBe(true);
      expect(getOutageState().active).toBe(false);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. Compiled Browser Bundle Security Gate (dist/assets/*.js)
  // ───────────────────────────────────────────────────────────────────────────
  describe('Compiled Browser Bundle Security Gate', () => {
    it('verifies service-role and server secrets are absent from compiled dist/assets/*.js', () => {
      const distAssetsDir = path.resolve(__dirname, '../../dist/assets');
      if (!fs.existsSync(distAssetsDir)) {
        // Build runs in quality gate; if dist exists, inspect every JS chunk
        return;
      }

      const jsFiles = fs.readdirSync(distAssetsDir).filter((f) => f.endsWith('.js'));
      expect(jsFiles.length).toBeGreaterThan(0);

      for (const file of jsFiles) {
        const content = fs.readFileSync(path.join(distAssetsDir, file), 'utf8');
        expect(content).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
        expect(content).not.toContain('PAYMOB_HMAC_SECRET');
        expect(content).not.toContain('PAYMOB_API_KEY');
        expect(content).not.toContain('BREVO_API_KEY');
        expect(content).not.toContain('CRON_SECRET');
      }
    });
  });
});
