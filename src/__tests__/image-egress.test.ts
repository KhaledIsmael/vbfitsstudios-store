import { describe, it, expect } from 'vitest';
import {
  getOptimizedImageUrl,
  getResponsiveSrcSet,
  isPrivateStorageUrl,
  isSupabaseStorageUrl,
  createSafeImageErrorHandler,
  DEFAULT_PRODUCT_FALLBACK,
  SUPABASE_IMAGE_TRANSFORMS_ENABLED,
} from '../lib/image';

describe('Image optimization & egress safety', () => {
  it('defaults to Free-Plan safe mode (transforms disabled)', () => {
    expect(SUPABASE_IMAGE_TRANSFORMS_ENABLED).toBe(false);
  });

  it('never emits paid-only /storage/v1/render/image/public/ URLs when transforms are disabled', () => {
    const raw =
      'https://nsdurxslkhxqjwlbcpxc.supabase.co/storage/v1/object/public/product-media/products/1792341737765-img_7485.png';
    const out = getOptimizedImageUrl(raw, { width: 480, format: 'webp' });
    expect(out).toBe(raw);
    expect(out).not.toContain('/render/image/public/');
  });

  it('normalizes accidental /render/image/public/ URLs back to /object/public/', () => {
    const broken =
      'https://nsdurxslkhxqjwlbcpxc.supabase.co/storage/v1/render/image/public/product-media/products/test.jpg?width=320&quality=80';
    const out = getOptimizedImageUrl(broken, { width: 480 });
    expect(out).toBe(
      'https://nsdurxslkhxqjwlbcpxc.supabase.co/storage/v1/object/public/product-media/products/test.jpg'
    );
  });

  it('returns empty srcset for legacy single-file Supabase objects (no 404s or broken transforms)', () => {
    const legacy =
      'https://nsdurxslkhxqjwlbcpxc.supabase.co/storage/v1/object/public/product-media/products/1792341737765-img_7485.png';
    expect(getResponsiveSrcSet(legacy)).toBe('');
  });

  it('emits responsive srcset for pre-uploaded multi-width WebP Supabase objects', () => {
    const multi =
      'https://nsdurxslkhxqjwlbcpxc.supabase.co/storage/v1/object/public/product-media/products/1799999999999-shirt-1200w.webp';
    const srcset = getResponsiveSrcSet(multi);
    expect(srcset).toContain('-480w.webp 480w');
    expect(srcset).toContain('-800w.webp 800w');
    expect(srcset).toContain('-1200w.webp 1200w');
    expect(srcset).not.toContain('/render/image/public/');
  });

  it('maps local /assets/ JPEGs to pre-generated WebP and emits local srcset', () => {
    expect(getOptimizedImageUrl('/assets/products/black-shirt.jpeg', { width: 480 })).toBe(
      '/assets/products/black-shirt-480w.webp'
    );
    expect(getOptimizedImageUrl('/assets/hero/hero.jpg', { width: 800 })).toBe(
      '/assets/hero/hero-800w.webp'
    );
    const heroSrcSet = getResponsiveSrcSet('/assets/hero/hero.webp');
    expect(heroSrcSet).toContain('/assets/hero/hero-480w.webp 480w');
    expect(heroSrcSet).toContain('/assets/hero/hero-800w.webp 800w');
    expect(heroSrcSet).toContain('/assets/hero/hero.webp 1376w');
  });

  it('never rewrites or generates srcset for private/signed return-photos URLs', () => {
    const signed =
      'https://nsdurxslkhxqjwlbcpxc.supabase.co/storage/v1/object/sign/return-photos/returns/u1/o1/photo.jpg?token=abc';
    expect(isPrivateStorageUrl(signed)).toBe(true);
    expect(isSupabaseStorageUrl(signed)).toBe(false);
    expect(getOptimizedImageUrl(signed, { width: 320 })).toBe(signed);
    expect(getResponsiveSrcSet(signed)).toBe('');
  });

  it('createSafeImageErrorHandler swaps once and clears onerror to prevent infinite loops', () => {
    const handler = createSafeImageErrorHandler(DEFAULT_PRODUCT_FALLBACK);
    const fakeImg: any = {
      src: 'https://example.com/broken.png',
      srcset: 'https://example.com/broken-480w.png 480w',
      onerror: () => {},
      dataset: {},
    };
    handler({ currentTarget: fakeImg } as any);
    expect(fakeImg.onerror).toBeNull();
    expect(fakeImg.srcset).toBe('');
    expect(fakeImg.src).toBe(DEFAULT_PRODUCT_FALLBACK);
    expect(fakeImg.dataset.fallbackApplied).toBe('1');

    // Second invocation is a no-op
    fakeImg.src = '/something-else';
    handler({ currentTarget: fakeImg } as any);
    expect(fakeImg.src).toBe('/something-else');
  });
});
