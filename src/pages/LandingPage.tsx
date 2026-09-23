import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BRAND_CONFIG, PRODUCTS, type Product } from '../config/assets';
import { fetchHeroBanners } from '../lib/heroBanners';
import { getFilteredProducts } from '../lib/products';
import { ProductImage } from '../components/ui/ProductImage';
import { ProductCard } from '../components/ui/ProductCard';

interface HeroData {
  image: string;
  name: string;
  link: string;
}

const DEFAULT_HERO: HeroData = {
  image: BRAND_CONFIG.hero.src,
  name: BRAND_CONFIG.hero.title,
  link: BRAND_CONFIG.hero.buttonLink || '/shop',
};

export const LandingPage: React.FC = () => {
  const [heroData, setHeroData] = useState<HeroData>(DEFAULT_HERO);
  const [products, setProducts] = useState<Product[]>(PRODUCTS);

  useEffect(() => {
    let isMounted = true;

    // Load hero banners
    fetchHeroBanners().then((banners) => {
      if (isMounted && banners && banners.length > 0) {
        setHeroData({
          image: banners[0].image_url || BRAND_CONFIG.hero.src,
          name: banners[0].title || BRAND_CONFIG.hero.title,
          link: banners[0].cta_link || BRAND_CONFIG.hero.buttonLink || '/shop',
        });
      }
    });

    // Load products
    getFilteredProducts({ collectionFilter: 'all' })
      .then((res) => {
        if (isMounted && res && res.length > 0) {
          setProducts(res);
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
        className="relative w-full h-[680px] lg:h-[860px] flex flex-col justify-end items-center pb-16 sm:pb-24 select-none overflow-hidden"
        aria-label="Product Hero"
      >
        <ProductImage
          src={heroData.image}
          alt={heroData.name}
          placement="hero"
          className="absolute inset-0"
          fetchPriority="high"
          decoding="sync"
          loading="eager"
        />
        {/* Subtle contrast overlay mirroring Sorvea natural lighting */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-black/20 pointer-events-none" />

        {/* Content: Centered bold uppercase title & translucent Shop Now button */}
        <div className="relative z-10 flex flex-col items-center text-center px-4 max-w-4xl mx-auto">
          <h1 className="font-spec font-bold text-2xl sm:text-[28px] lg:text-[32px] text-white uppercase tracking-spec leading-tight drop-shadow-sm mb-4 sm:mb-6">
            {heroData.name}
          </h1>
          <Link
            to={heroData.link}
            className="inline-flex items-center justify-center px-12 sm:px-16 py-3 sm:py-3.5 bg-black/35 backdrop-blur-xs border border-white/30 hover:border-white/70 text-white font-spec font-bold uppercase text-[11px] sm:text-xs tracking-[1px] transition-all duration-default btn-fill-hover shadow-sm"
          >
            Shop Now
          </Link>
        </div>
      </section>

      {/* 2. FEATURED COLLECTION: ARCHITECTURAL 4-COLUMN GRID WITH 1PX BORDER DIVIDERS */}
      <section className="bg-white select-none pb-12 sm:pb-20" aria-label="Featured Collection">
        <div className="max-w-[1900px] mx-auto">
          <div className="sorvea-grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
            {products.slice(0, 4).map((product) => (
              <div key={product.id} className="sorvea-grid-item p-4 sm:p-6">
                <ProductCard product={product} />
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};
