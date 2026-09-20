import React, { useState } from 'react';
import { Sparkles, Plus, Check, ShoppingBag } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import type { Product } from '../../config/assets';

interface CompleteTheLookProps {
  currentProduct: Product;
}

interface BundleItem {
  id: string;
  name: string;
  role: string;
  price: number;
  image: string;
  size: string;
  availableSizes: string[];
  selected: boolean;
}

export const CompleteTheLook: React.FC<CompleteTheLookProps> = ({ currentProduct }) => {
  const { addToCart, setIsCartOpen } = useCart();
  const [addedNotice, setAddedNotice] = useState(false);

  // Curated capsule pairing items matching the aesthetic
  const [items, setItems] = useState<BundleItem[]>([
    {
      id: currentProduct.id,
      name: currentProduct.name,
      role: 'Core Top',
      price: currentProduct.price,
      image: currentProduct.images[0] || '/assets/products/black-shirt.jpeg',
      size: 'M',
      availableSizes: currentProduct.sizes || ['S', 'M', 'L', 'XL'],
      selected: true
    },
    {
      id: 'vb-capsule-cargo-black',
      name: 'Architectural Pleated Cargo Trouser',
      role: 'Curated Bottom',
      price: 185,
      image: '/assets/products/black-shirt.jpeg',
      size: '32',
      availableSizes: ['30', '32', '34', '36'],
      selected: true
    },
    {
      id: 'vb-capsule-beanie-charcoal',
      name: 'Ribbed Merino Wool Archival Beanie',
      role: 'Accessory',
      price: 65,
      image: '/assets/products/white-shirt.jpeg',
      size: 'O/S',
      availableSizes: ['O/S'],
      selected: true
    }
  ]);

  const toggleItem = (index: number) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, selected: !item.selected } : item))
    );
  };

  const handleSizeChange = (index: number, newSize: string) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, size: newSize } : item))
    );
  };

  const selectedItems = items.filter((i) => i.selected);
  const rawTotal = selectedItems.reduce((sum, i) => sum + i.price, 0);
  const isBundle = selectedItems.length >= 2;
  const bundleDiscount = isBundle ? 0.1 : 0; // 10% curated bundle saving
  const finalTotal = rawTotal * (1 - bundleDiscount);

  const handleAddBundleToBag = () => {
    selectedItems.forEach((item) => {
      // Add each item with its selected size
      if (item.id === currentProduct.id) {
        addToCart(currentProduct, item.size, 1);
      } else {
        addToCart(
          {
            id: item.id,
            name: item.name,
            subtitle: `Curated Capsule Pairing with ${currentProduct.name}`,
            price: Math.round(item.price * (1 - bundleDiscount)),
            currency: currentProduct.currency || '$',
            category: item.role.toLowerCase().includes('bottom') ? 'bottoms' : 'accessories',
            featured: false,
            images: [item.image],
            color: 'Tonal Washed',
            colorsAvailable: [{ name: 'Tonal Washed', hex: '#111111', productId: item.id }],
            sizes: item.availableSizes,
            description: `Curated piece styled to complement ${currentProduct.name}.`,
            details: ['Made in Portugal', 'Architectural luxury silhouette'],
            fabricCare: ['Dry clean or delicate wash'],
            shippingInfo: 'Complimentary shipping included.'
          },
          item.size,
          1
        );
      }
    });

    setAddedNotice(true);
    setIsCartOpen(true);
    setTimeout(() => setAddedNotice(false), 3000);
  };

  return (
    <div className="border border-[#EAEAEA] bg-[#FAFAFA] p-6 sm:p-8 mt-12 space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#EAEAEA] pb-4 gap-2">
        <div>
          <span className="text-[10px] uppercase tracking-luxury text-[#888888] block">
            Atelier Styling Advice
          </span>
          <h3 className="text-base sm:text-lg font-light uppercase tracking-wider text-black mt-0.5">
            Complete the Look — Capsule Pairing
          </h3>
        </div>
        {isBundle && (
          <span className="inline-flex items-center gap-1 bg-black text-white text-[10px] uppercase font-mono tracking-widest px-2.5 py-1 self-start sm:self-auto">
            <Sparkles className="w-3 h-3 text-amber-300" />
            <span>10% Capsule Benefit Applied</span>
          </span>
        )}
      </div>

      {/* Item Row Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {items.map((item, idx) => (
          <div
            key={item.id}
            className={`p-3.5 border transition-all relative ${
              item.selected
                ? 'bg-white border-black shadow-sm'
                : 'bg-white/50 border-[#EAEAEA] opacity-60'
            }`}
          >
            <div className="flex items-start gap-3">
              {/* Checkbox */}
              <button
                type="button"
                onClick={() => toggleItem(idx)}
                className={`w-4 h-4 rounded-none border flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${
                  item.selected ? 'bg-black border-black text-white' : 'border-[#CCCCCC] bg-white'
                }`}
                aria-label={item.selected ? 'Deselect item' : 'Select item'}
              >
                {item.selected && <Check className="w-3 h-3" />}
              </button>

              {/* Thumb */}
              <div className="w-12 h-14 bg-[#F2F2F2] flex-shrink-0 overflow-hidden border border-[#EAEAEA]">
                <img
                  src={item.image}
                  alt={item.name}
                  className="w-full h-full object-contain p-0.5 mix-blend-multiply"
                  loading="lazy"
                  decoding="async"
                  width={48}
                  height={56}
                />
              </div>

              {/* Details */}
              <div className="min-w-0 flex-1">
                <span className="text-[9px] uppercase font-mono tracking-wider text-[#888888] block">
                  {item.role}
                </span>
                <p className="text-xs font-medium text-black truncate mt-0.5">
                  {item.name}
                </p>
                <p className="text-xs font-mono font-bold text-black mt-1">
                  ${item.price}
                </p>
              </div>
            </div>

            {/* Size Selector */}
            {item.selected && item.availableSizes.length > 1 && (
              <div className="mt-3 pt-2.5 border-t border-[#F0F0F0] flex items-center justify-between text-[11px]">
                <span className="text-[#888888] font-mono text-[10px] uppercase">Size:</span>
                <select
                  value={item.size}
                  onChange={(e) => handleSizeChange(idx, e.target.value)}
                  className="bg-[#FAFAFA] border border-[#EAEAEA] px-2 py-1 text-xs font-mono text-black focus:outline-none focus:border-black"
                >
                  {item.availableSizes.map((sz) => (
                    <option key={sz} value={sz}>{sz}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Bottom Action Strip */}
      <div className="border-t border-[#EAEAEA] pt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <span className="text-[10px] uppercase tracking-wider text-[#888888] block">
            Selected Pieces ({selectedItems.length})
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-light font-mono text-black font-semibold">
              ${finalTotal.toFixed(2)}
            </span>
            {isBundle && (
              <span className="text-xs font-mono text-[#888888] line-through">
                ${rawTotal.toFixed(2)}
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={handleAddBundleToBag}
          disabled={selectedItems.length === 0}
          className="w-full sm:w-auto bg-[#111111] hover:bg-black text-white px-8 py-3.5 text-xs uppercase tracking-luxury font-medium transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-40"
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          <span>Add Complete Outfit to Bag</span>
        </button>
      </div>

      {addedNotice && (
        <div className="p-3 bg-white border border-black text-center text-xs text-black animate-fade-in flex items-center justify-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-600" />
          <span>Complete capsule outfit added to your shopping bag.</span>
        </div>
      )}

    </div>
  );
};
