import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import * as crypto from 'node:crypto';
import {
  getOptimizedImageUrl,
  DEFAULT_PRODUCT_FALLBACK,
  DEFAULT_HERO_FALLBACK,
} from '../lib/image';

const { mockSupabaseFrom } = vi.hoisted(() => ({
  mockSupabaseFrom: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: mockSupabaseFrom,
  })),
}));

import webhookHandler from '../../api/paymob/webhook';

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

function buildSignedPaymobPostBody(
  overrides: Partial<Record<(typeof HMAC_QUERY_FIELDS)[number], string>>,
  secret: string,
  merchantOrderId: string = 'VBF-55501'
) {
  const base: Record<string, string> = {
    amount_cents: '89900',
    created_at: '2026-11-24T12:00:00',
    currency: 'EGP',
    error_occured: 'false',
    has_parent_transaction: 'false',
    id: '900101',
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
    source_data_pan: '2345',
    source_data_sub_type: 'MasterCard',
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

describe('Storage Polish & Safety Invariants (Behavioral)', () => {
  const TEST_SECRET = 'synthetic-paymob-hmac-secret-qa';

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PAYMOB_HMAC_SECRET = TEST_SECRET;
    process.env.SUPABASE_URL = 'https://synthetic.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'synthetic-service-role-key';
  });

  it('does NOT fallback to hardcoded production Supabase project when VITE_SUPABASE_URL is missing', () => {
    const result = getOptimizedImageUrl('products/test-shirt.webp');
    expect(result).not.toContain('nsdurxslkhxqjwlbcpxc.supabase.co');
    expect(result).toBe(DEFAULT_PRODUCT_FALLBACK);

    const heroResult = getOptimizedImageUrl('hero/test-banner.webp');
    expect(heroResult).not.toContain('nsdurxslkhxqjwlbcpxc.supabase.co');
    expect(heroResult).toBe(DEFAULT_HERO_FALLBACK);
  });

  it('verifies hero brand assets exist in both public/assets/hero and assets/hero with valid WebP header', () => {
    const rootDir = path.resolve(__dirname, '../..');
    const publicHeroWebp = path.join(rootDir, 'public/assets/hero/hero.webp');
    const mirrorHeroWebp = path.join(rootDir, 'assets/hero/hero.webp');

    expect(fs.existsSync(publicHeroWebp)).toBe(true);
    expect(fs.existsSync(mirrorHeroWebp)).toBe(true);

    const publicBuf = fs.readFileSync(publicHeroWebp);
    const mirrorBuf = fs.readFileSync(mirrorHeroWebp);

    // Verify RIFF....WEBP magic bytes
    expect(publicBuf.subarray(0, 4).toString('ascii')).toBe('RIFF');
    expect(publicBuf.subarray(8, 12).toString('ascii')).toBe('WEBP');
    expect(publicBuf.length).toBeGreaterThan(10000);
    expect(Buffer.compare(publicBuf, mirrorBuf)).toBe(0);
  });

  it('vercel.json CORS source pattern matches public routes and rejects cron/setup routes', () => {
    const vercelConfigPath = path.resolve(__dirname, '../../vercel.json');
    const vercelConfig = JSON.parse(fs.readFileSync(vercelConfigPath, 'utf8'));

    const corsHeaderConfig = vercelConfig.headers.find((h: any) =>
      h.headers?.some((item: any) => item.key === 'Access-Control-Allow-Origin')
    );

    expect(corsHeaderConfig).toBeDefined();
    const routeRegex = new RegExp(`^${corsHeaderConfig.source}$`);

    // Allowed public routes
    expect(routeRegex.test('/api/contact')).toBe(true);
    expect(routeRegex.test('/api/paymob/create-payment')).toBe(true);
    expect(routeRegex.test('/api/paymob/webhook')).toBe(true);
    expect(routeRegex.test('/api/returns/submit')).toBe(true);

    // Excluded privileged / internal routes
    expect(routeRegex.test('/api/cron/abandoned-carts')).toBe(false);
    expect(routeRegex.test('/api/setup/migrate-chatbot')).toBe(false);
  });

  it('Paymob webhook: preserves existing customer notes on valid payment callback', async () => {
    const updateEqMock = vi.fn().mockResolvedValue({ error: null });
    const updateMock = vi.fn().mockReturnValue({ eq: updateEqMock });

    mockSupabaseFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: 'ord-uuid-1',
              order_number: 'VBF-55501',
              payment_status: 'unpaid',
              status: 'Placed',
              notes: 'Contact Email: synthetic.buyer@example.test | Leave with concierge',
            },
            error: null,
          }),
        }),
      }),
      update: updateMock,
    }));

    const body = buildSignedPaymobPostBody(
      { id: '900101', success: 'true', pending: 'false' },
      TEST_SECRET,
      'VBF-55501'
    );

    const sendMock = vi.fn();
    const jsonMock = vi.fn();
    const statusMock = vi.fn().mockReturnValue({ send: sendMock, json: jsonMock });

    await webhookHandler(
      { method: 'POST', body } as any,
      { status: statusMock } as any
    );

    expect(updateMock).toHaveBeenCalledWith({
      payment_status: 'paid',
      status: 'Placed',
      notes:
        'Contact Email: synthetic.buyer@example.test | Leave with concierge | Paymob txn 900101 | paid',
    });
    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith({ received: true, status: 'paid' });
  });
});
