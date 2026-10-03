import React, { useState } from 'react';
import { AdminProduct } from '../../lib/adminProducts';
import { Plus, X, Search, Check } from 'lucide-react';

interface RelatedProductsPickerProps {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  availableProducts: AdminProduct[];
  currentProductId?: string;
}

export const RelatedProductsPicker: React.FC<RelatedProductsPickerProps> = ({
  selectedIds,
  onChange,
  availableProducts,
  currentProductId
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  // Exclude current product from list
  const eligibleProducts = availableProducts.filter((p) => p.id !== currentProductId);

  const filtered = eligibleProducts.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.slug.toLowerCase().includes(search.toLowerCase())
  );

  const toggleProduct = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((item) => item !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const selectedProducts = eligibleProducts.filter((p) => selectedIds.includes(p.id));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-mono uppercase tracking-widest text-white/60">
          Related & Complementary Silhouettes ({selectedIds.length} linked)
        </label>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="text-xs uppercase tracking-wider font-mono text-white/70 hover:text-white underline"
        >
          {isOpen ? 'Close Picker' : '+ Select Related Products'}
        </button>
      </div>

      {/* Selected Items Chips / Cards */}
      {selectedProducts.length > 0 ? (
        <div className="flex flex-wrap gap-2.5">
          {selectedProducts.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-2.5 bg-[#18181D] border border-white/15 px-2.5 py-1.5 pr-2"
            >
              <img
                src={p.images?.[0]?.url || '/assets/products/black-shirt.jpeg'}
                alt={p.name}
                className="w-6 h-7 object-contain bg-white/5"
              />
              <div className="text-left">
                <p className="text-xs text-white truncate max-w-[140px]">{p.name}</p>
                <p className="text-[9px] font-mono text-white/40">${p.price}</p>
              </div>
              <button
                type="button"
                onClick={() => toggleProduct(p.id)}
                className="text-white/40 hover:text-red-400 p-0.5 ml-1"
                aria-label={`Remove ${p.name}`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-white/40 italic bg-[#151519] p-3 border border-white/5">
          No related silhouettes linked yet. Related products appear under "Complementary Silhouettes" on the product detail page.
        </p>
      )}

      {/* Dropdown selection modal / tray */}
      {isOpen && (
        <div className="p-4 bg-[#151519] border border-white/15 space-y-3 animate-fade-in">
          <div className="flex items-center gap-2 bg-[#18181D] border border-white/10 px-3 py-1.5">
            <Search className="w-3.5 h-3.5 text-white/40" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter available silhouettes by title..."
              className="w-full bg-transparent text-xs text-white placeholder-white/30 focus:outline-none"
            />
          </div>

          <div className="max-h-56 overflow-y-auto divide-y divide-white/5 border border-white/5 bg-[#121215]">
            {filtered.length === 0 ? (
              <p className="p-4 text-xs text-white/40 text-center font-mono">No silhouettes match.</p>
            ) : (
              filtered.map((p) => {
                const isSelected = selectedIds.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggleProduct(p.id)}
                    className={`w-full flex items-center justify-between p-2.5 text-left hover:bg-white/5 transition-colors ${
                      isSelected ? 'bg-white/[0.04]' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={p.images?.[0]?.url || '/assets/products/black-shirt.jpeg'}
                        alt={p.name}
                        className="w-8 h-10 object-contain bg-white/5 flex-shrink-0"
                      />
                      <div>
                        <p className="text-xs font-medium text-white">{p.name}</p>
                        <p className="text-[10px] font-mono text-white/40">
                          {p.variants?.[0]?.color || 'Standard'} · ${p.price}
                        </p>
                      </div>
                    </div>

                    <div
                      className={`w-5 h-5 border flex items-center justify-center ${
                        isSelected
                          ? 'bg-white text-black border-white'
                          : 'border-white/20 text-transparent'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
