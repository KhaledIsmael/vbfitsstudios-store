import React, { useRef, useEffect, useCallback } from 'react';
import type { MediaItem } from '../../config/assets';
import { ProductImage } from './ProductImage';

interface ProductGalleryProps {
  /** Rich media items — images, GIFs, and optional video. 4–6 items max. */
  mediaItems: MediaItem[];
  productName: string;
  /** Controlled: parent drives the selected index when colorway changes */
  selectedIndex: number;
  onSelect: (index: number) => void;
  /** Rendered inside the primary viewer (e.g. wishlist button) */
  viewerSlot?: React.ReactNode;
}

// ─── Play icon overlay for video thumbnails ───────────────────────────────────
const VideoPlayBadge: React.FC = () => (
  <span
    aria-hidden="true"
    className="absolute inset-0 flex items-center justify-center pointer-events-none"
  >
    {/* Frosted circle */}
    <span className="w-8 h-8 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center shadow-md">
      {/* Filled play triangle — offset slightly right to look optically centred */}
      <svg
        className="w-3 h-3 text-black translate-x-[1px]"
        viewBox="0 0 16 16"
        fill="currentColor"
        aria-label="Video"
      >
        <path d="M3 2.5v11L13 8 3 2.5z" />
      </svg>
    </span>
  </span>
);

// ─── GIF badge ────────────────────────────────────────────────────────────────
const GifBadge: React.FC = () => (
  <span
    aria-hidden="true"
    className="absolute bottom-1.5 left-1.5 text-[8px] font-mono uppercase tracking-wider bg-black/60 text-white px-1 py-0.5 leading-none pointer-events-none"
  >
    GIF
  </span>
);

// ─── Thumbnail button ─────────────────────────────────────────────────────────
interface ThumbProps {
  item: MediaItem;
  index: number;
  isSelected: boolean;
  productName: string;
  onClick: () => void;
}

const Thumbnail: React.FC<ThumbProps> = ({ item, index, isSelected, productName, onClick }) => {
  // For video items use the poster frame; for images/GIFs use the URL directly.
  const thumbSrc = item.type === 'video' ? (item.posterUrl || item.url) : item.url;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`View ${item.type === 'video' ? 'video' : `image ${index + 1}`} of ${productName}`}
      aria-pressed={isSelected}
      className={`relative flex-shrink-0 w-20 sm:w-full overflow-hidden border transition-all duration-200 focus-visible:outline-2 focus-visible:outline-black ${
        isSelected
          ? 'border-black'
          : 'border-spec-border opacity-70 hover:opacity-100 hover:border-black'
      }`}
    >
      <ProductImage
        src={thumbSrc}
        alt={item.altText || `${productName} view ${index + 1}`}
        placement="pdp-thumb"
      />
      {item.type === 'video' && <VideoPlayBadge />}
      {item.type === 'gif' && <GifBadge />}
    </button>
  );
};

// ─── Primary Viewer — image or autoplaying video ──────────────────────────────
interface PrimaryViewerProps {
  item: MediaItem;
  productName: string;
  viewerSlot?: React.ReactNode;
}

const PrimaryViewer: React.FC<PrimaryViewerProps> = ({ item, productName, viewerSlot }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Re-load and play whenever the video source changes (item key change remounts this)
  useEffect(() => {
    if (item.type === 'video' && videoRef.current) {
      videoRef.current.load();
      videoRef.current.play().catch(() => {
        // Autoplay blocked (uncommon for muted video, but guard it silently)
      });
    }
  }, [item.url, item.type]);

  if (item.type === 'video') {
    return (
      <div className="flex-1 bg-white aspect-[2/3] overflow-hidden relative group border border-spec-border">
        {/* ── Video player — autoplay, muted, looped ── */}
        <video
          ref={videoRef}
          key={item.url} // Force remount on source change → restarts from frame 0
          src={item.url}
          poster={item.posterUrl}
          autoPlay
          muted
          loop
          playsInline
          className="w-full h-full object-contain"
          aria-label={item.altText || `${productName} video`}
        />

        {/* ── "PLAYING" indicator strip for video ── */}
        <div className="absolute bottom-0 left-0 right-0 px-4 py-2 bg-gradient-to-t from-black/30 to-transparent flex items-center gap-1.5 pointer-events-none">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
          <span className="text-[9px] uppercase tracking-widest text-white/90 font-mono">
            Playing
          </span>
        </div>

        {/* Slot — e.g. wishlist button */}
        {viewerSlot && (
          <div className="absolute top-4 right-4">{viewerSlot}</div>
        )}
      </div>
    );
  }

  return (
    /* ── Image / GIF via shared ProductImage ── */
    <ProductImage
      key={item.url}
      src={item.url}
      alt={item.altText || productName}
      placement="pdp-main"
      className="flex-1 border border-spec-border"
    >
      {/* Slot — e.g. wishlist button */}
      {viewerSlot && (
        <div className="absolute top-4 right-4">{viewerSlot}</div>
      )}
    </ProductImage>
  );
};

// ─── Main Gallery Component ───────────────────────────────────────────────────
export const ProductGallery: React.FC<ProductGalleryProps> = ({
  mediaItems,
  productName,
  selectedIndex,
  onSelect,
  viewerSlot,
}) => {
  const mobileScrollRef = useRef<HTMLDivElement>(null);

  // Synthesise a 1-item fallback so we never render an empty gallery
  const items: MediaItem[] =
    mediaItems.length > 0
      ? mediaItems
      : [{ url: '/assets/products/black-shirt.jpeg', type: 'image', displayOrder: 0 }];

  // Clamp selectedIndex in case it's stale after colorway switch
  const safeIndex = Math.min(selectedIndex, items.length - 1);
  const activeItem = items[safeIndex];

  // Sync mobile scroll position when selectedIndex changes externally
  useEffect(() => {
    const el = mobileScrollRef.current;
    if (el) {
      const targetLeft = safeIndex * el.clientWidth;
      if (Math.abs(el.scrollLeft - targetLeft) > 5) {
        el.scrollTo({ left: targetLeft, behavior: 'smooth' });
      }
    }
  }, [safeIndex]);

  // Handle scroll on mobile to sync selected index
  const handleMobileScroll = () => {
    const el = mobileScrollRef.current;
    if (!el || el.clientWidth === 0) return;
    const newIdx = Math.round(el.scrollLeft / el.clientWidth);
    if (newIdx !== safeIndex && newIdx >= 0 && newIdx < items.length) {
      onSelect(newIdx);
    }
  };

  // Keyboard navigation: arrow keys cycle through items
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        onSelect((safeIndex + 1) % items.length);
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        onSelect((safeIndex - 1 + items.length) % items.length);
      }
    },
    [safeIndex, items.length, onSelect]
  );

  return (
    <div onKeyDown={handleKeyDown} aria-label={`${productName} gallery`}>
      {/* ───────────────────────────────────────────────────────────── */}
      {/* MOBILE: Native Swipe Carousel with Scroll-Snap (< sm)          */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="block sm:hidden relative w-full">
        <div
          ref={mobileScrollRef}
          onScroll={handleMobileScroll}
          className="flex overflow-x-auto snap-x snap-mandatory scrollbar-none w-full max-w-[480px] mx-auto aspect-[3/4] bg-white border border-spec-border"
          tabIndex={0}
          role="region"
          aria-label="Swipeable product images"
        >
          {items.map((item, idx) => {
            const imgSrc = item.type === 'video' ? (item.posterUrl || item.url) : item.url;
            return (
              <div
                key={`${item.url}-${idx}`}
                className="w-full h-full flex-shrink-0 snap-center relative bg-white"
              >
                {item.type === 'video' ? (
                  <video
                    src={item.url}
                    poster={item.posterUrl}
                    autoPlay
                    muted
                    loop
                    playsInline
                    className="w-full h-full object-contain"
                    aria-label={item.altText || `${productName} video`}
                  />
                ) : (
                  <ProductImage
                    src={imgSrc}
                    alt={item.altText || `${productName} view ${idx + 1}`}
                    placement="pdp-main"
                    className="w-full h-full"
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Wishlist slot in top right on mobile */}
        {viewerSlot && (
          <div className="absolute top-3 right-3 z-10">{viewerSlot}</div>
        )}

        {/* Minimalist Mobile Slide Counter per REFERENCE-SPEC 8.2 */}
        {items.length > 1 && (
          <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-sm text-white text-[10px] font-mono px-2 py-0.5 pointer-events-none tracking-widest uppercase">
            {safeIndex + 1} / {items.length}
          </div>
        )}

        {/* Slide Dots Indicator */}
        {items.length > 1 && (
          <div className="flex justify-center items-center gap-1.5 mt-3">
            {items.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onSelect(idx)}
                aria-label={`Go to slide ${idx + 1}`}
                className={`h-1 transition-all duration-300 ${
                  idx === safeIndex ? 'w-6 bg-black' : 'w-2 bg-[#D0D0D0]'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* DESKTOP: Sorvea Vertical Masonry Sequence (≥ lg)              */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="hidden sm:flex flex-col space-y-4">
        {items.map((item, idx) => {
          const imgSrc = item.type === 'video' ? (item.posterUrl || item.url) : item.url;
          return (
            <div
              key={`${item.url}-${idx}`}
              className="relative w-full max-w-[520px] mx-auto aspect-[3/4] bg-white border border-[#DDDDDD] overflow-hidden group cursor-zoom-in"
              onClick={() => onSelect(idx)}
            >
              {item.type === 'video' ? (
                <video
                  src={item.url}
                  poster={item.posterUrl}
                  autoPlay
                  muted
                  loop
                  playsInline
                  className="w-full h-full object-contain"
                  aria-label={item.altText || `${productName} video`}
                />
              ) : (
                <ProductImage
                  src={imgSrc}
                  alt={item.altText || `${productName} view ${idx + 1}`}
                  placement="pdp-main"
                  className="w-full h-full"
                />
              )}
              {idx === 0 && viewerSlot && (
                <div className="absolute top-4 right-4 z-10">{viewerSlot}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
