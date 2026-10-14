import { supabase, adminSupabase } from './supabaseClient';

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

const LOCAL_SUBSCRIBERS_KEY = 'vbfits_admin_newsletter_subscribers_v1';
const LOCAL_ANNOUNCEMENT_KEY = 'vbfits_storefront_announcement_v1';

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

// ─── 1. DISCOUNT CODES CRUD (database only: no browser cache, no seeded codes) ─

const NO_SESSION_MESSAGE =
  'لا توجد جلسة صالحة مع قاعدة البيانات. يرجى تسجيل الدخول مرة أخرى. (No valid database session — please sign in again.)';

/** Writes/reads of discount_codes are protected by RLS and need a real admin Supabase session. */
async function hasAdminSession(): Promise<boolean> {
  try {
    const { data } = await adminSupabase.auth.getSession();
    return !!data.session;
  } catch {
    return false;
  }
}

/** Older dashboard versions kept a browser copy of the promo codes; make sure it is never used again. */
function clearLegacyLocalDiscounts() {
  try {
    localStorage.removeItem('vbfits_admin_discount_codes_v1');
  } catch {
    // ignore
  }
}

export async function fetchDiscountCodes(): Promise<DiscountCode[]> {
  clearLegacyLocalDiscounts();
  if (!(await hasAdminSession())) throw new Error(NO_SESSION_MESSAGE);

  const { data, error } = await adminSupabase
    .from('discount_codes')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data || []) as DiscountCode[];
}

export async function createDiscountCode(
  params: Omit<DiscountCode, 'id' | 'times_used' | 'created_at'>
): Promise<{ success: boolean; data?: DiscountCode; error?: string }> {
  if (!(await hasAdminSession())) return { success: false, error: NO_SESSION_MESSAGE };

  // Codes are normalised (trimmed, no spaces, upper-case); the DB enforces uniqueness on upper(code)
  const codeFormatted = params.code.trim().toUpperCase().replace(/\s+/g, '');

  const { data, error } = await adminSupabase
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

  if (error) {
    if (error.code === '23505') {
      return { success: false, error: 'هذا الكود موجود بالفعل. (Promo code already exists.)' };
    }
    return { success: false, error: error.message };
  }
  return { success: true, data: data as DiscountCode };
}

export async function updateDiscountCode(
  id: string,
  updates: Partial<DiscountCode>
): Promise<{ success: boolean; error?: string }> {
  if (!(await hasAdminSession())) return { success: false, error: NO_SESSION_MESSAGE };

  const payload: Partial<DiscountCode> = { ...updates };
  if (payload.code !== undefined) payload.code = payload.code.trim().toUpperCase().replace(/\s+/g, '');

  const { data, error } = await adminSupabase
    .from('discount_codes')
    .update(payload)
    .eq('id', id)
    .select('id');

  if (error) {
    if (error.code === '23505') {
      return { success: false, error: 'هذا الكود موجود بالفعل. (Promo code already exists.)' };
    }
    return { success: false, error: error.message };
  }
  if (!data || data.length === 0) {
    return { success: false, error: 'لم يتم تحديث أي سجل. (Promo code not found or update not permitted.)' };
  }
  return { success: true };
}

export async function toggleDiscountCodeActive(
  id: string,
  isActive: boolean
): Promise<{ success: boolean; error?: string }> {
  return updateDiscountCode(id, { is_active: isActive });
}

/**
 * Hard-deletes the promo code row. Historical orders are unaffected: orders keep their own
 * discount_code text and discount_amount, and orders.discount_code_id is ON DELETE SET NULL.
 */
export async function deleteDiscountCode(id: string): Promise<{ success: boolean; error?: string }> {
  if (!(await hasAdminSession())) return { success: false, error: NO_SESSION_MESSAGE };

  const { data, error } = await adminSupabase
    .from('discount_codes')
    .delete()
    .eq('id', id)
    .select('id');

  if (error) return { success: false, error: error.message };
  if (!data || data.length === 0) {
    return { success: false, error: 'لم يتم حذف أي سجل. (Promo code not found or delete not permitted.)' };
  }
  return { success: true };
}

/**
 * Validates a promo code for checkout. Validation is performed by the database function
 * validate_discount_code (the same rules the order trigger enforces when the order is saved).
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

  const clean = inputCode.trim().toUpperCase().replace(/\s+/g, '');

  try {
    const { data, error } = await supabase.rpc('validate_discount_code', {
      p_code: clean,
      p_subtotal: subtotal
    });

    if (error || !data) {
      return {
        valid: false,
        discountAmount: 0,
        message: 'Could not validate this code right now. Please try again.'
      };
    }

    const res = data as { valid?: boolean; discount_amount?: number; message?: string };
    return {
      valid: !!res.valid,
      discountAmount: res.valid ? Number(res.discount_amount) || 0 : 0,
      message: String(res.message || '')
    };
  } catch {
    return {
      valid: false,
      discountAmount: 0,
      message: 'Could not validate this code right now. Please try again.'
    };
  }
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
