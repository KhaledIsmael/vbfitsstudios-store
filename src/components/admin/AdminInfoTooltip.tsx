import React, { useState, useRef, useEffect } from 'react';
import { Info, Sparkles, Zap, Lightbulb } from 'lucide-react';

export interface AdminInfoTooltipProps {
  title: string;
  description: string;
  impact?: string;
  tip?: string;
  className?: string;
  iconClassName?: string;
  align?: 'left' | 'right' | 'center';
}

/**
 * Egyptian Arabic Info Tooltip Component for Local Brand Admin
 * Displays clear, practical guidance on hover or tap.
 */
export const AdminInfoTooltip: React.FC<AdminInfoTooltipProps> = ({
  title,
  description,
  impact,
  tip,
  className = '',
  iconClassName = '',
  align = 'center'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click for touch/mobile devices
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Alignment classes for tooltip popover
  const alignmentClasses =
    align === 'right'
      ? 'right-0 sm:right-auto sm:left-1/2 sm:-translate-x-1/2'
      : align === 'left'
      ? 'left-0 sm:left-1/2 sm:-translate-x-1/2'
      : 'left-1/2 -translate-x-1/2';

  return (
    <div
      ref={containerRef}
      className={`relative inline-flex items-center align-middle ${className}`}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
        aria-label={title}
        className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-white/50 hover:text-amber-300 hover:bg-amber-400/10 transition-all duration-200 focus:outline-none ${iconClassName}`}
      >
        <Info className="w-3.5 h-3.5" />
      </button>

      {/* Popover Bubble */}
      {isOpen && (
        <div
          dir="rtl"
          className={`absolute bottom-full mb-2 z-50 w-72 sm:w-80 p-3.5 bg-[#16161B] text-[#EAEAEA] border border-white/20 rounded-sm shadow-2xl backdrop-blur-md transition-all duration-200 animate-fade-in ${alignmentClasses} text-right`}
        >
          {/* Header */}
          <div className="flex items-center gap-2 pb-2 mb-2 border-b border-white/10">
            <div className="w-5 h-5 rounded bg-amber-400/15 border border-amber-400/30 flex items-center justify-center text-amber-400 flex-shrink-0">
              <Sparkles className="w-3 h-3" />
            </div>
            <h4 className="text-xs font-semibold text-white tracking-wide">{title}</h4>
          </div>

          {/* Description in Egyptian Arabic */}
          <p className="text-xs text-white/80 leading-relaxed font-normal mb-2.5">
            {description}
          </p>

          {/* Impact on Live Storefront */}
          {impact && (
            <div className="mb-2 p-2 bg-white/5 border border-white/10 rounded-sm flex items-start gap-2 text-[11px] text-white/70">
              <Zap className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-emerald-300 ml-1">تأثيره على الموقع:</span>
                <span>{impact}</span>
              </div>
            </div>
          )}

          {/* Brand Pro-Tip */}
          {tip && (
            <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-sm flex items-start gap-2 text-[11px] text-amber-200/90">
              <Lightbulb className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-amber-300 ml-1">نصيحة للبراند:</span>
                <span>{tip}</span>
              </div>
            </div>
          )}

          {/* Small Arrow indicator */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 w-2 h-2 bg-[#16161B] border-r border-b border-white/20 transform rotate-45" />
        </div>
      )}
    </div>
  );
};
