import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { BRAND_CONFIG, PRODUCTS, type Product } from '../config/assets';
import { fetchHeroBanners } from '../lib/heroBanners';
import { getFilteredProducts } from '../lib/products';
import { ProductCard } from '../components/ui/ProductCard';

interface HeroData {
  image: string;
  name: string;
  link: string;
}

export const LandingPage: React.FC = () => {
  // Use null to prevent the flash of default image before DB loads
  const [heroData, setHeroData] = useState<HeroData | null>(null);
  const [products, setProducts] = useState<Product[]>(PRODUCTS);

  useEffect(() => {
    let isMounted = true;

    // Load hero banners
    fetchHeroBanners().then((banners) => {
      if (isMounted && banners && banners.length > 0 && banners[0].media_url) {
        setHeroData({
          image: banners[0].media_url,
          name: banners[0].title || BRAND_CONFIG.hero.title,
          link: banners[0].cta_link || BRAND_CONFIG.hero.buttonLink || '/shop',
        });
      } else if (isMounted) {
        // Only fallback to static if DB actually returned nothing
        setHeroData({
          image: BRAND_CONFIG.hero.src,
          name: BRAND_CONFIG.hero.title,
          link: BRAND_CONFIG.hero.buttonLink || '/shop',
        });
      }
    });

    // Load products
    getFilteredProducts({ collectionFilter: 'all' })
      .then((res) => {
        if (isMounted && res && res.length > 0) {
          // De-duplicate products by ID
          const seenIds = new Set<string>();
          const uniqueProducts = res.filter((p) => {
            if (seenIds.has(p.id)) return false;
            seenIds.add(p.id);
            return true;
          });
          setProducts(uniqueProducts);
        }
      })
      .catch(() => {
        // Fallback to static PRODUCTS
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="relative bg-white min-h-screen">
      {/* 1. HERO SECTION: FULL-BLEED EDITORIAL PRODUCT IMAGE, CENTERED TITLE, TRANSLUCENT CTA */}
      <section
        className="relative w-full h-[680px] lg:h-[860px] flex flex-col justify-end items-center pb-16 sm:pb-24 select-none overflow-hidden bg-black"
        aria-label="Product Hero"
      >
        {/* Render image only when data is loaded, use object-cover to fix spacing */}
        {heroData && (
          <img
            src={heroData.image}
            alt={heroData.name}
            fetchPriority="high"
            decoding="sync"
            loading="eager"
            className="absolute inset-0 w-full h-full object-cover object-top"
          />
        )}
        {/* Subtle contrast overlay mirroring Sorvea natural lighting */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-black/30 pointer-events-none" />

        {/* Content: Centered bold uppercase title & translucent Shop Now button */}
        {heroData && (
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 flex flex-col items-center text-center px-4 max-w-4xl mx-auto"
          >
            <h1 className="font-spec font-bold text-2xl sm:text-[28px] lg:text-[32px] text-white uppercase tracking-spec leading-tight drop-shadow-md mb-4 sm:mb-6">
              {heroData.name}
            </h1>
            <Link
              to={heroData.link}
              className="inline-flex items-center justify-center px-12 sm:px-16 py-3 sm:py-3.5 bg-black/35 backdrop-blur-md border border-white/30 hover:border-white text-white font-spec font-bold uppercase text-[11px] sm:text-xs tracking-[1px] transition-all duration-default btn-fill-hover shadow-lg"
            >
              Shop Now
            </Link>
          </motion.div>
        )}
      </section>

      {/* 2. FEATURED COLLECTION: ARCHITECTURAL 4-COLUMN GRID WITH 1PX BORDER DIVIDERS */}
      <section className="bg-white select-none pb-12 sm:pb-20" aria-label="Featured Collection">
        <div className="max-w-[1900px] mx-auto">
          <div className="sorvea-grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
            {products.slice(0, 4).map((product, index) => (
              <motion.div 
                key={product.id} 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.6, delay: index * 0.1, ease: [0.16, 1, 0.3, 1] }}
                className="sorvea-grid-item p-4 sm:p-6"
              >
                <ProductCard product={product} />
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};
