import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
 * Uses React Portal to guarantee the popover is NEVER clipped by parent
 * overflow: hidden or z-index stacking layers across all devices.
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
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    placement: 'top' | 'bottom';
  } | null>(null);

  // Calculate dynamic coordinates relative to viewport
  const updatePosition = () => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const tooltipWidth = Math.min(320, window.innerWidth - 32);
    
    // Determine horizontal position
    let leftPos: number;
    if (align === 'right') {
      leftPos = rect.right - tooltipWidth;
    } else if (align === 'left') {
      leftPos = rect.left;
    } else {
      leftPos = rect.left + rect.width / 2 - tooltipWidth / 2;
    }

    // Keep within viewport horizontally
    const left = Math.max(16, Math.min(window.innerWidth - tooltipWidth - 16, leftPos));

    // Vertical placement: Flip down if not enough room on top
    const spaceOnTop = rect.top;
    if (spaceOnTop < 220) {
      setPosition({
        top: rect.bottom + 8,
        left,
        placement: 'bottom'
      });
    } else {
      setPosition({
        bottom: window.innerHeight - rect.top + 8,
        left,
        placement: 'top'
      });
    }
  };

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      const handleScrollOrResize = () => updatePosition();
      window.addEventListener('scroll', handleScrollOrResize, true);
      window.addEventListener('resize', handleScrollOrResize);
      return () => {
        window.removeEventListener('scroll', handleScrollOrResize, true);
        window.removeEventListener('resize', handleScrollOrResize);
      };
    }
  }, [isOpen]);

  // Close when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node) &&
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className={`relative inline-flex items-center align-middle ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => {
          // Slight delay so user can hover over popover if needed
          setTimeout(() => {
            if (!popoverRef.current?.matches(':hover')) {
              setIsOpen(false);
            }
          }, 150);
        }}
        aria-label={title}
        className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-slate-400 hover:text-amber-500 hover:bg-amber-500/10 transition-all duration-200 focus:outline-none ${iconClassName}`}
      >
        <Info className="w-3.5 h-3.5" />
      </button>

      {/* Popover Bubble Rendered into document.body Portal */}
      {isOpen &&
        position &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={popoverRef}
            dir="rtl"
            onMouseEnter={() => setIsOpen(true)}
            onMouseLeave={() => setIsOpen(false)}
            style={{
              position: 'fixed',
              left: `${position.left}px`,
              top: position.top !== undefined ? `${position.top}px` : 'auto',
              bottom: position.bottom !== undefined ? `${position.bottom}px` : 'auto',
              zIndex: 99999,
              width: 'min(320px, calc(100vw - 32px))'
            }}
            className="p-4 bg-slate-900 text-slate-100 border border-slate-700/80 rounded-xl shadow-2xl backdrop-blur-xl transition-all duration-200 animate-fade-in text-right ring-1 ring-black/40 pointer-events-auto"
          >
            {/* Header */}
            <div className="flex items-center gap-2 pb-2.5 mb-2.5 border-b border-slate-800">
              <div className="w-6 h-6 rounded-md bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 flex-shrink-0">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <h4 className="text-xs font-bold text-white tracking-wide">{title}</h4>
            </div>

            {/* Description in Egyptian Arabic */}
            <p className="text-xs text-slate-300 leading-relaxed font-normal mb-3">
              {description}
            </p>

            {/* Impact on Live Storefront */}
            {impact && (
              <div className="mb-2 p-2.5 bg-slate-800/80 border border-slate-700/60 rounded-lg flex items-start gap-2 text-[11px] text-slate-300">
                <Zap className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-emerald-400 ml-1">تأثيره على الموقع:</span>
                  <span>{impact}</span>
                </div>
              </div>
            )}

            {/* Brand Pro-Tip */}
            {tip && (
              <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-start gap-2 text-[11px] text-amber-200/90">
                <Lightbulb className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-amber-400 ml-1">نصيحة للبراند:</span>
                  <span>{tip}</span>
                </div>
              </div>
            )}
          </div>,
          document.body
        )}
    </div>
  );
};
