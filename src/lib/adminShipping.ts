import { supabase } from './supabaseClient';
import { SHIPPING_ZONES, type ShippingZone } from './shippingZones';

export interface AdminShippingZone extends ShippingZone {
  shipping_rate: number;
}

const LOCAL_SHIPPING_KEY = 'vbfits_admin_shipping_zones_v1';

// Seed initial default rates
const SEED_ADMIN_SHIPPING_ZONES: AdminShippingZone[] = SHIPPING_ZONES.map((zone) => {
  let rate = 15.0;
  if (['Cairo', 'Giza', 'Qalyubia'].includes(zone.governorate)) {
    rate = 10.0; // Greater Cairo special express rate
  } else if (['Alexandria', 'Sharqia', 'Dakahlia', 'Gharbia', 'Monufia'].includes(zone.governorate)) {
    rate = 15.0; // Delta & Coast
  } else {
    rate = 20.0; // Upper Egypt & remote governorates
  }
  return {
    ...zone,
    shipping_rate: rate
  };
});

function getLocalShippingZones(): AdminShippingZone[] {
  try {
    const raw = localStorage.getItem(LOCAL_SHIPPING_KEY);
    return raw ? JSON.parse(raw) : SEED_ADMIN_SHIPPING_ZONES;
  } catch {
    return SEED_ADMIN_SHIPPING_ZONES;
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
    const { data, error } = await supabase
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
        shipping_rate: Number(z.shipping_rate || 15.0)
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

  // Sync with Supabase
  try {
    await supabase
      .from('shipping_zones')
      .update(updates)
      .eq('governorate', governorate);
  } catch (err) {
    console.warn('updateAdminShippingZone DB notice:', err);
  }

  return { success: true };
}
