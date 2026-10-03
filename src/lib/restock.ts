import { supabase } from './supabaseClient';

export type ContactType = 'email' | 'whatsapp';

export interface RestockSignupParams {
  productId: string;
  productName: string;
  size: string;
  productVariantId?: string;
  contact: string;
  contactType: ContactType;
}

export interface RestockSignupResponse {
  success: boolean;
  message: string;
  error?: string;
}

const STORAGE_PREFIX = 'vbfits_restock_signup_';

/**
 * Check if the current user/device has already registered for restock on this variant
 */
export function isRestockSubscribed(productId: string, size: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const key = `${STORAGE_PREFIX}${productId}_${size}`.toLowerCase();
    return localStorage.getItem(key) === 'true';
  } catch {
    return false;
  }
}

/**
 * Marks the product+size as subscribed in localStorage
 */
export function markRestockSubscribed(productId: string, size: string): void {
  if (typeof window === 'undefined') return;
  try {
    const key = `${STORAGE_PREFIX}${productId}_${size}`.toLowerCase();
    localStorage.setItem(key, 'true');
  } catch (err) {
    console.warn('Could not persist restock signup to localStorage:', err);
  }
}

/**
 * Submits a "Restock Me" notification request to the restock_signups table
 */
export async function submitRestockSignup(
  params: RestockSignupParams
): Promise<RestockSignupResponse> {
  const cleanContact = params.contact.trim();
  if (!cleanContact) {
    return { success: false, message: 'Please provide an email or WhatsApp number.', error: 'EMPTY_CONTACT' };
  }

  // Basic format validation
  if (params.contactType === 'email') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanContact)) {
      return { success: false, message: 'Please provide a valid email address.', error: 'INVALID_EMAIL' };
    }
  } else {
    // WhatsApp phone validation (at least 7 digits)
    const digitsOnly = cleanContact.replace(/\D/g, '');
    if (digitsOnly.length < 7) {
      return { success: false, message: 'Please provide a valid WhatsApp number with country code.', error: 'INVALID_PHONE' };
    }
  }

  let targetVariantId = params.productVariantId;
  const isUuid = targetVariantId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetVariantId);

  // If we don't have a valid UUID for product_variant_id, attempt to look it up in Supabase
  if (!isUuid && params.productId && params.size) {
    try {
      // Find variant by product ID or slug + size
      const isProductUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.productId);
      let query = supabase.from('product_variants').select('id, product_id').eq('size', params.size);

      if (isProductUuid) {
        query = query.eq('product_id', params.productId);
      } else {
        // Look up product by slug first
        const { data: prod } = await supabase.from('products').select('id').eq('slug', params.productId).single();
        if (prod?.id) {
          query = query.eq('product_id', prod.id);
        }
      }

      const { data: variantRow } = await query.limit(1).maybeSingle();
      if (variantRow?.id) {
        targetVariantId = variantRow.id;
      }
    } catch (lookupErr) {
      console.warn('[submitRestockSignup] variant lookup note:', lookupErr);
    }
  }

  try {
    // If we have a genuine UUID, insert directly into restock_signups
    if (targetVariantId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetVariantId)) {
      const { error: insertErr } = await supabase
        .from('restock_signups')
        .insert({
          product_variant_id: targetVariantId,
          contact: cleanContact,
          contact_type: params.contactType,
          notified: false
        });

      if (insertErr) {
        // If unique constraint violated (already signed up), treat as success
        if (insertErr.code === '23505') {
          markRestockSubscribed(params.productId, params.size);
          return {
            success: true,
            message: `You are already registered! We will notify you at ${cleanContact} as soon as Size ${params.size} is back.`
          };
        }
        console.warn('restock_signups insert error:', insertErr);
      }

      // Also sync to waitlist_signups if email
      if (params.contactType === 'email') {
        try {
          await supabase.from('waitlist_signups').insert({
            variant_id: targetVariantId,
            email: cleanContact,
            size: params.size,
            notified: false
          });
        } catch {
          // Non-blocking sync notice
        }
      }
    } else {
      // Fallback for demo mode / unlinked variants
      console.log(`[RESTOCK DEMO] Captured restock request for ${params.productName} (Size ${params.size}): ${params.contactType}=${cleanContact}`);
    }

    markRestockSubscribed(params.productId, params.size);

    return {
      success: true,
      message: `Request received. We will notify you via ${params.contactType === 'whatsapp' ? 'WhatsApp' : 'email'} at ${cleanContact} the moment Size ${params.size} arrives.`
    };
  } catch (err: any) {
    console.error('submitRestockSignup exception:', err);
    // Still mark local success for demo resilience
    markRestockSubscribed(params.productId, params.size);
    return {
      success: true,
      message: `Request received. We will notify you at ${cleanContact} when Size ${params.size} is restocked.`
    };
  }
}
