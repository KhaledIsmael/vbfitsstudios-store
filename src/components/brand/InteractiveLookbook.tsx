import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, ShoppingBag, Check, Eye, Sparkles, ChevronRight, X } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { PRODUCTS, BRAND_CONFIG, type Product } from '../../config/assets';

export interface LookbookHotspot {
  id: string;
  x: number; // percentage from left
  y: number; // percentage from top
  role: 'Top' | 'Bottom' | 'Accessory';
  productId: string;
  name: string;
  subtitle: string;
  price: number;
  image: string;
  availableSizes: string[];
}

export interface EditorialLook {
  id: string;
  number: string;
  title: string;
  subtitle: string;
  description: string;
  image: string;
  hotspots: LookbookHotspot[];
}

export const EDITORIAL_LOOKS: EditorialLook[] = [
  {
    id: 'look-01',
    number: '01',
    title: 'Nightfall Nocturne',
    subtitle: 'Washed Black Heavyweight Silhouette',
    description: 'An architectural study in dark tones. The 340 GSM Washed Black Long Sleeve paired with sculpted pleated cargo trousers and our archival ribbed wool beanie.',
    image: BRAND_CONFIG.hero.src,
    hotspots: [
      {
        id: 'spot-01-top',
        x: 48,
        y: 44,
        role: 'Top',
        productId: 'vb-long-sleeve-black',
        name: 'VB Fits Studios Long Sleeve — Black',
        subtitle: '340 GSM Organic French Terry Cotton',
        price: 195,
        image: '/assets/products/black-shirt.jpeg',
        availableSizes: ['S', 'M', 'L', 'XL', 'XXL']
      },
      {
        id: 'spot-01-bottom',
        x: 46,
        y: 78,
        role: 'Bottom',
        productId: 'vb-capsule-cargo-black',
        name: 'Architectural Pleated Cargo Trouser',
        subtitle: 'Heavyweight Structured Twill / Made in Portugal',
        price: 185,
        image: '/assets/products/black-shirt.jpeg',
        availableSizes: ['30', '32', '34', '36']
      },
      {
        id: 'spot-01-acc',
        x: 52,
        y: 20,
        role: 'Accessory',
        productId: 'vb-capsule-beanie-charcoal',
        name: 'Archival Ribbed Merino Beanie',
        subtitle: '100% Merino Wool / Tonal Embroidered Tab',
        price: 65,
        image: '/assets/products/white-shirt.jpeg',
        availableSizes: ['O/S']
      }
    ]
  },
  {
    id: 'look-02',
    number: '02',
    title: 'Daylight Atelier',
    subtitle: 'Optic White & Indigo Calligraphy',
    description: 'High contrast clarity. Optic White 340 GSM Long Sleeve with royal indigo sleeve iconography, styled with slate tailored trousers and minimal atelier accessories.',
    image: '/assets/products/white-shirt.jpeg',
    hotspots: [
      {
        id: 'spot-02-top',
        x: 50,
        y: 42,
        role: 'Top',
        productId: 'vb-long-sleeve-white',
        name: 'VB Fits Studios Long Sleeve — White',
        subtitle: '340 GSM Cotton / Royal Indigo Sleeve Print',
        price: 195,
        image: '/assets/products/white-shirt.jpeg',
        availableSizes: ['S', 'M', 'L', 'XL', 'XXL']
      },
      {
        id: 'spot-02-bottom',
        x: 52,
        y: 82,
        role: 'Bottom',
        productId: 'vb-capsule-trouser-slate',
        name: 'Tailored Minimalist Slacks — Slate',
        subtitle: 'Portuguese Combed Wool-Cotton Blend',
        price: 190,
        image: '/assets/products/white-shirt.jpeg',
        availableSizes: ['30', '32', '34', '36']
      }
    ]
  },
  {
    id: 'look-03',
    number: '03',
    title: 'Monochromatic Archive',
    subtitle: 'Unreleased Archival Prototype Styling',
    description: 'A study in raw tone proportions. Archival Bone White silhouette with high-density matte black sleeve ink and clean relaxed stacking.',
    image: BRAND_CONFIG.hero.src,
    hotspots: [
      {
        id: 'spot-03-top',
        x: 52,
        y: 46,
        role: 'Top',
        productId: 'vb-long-sleeve-monochrome',
        name: 'VB Fits Studios Archival Long Sleeve',
        subtitle: 'Bone White / Matte Black Screenprint',
        price: 210,
        image: '/assets/products/white-shirt.jpeg',
        availableSizes: ['S', 'M', 'L', 'XL']
      },
      {
        id: 'spot-03-bottom',
        x: 48,
        y: 75,
        role: 'Bottom',
        productId: 'vb-capsule-cargo-black',
        name: 'Architectural Pleated Cargo Trouser',
        subtitle: 'Heavyweight Structured Twill',
        price: 185,
        image: '/assets/products/black-shirt.jpeg',
        availableSizes: ['30', '32', '34', '36']
      }
    ]
  }
];

interface InteractiveLookbookProps {
  isSpotlight?: boolean;
}

export const InteractiveLookbook: React.FC<InteractiveLookbookProps> = ({ isSpotlight = false }) => {
  const { addToCart, setIsCartOpen } = useCart();
  const [activeLookIdx, setActiveLookIdx] = useState(0);
  const [activeSpot, setActiveSpot] = useState<LookbookHotspot | null>(null);
  const [selectedSizes, setSelectedSizes] = useState<Record<string, string>>({
    'spot-01-top': 'M',
    'spot-01-bottom': '32',
    'spot-01-acc': 'O/S',
    'spot-02-top': 'L',
    'spot-02-bottom': '32',
    'spot-03-top': 'L',
    'spot-03-bottom': '32'
  });
  const [addedNotice, setAddedNotice] = useState<string | null>(null);

  const currentLook = EDITORIAL_LOOKS[activeLookIdx];

  const handleSizeChange = (spotId: string, size: string) => {
    setSelectedSizes((prev) => ({ ...prev, [spotId]: size }));
  };

  const getProductForHotspot = (spot: LookbookHotspot): Product => {
    const found = PRODUCTS.find((p) => p.id === spot.productId);
    if (found) return found;

    return {
      id: spot.productId,
      name: spot.name,
      subtitle: spot.subtitle,
      price: spot.price,
      currency: '$',
      category: spot.role === 'Bottom' ? 'bottoms' : spot.role === 'Accessory' ? 'accessories' : 'long-sleeve',
      featured: false,
      images: [spot.image],
      color: spot.name.includes('White') ? 'Optic White' : 'Washed Black',
      colorsAvailable: [],
      sizes: spot.availableSizes,
      description: spot.subtitle,
      details: ['Crafted in Portugal', '340 GSM Combed Cotton', 'Pre-shrunk treatment'],
      fabricCare: ['Machine wash cold', 'Lay flat to dry'],
      shippingInfo: 'Complimentary shipping included.'
    };
  };

  const handleQuickAddSingle = (spot: LookbookHotspot) => {
    const size = selectedSizes[spot.id] || spot.availableSizes[0] || 'M';
    const product = getProductForHotspot(spot);
    addToCart(product, size, 1);
    setAddedNotice(spot.name);
    setTimeout(() => setAddedNotice(null), 3000);
    setIsCartOpen(true);
  };

  const handleShopFullLook = () => {
    currentLook.hotspots.forEach((spot) => {
      const size = selectedSizes[spot.id] || spot.availableSizes[0] || 'M';
      const product = getProductForHotspot(spot);
      // Apply 10% discount on bundle pieces
      const discountedProduct: Product = {
        ...product,
        price: Math.round(product.price * 0.9)
      };
      addToCart(discountedProduct, size, 1);
    });

    setAddedNotice(`Complete Look: ${currentLook.title}`);
    setTimeout(() => setAddedNotice(null), 3500);
    setIsCartOpen(true);
  };

  const lookTotalRaw = currentLook.hotspots.reduce((sum, h) => sum + h.price, 0);
  const lookTotalDiscounted = Math.round(lookTotalRaw * 0.9);

  return (
    <section aria-label="Interactive Shoppable Lookbook" className="relative font-sans">
      
      {/* Header if not embedded spotlight */}
      {!isSpotlight && (
        <div className="text-center max-w-3xl mx-auto space-y-3 pb-8 sm:pb-12">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-black text-white text-[10px] uppercase font-mono tracking-widest">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            <span>Interactive Shoppable Editorial</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-light uppercase tracking-wider text-black">
            The Autumn / Winter Lookbook
          </h2>
          <p className="text-xs sm:text-sm text-[#666666] leading-relaxed max-w-2xl mx-auto font-light">
            An architectural study in silhouette, heavyweight 340 GSM textiles, and baroque sleeve calligraphy. Tap on pulsing pins on the model's outfit to inspect garment specifications, select your size, or purchase directly.
          </p>
        </div>
      )}

      {/* Look Selector Tabs */}
      <div className="flex items-center justify-center gap-2 sm:gap-4 mb-6 sm:mb-8 overflow-x-auto pb-2 scrollbar-none">
        {EDITORIAL_LOOKS.map((look, idx) => {
          const isActive = activeLookIdx === idx;
          return (
            <button
              key={look.id}
              type="button"
              onClick={() => {
                setActiveLookIdx(idx);
                setActiveSpot(null);
              }}
              className={`px-4 sm:px-6 py-2.5 sm:py-3 text-xs uppercase tracking-wider font-mono transition-all border flex items-center gap-2 whitespace-nowrap ${
                isActive
                  ? 'bg-black text-white border-black shadow-lg scale-102'
                  : 'bg-white text-[#666666] border-[#EAEAEA] hover:border-black hover:text-black'
              }`}
            >
              <span className={`text-[10px] font-bold ${isActive ? 'text-emerald-400' : 'text-[#AAAAAA]'}`}>
                {look.number}
              </span>
              <span>{look.title}</span>
            </button>
          );
        })}
      </div>

      {/* Main Interactive Stage */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-[#FAFAFA] border border-[#EAEAEA] p-4 sm:p-8 lg:p-10 shadow-sm">
        
        {/* Left: Editorial Image with Pulsing Hotspots */}
        <div className="lg:col-span-8 aspect-[4/5] sm:aspect-[16/10] bg-white border border-[#EAEAEA] overflow-hidden relative group select-none">
          <img
            src={currentLook.image}
            alt={currentLook.title}
            loading="lazy"
            decoding="async"
            width={1200}
            height={750}
            className="w-full h-full object-cover sm:object-contain bg-white transition-transform duration-700 group-hover:scale-[1.01]"
          />

          {/* Luxury Watermark Badge */}
          <div className="absolute top-4 left-4 bg-black/80 backdrop-blur-sm text-white px-3 py-1 text-[9px] uppercase font-mono tracking-widest pointer-events-none z-10 flex items-center gap-2">
            <span>Look {currentLook.number} // {currentLook.title}</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          </div>

          {/* Hint Overlay Banner */}
          <div className="absolute bottom-4 left-4 right-4 sm:left-auto sm:right-4 bg-white/95 backdrop-blur-md border border-black/10 px-3 py-1.5 text-[10px] uppercase font-mono text-[#555555] tracking-wider pointer-events-none z-10 shadow-md flex items-center justify-between sm:justify-start gap-2">
            <span className="w-2 h-2 rounded-full bg-black animate-pulse" />
            <span>Tap any pulsing pin to inspect & quick-buy piece</span>
          </div>

          {/* Pulsing Hotspots on Garments */}
          {currentLook.hotspots.map((spot) => {
            const isSpotActive = activeSpot?.id === spot.id;
            return (
              <div
                key={spot.id}
                className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer z-20"
                style={{ top: `${spot.y}%`, left: `${spot.x}%` }}
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveSpot(isSpotActive ? null : spot);
                }}
              >
                <div className="relative flex items-center justify-center group/pin">
                  {/* Radar Pulse Effect */}
                  <span className="animate-ping absolute inline-flex h-9 w-9 rounded-full bg-white opacity-80" />
                  <span className="animate-pulse absolute inline-flex h-6 w-6 rounded-full bg-black/40" />

                  {/* Pin Badge */}
                  <button
                    type="button"
                    aria-label={`Inspect ${spot.name}`}
                    className={`relative w-8 h-8 sm:w-9 sm:h-9 rounded-full border-2 flex items-center justify-center text-xs font-bold shadow-2xl transition-all ${
                      isSpotActive
                        ? 'bg-emerald-500 text-white border-white scale-125'
                        : 'bg-black text-white border-white hover:scale-115'
                    }`}
                  >
                    <Plus className={`w-4 h-4 transition-transform duration-300 ${isSpotActive ? 'rotate-45' : ''}`} />
                  </button>

                  {/* Hover Tag */}
                  <span className="absolute left-10 top-1/2 -translate-y-1/2 bg-black text-white text-[10px] uppercase font-mono px-2.5 py-1 tracking-wider whitespace-nowrap shadow-xl hidden sm:block opacity-90 group-hover/pin:opacity-100 transition-opacity">
                    {spot.role}: {spot.name.split('—')[0].trim()}
                  </span>
                </div>
              </div>
            );
          })}

          {/* Interactive Floating Quick Card */}
          {activeSpot && (
            <div
              className="absolute bottom-4 left-4 right-4 sm:bottom-6 sm:left-6 sm:right-auto z-30 bg-white border-2 border-black p-4 sm:p-5 shadow-2xl max-w-sm w-full animate-scale-in font-mono"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between text-[9px] uppercase tracking-widest text-[#888888] pb-2 border-b border-[#EAEAEA]">
                <div className="flex items-center gap-1.5 text-black font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>{activeSpot.role} Piece // Look {currentLook.number}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveSpot(null)}
                  className="text-black hover:opacity-60 p-1"
                  aria-label="Close card"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex gap-3 pt-3 items-center">
                <div className="w-16 h-20 bg-[#F7F7F7] border border-[#EAEAEA] flex-shrink-0 overflow-hidden flex items-center justify-center p-1">
                  <img
                    src={activeSpot.image}
                    alt={activeSpot.name}
                    loading="lazy"
                    decoding="async"
                    width={64}
                    height={80}
                    className="w-full h-full object-contain mix-blend-multiply"
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-sans font-semibold text-black truncate uppercase">
                    {activeSpot.name}
                  </h4>
                  <p className="text-[10px] text-[#666666] truncate mt-0.5 font-sans">
                    {activeSpot.subtitle}
                  </p>
                  <p className="text-xs font-bold text-black pt-1">
                    ${activeSpot.price}.00 USD
                  </p>

                  {/* Size Selector */}
                  <div className="flex items-center gap-1 pt-2 flex-wrap">
                    <span className="text-[9px] text-[#888888] uppercase">Size:</span>
                    {activeSpot.availableSizes.map((sz) => {
                      const isSelected = (selectedSizes[activeSpot.id] || activeSpot.availableSizes[0]) === sz;
                      return (
                        <button
                          key={sz}
                          type="button"
                          onClick={() => handleSizeChange(activeSpot.id, sz)}
                          className={`px-1.5 py-0.5 text-[9px] font-mono border transition-all ${
                            isSelected
                              ? 'bg-black text-white border-black font-bold'
                              : 'border-[#DDDDDD] text-[#444444] hover:border-black'
                          }`}
                        >
                          {sz}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Actions Strip */}
              <div className="grid grid-cols-2 gap-2 pt-3 mt-3 border-t border-[#EAEAEA]">
                <button
                  type="button"
                  onClick={() => handleQuickAddSingle(activeSpot)}
                  className="bg-black hover:bg-[#222222] text-white py-2 px-3 text-[10px] uppercase tracking-wider flex items-center justify-center gap-1.5 font-bold transition-colors shadow-sm"
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>Quick Add</span>
                </button>
                <Link
                  to={`/product/${activeSpot.productId}`}
                  className="border border-black text-black hover:bg-black hover:text-white py-2 px-3 text-[10px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors text-center"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Details</span>
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Right: Look Breakdown & Shop the Look Action */}
        <div className="lg:col-span-4 space-y-6">
          <div className="space-y-2">
            <span className="text-[10px] font-mono uppercase tracking-widest text-[#888888] block">
              Look {currentLook.number} Specification
            </span>
            <h3 className="text-2xl sm:text-3xl font-light uppercase tracking-wider text-black">
              {currentLook.title}
            </h3>
            <p className="text-xs font-mono text-emerald-600 font-bold uppercase tracking-wider">
              {currentLook.subtitle}
            </p>
          </div>

          <p className="text-xs text-[#555555] leading-relaxed">
            {currentLook.description}
          </p>

          {/* Curated Ensemble Pieces List */}
          <div className="space-y-2.5 pt-2">
            <span className="text-[10px] font-mono uppercase tracking-widest text-[#777777] block">
              Ensemble Pieces ({currentLook.hotspots.length} Silhouettes):
            </span>

            <div className="space-y-2">
              {currentLook.hotspots.map((spot) => (
                <div
                  key={spot.id}
                  onClick={() => setActiveSpot(spot)}
                  className={`p-3 border text-xs flex items-center justify-between cursor-pointer transition-all ${
                    activeSpot?.id === spot.id
                      ? 'bg-white border-black shadow-sm -translate-x-1'
                      : 'bg-white/60 border-[#EAEAEA] hover:border-black hover:bg-white'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-[9px] font-mono px-1.5 py-0.5 bg-black text-white uppercase">
                      {spot.role}
                    </span>
                    <span className="truncate text-black font-medium">{spot.name.split('—')[0]}</span>
                  </div>
                  <span className="font-mono font-bold text-black flex-shrink-0">${spot.price}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Shop Full Look Box */}
          <div className="bg-white border-2 border-black p-5 space-y-4 shadow-md font-mono">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[9px] uppercase tracking-widest text-[#888888] block">
                  Curated Look Bundle
                </span>
                <span className="text-xs font-bold text-black uppercase">
                  Complete {currentLook.title} Styling
                </span>
              </div>
              <div className="text-right">
                <span className="text-sm font-bold text-black block">${lookTotalDiscounted}.00</span>
                <span className="text-[10px] text-[#888888] line-through">${lookTotalRaw}.00</span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 p-2">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
              <span>Includes 10% complimentary styling bundle discount</span>
            </div>

            <button
              type="button"
              onClick={handleShopFullLook}
              className="w-full bg-black hover:bg-[#222222] text-white py-3.5 px-4 text-xs uppercase tracking-luxury font-medium flex items-center justify-center gap-2 transition-all shadow-md"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Add Entire Look to Bag</span>
            </button>
          </div>

        </div>

      </div>

      {/* Global Added Notice Toast */}
      {addedNotice && (
        <div className="fixed bottom-6 right-6 z-50 bg-black text-white px-5 py-3.5 text-xs uppercase font-mono tracking-wider shadow-2xl flex items-center gap-2.5 animate-slide-up border border-white/20">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>Added {addedNotice} to your Shopping Bag</span>
        </div>
      )}

    </section>
  );
};
