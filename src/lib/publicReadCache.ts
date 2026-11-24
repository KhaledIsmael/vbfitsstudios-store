/**
 * Bounded, auth-scope-aware cache for PUBLIC, read-only data (catalog, settings, hero banners).
 *
 * Guarantees
 *  - In-flight de-duplication: concurrent callers share one network request.
 *  - Short TTL with explicit invalidation (`invalidatePublicReads`) after admin writes (+ cross-tab).
 *  - Bounded memory: LRU, max PUBLIC_READ_MAX_ENTRIES entries.
 *  - No negative caching of failures; errors are never stored as "fresh" data.
 *  - Entries are partitioned by auth scope ('anon' | 'user:<id>'); switching scope drops other scopes,
 *    so one user's responses can never be served to another user in the same tab.
 *  - Bounded retries (network/timeout/5xx only), per-attempt timeout, caller cancellation (AbortSignal),
 *    and a short global cooldown after a detected outage so non-critical reads do not hammer a failing backend.
 *  - Stale data (<= maxStaleMs) may be returned during an outage, always flagged `stale: true`.
 *
 * NOT for: orders, customers, carts, payments, auth, admin or any personalised response.
 */
import { detectOutage, reportOutage, reportRecovery, type OutageKind } from './outage';

export const PUBLIC_READ_MAX_ENTRIES = 40;
export const DEFAULT_TIMEOUT_MS = 6000;
export const DEFAULT_MAX_STALE_MS = 10 * 60_000;

const COOLDOWN_MS: Record<OutageKind, number> = {
  billing: 30_000,
  rate_limit: 15_000,
  unavailable: 8_000,
  network: 8_000,
  timeout: 8_000,
};

export interface PublicReadOptions {
  /** Freshness window for cache hits. */
  ttlMs: number;
  /** Extra attempts after the first (only for retryable outages). Default 1. */
  retries?: number;
  baseDelayMs?: number;
  /** Per-attempt timeout. Default 6000ms. */
  timeoutMs?: number;
  /** How old a stale entry may be and still be served during an outage. */
  maxStaleMs?: number;
  signal?: AbortSignal;
}

export interface PublicReadResult<T> {
  value: T;
  /** true when served from an expired entry because the backend could not be reached. */
  stale: boolean;
  fromCache: boolean;
}

export class PublicReadUnavailableError extends Error {
  constructor(message = 'Public read temporarily paused after a detected outage.') {
    super(message);
    this.name = 'PublicReadUnavailableError';
  }
}

interface Entry {
  value: unknown;
  storedAt: number;
  expiresAt: number;
}

interface Flight {
  promise: Promise<unknown>;
  controller: AbortController;
  refs: number;
  settled: boolean;
}

let clock: () => number = () => Date.now();
const store = new Map<string, Entry>();
const inflight = new Map<string, Flight>();
let scope = 'anon';
let epoch = 0;
let cooldownUntil = 0;
let networkRequests = 0;

export function __setClockForTests(fn: (() => number) | null): void {
  clock = fn || (() => Date.now());
}

export function getPublicReadStats() {
  return { entries: store.size, inflight: inflight.size, cooldownUntil, networkRequests, scope };
}

export function __resetPublicReadsForTests(): void {
  store.clear();
  inflight.clear();
  scope = 'anon';
  epoch++;
  cooldownUntil = 0;
  networkRequests = 0;
  clock = () => Date.now();
}

function abortError(): Error {
  const e = new Error('The operation was aborted.');
  e.name = 'AbortError';
  return e;
}

function isAbortError(err: unknown): boolean {
  return !!err && typeof err === 'object' && (err as any).name === 'AbortError';
}

function raceAbort<T>(p: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return p;
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(abortError());
    if (signal.aborted) {
      onAbort();
      return;
    }
    signal.addEventListener('abort', onAbort, { once: true });
    p.then(
      (v) => {
        signal.removeEventListener('abort', onAbort);
        resolve(v);
      },
      (e) => {
        signal.removeEventListener('abort', onAbort);
        reject(e);
      }
    );
  });
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(abortError());
      return;
    }
    const t = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(abortError());
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

/** Throws an Error carrying status/code when a Supabase `{ data, error }` response failed. */
export function throwIfError<T extends { error: any; status?: number }>(res: T): T {
  if (res && res.error) {
    const e: any = new Error(res.error.message || 'Supabase request failed');
    e.status = res.status ?? res.error.status;
    e.code = res.error.code;
    e.details = res.error.details;
    throw e;
  }
  return res;
}

function put(key: string, value: unknown, ttlMs: number): void {
  const now = clock();
  store.delete(key);
  store.set(key, { value, storedAt: now, expiresAt: now + ttlMs });
  // purge entries too old to ever be served stale
  for (const [k, e] of store) {
    if (now - e.storedAt > DEFAULT_MAX_STALE_MS) store.delete(k);
  }
  while (store.size > PUBLIC_READ_MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest === undefined) break;
    store.delete(oldest);
  }
}

export function setPublicReadScope(next: string | null): void {
  const nextScope = next ? `user:${next}` : 'anon';
  if (nextScope === scope) return;
  scope = nextScope;
  const prefix = `${scope}|`;
  for (const k of [...store.keys()]) {
    if (!k.startsWith(prefix)) store.delete(k);
  }
  for (const [k, f] of [...inflight]) {
    if (!k.startsWith(prefix)) {
      f.controller.abort();
      inflight.delete(k);
    }
  }
}

let channel: BroadcastChannel | null = null;
function getChannel(): BroadcastChannel | null {
  if (channel) return channel;
  if (typeof BroadcastChannel === 'undefined') return null;
  try {
    channel = new BroadcastChannel('vbfits-public-reads');
    (channel as any).unref?.();
    channel.onmessage = (ev: MessageEvent) => {
      const prefix = ev?.data?.prefix;
      invalidatePublicReads(typeof prefix === 'string' ? prefix : undefined, { broadcast: false });
    };
  } catch {
    channel = null;
  }
  return channel;
}

/**
 * Drops cached entries (all scopes) whose key starts with `prefix` (or everything). Call after any
 * admin mutation of catalog / settings / hero data. Also notifies other tabs of this browser.
 */
export function invalidatePublicReads(prefix?: string, opts: { broadcast?: boolean } = {}): void {
  epoch++;
  const match = (k: string) => !prefix || k.slice(k.indexOf('|') + 1).startsWith(prefix);
  for (const k of [...store.keys()]) if (match(k)) store.delete(k);
  for (const k of [...inflight.keys()]) if (match(k)) inflight.delete(k);
  if (opts.broadcast !== false) {
    try {
      getChannel()?.postMessage({ prefix: prefix ?? null });
    } catch {
      /* ignore */
    }
  }
}

export function resetPublicReadCooldown(): void {
  cooldownUntil = 0;
}

export async function publicRead<T>(
  key: string,
  loader: (signal: AbortSignal) => Promise<T>,
  opts: PublicReadOptions
): Promise<PublicReadResult<T>> {
  const {
    ttlMs,
    retries = 1,
    baseDelayMs = 400,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxStaleMs = DEFAULT_MAX_STALE_MS,
    signal,
  } = opts;

  if (signal?.aborted) throw abortError();
  getChannel();

  const k = `${scope}|${key}`;
  const now = clock();
  const hit = store.get(k);

  if (hit && now < hit.expiresAt) {
    store.delete(k);
    store.set(k, hit); // LRU touch
    return { value: hit.value as T, stale: false, fromCache: true };
  }

  const staleEntry = hit && now - hit.storedAt <= maxStaleMs ? hit : undefined;

  if (now < cooldownUntil) {
    if (staleEntry) return { value: staleEntry.value as T, stale: true, fromCache: true };
    throw new PublicReadUnavailableError();
  }

  let flight = inflight.get(k);
  if (!flight) {
    const controller = new AbortController();
    const startEpoch = epoch;
    const created: Flight = {
      controller,
      refs: 0,
      settled: false,
      promise: Promise.resolve(),
    };

    created.promise = (async () => {
      let attempt = 0;
      for (;;) {
        const attemptController = new AbortController();
        let timedOut = false;
        const onFlightAbort = () => attemptController.abort();
        controller.signal.addEventListener('abort', onFlightAbort, { once: true });
        const timer = setTimeout(() => {
          timedOut = true;
          attemptController.abort();
        }, timeoutMs);
        try {
          networkRequests++;
          const value = await raceAbort(loader(attemptController.signal), attemptController.signal);
          return value;
        } catch (err) {
          if (controller.signal.aborted) throw abortError();
          const effective = timedOut
            ? Object.assign(new Error('Request timed out'), { name: 'TimeoutError' })
            : err;
          const outage = detectOutage(effective);
          if (outage) reportOutage(outage);
          if (!outage || !outage.retryable || attempt >= retries) {
            if (outage) cooldownUntil = clock() + COOLDOWN_MS[outage.kind];
            throw effective;
          }
          attempt++;
          const delay = baseDelayMs * 2 ** (attempt - 1) * (0.75 + Math.random() * 0.5);
          await sleep(delay, controller.signal);
        } finally {
          clearTimeout(timer);
          controller.signal.removeEventListener('abort', onFlightAbort);
        }
      }
    })().then(
      (value) => {
        created.settled = true;
        if (startEpoch === epoch) put(k, value, ttlMs);
        cooldownUntil = 0;
        reportRecovery();
        if (inflight.get(k) === created) inflight.delete(k);
        return value;
      },
      (err) => {
        created.settled = true;
        if (inflight.get(k) === created) inflight.delete(k);
        throw err;
      }
    );
    created.promise.catch(() => {}); // avoid unhandled rejection when every waiter has aborted
    inflight.set(k, created);
    flight = created;
  }

  const active = flight;
  active.refs++;
  try {
    const value = (await raceAbort(active.promise as Promise<T>, signal)) as T;
    return { value, stale: false, fromCache: false };
  } catch (err) {
    if (isAbortError(err)) throw err;
    if (staleEntry && detectOutage(err)) {
      return { value: staleEntry.value as T, stale: true, fromCache: true };
    }
    throw err;
  } finally {
    active.refs--;
    if (active.refs === 0 && !active.settled) {
      active.controller.abort();
      if (inflight.get(k) === active) inflight.delete(k);
    }
  }
}
