/**
 * Central outage detector + deduplicated outage/degraded-data notifier.
 *
 * IMPORTANT DESIGN LIMITS
 *  - This is a *client-side hint*, not an authority. It is never used to block order-status
 *    validation, auth recovery, payment verification or admin/privileged flows.
 *  - It cannot intercept every Supabase SDK call; callers must opt in via `detectOutage()`.
 *  - RLS/permission errors (42501, "row-level security", 403) are NOT outages and return null.
 */

export type OutageKind = 'billing' | 'rate_limit' | 'unavailable' | 'network' | 'timeout';

export interface OutageInfo {
  kind: OutageKind;
  /** Whether an immediate bounded retry is reasonable (never true for 402/429). */
  retryable: boolean;
  status?: number;
  message: string;
}

const SERVER_STATUSES = new Set([500, 502, 503, 504]);

function extractStatus(err: unknown): number | undefined {
  if (typeof err === 'number') return err;
  if (!err || typeof err !== 'object') return undefined;
  const e = err as any;
  const candidates = [e.status, e.statusCode, e.context?.status, e.response?.status];
  for (const c of candidates) {
    const n = Number(c);
    if (Number.isFinite(n) && n >= 100 && n < 600) return n;
  }
  return undefined;
}

function extractMessage(err: unknown): string {
  if (typeof err === 'string') return err;
  if (!err || typeof err !== 'object') return '';
  const e = err as any;
  return String(e.message || e.error_description || e.error || e.details || '');
}

function fromStatus(status: number): OutageInfo | null {
  if (status === 402) return { kind: 'billing', retryable: false, status, message: userMessageFor('billing') };
  if (status === 429) return { kind: 'rate_limit', retryable: false, status, message: userMessageFor('rate_limit') };
  if (SERVER_STATUSES.has(status)) {
    return { kind: 'unavailable', retryable: true, status, message: userMessageFor('unavailable') };
  }
  return null;
}

/**
 * Classifies an error / HTTP status / response-like object as a platform outage.
 * Returns null for anything that is not clearly an outage (RLS, validation, 404, user abort...).
 */
export function detectOutage(err: unknown): OutageInfo | null {
  if (err === null || err === undefined) return null;

  const name = typeof err === 'object' ? String((err as any).name || '') : '';
  if (name === 'AbortError') return null; // caller-initiated cancel
  if (name === 'TimeoutError') {
    return { kind: 'timeout', retryable: true, message: userMessageFor('timeout') };
  }

  const status = extractStatus(err);
  if (status !== undefined) {
    const byStatus = fromStatus(status);
    if (byStatus) return byStatus;
    if (status === 403 || status === 401) return null;
  }

  const msg = extractMessage(err).toLowerCase();
  if (!msg) return null;

  // Permission problems are never outages
  if (
    msg.includes('row-level security') ||
    msg.includes('permission denied') ||
    msg.includes('violates')
  ) {
    return null;
  }

  if (msg.includes('payment required') || /(?:^|\b(?:status|http|code|error)\b\D{0,15})402\b/.test(msg) || /^402\b/.test(msg)) {
    return { kind: 'billing', retryable: false, status: 402, message: userMessageFor('billing') };
  }
  if (
    msg.includes('too many requests') ||
    msg.includes('rate limit') ||
    /(?:^|\b(?:status|http|code|error)\b\D{0,15})429\b/.test(msg) ||
    /^429\b/.test(msg)
  ) {
    return { kind: 'rate_limit', retryable: false, status: 429, message: userMessageFor('rate_limit') };
  }
  if (
    msg.includes('service unavailable') ||
    msg.includes('bad gateway') ||
    msg.includes('gateway timeout') ||
    /(?:^|\b(?:status|http|code|error)\b\D{0,15})(500|502|503|504)\b/.test(msg) ||
    /^(500|502|503|504)\b/.test(msg)
  ) {
    return { kind: 'unavailable', retryable: true, message: userMessageFor('unavailable') };
  }
  if (msg.includes('timed out') || msg.includes('timeout')) {
    return { kind: 'timeout', retryable: true, message: userMessageFor('timeout') };
  }
  if (
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network request failed') ||
    msg.includes('load failed') ||
    msg.includes('network error') ||
    msg.includes('econnreset') ||
    msg.includes('enotfound')
  ) {
    return { kind: 'network', retryable: true, message: userMessageFor('network') };
  }
  return null;
}

export function userMessageFor(kind: OutageKind): string {
  switch (kind) {
    case 'billing':
      return 'The store is temporarily unavailable due to a service limit. Your bag is saved — please try again shortly.';
    case 'rate_limit':
      return 'The store is very busy right now. Your bag is saved — please wait a moment and try again.';
    case 'unavailable':
      return 'Our servers are temporarily unavailable. Your bag is saved — please try again shortly.';
    case 'timeout':
      return 'Our servers are responding slowly. Your bag is saved — please try again shortly.';
    default:
      return 'We cannot reach our servers. Check your connection — your bag is saved.';
  }
}

// ─── Deduplicated outage / degraded-data store ────────────────────────────────

export type DegradedMode = 'stale' | 'fallback';

export interface OutageState {
  /** A recent outage was detected (auto-expires, see OUTAGE_STATE_TTL_MS). */
  active: boolean;
  kind: OutageKind | null;
  message: string;
  since: number | null;
  /** Data sources currently shown from stale cache or static fallback (never silently). */
  degraded: Record<string, DegradedMode>;
  /** Convenience: banner should be visible. */
  visible: boolean;
}

export const OUTAGE_STATE_TTL_MS = 60_000;

function buildState(partial: Partial<OutageState>, prev: OutageState): OutageState {
  const next = { ...prev, ...partial };
  next.visible = next.active || Object.keys(next.degraded).length > 0;
  return next;
}

const EMPTY: OutageState = {
  active: false,
  kind: null,
  message: '',
  since: null,
  degraded: {},
  visible: false,
};

let state: OutageState = EMPTY;
let expiresAt = 0;
let expiryTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => {
    try {
      l();
    } catch {
      /* listener errors must never break reads */
    }
  });
}

function armExpiry() {
  if (expiryTimer) clearTimeout(expiryTimer);
  expiryTimer = setTimeout(() => {
    expiryTimer = null;
    if (state.active && Date.now() >= expiresAt) {
      state = buildState({ active: false, kind: null, message: '', since: null }, state);
      emit();
    }
  }, OUTAGE_STATE_TTL_MS + 25);
  (expiryTimer as any)?.unref?.();
}

export function getOutageState(): OutageState {
  return state;
}

export function subscribeOutage(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Records an outage. Repeated reports of the same kind only extend the expiry window and do NOT
 * re-notify subscribers (deduplicated notification).
 */
export function reportOutage(info: OutageInfo): void {
  expiresAt = Date.now() + OUTAGE_STATE_TTL_MS;
  armExpiry();
  if (state.active && state.kind === info.kind) return;
  state = buildState(
    { active: true, kind: info.kind, message: info.message, since: Date.now() },
    state
  );
  emit();
}

/** A real, successful server response was received. */
export function reportRecovery(): void {
  if (!state.active) return;
  if (expiryTimer) {
    clearTimeout(expiryTimer);
    expiryTimer = null;
  }
  state = buildState({ active: false, kind: null, message: '', since: null }, state);
  emit();
}

export function reportDegraded(source: string, mode: DegradedMode): void {
  if (state.degraded[source] === mode) return;
  state = buildState({ degraded: { ...state.degraded, [source]: mode } }, state);
  emit();
}

export function clearDegraded(source: string): void {
  if (!(source in state.degraded)) return;
  const rest = { ...state.degraded };
  delete rest[source];
  state = buildState({ degraded: rest }, state);
  emit();
}

export function __resetOutageForTests(): void {
  if (expiryTimer) clearTimeout(expiryTimer);
  expiryTimer = null;
  expiresAt = 0;
  state = EMPTY;
  listeners.clear();
}
