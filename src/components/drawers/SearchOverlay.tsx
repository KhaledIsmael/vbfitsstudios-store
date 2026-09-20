import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { type Product } from '../../config/assets';
import { BRAND_CONFIG } from '../../config/assets';
import { SearchGridSkeleton } from '../ui/SkeletonCard';
import { searchProducts, fetchSearchSuggestions } from '../../lib/search';

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

interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SearchOverlay: React.FC<SearchOverlayProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isSuggestionsLoading, setIsSuggestionsLoading] = useState<boolean>(true);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useFocusTrap(panelRef, isOpen);

  // Load dynamic suggestion pills backed by Postgres database on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
      setIsSuggestionsLoading(true);
      fetchSearchSuggestions(6)
        .then((items) => {
          if (items && items.length > 0) {
            setSuggestions(items);
          } else {
            setSuggestions(['Long Sleeve', 'Black Shirt', 'White Shirt', 'Organic Cotton', 'Heavyweight']);
          }
        })
        .catch(() => {
          setSuggestions(['Long Sleeve', 'Black Shirt', 'White Shirt', 'Organic Cotton', 'Heavyweight']);
        })
        .finally(() => {
          setIsSuggestionsLoading(false);
        });
    } else {
      setQuery('');
      setResults([]);
      setIsSearching(false);
    }
  }, [isOpen]);

  // Execute Postgres pg_trgm typo-tolerant search RPC on query change
  useEffect(() => {
    const clean = query.trim();
    if (!clean) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const debounceTimer = setTimeout(async () => {
      try {
        const found = await searchProducts(clean, 12);
        setResults(found);
      } catch (err) {
        console.warn('Search query failed:', err);
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 180);

    return () => clearTimeout(debounceTimer);
  }, [query]);

  const handleSelectProduct = (id: string) => {
    onClose();
    navigate(`/product/${id}`);
  };

  const handleClearQuery = () => {
    setQuery('');
    setResults([]);
    inputRef.current?.focus();
  };

  // Esc closes overlay
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  // Prevent body scroll while open
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Search catalog"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-md transition-opacity duration-300"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-down Search Panel */}
      <div ref={panelRef} className="relative z-10 bg-white border-b border-[#EAEAEA] shadow-2xl animate-fade-in-up">
        <div className="max-w-[1720px] mx-auto px-6 sm:px-12 lg:px-16 py-8 sm:py-12">
          {/* Top Bar with Close */}
          <div className="flex items-center justify-between pb-6 border-b border-[#EAEAEA]">
            <span className="text-[11px] uppercase tracking-widest text-[#888888] font-medium">
              Live Archive Search
            </span>
            <button
              onClick={onClose}
              className="p-1 text-[#111111] hover:opacity-60 transition-opacity"
              aria-label="Close search"
            >
              <img src={BRAND_CONFIG.icons.close} alt="" aria-hidden="true" className="w-5 h-5" width={20} height={20} />
            </button>
          </div>

          {/* Search Input */}
          <div className="relative mt-8">
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by item, color, silhouette, or collection..."
              aria-label="Search products"
              aria-autocomplete="list"
              aria-controls="search-results"
              className="w-full text-xl sm:text-3xl lg:text-4xl font-light tracking-wide text-black placeholder-[#CCCCCC] border-b-2 border-black/10 focus:border-black focus:outline-none pb-4 transition-colors pr-12"
            />
            {query && (
              <button
                type="button"
                onClick={handleClearQuery}
                className="absolute right-2 top-2 text-xs uppercase tracking-widest text-[#888888] hover:text-black transition-colors font-mono py-1 px-2"
                aria-label="Clear Query"
              >
                Clear [✕]
              </button>
            )}
          </div>

          {/* Dynamic Suggestion Pills backed by real database categories, colors, and silhouettes */}
          {!query && (
            <div className="mt-8">
              {isSuggestionsLoading ? (
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#D4D4D4] animate-ping" />
                  <span className="text-[10px] uppercase tracking-widest text-[#AAAAAA] font-mono">
                    Fetching suggestions from archive...
                  </span>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-3 text-xs text-[#777777]">
                  <span className="uppercase tracking-widest text-[10px] text-[#AAAAAA]">
                    Popular Silhouettes:
                  </span>
                  {suggestions.map((term) => (
                    <button
                      key={term}
                      onClick={() => setQuery(term)}
                      className="px-3 py-1.5 border border-[#EAEAEA] hover:border-black hover:text-black transition-colors rounded-none font-medium cursor-pointer"
                    >
                      {term}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Search Results / Loading / Empty States */}
          {query && (
            <div className="mt-10 max-h-[60vh] overflow-y-auto pr-2">
              {/* Status bar */}
              <div className="flex items-center justify-between pb-4 border-b border-[#F0F0F0]">
                <div className="flex items-center gap-2">
                  {isSearching && (
                    <span className="w-2.5 h-2.5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                  )}
                  <span className="text-xs uppercase tracking-widest text-[#888888]">
                    {isSearching
                      ? 'Searching Database...'
                      : `${results.length} ${results.length === 1 ? 'Silhouette' : 'Silhouettes'} Found`}
                  </span>
                </div>
              </div>

              {/* SKELETON: active while RPC query is in flight */}
              {isSearching ? (
                <div className="pt-4">
                  <SearchGridSkeleton count={4} />
                </div>
              ) : results.length === 0 ? (
                /* CLEAN MONOCHROME 'NO RESULTS FOUND' EMPTY STATE */
                <div className="py-16 sm:py-20 text-center border border-[#EAEAEA] bg-[#FAFAFA] my-6 px-6 sm:px-12 max-w-xl mx-auto shadow-sm animate-fade-in">
                  <div className="w-12 h-12 mx-auto mb-4 rounded-full border border-black/15 flex items-center justify-center bg-white text-[#111111]">
                    <svg
                      className="w-5 h-5 text-[#222222]"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      strokeWidth="1.5"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                      />
                    </svg>
                  </div>

                  <span className="text-[10px] uppercase tracking-luxury text-[#888888] block font-mono">
                    Archive Search · 0 Matches
                  </span>

                  <h3 className="text-xl sm:text-2xl uppercase tracking-wider text-black font-light mt-2">
                    No silhouettes found
                  </h3>

                  <p className="text-xs sm:text-sm text-[#666666] max-w-sm mx-auto leading-relaxed mt-2.5">
                    We couldn't find any silhouettes or garments matching{' '}
                    <strong className="text-black font-medium">"{query}"</strong>.
                    Try using broader keywords or explore recommended styles below.
                  </p>

                  {/* Suggestion pills in empty state */}
                  {suggestions.length > 0 && (
                    <div className="flex flex-wrap items-center justify-center gap-2 pt-6 pb-2">
                      {suggestions.slice(0, 4).map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => setQuery(suggestion)}
                          className="text-[11px] font-mono px-3 py-1.5 bg-white border border-[#E0E0E0] hover:border-black text-[#222222] transition-colors cursor-pointer"
                        >
                          Try "{suggestion}"
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="pt-4">
                    <button
                      type="button"
                      onClick={handleClearQuery}
                      className="bg-[#111111] hover:bg-black text-white text-xs uppercase tracking-luxury py-3 px-6 font-medium transition-colors inline-block cursor-pointer"
                    >
                      Clear Search
                    </button>
                  </div>
                </div>
              ) : (
                /* Results Grid with Live Thumbnail Cards */
                <div
                  id="search-results"
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-6"
                  role="list"
                  aria-label="Search results"
                >
                  {results.map((product) => (
                    <div
                      key={product.id}
                      onClick={() => handleSelectProduct(product.id)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSelectProduct(product.id); } }}
                      role="button"
                      tabIndex={0}
                      aria-label={`View ${product.name}, ${product.currency ?? ''}${product.price?.toFixed(2) ?? ''}`}
                      className="group cursor-pointer border border-[#EAEAEA] p-3 hover:border-black transition-colors bg-white"
                    >
                      <div className="aspect-[4/5] bg-[#FAFAFA] overflow-hidden mb-3">
                        <img
                          src={product.images[0]}
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                          loading="lazy"
                          decoding="async"
                          width={400}
                          height={500}
                        />
                      </div>
                      <p className="text-xs font-medium text-black line-clamp-1 uppercase tracking-wide">
                        {product.name}
                      </p>
                      <p className="text-[11px] text-[#777777] mt-1 uppercase tracking-wider">
                        {product.color}
                      </p>
                      <p className="text-xs font-semibold text-black mt-2 font-mono">
                        {product.currency}
                        {product.price.toFixed(2)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
