/**
 * API resilience tests: outage detection, public read cache, backoff polling,
 * admin-edit visibility, cross-user isolation and "orders are never cached".
 * All Supabase traffic is mocked; no network, no real data.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Counting Supabase mock (generic proxy chain) ─────────────────────────────
const UUID = '22222222-2222-4222-8222-222222222222';
const db = { price: 100 };
const fromCalls: string[] = [];

function row() {
  return {
    id: UUID,
    slug: 'black-ls',
    name: 'Black Long Sleeve',
    price: db.price,
    currency: 'EGP',
    featured: true,
    is_new_arrival: false,
    is_published: true,
    category: { id: 'c1', name: 'Long Sleeve', slug: 'long-sleeve' },
    variants: [{ id: 'v1', size: 'M', color: 'Black', stock: 5, sku: 'S1' }],
    images: [{ id: 'i1', url: '/assets/products/black-shirt.webp', display_order: 0, is_primary: true }],
  };
}

function terminal(table: string, single: boolean) {
  fromCalls.push(table);
  const ok = (data: any) => ({ data, error: null, status: 200 });
  if (table === 'products') return ok(single ? row() : [row()]);
  if (table === 'orders') return ok([]);
  return ok(null);
}

function makeProxy(table: string): any {
  const proxy: any = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === 'then') {
          return (res: any, rej: any) => Promise.resolve(terminal(table, false)).then(res, rej);
        }
        if (prop === 'maybeSingle' || prop === 'single') {
          return () => Promise.resolve(terminal(table, true));
        }
        return () => proxy;
      },
    }
  );
  return proxy;
}

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from: (t: string) => makeProxy(t),
    rpc: async () => ({ data: { linked_count: 0, error: null }, error: null }),
    auth: { getSession: async () => ({ data: { session: null } }) },
  },
  adminSupabase: { from: (t: string) => makeProxy(t) },
}));

vi.mock('../lib/telegramNotifier', () => ({ sendTelegramOrderAlert: vi.fn() }));

vi.mock('../lib/publicReadCache', async (importOriginal) => {
  const actual: any = await importOriginal();
  return { ...actual, invalidatePublicReads: vi.fn(actual.invalidatePublicReads) };
});

import {
  detectOutage,
  reportOutage,
  reportRecovery,
  reportDegraded,
  getOutageState,
  subscribeOutage,
  __resetOutageForTests,
} from '../lib/outage';
import {
  publicRead,
  invalidatePublicReads,
  setPublicReadScope,
  getPublicReadStats,
  PUBLIC_READ_MAX_ENTRIES,
  PublicReadUnavailableError,
  __resetPublicReadsForTests,
  __setClockForTests,
} from '../lib/publicReadCache';
import { pollWithBackoff, computeBackoffDelays } from '../lib/pollWithBackoff';
import { getAllProducts } from '../lib/products';
import { archiveAdminProduct } from '../lib/adminProducts';
import { getUserOrders } from '../lib/orders';

beforeEach(() => {
  __resetOutageForTests();
  __resetPublicReadsForTests();
  fromCalls.length = 0;
  db.price = 100;
  (invalidatePublicReads as any).mockClear?.();
});

afterEach(() => {
  vi.restoreAllMocks();
});

const tick = () => new Promise((r) => setTimeout(r, 0));

// ─────────────────────────────────────────────────────────────────────────────
describe('detectOutage', () => {
  it.each([
    [{ status: 402, message: 'x' }, 'billing', false],
    [{ message: '402 Payment Required from https://x.supabase.co' }, 'billing', false],
    [{ status: 429, message: 'x' }, 'rate_limit', false],
    [{ message: 'Too many requests' }, 'rate_limit', false],
    [{ status: 503, message: 'x' }, 'unavailable', true],
    [{ message: '503 Service Unavailable' }, 'unavailable', true],
    [{ status: 504 }, 'unavailable', true],
    [new TypeError('Failed to fetch'), 'network', true],
    [{ message: 'NetworkError when attempting to fetch resource.' }, 'network', true],
    [{ name: 'TimeoutError', message: 'Request timed out' }, 'timeout', true],
    [{ message: 'timeout of 5000ms exceeded' }, 'timeout', true],
  ])('classifies %j as %s (retryable=%s)', (input, kind, retryable) => {
    const o = detectOutage(input);
    expect(o?.kind).toBe(kind);
    expect(o?.retryable).toBe(retryable);
  });

  it.each([
    [{ message: 'new row violates row-level security policy', code: '42501' }],
    [{ status: 403, message: 'permission denied for table orders' }],
    [{ status: 404, message: 'not found' }],
    [{ name: 'AbortError', message: 'The operation was aborted.' }],
    [{ message: 'Order 4029 items validated' }],
    [null],
    [undefined],
  ])('does NOT treat %j as an outage', (input) => {
    expect(detectOutage(input as any)).toBeNull();
  });
});

describe('outage store (deduplicated notification)', () => {
  it('notifies once per distinct state change, not once per failed request', () => {
    const listener = vi.fn();
    const off = subscribeOutage(listener);
    const info = detectOutage({ status: 402 })!;

    reportOutage(info);
    reportOutage(info);
    reportOutage(info);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(getOutageState().active).toBe(true);

    reportOutage(detectOutage({ status: 503 })!);
    expect(listener).toHaveBeenCalledTimes(2);

    reportRecovery();
    expect(listener).toHaveBeenCalledTimes(3);
    expect(getOutageState().active).toBe(false);

    reportDegraded('catalog', 'fallback');
    reportDegraded('catalog', 'fallback');
    expect(listener).toHaveBeenCalledTimes(4);
    expect(getOutageState().visible).toBe(true);
    off();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('publicRead cache', () => {
  it('de-duplicates concurrent in-flight calls into ONE request', async () => {
    const loader = vi.fn(async () => {
      await tick();
      return 42;
    });
    const results = await Promise.all(
      Array.from({ length: 10 }, () => publicRead('k', loader, { ttlMs: 1000 }))
    );
    expect(loader).toHaveBeenCalledTimes(1);
    expect(results.every((r) => r.value === 42)).toBe(true);
  });

  it('serves from cache within TTL and reloads after expiry', async () => {
    let t = 0;
    __setClockForTests(() => t);
    const loader = vi.fn(async () => 'v');
    await publicRead('ttl', loader, { ttlMs: 1000 });
    t = 500;
    const hit = await publicRead('ttl', loader, { ttlMs: 1000 });
    expect(hit.fromCache).toBe(true);
    expect(loader).toHaveBeenCalledTimes(1);
    t = 1500;
    await publicRead('ttl', loader, { ttlMs: 1000 });
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('explicit invalidation (by prefix) forces a reload; other prefixes survive', async () => {
    const a = vi.fn(async () => 'a');
    const b = vi.fn(async () => 'b');
    await publicRead('catalog:x', a, { ttlMs: 60_000 });
    await publicRead('settings:y', b, { ttlMs: 60_000 });
    invalidatePublicReads('catalog:', { broadcast: false });
    await publicRead('catalog:x', a, { ttlMs: 60_000 });
    await publicRead('settings:y', b, { ttlMs: 60_000 });
    expect(a).toHaveBeenCalledTimes(2);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('keeps memory bounded (LRU cap)', async () => {
    for (let i = 0; i < PUBLIC_READ_MAX_ENTRIES * 3; i++) {
      await publicRead(`key-${i}`, async () => i, { ttlMs: 60_000 });
    }
    expect(getPublicReadStats().entries).toBeLessThanOrEqual(PUBLIC_READ_MAX_ENTRIES);
  });

  it('never caches a failure as fresh data (no negative caching)', async () => {
    const loader = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('relation does not exist'))
      .mockResolvedValueOnce('ok');
    await expect(publicRead('neg', loader, { ttlMs: 60_000 })).rejects.toThrow();
    const second = await publicRead('neg', loader, { ttlMs: 60_000 });
    expect(second.value).toBe('ok');
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('bounds retries (1 retry) and then pauses non-critical reads (cooldown)', async () => {
    const loader = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    await expect(
      publicRead('r', loader, { ttlMs: 1000, retries: 1, baseDelayMs: 1, timeoutMs: 500 })
    ).rejects.toThrow('Failed to fetch');
    expect(loader).toHaveBeenCalledTimes(2); // initial + exactly one retry

    const other = vi.fn(async () => 'x');
    await expect(publicRead('another-key', other, { ttlMs: 1000 })).rejects.toBeInstanceOf(
      PublicReadUnavailableError
    );
    expect(other).not.toHaveBeenCalled(); // cooldown: backend not hammered
    expect(getOutageState().active).toBe(true);
  });

  it('does not retry billing (402) and reports it once', async () => {
    const loader = vi.fn(async () => {
      throw Object.assign(new Error('Payment Required'), { status: 402 });
    });
    await expect(publicRead('b', loader, { ttlMs: 1000, retries: 3, baseDelayMs: 1 })).rejects.toThrow();
    expect(loader).toHaveBeenCalledTimes(1);
    expect(getOutageState().kind).toBe('billing');
  });

  it('serves STALE data during an outage and flags it', async () => {
    let t = 0;
    __setClockForTests(() => t);
    await publicRead('s', async () => 'old', { ttlMs: 1000 });
    t = 5000; // expired but within maxStale
    const r = await publicRead(
      's',
      async () => {
        throw new TypeError('Failed to fetch');
      },
      { ttlMs: 1000, retries: 0 }
    );
    expect(r).toMatchObject({ value: 'old', stale: true });
    expect(getOutageState().active).toBe(true);
  });

  it('supports request cancellation (AbortSignal reaches the loader)', async () => {
    let loaderSignal: AbortSignal | undefined;
    const loader = (signal: AbortSignal) =>
      new Promise<string>((_res, rej) => {
        loaderSignal = signal;
        signal.addEventListener('abort', () =>
          rej(Object.assign(new Error('aborted'), { name: 'AbortError' }))
        );
      });
    const ac = new AbortController();
    const p = publicRead('c', loader, { ttlMs: 1000, signal: ac.signal });
    await tick();
    ac.abort();
    await expect(p).rejects.toMatchObject({ name: 'AbortError' });
    await tick();
    expect(loaderSignal?.aborted).toBe(true);
    expect(getOutageState().active).toBe(false); // user cancel is not an outage
  });

  it('times out slow loaders (TimeoutError → timeout outage)', async () => {
    const loader = (signal: AbortSignal) =>
      new Promise<string>((_res, rej) =>
        signal.addEventListener('abort', () =>
          rej(Object.assign(new Error('aborted'), { name: 'AbortError' }))
        )
      );
    await expect(
      publicRead('slow', loader, { ttlMs: 1000, retries: 0, timeoutMs: 15 })
    ).rejects.toMatchObject({ name: 'TimeoutError' });
    expect(getOutageState().kind).toBe('timeout');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('cross-user isolation & uncached orders', () => {
  it('never serves one user’s cached response to another identity', async () => {
    const loader = vi.fn(async () => (getPublicReadStats().scope === 'user:A' ? 'A-data' : 'other-data'));
    setPublicReadScope('A');
    const a = await publicRead('profile-ish', loader, { ttlMs: 60_000 });
    setPublicReadScope('B');
    const b = await publicRead('profile-ish', loader, { ttlMs: 60_000 });
    setPublicReadScope(null);
    const anon = await publicRead('profile-ish', loader, { ttlMs: 60_000 });
    expect(a.value).toBe('A-data');
    expect(b.value).toBe('other-data');
    expect(anon.value).toBe('other-data');
    expect(loader).toHaveBeenCalledTimes(3); // every identity change is a miss
    setPublicReadScope('A');
    const again = await publicRead('profile-ish', loader, { ttlMs: 60_000 });
    expect(again.fromCache).toBe(false); // A's old entry was purged when scope changed
  });

  it('getUserOrders is never cached (hits the orders table on every call)', async () => {
    await getUserOrders('cust-1');
    await getUserOrders('cust-1');
    expect(fromCalls.filter((t) => t === 'orders')).toHaveLength(2);
    expect(getPublicReadStats().entries).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('admin edits become visible promptly', () => {
  it('serves cached catalogue within TTL, but an admin write invalidates immediately', async () => {
    const first = await getAllProducts();
    expect(first.find((p) => p.id === UUID)?.price).toBe(100);

    db.price = 150; // admin changes the price in the database
    const cached = await getAllProducts();
    expect(cached.find((p) => p.id === UUID)?.price).toBe(100); // still within the 30s TTL window

    await archiveAdminProduct(UUID, false); // any admin product write
    expect(invalidatePublicReads).toHaveBeenCalled();

    const fresh = await getAllProducts();
    expect(fresh.find((p) => p.id === UUID)?.price).toBe(150);
  });

  it('TTL bounds staleness for other visitors even without an invalidation signal', async () => {
    let t = 0;
    __setClockForTests(() => t);
    await getAllProducts();
    db.price = 175;
    t = 31_000; // > CATALOG_TTL_MS (30s)
    const after = await getAllProducts();
    expect(after.find((p) => p.id === UUID)?.price).toBe(175);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('pollWithBackoff (payment verification)', () => {
  const harness = () => {
    let t = 0;
    const sleeps: number[] = [];
    return {
      sleeps,
      sleep: async (ms: number) => {
        sleeps.push(ms);
        t += ms;
      },
      now: () => t,
      random: () => 0.5, // zero jitter
    };
  };
  const pending = { paymentStatus: 'pending', orderId: null as string | null, error: null as string | null };

  it('computes bounded exponential delays', () => {
    expect(computeBackoffDelays(7)).toEqual([1000, 1700, 2890, 4913, 8000, 8000, 8000]);
  });

  it('backs off exponentially, caps the delay and stops at the total timeout', async () => {
    const h = harness();
    const fn = vi.fn(async () => pending);
    const r = await pollWithBackoff({
      fn,
      isDone: (v) => v.paymentStatus === 'paid',
      totalTimeoutMs: 45_000,
      ...h,
    });
    expect(r.status).toBe('timeout');
    expect(h.sleeps[0]).toBe(1000);
    expect(h.sleeps[1]).toBe(1700);
    expect(Math.max(...h.sleeps)).toBeLessThanOrEqual(8000);
    expect(h.sleeps.reduce((a, b) => a + b, 0)).toBeLessThan(45_000);
    expect(fn.mock.calls.length).toBeLessThanOrEqual(12); // fixed 2s polling used 15
  });

  it('confirms ONLY on a server-confirmed paid status', async () => {
    const h = harness();
    const seq = [pending, pending, { ...pending, paymentStatus: 'paid', orderId: 'o1' }];
    const fn = vi.fn(async () => seq.shift()!);
    const r = await pollWithBackoff({ fn, isDone: (v) => v.paymentStatus === 'paid', ...h });
    expect(r).toMatchObject({ status: 'done', attempts: 3 });
  });

  it('never reports success on null status or errors; ends in timeout instead', async () => {
    const h = harness();
    const fn = vi.fn(async () => ({ paymentStatus: null, orderId: null, error: '503 Service Unavailable' }));
    const r = await pollWithBackoff({
      fn,
      isDone: (v) => !v.error && v.paymentStatus === 'paid',
      totalTimeoutMs: 20_000,
      ...h,
    });
    expect(r.status).toBe('timeout');
  });

  it('tolerates thrown errors and still confirms a later paid result', async () => {
    const h = harness();
    const fn = vi
      .fn<() => Promise<typeof pending>>()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({ ...pending, paymentStatus: 'paid' });
    const r = await pollWithBackoff({ fn, isDone: (v) => v.paymentStatus === 'paid', ...h });
    expect(r.status).toBe('done');
  });

  it('can be cancelled', async () => {
    const ac = new AbortController();
    const fn = vi.fn(async () => pending);
    const p = pollWithBackoff({
      fn,
      isDone: () => false,
      initialDelayMs: 200,
      signal: ac.signal,
    });
    await new Promise((r) => setTimeout(r, 20));
    ac.abort();
    expect((await p).status).toBe('aborted');
  });
});
