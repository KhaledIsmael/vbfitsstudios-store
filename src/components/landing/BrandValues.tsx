import React from 'react';
import { useScrollReveal } from '../../hooks/useScrollReveal';

const VALUES = [
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </svg>
    ),
    label: 'Heavyweight Textiles',
    body: 'Custom-milled 340 GSM French terry organic cotton. Dense, structured, built to last decades.',
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
      </svg>
    ),
    label: 'Archival Artwork',
    body: 'Every graphic is hand-drawn by our in-house artists. Baroque botanical motifs, baroque calligraphy — never a stock template.',
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="2" x2="12" y2="22" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
    label: 'Precision Cut',
    body: 'Architectural dropped-shoulder silhouettes engineered for an effortless, oversized luxury drape.',
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
    label: 'Limited Runs',
    body: 'Every drop is numbered and finite. No restocks, no overproduction — only what we can make perfectly.',
  },
];

export const BrandValues: React.FC = () => {
  const { ref, isVisible } = useScrollReveal<HTMLDivElement>();

  return (
    <section
      ref={ref}
      className={`bg-[#FAFAFA] border-y border-[#EAEAEA] py-20 sm:py-32 transition-all duration-700 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div className="max-w-[1720px] mx-auto px-6 sm:px-10 lg:px-16">

        {/* Header */}
        <div className="text-center mb-16 sm:mb-20 space-y-3">
          <span className="text-[11px] text-[#888888] tracking-luxury-wide uppercase">
            Our Promise
          </span>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-light uppercase tracking-wider text-[#111111]">
            Why VB Fits Studios
          </h2>
          <div className="w-12 h-[1px] bg-[#111111] mx-auto mt-4" />
        </div>

        {/* 4-column values grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-12 lg:gap-16">
          {VALUES.map((v, i) => (
            <div
              key={v.label}
              className="flex flex-col gap-5 text-center sm:text-left"
              style={{
                transitionDelay: isVisible ? `${i * 100}ms` : '0ms',
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
                transition: 'opacity 0.7s ease, transform 0.7s ease',
              }}
            >
              {/* Icon */}
              <div className="flex sm:flex-none justify-center sm:justify-start text-[#111111] opacity-70">
                {v.icon}
              </div>

              {/* Divider */}
              <div className="hidden sm:block w-6 h-[1px] bg-[#CCCCCC]" />

              {/* Text */}
              <div className="space-y-2">
                <p className="text-xs sm:text-[13px] font-medium uppercase tracking-wider text-[#111111]">
                  {v.label}
                </p>
                <p className="text-[11px] sm:text-xs text-[#777777] font-light leading-relaxed">
                  {v.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
