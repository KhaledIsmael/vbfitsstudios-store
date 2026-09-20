import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { fetchHeroBanners } from '../../lib/heroBanners';
import type { HeroBanner } from '../../lib/heroBanners';

const SLIDE_INTERVAL_MS = 6000;

interface SlideImageProps {
  slide: HeroBanner;
  isActive: boolean;
  isFirst: boolean;
  entered: boolean;
}

const SlideImage: React.FC<SlideImageProps> = ({ slide, isActive, isFirst, entered }) => {
  let imgClass = 'hero-slide-img';
  if (isFirst && !entered) {
    // waiting for splash
  } else if (isActive) {
    imgClass += ' hero-slide-active';
    if (isFirst && entered) imgClass += ' hero-first-reveal';
  } else {
    imgClass += ' hero-slide-inactive';
  }
  return (
    <div className="absolute inset-0 z-0" aria-hidden={!isActive}>
      <img
        src={slide.image_url}
        alt={slide.title}
        className={imgClass}
        draggable={false}
        width={1920}
        height={1080}
        loading={isFirst ? 'eager' : 'lazy'}
        decoding={isFirst ? 'sync' : 'async'}
        fetchPriority={isFirst ? 'high' : 'low'}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-black/25 pointer-events-none" />
    </div>
  );
};

interface HeroSliderProps {
  splashCleared: boolean;
}

export const HeroSlider: React.FC<HeroSliderProps> = ({ splashCleared }) => {
  const [slides, setSlides] = useState<HeroBanner[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [contentVisible, setContentVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { fetchHeroBanners().then(setSlides); }, []);

  useEffect(() => {
    if (!splashCleared) return;
    const t = setTimeout(() => setContentVisible(true), 300);
    return () => clearTimeout(t);
  }, [splashCleared]);

  const startTimer = useCallback((len: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (len <= 1) return;
    timerRef.current = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % len);
    }, SLIDE_INTERVAL_MS);
  }, []);

  useEffect(() => {
    if (slides.length <= 1) return;
    startTimer(slides.length);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [slides.length, startTimer]);

  const goTo = (idx: number) => { setActiveIndex(idx); startTimer(slides.length); };
  const goNext = () => { setActiveIndex((p) => (p + 1) % slides.length); startTimer(slides.length); };
  const goPrev = () => { setActiveIndex((p) => (p - 1 + slides.length) % slides.length); startTimer(slides.length); };

  const active = slides[activeIndex];

  if (slides.length === 0) {
    return <section className="relative w-full h-[92vh] sm:h-screen bg-[#0a0a0a]" aria-label="Hero" />;
  }

  return (
    <section className="relative w-full h-[92vh] sm:h-screen overflow-hidden select-none" aria-label="Hero Slider">

      {slides.map((slide, i) => (
        <SlideImage key={slide.id} slide={slide} isActive={i === activeIndex} isFirst={i === 0} entered={splashCleared} />
      ))}

      <div className={'relative z-10 h-full flex flex-col items-center justify-center text-center text-white px-6 max-w-4xl mx-auto transition-opacity duration-700 ' + (contentVisible ? 'opacity-100' : 'opacity-0')}>
        {active && (
          <div key={activeIndex} className="hero-content-enter flex flex-col items-center space-y-4 sm:space-y-5">
            <span className="text-[10px] sm:text-xs uppercase tracking-luxury-wide font-light opacity-80 drop-shadow-sm">
              {active.season_tag}
            </span>
            <h1 className="text-3xl sm:text-5xl md:text-6xl font-light uppercase tracking-wider leading-tight drop-shadow-md">
              {active.title}
            </h1>
            {active.subtitle && (
              <p className="text-xs sm:text-sm text-neutral-200 tracking-wide max-w-lg font-light leading-relaxed">
                {active.subtitle}
              </p>
            )}
            <div className="pt-4 sm:pt-6">
              <Link to={active.cta_link} className="inline-block bg-white hover:bg-black text-black hover:text-white px-8 sm:px-12 py-3.5 sm:py-4 text-xs uppercase tracking-luxury font-medium transition-all duration-300 shadow-lg hover:shadow-xl">
                {active.cta_text}
              </Link>
            </div>
          </div>
        )}
      </div>

      {slides.length > 1 && (
        <>
          <button id="hero-arrow-prev" onClick={goPrev} aria-label="Previous slide" className="absolute left-5 sm:left-8 top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 rounded-full transition-all duration-300 backdrop-blur-sm border border-white/10 hover:border-white/30">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="11 3 5 9 11 15" /></svg>
          </button>
          <button id="hero-arrow-next" onClick={goNext} aria-label="Next slide" className="absolute right-5 sm:right-8 top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 rounded-full transition-all duration-300 backdrop-blur-sm border border-white/10 hover:border-white/30">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="7 3 13 9 7 15" /></svg>
          </button>
        </>
      )}

      {slides.length > 1 && (
        <div className="absolute bottom-16 sm:bottom-20 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2.5">
          {slides.map((_, i) => (
            <button key={i} id={'hero-dot-' + i} onClick={() => goTo(i)} aria-label={'Go to slide ' + (i + 1)}
              className={'h-[2px] transition-all duration-500 rounded-full ' + (i === activeIndex ? 'w-8 bg-white' : 'w-2.5 bg-white/40 hover:bg-white/70')} />
          ))}
        </div>
      )}

      {slides.length > 1 && (
        <div key={'progress-' + activeIndex} className="absolute bottom-0 left-0 h-[2px] bg-white/50 hero-progress-bar z-20" />
      )}

      <div className="absolute bottom-7 left-1/2 -translate-x-1/2 z-20 text-white/70 flex flex-col items-center gap-1.5 pointer-events-none">
        <span className="text-[9px] uppercase tracking-luxury text-white/60">Scroll</span>
        <div className="w-[1px] h-7 bg-white/40 animate-pulse" />
      </div>
    </section>
  );
};
