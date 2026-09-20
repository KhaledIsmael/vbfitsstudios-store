import React, { useState } from 'react';
import { AdminProductVariant } from '../../lib/adminProducts';
import { Plus, Trash2, Sparkles, AlertTriangle } from 'lucide-react';

interface VariantsEditorProps {
  variants: AdminProductVariant[];
  onChange: (variants: AdminProductVariant[]) => void;
  productSlug?: string;
  defaultColor?: string;
}

const STANDARD_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

export const VariantsEditor: React.FC<VariantsEditorProps> = ({
  variants,
  onChange,
  productSlug = 'item',
  defaultColor = 'Washed Black'
}) => {
  const [quickColor, setQuickColor] = useState(defaultColor);
  const [quickHex, setQuickHex] = useState('#111111');

  const handleUpdate = (index: number, field: keyof AdminProductVariant, value: any) => {
    const updated = [...variants];
    updated[index] = {
      ...updated[index],
      [field]: value
    };
    onChange(updated);
  };

  const handleRemove = (index: number) => {
    onChange(variants.filter((_, i) => i !== index));
  };

  const handleAddSingle = () => {
    const newVar: AdminProductVariant = {
      size: 'M',
      color: quickColor || 'Washed Black',
      color_hex: quickHex || '#111111',
      stock: 12,
      sku: `VB-${productSlug.slice(0, 4).toUpperCase()}-${Date.now().toString().slice(-4)}`
    };
    onChange([...variants, newVar]);
  };

  const handleGenerateStandardSizes = () => {
    const colorToUse = quickColor.trim() || 'Washed Black';
    const hexToUse = quickHex.trim() || '#111111';
    const cleanPrefix = (productSlug.replace(/[^a-zA-Z0-9]/g, '').slice(0, 5) || 'VB').toUpperCase();

    const newSet: AdminProductVariant[] = STANDARD_SIZES.map((sz) => ({
      size: sz,
      color: colorToUse,
      color_hex: hexToUse,
      stock: 10,
      sku: `VB-${cleanPrefix}-${sz}`
    }));

    // Avoid exact duplicates (same size & color)
    const filteredExisting = variants.filter(
      (v) => !(v.color.toLowerCase() === colorToUse.toLowerCase() && STANDARD_SIZES.includes(v.size))
    );

    onChange([...filteredExisting, ...newSet]);
  };

  const totalStock = variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);

  return (
    <div className="space-y-4">
      {/* Header with Quick Generator */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#151519] border border-white/10 p-4">
        <div>
          <h3 className="text-xs uppercase tracking-wider font-medium text-white">
            Variant Matrix ({variants.length} variations · {totalStock} total units)
          </h3>
          <p className="text-[10px] text-white/40 font-mono mt-0.5">
            Define size, colorway palette, SKU barcode, and live inventory levels.
          </p>
        </div>

        {/* Quick generator */}
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="text"
            value={quickColor}
            onChange={(e) => setQuickColor(e.target.value)}
            placeholder="Color (e.g. Noir Black)"
            className="w-32 bg-[#18181D] border border-white/15 px-2 py-1 text-xs text-white placeholder-white/30 font-mono"
          />
          <input
            type="color"
            value={quickHex}
            onChange={(e) => setQuickHex(e.target.value)}
            title="Color swatch"
            className="w-7 h-7 bg-transparent border border-white/20 cursor-pointer p-0 rounded-none"
          />
          <button
            type="button"
            onClick={handleGenerateStandardSizes}
            className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white text-[10px] uppercase font-mono tracking-wider px-3 py-1.5 border border-white/15 transition-colors"
          >
            <Sparkles className="w-3 h-3 text-amber-300" />
            <span>Gen Standard (XS–XXL)</span>
          </button>
        </div>
      </div>

      {/* Variants Table */}
      <div className="border border-white/10 bg-[#121215] overflow-x-auto">
        <table className="w-full text-left text-xs font-mono">
          <thead>
            <tr className="border-b border-white/10 text-white/40 uppercase tracking-widest text-[9px]">
              <th className="py-2.5 px-3">Size</th>
              <th className="py-2.5 px-3">Colorway Name</th>
              <th className="py-2.5 px-3">Hex</th>
              <th className="py-2.5 px-3">SKU Identifier</th>
              <th className="py-2.5 px-3">Stock Units</th>
              <th className="py-2.5 px-3">Price Override</th>
              <th className="py-2.5 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {variants.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-white/40 font-sans text-xs">
                  No variants defined. Click "Gen Standard" above or "Add Variant" below.
                </td>
              </tr>
            ) : (
              variants.map((v, idx) => (
                <tr key={v.id || idx} className="hover:bg-white/[0.02]">
                  {/* Size */}
                  <td className="py-2 px-3">
                    <select
                      value={v.size}
                      onChange={(e) => handleUpdate(idx, 'size', e.target.value)}
                      className="bg-[#18181D] border border-white/15 px-2 py-1 text-xs text-white focus:outline-none focus:border-white"
                    >
                      {STANDARD_SIZES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                      <option value="OS">OS (One Size)</option>
                    </select>
                  </td>

                  {/* Color */}
                  <td className="py-2 px-3">
                    <input
                      type="text"
                      value={v.color}
                      onChange={(e) => handleUpdate(idx, 'color', e.target.value)}
                      placeholder="Colorway"
                      className="w-32 bg-[#18181D] border border-white/15 px-2 py-1 text-xs text-white focus:outline-none focus:border-white font-sans"
                    />
                  </td>

                  {/* Hex */}
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-1.5">
                      <input
                        type="color"
                        value={v.color_hex || '#111111'}
                        onChange={(e) => handleUpdate(idx, 'color_hex', e.target.value)}
                        className="w-5 h-5 bg-transparent border border-white/20 cursor-pointer p-0"
                      />
                      <span className="text-[10px] text-white/50">{v.color_hex || '#111111'}</span>
                    </div>
                  </td>

                  {/* SKU */}
                  <td className="py-2 px-3">
                    <input
                      type="text"
                      value={v.sku}
                      onChange={(e) => handleUpdate(idx, 'sku', e.target.value)}
                      placeholder="SKU"
                      className="w-36 bg-[#18181D] border border-white/15 px-2 py-1 text-xs text-white focus:outline-none focus:border-white uppercase"
                    />
                  </td>

                  {/* Stock */}
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="0"
                        value={v.stock}
                        onChange={(e) => handleUpdate(idx, 'stock', Math.max(0, parseInt(e.target.value) || 0))}
                        className={`w-20 bg-[#18181D] border px-2 py-1 text-xs text-white focus:outline-none ${
                          v.stock === 0
                            ? 'border-red-500/50 text-red-300'
                            : v.stock <= 5
                            ? 'border-amber-500/50 text-amber-300'
                            : 'border-white/15'
                        }`}
                      />
                      {v.stock === 0 ? (
                        <span className="text-[9px] text-red-400 font-sans">OOS</span>
                      ) : v.stock <= 5 ? (
                        <span className="text-[9px] text-amber-400 font-sans">Low</span>
                      ) : null}
                    </div>
                  </td>

                  {/* Price Override */}
                  <td className="py-2 px-3">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={v.price_override ?? ''}
                      onChange={(e) =>
                        handleUpdate(
                          idx,
                          'price_override',
                          e.target.value ? parseFloat(e.target.value) : null
                        )
                      }
                      placeholder="Default"
                      className="w-24 bg-[#18181D] border border-white/15 px-2 py-1 text-xs text-white placeholder-white/20 focus:outline-none focus:border-white"
                    />
                  </td>

                  {/* Remove */}
                  <td className="py-2 px-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleRemove(idx)}
                      className="text-white/40 hover:text-red-400 p-1 transition-colors"
                      title="Delete variant"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        onClick={handleAddSingle}
        className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white text-xs uppercase tracking-wider font-mono px-4 py-2 border border-white/15 transition-colors"
      >
        <Plus className="w-3.5 h-3.5" />
        <span>Add Single Variant</span>
      </button>
    </div>
  );
};
