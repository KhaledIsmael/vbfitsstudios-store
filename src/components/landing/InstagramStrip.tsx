import React from 'react';
import { useScrollReveal } from '../../hooks/useScrollReveal';

interface GramItem {
  id: string;
  img: string;
  caption: string;
  link: string;
}

const INSTA_ITEMS: GramItem[] = [
  {
    id: 'gram-1',
    img: '/assets/products/black-shirt.jpeg',
    caption: 'Archival heavyweight black tee in tailored oversized cut.',
    link: 'https://instagram.com',
  },
  {
    id: 'gram-2',
    img: '/assets/products/white-shirt.jpeg',
    caption: 'Pure minimalist optic white silhouette · 340 GSM luxury cotton.',
    link: 'https://instagram.com',
  },
  {
    id: 'gram-3',
    img: '/assets/hero/hero.jpg',
    caption: 'Campaign Vol. 01 · Structured geometry and timeless proportion.',
    link: 'https://instagram.com',
  },
  {
    id: 'gram-4',
    img: '/assets/products/black-shirt.jpeg',
    caption: 'Details in restraint. Custom garment wash and precision seam.',
    link: 'https://instagram.com',
  },
  {
    id: 'gram-5',
    img: '/assets/products/white-shirt.jpeg',
    caption: 'Studio fitting notes: draped heavy cotton with crisp collar band.',
    link: 'https://instagram.com',
  },
  {
    id: 'gram-6',
    img: '/assets/hero/hero.jpg',
    caption: 'The Atelier aesthetic: deliberate minimalism for modern daily wear.',
    link: 'https://instagram.com',
  },
];

export const InstagramStrip: React.FC = () => {
  const { ref, isVisible } = useScrollReveal<HTMLDivElement>({ threshold: 0.1 });
  const scrollContainerRef = React.useRef<HTMLDivElement | null>(null);

  const scrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 320, behavior: 'smooth' });
    }
  };

  return (
    <section className="bg-white py-12 sm:py-16 select-none border-t border-[#DDDDDD]">
      <div
        ref={ref}
        className={`max-w-[1900px] mx-auto px-4 sm:px-8 transition-opacity duration-500 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {/* Sorvea Reference Header: @BRAND on Left | FOLLOW US on Right */}
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <h2 className="font-spec font-bold text-sm sm:text-base uppercase tracking-spec text-[#2D2D2D]">
            @VBFITSSTUDIOS
          </h2>
          <a
            href="https://instagram.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-spec font-bold text-xs uppercase tracking-spec text-[#2D2D2D] underline hover:opacity-70 transition-opacity"
          >
            Follow Us
          </a>
        </div>

        {/* Carousel Container with Right Scroll Arrow */}
        <div className="relative group">
          <div
            ref={scrollContainerRef}
            className="flex space-x-2 sm:space-x-3 overflow-x-auto no-scrollbar scroll-smooth snap-x snap-mandatory"
          >
            {INSTA_ITEMS.map((item) => (
              <a
                key={item.id}
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="relative flex-none w-[200px] sm:w-[240px] lg:w-[280px] aspect-[4/5] overflow-hidden bg-[#F7F7F7] snap-start block"
              >
                <img
                  src={item.img}
                  alt={item.caption}
                  className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
                  loading="lazy"
                  decoding="async"
                  width={280}
                  height={350}
                />
              </a>
            ))}
          </div>

          {/* Right Navigation Arrow Button (Sorvea Style) */}
          <button
            type="button"
            onClick={scrollRight}
            aria-label="Scroll gallery right"
            className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/85 hover:bg-white text-[#2D2D2D] flex items-center justify-center shadow-md transition-all opacity-80 hover:opacity-100 z-10"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </section>
  );
};
