# 06 — Storage Security, Media Hygiene & Commerce Safety Polish Report
**VB FITS STUDIOS · `fix/egress-reliability` · Recovery Phase 6**  
_Date: 2026-11-24 · Status: **Code committed and verified with 91 tests & production build; zero production database/storage edits applied**_

---

## 1. Executive Summary

This phase resolves remaining security audit items, eliminates dangerous fallbacks and mocks, tightens public storage exposure, audits storage media hygiene after user-initiated file deletions, and ensures commerce safety invariants without altering live checkout behavior.

### Guarantees Upheld
1. **Zero Production Mutations:** No RLS policies modified in live Supabase, no storage objects deleted, no database tables altered. All proposed SQL changes are quarantined in `supabase/pending/`.
2. **Never SQL DELETE on `storage.objects`:** File deletions must follow the storage API lifecycle, preserving referential integrity and metadata.
3. **Private Buckets Protected:** The private bucket `return-photos` remains untouched.
4. **Honest Tracking:** Eliminated fake `DHL-${Math.floor(...)}` pseudo-tracking generation; orders now start with `tracking_number = null` and display `"Awaiting dispatch"` until carrier logistics assign a real tracking code.
5. **Preserved Customer Notes:** Paymob payment webhook now preserves customer order notes and contact email rather than overwriting the entire `notes` column with a raw transaction string.
6. **No Wildcard CORS on Internal Endpoints:** `vercel.json` excludes `/api/cron/(.*)` and `/api/setup/(.*)` from wildcard `Access-Control-Allow-Origin: *`.

---

## 2. Storage Objects Policy Analysis & Migration Proposal

### 2.1 Technical Distinction: Public Object GET vs. Bucket LIST
- **Public CDN GET:** In Supabase Storage, buckets created with `public = true` in `storage.buckets` (`store-media`, `product-media`) serve object downloads directly over the Supabase CDN via `/storage/v1/object/public/{bucket}/{object_path}`. This does **not** rely on `SELECT` RLS policies on the `storage.objects` table.
- **Directory LIST (Enumeration):** An unconstrained `SELECT` policy (`CREATE POLICY ... ON storage.objects FOR SELECT USING (bucket_id = 'product-media')`) allows anonymous clients to query the `storage.objects` table directly via PostgREST or invoke `supabase.storage.from('product-media').list()`. This was flagged by the Supabase Security Advisor as an information-disclosure risk because it exposes the full file directory, unlisted drafts, and test files.

### 2.2 Proposed Policy Migration (`supabase/pending/20261124000047_storage_policy_hardening.sql`)

```sql
-- Differentiate public CDN object download from directory listing

-- 1. store-media bucket: restrict directory listing to authenticated staff/admin
DROP POLICY IF EXISTS "store-media public read" ON storage.objects;

CREATE POLICY "store-media staff list"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'store-media'
    AND auth.role() = 'authenticated'
    AND public.is_admin_or_support()
  );

-- 2. product-media bucket: restrict directory listing to authenticated staff/admin
DROP POLICY IF EXISTS "product-media public read" ON storage.objects;

CREATE POLICY "product-media staff list"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'product-media'
    AND auth.role() = 'authenticated'
    AND public.is_admin_or_support()
  );
```

### 2.3 Impact Proof
- **Public Reads:** Unaffected. Browser `<img>` tags requesting `/storage/v1/object/public/product-media/...` continue to return HTTP 200 without headers or credentials.
- **Admin Uploads & List:** Unaffected. Admin operations execute in an authenticated staff session evaluated by `public.is_admin_or_support()`.
- **Private Buckets (`return-photos`):** Untouched. Policies remain restricted to customer owners and admin reviewers.

---

## 3. Media Hygiene & Reference Inventory (93 Baseline vs. 81 Remaining)

### 3.1 Reconciliation Breakdown
From `d:\VBFITS-Backup\product_media_manifest.csv` (93 objects, 77.09 MB total) cross-referenced against the PostgreSQL database dump:

| Category | Count | Status | Notes |
|---|---|---|---|
| **Active `product_images`** | 8 | Active DB reference | 4 for White Long Sleeve (`f6678489...`), 4 for Black Long Sleeve (`7c195fc4...`). |
| **Active `products.size_chart`** | 2 | Active DB reference | 1 for White shirt template, 1 for Black shirt template. |
| **Active `hero_banners`** | 1 | Active DB reference | Hero slide banner (`1792110500238-img_7429.jpeg`). |
| **Active `site_settings`** | 1 | Active DB reference | Launch image (`1791645107748-whatsapp-image-2026-10-10-at-5-23-58-pm.jpeg`). |
| **Historical Order / JSON Snapshots** | 10 | Archived reference | Archived receipts, past order snapshots, search caches. |
| **Total Bound References** | **22** | **Critical** | Must never be deleted. |
| **Orphaned / Unlinked Media** | **71** | Historical test artifacts | Test uploads, duplicate raw PNGs (`img_7402.png` 5.19 MB, `img_7485.png` 4.18 MB) from initial store staging. |
| **User Deletions** | **12** | Removed remotely | User deleted 12 files to alleviate quota. Baseline reduced from 93 to 81. |

### 3.2 Broken Reference Risk & Safety Fallback
- If the 12 files deleted by the user belonged to the 71 orphaned test files, **zero** live storefront images are broken.
- If an active product image was deleted, the application-level `createSafeImageErrorHandler` in `ProductImage.tsx`, `HeroSlider.tsx`, `OrderTrackPage.tsx`, `OrderConfirmationPage.tsx`, and `ProfilePage.tsx` traps the error, prevents infinite loops, and renders the local WebP fallback (`/assets/products/black-shirt.webp` or `/assets/hero/hero.webp`).
- **Rule Enforced:** No media objects or database references were auto-deleted.

---

## 4. Hardcoded URL Fallback Removal & Environment Variables

### 4.1 Removal in `src/lib/image.ts`
- **Before:** When a relative path (e.g., `products/sample.webp`) was provided and `VITE_SUPABASE_URL` was undefined, `image.ts` defaulted to `'https://nsdurxslkhxqjwlbcpxc.supabase.co'`.
- **After:** Relative paths without `VITE_SUPABASE_URL` now cleanly resolve to deliberate local preview assets (`DEFAULT_PRODUCT_FALLBACK` or `DEFAULT_HERO_FALLBACK`). No production project URLs are hardcoded in client fallback logic.

### 4.2 Public vs. Secret Environment Variable Audit
- Verified across all `src/**/*.ts*` files:
  - `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are the only Supabase keys bundled in the client.
  - Secret keys (`SUPABASE_SERVICE_ROLE_KEY`, `PAYMOB_HMAC_SECRET`, `PAYMOB_API_KEY`, `BREVO_API_KEY`, `CRON_SECRET`) are strictly confined to server-side functions in `/api/` and never prefixed with `VITE_`.
  - Verified by automated test in `src/__tests__/storage-polish.test.ts`.

---

## 5. Brand Assets: Hero WebP Verification

### 5.1 Investigation of Missing `hero.webp` Audit Claim
- **Audit Discrepancy Found:**
  - `public/assets/hero/hero.webp` (**34,534 bytes**) was present in `public/`.
  - Vite serves static assets from `public/` into `dist/assets/hero/hero.webp`.
  - However, in the root mirror directory `assets/hero/`, only `hero.jpg` (**587,887 bytes**) existed.
  - Audit tools or scripts scanning the root `assets/` folder incorrectly reported `hero.webp` as missing.
- **Resolution:**
  - Synchronized `hero.webp`, `hero-480w.webp`, and `hero-800w.webp` into `assets/hero/`. Both directories are now consistent and byte-identical.
  - Verified production build output `dist/assets/hero/hero.webp` is non-empty and served with correct immutable cache headers.

---

## 6. Commerce Safety Polish

### 6.1 Order Tracking & Dispatch State
- **Problem:** `createOrder()` and `getUserOrders()` generated pseudo-random tracking numbers (`DHL-${Math.floor(100000000 + Math.random() * 900000000)}`), misleading customers into believing their shipment was already picked up by DHL before fulfillment.
- **Fix:** New orders are initialized with `tracking_number = null`. The storefront (`OrderConfirmationPage`, `OrderTrackPage`, `ProfilePage`) displays `"Awaiting dispatch"` until administrative staff or carrier integration inputs a real shipping tracking number.

### 6.2 Paymob Webhook Note Preservation
- **Problem:** When receiving a webhook notification from Paymob, `api/paymob/webhook.ts` performed:
  `notes: 'Paymob txn ' + paymobTransactionId + ' | ' + newPaymentStatus`.
  This destroyed any customer delivery instructions and wiped the customer's contact email stored in `notes`.
- **Fix:** The webhook now reads existing order notes first. If notes exist, the Paymob transaction reference is appended (`${existingOrder.notes} | ${paymobNote}`), preserving all customer data.

### 6.3 CORS Scope Tightening in `vercel.json`
- **Problem:** Broad `Access-Control-Allow-Origin: *` was applied across `/api/(.*)`.
- **Fix:** Scoped CORS headers strictly to public storefront endpoints: `/api/(contact|paymob|returns|email)(.*)`. Administrative endpoints (`/api/cron/(.*)`, `/api/setup/(.*)`) are excluded from wildcard CORS. Note: CORS restrictions do not replace backend authentication (`CRON_SECRET`).

### 6.4 Admin Role Matching Guard
- **Problem:** `src/context/AdminAuthContext.tsx` contained `cleanEmail.startsWith('admin@')`, which would grant admin role to any arbitrary email address beginning with `admin@`.
- **Fix:** Removed the loose prefix check. Admin access requires an exact match against authorized brand administrative emails (`vbfitsstudios@gmail.com`, `admin@vbfitsstudios.com`, `owner@vbfitsstudios.com`) or an authoritative database role (`role === 'admin' || role === 'support'`) validated server-side by `public.is_admin_or_support()`.

---

## 7. Verification Results

- **Automated Test Suite:** 6 test files, **91 passed (91 total)**:
  - `storage-polish.test.ts`: 6 passed (verifies URL fallback safety, env isolation, asset existence, CORS narrowing, note preservation, admin email guards)
  - `request-counts.test.ts`: 5 passed
  - `checkout-reliability.test.ts`: 29 passed
  - `api-resilience.test.ts`: 39 passed
  - `rls-security-code.test.ts`: 4 passed
  - `image-egress.test.ts`: 8 passed
- **TypeScript Static Verification:** `tsc --noEmit` exited **0** (clean).
- **Vite Production Build:** `npm run build` succeeded cleanly in **4.09s** (`dist/` generated without warnings).

---

## 8. Rollout, Pending Actions & Rollback Plan

### Pending Actions (Requires Explicit User Approval)
1. **Database Migration `20261124000047_storage_policy_hardening.sql`:**
   - Quarantined in `supabase/pending/`.
   - When ready, execute in Supabase SQL Editor to tighten storage listing permissions.
2. **Guest Order RPC Transition (`20261124000046_rls_security_hardening.sql`):**
   - Remains quarantined in `supabase/pending/` until guest order placement RPC is wired.

### Rollback Plan
- All code changes are client-side and serverless API route adjustments on Git branch `fix/egress-reliability`.
- In the event of an unexpected issue, revert to the previous commit (`git revert HEAD`).
- Zero production database migrations were executed, so database rollback is not required.
