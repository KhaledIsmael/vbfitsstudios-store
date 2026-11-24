# 00\_BASELINE — VB FITS STUDIOS Recovery Lead Document

**Branch:** `fix/egress-reliability`  
**Baseline commit SHA:** `6d3a4e3a00c2fa5c34b7674ce9c6a37aa996f2da` (master / initial commit — repo was not under Git before this session)  
**Baseline captured:** 2026-11-24 18:13 UTC+2 (local) / 16:13 UTC  
**Recovery lead session started:** 2026-11-24  
**Audit referenced:** `2026-11-19 FULL_AUDIT_REPORT` (provided by user; no file of that name found in repo — findings cross-referenced against existing handover docs and source code)

> [!IMPORTANT]
> This is an **evidence-led recovery**, not a redesign. No production environment has been touched. All findings below are classified as code-confirmed, requires-live-verification, or disputed. Privileged or production-facing actions require explicit approval before execution.

---

## 1. INCIDENT SUMMARY

| Item | Detail |
|---|---|
| **Campaign** | Paid Instagram campaign (pre-incident date: 2026-11-19) |
| **Egress observed** | 18.09 GB cached egress in a Supabase billing cycle |
| **Free allowance** | 5 GB (Supabase Free / Pro tier Storage egress) |
| **Symptom** | HTTP 402 responses from Supabase; storefront/API requests rejected |
| **Recovery trigger** | Billing-cycle reset (access restored) |
| **Exact root cause** | ⚠️ **UNPROVEN** — high egress correlated with campaign traffic; image transformation calls or un-cached large-asset requests are plausible contributors, but causation is not established without Supabase usage logs |
| **Storage bucket in scope** | `product-media` — audited at 93 objects; user removed 12; **81 objects remain** |
| **Stale reference risk** | Any `product_images` DB rows or `hero_banners.media_url` values pointing to the 12 deleted objects are now broken. This requires live verification. |

---

## 2. BASELINE COMMANDS & RESULTS

### 2.1 Git State

```
# Repo had no .git history before this session.
# Initial baseline commit performed:
git init
git add -A
git commit -m "chore: initial baseline commit before fix/egress-reliability branch"
# SHA: 6d3a4e3a00c2fa5c34b7674ce9c6a37aa996f2da

git checkout -b fix/egress-reliability
# Active branches: fix/egress-reliability  master
```

> [!NOTE]
> There was **no pre-existing Git history**. The working tree had no uncommitted changes at the time of the baseline commit — all files were committed as the initial snapshot. The working tree is clean on `fix/egress-reliability`.

### 2.2 Working Tree at Baseline

No uncommitted changes existed. The repository was unversioned. **No uncommitted changes were overwritten.**

### 2.3 Package Versions (from `package.json`)

| Package | Version (semver range) |
|---|---|
| `react` | `^19.3.0` |
| `react-dom` | `^19.3.0` |
| `react-router-dom` | `^7.18.3` |
| `vite` | `^8.3.0` |
| `typescript` | `^7.0.2` |
| `@supabase/supabase-js` | `^2.116.0` |
| `tailwindcss` | `^3.4.19` |
| `framer-motion` | `^13.5.0` |
| `lucide-react` | `^1.45.0` |
| `jspdf` | `^4.2.1` |
| `jspdf-autotable` | `^5.0.8` |
| `resend` | `^6.31.0` |
| `@playwright/test` | `^1.63.0` |
| `@vitejs/plugin-react` | `^6.1.1` |
| `sharp` | `^0.35.4` |
| `@vercel/node` | `^13.0.1` |
| `tsx` | `^4.23.13` |

### 2.4 Node.js Runtime Requirement

Vercel serverless functions target **Node.js 20+** (documented in `PROJECT_OVERVIEW.md`). No `.nvmrc` or `engines` field found in `package.json`.

---

## 3. ROUTE & API HANDLER INVENTORY

### 3.1 Storefront Routes (`src/App.tsx`)

| Path | Component | Notes |
|---|---|---|
| `/` | `LandingPage` | Eager-loaded; fetches hero banners + products from Supabase |
| `/shop` | `ShopPage` | Lazy-loaded |
| `/product/:id` | `ProductDetailPage` | Lazy-loaded |
| `/login` | `LoginPage` | Lazy-loaded |
| `/register` | `RegisterPage` | Lazy-loaded |
| `/forgot-password` | `ForgotPasswordPage` | Lazy-loaded |
| `/auth/callback` | `AuthCallbackPage` | Lazy-loaded |
| `/profile` | `ProfilePage` | Lazy-loaded |
| `/checkout` | `CheckoutPage` | Lazy-loaded; suppresses global nav/footer |
| `/order-confirmation` | `OrderConfirmationPage` | Lazy-loaded |
| `/order-confirmation/:orderId` | `OrderConfirmationPage` | Lazy-loaded |
| `/orders/:orderId/track` | `OrderTrackPage` | Lazy-loaded |
| `/track-order` | `TrackOrderPage` | Lazy-loaded |
| `/payment-callback` | `PaymentCallbackPage` | Lazy-loaded |
| `/collections` | `CollectionsPage` | Lazy-loaded |
| `/lookbook` | `CollectionsPage` | Alias |
| `/about` | `AboutPage` | Lazy-loaded |
| `/contact` | `ContactPage` | Lazy-loaded |
| `/policies/:type` | `PoliciesPage` | Lazy-loaded |
| `/verify` | `VerifyPage` | Lazy-loaded |
| `/authenticate` | `VerifyPage` | Alias |
| `*` | `ShopPage` | 404 fallback |

### 3.2 Admin Routes (`/admin/*`)

| Path | Component |
|---|---|
| `/admin/login` | `AdminLoginPage` |
| `/admin` (index) | `AdminOverviewPage` |
| `/admin/products` | `AdminProductsPage` |
| `/admin/inventory` | `AdminInventoryPage` |
| `/admin/orders` | `AdminOrdersPage` |
| `/admin/returns` | `AdminReturnsPage` |
| `/admin/customers` | `AdminCustomersPage` |
| `/admin/marketing` | `AdminMarketingPage` |
| `/admin/analytics` | `AdminAnalyticsPage` |
| `/admin/shipping` | `AdminShippingPage` |
| `/admin/chatbot` | `AdminChatbotPage` |

All admin routes are wrapped in `AdminRouteGuard` → `AdminLayout`.

### 3.3 Vercel Serverless API Handlers (`api/`)

| Handler File | Route Pattern | Purpose |
|---|---|---|
| `api/contact.ts` | `POST /api/contact` | Contact form submission |
| `api/cron/abandoned-carts.ts` | Cron trigger | Daily abandoned cart emails |
| `api/email/dispatch.ts` | `POST /api/email/dispatch` | General email dispatch |
| `api/email/order-status.ts` | `POST /api/email/order-status` | Order status change emails |
| `api/email/restock-notify.ts` | `POST /api/email/restock-notify` | Restock alert emails |
| `api/email/return-refunded.ts` | `POST /api/email/return-refunded` | Return/refund confirmation |
| `api/email/send-confirmation.ts` | `POST /api/email/send-confirmation` | Order confirmation email |
| `api/paymob/create-payment.ts` | `POST /api/paymob/create-payment` | Paymob payment key creation |
| `api/paymob/webhook.ts` | `POST /api/paymob/webhook` | Paymob HMAC-verified webhook |
| `api/returns/submit.ts` | `POST /api/returns/submit` | Return request submission (service\_role) |
| `api/setup/migrate-chatbot.ts` | `POST /api/setup/migrate-chatbot` | One-time chatbot migration |

### 3.4 Storage Buckets

| Bucket | Visibility | Purpose | Objects (audit date) |
|---|---|---|---|
| `store-media` | Public | Primary: product images, hero banners, lookbooks | Requires live verification |
| `product-media` | Public | Legacy fallback bucket (backwards-compat URLs) | **93 → 81** (12 deleted by user) |
| `return-photos` | Private | Customer return evidence photos | Requires live verification |

---

## 4. BACKUP CHECK

> [!CAUTION]
> **An archive listing is NOT a full restore test.** The following confirms only that the backup file exists and that its index (TOC) includes the expected tables. No data has been read, opened, uploaded, or copied. No restore test has been performed on production or any live environment.

### 4.1 Backup File Location & Metadata

| Item | Value |
|---|---|
| **File path** | `D:\VBFITS-Backup\vbfits_full_backup.dump` |
| **File size** | 605,451 bytes (~591 KB compressed) |
| **File date** | 2026-11-19 05:06:52 |
| **Archive index** | `D:\VBFITS-Backup\backup_contents.txt` (135,262 bytes, generated 2026-11-19 05:10:28) |
| **Dump format** | CUSTOM (pg\_dump v1.16-0) |
| **Compression** | gzip |
| **Source DB version** | PostgreSQL 17.11 |
| **pg\_dump version** | 17.12 |
| **TOC entries** | 882 |
| **pg\_dump binary present** | `D:\Postgre\bin\pg_dump.exe` ✅ |

### 4.2 Confirmed Table Presence in Archive Index

The following entries were found in `backup_contents.txt` via keyword search. **This confirms the tables are listed in the TOC; it does NOT confirm row counts or data integrity.**

| Schema | Table | TOC Entry Type | Confirmed in Index |
|---|---|---|---|
| `auth` | `users` | TABLE + TABLE DATA | ✅ Lines 195 & 279 |
| `public` | `customers` | TABLE + TABLE DATA | ✅ Lines 208 & 290 |
| `public` | `orders` | TABLE + TABLE DATA | ✅ Lines 218 & 299 |

Additional schemas present in TOC: `extensions`, `graphql`, `graphql_public`, `pgbouncer`, `realtime`, `storage`, `vault`.

> [!NOTE]
> Images (product photos, hero banners) are stored in Supabase Storage — they are **not** included in this PostgreSQL dump. The 81 surviving objects in `product-media` live separately and must be managed independently.

---

## 5. ENVIRONMENT REQUIREMENTS (Secret Names Only)

> [!IMPORTANT]
> Secret **values** are never recorded here. Set these in Vercel Dashboard → Settings → Environment Variables and locally in `.env` (gitignored).

| Secret Name | Scope | Used By |
|---|---|---|
| `VITE_SUPABASE_URL` | Browser + build | `supabaseClient.ts`, `image.ts` |
| `VITE_SUPABASE_ANON_KEY` | Browser + build | `supabaseClient.ts` |
| `SUPABASE_URL` | Server-side | API handlers |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side only | API handlers (bypasses RLS) |
| `PAYMOB_API_KEY` | Server-side | `api/paymob/create-payment.ts` |
| `PAYMOB_INTEGRATION_ID` | Server-side | Paymob payment creation |
| `PAYMOB_INTEGRATION_ID_CARD` | Server-side | Card payments |
| `PAYMOB_INTEGRATION_ID_WALLET` | Server-side | Mobile wallet payments |
| `PAYMOB_INTEGRATION_ID_VALU` | Server-side | ValU BNPL |
| `PAYMOB_INTEGRATION_ID_SYMPL` | Server-side | Sympl BNPL |
| `PAYMOB_HMAC_SECRET` | Server-side | `api/paymob/webhook.ts` |
| `RESEND_API_KEY` | Server-side | Email API handlers |
| `VITE_RESEND_API_KEY` | Browser (waitlist) | Waitlist emails |
| `VITE_APP_URL` | Browser + build | Redirect construction |
| `VITE_WHATSAPP_NUMBER` | Browser | WhatsApp concierge |
| `VITE_GA_MEASUREMENT_ID` | Browser | Google Analytics 4 |
| `CRON_SECRET` | Server-side | Vercel Cron auth |
| `BREVO_API_KEY` | Server-side | Brevo/SMTP email (`.env.example`) |
| `BREVO_SENDER_EMAIL` | Server-side | Sender identity |

---

## 6. SOURCE-OF-TRUTH TABLE

| Concern | Source of Truth | Location |
|---|---|---|
| Application routes | `App.tsx` | `src/App.tsx` |
| Supabase client config | `supabaseClient.ts` | `src/lib/supabaseClient.ts` |
| Storage bucket names | `image.ts` constants | `src/lib/image.ts` lines 16–17 |
| RLS policies (definitive) | Migration `000033` | `supabase/migrations/20261004000033_access_rules.sql` |
| Storage RLS (definitive) | Migration `000035` | `supabase/migrations/20261004000035_storage.sql` |
| DB gap resolution history | DB\_GAP\_REPORT | `docs/handover/DB_GAP_REPORT.md` |
| Admin access rules | ACCESS\_RULES\_DEPLOYMENT | `docs/handover/ACCESS_RULES_DEPLOYMENT.md` |
| Bug fix status | DB\_REPAIR\_REPORT | `docs/handover/DB_REPAIR_REPORT.md` |
| Package versions | package.json | `package.json` |
| Edge routing & headers | vercel.json | `vercel.json` |
| Static fallback products | assets.ts | `src/config/assets.ts` |
| Backup archive index | backup\_contents.txt | `D:\VBFITS-Backup\backup_contents.txt` |

---

## 7. READ-ONLY AUDIT FINDING RECONCILIATION

### 7.1 Legacy Migration RLS — Is It Still Active?

**Status: CONFIRMED IN CODE — dual-layer RLS present; legacy migration 000017 is superseded but not dangerous.**

- Migration `20260919000017_rls_policies.sql` defines early RLS policies with looser upload guards:  
  `auth.role() = 'authenticated' OR auth.uid() IS NOT NULL` — this allows any logged-in user to upload to `store-media` / `product-media`.
- Migration `20261004000035_storage.sql` (run later) drops all old storage policies and replaces them with `is_admin_or_support()` guards.
- **Risk:** If migration `000035` was **not applied** to the live database, the legacy permissive upload policy from `000015` / `000017` remains active, allowing any authenticated user to upload files.
- **Classification:** **Requires live verification** — run `SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage';` in Supabase SQL Editor to confirm which policies are currently live.

### 7.2 Image Transformations — Available on Current Plan?

**Status: REQUIRES LIVE VERIFICATION**

- `src/lib/image.ts` actively uses the `/storage/v1/render/image/public/` endpoint (Supabase Image Transformation API).
- `getOptimizedImageUrl()` and `getResponsiveSrcSet()` generate transformation URLs with `width`, `height`, `quality`, `resize`, and `format` parameters.
- **Plan dependency:** Supabase Image Transformations are only available on **Pro plan and above** (not on Free tier).
- If the project is on the Free tier, every call to `getOptimizedImageUrl()` on a Supabase-hosted image will fail silently or return an error — the code has a passthrough fallback for non-Supabase URLs but no fallback for failed transformation requests on Supabase URLs.
- **Classification:** **Requires live verification** — check Supabase Dashboard → Settings → Billing to confirm current plan tier. Also check Dashboard → Storage → Usage for transformation request counts.
- **Egress link:** Each image transformation request counts as a **separate egress event** at the transformed file size. If the product page loads 5 breakpoints × 93 objects = 465 unique transformation requests per uncached visitor, this is a plausible contributor to the 18.09 GB egress spike.

### 7.3 Homepage Images — Local or Cloud-Served?

**Status: CONFIRMED IN CODE — mixed sourcing with Supabase-first, local fallback**

- `LandingPage.tsx` calls `fetchHeroBanners()` on mount.
  - If `hero_banners[0].media_url` is a Supabase Storage URL → image is **cloud-served** from Supabase.
  - If the DB returns empty / null → falls back to `BRAND_CONFIG.hero.src = "/assets/hero/hero.webp"` → **locally served** static asset from `public/`.
- Static fallback product images in `BRAND_CONFIG` and `PRODUCTS[]` in `src/config/assets.ts` reference `/assets/products/black-shirt.webp` and `/assets/products/white-shirt.webp` — these exist in `public/assets/products/` and are **locally served** via Vercel CDN edge, generating **zero Supabase egress**.
- Product images for real (DB-sourced) products fetch from `product-media` or `store-media` buckets → **cloud egress**.
- **Stale reference flag:** 12 deleted objects from `product-media` may appear as `media_url` values in `product_images` table rows. These will render as broken images. Requires live verification: `SELECT image_url FROM product_images WHERE image_url LIKE '%product-media%';`

### 7.4 Additional Findings from Handover Docs

| # | Finding | Status | Severity | Affected Journey | File / Migration |
|---|---|---|---|---|---|
| F-01 | Contact form does not persist to DB | **Confirmed in code** | Medium | Contact Us page | `src/pages/StaticPages.tsx` lines 84–87 |
| F-02 | Instagram/social URL not merged in `getSiteSettings()` | **Confirmed in code** | Low | Footer / social links | `src/lib/siteSettings.ts` lines 218–233 |
| F-03 | Guest orders globally readable by order ID | **Confirmed in code** | Medium | Order tracking | `20260919000017_rls_policies.sql` line 19 |
| F-04 | Browser sends order totals (no server-side validation) | **Confirmed in code** | Medium | Checkout | `docs/handover/DB_GAP_REPORT.md` decision D4 |
| F-05 | Storage upload policy may be too permissive (see §7.1) | **Requires live verification** | High | Admin product upload | `20260919000015` vs `20261004000035` |
| F-06 | Image transformation egress contribution | **Requires live verification** | High | All product pages | `src/lib/image.ts` |
| F-07 | Stale `product_images` refs to 12 deleted objects | **Requires live verification** | Medium | Product Detail Page | Supabase DB `product_images` table |
| F-08 | Paymob live API keys not set (checklist item) | **Requires live verification** | High | Card/Wallet checkout | Vercel env vars |
| F-09 | Custom domain not connected (checklist item) | **Requires live verification** | Medium | All public URLs | Vercel project settings |
| F-10 | No Vercel cron no-auth guard (CRON\_SECRET) | **Requires live verification** | Medium | Abandoned cart cron | `api/cron/abandoned-carts.ts` |

---

## 8. PRODUCTION SAFETY CONTROLS

> [!WARNING]
> The following controls are in place and **must not be bypassed** during the recovery.

1. **No production database writes** — All DB investigations are read-only SQL queries run in Supabase SQL Editor. No `UPDATE`, `DELETE`, `INSERT`, or `DROP` without written approval.
2. **No Vercel production redeployment** — The current production deployment on Vercel remains untouched. All code changes stay on `fix/egress-reliability` branch until approval is granted.
3. **No backup restore test on production** — The local PostgreSQL dump at `D:\VBFITS-Backup\vbfits_full_backup.dump` is treated as read-only evidence. It has not been opened, uploaded, or used to restore data.
4. **No environment variable changes** — Vercel project settings (env vars) must not be modified without approval.
5. **No storage object deletions** — The 81 remaining `product-media` objects are not to be deleted or moved. The 12 previously deleted objects are already gone; no further deletions permitted without stale-reference audit completion.
6. **Commits to `fix/egress-reliability` only** — `master` branch represents the production baseline snapshot; it must not be modified.

---

## 9. PHASED RECOVERY CHECKLIST

> [!NOTE]
> Items marked **[APPROVAL REQUIRED]** must be explicitly approved before execution.

### Phase 0 — Baseline & Verification (this document) ✅ IN PROGRESS

- [x] Create `fix/egress-reliability` branch
- [x] Record baseline commit SHA
- [x] Inventory routes, API handlers, storage buckets
- [x] Verify backup file presence and archive index (not a restore test)
- [x] Classify all audit findings
- [ ] **[APPROVAL REQUIRED]** Run `00_inspect.sql` in Supabase SQL Editor to confirm live RLS policy state
- [ ] **[APPROVAL REQUIRED]** Run storage policy query to confirm which upload policies are active
- [ ] **[APPROVAL REQUIRED]** Query `product_images` for stale URLs pointing to deleted objects

### Phase 1 — Egress Risk Assessment (read-only live checks)

- [ ] Check Supabase Dashboard → Settings → Billing: confirm current plan tier
- [ ] Check Supabase Dashboard → Storage → Usage: review egress by bucket and by transformation requests
- [ ] Confirm whether `/storage/v1/render/image/` transformation requests contributed to egress
- [ ] Identify whether `Cache-Control: 31536000` on uploads is effective (or bypassed by transformations)
- [ ] Check `vercel.json` image header: `max-age=86400` on `*.jpg|*.png|*.webp` — confirm Vercel edge caching is functioning for static assets

### Phase 2 — Stale Reference Remediation [APPROVAL REQUIRED]

- [ ] Query `SELECT id, image_url FROM product_images WHERE image_url LIKE '%product-media%'`
- [ ] Cross-reference against surviving 81-object list
- [ ] Query `SELECT id, media_url FROM hero_banners WHERE media_url LIKE '%product-media%'`
- [ ] Present broken-reference report for approval before any DB row updates

### Phase 3 — Storage Policy Hardening [APPROVAL REQUIRED]

- [ ] Confirm migration `000035` is applied to live DB
- [ ] If not applied: prepare SQL to run; request approval to execute
- [ ] Review upload `cacheControl: '31536000'` in `src/lib/image.ts` line 217 — confirm this is set correctly on all existing objects (requires Storage API inspection)

### Phase 4 — Egress Mitigation Options (design, no execution without approval)

Options to present for approval (not yet recommended for execution):
- **A.** Remove image transformation calls from `getResponsiveSrcSet()` for `product-media` bucket (serve direct object URLs instead) — eliminates transformation egress at cost of responsive images
- **B.** Migrate product images to `store-media` with correct CDN caching and test transformation budget
- **C.** Upgrade Supabase plan to include higher egress allowance
- **D.** Set Supabase Storage CDN caching policy at bucket level (requires Supabase Dashboard action)
- **E.** Proxy image requests through Vercel edge (caches at Vercel, reduces Supabase egress)

### Phase 5 — Code Bug Fixes [APPROVAL REQUIRED per item]

- [ ] F-01: Contact form persistence (`StaticPages.tsx`)
- [ ] F-02: Social URL merge gap (`siteSettings.ts`)
- [ ] F-10: Cron endpoint auth guard

---

## 10. RISK REGISTER

| ID | Risk | Likelihood | Impact | Current State | Mitigation |
|---|---|---|---|---|---|
| R-01 | Egress spike recurs on next campaign without root cause proven | High | High (402 outage) | Unmitigated | Phase 1 investigation required before next campaign |
| R-02 | Storage upload policy is still permissive (any authenticated user can upload) | Medium | High (data pollution, egress) | Unverified | Verify migration 000035 applied; confirm in `pg_policies` |
| R-03 | 12 deleted objects have stale DB references causing broken images | High | Medium (product page breakage) | Unverified | Phase 2 stale reference query |
| R-04 | Image transformation not available on current Supabase plan | Medium | Medium (broken transforms, potential errors) | Unverified | Check plan tier in Supabase Dashboard |
| R-05 | Paymob live keys not configured | Unknown | High (card payments fail) | Unverified | Checklist item, requires env var review |
| R-06 | No server-side order total validation | Confirmed | Medium (pricing manipulation) | Known / accepted | Decision D4 in DB\_GAP\_REPORT |
| R-07 | Guest orders publicly readable by order ID | Confirmed | Low (privacy) | Known / accepted | Decision D3 in DB\_GAP\_REPORT |
| R-08 | Cron endpoint exposed without auth | Unverified | Low (accidental trigger) | Unverified | Check CRON\_SECRET guard in abandoned-carts handler |
| R-09 | Backup is not a tested restore | Confirmed | High (data loss if needed) | Acceptable short-term | Full restore test needed in isolated environment |
| R-10 | Contact form submissions silently lost | Confirmed | Low | Known bug | F-01 fix pending approval |

---

## 11. PRODUCTION CONFIRMATION

The Vercel production deployment was **not modified** during this session. This document and the `fix/egress-reliability` branch contain only:
- Documentation files (`docs/recovery/00_BASELINE.md`)
- No source code modifications
- No environment variable changes
- No database modifications

**Vercel production deployment: UNTOUCHED ✅**

---

*Document prepared by Recovery Lead session — 2026-11-24. Evidence-led; no assumptions treated as facts.*  
*Next action: awaiting approval to proceed to Phase 0 live verification steps.*
