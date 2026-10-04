import { supabase, adminSupabase } from './supabaseClient';

export interface SiteSettings {
  id?: string;
  launch_at: string; // ISO 8601 string with Africa/Cairo offset, e.g. "2026-10-10T00:00:00+03:00"
  countdown_gate_enabled: boolean; // on/off switch for full-screen gate from L1
  gate_enabled?: boolean; // backwards compatibility alias
  countdown_strip_enabled: boolean;
  teaser_headline?: string;
  teaser_subtext?: string;
  teaser_text?: string; // consolidated teaser text
  countdown_strip_text?: string;
  editorial_media_url?: string;
  editorial_media_type?: 'image' | 'video' | 'gif';
  social_proof_media_url?: string;
  social_proof_media_type?: 'image' | 'video' | 'gif';
  social_whatsapp_url?: string;
  social_instagram_url?: string;
  social_tiktok_url?: string;
  credits_developer_name?: string;
  credits_developer_url?: string;
  credits_agency_name?: string;
  credits_agency_url?: string;
  updated_at?: string;
}

export interface TimeRemaining {
  total: number; // milliseconds remaining (<= 0 when passed)
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isPassed: boolean;
}

export const LOCAL_SETTINGS_KEY = 'vbfits_site_settings';
export const PAST_GATE_KEY = 'past_gate';

// Default 2026-10-10 00:00 Africa/Cairo (UTC+3 in summer / October DST)
export const DEFAULT_LAUNCH_AT = '2026-10-10T00:00:00+03:00';

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  id: 'current',
  launch_at: DEFAULT_LAUNCH_AT,
  countdown_gate_enabled: true,
  gate_enabled: true,
  countdown_strip_enabled: true,
  teaser_headline: 'THE ARCHIVAL VAULT OPENS SOON',
  teaser_subtext: 'SECURE EARLY ATELIER ACCESS & PRIVATE VIP DROP DISPATCHES',
  teaser_text: 'THE ARCHIVAL VAULT OPENS SOON. SECURE EARLY ATELIER ACCESS.',
  countdown_strip_text: 'OFFICIAL LAUNCH INCOMING · WORLDWIDE DROP',
  editorial_media_url: '',
  editorial_media_type: 'image',
  social_proof_media_url: '',
  social_proof_media_type: 'image',
  social_whatsapp_url: 'https://wa.me/201021368544',
  social_instagram_url: 'https://www.instagram.com/vbfitsstudios',
  social_tiktok_url: 'https://www.tiktok.com/@vbfitsstudios',
  credits_developer_name: 'Khaled Ismail',
  credits_developer_url: 'https://www.linkedin.com/in/khaled-ismail-27899a306',
  credits_agency_name: 'ERTH',
  credits_agency_url: 'https://www.linkedin.com/company/erth-%D8%A5%D8%B1%D8%AB/'
};

/**
 * Normalizes and formats social media & external URLs to guarantee valid HTTPS absolute links.
 * Prevents broken relative redirects like https://vbfitsstudios.com/@vbfitsstudios or https://vbfitsstudios.com/instagram.com/...
 */
export function formatSocialUrl(type: 'instagram' | 'tiktok' | 'whatsapp' | 'url', rawUrl?: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') {
    switch (type) {
      case 'instagram': return DEFAULT_SITE_SETTINGS.social_instagram_url!;
      case 'tiktok': return DEFAULT_SITE_SETTINGS.social_tiktok_url!;
      case 'whatsapp': return DEFAULT_SITE_SETTINGS.social_whatsapp_url!;
      default: return '#';
    }
  }

  let cleaned = rawUrl.trim();
  if (!cleaned) {
    switch (type) {
      case 'instagram': return DEFAULT_SITE_SETTINGS.social_instagram_url!;
      case 'tiktok': return DEFAULT_SITE_SETTINGS.social_tiktok_url!;
      case 'whatsapp': return DEFAULT_SITE_SETTINGS.social_whatsapp_url!;
      default: return '#';
    }
  }

  // 1. WhatsApp
  if (type === 'whatsapp') {
    if (cleaned.startsWith('https://wa.me/') || cleaned.startsWith('http://wa.me/')) {
      return cleaned.replace(/^http:\/\//, 'https://');
    }
    if (cleaned.includes('wa.me/')) {
      const parts = cleaned.split('wa.me/');
      const digits = (parts[1] || '').replace(/[^\d]/g, '');
      return `https://wa.me/${digits || '201021368544'}`;
    }
    // Extract raw digits
    let digits = cleaned.replace(/[^\d]/g, '');
    // If starts with Egyptian local mobile '01...', convert to international '+201...'
    if (digits.startsWith('01') && digits.length === 11) {
      digits = '2' + digits; // 201xxxxxxxxx
    } else if (digits.startsWith('1') && digits.length === 10) {
      digits = '20' + digits;
    }
    return `https://wa.me/${digits || '201021368544'}`;
  }

  // 2. Instagram
  if (type === 'instagram') {
    cleaned = cleaned.replace(/^@/, '');
    if (/^https?:\/\/(www\.)?instagram\.com\//i.test(cleaned)) {
      return cleaned.replace(/^http:\/\//i, 'https://');
    }
    if (/^(www\.)?instagram\.com\//i.test(cleaned)) {
      return `https://${cleaned}`;
    }
    return `https://www.instagram.com/${cleaned.replace(/^\/+/, '')}`;
  }

  // 3. TikTok
  if (type === 'tiktok') {
    if (/^https?:\/\/(www\.)?tiktok\.com\//i.test(cleaned)) {
      return cleaned.replace(/^http:\/\//i, 'https://');
    }
    if (/^(www\.)?tiktok\.com\//i.test(cleaned)) {
      return `https://${cleaned}`;
    }
    const handle = cleaned.startsWith('@') ? cleaned : `@${cleaned}`;
    return `https://www.tiktok.com/${handle}`;
  }

  // 4. Generic external URL (developer credits, agency, etc.)
  if (!/^https?:\/\//i.test(cleaned)) {
    return `https://${cleaned}`;
  }
  return cleaned;
}

/**
 * Calculates the exact GMT offset for Africa/Cairo (e.g. "+03:00" or "+02:00")
 */
export function getCairoTzOffset(date: Date = new Date()): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Africa/Cairo',
      timeZoneName: 'longOffset'
    });
    const parts = formatter.formatToParts(date);
    const tzPart = parts.find((p) => p.type === 'timeZoneName')?.value;
    if (tzPart && tzPart.startsWith('GMT')) {
      return tzPart.replace('GMT', ''); // "+03:00" or "+02:00"
    }
  } catch (err) {
    console.warn('Could not compute Cairo timezone offset:', err);
  }
  return '+03:00';
}

/**
 * Formats a datetime string into ISO format with Africa/Cairo offset
 */
export function formatCairoIso(datetimeLocalValue: string): string {
  if (!datetimeLocalValue) return DEFAULT_LAUNCH_AT;

  // If already contains timezone offset (+ or - after time), return directly
  if (/(?:[+-]\d{2}:\d{2}|Z)$/.test(datetimeLocalValue)) {
    return datetimeLocalValue;
  }

  // Value is typically "YYYY-MM-DDTHH:mm"
  const clean = datetimeLocalValue.length === 16 ? `${datetimeLocalValue}:00` : datetimeLocalValue;
  const tempDate = new Date(clean);
  const offset = getCairoTzOffset(!isNaN(tempDate.getTime()) ? tempDate : new Date());

  return `${clean}${offset}`;
}

/**
 * Converts stored ISO string to input type="datetime-local" representation
 */
export function toDatetimeLocal(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '2026-10-10T00:00';
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return '2026-10-10T00:00';
  }
}

/**
 * Calculates remaining time until launchAt
 */
export function calculateCountdown(launchAtIso: string): TimeRemaining {
  try {
    const target = new Date(launchAtIso).getTime();
    if (isNaN(target)) {
      return { total: 0, days: 0, hours: 0, minutes: 0, seconds: 0, isPassed: true };
    }
    const now = Date.now();
    const total = target - now;

    if (total <= 0) {
      return { total: 0, days: 0, hours: 0, minutes: 0, seconds: 0, isPassed: true };
    }

    const seconds = Math.floor((total / 1000) % 60);
    const minutes = Math.floor((total / 1000 / 60) % 60);
    const hours = Math.floor((total / (1000 * 60 * 60)) % 24);
    const days = Math.floor(total / (1000 * 60 * 60 * 24));

    return { total, days, hours, minutes, seconds, isPassed: false };
  } catch {
    return { total: 0, days: 0, hours: 0, minutes: 0, seconds: 0, isPassed: true };
  }
}

/**
 * Check if the current visitor has bypassed the pre-launch gate
 */
export function isPastGate(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(PAST_GATE_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Sets or clears the past_gate flag in localStorage
 */
export function setPastGate(bypassed: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (bypassed) {
      localStorage.setItem(PAST_GATE_KEY, 'true');
    } else {
      localStorage.removeItem(PAST_GATE_KEY);
    }
    window.dispatchEvent(new CustomEvent('vbfits_past_gate_changed', { detail: { bypassed } }));
  } catch (err) {
    console.warn('Could not update past_gate flag:', err);
  }
}

/**
 * Fetch site settings from Supabase site_settings table,
 * falling back to store_settings key-value, localStorage, or defaults.
 */
/**
 * Fetch site settings from localStorage or Supabase site_settings table.
 * Resolves immediately with local cache for zero latency, syncing in background.
 */
export async function getSiteSettings(): Promise<SiteSettings> {
  let cachedSettings: SiteSettings | null = null;

  // 1. Instant check from localStorage
  try {
    const cached = localStorage.getItem(LOCAL_SETTINGS_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && parsed.launch_at) {
        const gateEnabled = parsed.countdown_gate_enabled ?? parsed.gate_enabled ?? true;
        cachedSettings = {
          ...DEFAULT_SITE_SETTINGS,
          ...parsed,
          countdown_gate_enabled: gateEnabled,
          gate_enabled: gateEnabled
        };
      }
    }
  } catch {}

  // 2. Fetch from Supabase site_settings table (with 2s timeout)
  try {
    const fetchPromise = supabase
      .from('site_settings')
      .select('*')
      .eq('id', 'current')
      .maybeSingle();

    const timeoutPromise = new Promise<{ data: any; error: any }>((resolve) =>
      setTimeout(() => resolve({ data: null, error: { message: 'timeout' } }), 1800)
    );

    const { data, error } = await Promise.race([fetchPromise, timeoutPromise]);

    if (data && !error && data.launch_at) {
      const gateEnabled = data.countdown_gate_enabled ?? data.gate_enabled ?? true;
      const merged: SiteSettings = {
        ...DEFAULT_SITE_SETTINGS,
        ...data,
        id: data.id || 'current',
        launch_at: data.launch_at || DEFAULT_LAUNCH_AT,
        countdown_gate_enabled: gateEnabled,
        gate_enabled: gateEnabled,
        countdown_strip_enabled: data.countdown_strip_enabled ?? true,
        teaser_headline: data.teaser_headline || DEFAULT_SITE_SETTINGS.teaser_headline,
        teaser_subtext: data.teaser_subtext || DEFAULT_SITE_SETTINGS.teaser_subtext,
        teaser_text:
          data.teaser_text ||
          (data.teaser_headline
            ? `${data.teaser_headline}. ${data.teaser_subtext || ''}`
            : DEFAULT_SITE_SETTINGS.teaser_text),
        countdown_strip_text: data.countdown_strip_text || DEFAULT_SITE_SETTINGS.countdown_strip_text,
        social_instagram_url: formatSocialUrl('instagram', data.social_instagram_url),
        social_whatsapp_url: formatSocialUrl('whatsapp', data.social_whatsapp_url),
        social_tiktok_url: formatSocialUrl('tiktok', data.social_tiktok_url),
        editorial_media_url: data.editorial_media_url || DEFAULT_SITE_SETTINGS.editorial_media_url,
        editorial_media_type: data.editorial_media_type || DEFAULT_SITE_SETTINGS.editorial_media_type,
        social_proof_media_url: data.social_proof_media_url || DEFAULT_SITE_SETTINGS.social_proof_media_url,
        social_proof_media_type: data.social_proof_media_type || DEFAULT_SITE_SETTINGS.social_proof_media_type,
        credits_developer_name: data.credits_developer_name || DEFAULT_SITE_SETTINGS.credits_developer_name,
        credits_developer_url: data.credits_developer_url ? formatSocialUrl('url', data.credits_developer_url) : DEFAULT_SITE_SETTINGS.credits_developer_url,
        credits_agency_name: data.credits_agency_name || DEFAULT_SITE_SETTINGS.credits_agency_name,
        credits_agency_url: data.credits_agency_url ? formatSocialUrl('url', data.credits_agency_url) : DEFAULT_SITE_SETTINGS.credits_agency_url,
        updated_at: data.updated_at
      };
      try {
        localStorage.setItem(LOCAL_SETTINGS_KEY, JSON.stringify(merged));
      } catch {}
      return merged;
    }
  } catch (err) {
    console.warn('getSiteSettings table query notice:', err);
  }

  // 3. Fall back to store_settings table (key = 'site_settings')
  try {
    const { data: storeData } = await supabase
      .from('store_settings')
      .select('value')
      .eq('key', 'site_settings')
      .maybeSingle();

    if (storeData && storeData.value && (storeData.value as any).launch_at) {
      const val = storeData.value as SiteSettings;
      const gateEnabled = val.countdown_gate_enabled ?? val.gate_enabled ?? true;
      const merged: SiteSettings = {
        ...DEFAULT_SITE_SETTINGS,
        ...val,
        countdown_gate_enabled: gateEnabled,
        gate_enabled: gateEnabled
      };
      try {
        localStorage.setItem(LOCAL_SETTINGS_KEY, JSON.stringify(merged));
      } catch {}
      return merged;
    }
  } catch (err) {
    console.warn('getSiteSettings fallback query notice:', err);
  }

  return cachedSettings || DEFAULT_SITE_SETTINGS;
}

/**
 * Updates site settings in Supabase and local storage
 */
export async function updateSiteSettings(
  settings: Partial<SiteSettings>
): Promise<{ success: boolean; data?: SiteSettings; error?: string }> {
  let current: SiteSettings = DEFAULT_SITE_SETTINGS;
  try {
    const cached = localStorage.getItem(LOCAL_SETTINGS_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed) current = { ...DEFAULT_SITE_SETTINGS, ...parsed };
    }
  } catch {}

  const gateActive =
    settings.countdown_gate_enabled !== undefined
      ? settings.countdown_gate_enabled
      : settings.gate_enabled !== undefined
      ? settings.gate_enabled
      : current.countdown_gate_enabled;

  const headline = settings.teaser_headline !== undefined ? settings.teaser_headline : current.teaser_headline;
  const subtext = settings.teaser_subtext !== undefined ? settings.teaser_subtext : current.teaser_subtext;
  const teaserCombined = settings.teaser_text || (headline ? `${headline}. ${subtext || ''}`.trim() : current.teaser_text);

  const updated: SiteSettings = {
    ...current,
    ...settings,
    countdown_gate_enabled: gateActive,
    gate_enabled: gateActive,
    teaser_headline: headline,
    teaser_subtext: subtext,
    teaser_text: teaserCombined,
    social_whatsapp_url: formatSocialUrl('whatsapp', settings.social_whatsapp_url !== undefined ? settings.social_whatsapp_url : current.social_whatsapp_url),
    social_instagram_url: formatSocialUrl('instagram', settings.social_instagram_url !== undefined ? settings.social_instagram_url : current.social_instagram_url),
    social_tiktok_url: formatSocialUrl('tiktok', settings.social_tiktok_url !== undefined ? settings.social_tiktok_url : current.social_tiktok_url),
    credits_developer_url: settings.credits_developer_url !== undefined ? (settings.credits_developer_url ? formatSocialUrl('url', settings.credits_developer_url) : '') : current.credits_developer_url,
    credits_agency_url: settings.credits_agency_url !== undefined ? (settings.credits_agency_url ? formatSocialUrl('url', settings.credits_agency_url) : '') : current.credits_agency_url,
    updated_at: new Date().toISOString()
  };

  // Cache locally first for instant optimistic response across all open tabs
  try {
    localStorage.setItem(LOCAL_SETTINGS_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('vbfits_site_settings_changed', { detail: updated }));
  } catch {}

  // Async non-blocking save to Supabase site_settings and store_settings
  (async () => {
    try {
      const client = adminSupabase || supabase;
      const { error } = await client.from('site_settings').upsert({
        id: 'current',
        launch_at: updated.launch_at,
        countdown_gate_enabled: updated.countdown_gate_enabled,
        gate_enabled: updated.countdown_gate_enabled,
        countdown_strip_enabled: updated.countdown_strip_enabled,
        teaser_headline: updated.teaser_headline,
        teaser_subtext: updated.teaser_subtext,
        teaser_text: updated.teaser_text,
        countdown_strip_text: updated.countdown_strip_text,
        social_instagram_url: updated.social_instagram_url,
        social_whatsapp_url: updated.social_whatsapp_url,
        social_tiktok_url: updated.social_tiktok_url,
        editorial_media_url: updated.editorial_media_url,
        editorial_media_type: updated.editorial_media_type,
        social_proof_media_url: updated.social_proof_media_url,
        social_proof_media_type: updated.social_proof_media_type,
        credits_developer_name: updated.credits_developer_name,
        credits_developer_url: updated.credits_developer_url,
        credits_agency_name: updated.credits_agency_name,
        credits_agency_url: updated.credits_agency_url,
        updated_at: updated.updated_at
      });

      if (error && (error.code === '42703' || error.message?.includes('column'))) {
        await client.from('site_settings').upsert({
          id: 'current',
          launch_at: updated.launch_at,
          countdown_strip_enabled: updated.countdown_strip_enabled,
          gate_enabled: updated.countdown_gate_enabled,
          teaser_text: updated.teaser_text,
          countdown_strip_text: updated.countdown_strip_text,
          updated_at: updated.updated_at
        });
      }
    } catch (err) {
      console.warn('site_settings upsert exception:', err);
    }

    try {
      const client = adminSupabase || supabase;
      await client.from('store_settings').upsert({
        key: 'site_settings',
        value: updated,
        updated_at: updated.updated_at
      });
    } catch (err) {
      console.warn('store_settings dual-sync exception:', err);
    }
  })();

  return { success: true, data: updated };
}
