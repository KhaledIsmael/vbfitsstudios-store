import { supabase } from './supabaseClient';

/**
 * Supabase Storage Image Transformation & Optimization Helper
 *
 * Utilizes Supabase's built-in image transformation engine (libvips / ImageMagick)
 * to deliver optimized, resized, and responsive images on the fly via `srcset`,
 * completely eliminating the need for a separate paid CDN service like Cloudinary.
 *
 * Folder conventions:
 * - products/{id}/{filename}   -> Product variant photography & mockups
 * - hero/{filename}            -> Seasonal campaign hero banners
 * - lookbook/{filename}        -> Editorial lookbook stories & spreads
 */

export const STORAGE_BUCKET = 'store-media';
export const LEGACY_STORAGE_BUCKET = 'product-media';

export type ImageResizeMode = 'cover' | 'contain' | 'fill';
export type ImageFormat = 'origin' | 'webp' | 'avif';

export interface ImageTransformOptions {
  width?: number;
  height?: number;
  quality?: number; // 1 - 100, default 80
  resize?: ImageResizeMode;
  format?: ImageFormat;
}

export const RESPONSIVE_BREAKPOINTS = [320, 640, 960, 1200, 1600];

/**
 * Checks if a given URL is hosted on Supabase Storage.
 */
export function isSupabaseStorageUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  return (
    url.includes('/storage/v1/object/public/') ||
    url.includes('/storage/v1/render/image/public/')
  );
}

/**
 * Checks whether the asset is an image that can be transformed (excludes mp4, webm, svg).
 */
export function isTransformableImage(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const clean = url.split('?')[0].toLowerCase();
  if (clean.endsWith('.mp4') || clean.endsWith('.webm') || clean.endsWith('.svg')) {
    return false;
  }
  return true;
}

/**
 * Transforms a Supabase Storage URL into an optimized, resized render URL.
 * If the input is not a Supabase storage URL (e.g. local /assets/), returns the source as-is.
 *
 * @param src Storage URL, relative storage path, or public asset path
 * @param options Width, height, quality, resize mode, format
 */
export function getOptimizedImageUrl(
  src: string,
  options: ImageTransformOptions = {}
): string {
  if (!src || typeof src !== 'string') return '';
  if (!isTransformableImage(src)) return src;

  const { width, height, quality = 80, resize, format } = options;

  // Case 1: Relative storage path like "products/p-1/front.jpg"
  if (!src.startsWith('http://') && !src.startsWith('https://') && !src.startsWith('/')) {
    const supabaseUrl =
      (import.meta.env.VITE_SUPABASE_URL as string) ||
      'https://nsdurxslkhxqjwlbcpxc.supabase.co';

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

      // Convert standard object URL to render endpoint
      if (urlObj.pathname.includes('/storage/v1/object/public/')) {
        urlObj.pathname = urlObj.pathname.replace(
          '/storage/v1/object/public/',
          '/storage/v1/render/image/public/'
        );
      }

      // Apply transformation query parameters
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

  // Case 3: Local or external asset (e.g. /assets/products/black-shirt.jpeg)
  return src;
}

/**
 * Generates an HTML `srcset` attribute string with responsive widths for high-DPI
 * screens and mobile devices.
 *
 * Example output:
 * "https://.../img.jpg?width=320 320w, https://.../img.jpg?width=640 640w, ..."
 *
 * @param src Image URL or path
 * @param widths Array of pixel widths (defaults to [320, 640, 960, 1200, 1600])
 * @param options Quality, resize mode, format
 */
export function getResponsiveSrcSet(
  src: string,
  widths: number[] = RESPONSIVE_BREAKPOINTS,
  options: Omit<ImageTransformOptions, 'width'> = {}
): string {
  if (!src || !isSupabaseStorageUrl(src)) {
    // If not on Supabase Storage, srcset cannot be generated dynamically
    return '';
  }

  return widths
    .map((w) => {
      const transformedUrl = getOptimizedImageUrl(src, { ...options, width: w });
      return `${transformedUrl} ${w}w`;
    })
    .join(', ');
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
 * Uploads a file to the Supabase Storage bucket under the structured folder hierarchy.
 *
 * @param file File object to upload
 * @param folder 'products' | 'hero' | 'lookbook'
 * @param subfolderId Required for 'products' folder (e.g. product UUID or slug)
 * @param bucket Optional bucket override (defaults to 'store-media')
 */
export async function uploadMediaToStorage(
  file: File,
  folder: MediaFolder,
  subfolderId?: string,
  bucket: string = STORAGE_BUCKET
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
        cacheControl: '31536000', // 1 year immutable cache
        upsert: true
      });

    if (uploadError) {
      // Try fallback to legacy bucket 'product-media' if 'store-media' is pending migration
      if (bucket === STORAGE_BUCKET) {
        const fallback = await uploadMediaToStorage(file, folder, subfolderId, LEGACY_STORAGE_BUCKET);
        if (fallback.url) return fallback;
      }
      return { url: null, path: null, error: uploadError.message };
    }

    const { data: publicUrlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(uploadData.path);

    return {
      url: publicUrlData.publicUrl,
      path: uploadData.path,
      error: null
    };
  } catch (err: any) {
    return { url: null, path: null, error: err?.message || 'Storage upload failed.' };
  }
}
