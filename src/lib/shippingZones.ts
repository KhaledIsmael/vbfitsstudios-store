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
}

// ─── Static seed — mirrors the shipping_zones DB table ───────────────────────
// Sorted: Greater Cairo first, then by delivery speed ascending.
export const SHIPPING_ZONES: ShippingZone[] = [
  // Greater Cairo (fastest)
  { governorate: 'Cairo',         governorate_ar: 'القاهرة',       min_days: 2, max_days: 4, cod_available: true  },
  { governorate: 'Giza',          governorate_ar: 'الجيزة',        min_days: 2, max_days: 4, cod_available: true  },
  { governorate: 'Qalyubia',      governorate_ar: 'القليوبية',     min_days: 2, max_days: 4, cod_available: true  },
  // Delta & Canal — 3–5 days
  { governorate: 'Alexandria',    governorate_ar: 'الإسكندرية',    min_days: 3, max_days: 5, cod_available: true  },
  { governorate: 'Sharqia',       governorate_ar: 'الشرقية',       min_days: 3, max_days: 5, cod_available: true  },
  { governorate: 'Dakahlia',      governorate_ar: 'الدقهلية',      min_days: 3, max_days: 5, cod_available: true  },
  { governorate: 'Gharbia',       governorate_ar: 'الغربية',       min_days: 3, max_days: 5, cod_available: true  },
  { governorate: 'Monufia',       governorate_ar: 'المنوفية',      min_days: 3, max_days: 5, cod_available: true  },
  { governorate: 'Ismailia',      governorate_ar: 'الإسماعيلية',   min_days: 3, max_days: 5, cod_available: true  },
  { governorate: 'Suez',          governorate_ar: 'السويس',        min_days: 3, max_days: 5, cod_available: true  },
  { governorate: 'Port Said',     governorate_ar: 'بورسعيد',       min_days: 3, max_days: 5, cod_available: true  },
  { governorate: 'Faiyum',        governorate_ar: 'الفيوم',        min_days: 3, max_days: 5, cod_available: true  },
  // Northern Delta — 4–6 days
  { governorate: 'Kafr El Sheikh', governorate_ar: 'كفر الشيخ',   min_days: 4, max_days: 6, cod_available: true  },
  { governorate: 'Beheira',       governorate_ar: 'البحيرة',       min_days: 4, max_days: 6, cod_available: true  },
  { governorate: 'Damietta',      governorate_ar: 'دمياط',         min_days: 4, max_days: 6, cod_available: true  },
  // Upper Egypt — 4–7 days
  { governorate: 'Beni Suef',     governorate_ar: 'بني سويف',      min_days: 4, max_days: 7, cod_available: true  },
  { governorate: 'Minya',         governorate_ar: 'المنيا',        min_days: 4, max_days: 7, cod_available: true  },
  { governorate: 'Asyut',         governorate_ar: 'أسيوط',         min_days: 4, max_days: 7, cod_available: true  },
  { governorate: 'Sohag',         governorate_ar: 'سوهاج',         min_days: 4, max_days: 7, cod_available: false },
  { governorate: 'Qena',          governorate_ar: 'قنا',           min_days: 4, max_days: 7, cod_available: false },
  // Far Upper Egypt & remote — 5–8 days
  { governorate: 'Luxor',         governorate_ar: 'الأقصر',        min_days: 5, max_days: 7, cod_available: false },
  { governorate: 'Aswan',         governorate_ar: 'أسوان',         min_days: 5, max_days: 7, cod_available: false },
  { governorate: 'Red Sea',       governorate_ar: 'البحر الأحمر',  min_days: 5, max_days: 8, cod_available: false },
  { governorate: 'Matruh',        governorate_ar: 'مطروح',         min_days: 5, max_days: 8, cod_available: false },
  { governorate: 'North Sinai',   governorate_ar: 'شمال سيناء',    min_days: 5, max_days: 8, cod_available: false },
  { governorate: 'South Sinai',   governorate_ar: 'جنوب سيناء',    min_days: 5, max_days: 8, cod_available: false },
  { governorate: 'New Valley',    governorate_ar: 'الوادي الجديد', min_days: 6, max_days: 9, cod_available: false },
];

// ─── Supabase fetch with static fallback ─────────────────────────────────────

let _cachedZones: ShippingZone[] | null = null;

/**
 * Returns all shipping zones, fetched from Supabase and cached for the
 * session. Falls back to SHIPPING_ZONES if the DB is unreachable or the
 * table doesn't exist yet.
 */
export async function getShippingZones(): Promise<ShippingZone[]> {
  if (_cachedZones) return _cachedZones;

  try {
    const { data, error } = await supabase
      .from('shipping_zones')
      .select('id, governorate, governorate_ar, min_days, max_days, cod_available')
      .order('min_days', { ascending: true });

    if (error || !data || data.length === 0) {
      // Table not seeded yet or Supabase unavailable — use static seed
      _cachedZones = SHIPPING_ZONES;
      return _cachedZones;
    }

    _cachedZones = data as ShippingZone[];
    return _cachedZones;
  } catch {
    _cachedZones = SHIPPING_ZONES;
    return _cachedZones;
  }
}

/**
 * Looks up a single zone by governorate name (case-insensitive).
 * Returns null if the governorate is not in the table.
 */
export async function getZoneByGovernorate(governorate: string): Promise<ShippingZone | null> {
  const zones = await getShippingZones();
  return zones.find(
    (z) => z.governorate.toLowerCase() === governorate.toLowerCase()
  ) ?? null;
}

/** Invalidate the in-memory cache (useful after admin updates the table). */
export function invalidateShippingZoneCache(): void {
  _cachedZones = null;
}
