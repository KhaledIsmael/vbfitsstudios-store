import { useSyncExternalStore } from 'react';
import { getOutageState, subscribeOutage, type OutageState } from '../lib/outage';

/** Subscribes a component to the deduplicated outage / degraded-data state. */
export function useOutageState(): OutageState {
  return useSyncExternalStore(subscribeOutage, getOutageState, getOutageState);
}
