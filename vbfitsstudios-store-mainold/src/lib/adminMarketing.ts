import { supabase } from './supabaseClient';

declare const process: { env?: Record<string, string | undefined> } | undefined;

export interface DiscountCode {
  id: string;
  code: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  min_spend: number;
  max_uses?: number | null;
  times_used: number;
  starts_at: string;
  expires_at?: string | null;
  is_active: boolean;
  created_at: string;
}

export interface NewsletterSubscriber {
  id: string;
  email: string;
  source: string;
  created_at: string;
}

export interface StoreAnnouncement {
  enabled: boolean;
  text: string;
  link?: string;
}

const LOCAL_DISCOUNTS_KEY = 'vbfits_admin_discount_codes_v1';
const LOCAL_SUBSCRIBERS_KEY = 'vbfits_admin_newsletter_subscribers_v1';
const LOCAL_ANNOUNCEMENT_KEY = 'vbfits_storefront_announcement_v1';

// Seed default discount codes
const DEFAULT_DISCOUNT_CODES: DiscountCode[] = [
  {
    id: 'disc-welcome10',
    code: 'WELCOME10',
    discount_type: 'percentage',
    discount_value: 10,
    min_spend: 0,
    max_uses: 1000,
    times_used: 34,
    starts_at: new Date(Date.now() - 86400000 * 30).toISOString(),
    expires_at: null,
    is_active: true,
    created_at: new Date(Date.now() - 86400000 * 30).toISOString()
  },
  {
    id: 'disc-vip20',
    code: 'VIP20',
    discount_type: 'percentage',
    discount_value: 20,
    min_spend: 250,
    max_uses: 500,
    times_used: 18,
    starts_at: new Date(Date.now() - 86400000 * 15).toISOString(),
    expires_at: new Date(Date.now() + 86400000 * 60).toISOString(),
    is_active: true,
    created_at: new Date(Date.now() - 86400000 * 15).toISOString()
  },
  {
    id: 'disc-atelier50',
    code: 'ATELIER50',
    discount_type: 'fixed',
    discount_value: 50,
    min_spend: 300,
    max_uses: 200,
    times_used: 9,
    starts_at: new Date(Date.now() - 86400000 * 7).toISOString(),
    expires_at: new Date(Date.now() + 86400000 * 14).toISOString(),
    is_active: true,
    created_at: new Date(Date.now() - 86400000 * 7).toISOString()
  }
];

// Seed default subscribers
const DEFAULT_SUBSCRIBERS: NewsletterSubscriber[] = [
  {
    id: 'sub-01',
    email: 'yasmine.fahmy@artscouncil.eg',
    source: 'footer',
    created_at: new Date(Date.now() - 86400000 * 12).toISOString()
  },
  {
    id: 'sub-02',
    email: 'k.mansour@cairoatelier.eg',
    source: 'checkout',
    created_at: new Date(Date.now() - 86400000 * 8).toISOString()
  },
  {
    id: 'sub-03',
    email: 'nour.sherif@fashionhouse.com',
    source: 'footer',
    created_at: new Date(Date.now() - 86400000 * 3).toISOString()
  },
  {
    id: 'sub-04',
    email: 'a.wright@manhattan.com',
    source: 'footer',
    created_at: new Date(Date.now() - 86400000 * 1).toISOString()
  }
];

function getLocalDiscounts(): DiscountCode[] {
  try {
    const raw = localStorage.getItem(LOCAL_DISCOUNTS_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_DISCOUNT_CODES;
  } catch {
    return DEFAULT_DISCOUNT_CODES;
  }
}

function saveLocalDiscounts(codes: DiscountCode[]) {
  try {
    localStorage.setItem(LOCAL_DISCOUNTS_KEY, JSON.stringify(codes));
  } catch (err) {
    console.warn('Could not save local discount codes:', err);
  }
}

// ─── 1. DISCOUNT CODES CRUD ──────────────────────────────────────────────────

export async function fetchDiscountCodes(): Promise<DiscountCode[]> {
  try {
    const { data, error } = await supabase
      .from('discount_codes')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data && data.length > 0) {
      saveLocalDiscounts(data as DiscountCode[]);
      return data as DiscountCode[];
    }
  } catch (err) {
    console.warn('fetchDiscountCodes fallback:', err);
  }
  return getLocalDiscounts();
}

export async function createDiscountCode(
  params: Omit<DiscountCode, 'id' | 'times_used' | 'created_at'>
): Promise<{ success: boolean; data?: DiscountCode; error?: string }> {
  const codeFormatted = params.code.trim().toUpperCase();
  const newCode: DiscountCode = {
    ...params,
    id: 'disc-' + Date.now(),
    code: codeFormatted,
    times_used: 0,
    created_at: new Date().toISOString()
  };

  // Local sync
  const current = getLocalDiscounts();
  if (current.some((c) => c.code === codeFormatted)) {
    return { success: false, error: 'Promo code already exists.' };
  }
  const updated = [newCode, ...current];
  saveLocalDiscounts(updated);

  // Supabase sync
  try {
    const { data, error } = await supabase
      .from('discount_codes')
      .insert({
        code: codeFormatted,
        discount_type: params.discount_type,
        discount_value: params.discount_value,
        min_spend: params.min_spend,
        max_uses: params.max_uses,
        starts_at: params.starts_at,
        expires_at: params.expires_at,
        is_active: params.is_active
      })
      .select()
      .single();

    if (!error && data) {
      return { success: true, data: data as DiscountCode };
    }
  } catch (err: any) {
    console.warn('createDiscountCode DB notice:', err);
  }

  return { success: true, data: newCode };
}

export async function updateDiscountCode(
  id: string,
  updates: Partial<DiscountCode>
): Promise<{ success: boolean; error?: string }> {
  // Local sync
  const current = getLocalDiscounts();
  const updated = current.map((c) => (c.id === id ? { ...c, ...updates } : c));
  saveLocalDiscounts(updated);

  // Supabase sync
  try {
    await supabase.from('discount_codes').update(updates).eq('id', id);
  } catch (err) {
    console.warn('updateDiscountCode DB notice:', err);
  }

  return { success: true };
}

export async function toggleDiscountCodeActive(
  id: string,
  isActive: boolean
): Promise<{ success: boolean }> {
  return updateDiscountCode(id, { is_active: isActive });
}

export async function deleteDiscountCode(id: string): Promise<{ success: boolean }> {
  const current = getLocalDiscounts();
  saveLocalDiscounts(current.filter((c) => c.id !== id));

  try {
    await supabase.from('discount_codes').delete().eq('id', id);
  } catch (err) {
    console.warn('deleteDiscountCode DB notice:', err);
  }

  return { success: true };
}

/**
 * Validates a promo code for checkout application.
 */
export async function validateDiscountCode(
  inputCode: string,
  subtotal: number
): Promise<{
  valid: boolean;
  discountAmount: number;
  message: string;
  codeDetails?: DiscountCode;
}> {
  if (!inputCode.trim()) {
    return { valid: false, discountAmount: 0, message: 'Please provide a discount code.' };
  }

  const clean = inputCode.trim().toUpperCase();

  // Legacy hardcoded fallback support
  if (clean === 'VB10' || clean === 'VIP10') {
    const discount = subtotal * 0.1;
    return {
      valid: true,
      discountAmount: discount,
      message: 'Privilege code applied: 10% archival savings.'
    };
  }
  if (clean === 'FREESHIP') {
    return {
      valid: true,
      discountAmount: 0,
      message: 'Complimentary express shipping active on all orders.'
    };
  }

  const allCodes = await fetchDiscountCodes();
  const match = allCodes.find((c) => c.code.toUpperCase() === clean);

  if (!match) {
    return { valid: false, discountAmount: 0, message: 'Invalid or unrecognized coupon code.' };
  }

  if (!match.is_active) {
    return { valid: false, discountAmount: 0, message: 'This coupon code is currently disabled.' };
  }

  const now = new Date().getTime();
  if (match.starts_at && new Date(match.starts_at).getTime() > now) {
    return { valid: false, discountAmount: 0, message: 'This promotion has not started yet.' };
  }

  if (match.expires_at && new Date(match.expires_at).getTime() < now) {
    return { valid: false, discountAmount: 0, message: 'This coupon code has expired.' };
  }

  if (match.max_uses && match.times_used >= match.max_uses) {
    return { valid: false, discountAmount: 0, message: 'This coupon code has reached its usage limit.' };
  }

  if (match.min_spend && subtotal < match.min_spend) {
    return {
      valid: false,
      discountAmount: 0,
      message: `Requires a minimum cart spend of $${match.min_spend.toFixed(2)}.`
    };
  }

  let discount = 0;
  if (match.discount_type === 'percentage') {
    discount = (subtotal * match.discount_value) / 100;
  } else {
    discount = Math.min(subtotal, match.discount_value);
  }

  return {
    valid: true,
    discountAmount: discount,
    message: `Promotion applied: ${
      match.discount_type === 'percentage'
        ? `${match.discount_value}% savings`
        : `$${match.discount_value.toFixed(2)} discount`
    }.`,
    codeDetails: match
  };
}

// ─── 2. NEWSLETTER SUBSCRIBERS ────────────────────────────────────────────────

export async function fetchNewsletterSubscribers(): Promise<NewsletterSubscriber[]> {
  try {
    const { data, error } = await supabase
      .from('newsletter_subscribers')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data && data.length > 0) {
      try {
        localStorage.setItem(LOCAL_SUBSCRIBERS_KEY, JSON.stringify(data));
      } catch {}
      return data as NewsletterSubscriber[];
    }
  } catch (err) {
    console.warn('fetchNewsletterSubscribers notice:', err);
  }

  try {
    const raw = localStorage.getItem(LOCAL_SUBSCRIBERS_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_SUBSCRIBERS;
  } catch {
    return DEFAULT_SUBSCRIBERS;
  }
}

export async function subscribeNewsletter(
  email: string,
  source: string = 'footer'
): Promise<{ success: boolean; message: string }> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    return { success: false, message: 'Invalid email address.' };
  }

  const current = await fetchNewsletterSubscribers();
  if (current.some((s) => s.email.toLowerCase() === cleanEmail)) {
    return { success: true, message: 'You are already subscribed to the atelier list.' };
  }

  const newSub: NewsletterSubscriber = {
    id: 'sub-' + Date.now(),
    email: cleanEmail,
    source,
    created_at: new Date().toISOString()
  };

  const updated = [newSub, ...current];
  try {
    localStorage.setItem(LOCAL_SUBSCRIBERS_KEY, JSON.stringify(updated));
  } catch {}

  try {
    await supabase.from('newsletter_subscribers').insert({
      email: cleanEmail,
      source
    });
  } catch (err) {
    console.warn('subscribeNewsletter DB notice:', err);
  }

  // Sync to Brevo contact list (free tier — non-blocking)
  // BREVO_API_KEY is a server-side secret; this call is intentionally fire-and-forget.
  // In production the browser doesn't have the key, so we only attempt this from
  // a serverless context. For the storefront, the cron sync handles batched push.
  try {
    const brevoKey = (typeof process !== 'undefined' && process?.env?.BREVO_API_KEY) || '';
    if (brevoKey) {
      fetch('https://api.brevo.com/v3/contacts', {
        method: 'POST',
        headers: {
          'api-key': brevoKey,
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({
          email: cleanEmail,
          attributes: { SOURCE: source },
          listIds: [], // add Brevo list ID integers here when configured
          updateEnabled: true
        })
      }).catch((err) => console.warn('[brevo-sync] notice:', err));
    }
  } catch {
    // Silently ignore — Supabase row was already saved
  }

  return { success: true, message: 'Welcome to the VB FITS STUDIOS private newsletter.' };
}

export function exportSubscribersCSV(subscribers: NewsletterSubscriber[]) {
  const headers = ['Email', 'Source', 'Subscribed Date'];
  const rows = subscribers.map((s) => [
    s.email,
    s.source,
    new Date(s.created_at).toLocaleString()
  ]);

  const csvContent =
    'data:text/csv;charset=utf-8,' +
    [headers.join(','), ...rows.map((e) => e.map((val) => `"${val}"`).join(','))].join('\n');

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `vbfits_newsletter_subscribers_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ─── 3. STOREFRONT ANNOUNCEMENT BANNER ────────────────────────────────────────

const DEFAULT_ANNOUNCEMENT: StoreAnnouncement = {
  enabled: true,
  text: 'COMPLIMENTARY EXPRESS DELIVERY ON ALL ORDERS ABOVE $200 · CAIRO & GIZA HUB',
  link: '/shop'
};

export async function getStorefrontAnnouncement(): Promise<StoreAnnouncement> {
  try {
    const { data } = await supabase
      .from('store_settings')
      .select('value')
      .eq('key', 'announcement_bar')
      .single();

    if (data && data.value) {
      try {
        localStorage.setItem(LOCAL_ANNOUNCEMENT_KEY, JSON.stringify(data.value));
      } catch {}
      return data.value as StoreAnnouncement;
    }
  } catch (err) {
    console.warn('getStorefrontAnnouncement notice:', err);
  }

  try {
    const raw = localStorage.getItem(LOCAL_ANNOUNCEMENT_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_ANNOUNCEMENT;
  } catch {
    return DEFAULT_ANNOUNCEMENT;
  }
}

export async function updateStorefrontAnnouncement(
  announcement: StoreAnnouncement
): Promise<{ success: boolean }> {
  try {
    localStorage.setItem(LOCAL_ANNOUNCEMENT_KEY, JSON.stringify(announcement));
  } catch {}

  try {
    await supabase.from('store_settings').upsert({
      key: 'announcement_bar',
      value: announcement,
      updated_at: new Date().toISOString()
    });
  } catch (err) {
    console.warn('updateStorefrontAnnouncement DB notice:', err);
  }

  return { success: true };
}
