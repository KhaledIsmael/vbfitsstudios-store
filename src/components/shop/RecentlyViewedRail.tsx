import React, { useEffect, useState, useRef } from 'react';
import { getRecentlyViewedIds, clearRecentlyViewed } from '../../lib/recentlyViewed';
import { getProductsByIds, type Product } from '../../lib/products';
import { ProductCard } from '../ui/ProductCard';
import { ProductCardSkeleton } from '../ui/SkeletonCard';

export const RecentlyViewedRail: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const railRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ids = getRecentlyViewedIds();
    if (ids.length === 0) {
      setProducts([]);
      return;
    }

    setLoading(true);
    getProductsByIds(ids)
      .then((items) => {
        setProducts(items);
      })
      .catch((err) => {
        console.warn('Failed to fetch recently viewed products:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const handleScroll = (direction: 'left' | 'right') => {
    if (railRef.current) {
      const scrollAmount = direction === 'left' ? -340 : 340;
      railRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const handleClear = () => {
    clearRecentlyViewed();
    setProducts([]);
  };

  // If not loading and no recently viewed products, do not render section
  if (!loading && products.length === 0) {
    return null;
  }

  return (
    <section className="mt-16 sm:mt-24 pt-12 pb-16 border-t border-[#EAEAEA]">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <span className="text-[10px] text-[#888888] tracking-luxury uppercase font-mono block mb-1">
            Personal Session · Archive History
          </span>
          <div className="flex items-baseline gap-3">
            <h2 className="text-2xl sm:text-3xl font-light uppercase tracking-wider text-[#111111]">
              Recently Viewed
            </h2>
            <span className="text-xs text-[#888888] font-mono">
              ({loading ? '...' : `${products.length} Items`})
            </span>
          </div>
        </div>

        {/* Action buttons & scroll controls */}
        <div className="flex items-center gap-3 self-end sm:self-auto">
          {products.length > 0 && !loading && (
            <button
              type="button"
              onClick={handleClear}
              className="text-[11px] font-mono text-[#888888] hover:text-black uppercase tracking-wider transition-colors mr-2 underline underline-offset-4"
            >
              Clear History
            </button>
          )}

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleScroll('left')}
              className="w-8 h-8 rounded-none border border-[#EAEAEA] hover:border-black flex items-center justify-center text-black text-xs transition-colors bg-white"
              aria-label="Scroll left"
            >
              ←
            </button>
            <button
              type="button"
              onClick={() => handleScroll('right')}
              className="w-8 h-8 rounded-none border border-[#EAEAEA] hover:border-black flex items-center justify-center text-black text-xs transition-colors bg-white"
              aria-label="Scroll right"
            >
              →
            </button>
          </div>
        </div>
      </div>

      {/* Horizontal Rail */}
      <div
        ref={railRef}
        className="flex gap-5 sm:gap-6 overflow-x-auto pb-4 scroll-smooth snap-x snap-mandatory scrollbar-none -mx-6 px-6 sm:-mx-10 sm:px-10 lg:-mx-16 lg:px-16"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {loading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="min-w-[240px] sm:min-w-[280px] max-w-[280px] flex-shrink-0 snap-start"
            >
              <ProductCardSkeleton variant="grid" />
            </div>
          ))
        ) : (
          products.map((product) => (
            <div
              key={product.id}
              className="min-w-[240px] sm:min-w-[280px] max-w-[280px] flex-shrink-0 snap-start"
            >
              <ProductCard product={product} variant="grid" />
            </div>
          ))
        )}
      </div>
    </section>
  );
};
