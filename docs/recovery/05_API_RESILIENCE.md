# 05 — Selective Supabase Read Optimization & Safe Failure Handling Report
**VB FITS STUDIOS · `fix/egress-reliability` · Recovery Phase 5**  
_Date: 2026-11-24 · Status: **Verified with 85 unit tests & production build; zero production changes applied**_

---

## 1. Executive Summary

This phase targets the elimination of redundant and repeating Supabase API calls across the shopping funnel while establishing strict safety guarantees during Supabase service disruptions (e.g., HTTP 402 Payment Required / Egress Quota Exceeded, HTTP 429 Rate Limiting, HTTP 503 Outages, and network disconnects).

### Core Principles Enforced
1. **Never Hide Outages with Misleading Fallbacks:** Stale prices, stock levels, checkout permissions, or launch gates must **never** be treated as authoritative. If Supabase is down, the storefront displays an explicit, transparent degradation/maintenance banner (`OutageBanner`) and blocks order submission when totals/stock cannot be verified with the server.
2. **Selective Public Read Optimization:** Only public, immutable/read-mostly data (`products`, `categories`, `site_settings`, `store_settings`, `hero_banners`) receives in-flight deduplication and bounded, short TTL caching (15s–60s).
3. **No Auth/Personalized Cache Leaks:** Scoped isolation ensures customer data (orders, addresses, returns, cart items) is never stored in a shared public cache. The cache scope is cleared and rebound on auth identity changes (`setPublicReadScope`).
4. **Immediate Admin Invalidation:** Any admin mutation (`updateAdminProduct`, `archiveAdminProduct`, `updateInventory`, `updateHeroBanner`, `updateSiteSettings`) immediately busts public cache entries so changes reflect on the frontend instantly.
5. **No False-Success Payment Confirmations:** Payment callback polling (`PaymentCallbackPage`) replaces unbounded `setInterval` loops with bounded exponential backoff (45-second budget) and strictly validates authoritative server terminal states (`paid` / `completed`).
6. **Preservation of User Input:** When an outage is detected, customer cart contents, form inputs, and checkout state are preserved in local storage and form state so users do not lose their work.

---

## 2. Request Count Comparison (Before vs. After)

All counts are strictly measured via identical simulated customer journeys in `src/__tests__/request-counts.test.ts` running against a mock Supabase transport.

| Journey | Baseline Requests (`de59b2e`) | Optimized Requests (`fix/egress-reliability`) | Delta | Key Factor |
|---|---|---|---|---|
| **Cold Landing Page (`/`)** | 4 calls (`site_settings: 1`, `hero_banners: 1`, `products: 1`, `store_settings: 1`) | 4 calls (`site_settings: 1`, `hero_banners: 1`, `products: 1`, `store_settings: 1`) | **0%** (Baseline optimal) | Cold start must fetch all 4 public configs once. |
| **Cold Shop + 3 Filter Changes** | 9 calls (`categories: 1`, `products: 4`, `store_settings: 4`) | 3 calls (`categories: 1`, `products: 1`, `store_settings: 1`) | **-66.7%** (6 requests saved) | Filter changes now filter against cached base products in-memory instead of firing round-trips to Supabase for every click. |
| **Cold Product Detail Page (PDP)** | 4 calls (`products: 2`, `store_settings: 2`) | 3 calls (`products: 2`, `store_settings: 1`) | **-25.0%** (1 request saved) | Parallelized read and deduplication of `store_settings`. |
| **Warm Session (`/` -> `/shop` -> `/product`)** | 11 calls (`landing: 4`, `shop_added: 3`, `pdp_added: 4`) | 6 calls (`landing: 4`, `shop_added: 1`, `pdp_added: 1`) | **-45.5%** (5 requests saved) | Short TTL reuse: `/shop` only fetches categories; PDP only fetches specific product slug. Base catalog & settings reused from cache. |

---

## 3. Public Read Caching Matrix

| Entity | Function / API | TTL | Scope | Invalidation Triggers | Degraded / Outage Behavior |
|---|---|---|---|---|---|
| **Catalog Overrides** | `fetchCloudCatalogOverrides()` | 30s | Global / Public | `updateAdminProduct`, `archiveAdminProduct`, `adminCreateProduct`, `restoreAdminProduct` | In degraded state, uses local override or fallback; flagged as degraded; never authorizes stale prices for checkout. |
| **Base Products** | `getProducts()` | 30s | Global / Public | Same as Catalog Overrides | In-flight deduplication via `publicRead`. |
| **Single Product** | `getProductById(id)`, `getProductBySlug(slug)` | 30s | Global / Public | Same as Catalog Overrides | Deduped; cached per ID/slug key. |
| **Hero Banners** | `getHeroBanners()` | 60s | Global / Public | `createHeroBanner`, `updateHeroBanner`, `deleteHeroBanner`, `reorderHeroBanners` | Deduped; returns local fallback if network fails. |
| **Site Settings** | `getSiteSettings()` | 30s | Global / Public | `updateSiteSettings()` | Short versioned TTL. If unconfirmed during outage, launch gate fails open to maintenance message. |
| **Customer Orders** | `getUserOrders(customerId)` | **0s (No Cache)** | Scoped to `customerId` | Always live | Filtered strictly by authenticated `customer_id`. Never placed in shared public cache. |
| **Order Placement / Stock Check** | `createOrder()`, `verifyStock()` | **0s (No Cache)** | Server Authoritative | Bypasses all client caches | Strictly rejects order placement if server returns 402/429/503 or fails to confirm totals. |
| **Payment Status Check** | `getOrderByPaymentIntent()` | **0s (No Cache)** | Transaction / Order | Polled with backoff | Bounded 45s exponential backoff (`pollWithBackoff`). No false positive confirmations. |

---

## 4. Outage Detector & Resilience Architecture

### 4.1 Central Detector (`src/lib/outage.ts`)
- **Status Classification:**
  - `quota_exceeded`: HTTP 402 Payment Required (e.g. Supabase Free Tier egress cap hit).
  - `rate_limited`: HTTP 429 Too Many Requests.
  - `service_unavailable`: HTTP 503 Service Unavailable / Cloudflare 52x / Postgres connection pool exhaustion.
  - `network_down`: Network failure, connection refused, or fetch aborts.
- **Detector Invariants:**
  - Does **NOT** assume Supabase client can be globally monkey-patched.
  - Does **NOT** block privileged auth recovery, order status tracking, or admin repair endpoints with a client-only circuit breaker.
  - Dedupes user-facing notifications; maintains a cooldown window (5s) for repeated noncritical public queries.
  - Uses `useSyncExternalStore` in `src/hooks/useOutageState.ts` for tear-free React updates.

### 4.2 Bounded Read Cache (`src/lib/publicReadCache.ts`)
- Bounded LRU cache (max 100 entries) preventing memory leaks.
- In-flight promise sharing (`pendingRequests` Map) eliminates thundering herds when multiple components mount concurrently.
- Respects `AbortSignal` for caller cancellation when components unmount.
- During active outages, prevents burst retries by serving fresh failures immediately during the cooldown period.

### 4.3 Safe Payment Verification Polling (`src/lib/pollWithBackoff.ts`)
- Replaces naive 2-second `setInterval` loops with jittered exponential backoff:
  - Initial delay: 1,500ms
  - Multiplier: 1.5x
  - Maximum delay: 6,000ms
  - Total hard deadline: 45,000ms
- Evaluates predicate `isTerminal(order)` (`paid`, `failed`, `cancelled`). If timeout is reached, the transaction is marked pending/unconfirmed; it **never** fakes an order confirmation.

### 4.4 Real Server Connectivity Probe (`src/lib/connectivity.ts`)
- On user click ("Retry Connection" / "Re-check"), performs a lightweight probe (`head` or `limit(1)` select).
- If successful, resets outage state, invalidates cached public reads, and wakes the application up without requiring a full browser refresh.

### 4.5 User Experience during Degraded / Outage Modes
- **Global `OutageBanner`:** Top-level non-intrusive alert indicating exact server status ("Store operating in offline read mode. Live inventory and checkout are temporarily paused.").
- **Checkout Protection (`CheckoutPage.tsx`):**
  - Displays a transparent pause banner.
  - Disables the "Place Order" button if Supabase is in an active quota exceeded (402) or outage state.
  - Preserves all cart items, selected payment method, address fields, and customer contact info.

---

## 5. Security & Migration Safety Guard

### Quarantined Migration Notice
During the audit of Phase 3 and Phase 5, migration `20261124000046_rls_security_hardening.sql` was found to tighten `orders` and `order_items` RLS policies without prior implementation of guest-compatible SECURITY DEFINER RPCs for order creation.
- **Action Taken:** Safely moved from `supabase/migrations/` to `supabase/pending/20261124000046_rls_security_hardening.sql`.
- **Reason:** Applying it directly would break anonymous guest checkout because direct `INSERT INTO orders ... RETURNING *` would fail under the strict RLS customer check.
- **Status:** Preserved for the dedicated RPC transition phase. Zero database migrations were applied to live Supabase.

---

## 6. File-Level Change Summary

| Path | Nature of Change | Purpose |
|---|---|---|
| `src/lib/outage.ts` | **New** | Central outage detector (`detectOutage`), listener registry, and status tracker. |
| `src/lib/publicReadCache.ts` | **New** | Bounded LRU in-memory cache with in-flight request deduplication and scope binding. |
| `src/lib/pollWithBackoff.ts` | **New** | Exponential backoff polling utility with total timeout budget for payment verification. |
| `src/lib/connectivity.ts` | **New** | Server health probe and recovery trigger. |
| `src/hooks/useOutageState.ts` | **New** | React hook utilizing `useSyncExternalStore` for reactive UI updates. |
| `src/components/ui/OutageBanner.tsx` | **New** | User-facing outage status banner with manual retry trigger. |
| `src/lib/products.ts` | **Modified** | Cached and deduped catalog queries; short 30s TTL; in-memory filtering for `/shop`. |
| `src/lib/adminProducts.ts` | **Modified** | Admin mutations call `invalidatePublicReads()` on catalog keys. |
| `src/lib/adminInventory.ts` | **Modified** | Inventory adjustments trigger catalog cache invalidation. |
| `src/lib/heroBanners.ts` | **Modified** | Banner reads cached (60s TTL); banner mutations trigger cache invalidation. |
| `src/lib/siteSettings.ts` | **Modified** | Site settings cached with 30s TTL and transparent degradation tracking. |
| `src/lib/orders.ts` | **Modified** | Added memoization for `linkPastOrdersToCustomer` to prevent repetitive RPC calls. |
| `src/pages/PaymentCallbackPage.tsx` | **Modified** | Migrated from fixed interval to `pollWithBackoff`; strict terminal state check. |
| `src/pages/CheckoutPage.tsx` | **Modified** | Outage-aware submission pause; input preservation; live availability check. |
| `src/App.tsx` | **Modified** | Globally mounted `<OutageBanner />` above navigation bar. |
| `src/context/AuthContext.tsx` | **Modified** | Added `setPublicReadScope(user.id)` to prevent cross-user cache leakage. |
| `src/__tests__/request-counts.test.ts` | **New** | Automated suite measuring exact request counts across cold & warm journeys. |
| `src/__tests__/api-resilience.test.ts` | **New** | Automated test suite validating cache invalidation, deduping, backoff, and outage detection. |
| `supabase/pending/20261124000046_...` | **Moved** | Quarantined strict RLS migration to prevent breaking guest checkouts. |

---

## 7. Verification Results

- **Unit & Integration Tests:** 5 test files, **85 passed (85 total)**:
  - `request-counts.test.ts`: 5 passed
  - `checkout-reliability.test.ts`: 29 passed
  - `api-resilience.test.ts`: 39 passed
  - `rls-security-code.test.ts`: 4 passed
  - `image-egress.test.ts`: 8 passed
- **TypeScript Static Verification:** `tsc --noEmit` exited **0** (clean, zero type errors).
- **Vite Production Build:** `npm run build` completed cleanly in **3.39s** (`dist/` generated without warnings).

---

## 8. Rollout & Rollback Plan

### Rollout Procedure (Frontend Only)
1. Verify branch `fix/egress-reliability` cleanly merges into deployment branch.
2. Ensure Vercel or hosting platform runs `npm run build` and tests pass.
3. Deploy frontend bundle.

### Rollback Procedure
1. Revert to previous frontend commit (`git revert HEAD`).
2. Public read cache and outage detector are fully client-side and ephemeral; rolling back the frontend returns immediately to previous direct-fetch behavior with zero database state to clean up.
