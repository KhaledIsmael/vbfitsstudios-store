import type React from 'react';
import { supabase } from './supabaseClient';

/**
 * Supabase Storage Image Optimization & Egress Helper
 *
 * Plan-aware delivery:
 * - Supabase Free Plan does NOT include `/storage/v1/render/image/public/` transformations.
 * - `VITE_SUPABASE_IMAGE_TRANSFORMATIONS=true` is required to opt into paid render URLs.
 * - By default (Free Plan safe), this module serves direct `/storage/v1/object/public/` URLs
 *   and pre-generated responsive WebP variants (`-480w.webp`, `-800w.webp`, `-1200w.webp`).
 * - Private/signed URLs (`return-photos`, `/object/sign/`) are never rewritten or cached publicly.
 */

export const STORAGE_BUCKET = 'store-media';
export const LEGACY_STORAGE_BUCKET = 'product-media';

export const DEFAULT_PRODUCT_FALLBACK = '/assets/products/black-shirt.webp';
export const DEFAULT_HERO_FALLBACK = '/assets/hero/hero.webp';

export const SUPABASE_IMAGE_TRANSFORMS_ENABLED =
  typeof import.meta !== 'undefined' &&
  import.meta.env?.VITE_SUPABASE_IMAGE_TRANSFORMATIONS === 'true';

export type ImageResizeMode = 'cover' | 'contain' | 'fill';
export type ImageFormat = 'origin' | 'webp' | 'avif';

export interface ImageTransformOptions {
  width?: number;
  height?: number;
  quality?: number; // 1 - 100, default 80
  resize?: ImageResizeMode;
  format?: ImageFormat;
}

export const RESPONSIVE_BREAKPOINTS = [480, 800, 1200];

const LOCAL_ASSET_MAP: Record<string, { webp: string; maxWidth: number; widths: number[] }> = {
  '/assets/hero/hero.webp': { webp: '/assets/hero/hero.webp', maxWidth: 1376, widths: [480, 800, 1376] },
  '/assets/hero/hero.jpg': { webp: '/assets/hero/hero.webp', maxWidth: 1376, widths: [480, 800, 1376] },
  '/assets/products/black-shirt.webp': { webp: '/assets/products/black-shirt.webp', maxWidth: 1280, widths: [480, 800, 1280] },
  '/assets/products/black-shirt.jpeg': { webp: '/assets/products/black-shirt.webp', maxWidth: 1280, widths: [480, 800, 1280] },
  '/assets/products/white-shirt.webp': { webp: '/assets/products/white-shirt.webp', maxWidth: 1280, widths: [480, 800, 1280] },
  '/assets/products/white-shirt.jpeg': { webp: '/assets/products/white-shirt.webp', maxWidth: 1280, widths: [480, 800, 1280] },
};

const PRE_GENERATED_WIDTH_RE = /-(480|800|1200|1600)w\.webp(\?.*)?$/i;

/**
 * Checks if a given URL is a private or signed storage URL (e.g. return-photos).
 * Private URLs must never be rewritten to public render endpoints or cached publicly.
 */
export function isPrivateStorageUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  return (
    url.includes('/storage/v1/object/sign/') ||
    url.includes('/storage/v1/object/authenticated/') ||
    url.includes('/return-photos/')
  );
}

/**
 * Checks if a given URL is hosted on public Supabase Storage.
 */
export function isSupabaseStorageUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  if (isPrivateStorageUrl(url)) return false;
  return (
    url.includes('/storage/v1/object/public/') ||
    url.includes('/storage/v1/render/image/public/')
  );
}

/**
 * Checks whether the asset is a raster image that can be resized/optimized (excludes mp4, webm, svg, gif, data:).
 */
export function isTransformableImage(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  if (url.startsWith('data:') || url.startsWith('blob:')) return false;
  const clean = url.split('?')[0].toLowerCase();
  if (
    clean.endsWith('.mp4') ||
    clean.endsWith('.webm') ||
    clean.endsWith('.svg') ||
    clean.endsWith('.gif')
  ) {
    return false;
  }
  return true;
}

function getLocalVariantUrl(webpPath: string, width: number, maxWidth: number): string {
  if (width >= maxWidth) return webpPath;
  const base = webpPath.slice(0, -'.webp'.length);
  return `${base}-${width}w.webp`;
}

/**
 * Returns a plan-compatible, optimized image URL.
 * - Never emits `/storage/v1/render/image/public/` unless `VITE_SUPABASE_IMAGE_TRANSFORMATIONS=true`.
 * - Normalizes any accidental `/render/image/public/` URL back to `/object/public/` when transforms are disabled.
 * - Maps local `/assets/` JPEGs to pre-generated WebP width variants.
 */
export function getOptimizedImageUrl(
  src: string,
  options: ImageTransformOptions = {}
): string {
  if (!src || typeof src !== 'string') return '';
  if (isPrivateStorageUrl(src) || !isTransformableImage(src)) return src;

  const { width, height, quality = 80, resize, format } = options;

  // Local /assets/ mapping to pre-generated WebP
  const cleanPath = src.split('?')[0];
  const localMeta = LOCAL_ASSET_MAP[cleanPath];
  if (localMeta) {
    if (width && width <= 480) return getLocalVariantUrl(localMeta.webp, 480, localMeta.maxWidth);
    if (width && width <= 800) return getLocalVariantUrl(localMeta.webp, 800, localMeta.maxWidth);
    return localMeta.webp;
  }

  // Case 1: Relative storage path like "products/123-shirt.webp"
  if (!src.startsWith('http://') && !src.startsWith('https://') && !src.startsWith('/')) {
    const supabaseUrl =
      (typeof import.meta !== 'undefined' && (import.meta.env?.VITE_SUPABASE_URL as string)) ||
      '';

    if (!supabaseUrl) {
      // Deliberate local preview / test fallback when VITE_SUPABASE_URL is not configured
      return src.startsWith('products/') ? DEFAULT_PRODUCT_FALLBACK : DEFAULT_HERO_FALLBACK;
    }

    if (!SUPABASE_IMAGE_TRANSFORMS_ENABLED) {
      return `${supabaseUrl}/storage/v1/object/public/${LEGACY_STORAGE_BUCKET}/${src}`;
    }

    const baseUrl = `${supabaseUrl}/storage/v1/render/image/public/${STORAGE_BUCKET}/${src}`;
    const params = new URLSearchParams();
    if (width) params.set('width', String(Math.round(width)));
    if (height) params.set('height', String(Math.round(height)));
    if (quality) params.set('quality', String(quality));
    if (resize) params.set('resize', resize);
    if (format) params.set('format', format);

    const qs = params.toString();
    return qs ? `${baseUrl}?${qs}` : baseUrl;
  }

  // Case 2: Full Supabase Storage URL
  if (isSupabaseStorageUrl(src)) {
    try {
      const urlObj = new URL(src);

      if (!SUPABASE_IMAGE_TRANSFORMS_ENABLED) {
        // Never ship a paid-only /render/image/public/ URL when transforms are unavailable
        if (urlObj.pathname.includes('/storage/v1/render/image/public/')) {
          urlObj.pathname = urlObj.pathname.replace(
            '/storage/v1/render/image/public/',
            '/storage/v1/object/public/'
          );
          urlObj.searchParams.delete('width');
          urlObj.searchParams.delete('height');
          urlObj.searchParams.delete('quality');
          urlObj.searchParams.delete('resize');
          urlObj.searchParams.delete('format');
        }

        // If the object uses our pre-generated width naming (-1200w.webp / -1600w.webp),
        // pick the closest pre-uploaded width variant when width is requested.
        if (width && PRE_GENERATED_WIDTH_RE.test(urlObj.pathname)) {
          const targetW = width <= 480 ? 480 : width <= 800 ? 800 : null;
          if (targetW) {
            urlObj.pathname = urlObj.pathname.replace(
              PRE_GENERATED_WIDTH_RE,
              `-${targetW}w.webp`
            );
          }
        }

        return urlObj.toString();
      }

      // Paid Pro+ Plan: Image Transformations explicitly enabled
      if (urlObj.pathname.includes('/storage/v1/object/public/')) {
        urlObj.pathname = urlObj.pathname.replace(
          '/storage/v1/object/public/',
          '/storage/v1/render/image/public/'
        );
      }

      if (width) urlObj.searchParams.set('width', String(Math.round(width)));
      if (height) urlObj.searchParams.set('height', String(Math.round(height)));
      if (quality) urlObj.searchParams.set('quality', String(quality));
      if (resize) urlObj.searchParams.set('resize', resize);
      if (format) urlObj.searchParams.set('format', format);

      return urlObj.toString();
    } catch {
      return src;
    }
  }

  // Case 3: Other local or external URL (e.g. Unsplash avatar)
  return src;
}

/**
 * Generates an HTML `srcset` attribute string only when verified width variants exist:
 * - Local `/assets/` with pre-generated `-480w.webp` / `-800w.webp` variants
 * - Supabase Storage URLs uploaded with `-1200w.webp` / `-1600w.webp` siblings
 * - Supabase Image Transformations when `VITE_SUPABASE_IMAGE_TRANSFORMATIONS=true`
 *
 * Returns `''` for legacy single-file Supabase objects so browsers never 404 or hit paid endpoints.
 */
export function getResponsiveSrcSet(
  src: string,
  widths: number[] = RESPONSIVE_BREAKPOINTS,
  options: Omit<ImageTransformOptions, 'width'> = {}
): string {
  if (!src || isPrivateStorageUrl(src) || !isTransformableImage(src)) {
    return '';
  }

  // Local pre-generated responsive assets
  const cleanPath = src.split('?')[0];
  const localMeta = LOCAL_ASSET_MAP[cleanPath];
  if (localMeta) {
    return localMeta.widths
      .map((w) => `${getLocalVariantUrl(localMeta.webp, w, localMeta.maxWidth)} ${w}w`)
      .join(', ');
  }

  if (!isSupabaseStorageUrl(src)) {
    return '';
  }

  if (SUPABASE_IMAGE_TRANSFORMS_ENABLED) {
    return widths
      .map((w) => {
        const transformedUrl = getOptimizedImageUrl(src, { ...options, width: w });
        return `${transformedUrl} ${w}w`;
      })
      .join(', ');
  }

  // Free-plan safe: only emit srcset if URL matches our pre-generated multi-width naming
  const match = cleanPath.match(/-(1200|1600)w\.webp$/i);
  if (match) {
    const primaryW = Number(match[1]);
    const availableWidths = primaryW === 1600 ? [480, 800, 1600] : [480, 800, 1200];
    return availableWidths
      .map((w) => {
        const variantUrl =
          w === primaryW
            ? src
            : src.replace(/-(1200|1600)w\.webp(\?.*)?$/i, `-${w}w.webp$2`);
        return `${variantUrl} ${w}w`;
      })
      .join(', ');
  }

  return '';
}

/**
 * Returns an onError handler that swaps to `fallbackSrc` at most once,
 * preventing infinite error loops if the fallback itself fails.
 */
export function createSafeImageErrorHandler(
  fallbackSrc: string = DEFAULT_PRODUCT_FALLBACK
): (e: React.SyntheticEvent<HTMLImageElement>) => void {
  return (e) => {
    const img = e.currentTarget;
    img.onerror = null;
    if (img.dataset.fallbackApplied === '1') return;
    img.dataset.fallbackApplied = '1';
    img.srcset = '';
    if (!img.src.endsWith(fallbackSrc)) {
      img.src = fallbackSrc;
    }
  };
}

// ─── CLIENT-SIDE UPLOAD OPTIMIZATION ─────────────────────────────────────────

export interface OptimizedUploadVariant {
  width: number;
  blob: Blob;
  contentType: string;
  ext: string;
}

/**
 * Resizes and compresses a raster image to WebP in the browser before upload,
 * preserving aspect ratio without enlargement.
 * Falls back to the original file if running outside a browser or for GIF/SVG/video.
 */
export async function optimizeImageVariantsForUpload(
  file: File,
  targetWidths: number[] = [1200, 800, 480],
  quality: number = 0.82
): Promise<OptimizedUploadVariant[]> {
  const isRaster =
    file.type === 'image/jpeg' ||
    file.type === 'image/jpg' ||
    file.type === 'image/png' ||
    file.type === 'image/webp';

  if (!isRaster || typeof document === 'undefined' || typeof Image === 'undefined') {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
    return [{ width: 0, blob: file, contentType: file.type || 'application/octet-stream', ext }];
  }

  try {
    const objectUrl = URL.createObjectURL(file);
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = (err) => reject(err);
      el.src = objectUrl;
    });
    URL.revokeObjectURL(objectUrl);

    const srcW = img.naturalWidth || img.width;
    const srcH = img.naturalHeight || img.height;
    if (!srcW || !srcH) {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      return [{ width: 0, blob: file, contentType: file.type, ext }];
    }

    const sortedWidths = [...targetWidths].sort((a, b) => b - a);
    const variants: OptimizedUploadVariant[] = [];

    for (const targetW of sortedWidths) {
      const outW = Math.min(targetW, srcW);
      const outH = Math.max(1, Math.round((srcH * outW) / srcW));

      const canvas = document.createElement('canvas');
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;

      ctx.drawImage(img, 0, 0, outW, outH);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/webp', quality)
      );

      if (blob) {
        variants.push({
          width: targetW,
          blob,
          contentType: 'image/webp',
          ext: 'webp',
        });
      }
    }

    if (variants.length > 0) return variants;
  } catch {
    // Fall through to original file
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  return [{ width: 0, blob: file, contentType: file.type, ext }];
}

// ─── FOLDER STRUCTURE PATH BUILDERS ──────────────────────────────────────────

function sanitizeFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9._-]/g, '');
}

/**
 * Builds standard storage path for product assets:
 * products/{productId}/{timestamp}-{filename}
 */
export function buildProductImagePath(productId: string, filename: string): string {
  const cleanId = sanitizeFilename(productId || 'uncategorized');
  const cleanName = sanitizeFilename(filename);
  return `products/${cleanId}/${Date.now()}-${cleanName}`;
}

/**
 * Builds standard storage path for seasonal hero banners:
 * hero/{timestamp}-{filename}
 */
export function buildHeroImagePath(filename: string): string {
  const cleanName = sanitizeFilename(filename);
  return `hero/${Date.now()}-${cleanName}`;
}

/**
 * Builds standard storage path for editorial lookbooks:
 * lookbook/{timestamp}-{filename}
 */
export function buildLookbookImagePath(filename: string): string {
  const cleanName = sanitizeFilename(filename);
  return `lookbook/${Date.now()}-${cleanName}`;
}

// ─── UPLOAD HELPER ────────────────────────────────────────────────────────────

export type MediaFolder = 'products' | 'hero' | 'lookbook';

/**
 * Uploads a file to the Supabase Storage bucket under the structured folder hierarchy
 * with immutable 1-year cacheControl (`31536000`).
 */
export async function uploadMediaToStorage(
  file: File,
  folder: MediaFolder,
  subfolderId?: string,
  bucket: string = LEGACY_STORAGE_BUCKET
): Promise<{ url: string | null; path: string | null; error: string | null }> {
  try {
    let filePath: string;
    if (folder === 'products') {
      filePath = buildProductImagePath(subfolderId || 'general', file.name);
    } else if (folder === 'hero') {
      filePath = buildHeroImagePath(file.name);
    } else {
      filePath = buildLookbookImagePath(file.name);
    }

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, {
        cacheControl: '31536000', // 1 year immutable cache for versioned filenames
        upsert: false,
      });

    if (uploadError) {
      return { url: null, path: null, error: uploadError.message };
    }

    const { data: publicUrlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(uploadData.path);

    return {
      url: publicUrlData.publicUrl,
      path: uploadData.path,
      error: null,
    };
  } catch (err: any) {
    return { url: null, path: null, error: err?.message || 'Storage upload failed.' };
  }
}
