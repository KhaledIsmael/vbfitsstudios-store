import { supabase } from './supabaseClient';
import { BRAND_CONFIG } from '../config/assets';

export interface HeroBanner {
  id: string;
  image_url: string;
  season_tag: string;
  title: string;
  subtitle: string;
  cta_text: string;
  cta_link: string;
  sort_order: number;
  is_active: boolean;
}

/** Fallback slides built from the static brand config — always works offline. */
const FALLBACK_SLIDES: HeroBanner[] = [
  {
    id: 'fallback-1',
    image_url: BRAND_CONFIG.hero.src,
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
    image_url: '/assets/products/black-shirt.jpeg',
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
    image_url: '/assets/products/white-shirt.jpeg',
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
    const { data, error } = await supabase
      .from('hero_banners')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) throw error;
    if (!data || data.length === 0) return FALLBACK_SLIDES;
    return data as HeroBanner[];
  } catch {
    return FALLBACK_SLIDES;
  }
}
