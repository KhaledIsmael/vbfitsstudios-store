import React from 'react';
import { useScrollReveal } from '../../hooks/useScrollReveal';

const TRUST_ITEMS = [
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12h14M12 5l7 7-7 7" />
        <rect x="1" y="3" width="15" height="13" rx="2" />
        <path d="M16 8h6v5a2 2 0 0 1-2 2h-4" />
      </svg>
    ),
    label: 'Free Shipping',
    sub: 'On orders over $250',
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="1 4 1 10 7 10" />
        <path d="M3.51 15a9 9 0 1 0 .49-3.24" />
      </svg>
    ),
    label: '14-Day Returns',
    sub: 'Hassle-free policy',
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
    label: 'Secure Checkout',
    sub: 'SSL encrypted payments',
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
    label: 'Handcrafted Quality',
    sub: '340 GSM premium cotton',
  },
];

export const TrustBar: React.FC = () => {
  const { ref, isVisible } = useScrollReveal<HTMLDivElement>({ threshold: 0.2 });

  return (
    <div
      ref={ref}
      className={`border-y border-[#EAEAEA] bg-white transition-all duration-700 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
    >
      <div className="max-w-[1720px] mx-auto px-6 sm:px-10 lg:px-16 py-5 sm:py-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-8">
          {TRUST_ITEMS.map((item, i) => (
            <div
              key={item.label}
              className="flex items-center gap-3 sm:gap-4"
              style={{ transitionDelay: isVisible ? `${i * 80}ms` : '0ms' }}
            >
              <div className="flex-shrink-0 text-[#111111] opacity-70">
                {item.icon}
              </div>
              <div className="min-w-0">
                <p className="text-[11px] sm:text-xs uppercase tracking-luxury font-medium text-[#111111] leading-tight">
                  {item.label}
                </p>
                <p className="text-[10px] sm:text-[11px] text-[#888888] font-light mt-0.5 leading-tight hidden sm:block">
                  {item.sub}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
