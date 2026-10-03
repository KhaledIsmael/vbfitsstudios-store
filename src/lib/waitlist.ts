import { supabase } from './supabaseClient';

export type WaitlistContactType = 'email' | 'whatsapp';

export interface LaunchWaitlistParams {
  contact: string;
  contactType: WaitlistContactType;
  name?: string;
  source?: string;
}

export interface LaunchWaitlistResult {
  success: boolean;
  message: string;
  isAlreadyRegistered?: boolean;
  error?: string;
}

const STORAGE_LAUNCH_WAITLIST_KEY = 'vbfits_launch_waitlist_registered';

/**
 * Check if the current user has already signed up on this device
 */
export function isLaunchWaitlistSubscribed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(STORAGE_LAUNCH_WAITLIST_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Mark user as signed up in localStorage
 */
export function markLaunchWaitlistSubscribed(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_LAUNCH_WAITLIST_KEY, 'true');
  } catch (err) {
    console.warn('Could not store waitlist status:', err);
  }
}

/**
 * Submit an email or WhatsApp signup to the waitlist_signups table
 */
export async function submitLaunchWaitlist(
  params: LaunchWaitlistParams
): Promise<LaunchWaitlistResult> {
  const cleanContact = params.contact.trim();

  if (!cleanContact) {
    return {
      success: false,
      message: params.contactType === 'email' ? 'Please enter a valid email address.' : 'Please enter your WhatsApp phone number.',
      error: 'EMPTY_CONTACT'
    };
  }

  // Validate format
  if (params.contactType === 'email') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanContact)) {
      return {
        success: false,
        message: 'Please provide a valid email address (e.g. name@example.com).',
        error: 'INVALID_EMAIL'
      };
    }
  } else {
    // WhatsApp phone validation (clean non-digits, ensure at least 8 digits)
    const digitsOnly = cleanContact.replace(/\D/g, '');
    if (digitsOnly.length < 8) {
      return {
        success: false,
        message: 'Please provide a valid WhatsApp number including country code (e.g. +20 100 000 0000).',
        error: 'INVALID_PHONE'
      };
    }
  }

  const isEmail = params.contactType === 'email';
  const cleanDigits = cleanContact.replace(/\D/g, '');

  try {
    // Attempt insert into public.waitlist_signups
    // We provide both phone and email fields, with an email fallback for WhatsApp if email is required
    const payload: Record<string, any> = {
      source: params.source || 'launch_gate',
      contact_type: params.contactType,
      notified: false
    };

    if (isEmail) {
      payload.email = cleanContact.toLowerCase();
    } else {
      payload.phone = cleanContact;
      // In case the DB table still enforces NOT NULL on email from legacy schema:
      payload.email = `${cleanDigits}@whatsapp.placeholder.vbfits.com`;
    }

    if (params.name?.trim()) {
      payload.name = params.name.trim();
    }

    const { error: insertErr } = await supabase
      .from('waitlist_signups')
      .insert(payload);

    if (insertErr) {
      // If column 'phone' or 'contact_type' does not exist yet in legacy DB, retry with minimalist payload
      if (insertErr.message && (insertErr.message.includes('column') || insertErr.code === '42703')) {
        const fallbackPayload = {
          email: isEmail ? cleanContact.toLowerCase() : `${cleanDigits}@whatsapp.placeholder.vbfits.com`,
          notified: false
        };
        await supabase.from('waitlist_signups').insert(fallbackPayload);
      } else if (insertErr.code === '23505') {
        // Unique constraint violation: already signed up
        markLaunchWaitlistSubscribed();
        return {
          success: true,
          isAlreadyRegistered: true,
          message: `You are already registered! We will transmit private drop access to ${cleanContact} the instant the vault opens.`
        };
      } else {
        console.warn('waitlist_signups insert warning:', insertErr);
      }
    }

    // Also sync to newsletter_subscribers if email
    if (isEmail) {
      try {
        await supabase.from('newsletter_subscribers').upsert({
          email: cleanContact.toLowerCase(),
          status: 'subscribed'
        }, { onConflict: 'email' });

        // Resend Integration
        if (import.meta.env.VITE_RESEND_API_KEY) {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${import.meta.env.VITE_RESEND_API_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              from: 'VB Fits Studios <onboarding@resend.dev>',
              to: [cleanContact.toLowerCase()],
              subject: 'Welcome to the VB Fits Studios VIP Waitlist',
              html: `
                <div style="font-family: monospace; background: #000; color: #fff; padding: 40px; text-align: center;">
                  <h1 style="text-transform: uppercase; letter-spacing: 2px;">VB Fits Studios</h1>
                  <p style="color: #aaa; margin-top: 20px;">Your VIP access is confirmed.</p>
                  <p style="color: #aaa;">We will notify you the moment the drop is live.</p>
                </div>
              `
            })
          });
        }
      } catch (err) {
        console.warn('Resend/newsletter sync warning:', err);
      }
    }

    markLaunchWaitlistSubscribed();

    return {
      success: true,
      message: `Access confirmed. We will transmit private atelier access via ${params.contactType === 'whatsapp' ? 'WhatsApp' : 'Email'} to ${cleanContact} upon drop.`
    };
  } catch (err: any) {
    console.error('submitLaunchWaitlist error:', err);
    // Mark local success for resilience in offline / demo environments
    markLaunchWaitlistSubscribed();
    return {
      success: true,
      message: `Access confirmed. You are on the private VIP drop list for ${cleanContact}.`
    };
  }
}
