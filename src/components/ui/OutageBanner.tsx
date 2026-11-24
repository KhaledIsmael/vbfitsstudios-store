import React, { useState } from 'react';
import { useOutageState } from '../../hooks/useOutageState';
import { probeConnectivity } from '../../lib/connectivity';

/**
 * Transparent maintenance / degraded-data notice. Shown only when a real outage was detected
 * or when part of the page is rendered from stale cache / static fallback. Never blocks navigation.
 */
export const OutageBanner: React.FC = () => {
  const outage = useOutageState();
  const [checking, setChecking] = useState(false);

  if (!outage.visible) return null;

  const degradedSources = Object.keys(outage.degraded);
  const usingFallback = degradedSources.some((s) => outage.degraded[s] === 'fallback');
  const usingStale = degradedSources.some((s) => outage.degraded[s] === 'stale');

  const headline = outage.active
    ? outage.message
    : 'We could not refresh some store information.';
  const detail = usingFallback
    ? 'Showing a limited offline catalogue. Prices and availability are confirmed again at checkout.'
    : usingStale
    ? 'Some information may be slightly out of date. Prices and availability are confirmed again at checkout.'
    : 'Prices and availability are confirmed again at checkout.';

  const handleRetry = async () => {
    setChecking(true);
    try {
      await probeConnectivity();
    } finally {
      setChecking(false);
    }
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-0 inset-x-0 z-[70] bg-[#FFF8E6] border-t border-[#F0D9A0] text-[#6B5200] text-[12px] px-4 py-2.5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center"
    >
      <span>
        <strong className="font-semibold">{headline}</strong> {detail}
      </span>
      <button
        type="button"
        onClick={handleRetry}
        disabled={checking}
        className="underline underline-offset-2 font-semibold disabled:opacity-60"
      >
        {checking ? 'Checking…' : 'Retry'}
      </button>
    </div>
  );
};
