import React from 'react';
import {
  getOptimizedImageUrl,
  getResponsiveSrcSet,
  createSafeImageErrorHandler,
  DEFAULT_PRODUCT_FALLBACK,
  DEFAULT_HERO_FALLBACK
} from '../../lib/image';

export type ProductImagePlacement =
  | 'grid'         // Catalog and shop product cards
  | 'pdp-main'     // PDP main primary gallery viewer
  | 'pdp-thumb'    // PDP thumbnail rail item
  | 'cart'         // Cart drawer thumbnail
  | 'quick-view'   // Quick view / quick add preview
  | 'hero'         // Full bleed homepage hero banner
  | 'sticky-bar';  // Sticky add-to-cart bar thumbnail

export interface ProductImageProps {
  src: string;
  alt: string;
  placement?: ProductImagePlacement;
  secondarySrc?: string;
  secondaryAlt?: string;
  className?: string;
  imageClassName?: string;
  loading?: 'lazy' | 'eager';
  decoding?: 'async' | 'sync' | 'auto';
  fetchPriority?: 'high' | 'low' | 'auto';
  width?: number;
  height?: number;
  children?: React.ReactNode;
}

/**
 * Shared ProductImage Component
 *
 * Enforces:
 * 1. White background token (`bg-white`)
 * 2. Strict aspect ratio per placement (`aspect-[2/3]` per REFERENCE-SPEC)
 * 3. Never-cropped garment presentation via `object-contain object-center` + consistent padding
 * 4. Presentation-layer `mix-blend-multiply` for seamless white edge blending
 * 5. Pointer:fine hover image swap when secondarySrc is provided
 */
export const ProductImage: React.FC<ProductImageProps> = ({
  src,
  alt,
  placement = 'grid',
  secondarySrc,
  secondaryAlt,
  className = '',
  imageClassName = '',
  loading = 'lazy',
  decoding = 'async',
  fetchPriority = 'auto',
  width,
  height,
  children,
}) => {
  // Container styling configuration per placement
  let containerClasses = 'relative bg-white overflow-hidden ';
  let primaryImgClasses = 'w-full h-full pointer-events-none ';
  let defaultWidth = width || 600;
  let defaultHeight = height || 900;
  let sizesAttr = '(max-width: 640px) 50vw, (max-width: 1280px) 33vw, 25vw';
  let targetWidth = 800;

  switch (placement) {
    case 'hero':
      containerClasses += 'w-full h-full ';
      primaryImgClasses += 'object-cover object-center ';
      defaultWidth = width || 1920;
      defaultHeight = height || 860;
      sizesAttr = '100vw';
      targetWidth = 1600;
      break;

    case 'pdp-main':
      containerClasses += 'w-full aspect-[3/4] flex items-center justify-center ';
      primaryImgClasses += 'object-contain object-center p-4 sm:p-6 mix-blend-multiply ';
      defaultWidth = width || 600;
      defaultHeight = height || 800;
      sizesAttr = '(max-width: 640px) 100vw, 50vw';
      targetWidth = 1200;
      break;

    case 'pdp-thumb':
      containerClasses += 'w-full aspect-[2/3] flex items-center justify-center ';
      primaryImgClasses += 'object-contain object-center p-1.5 mix-blend-multiply ';
      defaultWidth = width || 120;
      defaultHeight = height || 180;
      sizesAttr = '120px';
      targetWidth = 480;
      break;

    case 'cart':
      containerClasses += 'w-20 h-28 aspect-[2/3] flex-shrink-0 flex items-center justify-center ';
      primaryImgClasses += 'object-contain object-center p-1.5 mix-blend-multiply ';
      defaultWidth = width || 80;
      defaultHeight = height || 112;
      sizesAttr = '80px';
      targetWidth = 480;
      break;

    case 'sticky-bar':
      containerClasses += 'w-10 h-14 aspect-[2/3] flex-shrink-0 flex items-center justify-center ';
      primaryImgClasses += 'object-contain object-center p-1 mix-blend-multiply ';
      defaultWidth = width || 40;
      defaultHeight = height || 56;
      sizesAttr = '40px';
      targetWidth = 480;
      break;

    case 'quick-view':
    case 'grid':
    default:
      containerClasses += 'w-full aspect-[2/3] flex items-center justify-center ';
      primaryImgClasses += 'object-contain object-center p-4 sm:p-6 mix-blend-multiply card-img-primary ';
      if (secondarySrc) {
        primaryImgClasses += 'has-secondary ';
      }
      sizesAttr = '(max-width: 640px) 50vw, (max-width: 1280px) 33vw, 25vw';
      targetWidth = 480;
      break;
  }

  const fallbackSrc = placement === 'hero' ? DEFAULT_HERO_FALLBACK : DEFAULT_PRODUCT_FALLBACK;
  const optimizedPrimary = getOptimizedImageUrl(src, { width: targetWidth });
  const primarySrcSet = getResponsiveSrcSet(src);
  const optimizedSecondary = secondarySrc ? getOptimizedImageUrl(secondarySrc, { width: 480 }) : undefined;
  const secondarySrcSet = secondarySrc ? getResponsiveSrcSet(secondarySrc) : '';

  return (
    <div className={`${containerClasses} ${className}`.trim()}>
      {/* Primary Image */}
      <img
        src={optimizedPrimary || fallbackSrc}
        srcSet={primarySrcSet || undefined}
        sizes={primarySrcSet ? sizesAttr : undefined}
        alt={alt}
        loading={loading}
        decoding={decoding}
        fetchPriority={fetchPriority}
        width={defaultWidth}
        height={defaultHeight}
        onError={createSafeImageErrorHandler(fallbackSrc)}
        className={`${primaryImgClasses} luxury-image-zoom ${imageClassName}`.trim()}
      />

      {/* Optional Secondary Image for pointer:fine hover swap */}
      {optimizedSecondary && placement === 'grid' && (
        <img
          src={optimizedSecondary}
          srcSet={secondarySrcSet || undefined}
          sizes={secondarySrcSet ? sizesAttr : undefined}
          alt={secondaryAlt || `${alt} alternate`}
          loading="lazy"
          decoding="async"
          width={defaultWidth}
          height={defaultHeight}
          onError={createSafeImageErrorHandler(fallbackSrc)}
          className="w-full h-full object-cover object-center pointer-events-none absolute inset-0 card-img-secondary luxury-image-zoom"
        />
      )}

      {/* Children slots: badges, wishlist toggle, quick add, etc. */}
      {children}
    </div>
  );
};
