/**
 * Bounded exponential-backoff poller with a hard total timeout and cancellation.
 *
 * Used for payment verification. `isDone` must only return true for a SERVER-CONFIRMED terminal
 * state; transient errors (outages, null results) never count as success and simply keep polling
 * until the total timeout is reached.
 */

export interface BackoffOptions<T> {
  fn: (attempt: number, signal: AbortSignal) => Promise<T>;
  /** Return true only for a confirmed terminal result. */
  isDone: (value: T) => boolean;
  initialDelayMs?: number; // default 1000
  factor?: number; // default 1.7
  maxDelayMs?: number; // default 8000
  totalTimeoutMs?: number; // default 45000
  /** Random +/- ratio applied to each delay (default 0.15). */
  jitter?: number;
  signal?: AbortSignal;
  onAttempt?: (attempt: number) => void;
  /** Test seams */
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
  now?: () => number;
  random?: () => number;
}

export type BackoffResult<T> =
  | { status: 'done'; value: T; attempts: number }
  | { status: 'timeout'; attempts: number; lastValue?: T; lastError?: unknown }
  | { status: 'aborted'; attempts: number };

function defaultSleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise<void>((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const t = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      resolve();
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

export function computeBackoffDelays(
  count: number,
  initialDelayMs = 1000,
  factor = 1.7,
  maxDelayMs = 8000
): number[] {
  const out: number[] = [];
  let d = initialDelayMs;
  for (let i = 0; i < count; i++) {
    out.push(Math.min(Math.round(d), maxDelayMs));
    d *= factor;
  }
  return out;
}

export async function pollWithBackoff<T>(opts: BackoffOptions<T>): Promise<BackoffResult<T>> {
  const {
    fn,
    isDone,
    initialDelayMs = 1000,
    factor = 1.7,
    maxDelayMs = 8000,
    totalTimeoutMs = 45_000,
    jitter = 0.15,
    signal,
    onAttempt,
    sleep = defaultSleep,
    now = () => Date.now(),
    random = Math.random,
  } = opts;

  const controller = new AbortController();
  const onOuterAbort = () => controller.abort();
  signal?.addEventListener('abort', onOuterAbort, { once: true });
  if (signal?.aborted) controller.abort();

  const startedAt = now();
  let attempts = 0;
  let delay = initialDelayMs;
  let lastValue: T | undefined;
  let lastError: unknown;

  try {
    for (;;) {
      if (controller.signal.aborted) return { status: 'aborted', attempts };
      attempts++;
      onAttempt?.(attempts);
      try {
        const value = await fn(attempts, controller.signal);
        if (controller.signal.aborted) return { status: 'aborted', attempts };
        lastValue = value;
        if (isDone(value)) return { status: 'done', value, attempts };
      } catch (err) {
        if (controller.signal.aborted) return { status: 'aborted', attempts };
        lastError = err; // transient: keep polling until the deadline
      }

      const elapsed = now() - startedAt;
      const jittered = Math.min(delay, maxDelayMs) * (1 + (random() * 2 - 1) * jitter);
      const wait = Math.max(0, Math.round(jittered));
      if (elapsed + wait >= totalTimeoutMs) {
        return { status: 'timeout', attempts, lastValue, lastError };
      }
      await sleep(wait, controller.signal);
      delay = Math.min(delay * factor, maxDelayMs);
    }
  } finally {
    signal?.removeEventListener('abort', onOuterAbort);
  }
}
