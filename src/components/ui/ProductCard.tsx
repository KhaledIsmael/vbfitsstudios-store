import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Product } from '../../config/assets';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { ProductImage } from './ProductImage';

interface ProductCardProps {
  product: Product;
  variant?: 'featured' | 'grid';
  showSubtitle?: boolean;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  variant = 'grid',
  showSubtitle = false
}) => {
  const isFeatured = variant === 'featured';
  const navigate = useNavigate();
  const { addItem, triggerCartBounce } = useCart();
  const { toggleSaveItem, isItemSaved } = useAuth();

  const isSaved = isItemSaved(product.id);

  const availableSizes =
    product.sizes && product.sizes.length > 0
      ? product.sizes
      : ['S', 'M', 'L', 'XL', 'XXL'];

  // Check if every size has 0 stock
  const isTotalSoldOut = product.stockBySize
    ? Object.values(product.stockBySize).length > 0 &&
      Object.values(product.stockBySize).every((qty) => qty === 0)
    : false;

  const [selectedSize, setSelectedSize] = useState<string>(() => {
    // Pick first size that is in stock if possible
    const inStock = availableSizes.find(
      (sz) => (product.stockBySize?.[sz] ?? 1) > 0
    );
    return inStock || availableSizes[0] || 'M';
  });
  const [isAdded, setIsAdded] = useState(false);
  const [showMobileQuickView, setShowMobileQuickView] = useState(false);
  const [isHolding, setIsHolding] = useState(false);

  const touchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isLongPressRef = useRef(false);
  const cardRef = useRef<HTMLDivElement | null>(null);

  // Close mobile quick-view on outside click
  useEffect(() => {
    if (!showMobileQuickView) return;

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        setShowMobileQuickView(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showMobileQuickView]);

  // Mobile Tap-and-hold (Long press) detection with jitter tolerance
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    isLongPressRef.current = false;
    touchStartPosRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    };
    setIsHolding(true);

    touchTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      setIsHolding(false);
      setShowMobileQuickView(true);

      // Subtle haptic response on supported mobile devices
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate(35);
        } catch {
          // Ignore if vibration permissions are restricted
        }
      }
    }, 350); // 350ms tap-and-hold threshold
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchTimerRef.current) return;
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const distance = Math.hypot(
      currentX - touchStartPosRef.current.x,
      currentY - touchStartPosRef.current.y
    );

    // If finger moves more than 10px, treat as scroll gesture and cancel long-press
    if (distance > 10) {
      clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
      setIsHolding(false);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    setIsHolding(false);
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }

    // If a long press was triggered, suppress default navigation click
    if (isLongPressRef.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    // Prevent browser native image context menu on long press
    if (isLongPressRef.current || isHolding) {
      e.preventDefault();
    }
  };

  const handleCardClick = (e: React.MouseEvent) => {
    if (isLongPressRef.current) {
      e.preventDefault();
      e.stopPropagation();
      isLongPressRef.current = false;
      return;
    }
    navigate(`/product/${product.id}`);
  };

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Reusing existing cart Context's addItem function & cart drawer bounce
    addItem(product, selectedSize, 1);
    triggerCartBounce();

    setIsAdded(true);
    setTimeout(() => {
      setIsAdded(false);
      setShowMobileQuickView(false);
    }, 1000);
  };

  const handleSelectSize = (e: React.MouseEvent, sz: string) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedSize(sz);
  };

  const handleCloseMobileQuickView = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowMobileQuickView(false);
  };

    // Suppress model photo on card hover so flat-lay garment design is displayed directly
    const isModelPhoto = (url?: string) =>
      url ? url.toLowerCase().includes('hero') || url.toLowerCase().includes('model') : false;

    const primaryImg = product.images.find((img) => !isModelPhoto(img)) || product.images[0];
    const secondaryImg = product.images.slice(1).find((img) => !isModelPhoto(img));

    return (
      <div
        ref={cardRef}
        role="link"
        tabIndex={0}
        aria-label={`${product.name}, ${product.currency}${product.price.toFixed(2)}`}
        onClick={handleCardClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleCardClick(e as any);
          }
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onContextMenu={handleContextMenu}
        className={`group block text-left cursor-pointer transition-transform duration-200 select-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-4 rounded-sm ${
          isHolding ? 'scale-[0.98]' : 'scale-100'
        }`}
      >
        {/* Product Image Container via shared ProductImage component */}
        <ProductImage
          src={primaryImg}
          alt={product.name}
          placement="grid"
          secondarySrc={secondaryImg}
          secondaryAlt={`${product.name} alternate view`}
        >
        {/* Badges per REFERENCE-SPEC 1.2 */}
        <div className="absolute top-3 left-3 z-10 flex flex-col gap-1 pointer-events-none">
          {isTotalSoldOut ? (
            <span className="text-[9px] tracking-spec uppercase bg-[#2D2D2D] text-white px-2 py-0.5 font-bold">
              Sold Out
            </span>
          ) : product.isNewArrival ? (
            <span className="text-[9px] tracking-spec uppercase bg-[#E4E4E4] text-[#212121] px-2 py-0.5 font-bold">
              New
            </span>
          ) : null}
        </div>

        {/* Wishlist Button */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleSaveItem(product.id);
          }}
          aria-label={isSaved ? `Remove ${product.name} from Wishlist` : `Save ${product.name} to Wishlist`}
          className={`absolute top-3 right-3 z-20 w-8 h-8 rounded-none bg-white/90 backdrop-blur-sm border border-spec-border flex items-center justify-center text-spec-text hover:bg-black hover:text-white transition-colors duration-default shadow-xs ${
            isSaved ? 'opacity-100 bg-black text-white' : 'opacity-0 group-hover:opacity-100 focus:opacity-100'
          }`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill={isSaved ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
          </svg>
        </button>

        {/* ───────────────────────────────────────────────────────────── */}
        {/* QUICK-VIEW OVERLAY: Hover on Desktop / Tap-and-Hold on Mobile */}
        {/* ───────────────────────────────────────────────────────────── */}
        <div
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          className={`absolute inset-x-0 bottom-0 bg-white border-t border-spec-border p-3 sm:p-4 transition-all duration-300 z-20 flex flex-col gap-2.5 ${
            showMobileQuickView
              ? 'opacity-100 translate-y-0 pointer-events-auto shadow-xl'
              : 'opacity-0 translate-y-2 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto'
          }`}
        >
          {/* Header row in quick-view */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-spec text-spec-muted font-bold font-spec">
              Quick Add · Size
            </span>
            {showMobileQuickView && (
              <button
                type="button"
                onClick={handleCloseMobileQuickView}
                className="text-spec-muted hover:text-black text-xs p-1 font-mono leading-none"
                aria-label="Dismiss Quick View"
              >
                ✕
              </button>
            )}
          </div>

          {/* Sizes Selector */}
          <div className="flex flex-wrap gap-1.5">
            {availableSizes.map((sz) => {
              const szStock = product.stockBySize?.[sz];
              const isSzOos = szStock !== undefined && szStock === 0;
              return (
                <button
                  key={sz}
                  type="button"
                  disabled={isSzOos}
                  onClick={(e) => !isSzOos && handleSelectSize(e, sz)}
                  className={`relative h-7 min-w-[30px] px-2 text-[10px] font-mono uppercase transition-colors flex items-center justify-center border rounded-none ${
                    isSzOos
                      ? 'border-spec-border bg-[#FAFAFA] text-spec-inactive cursor-not-allowed'
                      : selectedSize === sz
                      ? 'border-black bg-spec-btn-primary text-white font-bold'
                      : 'border-spec-border bg-white text-spec-text hover:border-black'
                  }`}
                >
                  {isSzOos && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-0 pointer-events-none"
                      style={{
                        background:
                          'linear-gradient(to top right, transparent calc(50% - 0.5px), #D0D0D0 calc(50% - 0.5px), #D0D0D0 calc(50% + 0.5px), transparent calc(50% + 0.5px))',
                      }}
                    />
                  )}
                  <span className="relative">{sz}</span>
                </button>
              );
            })}
          </div>

          {/* Add to Cart Button */}
          <button
            type="button"
            disabled={isTotalSoldOut}
            onClick={handleAddToCart}
            className={`w-full py-2.5 px-3 text-[11px] uppercase tracking-spec font-spec transition-colors duration-default flex items-center justify-center gap-2 rounded-none ${
              isTotalSoldOut
                ? 'bg-spec-badge-restock text-white cursor-not-allowed'
                : isAdded
                ? 'bg-black text-white'
                : 'bg-spec-btn-primary hover:bg-black text-white'
            }`}
          >
            {isTotalSoldOut ? (
              <span>Sold Out</span>
            ) : isAdded ? (
              <>
                <span>Added to Bag</span>
                <span>✓</span>
              </>
            ) : (
              <span>
                Add to Bag — {product.currency}{product.price.toFixed(0)}
              </span>
            )}
          </button>
        </div>
      </ProductImage>

      {/* Product Information: image, title (single line, uppercase, truncate with ellipsis), price */}
      <div className="mt-3 sm:mt-4 space-y-1">
        <h3
          title={product.name}
          className="font-spec font-bold text-[12px] uppercase text-spec-text tracking-spec truncate block"
        >
          {product.name}
        </h3>

        <p className="font-spec font-normal text-[12px] sm:text-[13px] uppercase text-spec-muted tracking-spec">
          {product.currency}{product.price.toFixed(2)}
        </p>
      </div>
    </div>
  );
};
