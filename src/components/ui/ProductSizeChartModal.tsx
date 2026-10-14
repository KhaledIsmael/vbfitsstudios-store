import React, { useState, useEffect } from 'react';
import { X, Table as TableIcon, Image as ImageIcon } from 'lucide-react';
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
  const hasTemplate = Boolean(chart.template_image_url && chart.template_image_url.trim().length > 0);
  const [activeView, setActiveView] = useState<'overlay' | 'table'>(
    hasTemplate && chart.render_mode === 'overlay' ? 'overlay' : 'table'
  );

  useEffect(() => {
    if (hasTemplate && chart.render_mode === 'overlay') {
      setActiveView('overlay');
    } else {
      setActiveView('table');
    }
  }, [hasTemplate, chart.render_mode, chart.template_image_url]);

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

  const unit = chart.unit || 'cm';
  const columns = chart.columns || [];
  const rows = chart.rows || [];
  const layout = chart.layout;

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

          <div className="flex items-center gap-2">
            {hasTemplate && (
              <div className="inline-flex border border-[#EAEAEA] p-0.5 bg-[#F9F9F9]">
                <button
                  type="button"
                  onClick={() => setActiveView('overlay')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-[10px] uppercase tracking-wider font-semibold transition-colors ${
                    activeView === 'overlay'
                      ? 'bg-black text-white'
                      : 'text-[#666666] hover:text-black'
                  }`}
                  title="Visual Illustration View"
                >
                  <ImageIcon className="w-3 h-3" />
                  <span className="hidden sm:inline">Visual</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveView('table')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-[10px] uppercase tracking-wider font-semibold transition-colors ${
                    activeView === 'table'
                      ? 'bg-black text-white'
                      : 'text-[#666666] hover:text-black'
                  }`}
                  title="Detailed Measurements Table View"
                >
                  <TableIcon className="w-3 h-3" />
                  <span className="hidden sm:inline">Table</span>
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              className="text-black hover:opacity-60 p-1.5 leading-none border border-transparent hover:border-[#EAEAEA] transition-colors"
              aria-label="Close size guide"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="overflow-y-auto p-5 sm:p-6 space-y-5">
          {/* Overlay View (Matching user's reference design with coordinates) */}
          {activeView === 'overlay' && hasTemplate && (
            <div className="space-y-4">
              <div className="relative mx-auto max-w-[480px] bg-white border border-[#EAEAEA] shadow-xs select-none">
                <img
                  src={chart.template_image_url}
                  alt={`${productName} Technical Size Chart`}
                  className="w-full h-auto block"
                />

                {/* Overlaid Values onto the template's white cells */}
                {rows.map((row) => {
                  const y = layout?.rowY?.[row.size];
                  if (y === undefined) return null;

                  return (
                    <React.Fragment key={row.size}>
                      {columns.map((col) => {
                        const x = layout?.colX?.[col.id];
                        if (x === undefined) return null;
                        const val = row.measurements[col.id];
                        if (val === undefined || val === '') return null;

                        return (
                          <div
                            key={`${row.size}-${col.id}`}
                            className="absolute transform -translate-x-1/2 -translate-y-1/2 text-[11px] sm:text-[13px] md:text-[14px] font-bold text-black font-mono text-center pointer-events-none select-none tracking-tight"
                            style={{
                              left: `${x}%`,
                              top: `${y}%`,
                            }}
                          >
                            {val}
                          </div>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
              </div>

              <div className="text-center text-[10px] uppercase tracking-wider text-[#888888]">
                Unit of measurement: <span className="font-bold text-black">{unit.toUpperCase()}</span>
              </div>
            </div>
          )}

          {/* Clean Responsive Table View */}
          {(activeView === 'table' || !hasTemplate) && (
            <div className="space-y-4">
              <div className="overflow-x-auto border border-[#EAEAEA]">
                <table className="w-full text-xs text-left" aria-label="Product measurement table">
                  <thead>
                    <tr className="border-b border-[#EAEAEA] bg-[#FAFAFA] text-[#666666] font-mono text-[11px] uppercase tracking-wider">
                      <th scope="col" className="py-3 px-4 font-bold text-black border-r border-[#EAEAEA] text-center w-20">
                        Size
                      </th>
                      {columns.map((col) => (
                        <th key={col.id} scope="col" className="py-3 px-4 font-medium text-center">
                          {col.label} <span className="text-[#999999] text-[10px]">({col.unit || unit})</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EAEAEA]">
                    {rows.map((row) => (
                      <tr key={row.size} className="hover:bg-[#FDFDFD] transition-colors">
                        <th scope="row" className="py-3 px-4 font-bold text-black font-mono border-r border-[#EAEAEA] text-center bg-[#FAFAFA]/50">
                          {row.size}
                        </th>
                        {columns.map((col) => (
                          <td key={col.id} className="py-3 px-4 text-center font-mono text-black font-medium">
                            {row.measurements[col.id] !== undefined && row.measurements[col.id] !== ''
                              ? `${row.measurements[col.id]} ${unit}`
                              : '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Fit Tips / How to Measure Guide */}
              <div className="bg-[#FAFAFA] border border-[#EAEAEA] p-4 text-[11px] space-y-2 text-[#555555]">
                <div className="font-bold text-black uppercase tracking-wider text-[10px]">
                  How to Measure
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[10px]">
                  <div>
                    <span className="font-bold text-black block">Length:</span>
                    Measure from the highest point of the shoulder seam straight down to the bottom hem.
                  </div>
                  <div>
                    <span className="font-bold text-black block">Width (Chest):</span>
                    Measure straight across the chest 2.5 cm below armpit seams from edge to edge.
                  </div>
                  <div>
                    <span className="font-bold text-black block">Sleeve Length:</span>
                    Measure from the shoulder seam along the outer arm fold down to the cuff edge.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Notes & Brand Drape Information */}
          <div className="border-t border-[#EAEAEA] pt-4 text-[11px] text-[#777777] leading-relaxed">
            <p>
              {chart.notes || 'All measurements are taken flat in centimeters. Designed with a contemporary luxury boxy drape. Fits true to size for an oversized aesthetic.'}
            </p>
          </div>
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
