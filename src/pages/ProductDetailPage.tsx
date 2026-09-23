import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { getProductById, getAllProducts, type Product } from '../lib/products';
import { addRecentlyViewed } from '../lib/recentlyViewed';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { ProductCard } from '../components/ui/ProductCard';
import { ProductGallery } from '../components/ui/ProductGallery';
import { ProductImage } from '../components/ui/ProductImage';
import { DeliveryChecker } from '../components/ui/DeliveryChecker';
import { RestockModal } from '../components/ui/RestockModal';

// ─── Trust Badges Strip ───────────────────────────────────────────────────────
const TrustBadges: React.FC = () => (
  <div className="grid grid-cols-3 gap-2 border border-[#EAEAEA] bg-[#FAFAFA] px-3 py-3">
    {[
      {
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.955 11.955 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
          </svg>
        ),
        label: 'Secure Checkout',
      },
      {
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
        ),
        label: '14-Day Returns',
      },
      {
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
          </svg>
        ),
        label: 'Authentic Goods',
      },
    ].map(({ icon, label }) => (
      <div key={label} className="flex flex-col items-center gap-1.5 text-center">
        <span className="text-[#444444]">{icon}</span>
        <span className="text-[9px] uppercase tracking-widest text-[#777777] leading-tight">{label}</span>
      </div>
    ))}
  </div>
);

// ─── Share Button ─────────────────────────────────────────────────────────────
const ShareButton: React.FC<{ productName: string }> = ({ productName }) => {
  const [copied, setCopied] = useState(false);
  const url = window.location.href;

  const copyLink = () => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const whatsapp = () => {
    window.open(
      `https://wa.me/?text=${encodeURIComponent(`${productName} — ${url}`)}`,
      '_blank',
      'noopener,noreferrer'
    );
  };

  return (
    <div className="flex items-center gap-3 pt-1">
      <span className="text-[10px] uppercase tracking-widest text-[#AAAAAA]">Share</span>
      {/* Copy link */}
      <button
        type="button"
        onClick={copyLink}
        title="Copy link"
        className="flex items-center gap-1.5 text-[11px] text-[#555555] hover:text-black transition-colors border border-[#EAEAEA] px-2.5 py-1.5 hover:border-black"
      >
        {copied ? (
          <>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3 text-emerald-600"><polyline points="20 6 9 17 4 12"/></svg>
            <span>Copied</span>
          </>
        ) : (
          <>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3 h-3">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
            </svg>
            <span>Copy Link</span>
          </>
        )}
      </button>
      {/* WhatsApp */}
      <button
        type="button"
        onClick={whatsapp}
        title="Share on WhatsApp"
        className="flex items-center gap-1.5 text-[11px] text-[#555555] hover:text-black transition-colors border border-[#EAEAEA] px-2.5 py-1.5 hover:border-black"
      >
        <svg viewBox="0 0 24 24" className="w-3 h-3 fill-current text-[#25D366]">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
        <span>WhatsApp</span>
      </button>
    </div>
  );
};


// ─── Image Lightbox ───────────────────────────────────────────────────────────
const ImageLightbox: React.FC<{
  src: string;
  alt: string;
  onClose: () => void;
}> = ({ src, alt, onClose }) => {
  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Image zoom"
    >
      <button
        onClick={onClose}
        className="absolute top-5 right-5 text-white/70 hover:text-white text-2xl leading-none focus:outline-none"
        aria-label="Close zoom"
      >
        ✕
      </button>
      <img
        src={src}
        alt={alt}
        onClick={(e) => e.stopPropagation()}
        className="max-w-full max-h-[90vh] object-contain select-none"
        draggable={false}
      />
      <p className="absolute bottom-5 text-white/40 text-[10px] uppercase tracking-widest">
        Click anywhere to close
      </p>
    </div>
  );
};

// ─── Sticky ATC Bar ───────────────────────────────────────────────────────────
const StickyATCBar: React.FC<{
  product: Product;
  selectedSize: string;
  quantity: number;
  visible: boolean;
  onAddToCart: () => void;
  onRestockMe?: () => void;
  isSoldOut: boolean;
}> = ({ product, selectedSize, quantity, visible, onAddToCart, onRestockMe, isSoldOut }) => (
  <div
    className={`fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-[#EAEAEA] shadow-2xl transition-transform duration-300 ${
      visible ? 'translate-y-0' : 'translate-y-full'
    }`}
    aria-hidden={!visible}
  >
    <div className="max-w-[1720px] mx-auto px-4 sm:px-10 lg:px-16 py-3 flex items-center gap-4">
      {/* Thumbnail */}
      <div className="hidden sm:block">
        <ProductImage
          src={product.images[0]}
          alt={product.name}
          placement="sticky-bar"
        />
      </div>

      {/* Name + size */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-[#111111] truncate">{product.name}</p>
        <p className="text-[10px] text-[#888888] uppercase tracking-wider">
          Size: {selectedSize}
          {quantity > 1 ? ` · Qty: ${quantity}` : ''}
        </p>
      </div>

      {/* Price */}
      <span className="text-sm font-medium text-[#111111] flex-shrink-0 hidden sm:block">
        {product.currency}{(product.price * quantity).toFixed(2)}
      </span>

      {/* CTA */}
      <button
        type="button"
        onClick={isSoldOut ? onRestockMe : onAddToCart}
        className={[
          'flex-shrink-0 text-xs uppercase tracking-luxury py-3 px-6 font-medium transition-all flex items-center gap-1.5',
          isSoldOut
            ? 'bg-[#111111] hover:bg-black text-white'
            : 'bg-[#111111] hover:bg-black text-white',
        ].join(' ')}
      >
        {isSoldOut ? (
          <>
            <Bell className="w-3.5 h-3.5" />
            <span>Restock Me</span>
          </>
        ) : (
          'Add to Bag'
        )}
      </button>
    </div>
  </div>
);

// ─── Main Page ────────────────────────────────────────────────────────────────
export const ProductDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { toggleSaveItem, isItemSaved } = useAuth();

  const [product, setProduct] = useState<Product | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [selectedSize, setSelectedSize] = useState<string>('M');
  const [quantity, setQuantity] = useState(1);
  const [addedNotice, setAddedNotice] = useState(false);
  const [showSizeGuide, setShowSizeGuide] = useState(false);
  const [showRestockModal, setShowRestockModal] = useState(false);

  // Sticky ATC bar — visible when the inline ATC button scrolls out of view
  const atcButtonRef = useRef<HTMLDivElement>(null);
  const [stickyBarVisible, setStickyBarVisible] = useState(false);

  // Lightbox
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  // Accordion state
  const [openSection, setOpenSection] = useState<'details' | 'care' | 'delivery' | null>('details');

  // Close size guide on Escape and prevent body scroll
  useEffect(() => {
    if (!showSizeGuide) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowSizeGuide(false); };
    window.addEventListener('keydown', onKey);
    const orig = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = orig;
    };
  }, [showSizeGuide]);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setSelectedImageIndex(0);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (id) {
      addRecentlyViewed(id);
      getProductById(id).then((found) => {
        if (isMounted) {
          setProduct(found);
          if (found) {
            addRecentlyViewed(found.id);
            if (found.sizes.length > 0) setSelectedSize(found.sizes[0]);
          }
          setLoading(false);
        }
      });
    }

    getAllProducts().then((all) => {
      if (isMounted) {
        setRelatedProducts(all.filter((p) => p.id !== id).slice(0, 4));
      }
    });

    return () => { isMounted = false; };
  }, [id]);

  // IntersectionObserver: show sticky bar when ATC button leaves viewport
  useEffect(() => {
    const el = atcButtonRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => setStickyBarVisible(!entry.isIntersecting),
      { threshold: 0, rootMargin: '0px 0px -60px 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loading]);

  if (loading) {
    return (
      <div className="pt-36 pb-24 min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center">
        <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-xs uppercase tracking-luxury text-[#777777]">
          Retrieving Archival Silhouette...
        </p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="pt-36 pb-24 min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center">
        <h2 className="text-xl uppercase tracking-wider font-light mb-4">Silhouette Not Found</h2>
        <p className="text-xs text-[#777777] mb-8 max-w-sm">
          The requested archival piece may be unavailable or moved to private exhibition.
        </p>
        <Link
          to="/shop"
          className="bg-black text-white px-8 py-3.5 text-xs uppercase tracking-luxury hover:opacity-80 transition-opacity"
        >
          Return to Catalog
        </Link>
      </div>
    );
  }

  const selectedSizeStock = product.stockBySize?.[selectedSize];
  const isSoldOut = selectedSizeStock !== undefined && selectedSizeStock === 0;

  const handleAddToCart = () => {
    if (isSoldOut) return;
    addToCart(product, selectedSize, quantity);
    setAddedNotice(true);
    setTimeout(() => setAddedNotice(false), 2500);
  };

  const isSaved = isItemSaved(product.id);

  // Primary viewer image (for lightbox)
  const primaryMediaItem = (product.mediaItems ?? [])[selectedImageIndex];
  const primaryIsImage = !primaryMediaItem || primaryMediaItem.type === 'image' || primaryMediaItem.type === 'gif';
  const lightboxTriggerSrc = primaryMediaItem?.type === 'video'
    ? (primaryMediaItem.posterUrl ?? primaryMediaItem.url)
    : primaryMediaItem?.url ?? product.images[0];

  return (
    <div className="pt-24 sm:pt-32 min-h-screen bg-white">
      <div className="max-w-[1720px] mx-auto px-6 sm:px-10 lg:px-16">

        {/* Breadcrumb */}
        <div className="py-4 text-[11px] text-[#888888] tracking-luxury uppercase">
          <Link to="/" className="hover:text-black transition-colors">Home</Link>
          <span className="mx-2">/</span>
          <Link to="/shop" className="hover:text-black transition-colors">Shop</Link>
          <span className="mx-2">/</span>
          <span className="text-black">{product.name}</span>
        </div>

        {/* Main Two-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 xl:gap-16 pt-4 sm:pt-6">

          {/* LEFT: Gallery */}
          <div className="lg:col-span-7">
            {/* Zoom hint */}
            {primaryIsImage && (
              <p className="text-[10px] text-[#AAAAAA] uppercase tracking-widest mb-2 text-right hidden sm:block">
                Click image to zoom
              </p>
            )}
            <div
              className={primaryIsImage ? 'cursor-zoom-in' : ''}
              onClick={() => {
                if (primaryIsImage) setLightboxSrc(lightboxTriggerSrc);
              }}
            >
              <ProductGallery
                mediaItems={product.mediaItems ?? product.images.map((url, i) => ({ url, type: 'image' as const, displayOrder: i }))}
                productName={product.name}
                selectedIndex={selectedImageIndex}
                onSelect={setSelectedImageIndex}
                viewerSlot={
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleSaveItem(product.id); }}
                    aria-label={isSaved ? 'Remove from Wishlist' : 'Save to Wishlist'}
                    className="bg-white/80 backdrop-blur-sm p-2 rounded-full hover:bg-white text-black transition-all shadow-sm"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
                      fill={isSaved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5">
                      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                    </svg>
                  </button>
                }
              />
            </div>
          </div>

          {/* RIGHT: Details (Sticky Column on Desktop per REFERENCE-SPEC 8.1) */}
          <div className="lg:col-span-5 flex flex-col justify-start lg:sticky lg:top-24 self-start space-y-6 select-none">

            {/* Top Stock Badge + Brand + Title + Price (Sorvea Reference Hierarchy) */}
            <div className="space-y-2 border-b border-[#DDDDDD] pb-6">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-[#E4E4E4] text-[#212121] text-[10px] font-spec font-bold uppercase tracking-spec">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#212121]" />
                  {isSoldOut ? 'Restock Soon' : 'In Stock'}
                </span>
              </div>
              <span className="text-[11px] text-[#8E8E8E] font-spec font-bold tracking-spec uppercase block">
                VB Fits Studios
              </span>
              <h1 className="text-xl sm:text-2xl font-spec font-bold uppercase tracking-spec text-[#2D2D2D] leading-tight">
                {product.name}
              </h1>
              <div className="pt-1 flex items-baseline gap-3">
                <span className="text-base font-spec font-normal text-[#2D2D2D] tracking-spec">
                  {product.currency}{product.price.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Color Selection (Sorvea Style Pills) */}
            {product.colorsAvailable?.length > 0 && (
              <div className="space-y-2">
                <span className="text-[11px] font-spec font-bold uppercase tracking-spec text-[#8E8E8E] block">
                  Color
                </span>
                <div className="flex flex-wrap gap-2">
                  {product.colorsAvailable.map((c) => (
                    <button
                      key={c.productId}
                      type="button"
                      onClick={() => navigate(`/product/${c.productId}`)}
                      className={`inline-flex items-center space-x-2 px-3.5 py-1.5 border text-xs font-spec font-bold uppercase tracking-spec transition-all ${
                        c.name === product.color
                          ? 'border-[#2D2D2D] bg-[#2D2D2D] text-white shadow-xs'
                          : 'border-[#DDDDDD] bg-white text-[#2D2D2D] hover:border-black'
                      }`}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full border border-black/20"
                        style={{ backgroundColor: c.hex }}
                      />
                      <span>{c.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Size Selector + Size Chart */}
            <div className="space-y-3 pt-1">
              <div className="flex justify-between items-center text-xs">
                <span className="text-[11px] font-spec font-bold uppercase tracking-spec text-[#8E8E8E]">
                  Select Size
                </span>
                <button
                  type="button"
                  onClick={() => setShowSizeGuide(true)}
                  className="text-[11px] font-spec font-bold uppercase tracking-spec underline text-[#2D2D2D] hover:opacity-75"
                >
                  Sizechart
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {product.sizes.map((sz) => {
                  const stock = product.stockBySize?.[sz];
                  const oos = stock !== undefined && stock === 0;
                  const low = stock !== undefined && stock > 0 && stock <= 5;
                  const sel = selectedSize === sz;
                  return (
                    <button
                      key={sz}
                      type="button"
                      disabled={oos}
                      onClick={() => setSelectedSize(sz)}
                      aria-label={oos ? `${sz} — Sold Out` : `Select size ${sz}${low ? `, only ${stock} left` : ''}`}
                      className={[
                        'relative h-9 min-w-[44px] px-3 text-xs font-spec font-bold uppercase tracking-spec transition-colors flex items-center justify-center border rounded-none',
                        oos
                          ? 'border-[#DDDDDD] bg-[#FAFAFA] text-[#ADADAD] cursor-not-allowed'
                          : sel
                            ? 'border-[#2D2D2D] bg-white text-[#2D2D2D] ring-1 ring-[#2D2D2D]'
                            : 'border-[#DDDDDD] bg-white text-[#2D2D2D] hover:border-black',
                      ].join(' ')}
                    >
                      {oos && (
                        <span
                          aria-hidden="true"
                          className="absolute inset-0 pointer-events-none"
                          style={{
                            background:
                              'linear-gradient(to top right, transparent calc(50% - 0.5px), #ADADAD calc(50% - 0.5px), #ADADAD calc(50% + 0.5px), transparent calc(50% + 0.5px))',
                          }}
                        />
                      )}
                      <span className="relative">{sz}</span>
                    </button>
                  );
                })}
              </div>

              {/* Stock warning */}
              {selectedSizeStock !== undefined && selectedSizeStock === 0 && (
                <div className="p-3 bg-[#FAFAFA] border border-[#DDDDDD] flex items-center justify-between text-xs">
                  <span className="font-spec font-bold text-[#C60C0C] uppercase tracking-spec flex items-center gap-1.5 text-[11px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#C60C0C] flex-shrink-0" />
                    Size {selectedSize} is currently out of stock
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowRestockModal(true)}
                    className="font-spec font-bold text-[10px] text-[#2D2D2D] uppercase tracking-spec underline hover:opacity-70 flex items-center gap-1"
                  >
                    <Bell className="w-3 h-3" />
                    <span>Restock Me</span>
                  </button>
                </div>
              )}
            </div>

            {/* Dominant Add to Cart Button (Sorvea Style) */}
            <div className="pt-2" ref={atcButtonRef}>
              {isSoldOut ? (
                <button
                  type="button"
                  onClick={() => setShowRestockModal(true)}
                  className="w-full text-xs font-spec font-bold uppercase tracking-spec py-3.5 px-6 transition-all duration-default bg-[#4D4D4D] hover:bg-black text-white flex items-center justify-center gap-2 rounded-none btn-fill-hover shadow-sm"
                >
                  <Bell className="w-4 h-4 text-white" />
                  <span>Restock Me — Size {selectedSize}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleAddToCart}
                  className="w-full text-xs font-spec font-bold uppercase tracking-spec py-3.5 px-6 transition-all duration-default bg-[#4D4D4D] hover:bg-black text-white rounded-none btn-fill-hover shadow-sm"
                >
                  Add to Cart — {product.currency}{(product.price * quantity).toFixed(2)}
                </button>
              )}

              {addedNotice && (
                <div className="mt-2 p-2.5 bg-[#FAFAFA] border border-[#DDDDDD] text-center text-xs font-spec font-medium text-[#2D2D2D] animate-fade-in flex items-center justify-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-600" />
                  Item successfully added to your cart.
                </div>
              )}
            </div>

            {/* Delivery Checker */}
            <DeliveryChecker productId={product.id} />

            {/* Accordions: Description, Shipping & Returns, Wash & Care */}
            <div className="border-t border-[#DDDDDD] divide-y divide-[#DDDDDD] pt-2 text-xs">
              {/* 1. Description */}
              <div className="py-4">
                <button
                  type="button"
                  onClick={() => setOpenSection(openSection === 'details' ? null : 'details')}
                  aria-expanded={openSection === 'details'}
                  className="w-full flex justify-between items-center text-left uppercase tracking-spec font-spec font-bold text-[#2D2D2D] hover:opacity-75 transition-opacity"
                >
                  <span className="text-xs">Description</span>
                  <span className="text-sm font-mono">{openSection === 'details' ? '−' : '+'}</span>
                </button>
                {openSection === 'details' && (
                  <div className="pt-3 space-y-3 text-[#6B6B6B] leading-relaxed animate-fade-in font-spec text-xs">
                    {product.description && <p>{product.description}</p>}
                    {product.details && product.details.length > 0 && (
                      <ul className="list-disc pl-4 space-y-1 pt-1">
                        {product.details.map((d, i) => (
                          <li key={i}>{d}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>

              {/* 2. Shipping & Returns */}
              <div className="py-4">
                <button
                  type="button"
                  onClick={() => setOpenSection(openSection === 'delivery' ? null : 'delivery')}
                  aria-expanded={openSection === 'delivery'}
                  className="w-full flex justify-between items-center text-left uppercase tracking-spec font-spec font-bold text-[#2D2D2D] hover:opacity-75 transition-opacity"
                >
                  <span className="text-xs">Shipping & Returns</span>
                  <span className="text-sm font-mono">{openSection === 'delivery' ? '−' : '+'}</span>
                </button>
                {openSection === 'delivery' && (
                  <div className="pt-3 text-[#6B6B6B] leading-relaxed animate-fade-in font-spec text-xs">
                    <p>{product.shippingInfo || 'Free express shipping on all domestic orders above $200. Standard courier delivery takes 2-4 business days. 14-day hassle-free return policy.'}</p>
                  </div>
                )}
              </div>

              {/* 3. Wash & Care */}
              <div className="py-4">
                <button
                  type="button"
                  onClick={() => setOpenSection(openSection === 'care' ? null : 'care')}
                  aria-expanded={openSection === 'care'}
                  className="w-full flex justify-between items-center text-left uppercase tracking-spec font-spec font-bold text-[#2D2D2D] hover:opacity-75 transition-opacity"
                >
                  <span className="text-xs">Wash & Care</span>
                  <span className="text-sm font-mono">{openSection === 'care' ? '−' : '+'}</span>
                </button>
                {openSection === 'care' && (
                  <div className="pt-3 space-y-2 text-[#6B6B6B] leading-relaxed animate-fade-in font-spec text-xs">
                    <ul className="list-disc pl-4 space-y-1">
                      {product.fabricCare && product.fabricCare.length > 0 ? (
                        product.fabricCare.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))
                      ) : (
                        <>
                          <li>100% Combed Heavyweight Organic Cotton</li>
                          <li>Machine wash cold inside out with like colors</li>
                          <li>Do not tumble dry; lay flat to dry</li>
                          <li>Cool iron on reverse side if necessary</li>
                        </>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>

        {/* Related Products */}
        {relatedProducts.length > 0 && (
          <div className="pt-20 sm:pt-28 pb-16 border-t border-[#EAEAEA] mt-16">
            <div className="flex flex-col items-center text-center mb-10 space-y-2">
              <span className="text-[10px] text-[#888888] tracking-luxury uppercase">Curated Suggestions</span>
              <h2 className="text-2xl font-light uppercase tracking-wider text-black">Complementary Silhouettes</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {relatedProducts.map((p) => <ProductCard key={p.id} product={p} variant="grid" />)}
            </div>
          </div>
        )}

      </div>

      {/* Size Guide Modal */}
      {showSizeGuide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
          role="dialog"
          aria-modal="true"
          aria-labelledby="size-guide-modal-title"
          onClick={() => setShowSizeGuide(false)}
        >
          <div
            className="bg-white max-w-lg w-full p-8 relative shadow-2xl animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center border-b border-[#EAEAEA] pb-4 mb-6">
              <h3 id="size-guide-modal-title" className="text-xs uppercase tracking-widest font-semibold text-black">
                Garment Measurements (Inches)
              </h3>
              <button
                type="button"
                onClick={() => setShowSizeGuide(false)}
                className="text-black text-lg hover:opacity-60 p-1 leading-none rounded focus-visible:ring-2 focus-visible:ring-black"
                aria-label="Close size chart"
              >
                ✕
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left" aria-label="Garment size measurements in inches">
                <thead>
                  <tr className="border-b border-[#EAEAEA] text-[#888888]">
                    <th scope="col" className="py-2">Size</th><th scope="col" className="py-2">Chest</th>
                    <th scope="col" className="py-2">Length</th><th scope="col" className="py-2">Sleeve</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EAEAEA]">
                  <tr><th scope="row" className="py-2.5 font-medium text-left">S</th><td>44"</td><td>28"</td><td>25.5"</td></tr>
                  <tr><th scope="row" className="py-2.5 font-medium text-left">M</th><td>46"</td><td>29"</td><td>26.0"</td></tr>
                  <tr><th scope="row" className="py-2.5 font-medium text-left">L</th><td>48"</td><td>30"</td><td>26.5"</td></tr>
                  <tr><th scope="row" className="py-2.5 font-medium text-left">XL</th><td>50"</td><td>31"</td><td>27.0"</td></tr>
                  <tr><th scope="row" className="py-2.5 font-medium text-left">XXL</th><td>52"</td><td>32"</td><td>27.5"</td></tr>
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-[#777777] mt-4">
              All measurements are taken flat. Designed with an intentional boxy luxury drape.
            </p>
          </div>
        </div>
      )}

      {/* Image Lightbox */}
      {lightboxSrc && (
        <ImageLightbox
          src={lightboxSrc}
          alt={product.name}
          onClose={() => setLightboxSrc(null)}
        />
      )}

      {/* Sticky ATC Bar */}
      <StickyATCBar
        product={product}
        selectedSize={selectedSize}
        quantity={quantity}
        visible={stickyBarVisible}
        onAddToCart={handleAddToCart}
        onRestockMe={() => setShowRestockModal(true)}
        isSoldOut={isSoldOut}
      />

      {/* Restock Me Modal */}
      <RestockModal
        isOpen={showRestockModal}
        onClose={() => setShowRestockModal(false)}
        productId={product.id}
        productName={product.name}
        productImage={product.images[0]}
        selectedSize={selectedSize}
        productVariantId={product.variantIdBySize?.[selectedSize]}
      />

    </div>
  );
};
