/**
 * Classify a raw order submission error string/status into a user-safe message
 * and whether the outcome is ambiguous (network/timeout where the server may
 * have persisted the order).
 */
export function classifyOrderError(errorMsg: string): {
  userMessage: string;
  isAmbiguous: boolean;
} {
  const msg = errorMsg.toLowerCase();

  // Supabase 402 — billing / plan limit
  if (msg.includes('402') || msg.includes('payment required') || msg.includes('billing')) {
    return {
      userMessage:
        'The store is temporarily unavailable due to a service limit. Your bag is preserved — please try again in a few minutes or contact us.',
      isAmbiguous: false,
    };
  }

  // 429 — rate limited
  if (msg.includes('429') || msg.includes('too many requests') || msg.includes('rate limit')) {
    return {
      userMessage:
        'Too many requests. Please wait a moment, then tap "Confirm order" again. Your bag is preserved.',
      isAmbiguous: false,
    };
  }

  // RLS / permission
  if (
    msg.includes('row-level security') ||
    msg.includes('violates') ||
    msg.includes('permission denied') ||
    msg.includes('403')
  ) {
    return {
      userMessage:
        'Guest orders are completing setup. Please sign in or try again shortly. Your bag is preserved.',
      isAmbiguous: false,
    };
  }

  // Server 5xx
  if (
    msg.includes('500') ||
    msg.includes('502') ||
    msg.includes('503') ||
    msg.includes('504') ||
    msg.includes('server error') ||
    msg.includes('internal')
  ) {
    return {
      userMessage:
        'A server error occurred. Your order was not placed and your bag is preserved. Please try again.',
      isAmbiguous: false,
    };
  }

  // Network / timeout — ambiguous: request may have reached the server
  if (
    msg.includes('network') ||
    msg.includes('fetch') ||
    msg.includes('timeout') ||
    msg.includes('failed to fetch') ||
    msg.includes('aborted') ||
    msg.includes('econnreset')
  ) {
    return {
      userMessage:
        'Your connection dropped before we could confirm your order. ' +
        'Check your Order History or contact us before retrying — a duplicate order may have been registered.',
      isAmbiguous: true,
    };
  }

  // Default — treat as confirmed failure (server returned a known error body)
  return {
    userMessage: `Order was not placed: ${errorMsg}. Your bag is preserved.`,
    isAmbiguous: false,
  };
}
