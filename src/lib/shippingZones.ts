/**
 * Shipping Zones — Egyptian governorate lookup.
 *
 * Source of truth: the `shipping_zones` Supabase table, maintained by admin.
 * The static SHIPPING_ZONES array below is both the seed data for the table
 * and the client-side fallback when Supabase is unavailable.
 *
 * Supabase table DDL (run in SQL Editor):
 * ─────────────────────────────────────────────────────────────────────────────
 * CREATE TABLE IF NOT EXISTS shipping_zones (
 *   id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   governorate   TEXT NOT NULL UNIQUE,
 *   governorate_ar TEXT,
 *   min_days      INT  NOT NULL,
 *   max_days      INT  NOT NULL,
 *   cod_available BOOLEAN NOT NULL DEFAULT true,
 *   created_at    TIMESTAMPTZ DEFAULT now()
 * );
 *
 * -- Seed with Egyptian governorates (see SHIPPING_ZONES below)
 * INSERT INTO shipping_zones (governorate, governorate_ar, min_days, max_days, cod_available)
 * VALUES
 *   ('Cairo',        'القاهرة',      2, 4, true),
 *   ('Giza',         'الجيزة',       2, 4, true),
 *   ('Qalyubia',     'القليوبية',    2, 4, true),
 *   ('Alexandria',   'الإسكندرية',   3, 5, true),
 *   ('Sharqia',      'الشرقية',      3, 5, true),
 *   ('Dakahlia',     'الدقهلية',     3, 5, true),
 *   ('Gharbia',      'الغربية',      3, 5, true),
 *   ('Monufia',      'المنوفية',     3, 5, true),
 *   ('Kafr El Sheikh','كفر الشيخ',   4, 6, true),
 *   ('Beheira',      'البحيرة',      4, 6, true),
 *   ('Damietta',     'دمياط',        4, 6, true),
 *   ('Ismailia',     'الإسماعيلية',  3, 5, true),
 *   ('Suez',         'السويس',       3, 5, true),
 *   ('Port Said',    'بورسعيد',      3, 5, true),
 *   ('Faiyum',       'الفيوم',       3, 5, true),
 *   ('Beni Suef',    'بني سويف',     4, 7, true),
 *   ('Minya',        'المنيا',       4, 7, true),
 *   ('Asyut',        'أسيوط',        4, 7, true),
 *   ('Sohag',        'سوهاج',        4, 7, false),
 *   ('Qena',         'قنا',          4, 7, false),
 *   ('Luxor',        'الأقصر',       5, 7, false),
 *   ('Aswan',        'أسوان',        5, 7, false),
 *   ('Red Sea',      'البحر الأحمر', 5, 8, false),
 *   ('Matruh',       'مطروح',        5, 8, false),
 *   ('North Sinai',  'شمال سيناء',   5, 8, false),
 *   ('South Sinai',  'جنوب سيناء',   5, 8, false),
 *   ('New Valley',   'الوادي الجديد',6, 9, false)
 * ON CONFLICT (governorate) DO NOTHING;
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { supabase } from './supabaseClient';

export interface ShippingZone {
  id?: string;
  /** English governorate name — used as the unique key */
  governorate: string;
  /** Arabic governorate name (displayed alongside English in dropdown) */
  governorate_ar?: string;
  /** Minimum delivery days */
  min_days: number;
  /** Maximum delivery days */
  max_days: number;
  /** Whether Cash on Delivery is available for this zone */
  cod_available: boolean;
  /** Custom shipping fee in EGP */
  shipping_rate: number;
  /** Order subtotal in EGP required for free shipping */
  free_shipping_threshold?: number;
}

// ─── Static seed — mirrors the shipping_zones DB table ───────────────────────
// Default rates: Greater Cairo = 60 EGP, Delta/Canal = 65 EGP, Upper Egypt = 80 EGP, Remote = 90 EGP
const DEFAULT_FREE_SHIPPING_THRESHOLD = 1500;

export const SHIPPING_ZONES: ShippingZone[] = [
  // Greater Cairo (fastest)
  { governorate: 'Cairo',         governorate_ar: 'القاهرة',       min_days: 2, max_days: 4, cod_available: true,  shipping_rate: 60, free_shipping_threshold: DEFAULT_FREE_SHIPPING_THRESHOLD },
  { governorate: 'Giza',          governorate_ar: 'الجيزة',        min_days: 2, max_days: 4, cod_available: true,  shipping_rate: 60, free_shipping_threshold: DEFAULT_FREE_SHIPPING_THRESHOLD },
  { governorate: 'Qalyubia',      governorate_ar: 'القليوبية',     min_days: 2, max_days: 4, cod_available: true,  shipping_rate: 60, free_shipping_threshold: DEFAULT_FREE_SHIPPING_THRESHOLD },
  // Delta & Canal — 3–5 days
  { governorate: 'Alexandria',    governorate_ar: 'الإسكندرية',    min_days: 3, max_days: 5, cod_available: true,  shipping_rate: 65, free_shipping_threshold: DEFAULT_FREE_SHIPPING_THRESHOLD },
  { governorate: 'Sharqia',       governorate_ar: 'الشرقية',       min_days: 3, max_days: 5, cod_available: true,  shipping_rate: 65, free_shipping_threshold: DEFAULT_FREE_SHIPPING_THRESHOLD },
  { governorate: 'Dakahlia',      governorate_ar: 'الدقهلية',      min_days: 3, max_days: 5, cod_available: true,  shipping_rate: 65, free_shipping_threshold: DEFAULT_FREE_SHIPPING_THRESHOLD },
  { governorate: 'Gharbia',       governorate_ar: 'الغربية',       min_days: 3, max_days: 5, cod_available: true,  shipping_rate: 65, free_shipping_threshold: DEFAULT_FREE_SHIPPING_THRESHOLD },
  { governorate: 'Monufia',       governorate_ar: 'المنوفية',      min_days: 3, max_days: 5, cod_available: true,  shipping_rate: 65, free_shipping_threshold: DEFAULT_FREE_SHIPPING_THRESHOLD },
  { governorate: 'Ismailia',      governorate_ar: 'الإسماعيلية',   min_days: 3, max_days: 5, cod_available: true,  shipping_rate: 65, free_shipping_threshold: DEFAULT_FREE_SHIPPING_THRESHOLD },
  { governorate: 'Suez',          governorate_ar: 'السويس',        min_days: 3, max_days: 5, cod_available: true,  shipping_rate: 65, free_shipping_threshold: DEFAULT_FREE_SHIPPING_THRESHOLD },
  { governorate: 'Port Said',     governorate_ar: 'بورسعيد',       min_days: 3, max_days: 5, cod_available: true,  shipping_rate: 65, free_shipping_threshold: DEFAULT_FREE_SHIPPING_THRESHOLD },
  { governorate: 'Faiyum',        governorate_ar: 'الفيوم',        min_days: 3, max_days: 5, cod_available: true,  shipping_rate: 65, free_shipping_threshold: DEFAULT_FREE_SHIPPING_THRESHOLD },
  // Northern Delta — 4–6 days
  { governorate: 'Kafr El Sheikh', governorate_ar: 'كفر الشيخ',   min_days: 4, max_days: 6, cod_available: true,  shipping_rate: 65, free_shipping_threshold: DEFAULT_FREE_SHIPPING_THRESHOLD },
  { governorate: 'Beheira',       governorate_ar: 'البحيرة',       min_days: 4, max_days: 6, cod_available: true,  shipping_rate: 65, free_shipping_threshold: DEFAULT_FREE_SHIPPING_THRESHOLD },
  { governorate: 'Damietta',      governorate_ar: 'دمياط',         min_days: 4, max_days: 6, cod_available: true,  shipping_rate: 65, free_shipping_threshold: DEFAULT_FREE_SHIPPING_THRESHOLD },
  // Upper Egypt — 4–7 days
  { governorate: 'Beni Suef',     governorate_ar: 'بني سويف',      min_days: 4, max_days: 7, cod_available: true,  shipping_rate: 75, free_shipping_threshold: DEFAULT_FREE_SHIPPING_THRESHOLD },
  { governorate: 'Minya',         governorate_ar: 'المنيا',        min_days: 4, max_days: 7, cod_available: true,  shipping_rate: 75, free_shipping_threshold: DEFAULT_FREE_SHIPPING_THRESHOLD },
  { governorate: 'Asyut',         governorate_ar: 'أسيوط',         min_days: 4, max_days: 7, cod_available: true,  shipping_rate: 75, free_shipping_threshold: DEFAULT_FREE_SHIPPING_THRESHOLD },
  { governorate: 'Sohag',         governorate_ar: 'سوهاج',         min_days: 4, max_days: 7, cod_available: false, shipping_rate: 80, free_shipping_threshold: DEFAULT_FREE_SHIPPING_THRESHOLD },
  { governorate: 'Qena',          governorate_ar: 'قنا',           min_days: 4, max_days: 7, cod_available: false, shipping_rate: 80, free_shipping_threshold: DEFAULT_FREE_SHIPPING_THRESHOLD },
  // Far Upper Egypt & remote — 5–8 days
  { governorate: 'Luxor',         governorate_ar: 'الأقصر',        min_days: 5, max_days: 7, cod_available: false, shipping_rate: 85, free_shipping_threshold: DEFAULT_FREE_SHIPPING_THRESHOLD },
  { governorate: 'Aswan',         governorate_ar: 'أسوان',         min_days: 5, max_days: 7, cod_available: false, shipping_rate: 85, free_shipping_threshold: DEFAULT_FREE_SHIPPING_THRESHOLD },
  { governorate: 'Red Sea',       governorate_ar: 'البحر الأحمر',  min_days: 5, max_days: 8, cod_available: false, shipping_rate: 85, free_shipping_threshold: DEFAULT_FREE_SHIPPING_THRESHOLD },
  { governorate: 'Matruh',        governorate_ar: 'مطروح',         min_days: 5, max_days: 8, cod_available: false, shipping_rate: 85, free_shipping_threshold: DEFAULT_FREE_SHIPPING_THRESHOLD },
  { governorate: 'North Sinai',   governorate_ar: 'شمال سيناء',    min_days: 5, max_days: 8, cod_available: false, shipping_rate: 90, free_shipping_threshold: DEFAULT_FREE_SHIPPING_THRESHOLD },
  { governorate: 'South Sinai',   governorate_ar: 'جنوب سيناء',    min_days: 5, max_days: 8, cod_available: false, shipping_rate: 90, free_shipping_threshold: DEFAULT_FREE_SHIPPING_THRESHOLD },
  { governorate: 'New Valley',    governorate_ar: 'الوادي الجديد', min_days: 6, max_days: 9, cod_available: false, shipping_rate: 90, free_shipping_threshold: DEFAULT_FREE_SHIPPING_THRESHOLD },
];

// ─── Supabase fetch with static fallback ─────────────────────────────────────

let _cachedZones: ShippingZone[] | null = null;
let _cacheTimestamp: number = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Returns all shipping zones, fetched from Supabase and cached for 5 minutes.
 * Falls back to SHIPPING_ZONES if the DB is unreachable.
 * Also checks store_settings for admin-edited overrides.
 */
export async function getShippingZones(): Promise<ShippingZone[]> {
  const now = Date.now();
  if (_cachedZones && (now - _cacheTimestamp) < CACHE_TTL_MS) return _cachedZones;

  try {
    const { data, error } = await supabase
      .from('shipping_zones')
      .select('*')
      .order('min_days', { ascending: true });

    if (!error && data && data.length > 0) {
      _cachedZones = data.map((z: any) => ({
        id: z.id,
        governorate: z.governorate,
        governorate_ar: z.governorate_ar,
        min_days: Number(z.min_days || 2),
        max_days: Number(z.max_days || 5),
        cod_available: Boolean(z.cod_available),
        shipping_rate: Number(z.shipping_rate ?? z.shipping_fee ?? z.rate ?? 65),
        free_shipping_threshold: z.free_shipping_threshold ? Number(z.free_shipping_threshold) : DEFAULT_FREE_SHIPPING_THRESHOLD
      }));
      _cacheTimestamp = now;
      return _cachedZones;
    }
  } catch {
    // fall through to store_settings check
  }

  // Fallback: check store_settings for admin-saved zone overrides
  try {
    const { data: settingsRow } = await supabase
      .from('store_settings')
      .select('value')
      .eq('key', 'shipping_zones_overrides')
      .maybeSingle();

    if (settingsRow?.value && Array.isArray(settingsRow.value) && settingsRow.value.length > 0) {
      _cachedZones = settingsRow.value as ShippingZone[];
      _cacheTimestamp = now;
      return _cachedZones;
    }
  } catch {
    // ignore
  }

  _cachedZones = SHIPPING_ZONES;
  _cacheTimestamp = now;
  return _cachedZones;
}

/**
 * Looks up a single zone by governorate name (case-insensitive).
 * Also handles common aliases (e.g., Matrouh = Matruh).
 */
export async function getZoneByGovernorate(governorate: string): Promise<ShippingZone | null> {
  const zones = await getShippingZones();
  const clean = governorate.toLowerCase().trim();
  // Normalize common aliases
  const aliasMap: Record<string, string> = {
    'matrouh': 'matruh',
    'el matruh': 'matruh',
    'cairo governorate': 'cairo',
    'greater cairo': 'cairo',
  };
  const normalized = aliasMap[clean] || clean;
  return (
    zones.find(
      (z) =>
        z.governorate.toLowerCase() === normalized ||
        z.governorate.toLowerCase() === clean ||
        (z.governorate_ar && z.governorate_ar.toLowerCase() === clean)
    ) ?? null
  );
}

/**
 * Calculate shipping fee for a given governorate and order subtotal.
 */
export async function calculateShippingFee(
  governorate: string,
  subtotal: number
): Promise<{ fee: number; isFree: boolean; zone: ShippingZone | null; freeThreshold: number }> {
  const zone = await getZoneByGovernorate(governorate);
  const freeThreshold = zone?.free_shipping_threshold ?? DEFAULT_FREE_SHIPPING_THRESHOLD;

  if (subtotal >= freeThreshold) {
    return { fee: 0, isFree: true, zone, freeThreshold };
  }

  const fee = zone ? zone.shipping_rate : getEstimatedShippingFee(governorate, subtotal);
  return { fee, isFree: false, zone, freeThreshold };
}

/**
 * Synchronous fallback estimator when waiting for async load.
 */
export function getEstimatedShippingFee(governorate: string, subtotal: number): number {
  if (subtotal >= DEFAULT_FREE_SHIPPING_THRESHOLD) return 0;
  const clean = (governorate || '').toLowerCase().trim();
  const staticZone = SHIPPING_ZONES.find(
    (z) => z.governorate.toLowerCase() === clean || (z.governorate_ar && z.governorate_ar.toLowerCase() === clean)
  );
  if (staticZone) return staticZone.shipping_rate;
  if (['cairo', 'giza', 'qalyubia', 'القاهرة', 'الجيزة', 'القليوبية'].includes(clean)) return 60;
  if (['alexandria', 'الإسكندرية', 'الاسكندرية'].includes(clean)) return 65;
  return 65;
}

/** Invalidate the in-memory cache (useful after admin updates the table). */
export function invalidateShippingZoneCache(): void {
  _cachedZones = null;
  _cacheTimestamp = 0;
}
