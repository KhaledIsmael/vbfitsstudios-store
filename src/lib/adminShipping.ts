import { adminSupabase, supabase } from './supabaseClient';
import { SHIPPING_ZONES, invalidateShippingZoneCache, type ShippingZone } from './shippingZones';

export interface AdminShippingZone extends ShippingZone {
  shipping_rate: number;
}

const LOCAL_SHIPPING_KEY = 'vbfits_admin_shipping_zones_v1';

function getLocalShippingZones(): AdminShippingZone[] {
  try {
    const raw = localStorage.getItem(LOCAL_SHIPPING_KEY);
    return raw ? JSON.parse(raw) : (SHIPPING_ZONES as AdminShippingZone[]);
  } catch {
    return SHIPPING_ZONES as AdminShippingZone[];
  }
}

function saveLocalShippingZones(zones: AdminShippingZone[]) {
  try {
    localStorage.setItem(LOCAL_SHIPPING_KEY, JSON.stringify(zones));
  } catch (err) {
    console.warn('Could not save local shipping zones:', err);
  }
}

export async function fetchAdminShippingZones(): Promise<AdminShippingZone[]> {
  try {
    // 1. Fetch from shipping_zones table using adminSupabase (falls back to supabase)
    const client = adminSupabase || supabase;
    const { data, error } = await client
      .from('shipping_zones')
      .select('*')
      .order('min_days', { ascending: true });

    if (!error && data && data.length > 0) {
      const dbZones: AdminShippingZone[] = data.map((z: any) => ({
        id: z.id,
        governorate: z.governorate,
        governorate_ar: z.governorate_ar,
        min_days: Number(z.min_days || 2),
        max_days: Number(z.max_days || 5),
        cod_available: Boolean(z.cod_available),
        shipping_rate: Number(z.shipping_rate ?? z.shipping_fee ?? z.rate ?? 65),
        free_shipping_threshold: z.free_shipping_threshold ? Number(z.free_shipping_threshold) : 1500
      }));

      saveLocalShippingZones(dbZones);
      return dbZones;
    }
  } catch (err) {
    console.warn('fetchAdminShippingZones notice:', err);
  }

  return getLocalShippingZones();
}

export async function updateAdminShippingZone(
  governorate: string,
  updates: Partial<AdminShippingZone>
): Promise<{ success: boolean; error?: string }> {
  // Update local cache
  const local = getLocalShippingZones();
  const updated = local.map((z) => (z.governorate === governorate ? { ...z, ...updates } : z));
  saveLocalShippingZones(updated);

  // Invalidate public storefront cache immediately
  invalidateShippingZoneCache();

  // Prepare database payload ensuring all rate alias columns are synchronized
  const dbPayload: any = {};
  if (updates.min_days !== undefined) dbPayload.min_days = updates.min_days;
  if (updates.max_days !== undefined) dbPayload.max_days = updates.max_days;
  if (updates.cod_available !== undefined) dbPayload.cod_available = updates.cod_available;
  if (updates.shipping_rate !== undefined) {
    dbPayload.shipping_rate = updates.shipping_rate;
    dbPayload.shipping_fee = updates.shipping_rate;
    dbPayload.rate = updates.shipping_rate;
  }
  if (updates.free_shipping_threshold !== undefined) {
    dbPayload.free_shipping_threshold = updates.free_shipping_threshold;
  }

  // 1. Sync directly to shipping_zones table using admin client
  try {
    const client = adminSupabase || supabase;
    const { error: dbError } = await client
      .from('shipping_zones')
      .update(dbPayload)
      .eq('governorate', governorate);

    if (dbError) {
      console.warn('updateAdminShippingZone DB notice:', dbError.message);
    }
  } catch (err: any) {
    console.warn('updateAdminShippingZone DB exception:', err);
  }

  // 2. Also persist to store_settings for universal cloud backup
  try {
    const client = adminSupabase || supabase;
    await client.from('store_settings').upsert({
      key: 'shipping_zones_overrides',
      value: updated,
      updated_at: new Date().toISOString()
    }, { onConflict: 'key' });
  } catch (err) {
    console.warn('Failed to sync shipping zone overrides to store_settings:', err);
  }

  return { success: true };
}
