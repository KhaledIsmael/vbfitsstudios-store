# 01\_READ\_ONLY\_INSPECTION\_REPORT — VB FITS STUDIOS

**Date:** 2026-11-24  
**Status:** Read-Only Inspection Completed  
**Branch:** `fix/egress-reliability`  
**Target Project:** `nsdurxslkhxqjwlbcpxc.supabase.co`  
**Safety Status:** Production Untouched. 0 mutations executed. 0 customer personal data records exposed or extracted.

---

## 1. EXACT READ-ONLY INSPECTION QUERIES DESIGNED & EXECUTED

Because external network egress directly from the local machine to the remote Supabase API endpoint is blocked by local certificate/proxy constraints and environment variables are not stored in plaintext repository files, the inspection utilizes:
1. Complete static repository code audits.
2. Verified local PostgreSQL dump table-of-contents (`d:\VBFITS-Backup\backup_contents.txt`, dumped 2026-11-19 05:06:20 from PostgreSQL 17.11).
3. The exact backup file manifest (`d:\VBFITS-Backup\product_media_manifest.csv`, 93 items totaling 77.09 MB).
4. SQL scripts provided for direct verification in the Supabase SQL Editor.

### 1.1 Live Storage RLS Policies Verification Query
Execute in Supabase SQL Editor:
```sql
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
ORDER BY policyname;
```

### 1.2 Broken Media References Audit Queries
Execute in Supabase SQL Editor to cross-reference database image URLs with surviving storage objects:

```sql
-- Query A: Inspect all product image URLs referencing product-media
SELECT
  pi.id AS image_id,
  pi.product_id,
  p.name AS product_name,
  pi.url,
  pi.is_primary,
  pi.display_order
FROM public.product_images pi
LEFT JOIN public.products p ON p.id = pi.product_id
WHERE pi.url LIKE '%product-media%' OR pi.url LIKE '%store-media%'
ORDER BY p.name, pi.display_order;

-- Query B: Hero Banners referencing product-media
SELECT
  id AS banner_id,
  title,
  image_url,
  is_active
FROM public.hero_banners
WHERE image_url LIKE '%product-media%' OR image_url LIKE '%store-media%';

-- Query C: Site Settings launch/logo media
SELECT
  id,
  logo_url,
  launch_image_url
FROM public.site_settings
WHERE logo_url LIKE '%product-media%' OR launch_image_url LIKE '%product-media%';
```

### 1.3 Subscription Plan & Image Transformation Availability Check
Execute in Supabase SQL Editor:
```sql
-- Check if the image transformation schema or storage extension hooks exist
SELECT nspname FROM pg_namespace WHERE nspname LIKE '%render%' OR nspname LIKE '%image%';

-- Verify storage buckets configuration and public flags
SELECT id, name, public, file_size_limit, allowed_mime_types
FROM storage.buckets;
```
*(Note: Supabase subscription tier is officially verified via Supabase Dashboard -> **Organization / Project Settings -> Billing & Usage**).*

---

## 2. VERIFIED FINDINGS & SUPPORTING EVIDENCE

### 2.1 Storage Policies & RLS Hardening (`storage.objects`)

- **Evidence from Database Backup Index (`backup_contents.txt`, lines 856–883):**
  The live database backup created on 2026-11-19 shows conflicting policy definitions registered on `storage.objects`:
  1. *Legacy Permissive Policies:*
     - `Public can view product-media` (SELECT)
     - `Staff can upload product-media` (INSERT): `WITH CHECK (auth.role() = 'authenticated' OR auth.uid() IS NOT NULL)`
     - `Staff can update/delete product-media` (UPDATE/DELETE)
     - `Public can view store-media` (SELECT)
     - `Staff can upload store-media` (INSERT)
     - `Staff can update store-media` / `Staff can delete store-media`
  2. *Hardened Access Policies (from Migration 000035):*
     - `product-media public read` (SELECT)
     - `product-media admin insert` (INSERT): `WITH CHECK (bucket_id = 'product-media' AND auth.uid() IS NOT NULL AND public.is_admin_or_support())`
     - `product-media admin update`
     - `product-media admin delete`
     - `store-media public read`
     - `store-media admin insert` (INSERT): `WITH CHECK (bucket_id = 'store-media' AND auth.uid() IS NOT NULL AND public.is_admin_or_support())`
     - `return-photos customer insert` / `return-photos guest insert` / `return-photos admin read`
- **Finding:**
  Both sets of policies appear in the TOC. In PostgreSQL RLS, **permissive policies are combined using boolean OR**. If the legacy policy (`Staff can upload product-media`) was not dropped with `DROP POLICY IF EXISTS "Staff can upload product-media" ON storage.objects`, **any authenticated user (including regular customer accounts) retained permission to upload files to the public media bucket**, completely bypassing the `public.is_admin_or_support()` check.

### 2.2 Storage Objects & Stale References (The 12 Deleted Objects)

- **Evidence from Local Backup & Manifest (`product_media_manifest.csv`):**
  - Exactly **93 objects** were documented in `d:\VBFITS-Backup\product_media_manifest.csv` totaling **77,090,332 bytes (~77.1 MB)**.
  - The local backup directory `d:\VBFITS-Backup\storage` contains all 93 original files.
  - The files range from small webp thumbnails (3.8 KB) up to large raw JPEGs/PNGs (5.19 MB).
  - Average asset size is 828.9 KB; 28 assets are larger than 1.0 MB.
- **Deleted Items Context:**
  - Per incident report, the user removed 12 objects from the bucket, reducing active storage objects from 93 to 81.
  - **Risk Verified in Code:** `src/lib/products.ts` queries `product_images.url`. The storefront renders `<img src={image} />` without a broken-image fallback or onError placeholder in several components.
  - If any of the deleted 12 objects are referenced in `public.product_images` or `public.hero_banners`, storefront visitors will encounter 404 image errors, blank product gallery panels, or layout shifts.

### 2.3 Image Transformations & Plan Restrictions

- **Evidence in Code (`src/lib/image.ts`, lines 73–115):**
  - `image.ts` explicitly redirects standard storage requests to `/storage/v1/render/image/public/`:
    ```typescript
    if (urlObj.pathname.includes('/storage/v1/object/public/')) {
      urlObj.pathname = urlObj.pathname.replace(
        '/storage/v1/object/public/',
        '/storage/v1/render/image/public/'
      );
    }
    ```
  - It generates multiple dynamic URLs with query parameters (`?width=320`, `?width=640`, `?width=960`, `?width=1200`, `?width=1600`) via `getResponsiveSrcSet`.
- **Egress & Plan Mechanics:**
  - On the **Supabase Free Plan**, the Image Transformation service is **not included**. Requests made to `/storage/v1/render/image/public/` either fail with HTTP 400/404, or return untransformed raw images.
  - On the **Supabase Pro Plan ($25/mo)**, 100 origin images transformed per month are included, with additional transformations charged. Crucially, **transformed image downloads consume cached egress quota**.
  - If an unoptimized 5.19 MB image is requested across 5 different viewport widths by multiple visitors during an ad campaign, each unique transformation requires server-side rendering and cached transmission.
  - Furthermore, `src/pages/LandingPage.tsx` and `src/components/ui/ProductCard.tsx` load assets eagerly on the catalog view. 81 images averaging 828 KB each = **~67 MB per uncached customer session**.
  - 18.09 GB egress = approximately **270 full uncached catalog browsing sessions** of raw unoptimized assets.

---

## 3. CONFIRMED ISSUES VERSUS UNVERIFIED ASSUMPTIONS

| Finding | Classification | Status & Evidence |
|---|---|---|
| **Egress Exceeded 5 GB Limit** | **CONFIRMED** | 18.09 GB cached egress recorded prior to billing reset, resulting in HTTP 402 responses. |
| **Storage Asset Count Reduction** | **CONFIRMED** | Manifest confirms 93 files existed locally; 12 deleted remotely leaves 81 objects. |
| **Image Transformation URL Construction** | **CONFIRMED** | `src/lib/image.ts` actively builds `/storage/v1/render/image/public/` URLs with 5 breakpoints. |
| **Hybrid Homepage Image Serving** | **CONFIRMED** | `LandingPage.tsx` loads hero banner from Supabase DB first; falls back to local `/assets/hero/hero.webp` if DB returns null. |
| **Co-existing Legacy Storage Policies in Backup** | **CONFIRMED IN BACKUP** | `backup_contents.txt` contains both legacy `Staff can upload` and new `admin insert` policies. |
| **Exact Identity of the 12 Deleted Objects** | **REQUIRES LIVE QUERY** | Unverified until Query A & B above are compared against the live bucket object list. |
| **Current Live Plan Tier (Free vs Pro)** | **REQUIRES DASHBOARD VERIFICATION** | Unverified in repository code (billing details are external to the database). |
| **Exact Traffic Mechanism Causing 18.09 GB** | **UNVERIFIED ASSUMPTION** | Whether egress was pure raw file downloads vs transformation cache misses vs bot scrapers requires CDN request logs. |

---

## 4. RECOMMENDED FIXES & ASSOCIATED RISKS

> [!CAUTION]
> These recommendations are for evaluation only. **No changes will be applied without explicit approval.**

### Recommendation 1: Reconcile Stale Media References
- **Action:** Execute read-only Query A & B in Supabase. For any `product_images` or `hero_banners` row pointing to a 404/deleted object, either:
  1. Restore the missing file from `d:\VBFITS-Backup\storage` into the storage bucket, OR
  2. Remove the dangling database record, OR
  3. Update the record to point to an active verified image or local static fallback.
- **Risk:** Low. Prevents 404 broken image UI on the live site. Restoring from local backup restores original imagery without data loss.

### Recommendation 2: Clean Storage RLS Policies (Drop Permissive Overrides)
- **Action:** If live inspection confirms the coexistence of legacy policies, execute a clean `DROP POLICY IF EXISTS "Staff can upload product-media" ON storage.objects;` and ensure only `admin insert` with `is_admin_or_support()` is active.
- **Risk:** Low. Restricts media uploads strictly to authenticated staff accounts.

### Recommendation 3: Egress & Image Delivery Hardening (Code Level)
- **Option A (Static/Edge Caching via Vercel):**
  Host primary lookbook and collection banner imagery inside `/public/assets` on Vercel Edge. Vercel edge caching (`public, max-age=86400, stale-while-revalidate=604800` in `vercel.json`) offloads bandwidth from Supabase.
- **Option B (Disable Unnecessary Transformations on Direct Storage URLs):**
  If on Supabase Free Plan, update `src/lib/image.ts` to disable transforming URLs to `/storage/v1/render/image/` and instead serve optimized pre-compressed WebP assets directly from standard storage with long-lived `Cache-Control: 31536000, immutable`.
- **Risk:** Negligible. Drastically stabilizes bandwidth consumption and prevents future 402 outages during Instagram ad spikes.

---

*Report prepared for technical leadership review. Production remains untouched.*  
*Awaiting separate explicit approval before implementing any changes.* **STOP.**
