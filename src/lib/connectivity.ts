import { supabase } from './supabaseClient';
import { detectOutage, reportOutage, reportRecovery } from './outage';
import { invalidatePublicReads, resetPublicReadCooldown } from './publicReadCache';

/**
 * Real server probe (never cached, never blocked by any client-side cooldown).
 * Returns true when Supabase answered a trivial public read successfully.
 * On success clears the outage hint and drops cached public reads so the UI reloads fresh data.
 */
export async function probeConnectivity(timeoutMs = 5000): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await supabase
      .from('store_settings')
      .select('key')
      .eq('key', 'catalog_products_override')
      .limit(1)
      .abortSignal(controller.signal);

    if (res.error) {
      const outage = detectOutage({ ...res.error, status: (res as any).status });
      if (outage) {
        reportOutage(outage);
        return false;
      }
      // A non-outage error (e.g. RLS) still proves the server answered → reachable.
    }
    reportRecovery();
    resetPublicReadCooldown();
    invalidatePublicReads();
    return true;
  } catch (err) {
    const aborted = (err as any)?.name === 'AbortError';
    const outage = aborted
      ? detectOutage(Object.assign(new Error('Request timed out'), { name: 'TimeoutError' }))
      : detectOutage(err);
    if (outage) reportOutage(outage);
    return false;
  } finally {
    clearTimeout(timer);
  }
}
