const STORAGE_KEY = 'vbfits_recently_viewed';
const MAX_RECENT_ITEMS = 8;

/**
 * Returns the list of recently viewed product IDs from localStorage,
 * ordered most-recent-first (up to 8 items).
 */
export function getRecentlyViewedIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  } catch (err) {
    console.warn('Failed to parse recently viewed items from localStorage:', err);
    return [];
  }
}

/**
 * Adds a product ID to the recently viewed list.
 * Deduplicates and places the ID at the top of the array, capping the length at 8 items.
 */
export function addRecentlyViewed(productId: string): void {
  if (!productId || typeof productId !== 'string') return;
  const cleanId = productId.trim();
  if (!cleanId) return;

  try {
    const current = getRecentlyViewedIds();
    // Remove if already present (deduplicate)
    const filtered = current.filter((id) => id !== cleanId);
    // Prepend cleanId (most-recent-first) and cap at MAX_RECENT_ITEMS
    const updated = [cleanId, ...filtered].slice(0, MAX_RECENT_ITEMS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('Failed to write recently viewed item to localStorage:', err);
  }
}

/**
 * Clears recently viewed product IDs from localStorage.
 */
export function clearRecentlyViewed(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn('Failed to clear recently viewed items from localStorage:', err);
  }
}
