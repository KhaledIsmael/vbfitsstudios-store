# 04 — Image Egress & Storage Bandwidth Recovery Report
**VB FITS STUDIOS · `fix/egress-reliability` · Recovery Phase 4**  
_Date: 2026-11-24 · Status: **Code & local assets committed on branch; production storage & deployment UNTOUCHED**_

---

## 1. Executive Summary

- **Root-cause posture (evidence-led):** During the incident, Supabase cached egress hit **18.09 GB vs a 5.0 GB Free Plan allowance** (triggering HTTP 402 responses). Active `product-media` assets in the backup manifest average **~1.8 MB each** (up to **5.19 MB** for a single raw PNG), and `uploadAdminMedia()` in `src/lib/adminProducts.ts` uploaded files with `cacheControl: '3600'` (1 hour).
- **Plan-compatibility finding:** `src/lib/image.ts` contained `getOptimizedImageUrl()` and `getResponsiveSrcSet()` rewriting URLs to `/storage/v1/render/image/public/` (a paid Pro+ feature not available on the Supabase Free Plan). Although components had not wired those helpers yet, calling them on Free Plan would ship broken transformation URLs.
- **What was fixed in code (without touching production storage):**
  1. Gated `/storage/v1/render/image/public/` behind `VITE_SUPABASE_IMAGE_TRANSFORMATIONS=true` (default `false`), normalizing any accidental render URLs back to `/storage/v1/object/public/`.
  2. Added browser-side WebP compression & multi-width variant generation (`-480w.webp`, `-800w.webp`, `-1200w.webp` / `-1600w.webp`) in `uploadAdminMedia()` while keeping bucket `'product-media'` and upgrading `cacheControl` from `'3600'` to `'31536000'` (1 year immutable).
  3. Generated width-appropriate local WebP variants (`-480w.webp`, `-800w.webp`) for `/assets/hero/` and `/assets/products/` via `scripts/optimize-assets.mjs` (`sharp`), and wired `srcset`, `sizes`, `width`/`height`, `loading`, `decoding`, `fetchPriority`, and loop-safe `onError` handlers across `ProductImage`, `HeroSlider`, `LandingPage`, `ProductGallery`, `OrderConfirmationPage`, `OrderTrackPage`, and `ProfilePage`.

---

## 2. Traffic Trace & Asset Classification

| Source Category | Code Paths & Examples | Counts Toward Supabase Cached Egress? | Notes |
|---|---|---|---|
| **Local `/assets/` (Vercel CDN)** | `public/assets/hero/hero.webp`, `public/assets/products/black-shirt.webp`, `white-shirt.webp`, `logo/*.png`, `icons/*.svg` | **No** (served by Vercel Edge) | Previously fallback refs pointed to `.jpeg`/`.jpg` (`hero.jpg` = 587.9 KB). Now mapped to `.webp` + `-480w`/`-800w` variants. |
| **Public Supabase Storage (`product-media`)** | `product_images.url`, `products.size_chart`, `hero_banners.media_url`, `site_settings.launch_image_url` | **Yes** | 93 objects in backup manifest (`77.09 MB`); **81 objects** reported remaining after 12 user deletions. |
| **Dynamic Media (Video / GIF)** | `HeroSlider.tsx` (`media_type === 'video'`), `ProductGallery.tsx` (`type: 'video' | 'gif'`) | **Yes** (when hosted on Supabase) | Excluded from raster resizing (`isTransformableImage()` returns `false` for `.mp4`, `.webm`, `.gif`, `.svg`). |
| **Private Storage (`return-photos`)** | `supabase/migrations/20261004000035_storage.sql` (`public: false`) | **Yes** (admin/staff reads only) | `isPrivateStorageUrl()` explicitly excludes `/object/sign/`, `/object/authenticated/`, and `/return-photos/` from URL rewriting and public caching. |
| **External Hosted URLs** | `src/context/AuthContext.tsx:177` (`images.unsplash.com` default avatar) | **No** | Third-party CDN; no Supabase egress. |

---

## 3. Plan-Compatibility Decision

- **Current Plan Constraint:** Supabase Free Plan (5 GB cached egress) does **not** include Supabase Image Transformations (`/storage/v1/render/image/public/`).
- **Decision:**
  - Default `SUPABASE_IMAGE_TRANSFORMS_ENABLED` to `false` (`VITE_SUPABASE_IMAGE_TRANSFORMATIONS !== 'true'`).
  - Never rewrite `/storage/v1/object/public/` to `/storage/v1/render/image/public/` unless explicitly opted in on a Pro+ plan.
  - Generate responsive WebP variants at **upload time** (browser `<canvas>` in `optimizeImageVariantsForUpload`) and **build time** (`scripts/optimize-assets.mjs` via `sharp`), stored as immutable versioned objects (`{timestamp}-{slug}-{width}w.webp`).
  - Legacy single-file Supabase objects (the 81 existing objects without `-1200w.webp` suffix) return `srcset = ''` so browsers never 404 or hit paid endpoints.

---

## 4. Caching & Response Headers Verification

### 4.1 Code & Config Audit (Observed)
- **`src/lib/adminProducts.ts` (before):** `cacheControl: '3600'` (1 hour) on `product-media` uploads.
- **`src/lib/adminProducts.ts` (after):** `cacheControl: '31536000'` (1 year immutable) with `upsert: false` and timestamped filenames (`${stamp}-${cleanName}-${width}w.webp`).
- **Cache-busting query strings:** Audited all `.ts`/`.tsx` files — **zero** `?t=` or `?v=` query strings are appended to image URLs on render.
- **`vercel.json`:** Configures `Cache-Control: public, max-age=86400, stale-while-revalidate=604800` for Vercel-hosted static images (`/assets/...`). **Important:** `vercel.json` headers do **not** apply to `*.supabase.co/storage/v1/object/public/...` responses.

### 4.2 Live HTTP Headers & Browser Network Capture Status
- **Sandbox limitation:** This environment has no outbound network access, so live `curl -I` checks against `nsdurxslkhxqjwlbcpxc.supabase.co` and live browser DevTools screenshots could **not** be captured here.
- **Owner verification commands (run from local terminal):**
  ```bash
  # 1. Verify Cache-Control & CDN cache status on a live product-media object
  curl -I "https://nsdurxslkhxqjwlbcpxc.supabase.co/storage/v1/object/public/product-media/products/1792341737765-img_7485.png"

  # 2. Verify private return-photos bucket rejects unauthenticated public GET (expect 400/403/404, never 200 public cache)
  curl -I "https://nsdurxslkhxqjwlbcpxc.supabase.co/storage/v1/object/public/return-photos/returns/guest/test.jpg"
  ```
- **What to look for:** Existing objects uploaded before this fix with `cacheControl: '3600'` will still return `cache-control: max-age=3600` until re-uploaded with `cacheControl: '31536000'`.

---

## 5. Storage References Audit (`product-media`)

- **Preservation rule followed:** Zero objects were deleted or migrated; `d:\VBFITS-Backup\` was preserved untouched; `uploadAdminMedia` continues targeting `'product-media'` (no migration to `'store-media'` until all DB references, ACLs, and rollback are mapped).
- **Backup manifest baseline (`02_FINAL_VERIFICATION.md`):**
  - Total backup objects: **93** (`77.09 MB`).
  - Active DB-referenced objects: **8** `product_images`, **2** `products.size_chart`, **1** `hero_banners`, **1** `site_settings.launch_image_url`, plus **10** historical JSON snapshots.
  - **71** objects were unreferenced/orphaned in the backup dump; **12** objects were removed by the user leaving **81**.
  - **Broken-image mitigation in code:** `ProductImage`, `HeroSlider`, `LandingPage`, `OrderConfirmationPage`, `OrderTrackPage`, and `ProfilePage` now use `createSafeImageErrorHandler()` which clears `onerror` and falls back once to `/assets/products/black-shirt.webp` or `/assets/hero/hero.webp` without infinite loops.

---

## 6. Changed Files

| File | Summary of Change |
|---|---|
| `scripts/optimize-assets.mjs` | Build-time `sharp` script generating `-480w.webp` & `-800w.webp` local variants |
| `public/assets/hero/hero-{480w,800w}.webp` | Responsive local hero WebP variants |
| `public/assets/products/{black,white}-shirt-{480w,800w}.webp` | Responsive local product WebP variants |
| `src/lib/image.ts` | Plan-safe `getOptimizedImageUrl` / `getResponsiveSrcSet`, private URL guard, `createSafeImageErrorHandler`, `optimizeImageVariantsForUpload` |
| `src/lib/adminProducts.ts` | `uploadAdminMedia` now compresses to WebP variants (`-480w`/`-800w`/`-1200w` or `-1600w`) with `cacheControl: '31536000'` in `'product-media'` |
| `src/components/admin/AdminHeroEditor.tsx` | Passes `{ folder: 'hero' }` to `uploadAdminMedia` (`1600w` max) |
| `src/components/ui/ProductImage.tsx` | Wires `getOptimizedImageUrl`, `getResponsiveSrcSet`, `sizes` per placement, and loop-safe `onError` |
| `src/components/ui/HeroSlider.tsx` | Wires `srcset`, `sizes="100vw"`, `width`/`height`, and loop-safe `onError` |
| `src/pages/LandingPage.tsx` | Wires `srcset`, `sizes="100vw"`, `width`/`height`, and loop-safe `onError` |
| `src/components/ui/ProductGallery.tsx` | Eager-loads active/first PDP image (`fetchPriority="high"`), lazy-loads others, updates fallback to `.webp` |
| `src/lib/heroBanners.ts` & `src/lib/products.ts` | Updates static fallback paths from `.jpeg`/`.jpg` to `.webp` |
| `src/pages/OrderConfirmationPage.tsx`, `OrderTrackPage.tsx`, `ProfilePage.tsx` | Replaces raw `onError` `.jpeg` assignment with `createSafeImageErrorHandler` + `getOptimizedImageUrl` |
| `src/__tests__/image-egress.test.ts` | 8 Vitest unit tests covering Free-Plan URL safety, `srcset`, private URLs, and `onError` loop guard |

---

## 7. Measured Image Sizes vs. Egress Projections

### 7.1 Measured Local Asset Sizes (Exact Bytes on Disk)

| Asset | Original / Fallback (Bytes) | Full WebP (Bytes) | `800w` WebP (Bytes) | `480w` WebP (Bytes) |
|---|---|---|---|---|
| **Hero Banner** | `hero.jpg`: **587,887 B** | `hero.webp`: **34,534 B** | **10,960 B** | **5,194 B** |
| **Black Shirt** | `black-shirt.jpeg`: **46,574 B** | `black-shirt.webp`: **25,788 B** | **11,518 B** | **6,548 B** |
| **White Shirt** | `white-shirt.jpeg`: **47,073 B** | `white-shirt.webp`: **31,840 B** | **14,896 B** | **7,716 B** |

### 7.2 Measured Supabase Storage Assets (From Backup Manifest)

| Metric | Measured Value | Source |
|---|---|---|
| Backup object pool (`product-media`) | **93 objects · 77.09 MB** | `d:\VBFITS-Backup\product_media_manifest.csv` |
| Largest single asset (`img_7402.png`) | **5.19 MB** | `02_FINAL_VERIFICATION.md` |
| Active `product_images` (8 rows) | **~14.5 MB total** (~1.8 MB avg) | `02_FINAL_VERIFICATION.md` |

### 7.3 Projected Supabase Egress (ESTIMATES — Assumptions Stated Separately)

> **Important:** The figures below are **analytical projections**, not measured production telemetry. Actual Supabase cached egress depends on CDN cache-hit ratio, visitor browser caching, and whether existing 81 `product-media` objects are re-uploaded as WebP.

**Assumptions:**
- **Baseline (Before — unoptimized raw `product-media`):** ~14.5 MB per full catalog/PDP session if uncached; ~1.8 MB/image average.
- **After code deploy ONLY (existing 81 raw PNG/JPEG objects untouched in Supabase):** Local `/assets/` move to Vercel CDN (`0` Supabase bytes), broken `/render/image/` calls are prevented, and new admin uploads use WebP + 1-year cache. **Existing 81 Supabase objects still weigh ~1.8 MB avg** until re-uploaded as WebP.
- **After optional WebP re-upload of active catalog (future approved step):** Suppose an average product WebP (`480w` mobile card ~40 KB, `1200w` PDP ~120 KB) replaces a 1.8 MB raw asset, and 8 images load per session (~0.64 MB mobile / ~0.96 MB desktop per uncached session).

| Scenario | Cold-Cache Per-Session Supabase Payload (Estimate) | 1,000 Sessions | 10,000 Sessions | 50,000 Sessions |
|---|---|---|---|---|
| **Baseline (Raw PNG/JPEG, uncached)** | ~14.5 MB (measured catalog sum) | ~14.5 GB *(exceeds 5 GB)* | ~145 GB *(exceeds 5 GB)* | ~725 GB *(exceeds 5 GB)* |
| **After Code Fix + WebP Re-upload (Mobile `480w` est. 0.40 MB/session)** | ~0.40 MB *(assumption)* | ~0.40 GB | ~4.0 GB | ~20.0 GB *(requires Pro or CDN proxy)* |
| **After Code Fix + WebP Re-upload (Desktop `800w–1200w` est. 0.96 MB/session)** | ~0.96 MB *(assumption)* | ~0.96 GB | ~9.6 GB | ~48.0 GB *(requires Pro or CDN proxy)* |

---

## 8. Rollout & Rollback Plan

### Rollout (Manual Approval Gates)
1. **Merge / Deploy Code Changes (Safe):** Deploy `fix/egress-reliability` to staging/preview first; verify `curl -I` headers and DevTools Network tab.
2. **Re-upload Active Product & Hero Media (Separate Approval Required):** Re-upload the active `product_images` and `hero_banners` through the updated Admin uploader so Supabase stores `-480w.webp`, `-800w.webp`, `-1200w.webp` with `cacheControl: '31536000'`. Keep `d:\VBFITS-Backup\` intact.
3. **Verify Free Plan Quota:** Monitor Supabase Usage dashboard after campaign launch.

### Rollback
- **Code rollback:** `git revert <commit-sha>` restores previous `image.ts`, `adminProducts.ts`, and UI components without touching any DB rows or storage objects.
- **Storage rollback:** Existing raw objects in `product-media` are never deleted or overwritten (`upsert: false` + timestamped filenames), and `d:\VBFITS-Backup\` retains all 93 original files.

---

**STOP** — Code changes are ready on `fix/egress-reliability`. Production storage, database rows, and live deployment remain untouched pending your review and approval.
