import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BRAND_CONFIG } from '../config/assets';
import { getFeaturedProducts } from '../lib/products';
import type { Product } from '../lib/products';
import { ProductCard } from '../components/ui/ProductCard';
import { HeroSlider } from '../components/ui/HeroSlider';

// Landing Page Enhancement Components (PRD Section 5)
import { TrustBar } from '../components/landing/TrustBar';
import { NewArrivalsCarousel } from '../components/landing/NewArrivalsCarousel';
import { EditorialBlock } from '../components/landing/EditorialBlock';
import { BrandValues } from '../components/landing/BrandValues';
import { MidPageNewsletter } from '../components/landing/MidPageNewsletter';
import { InstagramStrip } from '../components/landing/InstagramStrip';

// Signature Luxury Experience Components
import { DropVaultBanner } from '../components/brand/DropVaultBanner';
import { InteractiveLookbook } from '../components/brand/InteractiveLookbook';
import { CraftsmanshipExplorer } from '../components/brand/CraftsmanshipExplorer';
import { PackagingVisualizer } from '../components/brand/PackagingVisualizer';

export const LandingPage: React.FC = () => {
  // Opening animation states:
  // step 1: logo in center on pure white screen (2s)
  // step 2: logo fades out smoothly (0.8s)
  // step 3: hero section fades in / splash cleared
  const [animStep, setAnimStep] = useState<1 | 2 | 3>(1);
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (animStep === 1) {
      const timer1 = setTimeout(() => setAnimStep(2), 2000);
      return () => clearTimeout(timer1);
    } else if (animStep === 2) {
      const timer2 = setTimeout(() => setAnimStep(3), 800);
      return () => clearTimeout(timer2);
    }
  }, [animStep]);

  useEffect(() => {
    let isMounted = true;
    getFeaturedProducts(2).then((products) => {
      if (isMounted) {
        setFeaturedProducts(products);
        setLoading(false);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="relative bg-white min-h-screen">
      {/* 1. OPENING SPLASH ANIMATION OVERLAY (Steps 1 & 2) */}
      {animStep < 3 && (
        <div
          className={
            'fixed inset-0 z-50 bg-white flex items-center justify-center transition-opacity duration-800 pointer-events-none ' +
            (animStep === 2 ? 'opacity-0' : 'opacity-100')
          }
        >
          <div
            className={
              'flex flex-col items-center justify-center p-8 transition-all duration-1000 ' +
              (animStep === 1 ? 'opacity-100 scale-100' : 'opacity-0 scale-95')
            }
          >
            <img
              src={BRAND_CONFIG.logo.src}
              alt={BRAND_CONFIG.logo.alt}
              className="max-w-[240px] sm:max-w-[320px] w-auto h-auto mix-blend-multiply select-none"
              width={320}
              height={120}
              decoding="sync"
              fetchPriority="high"
            />
          </div>
        </div>
      )}

      {/* 2. HERO SLIDER - rotating cinematic carousel fetched from hero_banners table */}
      <HeroSlider splashCleared={animStep === 3} />

      {/* 3. LIMITED DROP COUNTDOWN VAULT BANNER */}
      <DropVaultBanner />

      {/* 4. TRUST & ASSURANCE BAR */}
      <TrustBar />

      {/* 5. FEATURED PRODUCTS SECTION */}
      <section className="max-w-[1720px] mx-auto px-6 sm:px-10 lg:px-16 pt-24 sm:pt-36 pb-12 sm:pb-20">
        <div className="flex flex-col items-center text-center mb-16 sm:mb-24 space-y-3">
          <span className="text-[11px] text-[#888888] tracking-luxury-wide uppercase">
            Collection Essentials
          </span>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-light uppercase tracking-wider text-[#111111]">
            Featured Silhouettes
          </h2>
          <div className="w-12 h-[1px] bg-[#111111] mt-4" />
        </div>

        {loading && featuredProducts.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 sm:gap-16 lg:gap-24">
            {[1, 2].map((n) => (
              <div key={n} className="w-full space-y-4 animate-pulse">
                <div className="w-full aspect-[3/4] bg-[#F5F5F5]" />
                <div className="h-4 bg-[#EAEAEA] w-2/3 mx-auto" />
                <div className="h-3 bg-[#EAEAEA] w-1/3 mx-auto" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 sm:gap-16 lg:gap-24">
            {featuredProducts.map((product) => (
              <div key={product.id} className="w-full">
                <ProductCard product={product} variant="featured" showSubtitle={true} />
              </div>
            ))}
          </div>
        )}

        <div className="mt-20 sm:mt-28 text-center">
          <Link
            to="/shop"
            className="inline-block border-b border-black pb-1 text-xs uppercase tracking-luxury text-[#111111] hover:text-[#777777] hover:border-[#777777] transition-all"
          >
            Explore Complete Catalog &rarr;
          </Link>
        </div>
      </section>

      {/* 6. INTERACTIVE EDITORIAL LOOKBOOK SPOTLIGHT (Pulsing Hotspots & Quick Add) */}
      <section className="max-w-[1720px] mx-auto px-6 sm:px-10 lg:px-16 py-12 sm:py-20">
        <div className="flex flex-col items-center text-center mb-12 sm:mb-16 space-y-3">
          <span className="text-[11px] text-[#888888] tracking-luxury-wide uppercase">
            Runway & Editorial Campaign
          </span>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-light uppercase tracking-wider text-[#111111]">
            Interactive Lookbook // Shoppable Silhouettes
          </h2>
          <p className="text-xs text-[#666666] max-w-xl mx-auto">
            Explore the campaign and tap on pulsing pins on the model's outfit to inspect garment specifications, select sizes, and purchase directly.
          </p>
          <div className="w-12 h-[1px] bg-[#111111] mt-2" />
        </div>
        <InteractiveLookbook isSpotlight={true} />
      </section>

      {/* 7. NEW ARRIVALS & BESTSELLERS CAROUSEL */}
      <div className="cv-section">
        <NewArrivalsCarousel />
      </div>

      {/* 8. 340 GSM ARCHITECTURAL CRAFTSMANSHIP & FABRIC ANATOMY */}
      <section className="max-w-[1720px] mx-auto px-6 sm:px-10 lg:px-16 py-12 sm:py-20 cv-section-tall">
        <CraftsmanshipExplorer />
      </section>

      {/* 9. EDITORIAL STORY BLOCK */}
      <EditorialBlock />

      {/* 10. BESPOKE PRESENTATION & PACKAGING VISUALIZER */}
      <section className="max-w-[1720px] mx-auto px-6 sm:px-10 lg:px-16 py-6 sm:py-12 cv-section">
        <PackagingVisualizer />
      </section>

      {/* 11. BRAND VALUES (CRAFTSMANSHIP PILLARS) */}
      <BrandValues />

      {/* 12. MID-PAGE LUXURY NEWSLETTER */}
      <MidPageNewsletter />

      {/* 13. INSTAGRAM ATELIER STRIP */}
      <InstagramStrip />
    </div>
  );
};
