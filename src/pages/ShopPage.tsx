import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getFilteredProducts, getCategories, type Product } from '../lib/products';
import { ProductCard } from '../components/ui/ProductCard';
import { ProductGridSkeleton } from '../components/ui/SkeletonCard';
import { FilterSortBar } from '../components/shop/FilterSortBar';
import { RecentlyViewedRail } from '../components/shop/RecentlyViewedRail';

// ─── Back-to-Top Button ───────────────────────────────────────────────────────
const BackToTop: React.FC = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 600);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Back to top"
      className={`fixed bottom-8 right-6 z-30 w-10 h-10 bg-[#111111] text-white flex items-center justify-center shadow-lg hover:bg-black transition-all duration-300 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
      }`}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <polyline points="18 15 12 9 6 15" />
      </svg>
    </button>
  );
};

// ─── URL param helpers ────────────────────────────────────────────────────────
function parseList(v: string | null): string[] {
  if (!v) return [];
  return v.split(',').filter(Boolean);
}

function serializeList(arr: string[]): string {
  return arr.join(',');
}

// ─── Shop Page ────────────────────────────────────────────────────────────────
export const ShopPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  // ── Filter state — initialised from URL params ──────────────────────────────
  const [collectionFilter, setCollectionFilterRaw] = useState<'all' | 'new' | 'black' | 'white'>(
    (searchParams.get('collection') as any) || 'all'
  );
  const [selectedCategory, setSelectedCategoryRaw] = useState<string>(
    searchParams.get('category') || 'all'
  );
  const [maxPrice, setMaxPriceRaw] = useState<number>(
    Number(searchParams.get('maxPrice') || 500)
  );
  const [selectedSizes, setSelectedSizesRaw] = useState<string[]>(
    parseList(searchParams.get('sizes'))
  );
  const [selectedColors, setSelectedColorsRaw] = useState<string[]>(
    parseList(searchParams.get('colors'))
  );
  const [inStockOnly, setInStockOnlyRaw] = useState<boolean>(
    searchParams.get('inStock') === '1'
  );
  const [sortBy, setSortByRaw] = useState<string>(
    searchParams.get('sort') || 'newest'
  );
  const [gridCols, setGridCols] = useState<2 | 4>(4);

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isQuerying, setIsQuerying] = useState<boolean>(false);

  const [categories, setCategories] = useState<Array<{ id: string; name: string; slug: string }>>([
    { id: 'all', name: 'All Categories', slug: 'all' }
  ]);

  // ── Sync filter state → URL (replaces history so back button works cleanly) ──
  const syncUrl = useCallback((updates: Record<string, string | null>) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      Object.entries(updates).forEach(([k, v]) => {
        if (!v || v === 'all' || v === '500' || v === '' || v === '0') {
          next.delete(k);
        } else {
          next.set(k, v);
        }
      });
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  // Wrapped setters that update both state and URL
  const setCollectionFilter = (v: typeof collectionFilter) => {
    setCollectionFilterRaw(v);
    syncUrl({ collection: v });
  };
  const setSelectedCategory = (v: string) => {
    setSelectedCategoryRaw(v);
    syncUrl({ category: v });
  };
  const setMaxPrice = (v: number) => {
    setMaxPriceRaw(v);
    syncUrl({ maxPrice: String(v) });
  };
  const setSelectedSizes = (v: string[] | ((prev: string[]) => string[])) => {
    setSelectedSizesRaw((prev) => {
      const next = typeof v === 'function' ? v(prev) : v;
      syncUrl({ sizes: serializeList(next) });
      return next;
    });
  };
  const setSelectedColors = (v: string[] | ((prev: string[]) => string[])) => {
    setSelectedColorsRaw((prev) => {
      const next = typeof v === 'function' ? v(prev) : v;
      syncUrl({ colors: serializeList(next) });
      return next;
    });
  };
  const setInStockOnly = (v: boolean) => {
    setInStockOnlyRaw(v);
    syncUrl({ inStock: v ? '1' : null });
  };
  const setSortBy = (v: string) => {
    setSortByRaw(v);
    syncUrl({ sort: v === 'newest' ? null : v });
  };

  // Load categories once
  useEffect(() => {
    getCategories().then((cats) => {
      if (cats?.length) setCategories(cats);
    });
  }, []);

  // Fetch products on filter change
  useEffect(() => {
    let isCurrent = true;
    setIsQuerying(true);

    getFilteredProducts({
      collectionFilter,
      category: selectedCategory,
      maxPrice,
      sizes: selectedSizes,
      colors: selectedColors,
      inStockOnly,
      sortBy: sortBy as any
    }).then((data) => {
      if (isCurrent) {
        setProducts(data);
        setLoading(false);
        setIsQuerying(false);
      }
    });

    return () => { isCurrent = false; };
  }, [collectionFilter, selectedCategory, maxPrice, selectedSizes, selectedColors, inStockOnly, sortBy]);

  const handleToggleSize = (size: string) =>
    setSelectedSizes((prev) => prev.includes(size) ? prev.filter((s) => s !== size) : [...prev, size]);

  const handleToggleColor = (color: string) =>
    setSelectedColors((prev) => prev.includes(color) ? prev.filter((c) => c !== color) : [...prev, color]);

  const handleResetFilters = () => {
    setSelectedCategoryRaw('all');
    setMaxPriceRaw(500);
    setSelectedSizesRaw([]);
    setSelectedColorsRaw([]);
    setInStockOnlyRaw(false);
    syncUrl({ category: null, maxPrice: null, sizes: null, colors: null, inStock: null });
  };

  const handleResetAll = () => {
    setCollectionFilterRaw('all');
    handleResetFilters();
    syncUrl({ collection: null, sort: null });
  };

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedCategory !== 'all') count += 1;
    if (maxPrice < 500) count += 1;
    count += selectedSizes.length;
    count += selectedColors.length;
    if (inStockOnly) count += 1;
    return count;
  }, [selectedCategory, maxPrice, selectedSizes, selectedColors, inStockOnly]);

  return (
    <div className="pt-24 sm:pt-32 min-h-screen bg-white">
      {/* Page Header */}
      <div className="max-w-[1720px] mx-auto px-6 sm:px-10 lg:px-16">
        <div className="border-b border-[#EAEAEA] pb-8 pt-4">
          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4">
            <div>
              <p className="text-[10px] text-[#888888] tracking-luxury uppercase mb-2">
                VB Fits Studios / Ready-to-Wear Catalog
              </p>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-light uppercase tracking-wider text-[#111111]">
                Ready-to-Wear
              </h1>
            </div>
            <div className="flex items-center gap-4">
              {(loading || isQuerying) ? (
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                  <p className="text-xs text-[#777777] uppercase tracking-wider">Updating Silhouettes...</p>
                </div>
              ) : (
                <p className="text-xs text-[#777777] uppercase tracking-wider">
                  {products.length} Items Available
                </p>
              )}

              {/* Grid density toggle */}
              <div className="hidden sm:flex items-center border border-[#EAEAEA] p-0.5" role="group" aria-label="Grid layout density">
                <button
                  type="button"
                  onClick={() => setGridCols(2)}
                  title="2-Column Editorial View"
                  aria-label="2-column editorial view"
                  aria-pressed={gridCols === 2}
                  className={`p-1.5 transition-colors focus-visible:ring-2 focus-visible:ring-black ${
                    gridCols === 2
                      ? 'bg-black text-white'
                      : 'text-[#888888] hover:text-black'
                  }`}
                >
                  <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5" aria-hidden="true">
                    <rect x="1.5" y="2" width="5.5" height="12" rx="0.5" />
                    <rect x="9" y="2" width="5.5" height="12" rx="0.5" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => setGridCols(4)}
                  title="4-Column Grid View"
                  aria-label="4-column grid view"
                  aria-pressed={gridCols === 4}
                  className={`p-1.5 transition-colors focus-visible:ring-2 focus-visible:ring-black ${
                    gridCols === 4
                      ? 'bg-black text-white'
                      : 'text-[#888888] hover:text-black'
                  }`}
                >
                  <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5" aria-hidden="true">
                    <rect x="1" y="2" width="2.5" height="12" rx="0.5" />
                    <rect x="5" y="2" width="2.5" height="12" rx="0.5" />
                    <rect x="9" y="2" width="2.5" height="12" rx="0.5" />
                    <rect x="13" y="2" width="2.5" height="12" rx="0.5" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter/Sort Bar */}
      <FilterSortBar
        collectionFilter={collectionFilter}
        onSelectCollectionFilter={setCollectionFilter}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
        categories={categories}
        maxPrice={maxPrice}
        onMaxPriceChange={setMaxPrice}
        selectedSizes={selectedSizes}
        onToggleSize={handleToggleSize}
        selectedColors={selectedColors}
        onToggleColor={handleToggleColor}
        inStockOnly={inStockOnly}
        onToggleInStock={setInStockOnly}
        sortBy={sortBy}
        onSortChange={setSortBy}
        onResetFilters={handleResetFilters}
        activeFilterCount={activeFilterCount}
        totalResults={products.length}
        isQuerying={isQuerying}
      />

      <div className="max-w-[1720px] mx-auto px-6 sm:px-10 lg:px-16">
        <div className="pt-10 pb-20 relative min-h-[400px]">
          {/* Skeleton */}
          {loading || isQuerying ? (
            <ProductGridSkeleton count={8} />
          ) : products.length === 0 ? (
            /* Empty state */
            <div className="py-20 sm:py-24 text-center border border-[#EAEAEA] bg-[#FAFAFA] my-8 px-6 sm:px-12 max-w-2xl mx-auto shadow-sm animate-fade-in">
              <div className="w-12 h-12 mx-auto mb-5 rounded-full border border-black/15 flex items-center justify-center bg-white text-[#111111]">
                <svg className="w-5 h-5 text-[#222222]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M12 3c2.755 0 5.455.232 8.083.678.539.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.378-1.007.917-1.096A48.32 48.32 0 0112 3z" />
                </svg>
              </div>
              <span className="text-[10px] uppercase tracking-luxury text-[#888888] block font-mono">Catalog Query · 0 Results</span>
              <h2 className="text-xl sm:text-2xl uppercase tracking-wider text-black font-light mt-2">
                No products match your filters
              </h2>
              <p className="text-xs sm:text-sm text-[#666666] max-w-md mx-auto leading-relaxed mt-3">
                No garments in our ready-to-wear archive match your current criteria.
                Try adjusting your price ceiling, removing size or colour restrictions,
                or clearing all filters to view the full collection.
              </p>

              {/* Active filter chips */}
              {(activeFilterCount > 0 || collectionFilter !== 'all') && (
                <div className="flex flex-wrap items-center justify-center gap-2 pt-5 pb-2">
                  {collectionFilter !== 'all' && (
                    <button type="button" onClick={() => setCollectionFilter('all')}
                      className="text-[11px] font-mono px-3 py-1 bg-white border border-[#CCCCCC] hover:border-black text-black flex items-center gap-1.5 transition-colors">
                      <span>Collection: {collectionFilter}</span><span className="text-xs">×</span>
                    </button>
                  )}
                  {selectedCategory !== 'all' && (
                    <button type="button" onClick={() => setSelectedCategory('all')}
                      className="text-[11px] font-mono px-3 py-1 bg-white border border-[#CCCCCC] hover:border-black text-black flex items-center gap-1.5 transition-colors">
                      <span>Category: {selectedCategory}</span><span className="text-xs">×</span>
                    </button>
                  )}
                  {maxPrice < 500 && (
                    <button type="button" onClick={() => setMaxPrice(500)}
                      className="text-[11px] font-mono px-3 py-1 bg-white border border-[#CCCCCC] hover:border-black text-black flex items-center gap-1.5 transition-colors">
                      <span>Under ${maxPrice}</span><span className="text-xs">×</span>
                    </button>
                  )}
                  {selectedSizes.map((sz) => (
                    <button key={sz} type="button" onClick={() => handleToggleSize(sz)}
                      className="text-[11px] font-mono px-3 py-1 bg-white border border-[#CCCCCC] hover:border-black text-black flex items-center gap-1.5 transition-colors">
                      <span>Size: {sz}</span><span className="text-xs">×</span>
                    </button>
                  ))}
                  {selectedColors.map((col) => (
                    <button key={col} type="button" onClick={() => handleToggleColor(col)}
                      className="text-[11px] font-mono px-3 py-1 bg-white border border-[#CCCCCC] hover:border-black text-black flex items-center gap-1.5 transition-colors">
                      <span>Color: {col}</span><span className="text-xs">×</span>
                    </button>
                  ))}
                  {inStockOnly && (
                    <button type="button" onClick={() => setInStockOnly(false)}
                      className="text-[11px] font-mono px-3 py-1 bg-white border border-[#CCCCCC] hover:border-black text-black flex items-center gap-1.5 transition-colors">
                      <span>In Stock Only</span><span className="text-xs">×</span>
                    </button>
                  )}
                </div>
              )}

              <div className="pt-6">
                <button type="button" onClick={handleResetAll}
                  className="bg-[#111111] hover:bg-black text-white text-xs uppercase tracking-luxury py-3.5 px-8 font-medium transition-all inline-flex items-center gap-2 hover:shadow-md">
                  <span>Reset All Filters</span><span className="text-sm">↺</span>
                </button>
              </div>
            </div>
          ) : (
            <div
              className={`grid gap-x-6 sm:gap-x-8 gap-y-12 sm:gap-y-16 ${
                gridCols === 2
                  ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-2'
                  : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
              }`}
            >
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  variant={gridCols === 2 ? 'featured' : 'grid'}
                />
              ))}
            </div>
          )}
        </div>

        {/* Recently Viewed */}
        <RecentlyViewedRail />
      </div>

      {/* Back to Top */}
      <BackToTop />
    </div>
  );
};
