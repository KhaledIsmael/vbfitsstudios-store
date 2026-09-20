import React, { useState, useEffect, useRef } from 'react';
import { useScrollReveal } from '../../hooks/useScrollReveal';
import { getAllProducts } from '../../lib/products';
import type { Product } from '../../lib/products';
import { ProductCard } from '../ui/ProductCard';

type Tab = 'new' | 'best';

export const NewArrivalsCarousel: React.FC = () => {
  const { ref: sectionRef, isVisible } = useScrollReveal<HTMLDivElement>();
  const [tab, setTab] = useState<Tab>('new');
  const [newArrivals, setNewArrivals] = useState<Product[]>([]);
  const [bestsellers, setBestsellers] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Drag-to-scroll state
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);

  useEffect(() => {
    getAllProducts().then((all) => {
      setNewArrivals(all.filter((p) => p.isNewArrival).slice(0, 6));
      // Bestsellers = all non-new-arrival products + any featured, up to 6
      const bests = all.filter((p) => !p.isNewArrival || p.featured).slice(0, 6);
      setBestsellers(bests.length > 0 ? bests : all.slice(0, 6));
      setLoading(false);
    });
  }, []);

  const products = tab === 'new' ? newArrivals : bestsellers;

  // Drag scroll handlers
  const onMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    startX.current = e.pageX - (scrollRef.current?.offsetLeft ?? 0);
    scrollLeft.current = scrollRef.current?.scrollLeft ?? 0;
    if (scrollRef.current) scrollRef.current.style.cursor = 'grabbing';
  };
  const onMouseLeave = () => {
    isDragging.current = false;
    if (scrollRef.current) scrollRef.current.style.cursor = 'grab';
  };
  const onMouseUp = () => {
    isDragging.current = false;
    if (scrollRef.current) scrollRef.current.style.cursor = 'grab';
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX.current) * 1.4;
    scrollRef.current.scrollLeft = scrollLeft.current - walk;
  };

  return (
    <section
      ref={sectionRef}
      className={`pt-24 sm:pt-36 pb-16 sm:pb-24 transition-all duration-700 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      }`}
    >
      <div className="max-w-[1720px] mx-auto px-6 sm:px-10 lg:px-16">

        {/* Header + Tab Toggle */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 mb-12 sm:mb-16">
          <div className="space-y-2">
            <span className="text-[11px] text-[#888888] tracking-luxury-wide uppercase">
              Curated Selection
            </span>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-light uppercase tracking-wider text-[#111111]">
              {tab === 'new' ? 'New Arrivals' : 'Bestsellers'}
            </h2>
          </div>

          {/* Tab pills */}
          <div className="flex items-center border border-[#EAEAEA] divide-x divide-[#EAEAEA] w-fit">
            {(['new', 'best'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-5 py-2.5 text-[10px] uppercase tracking-luxury font-medium transition-all duration-300 ${
                  tab === t
                    ? 'bg-[#111111] text-white'
                    : 'bg-white text-[#888888] hover:text-[#111111]'
                }`}
              >
                {t === 'new' ? 'New Arrivals' : 'Bestsellers'}
              </button>
            ))}
          </div>
        </div>

        {/* Carousel */}
        {loading ? (
          <div className="flex gap-6 overflow-hidden">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="flex-none w-[260px] sm:w-[300px] space-y-3 animate-pulse">
                <div className="w-full aspect-[3/4] bg-[#F5F5F5]" />
                <div className="h-3 bg-[#EAEAEA] w-2/3" />
                <div className="h-3 bg-[#EAEAEA] w-1/3" />
              </div>
            ))}
          </div>
        ) : products.length === 0 ? null : (
          <div
            ref={scrollRef}
            onMouseDown={onMouseDown}
            onMouseLeave={onMouseLeave}
            onMouseUp={onMouseUp}
            onMouseMove={onMouseMove}
            className="carousel-scroll-container flex gap-6 sm:gap-8 overflow-x-auto pb-4 -mx-6 px-6 sm:-mx-10 sm:px-10"
            style={{ cursor: 'grab', scrollSnapType: 'x mandatory' }}
          >
            {products.map((product) => (
              <div
                key={product.id}
                className="flex-none w-[260px] sm:w-[300px] lg:w-[320px]"
                style={{ scrollSnapAlign: 'start' }}
              >
                <ProductCard product={product} variant="grid" showSubtitle={true} />
              </div>
            ))}
          </div>
        )}

        {/* Scroll hint dots */}
        <div className="mt-6 flex items-center gap-2 sm:hidden">
          <div className="h-[2px] w-8 bg-[#111111] rounded-full" />
          <div className="h-[2px] w-2 bg-[#DEDEDE] rounded-full" />
          <div className="h-[2px] w-2 bg-[#DEDEDE] rounded-full" />
          <span className="text-[9px] text-[#AAAAAA] uppercase tracking-wider ml-2">Swipe</span>
        </div>
      </div>
    </section>
  );
};
