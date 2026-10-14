import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import type { ProductSizeChart } from '../../types/sizeChart';
import { DEFAULT_TSHIRT_SIZE_CHART } from '../../types/sizeChart';

interface ProductSizeChartModalProps {
  isOpen: boolean;
  onClose: () => void;
  productName: string;
  sizeChart?: ProductSizeChart | null;
}

export const ProductSizeChartModal: React.FC<ProductSizeChartModalProps> = ({
  isOpen,
  onClose,
  productName,
  sizeChart
}) => {
  const chart: ProductSizeChart = sizeChart || DEFAULT_TSHIRT_SIZE_CHART;
  const imageUrl = (chart.template_image_url || chart.image_url || '').trim();
  const hasImage = Boolean(imageUrl.length > 0);

  // Lock scroll & ESC key handling
  useEffect(() => {
    if (!isOpen) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', onKey);
    const origOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = origOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="size-chart-title"
      onClick={onClose}
    >
      <div
        className="bg-white max-w-2xl w-full max-h-[92vh] flex flex-col relative shadow-2xl rounded-none border border-[#EAEAEA] animate-scale-in overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#EAEAEA] px-5 sm:px-6 py-4 bg-white flex-shrink-0">
          <div>
            <span className="text-[10px] uppercase tracking-widest text-[#888888] font-mono block">
              VB FITS STUDIOS — SIZE GUIDE
            </span>
            <h3 id="size-chart-title" className="text-sm uppercase tracking-wider font-bold text-black mt-0.5">
              {productName}
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-black hover:opacity-60 p-1.5 leading-none border border-transparent hover:border-[#EAEAEA] transition-colors"
            aria-label="Close size guide"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Area - Image Only */}
        <div className="overflow-y-auto p-4 sm:p-6 space-y-4 flex-1 flex flex-col items-center justify-center">
          {hasImage ? (
            <div className="w-full flex flex-col items-center">
              <div className="w-full max-w-[560px] bg-white border border-[#EAEAEA] shadow-xs flex items-center justify-center p-2">
                <img
                  src={imageUrl}
                  alt={`${productName} Size Guide`}
                  className="w-full h-auto max-h-[65vh] object-contain block mx-auto select-none"
                  draggable={false}
                />
              </div>
              {chart.unit && (
                <div className="text-center text-[10px] uppercase tracking-wider text-[#888888] mt-2">
                  Unit of measurement: <span className="font-bold text-black">{chart.unit.toUpperCase()}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="py-12 px-6 text-center space-y-2 border border-dashed border-[#EAEAEA] w-full max-w-[560px]">
              <p className="text-xs uppercase tracking-widest text-[#888888] font-mono">
                Size Guide Image Coming Soon
              </p>
              <p className="text-xs text-[#555555]">
                Please contact concierge via Instagram @vbfitsstudios for sizing guidance.
              </p>
            </div>
          )}

          {/* Notes & Fit Information */}
          {chart.notes && (
            <div className="w-full max-w-[560px] border-t border-[#EAEAEA] pt-3 text-[11px] text-[#777777] leading-relaxed text-center sm:text-left">
              <p>{chart.notes}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-[#EAEAEA] px-5 sm:px-6 py-3 bg-[#FAFAFA] flex items-center justify-between text-[11px] text-[#888888] flex-shrink-0">
          <span>Need fit advice? Contact concierge via Instagram @vbfitsstudios</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-black text-white text-[10px] uppercase tracking-widest font-bold hover:bg-[#333333] transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
