/**
 * src/lib/analytics.ts
 *
 * Lightweight analytics abstraction layer.
 * Supports GA4 (Google Analytics 4) out of the box via the global `gtag` function
 * injected by index.html when VITE_GA_MEASUREMENT_ID is set.
 *
 * All calls are NO-OPS when:
 *   - The user has not consented  (localStorage vbfits_consent !== 'accepted')
 *   - The GA4 measurement ID is absent
 *   - gtag is not yet loaded
 *
 * Usage:
 *   import { trackPageView, trackEvent } from './lib/analytics';
 *   trackPageView('/shop');
 *   trackEvent('add_to_cart', { currency: 'USD', value: 195, item_id: 'vb-long-sleeve-black' });
 */

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    dataLayer?: any[];
  }
}

// ─── Consent guard ────────────────────────────────────────────────────────────

const CONSENT_KEY = 'vbfits_consent';

function hasConsent(): boolean {
  try {
    return localStorage.getItem(CONSENT_KEY) === 'accepted';
  } catch {
    return false;
  }
}

// ─── GA4 initialisation ───────────────────────────────────────────────────────

const GA_ID = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GA_MEASUREMENT_ID) || '';

/**
 * Dynamically injects the GA4 gtag.js script and configures the measurement ID.
 * Called once when the user grants consent (either on first visit or on later acceptance).
 * Safe to call multiple times — script injection is idempotent.
 */
export function initAnalytics(): void {
  if (!GA_ID) return;
  if (typeof window === 'undefined') return;
  if (document.getElementById('ga4-script')) return; // already injected

  // Bootstrap dataLayer
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };
  window.gtag('js', new Date());
  window.gtag('config', GA_ID, {
    send_page_view: false, // we fire page_view manually for SPA
    anonymize_ip: true
  });

  const script = document.createElement('script');
  script.id = 'ga4-script';
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(script);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fire a page_view event. Call this on every route change in ScrollToTop.
 */
export function trackPageView(path: string): void {
  if (!hasConsent()) return;
  if (typeof window === 'undefined') return;

  // GA4
  if (window.gtag && GA_ID) {
    window.gtag('event', 'page_view', {
      page_path: path,
      page_location: window.location.href,
      page_title: document.title
    });
  }
}

/**
 * Fire a named event with optional parameters.
 *
 * Standard GA4 ecommerce events (use these names for auto-reporting):
 *   'add_to_cart'       — item added to cart
 *   'remove_from_cart'  — item removed from cart
 *   'begin_checkout'    — user proceeds to checkout
 *   'purchase'          — successful order placed
 *   'view_item'         — product detail page viewed
 *   'search'            — search overlay used
 *   'sign_up'           — new account created
 *   'login'             — user logged in
 */
export function trackEvent(name: string, params?: Record<string, any>): void {
  if (!hasConsent()) return;
  if (typeof window === 'undefined') return;

  // GA4
  if (window.gtag) {
    window.gtag('event', name, params ?? {});
  }
}

// ─── Convenience wrappers for common ecommerce events ─────────────────────────

export function trackAddToCart(item: {
  id: string;
  name: string;
  price: number;
  quantity: number;
  currency?: string;
}): void {
  trackEvent('add_to_cart', {
    currency: item.currency || 'USD',
    value: item.price * item.quantity,
    items: [{ item_id: item.id, item_name: item.name, price: item.price, quantity: item.quantity }]
  });
}

export function trackBeginCheckout(params: {
  value: number;
  currency?: string;
  itemCount: number;
}): void {
  trackEvent('begin_checkout', {
    currency: params.currency || 'USD',
    value: params.value,
    num_items: params.itemCount
  });
}

export function trackPurchase(params: {
  orderId: string;
  value: number;
  currency?: string;
  items: Array<{ id: string; name: string; price: number; quantity: number }>;
}): void {
  trackEvent('purchase', {
    transaction_id: params.orderId,
    currency: params.currency || 'USD',
    value: params.value,
    items: params.items.map((i) => ({
      item_id: i.id,
      item_name: i.name,
      price: i.price,
      quantity: i.quantity
    }))
  });
}

export function trackViewItem(item: { id: string; name: string; price: number; currency?: string }): void {
  trackEvent('view_item', {
    currency: item.currency || 'USD',
    value: item.price,
    items: [{ item_id: item.id, item_name: item.name, price: item.price }]
  });
}

export function trackSearch(searchTerm: string): void {
  trackEvent('search', { search_term: searchTerm });
}
