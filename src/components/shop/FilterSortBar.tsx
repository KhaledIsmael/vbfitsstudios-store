import React, { useState, useEffect, useRef } from 'react';
import { BRAND_CONFIG } from '../../config/assets';

function useFocusTrap(ref: React.RefObject<HTMLDivElement | null>, active: boolean) {
  useEffect(() => {
    if (!active || !ref.current) return;
    const el = ref.current;
    const SELECTOR = [
      'a[href]', 'button:not([disabled])', 'input:not([disabled])',
      'select:not([disabled])', 'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])'
    ].join(',');
    const getFocusable = () => Array.from(el.querySelectorAll<HTMLElement>(SELECTOR));
    getFocusable()[0]?.focus();
    const trap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const nodes = getFocusable();
      if (!nodes.length) return;
      const first = nodes[0]; const last = nodes[nodes.length - 1];
      if (e.shiftKey) { if (document.activeElement === first) { e.preventDefault(); last.focus(); } }
      else            { if (document.activeElement === last)  { e.preventDefault(); first.focus(); } }
    };
    el.addEventListener('keydown', trap);
    return () => el.removeEventListener('keydown', trap);
  }, [active, ref]);
}

export interface FilterSortBarProps {
  collectionFilter: 'all' | 'new' | 'black' | 'white';
  onSelectCollectionFilter: (val: 'all' | 'new' | 'black' | 'white') => void;
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  categories: Array<{ id: string; name: string; slug: string }>;
  maxPrice: number;
  onMaxPriceChange: (val: number) => void;
  selectedSizes: string[];
  onToggleSize: (size: string) => void;
  selectedColors: string[];
  onToggleColor: (color: string) => void;
  inStockOnly: boolean;
  onToggleInStock: (val: boolean) => void;
  sortBy: string;
  onSortChange: (sort: string) => void;
  onResetFilters: () => void;
  activeFilterCount: number;
  totalResults: number;
  isQuerying?: boolean;
}

const AVAILABLE_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

const COLOR_SWATCHES = [
  { name: 'Black', hex: '#111111', border: false },
  { name: 'Charcoal', hex: '#2A2A2A', border: false },
  { name: 'White', hex: '#F9F9F9', border: true },
  { name: 'Bone', hex: '#EBE7DF', border: true }
];

export const FilterSortBar: React.FC<FilterSortBarProps> = ({
  collectionFilter,
  onSelectCollectionFilter,
  selectedCategory,
  onSelectCategory,
  categories,
  maxPrice,
  onMaxPriceChange,
  selectedSizes,
  onToggleSize,
  selectedColors,
  onToggleColor,
  inStockOnly,
  onToggleInStock,
  sortBy,
  onSortChange,
  onResetFilters,
  activeFilterCount,
  totalResults,
  isQuerying = false
}) => {
  // Desktop inline filter tray toggle
  const [isDesktopTrayOpen, setIsDesktopTrayOpen] = useState(false);
  // Mobile bottom-sheet drawer toggle
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const mobilePanelRef = useRef<HTMLDivElement>(null);

  useFocusTrap(mobilePanelRef, isMobileDrawerOpen);

  // Lock body scroll when mobile bottom-sheet drawer is open
  useEffect(() => {
    if (isMobileDrawerOpen) {
      const originalStyle = window.getComputedStyle(document.body).overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalStyle;
      };
    }
  }, [isMobileDrawerOpen]);

  // Close overlays on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isMobileDrawerOpen) setIsMobileDrawerOpen(false);
        if (isDesktopTrayOpen) setIsDesktopTrayOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileDrawerOpen, isDesktopTrayOpen]);

  // Filter controls content (rendered in desktop tray and mobile bottom-sheet)
  const renderFilterControls = (isMobile: boolean = false) => (
    <div
      className={`grid gap-6 ${
        isMobile
          ? 'grid-cols-1 space-y-2'
          : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-5'
      }`}
    >
      {/* Collection Silhouettes Filter (Prominent on Mobile Drawer) */}
      {isMobile && (
        <div className="space-y-2.5 pb-2 border-b border-[#F0F0F0]">
          <label className="block text-[10px] uppercase tracking-widest text-[#555555] font-semibold">
            Collection Edition
          </label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'All Silhouettes', value: 'all' },
              { label: 'New Arrivals', value: 'new' },
              { label: 'Noir Edition', value: 'black' },
              { label: 'Blanc Edition', value: 'white' }
            ].map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => onSelectCollectionFilter(tab.value as any)}
                className={`py-2 px-2.5 text-[11px] uppercase tracking-luxury transition-all text-center border ${
                  collectionFilter === tab.value
                    ? 'border-black bg-black text-white font-medium'
                    : 'border-[#EAEAEA] bg-white text-[#555555] hover:border-black'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 1. Category Filter */}
      <div className="space-y-2.5">
        <label id="filter-category-label" className="block text-[10px] uppercase tracking-widest text-[#555555] font-semibold">
          Category
        </label>
        <div className="flex flex-col gap-1.5" role="group" aria-labelledby="filter-category-label">
          {categories.map((cat) => (
            <button
              key={cat.slug}
              type="button"
              onClick={() => onSelectCategory(cat.slug)}
              aria-pressed={selectedCategory === cat.slug}
              className={`text-left text-xs py-1 transition-colors flex items-center justify-between ${
                selectedCategory === cat.slug
                  ? 'text-black font-semibold pl-2 border-l-2 border-black'
                  : 'text-[#666666] hover:text-black pl-2 border-l-2 border-transparent'
              }`}
            >
              <span>{cat.name}</span>
              {selectedCategory === cat.slug && (
                <span className="text-[10px] text-black" aria-hidden="true">✓</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Price Range Slider */}
      <div className="space-y-3">
        <div className="flex justify-between items-baseline">
          <label htmlFor="filter-price-slider" className="text-[10px] uppercase tracking-widest text-[#555555] font-semibold">
            Max Price
          </label>
          <span className="text-xs font-mono font-medium text-black">
            ${maxPrice}
          </span>
        </div>
        <input
          id="filter-price-slider"
          type="range"
          min="100"
          max="500"
          step="10"
          value={maxPrice}
          aria-label="Maximum price filter"
          aria-valuemin={100}
          aria-valuemax={500}
          aria-valuenow={maxPrice}
          aria-valuetext={`$${maxPrice}`}
          onChange={(e) => onMaxPriceChange(Number(e.target.value))}
          className="w-full accent-black cursor-pointer h-1.5 bg-[#EAEAEA] appearance-none rounded-none"
        />
        <div className="flex justify-between text-[10px] text-[#888888] font-mono" aria-hidden="true">
          <span>$100</span>
          <span>$300</span>
          <span>$500</span>
        </div>
      </div>

      {/* 3. Sizes */}
      <div className="space-y-2.5">
        <label id="filter-size-label" className="block text-[10px] uppercase tracking-widest text-[#555555] font-semibold">
          Size
        </label>
        <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby="filter-size-label">
          {AVAILABLE_SIZES.map((size) => {
            const isSelected = selectedSizes.includes(size);
            return (
              <button
                key={size}
                type="button"
                onClick={() => onToggleSize(size)}
                aria-pressed={isSelected}
                aria-label={`Size ${size}`}
                className={`w-9 h-9 text-[11px] font-mono uppercase transition-all flex items-center justify-center focus-visible:ring-2 focus-visible:ring-black ${
                  isSelected
                    ? 'bg-black text-white font-semibold'
                    : 'bg-white border border-[#EAEAEA] text-[#555555] hover:border-black'
                }`}
              >
                {size}
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Color Swatches */}
      <div className="space-y-2.5">
        <label id="filter-palette-label" className="block text-[10px] uppercase tracking-widest text-[#555555] font-semibold">
          Palette
        </label>
        <div className="flex items-center gap-3 pt-1" role="group" aria-labelledby="filter-palette-label">
          {COLOR_SWATCHES.map((swatch) => {
            const isSelected = selectedColors.includes(swatch.name);
            return (
              <button
                key={swatch.name}
                type="button"
                onClick={() => onToggleColor(swatch.name)}
                title={swatch.name}
                aria-label={`Color ${swatch.name}`}
                aria-pressed={isSelected}
                className={`w-7 h-7 rounded-full transition-all relative focus-visible:ring-2 focus-visible:ring-black ${
                  swatch.border ? 'border border-[#CCCCCC]' : ''
                } ${
                  isSelected
                    ? 'ring-2 ring-offset-2 ring-black scale-110'
                    : 'hover:scale-105'
                }`}
                style={{ backgroundColor: swatch.hex }}
              >
                {isSelected && (
                  <span
                    aria-hidden="true"
                    className={`absolute inset-0 flex items-center justify-center text-[10px] ${
                      swatch.name === 'White' || swatch.name === 'Bone'
                        ? 'text-black'
                        : 'text-white'
                    }`}
                  >
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <p className="text-[10px] text-[#888888] pt-1" aria-live="polite">
          {selectedColors.length > 0
            ? `Selected: ${selectedColors.join(', ')}`
            : 'All monochrome tones'}
        </p>
      </div>

      {/* 5. Availability & Reset */}
      <div className="space-y-4">
        <label className="block text-[10px] uppercase tracking-widest text-[#555555] font-semibold">
          Availability
        </label>
        <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-[#333333]">
          <input
            type="checkbox"
            checked={inStockOnly}
            onChange={(e) => onToggleInStock(e.target.checked)}
            className="w-4 h-4 accent-black rounded-none cursor-pointer"
          />
          <span>In Stock Only</span>
        </label>

        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={onResetFilters}
            className="text-[11px] uppercase tracking-luxury text-[#888888] hover:text-black underline block pt-2"
          >
            Clear All Filters ({activeFilterCount})
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* ───────────────────────────────────────────────────────────── */}
      {/* DESKTOP STICKY BAR (md and above)                             */}
      {/* Docked seamlessly beneath the fixed header (top-20) on scroll */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="hidden md:block sticky top-20 z-30 w-full bg-white/95 backdrop-blur-md border-b border-[#EAEAEA] transition-all">
        <div className="max-w-[1720px] mx-auto px-6 sm:px-10 lg:px-16 py-4 flex items-center justify-between gap-4 text-xs">
          {/* Collection Pills */}
          <div className="flex items-center space-x-6 overflow-x-auto pb-0.5 scrollbar-none">
            {[
              { label: 'All Silhouettes', value: 'all' },
              { label: 'New Arrivals', value: 'new' },
              { label: 'Noir Edition', value: 'black' },
              { label: 'Blanc Edition', value: 'white' }
            ].map((tab) => (
              <button
                key={tab.value}
                onClick={() => onSelectCollectionFilter(tab.value as any)}
                className={`uppercase tracking-luxury transition-colors whitespace-nowrap pb-1 border-b ${
                  collectionFilter === tab.value
                    ? 'text-black border-black font-medium'
                    : 'text-[#888888] border-transparent hover:text-black'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Right Tools: Filter Tray Toggle & Sort Dropdown */}
          <div className="flex items-center gap-6 ml-auto">
            {/* Filter Toggle Button */}
            <button
              type="button"
              onClick={() => setIsDesktopTrayOpen(!isDesktopTrayOpen)}
              aria-expanded={isDesktopTrayOpen}
              aria-label={`Toggle filter tray${activeFilterCount > 0 ? `, ${activeFilterCount} active filters` : ''}`}
              className={`flex items-center gap-2 px-3.5 py-2 border text-[11px] uppercase tracking-luxury transition-all focus-visible:ring-2 focus-visible:ring-black ${
                isDesktopTrayOpen || activeFilterCount > 0
                  ? 'border-black bg-black text-white'
                  : 'border-[#EAEAEA] hover:border-black text-black bg-white'
              }`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <line x1="4" y1="21" x2="4" y2="14" />
                <line x1="4" y1="10" x2="4" y2="3" />
                <line x1="12" y1="21" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12" y2="3" />
                <line x1="20" y1="21" x2="20" y2="16" />
                <line x1="20" y1="12" x2="20" y2="3" />
                <line x1="1" y1="14" x2="7" y2="14" />
                <line x1="9" y1="8" x2="15" y2="8" />
                <line x1="17" y1="16" x2="23" y2="16" />
              </svg>
              <span>Filters</span>
              {activeFilterCount > 0 && (
                <span
                  aria-hidden="true"
                  className={`ml-0.5 px-1.5 py-0.2 text-[9px] font-mono rounded-full ${
                    isDesktopTrayOpen ? 'bg-white text-black' : 'bg-black text-white'
                  }`}
                >
                  {activeFilterCount}
                </span>
              )}
            </button>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-2">
              <label htmlFor="desktop-sort-select" className="text-[#888888] uppercase tracking-wider text-[11px]">
                Sort:
              </label>
              <select
                id="desktop-sort-select"
                value={sortBy}
                aria-label="Sort silhouettes"
                onChange={(e) => onSortChange(e.target.value)}
                className="bg-transparent text-xs text-[#111111] uppercase tracking-wider focus:outline-none cursor-pointer border-b border-[#CCCCCC] pb-0.5 hover:border-black transition-colors"
              >
                <option value="newest">Newest</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
                <option value="popularity">Popularity</option>
              </select>
            </div>
          </div>
        </div>

        {/* Desktop Expandable Filter Tray */}
        {isDesktopTrayOpen && (
          <div className="border-t border-[#EAEAEA] py-6 bg-[#FAFAFA] animate-fade-in text-xs space-y-6">
            <div className="max-w-[1720px] mx-auto px-6 sm:px-10 lg:px-16">
              {renderFilterControls(false)}

              {/* Bottom Tray Status */}
              <div className="pt-5 mt-6 border-t border-[#EAEAEA] flex items-center justify-between text-[11px] text-[#666666]">
                <span>
                  {isQuerying ? (
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                      <span>Updating catalog with Supabase...</span>
                    </span>
                  ) : (
                    `Displaying ${totalResults} curated ${totalResults === 1 ? 'piece' : 'pieces'}`
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => setIsDesktopTrayOpen(false)}
                  className="uppercase tracking-widest text-black hover:underline text-[10px] font-semibold"
                >
                  Done / Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MOBILE BAR (below md breakpoint)                              */}
      {/* Replaces inline filter bar with a clean "Filters" button + sort */}
      {/* Sticky at top-16 under the fixed mobile header               */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="block md:hidden sticky top-16 z-30 w-full bg-white/95 backdrop-blur-md border-b border-[#EAEAEA]">
        <div className="px-4 sm:px-6 py-2.5 flex items-center gap-3">
          {/* Mobile Filters Trigger Button */}
          <button
            type="button"
            onClick={() => setIsMobileDrawerOpen(true)}
            aria-expanded={isMobileDrawerOpen}
            aria-label={`Open filters drawer${activeFilterCount > 0 ? `, ${activeFilterCount} active filters` : ''}`}
            className={`flex-1 flex items-center justify-center gap-2.5 py-2.5 px-4 border text-[11px] uppercase tracking-luxury font-medium transition-all focus-visible:ring-2 focus-visible:ring-black ${
              activeFilterCount > 0
                ? 'bg-black text-white border-black shadow-sm'
                : 'bg-white text-[#111111] border-[#EAEAEA] hover:border-black active:bg-[#FAFAFA]'
            }`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <line x1="4" y1="21" x2="4" y2="14" />
              <line x1="4" y1="10" x2="4" y2="3" />
              <line x1="12" y1="21" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12" y2="3" />
              <line x1="20" y1="21" x2="20" y2="16" />
              <line x1="20" y1="12" x2="20" y2="3" />
              <line x1="1" y1="14" x2="7" y2="14" />
              <line x1="9" y1="8" x2="15" y2="8" />
              <line x1="17" y1="16" x2="23" y2="16" />
            </svg>
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span aria-hidden="true" className="bg-white text-black px-1.5 py-0.2 text-[9px] font-mono rounded-full font-bold">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Mobile Sort Dropdown */}
          <div className="flex-1 border border-[#EAEAEA] bg-white px-3 py-2 flex items-center justify-between text-xs">
            <label htmlFor="mobile-sort-select" className="text-[10px] uppercase text-[#888888] font-mono">Sort:</label>
            <select
              id="mobile-sort-select"
              value={sortBy}
              aria-label="Sort silhouettes"
              onChange={(e) => onSortChange(e.target.value)}
              className="bg-transparent text-[11px] text-[#111111] uppercase tracking-wider focus:outline-none cursor-pointer text-right"
            >
              <option value="newest">Newest</option>
              <option value="price-asc">Price: Low-High</option>
              <option value="price-desc">Price: High-Low</option>
              <option value="popularity">Popularity</option>
            </select>
          </div>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MOBILE BOTTOM-SHEET SLIDE-OVER DRAWER (below md)               */}
      {/* Reusing the exact slide-over drawer pattern from CartDrawer   */}
      {/* ───────────────────────────────────────────────────────────── */}
      {isMobileDrawerOpen && (
        <div
          className="fixed inset-0 z-50 overflow-hidden md:hidden animate-fade-in"
          role="dialog"
          aria-modal="true"
          aria-labelledby="mobile-filters-title"
        >
          {/* Backdrop (reusing exact pattern from CartDrawer & MenuDrawer) */}
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300"
            onClick={() => setIsMobileDrawerOpen(false)}
            aria-hidden="true"
          />

          {/* Bottom-Sheet Panel */}
          <div
            ref={mobilePanelRef}
            className="fixed inset-x-0 bottom-0 max-h-[85vh] bg-white shadow-2xl flex flex-col rounded-t-2xl transform transition-transform duration-300 ease-out animate-slide-up z-50"
          >
            {/* Grab Handle */}
            <div
              className="pt-3 pb-1 flex justify-center cursor-pointer"
              onClick={() => setIsMobileDrawerOpen(false)}
              aria-hidden="true"
            >
              <div className="w-10 h-1 bg-[#D4D4D4] rounded-full" />
            </div>

            {/* Drawer Header (reusing header pattern from CartDrawer.tsx) */}
            <div className="px-6 py-4 border-b border-[#EAEAEA] flex items-center justify-between">
              <div>
                <h2 id="mobile-filters-title" className="text-xs uppercase tracking-widest font-semibold text-[#111111] flex items-center gap-2">
                  <span>Filters & Refine</span>
                  {activeFilterCount > 0 && (
                    <span className="bg-black text-white text-[9px] font-mono px-1.5 py-0.2 rounded-full">
                      {activeFilterCount}
                    </span>
                  )}
                </h2>
                <p className="text-[10px] text-[#888888] tracking-wider uppercase mt-0.5">
                  {totalResults} {totalResults === 1 ? 'Silhouette' : 'Silhouettes'} Available
                </p>
              </div>
              <button
                onClick={() => setIsMobileDrawerOpen(false)}
                className="p-1 text-[#111111] hover:opacity-60 transition-opacity focus-visible:ring-2 focus-visible:ring-black rounded"
                aria-label="Close Filters Drawer"
              >
                <img src={BRAND_CONFIG.icons.close} alt="" aria-hidden="true" className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Drawer Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
              {renderFilterControls(true)}
            </div>

            {/* Fixed Drawer Footer (matching CartDrawer.tsx bottom action row) */}
            <div className="p-4 border-t border-[#EAEAEA] bg-white flex items-center gap-3">
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={onResetFilters}
                  className="py-3.5 px-4 text-[11px] uppercase tracking-luxury text-[#666666] hover:text-black border border-[#EAEAEA] hover:border-black font-medium transition-colors"
                >
                  Reset ({activeFilterCount})
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsMobileDrawerOpen(false)}
                className="flex-1 py-3.5 px-6 bg-[#111111] hover:bg-black text-white text-xs uppercase tracking-luxury font-medium transition-colors text-center"
              >
                View {totalResults} {totalResults === 1 ? 'Silhouette' : 'Silhouettes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
