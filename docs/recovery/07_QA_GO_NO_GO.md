# 07 — QA Verification, Release Runbook & GO / NO-GO Verdict
**VB FITS STUDIOS · `fix/egress-reliability` · Recovery Phase 7 (Final QA & Release Gate)**  
_Date: 2026-11-24 · Role: QA & Release Lead · Production Status: **UNTOUCHED (Zero deployments, zero live SQL migrations, zero live payment calls)**_

---

## 1. Executive Release Verdict

> [!IMPORTANT]
> ### **VERDICT: CONDITIONAL GO (Frontend & Serverless Bundle) / NO-GO (Direct Live Application of Strict `orders` RLS Migration `000046` Without Guest Checkout RPCs & Backup Restore Drill)**
>
> 1. **Application Code & Build (`fix/egress-reliability`): GO FOR VERCEL PREVIEW & FRONTEND/SERVERLESS DEPLOYMENT**
>    - All **102 automated unit/integration/security tests across 7 test suites pass (`102/102 PASS`, `0 FAIL`)**.
>    - TypeScript (`tsc --noEmit`) and production Vite build (`vite build`) pass with **0 errors**.
>    - Checkout false-success prevention, Paymob webhook HMAC/idempotency/out-of-order guards, image transformation plan gating, multi-width WebP delivery, bounded public read caching (`-45.5%` to `-66.7%` Supabase queries), outage detection (`OutageBanner`), PII log scrubbing, and compiled bundle secret isolation are verified.
> 2. **Database & Storage Migrations (`supabase/pending/`): HOLD / GATED**
>    - **`20261124000045_order_idempotency_key.sql`** (additive `client_request_id` column + partial unique index) and **`20261124000047_storage_policy_hardening.sql`** (restricting `storage.objects` directory listing to staff while keeping public CDN `GET` open) are safe additive/storage-list changes **after** the isolated backup restore drill is completed.
>    - **`20261124000046_rls_security_hardening.sql` is a NO-GO for immediate standalone execution** until a `SECURITY DEFINER` guest checkout RPC (`create_guest_order`) is deployed, because tightening `orders` `SELECT` RLS while `createOrder()` still relies on direct `.from('orders').insert(...).select().single()` as `anon` would break anonymous guest checkout (`INSERT ... RETURNING` requires `SELECT` visibility).
> 3. **Backup Restore Verification: GATED PREREQUISITE**
>    - Although `d:\VBFITS-Backup\vbfits_full_backup.dump` (PostgreSQL 17.11 custom dump, 882 TOC entries) and `d:\VBFITS-Backup\storage\product-media\` (93 files, 77.09 MB) exist on disk, **the database dump has NOT been restore-tested into an isolated instance**. No live DDL/RLS migration may be executed until the isolated restore drill (§7.3) succeeds.

### Overall Verification Summary Counts

| Category | Passed | Failed | Blocked / Gated (External Env Required) | Total |
|---|---:|---:|---:|---:|
| **Automated Unit & Behavioral Integration Tests (Vitest)** | **102** | **0** | 0 | **102** |
| **Static Quality Gates (`tsc --noEmit`, `vite build`, Bundle Secret Audit)** | **3** | **0** | 1 (`npm run lint` script not configured in `package.json`) | **4** |
| **Live Browser / Staging / Backup Restore Checks** | **0** | **0** | **5** (Isolated DB restore drill, Live Supabase RLS multi-actor staging run, Live Vercel Preview URL deploy, Live Lighthouse mobile run, Live HTTP header `curl -I` probe) | **5** |

---

## 2. Quality Gates Execution & Evidence

All commands below were executed in the workspace on branch `fix/egress-reliability`. Only checks with real captured outputs are reported as executed.

### 2.1 Dependency & Environment Gate
- **Node Modules Integrity:** `node_modules/` present with `@supabase/supabase-js@^2.116.0`, `react@^19.3.0`, `vite@^8.3.0`, `typescript@^7.0.2`, `vitest@^5.1.1`, `sharp@^0.35.4`.
- **Lint Script Check:** Inspected [package.json](file:///d:/vbfitsstudios-store-main/package.json#L5-L15) — no `lint` or `eslint` script is defined in `package.json` (pre-existing repository state; TypeScript strict compiler check `tsc --noEmit` serves as the static analysis gate).

### 2.2 TypeScript Static Analysis (`tsc --noEmit`)
- **Command:** `node node_modules/typescript/bin/tsc --noEmit`
- **Result:** **PASS** (Exit code `0`, 0 errors).

### 2.3 Production Bundle Build (`npm run build`)
- **Command:** `npm run build` (`tsc && vite build`)
- **Result:** **PASS** (`2621 modules transformed`, built in `3.59s`, exit code `0`).
- **Key Compiled Output Artifacts (`dist/`):**
  - `dist/index.html` — `3.36 kB` (gzip: `1.26 kB`)
  - `dist/assets/index-BcVfUKfO.css` — `109.37 kB` (gzip: `18.30 kB`)
  - `dist/assets/outage-aZjH81pB.js` — `3.60 kB` (gzip: `1.35 kB`)
  - `dist/assets/PaymentCallbackPage-DR3DKnus.js` — `8.47 kB` (gzip: `2.79 kB`)
  - `dist/assets/orders-h_UYZT1e.js` — `15.41 kB` (gzip: `5.01 kB`)
  - `dist/assets/ShopPage-C8-6ACFd.js` — `28.03 kB` (gzip: `7.03 kB`)
  - `dist/assets/CheckoutPage-BAZhHzBj.js` — `33.90 kB` (gzip: `8.30 kB`)
  - `dist/assets/ProductDetailPage-DFLW1Hc4.js` — `38.69 kB` (gzip: `10.27 kB`)
  - `dist/assets/index-CabM9Ufx.js` — `272.92 kB` (gzip: `81.73 kB`)

### 2.4 Automated Unit & Behavioral Integration Suite (`vitest run`)
- **Command:** `node node_modules/vitest/vitest.mjs run src/__tests__`
- **Result:** **PASS — 7 test files passed, 102 tests passed (0 failures) in 1.69s**

| Test Suite File | Tests | Status | Behavioral Scope |
|---|---:|---|---|
| [checkout-reliability.test.ts](file:///d:/vbfitsstudios-store-main/src/__tests__/checkout-reliability.test.ts) | 29 | **PASS** | `classifyOrderError`, `isAmbiguousInsertFailure`, `createOrder` success/failure/orphan auto-cancel, `23505` idempotency lookup, false-success guard, 402/429/503 retry suppression |
| [api-resilience.test.ts](file:///d:/vbfitsstudios-store-main/src/__tests__/api-resilience.test.ts) | 39 | **PASS** | `detectOutage`, `publicReadCache` LRU/TTL/in-flight deduplication/cooldown/AbortSignal, `pollWithBackoff` 45s cap, admin cache invalidation, `getSiteSettings` non-authoritative degradation, `probeConnectivity` |
| [qa-functional-release.test.ts](file:///d:/vbfitsstudios-store-main/src/__tests__/qa-functional-release.test.ts) | 13 | **PASS** | Paymob webhook (failure, duplicate idempotency, out-of-order downgrade guard, bad HMAC + PII log exclusion), `createOrder` null tracking, `lookupOrderForGuest` cross-guest block, auth cache scope isolation, 14-day return window, catalog sort/filter, 402 recovery, compiled `dist/assets/*.js` secret scan |
| [image-egress.test.ts](file:///d:/vbfitsstudios-store-main/src/__tests__/image-egress.test.ts) | 8 | **PASS** | Free-Plan transformation gate (`SUPABASE_IMAGE_TRANSFORMS_ENABLED === false`), `/render/image/` normalization back to `/object/public/`, multi-width WebP `srcset`, private `return-photos` exclusion, loop-safe `createSafeImageErrorHandler` |
| [request-counts.test.ts](file:///d:/vbfitsstudios-store-main/src/__tests__/request-counts.test.ts) | 5 | **PASS** | Cold landing (4 calls), cold shop + 3 filter changes (3 calls), cold PDP (3 calls), warm `/` -> `/shop` -> `/product` journey (6 calls) |
| [rls-security-code.test.ts](file:///d:/vbfitsstudios-store-main/src/__tests__/rls-security-code.test.ts) | 4 | **PASS** | `linkPastOrdersToCustomer` RPC usage, `getUserOrders` strictly `.eq('customer_id', customerId)` without guest table scan, `lookupGuestOrder` RPC, webhook HTTP 500 fail-closed without service-role key |
| [storage-polish.test.ts](file:///d:/vbfitsstudios-store-main/src/__tests__/storage-polish.test.ts) | 4 | **PASS** | Relative storage path fallback without hardcoded production Supabase host, WebP binary magic-byte header verification (`RIFF....WEBP`), `vercel.json` CORS regex route matching, Paymob webhook note preservation |

---

## 3. Issue Closure Matrix (Reports `00` through `06`)

| ID / Report | Finding Summary | Resolution & Evidence Links | Verification Status |
|---|---|---|---|
| **01 / Finding 3.2** ([01_CHECKOUT_FIX.md](file:///d:/vbfitsstudios-store-main/docs/recovery/01_CHECKOUT_FIX.md)) | Checkout failure cleared cart and navigated to `/order-confirmation` (false success) | `clearCart()` and `navigate()` gated strictly behind `if (error \|\| !order?.id) return;` in [CheckoutPage.tsx](file:///d:/vbfitsstudios-store-main/src/pages/CheckoutPage.tsx#L492-L520); double-submit blocked via `isSubmittingRef` | **PASS** (`checkout-reliability.test.ts`) |
| **01 / Finding 3.3** ([01_CHECKOUT_FIX.md](file:///d:/vbfitsstudios-store-main/docs/recovery/01_CHECKOUT_FIX.md)) | Duplicate orders on retry or schema fallback after network drop / 402 / 429 / 503 | Durable `sessionStorage` `client_request_id` per cart fingerprint; `isAmbiguousInsertFailure()` suppresses unsafe fallback inserts in [orders.ts](file:///d:/vbfitsstudios-store-main/src/lib/orders.ts#L533-L590) | **PASS** (`checkout-reliability.test.ts`) |
| **01 / Finding 3.4** ([01_CHECKOUT_FIX.md](file:///d:/vbfitsstudios-store-main/docs/recovery/01_CHECKOUT_FIX.md)) | `PaymentCallbackPage` trusted query param `payment_status=paid` without server check | Always polls server via `getOrderPaymentStatus()` with `pollWithBackoff()` (45s cap) in [PaymentCallbackPage.tsx](file:///d:/vbfitsstudios-store-main/src/pages/PaymentCallbackPage.tsx#L38-L108) | **PASS** (`api-resilience.test.ts`) |
| **03 / RLS-01..05, 08, 10, 11, 14** ([03_RLS_SECURITY.md](file:///d:/vbfitsstudios-store-main/docs/recovery/03_RLS_SECURITY.md)) | Live SQL verification confirmed `orders`, `order_items`, `cart_items`, `return_requests` guest exposure, `customers` role guard gap, `site_settings` anon grants, `product-media` legacy insert policy | Client scans removed in [orders.ts](file:///d:/vbfitsstudios-store-main/src/lib/orders.ts#L197-L246); webhook fails closed in [webhook.ts](file:///d:/vbfitsstudios-store-main/api/paymob/webhook.ts#L56-L70); SQL migrations staged in [20261124000046_rls_security_hardening.sql](file:///d:/vbfitsstudios-store-main/supabase/pending/20261124000046_rls_security_hardening.sql) | **CODE PASS / SQL QUARANTINED** (Pending guest checkout RPC) |
| **04 / Egress & Transforms** ([04_IMAGE_EGRESS.md](file:///d:/vbfitsstudios-store-main/docs/recovery/04_IMAGE_EGRESS.md)) | Paid `/storage/v1/render/image/public/` helpers unusable on Free Plan; raw multi-MB PNGs uploaded with 1h cache | Gated behind `VITE_SUPABASE_IMAGE_TRANSFORMATIONS=true` in [image.ts](file:///d:/vbfitsstudios-store-main/src/lib/image.ts#L21-L24); client WebP multi-width upload compression + `cacheControl: '31536000'` in [adminProducts.ts](file:///d:/vbfitsstudios-store-main/src/lib/adminProducts.ts#L418-L465); local `-480w`/`-800w` WebP variants generated | **PASS** (`image-egress.test.ts`) |
| **05 / API Resilience** ([05_API_RESILIENCE.md](file:///d:/vbfitsstudios-store-main/docs/recovery/05_API_RESILIENCE.md)) | Redundant Supabase queries on `/shop` filter clicks (9 calls) and warm navigation (11 calls); silent fallback hid 402/503 outages | Bounded LRU `publicReadCache` + in-memory shop filtering in [products.ts](file:///d:/vbfitsstudios-store-main/src/lib/products.ts#L510-L585); central detector [outage.ts](file:///d:/vbfitsstudios-store-main/src/lib/outage.ts) + global [OutageBanner.tsx](file:///d:/vbfitsstudios-store-main/src/components/ui/OutageBanner.tsx) | **PASS** (`request-counts.test.ts`, `api-resilience.test.ts`) |
| **06 / Storage & Safety Polish** ([06_STORAGE_POLISH.md](file:///d:/vbfitsstudios-store-main/docs/recovery/06_STORAGE_POLISH.md)) | Broad `storage.objects` `SELECT` policy, hardcoded Supabase URL fallback, invented `DHL-` tracking codes, overwritten Paymob notes, wildcard CORS on `/api/cron`, loose `admin@` prefix match | Proposed policy in [20261124000047_storage_policy_hardening.sql](file:///d:/vbfitsstudios-store-main/supabase/pending/20261124000047_storage_policy_hardening.sql); fallback fixed in [image.ts](file:///d:/vbfitsstudios-store-main/src/lib/image.ts#L123-L132); null tracking + `"Awaiting dispatch"`; idempotent note-preserving [webhook.ts](file:///d:/vbfitsstudios-store-main/api/paymob/webhook.ts#L140-L185); narrowed CORS in [vercel.json](file:///d:/vbfitsstudios-store-main/vercel.json#L31-L38) | **PASS** (`storage-polish.test.ts`, `qa-functional-release.test.ts`) |
| **07 / QA Bundle Secret Discovery** (Found during Phase 7 QA) | `src/lib/adminMarketing.ts` referenced `process.env.BREVO_API_KEY` and called `api.brevo.com/v3/contacts` from client bundle; console logs in email/SMS/webhook printed customer emails/phones/params | Removed browser-side `BREVO_API_KEY` block from [adminMarketing.ts](file:///d:/vbfitsstudios-store-main/src/lib/adminMarketing.ts#L295-L299); scrubbed PII from logs in [webhook.ts](file:///d:/vbfitsstudios-store-main/api/paymob/webhook.ts#L112-L116), [send-confirmation.ts](file:///d:/vbfitsstudios-store-main/api/email/send-confirmation.ts#L398), [abandoned-carts.ts](file:///d:/vbfitsstudios-store-main/api/cron/abandoned-carts.ts#L388), [restock-notify.ts](file:///d:/vbfitsstudios-store-main/api/email/restock-notify.ts#L223-L228), [restock.ts](file:///d:/vbfitsstudios-store-main/src/lib/restock.ts#L140), [sms.ts](file:///d:/vbfitsstudios-store-main/src/lib/sms.ts#L28) | **PASS** (`qa-functional-release.test.ts`) |

---

## 4. Functional Verification Matrix

All functional tests use synthetic fixtures (`guest.a@synthetic.test`, `VBF-77001`, `synthetic-paymob-hmac-secret-qa`) with zero calls to live Supabase or Paymob production endpoints.

| Functional Area | Test / Verification Method | Expected Behavior | Result |
|---|---|---|---|
| **Storefront Mobile & Desktop Assets** | Compiled `dist/assets/` byte verification + `getResponsiveSrcSet()` tests | Mobile (`480w`) receives `5.19 KB` hero & `6.55 KB`–`7.72 KB` product cards; desktop (`1280w`/`1376w`) receives `25.79 KB`–`34.53 KB` WebP; broken images swap once via `createSafeImageErrorHandler` | **PASS** |
| **Catalog, Sort & Filter** | `getFilteredProducts()` in `qa-functional-release.test.ts` & `request-counts.test.ts` | Filters by category, size, `inStockOnly`, price range, and sorts (`price-asc`, `price-desc`, `popularity`) in-memory over cached base catalog (0 extra Supabase calls per filter change) | **PASS** |
| **Auth & Cache Isolation** | `setPublicReadScope()` in `qa-functional-release.test.ts` & `api-resilience.test.ts` | Switching user identity (`customer-a` -> `customer-b` or logout) immediately flushes `publicReadCache` | **PASS** |
| **Admin Updates & Cache Invalidation** | `archiveAdminProduct()`, `updateSiteSettings()` in `api-resilience.test.ts` | Admin mutations immediately invalidate `catalog:*` / `settings:*` cache keys so storefront reads fresh data on next access | **PASS** |
| **Cart & Live Stock / Price Guard** | `CheckoutPage.tsx` live availability check + `checkout-reliability.test.ts` | Queries live `products` & `product_variants` before order submission; blocks checkout if price changed, product unpublished, stock insufficient, or server returns 402/429/503 | **PASS** |
| **Guest COD & Failed Checkout Persistence** | `createOrder()` in `checkout-reliability.test.ts` & `qa-functional-release.test.ts` | Valid COD returns confirmed `order.id` with `tracking_number: null`; failed insert preserves cart & form values, never navigates to `/order-confirmation`, auto-cancels orphan order if `order_items` fails | **PASS** |
| **Offline / Outage Banner & Retry** | `detectOutage()` + `probeConnectivity()` in `api-resilience.test.ts` & `qa-functional-release.test.ts` | 402/429/503/timeout activates `OutageBanner`; user retry button probes `store_settings` with 5s timeout and clears outage state only upon real server 200 response | **PASS** |
| **Paymob Webhook — Success** | `webhookHandler` in `storage-polish.test.ts` | Valid SHA-512 HMAC updates `payment_status = 'paid'`, preserves existing customer notes, triggers confirmation email | **PASS** |
| **Paymob Webhook — Failure** | `webhookHandler` in `qa-functional-release.test.ts` | Valid SHA-512 HMAC with `success: 'false'` updates `payment_status = 'failed'`, preserves notes, does not send confirmation email | **PASS** |
| **Paymob Webhook — Duplicate Replay** | `webhookHandler` in `qa-functional-release.test.ts` | Duplicate `paid` callback for same transaction ID does not duplicate note string and does not re-send confirmation email | **PASS** |
| **Paymob Webhook — Out-of-Order** | `webhookHandler` in `qa-functional-release.test.ts` | Late `failed` callback arriving after order is already `paid` never downgrades `payment_status` from `'paid'` to `'failed'` | **PASS** |
| **Paymob Webhook — Bad HMAC** | `webhookHandler` in `qa-functional-release.test.ts` | Tampered payload or wrong HMAC secret returns `HMAC_MISMATCH`, performs 0 DB writes, logs only `{ id, order }` without PAN/PII | **PASS** |
| **Order Confirmation & Tracking** | [OrderConfirmationPage.tsx](file:///d:/vbfitsstudios-store-main/src/pages/OrderConfirmationPage.tsx#L66-L67), [OrderTrackPage.tsx](file:///d:/vbfitsstudios-store-main/src/pages/OrderTrackPage.tsx#L369-L370), `lookupOrderForGuest()` | Displays `"Awaiting dispatch"` until real carrier tracking code exists; blocks Guest B from tracking Guest A's order when email/phone does not match | **PASS** |
| **Returns & Privacy Boundaries** | `isWithinReturnWindow()`, `createReturnRequest()`, `getUserOrders()` | Enforces 14-day return window; validates non-empty items; `getUserOrders(customerId)` queries strictly `.eq('customer_id', customerId)` and never scans `customer_id IS NULL` | **PASS** |

---

## 5. Security & Privacy Verification

### 5.1 Compiled Browser Bundle Secret Scan (`dist/assets/*.js`)
- **Automated Gate:** `Compiled Browser Bundle Security Gate` in [qa-functional-release.test.ts](file:///d:/vbfitsstudios-store-main/src/__tests__/qa-functional-release.test.ts#L593-L614) scans every `.js` file in `dist/assets/`.
- **Findings & Remediation:**
  - During the initial scan, `BREVO_API_KEY` was detected inside `dist/assets/index-*.js` originating from dead browser-side code in `src/lib/adminMarketing.ts`.
  - **Fixed:** Removed the client-side `process.env.BREVO_API_KEY` block from [src/lib/adminMarketing.ts](file:///d:/vbfitsstudios-store-main/src/lib/adminMarketing.ts#L295-L299) and rebuilt `dist/`.
  - **Re-verified:** All 46 compiled `.js` chunks in `dist/assets/` contain **zero** occurrences of `SUPABASE_SERVICE_ROLE_KEY`, `PAYMOB_HMAC_SECRET`, `PAYMOB_API_KEY`, `BREVO_API_KEY`, or `CRON_SECRET`.

### 5.2 PII Absence from Application & Serverless Logs
- Audited all `console.log`, `console.warn`, and `console.error` calls across `api/` and `src/lib/`.
- Removed raw customer email, phone number, and Paymob callback `{ params }` from log statements in:
  - [api/paymob/webhook.ts](file:///d:/vbfitsstudios-store-main/api/paymob/webhook.ts#L112-L116)
  - [api/email/send-confirmation.ts](file:///d:/vbfitsstudios-store-main/api/email/send-confirmation.ts#L398)
  - [api/cron/abandoned-carts.ts](file:///d:/vbfitsstudios-store-main/api/cron/abandoned-carts.ts#L388)
  - [api/email/restock-notify.ts](file:///d:/vbfitsstudios-store-main/api/email/restock-notify.ts#L223-L228)
  - [src/lib/restock.ts](file:///d:/vbfitsstudios-store-main/src/lib/restock.ts#L140)
  - [src/lib/sms.ts](file:///d:/vbfitsstudios-store-main/src/lib/sms.ts#L28)

### 5.3 Multi-Actor RLS Status (Anon, Guest A/B, Customer A/B, Admin)

| Actor Pair / Boundary | Application Code Status | Live Database RLS Status | Blocker / Next Step |
|---|---|---|---|
| **Customer A vs. Customer B (`orders`, `cart_items`, `addresses`, `return_requests`)** | **PASS** (`getUserOrders` filters `.eq('customer_id', customerId)`; cache cleared on auth change) | **PARTIAL** (`orders` and `order_items` live RLS still has `OR customer_id IS NULL` / `USING (true)` per user's SQL query A–H results) | Apply `000046` after Guest Checkout RPC is created |
| **Guest A vs. Guest B (`orders`, `order_items`, `return_requests`)** | **PASS** (`lookupOrderForGuest` verifies matching email/phone; `lookupGuestOrder` uses RPC) | **OPEN IN LIVE DB** (`RLS-01`, `RLS-02`, `RLS-04`, `RLS-05` confirmed `true` in live SQL check) | Deploy `create_guest_order` & `lookup_guest_order` RPCs, then apply `000046` |
| **Anon / Customer Privilege Escalation (`customers.role`, `site_settings`, `product-media`)** | **PASS** (`AdminAuthContext` removed loose `admin@` prefix match; requires DB session) | **OPEN IN LIVE DB** (`RLS-08`, `RLS-11`, `RLS-14` confirmed `true` in live SQL check) | Safe to apply `customers`, `site_settings`, and `storage.objects` sections of `000046` + `000047` after backup restore drill |

---

## 6. Performance & Egress Evaluation

### 6.1 Measured Local Asset Byte Totals (`dist/assets/`)

| Asset | Legacy Baseline Bytes | Optimized WebP Bytes (`dist/`) | Reduction | Delivery Role |
|---|---:|---:|---:|---|
| Hero Banner — Mobile (`hero-480w.webp` vs `hero.jpg`) | 587,887 B (574.1 KB) | **5,194 B (5.1 KB)** | **-99.1%** | Mobile LCP (`<= 480px`) |
| Hero Banner — Tablet (`hero-800w.webp` vs `hero.jpg`) | 587,887 B (574.1 KB) | **10,960 B (10.7 KB)** | **-98.1%** | Tablet (`<= 800px`) |
| Hero Banner — Desktop (`hero.webp` vs `hero.jpg`) | 587,887 B (574.1 KB) | **34,534 B (33.7 KB)** | **-94.1%** | Desktop (`1376w`) |
| Black Shirt — Mobile Card (`black-shirt-480w.webp` vs `.jpeg`) | 94,160 B (92.0 KB) | **6,548 B (6.4 KB)** | **-93.0%** | Product Card (`480w`) |
| Black Shirt — PDP (`black-shirt-800w.webp` vs `.jpeg`) | 94,160 B (92.0 KB) | **11,518 B (11.2 KB)** | **-87.8%** | PDP Gallery (`800w`) |
| White Shirt — Mobile Card (`white-shirt-480w.webp` vs `.jpeg`) | 115,358 B (112.7 KB) | **7,716 B (7.5 KB)** | **-93.3%** | Product Card (`480w`) |
| White Shirt — PDP (`white-shirt-800w.webp` vs `.jpeg`) | 115,358 B (112.7 KB) | **14,896 B (14.5 KB)** | **-87.1%** | PDP Gallery (`800w`) |

> [!NOTE]
> Local `/assets/*` files are served by **Vercel Edge CDN** and count as **0 bytes** of Supabase Storage cached egress.

### 6.2 Measured Supabase API Request Counts per Journey (`src/__tests__/request-counts.test.ts`)

| User Journey | Baseline Requests (`de59b2e`) | Post-Fix Requests (`fix/egress-reliability`) | Reduction |
|---|---:|---:|---:|
| **Cold Landing (`/`)** | 4 (`site_settings: 1, store_settings: 1, hero_banners: 1, products: 1`) | **4** (`site_settings: 1, store_settings: 1, hero_banners: 1, products: 1`) | **0%** |
| **Cold Shop + 3 Filter Changes (`/shop`)** | 9 (`categories: 1, products: 4, store_settings: 4`) | **3** (`categories: 1, products: 1, store_settings: 1`) | **-66.7%** |
| **Cold Product Detail Page (`/product/:slug`)** | 4 (`products: 2, store_settings: 2`) | **3** (`products: 2, store_settings: 1`) | **-25.0%** |
| **Warm Funnel (`/` -> `/shop` -> `/product/:slug`)** | 11 (`landing: 4, shop_added: 3, pdp_added: 4`) | **6** (`landing: 4, shop_added: 1, pdp_added: 1`) | **-45.5%** |

### 6.3 Projected Supabase Storage Cached Egress (1k / 10k / 50k Sessions)

- **Assumptions (stated separately from measured bytes):**
  - Average shopping session views 1 hero banner + 6 catalog product cards/gallery images.
  - **Current Live Storage State (81 legacy PNG/JPEG files in `product-media` untouched):** The 11 active product/hero/launch images in `product-media` average **1.80 MB** (`1,892,502 B`), with `cacheControl: '3600'` (1 hour). Assuming a 30% repeat-cache hit rate within the 1-hour TTL (~7.56 MB uncached Supabase transfer per session):
    - **1,000 sessions:** ~`7.56 GB` (**Exceeds 5 GB Free Plan quota**)
    - **10,000 sessions:** ~`75.6 GB`
    - **50,000 sessions:** ~`378.0 GB`
  - **After Re-Uploading the 11 Active Storefront Images via Admin Editor (using new multi-width WebP compression `~35 KB` mobile / `~95 KB` desktop + `cacheControl: '31536000'`):** Assuming ~`320 KB` first-visit Supabase transfer and 60% cache hit rate across sessions (~`128 KB` avg per session):
    - **1,000 sessions:** ~`0.13 GB` (**Well within 5 GB Free Plan quota**)
    - **10,000 sessions:** ~`1.28 GB` (**Within 5 GB Free Plan quota**)
    - **50,000 sessions:** ~`6.40 GB` (**Exceeds 5 GB Free Plan; requires Supabase Pro Plan 250 GB allowance**)

### 6.4 Unexecuted Live Performance Checks (Sandbox & Quota Constraints)
- **Live Browser Network HAR & Lighthouse Mobile:** Not executed in this sandbox (no outbound network access to `nsdurxslkhxqjwlbcpxc.supabase.co` or Vercel Preview).
- **Load Testing:** Per project rules, **zero load tests were run against production** to avoid consuming the 5 GB Supabase Free Plan quota. Modest load testing (`k6` or Playwright 10-VU smoke) must only run against a dedicated staging Supabase project after preview deployment.

---

## 7. Release Engineering, Migration Plan & Rollback Runbook

### 7.1 Vercel Preview URL Status
- **Status:** **BLOCKED / NOT DEPLOYED** (outbound network is disabled in the sandbox and project rules prohibit deploying without explicit owner approval).
- **Command to Generate Preview URL (Owner / CI):**
  ```powershell
  npx vercel deploy --prebuilt
  ```

### 7.2 Environment Variable Name Checklist (Vercel Project Settings)

| Variable Name | Scope | Required? | Notes |
|---|---|---|---|
| `VITE_SUPABASE_URL` | Client & Server (Public) | **Yes** | Project URL (`https://<project-ref>.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | Client & Server (Public) | **Yes** | Public anonymous JWT key |
| `VITE_SUPABASE_IMAGE_TRANSFORMATIONS` | Client (Public) | Optional | Must remain **`false` or unset** on Supabase Free Plan; set to `'true'` only on Supabase Pro+ |
| `VITE_APP_URL` | Client & Server (Public) | **Yes** | Canonical domain (`https://vbfitsstudios.com`) |
| `SUPABASE_URL` | Server Only (`/api/*`) | **Yes** | Same as `VITE_SUPABASE_URL` for serverless functions |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server Secret Only** | **Yes** | Required by `/api/paymob/webhook`, `/api/returns/submit`, `/api/cron/abandoned-carts`. **Never prefix with `VITE_`** |
| `PAYMOB_API_KEY` | **Server Secret Only** | **Yes** | Required by `/api/paymob/create-payment` |
| `PAYMOB_SECRET_KEY` | **Server Secret Only** | **Yes** | Paymob v2 Intention API secret key (`egy_sk_...`) |
| `PAYMOB_PUBLIC_KEY` | **Server Secret Only** | **Yes** | Paymob v2 Intention API public key (`egy_pk_...`) |
| `PAYMOB_INTEGRATION_ID` | **Server Secret Only** | **Yes** | Card payment integration ID |
| `PAYMOB_HMAC_SECRET` | **Server Secret Only** | **Yes** | Required by `/api/paymob/webhook` for SHA-512 HMAC verification |
| `BREVO_API_KEY` | **Server Secret Only** | **Yes** | Required by `/api/email/*` and `/api/cron/abandoned-carts` |
| `BREVO_SENDER_EMAIL` | Server Only | Optional | Defaults to `orders@vbfitsstudios.com` |
| `CRON_SECRET` | **Server Secret Only** | **Yes** | Bearer token protecting `/api/cron/abandoned-carts` |

### 7.3 Isolated Database Backup Restore Drill (Gated Task — Must Run Before Any Live SQL Migration)

> [!CAUTION]
> `d:\VBFITS-Backup\vbfits_full_backup.dump` has **NOT** been restore-tested yet. Verify the backup can be restored cleanly into an isolated local Docker or disposable Supabase branch before executing any DDL/RLS migration on production.

```powershell
# 1. Start an isolated local PostgreSQL 17 container (never point at production!)
docker run --name vbfits-restore-drill -e POSTGRES_PASSWORD=drillpass -p 54329:5432 -d postgres:17

# 2. Verify archive TOC integrity
pg_restore --list "d:\VBFITS-Backup\vbfits_full_backup.dump" > "$env:TEMP\vbfits_restore_toc.txt"

# 3. Restore public schema into the isolated container
pg_restore -h localhost -p 54329 -U postgres -d postgres --no-owner --no-privileges --schema=public "d:\VBFITS-Backup\vbfits_full_backup.dump"

# 4. Verify row counts in the isolated container match baseline (products, product_variants, orders, order_items, customers)
psql -h localhost -p 54329 -U postgres -d postgres -c "SELECT 'products' AS tbl, count(*) FROM public.products UNION ALL SELECT 'orders', count(*) FROM public.orders UNION ALL SELECT 'customers', count(*) FROM public.customers;"

# 5. Tear down isolated drill container after verification
docker rm -f vbfits-restore-drill
```

### 7.4 Reversible Rollout Sequence (Upon Owner Approval)

1. **Stage 1 — Deploy Frontend & Serverless Code (`fix/egress-reliability`):**
   - Push `fix/egress-reliability` to GitHub to create a Vercel Preview deployment.
   - Run the Post-Deploy Smoke Checks (§7.5) against the Preview URL.
   - Merge `fix/egress-reliability` into `main` for production frontend deployment.
2. **Stage 2 — Re-Upload the 11 Active Storefront Images as Optimized WebP:**
   - Log into `/admin/products` and `/admin/marketing` and re-upload the 8 active product images, 2 size charts, and 1 hero banner so they are stored as multi-width WebP (`-480w.webp`, `-800w.webp`, `-1200w.webp`) with `cacheControl: 31536000`.
3. **Stage 3 — Apply Safe Additive & Storage-List Migrations (After Restore Drill):**
   - Execute `supabase/migrations/20261124000045_order_idempotency_key.sql` (adds `client_request_id` column and unique index).
   - Execute `supabase/pending/20261124000047_storage_policy_hardening.sql` (restricts `storage.objects` `SELECT`/list to staff while keeping public CDN `GET` open).
4. **Stage 4 — Guest Checkout RPC & Full RLS Hardening (`000046`):**
   - Deploy a `SECURITY DEFINER` RPC `create_guest_order` and wire `createOrder()` to invoke it for anonymous guests.
   - Once `createOrder()` no longer requires direct `anon` `SELECT` on `public.orders`, execute `supabase/pending/20261124000046_rls_security_hardening.sql`.

### 7.5 Post-Release Smoke Checks & Monitoring Thresholds
- **Smoke Checks:**
  1. Open `/` and `/shop` on mobile viewport (`375x812`): confirm `hero-480w.webp` (`5.1 KB`) loads and zero requests target `/storage/v1/render/image/public/`.
  2. Click 3 filters on `/shop`: confirm Network tab fires **0** additional Supabase `products` queries.
  3. Place a synthetic test COD order: confirm `tracking_number` shows `"Awaiting dispatch"` on `/order-confirmation/:id`.
  4. Test `/track-order` with order reference + wrong email: confirm lookup is rejected.
- **Monitoring Thresholds (First 48 Hours):**
  - **Supabase Cached Egress:** Must remain `< 250 MB / day` under normal traffic (`< 5 GB / 30 days`).
  - **Supabase HTTP 402 / 429 / 503 Rate:** `0` errors; if `> 0`, confirm `OutageBanner` activates and checkout pauses cleanly.
  - **Paymob Webhook Failure / `HMAC_MISMATCH` Rate:** Monitor Vercel function logs for `/api/paymob/webhook`; alert on any `HMAC_MISMATCH` or `Webhook DB update failed`.

### 7.6 Instant Rollback Commands

```powershell
# 1. Instant Frontend & Serverless Rollback (Git + Vercel)
git revert --no-edit b4f7fa4..HEAD
git push origin main
# Or promote the previous production deployment instantly in Vercel CLI:
npx vercel rollback

# 2. Database Migration Rollback (if 000045 or 000047 were applied)
# Run in Supabase SQL Editor:
DROP INDEX IF EXISTS public.idx_orders_client_request_id;
ALTER TABLE public.orders DROP COLUMN IF EXISTS client_request_id;

DROP POLICY IF EXISTS "store-media staff list" ON storage.objects;
CREATE POLICY "store-media public read" ON storage.objects FOR SELECT USING (bucket_id = 'store-media');

DROP POLICY IF EXISTS "product-media staff list" ON storage.objects;
CREATE POLICY "product-media public read" ON storage.objects FOR SELECT USING (bucket_id = 'product-media');
```

---

## 8. Remaining P0 / P1 Issues & Final Gate Checklist

| Priority | Issue | Current Mitigation on Branch | Required Action to Close Permanently |
|---|---|---|---|
| **P0 (Blocker for `000046` SQL only)** | Applying `20261124000046_rls_security_hardening.sql` directly to live Supabase before migrating `createOrder()` to a `SECURITY DEFINER` RPC would break anonymous guest checkout (`INSERT ... RETURNING` fails under `auth.uid() = customer_id`) | Migration `000046` is quarantined in `supabase/pending/`; client-side guest table scans were removed in `src/lib/orders.ts` | Implement `create_guest_order` RPC, update `createOrder()` to call it, then apply `000046` in Supabase SQL Editor |
| **P1 (Egress Quota Risk)** | The 11 active product/hero images currently stored in live Supabase `product-media` are still legacy raw PNG/JPEGs (~1.8 MB average, up to 4.18 MB) uploaded with 1-hour `Cache-Control` | New admin uploads automatically compress to `-480w`/`-800w`/`-1200w.webp` with 1-year `cacheControl: 31536000`; local `/assets/` migrated to WebP | Re-upload the 8 active product images, 2 size charts, and 1 hero banner through the Admin Product/Hero Editor after deploying the code |
| **P1 (Operational Gate)** | `d:\VBFITS-Backup\vbfits_full_backup.dump` has not been restore-tested in an isolated Postgres 17 instance | Full dump and 93 raw storage files are preserved intact on disk | Execute the isolated Docker `pg_restore` drill in §7.3 before applying any SQL migrations |

---

**STOP: No production deployment, no live database migrations, and no live payment calls have been executed. Awaiting separate explicit owner approval.**
