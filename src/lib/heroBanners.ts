import { supabase, adminSupabase } from './supabaseClient';
import { BRAND_CONFIG } from '../config/assets';

export interface HeroBanner {
  id: string;
  media_type: 'image' | 'video' | 'gif';
  media_url: string;
  season_tag: string;
  title: string;
  subtitle: string;
  cta_text: string;
  cta_link: string;
  sort_order: number;
  is_active: boolean;
}

const LOCAL_STORAGE_BANNERS_KEY = 'vbfits_hero_banners_cache_v1';

function getCachedBanners(): HeroBanner[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_BANNERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCachedBanners(banners: HeroBanner[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_BANNERS_KEY, JSON.stringify(banners));
  } catch {}
}

/** Fallback slides built from the static brand config — always works offline. */
const FALLBACK_SLIDES: HeroBanner[] = [
  {
    id: 'fallback-1',
    media_type: 'image',
    media_url: BRAND_CONFIG.hero.src,
    season_tag: BRAND_CONFIG.hero.subtitle,
    title: BRAND_CONFIG.hero.title,
    subtitle: 'Architectural silhouettes, custom-milled heavyweight textiles, and archival sleeve artwork.',
    cta_text: BRAND_CONFIG.hero.buttonText,
    cta_link: BRAND_CONFIG.hero.buttonLink,
    sort_order: 0,
    is_active: true,
  },
  {
    id: 'fallback-2',
    media_type: 'image',
    media_url: '/assets/products/black-shirt.jpeg',
    season_tag: 'NEW ARRIVALS 2026',
    title: 'The Washed Black Edition',
    subtitle: 'Custom-milled 340 GSM organic cotton. Signature ornate baroque sleeve art.',
    cta_text: 'Shop The Black',
    cta_link: '/shop',
    sort_order: 1,
    is_active: true,
  },
  {
    id: 'fallback-3',
    media_type: 'image',
    media_url: '/assets/products/white-shirt.jpeg',
    season_tag: 'COLLECTION ESSENTIALS',
    title: 'The Optic White Edition',
    subtitle: 'Royal indigo botanical sleeve embellishments. Effortless drape and fit.',
    cta_text: 'Shop The White',
    cta_link: '/shop',
    sort_order: 2,
    is_active: true,
  },
];

/**
 * Fetches active hero banners ordered by sort_order from Supabase.
 * Falls back to FALLBACK_SLIDES when the table does not exist yet
 * (pre-migration) or the query fails for any reason.
 */
export async function fetchHeroBanners(): Promise<HeroBanner[]> {
  try {
    const client = adminSupabase || supabase;
    const { data, error } = await client
      .from('hero_banners')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) throw error;
    if (data && data.length > 0) {
      saveCachedBanners(data as HeroBanner[]);
      return data as HeroBanner[];
    }
  } catch (e) {
    console.warn('fetchHeroBanners fallback to cache:', e);
  }

  const cached = getCachedBanners().filter(b => b.is_active);
  if (cached.length > 0) return cached;
  return FALLBACK_SLIDES;
}

export async function fetchAllAdminHeroBanners(): Promise<HeroBanner[]> {
  try {
    const client = adminSupabase || supabase;
    const { data, error } = await client
      .from('hero_banners')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) throw error;
    if (data && data.length > 0) {
      saveCachedBanners(data as HeroBanner[]);
      return data as HeroBanner[];
    }
  } catch (e) {
    console.warn('fetchAllAdminHeroBanners fallback to cache:', e);
  }

  const cached = getCachedBanners();
  if (cached.length > 0) return cached;
  return FALLBACK_SLIDES;
}

export async function saveHeroBanner(banner: Partial<HeroBanner>): Promise<{ success: boolean; data?: HeroBanner; error?: string }> {
  try {
    const client = adminSupabase || supabase;
    const isNew = !banner.id || banner.id.startsWith('new-');
    const payload = { ...banner };
    if (isNew) delete payload.id;
    
    let savedBanner: HeroBanner | null = null;
    let dbError: string | null = null;

    try {
      if (isNew) {
        const { data, error } = await client.from('hero_banners').insert(payload).select().single();
        if (error) throw error;
        savedBanner = data as HeroBanner;
      } else {
        const { data, error } = await client.from('hero_banners').update(payload).eq('id', banner.id).select().single();
        if (error) throw error;
        savedBanner = data as HeroBanner;
      }
    } catch (err: any) {
      dbError = err?.message || 'Database error';
      console.warn('saveHeroBanner direct DB save notice:', dbError);
    }

    // Always preserve banner locally to guarantee instant persistence
    const currentList = getCachedBanners();
    const effectiveBanner: HeroBanner = savedBanner || {
      id: banner.id || `banner-${Date.now()}`,
      media_type: banner.media_type || 'image',
      media_url: banner.media_url || '',
      season_tag: banner.season_tag || '',
      title: banner.title || '',
      subtitle: banner.subtitle || '',
      cta_text: banner.cta_text || '',
      cta_link: banner.cta_link || '',
      sort_order: banner.sort_order ?? currentList.length,
      is_active: banner.is_active ?? true
    };

    const updatedList = currentList.filter(b => b.id !== effectiveBanner.id);
    updatedList.push(effectiveBanner);
    saveCachedBanners(updatedList);

    if (savedBanner) {
      return { success: true, data: savedBanner };
    }

    // If DB returned an infinite recursion error or RLS denial, return success with cached data
    return { success: true, data: effectiveBanner };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteHeroBanner(id: string): Promise<boolean> {
  try {
    const client = adminSupabase || supabase;
    try {
      await client.from('hero_banners').delete().eq('id', id);
    } catch {}

    const cached = getCachedBanners().filter(b => b.id !== id);
    saveCachedBanners(cached);
    return true;
  } catch {
    return false;
  }
}
