/**
 * Request-count harness. Identical file is executed against the pre-change commit (baseline) and the
 * working tree (after) with a counting mock Supabase client. No network, no real data.
 *
 * Prints one `REQUEST_COUNTS {json}` line. Assertions only run for the "after" tree
 * (set VBFITS_BASELINE=1 to disable them when measuring the old code).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const IS_BASELINE = process.env.VBFITS_BASELINE === '1';

const UUID = '11111111-1111-4111-8111-111111111111';

const productRow = {
  id: UUID,
  slug: 'black-ls',
  name: 'Black Long Sleeve',
  price: 100,
  currency: 'EGP',
  featured: true,
  is_new_arrival: true,
  is_published: true,
  category: { id: 'c1', name: 'Long Sleeve', slug: 'long-sleeve' },
  variants: [{ id: 'v1', size: 'M', color: 'Black', stock: 5, sku: 'S1' }],
  images: [{ id: 'i1', url: 'https://x.supabase.co/storage/v1/object/public/product-media/products/a.png', display_order: 0, is_primary: true }],
};

const calls: string[] = [];

function makeChain(table: string) {
  const c: any = {};
  let single = false;
  const result = () => {
    calls.push(table);
    const ok = (data: any) => ({ data, error: null, status: 200 });
    switch (table) {
      case 'products':
        return ok(single ? productRow : [productRow]);
      case 'store_settings':
        return ok(null);
      case 'hero_banners':
        return ok([{ id: 'h1', media_type: 'image', media_url: '/assets/hero/hero.webp', title: 'T', season_tag: '', subtitle: '', cta_text: 'Shop', cta_link: '/shop', sort_order: 0, is_active: true }]);
      case 'site_settings':
        return ok({ id: 'current', launch_at: '2026-10-10T00:00:00+03:00', countdown_gate_enabled: false });
      case 'categories':
        return ok([{ id: 'c1', name: 'Long Sleeve', slug: 'long-sleeve' }]);
      default:
        return ok(null);
    }
  };
  for (const m of ['select', 'eq', 'neq', 'order', 'or', 'in', 'gte', 'lte', 'is', 'limit', 'ilike', 'abortSignal']) {
    c[m] = () => c;
  }
  c.maybeSingle = () => {
    single = true;
    return Promise.resolve(result());
  };
  c.single = c.maybeSingle;
  c.then = (res: any, rej: any) => Promise.resolve(result()).then(res, rej);
  return c;
}

vi.mock('../lib/supabaseClient', () => ({
  supabase: { from: (t: string) => makeChain(t), auth: { getSession: async () => ({ data: { session: null } }) } },
  adminSupabase: null,
}));

function counts(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of calls) out[t] = (out[t] || 0) + 1;
  out.TOTAL = calls.length;
  return out;
}

async function load() {
  const products = await import('../lib/products');
  const hero = await import('../lib/heroBanners');
  const settings = await import('../lib/siteSettings');
  return { products, hero, settings };
}

const report: Record<string, any> = {};

describe('request counts per journey', () => {
  beforeEach(() => {
    calls.length = 0;
    vi.resetModules();
  });

  it('cold landing (/)', async () => {
    const { products, hero, settings } = await load();
    await Promise.all([
      settings.getSiteSettings(),
      hero.fetchHeroBanners(),
      products.getFilteredProducts({ collectionFilter: 'all' }),
    ]);
    report.cold_landing = counts();
    if (!IS_BASELINE) expect(report.cold_landing.TOTAL).toBeLessThanOrEqual(4);
  });

  it('cold shop (/shop) first paint + 3 filter changes', async () => {
    const { products } = await load();
    await products.getCategories();
    await products.getFilteredProducts({ collectionFilter: 'all', sortBy: 'newest' });
    await products.getFilteredProducts({ collectionFilter: 'all', sizes: ['M'] });
    await products.getFilteredProducts({ collectionFilter: 'all', sortBy: 'price-asc' });
    await products.getFilteredProducts({ collectionFilter: 'all', maxPrice: 300 });
    report.cold_shop_with_3_filter_changes = counts();
    if (!IS_BASELINE) expect(report.cold_shop_with_3_filter_changes.TOTAL).toBeLessThanOrEqual(4);
  });

  it('cold PDP (/product/:id) incl. related products', async () => {
    const { products } = await load();
    await Promise.all([products.getProductById(UUID), products.getAllProducts()]);
    report.cold_pdp = counts();
    if (!IS_BASELINE) expect(report.cold_pdp.TOTAL).toBeLessThanOrEqual(3);
  });

  it('warm SPA session: / -> /shop -> /product (module state kept)', async () => {
    const { products, hero, settings } = await load();
    await Promise.all([settings.getSiteSettings(), hero.fetchHeroBanners(), products.getFilteredProducts({ collectionFilter: 'all' })]);
    const afterLanding = calls.length;
    await products.getCategories();
    await products.getFilteredProducts({ collectionFilter: 'all' });
    const afterShop = calls.length;
    await Promise.all([products.getProductById(UUID), products.getAllProducts()]);
    report.warm_session = {
      landing: afterLanding,
      shop_added: afterShop - afterLanding,
      pdp_added: calls.length - afterShop,
      TOTAL: calls.length,
    };
    if (!IS_BASELINE) expect(report.warm_session.TOTAL).toBeLessThanOrEqual(7);
  });

  it('prints report', () => {
    // eslint-disable-next-line no-console
    console.log('REQUEST_COUNTS ' + JSON.stringify(report));
    expect(Object.keys(report).length).toBeGreaterThan(0);
  });
});
