import React, { useRef, useEffect, useCallback } from 'react';
import type { MediaItem } from '../../config/assets';

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
      className={`relative flex-shrink-0 w-20 h-24 sm:w-full sm:h-28 bg-[#FAFAFA] overflow-hidden border transition-all duration-200 focus-visible:outline-2 focus-visible:outline-black ${
        isSelected
          ? 'border-black'
          : 'border-[#EAEAEA] opacity-60 hover:opacity-100 hover:border-[#CCCCCC]'
      }`}
    >
      <img
        src={thumbSrc}
        alt={item.altText || `${productName} view ${index + 1}`}
        className="w-full h-full object-contain p-1.5 mix-blend-multiply"
        draggable={false}
        loading="lazy"
        decoding="async"
        width={96}
        height={112}
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

  return (
    <div className="flex-1 bg-[#FAFAFA] aspect-[4/5] overflow-hidden relative group">
      {item.type === 'video' ? (
        /* ── Video player — autoplay, muted, looped ── */
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
      ) : (
        /* ── Image / GIF ── */
        <img
          key={item.url}
          src={item.url}
          alt={item.altText || productName}
          className={`w-full h-full object-contain p-8 sm:p-12 transition-transform duration-700 mix-blend-multiply ${
            item.type === 'gif' ? '' : 'group-hover:scale-105'
          }`}
          draggable={false}
          loading="lazy"
          decoding="async"
          width={800}
          height={1000}
        />
      )}

      {/* ── "PLAYING" indicator strip for video ── */}
      {item.type === 'video' && (
        <div className="absolute bottom-0 left-0 right-0 px-4 py-2 bg-gradient-to-t from-black/30 to-transparent flex items-center gap-1.5 pointer-events-none">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
          <span className="text-[9px] uppercase tracking-widest text-white/90 font-mono">
            Playing
          </span>
        </div>
      )}

      {/* Slot — e.g. wishlist button */}
      {viewerSlot && (
        <div className="absolute top-4 right-4">{viewerSlot}</div>
      )}
    </div>
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
  // Synthesise a 1-item fallback so we never render an empty gallery
  const items: MediaItem[] =
    mediaItems.length > 0
      ? mediaItems
      : [{ url: '/assets/products/black-shirt.jpeg', type: 'image', displayOrder: 0 }];

  // Clamp selectedIndex in case it's stale after colorway switch
  const safeIndex = Math.min(selectedIndex, items.length - 1);
  const activeItem = items[safeIndex];

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
    /*
     * Layout:
     *  Mobile  → column-reverse so thumbnails appear below viewer (flex-col-reverse)
     *  Desktop → row with thumbnail rail on the left (sm:flex-row)
     */
    <div
      className="flex flex-col-reverse sm:flex-row gap-4 sm:gap-6"
      onKeyDown={handleKeyDown}
      aria-label={`${productName} gallery`}
    >
      {/* ── Thumbnail Rail ── */}
      <div
        role="listbox"
        aria-label="Select media item"
        aria-orientation="vertical"
        className="flex sm:flex-col gap-3 overflow-x-auto sm:overflow-y-auto sm:w-24 flex-shrink-0 pb-1 sm:pb-0 sm:max-h-[600px]"
      >
        {items.map((item, idx) => (
          <Thumbnail
            key={`${item.url}-${idx}`}
            item={item}
            index={idx}
            isSelected={idx === safeIndex}
            productName={productName}
            onClick={() => onSelect(idx)}
          />
        ))}
      </div>

      {/* ── Primary Viewer ── */}
      <PrimaryViewer
        item={activeItem}
        productName={productName}
        viewerSlot={viewerSlot}
      />
    </div>
  );
};
