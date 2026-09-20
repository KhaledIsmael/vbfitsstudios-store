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
  const { ref, isVisible } = useScrollReveal<HTMLDivElement>({ threshold: 0.15 });

  return (
    <section className="bg-white py-20 sm:py-28 border-t border-[#EAEAEA]">
      <div
        ref={ref}
        className={`max-w-[1720px] mx-auto px-6 sm:px-10 lg:px-16 transition-all duration-700 ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}
      >
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-12 sm:mb-16 gap-4">
          <div>
            <span className="text-[11px] text-[#888888] tracking-luxury-wide uppercase block mb-2">
              Visual Archives
            </span>
            <h2 className="text-2xl sm:text-3xl font-light uppercase tracking-wider text-[#111111]">
              Follow @vbfitsstudios
            </h2>
          </div>
          <div>
            <a
              href="https://instagram.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-xs uppercase tracking-luxury text-[#111111] hover:text-[#777777] border-b border-black pb-1 transition-all"
            >
              <span>View On Instagram</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M7 17l9.2-9.2M17 17V8H8" />
              </svg>
            </a>
          </div>
        </div>

        {/* 6-Item Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          {INSTA_ITEMS.map((item, index) => (
            <a
              key={item.id}
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative block aspect-square overflow-hidden bg-[#F5F5F5]"
              style={{
                transitionDelay: `${index * 80}ms`,
              }}
            >
              <img
                src={item.img}
                alt={item.caption}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                loading="lazy"
                decoding="async"
                width={400}
                height={400}
              />

              {/* Dark Hover Overlay */}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center p-4 text-center">
                {/* Instagram Glyph */}
                <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white mb-3 backdrop-blur-sm">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                  </svg>
                </div>
                <p className="text-[10px] text-white/90 uppercase tracking-widest font-light line-clamp-2">
                  {item.caption}
                </p>
                <span className="text-[9px] text-[#C5A880] tracking-luxury uppercase mt-2 font-mono">
                  @vbfitsstudios
                </span>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
};
