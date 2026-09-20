import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BRAND_CONFIG } from '../../config/assets';
import { useScrollReveal } from '../../hooks/useScrollReveal';

export const EditorialBlock: React.FC = () => {
  const { ref: sectionRef, isVisible } = useScrollReveal<HTMLDivElement>({ threshold: 0.08 });
  const imgRef = useRef<HTMLDivElement>(null);
  const [parallaxOffset, setParallaxOffset] = useState(0);

  // Subtle parallax: image moves up slightly as section scrolls into view
  useEffect(() => {
    const handleScroll = () => {
      if (!imgRef.current) return;
      const rect = imgRef.current.getBoundingClientRect();
      const viewportCenter = window.innerHeight / 2;
      const elementCenter = rect.top + rect.height / 2;
      const distFromCenter = elementCenter - viewportCenter;
      setParallaxOffset(distFromCenter * 0.08); // very subtle factor
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <section
      ref={sectionRef}
      className={`max-w-[1720px] mx-auto px-6 sm:px-10 lg:px-16 py-20 sm:py-32 transition-all duration-1000 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-0 overflow-hidden">

        {/* Left: Cinematic editorial image with parallax */}
        <div
          ref={imgRef}
          className={`relative overflow-hidden aspect-[4/5] lg:aspect-auto lg:min-h-[620px] transition-transform duration-1000 ease-out ${
            isVisible ? 'translate-x-0' : '-translate-x-8'
          }`}
        >
          <img
            src={BRAND_CONFIG.hero.src}
            alt="VB Fits Studios Editorial"
            loading="lazy"
            decoding="async"
            width={800}
            height={1000}
            className="w-full h-full object-cover object-center brightness-[0.88] contrast-[1.04]"
            style={{ transform: `translateY(${parallaxOffset}px)`, transition: 'transform 0.1s linear' }}
          />
          {/* Corner tag */}
          <div className="absolute top-6 left-6 z-10">
            <span className="text-[9px] uppercase tracking-luxury-wide text-white/80 font-light bg-black/30 backdrop-blur-sm px-3 py-1.5">
              AW 2026 Collection
            </span>
          </div>
        </div>

        {/* Right: Brand story copy */}
        <div
          className={`bg-[#FAFAFA] flex flex-col justify-center px-8 sm:px-12 lg:px-16 py-12 sm:py-16 lg:py-20 space-y-8 transition-all duration-1000 delay-200 ${
            isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'
          }`}
        >
          <div className="space-y-1">
            <span className="text-[10px] uppercase tracking-luxury-wide text-[#888888]">
              The Atelier
            </span>
            <div className="w-8 h-[1px] bg-[#CCCCCC] mt-2" />
          </div>

          <h2 className="font-editorial text-3xl sm:text-4xl lg:text-[2.6rem] leading-tight text-[#111111] italic font-light">
            "Craft over<br />convenience.<br />Always."
          </h2>

          <p className="text-sm text-[#555555] font-light leading-loose max-w-sm">
            Every VB Fits Studios piece begins as a sketch — hand-drawn, reworked, and refined
            until the silhouette is perfect. We mill our own heavyweight cotton, screen-print
            each graphic in limited runs, and finish every garment with single-needle stitching.
          </p>

          <p className="text-sm text-[#555555] font-light leading-loose max-w-sm">
            Not mass-produced. Not algorithm-driven. Just deliberate, architectural
            streetwear for those who understand the difference.
          </p>

          <div className="pt-4 flex flex-col sm:flex-row items-start gap-4">
            <Link
              to="/about"
              className="inline-flex items-center gap-2 text-[11px] uppercase tracking-luxury text-[#111111] border-b border-[#111111] pb-1 hover:text-[#666666] hover:border-[#666666] transition-all duration-300"
            >
              Read Our Story
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M2 6h8M6 2l4 4-4 4" />
              </svg>
            </Link>
            <Link
              to="/shop"
              className="inline-flex items-center gap-2 text-[11px] uppercase tracking-luxury text-[#888888] border-b border-[#CCCCCC] pb-1 hover:text-[#111111] hover:border-[#111111] transition-all duration-300"
            >
              Shop the Collection
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};
