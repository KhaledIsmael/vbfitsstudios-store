import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart, type CartItem } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { BRAND_CONFIG } from '../../config/assets';
import { CartDrawerSkeleton } from '../ui/SkeletonCard';
import { ProductImage } from '../ui/ProductImage';

/** Keep Tab/Shift+Tab cycling inside an open dialog. */
function useFocusTrap(ref: React.RefObject<HTMLDivElement | null>, active: boolean) {
  useEffect(() => {
    if (!active || !ref.current) return;
    const el = ref.current;
    const SELECTOR = [
      'a[href]', 'button:not([disabled])', 'input:not([disabled])',
      'select:not([disabled])', 'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])'
    ].join(',');
    const getFocusable = () => Array.from(el.querySelectorAll<HTMLElement>(SELECTOR));
    getFocusable()[0]?.focus();
    const trap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const nodes = getFocusable();
      if (!nodes.length) return;
      const first = nodes[0]; const last = nodes[nodes.length - 1];
      if (e.shiftKey) { if (document.activeElement === first) { e.preventDefault(); last.focus(); } }
      else            { if (document.activeElement === last)  { e.preventDefault(); first.focus(); } }
    };
    el.addEventListener('keydown', trap);
    return () => el.removeEventListener('keydown', trap);
  }, [active, ref]);
}

export const CartDrawer: React.FC = () => {
  const {
    cart,
    isCartOpen,
    setIsCartOpen,
    removeFromCart,
    updateQuantity,
    subtotal,
    totalItems,
    isCartLoading
  } = useCart();
  const { user, isLoggedIn } = useAuth();
  const navigate = useNavigate();
  const panelRef = useRef<HTMLDivElement>(null);

  // Track item-just-added confirmation state
  const prevItemsRef = useRef(totalItems);
  const [justAddedItem, setJustAddedItem] = useState<CartItem | null>(null);
  const [isJustAddedMode, setIsJustAddedMode] = useState(false);

  // Automatically trigger item-just-added confirmation when item count increases
  useEffect(() => {
    if (totalItems > prevItemsRef.current) {
      const latestItem = cart[cart.length - 1];
      if (latestItem) {
        setJustAddedItem(latestItem);
        setIsJustAddedMode(true);
      }
    }
    prevItemsRef.current = totalItems;
  }, [totalItems, cart]);

  // Reset just-added state when drawer closes
  useEffect(() => {
    if (!isCartOpen) {
      setIsJustAddedMode(false);
    }
  }, [isCartOpen]);

  useFocusTrap(panelRef, isCartOpen);

  // Esc closes the drawer
  useEffect(() => {
    if (!isCartOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsCartOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isCartOpen, setIsCartOpen]);

  // Prevent page scroll while drawer is open
  useEffect(() => {
    document.body.style.overflow = isCartOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isCartOpen]);

  if (!isCartOpen) return null;

  const handleProceedToCheckout = () => {
    setIsCartOpen(false);
    navigate('/checkout');
  };

  const handleContinueShopping = () => {
    setIsCartOpen(false);
  };

  const freeShippingThreshold = 250;
  const isFreeShipping = subtotal >= freeShippingThreshold;
  const progressPercent = Math.min(100, (subtotal / freeShippingThreshold) * 100);

  return (
    <div
      className="fixed inset-0 z-drawer overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cart-drawer-title"
    >
      {/* Dark Scrim with backdrop blur matching MenuDrawer */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-medium"
        onClick={() => setIsCartOpen(false)}
        aria-hidden="true"
      />

      {/* Slide-over panel with drawer motion tokens */}
      <div className="fixed inset-y-0 right-0 max-w-full flex">
        <div
          ref={panelRef}
          className="w-screen max-w-full sm:max-w-[500px] bg-white shadow-2xl flex flex-col justify-between transform transition-transform duration-medium ease-drawer"
        >
          {/* ───────────────────────────────────────────────────────────── */}
          {/* HEADER                                                        */}
          {/* ───────────────────────────────────────────────────────────── */}
          <div className="px-6 py-5 border-b border-spec-border flex items-center justify-between">
            <h2 id="cart-drawer-title" className="text-xs uppercase tracking-widest font-semibold text-[#111111] flex items-center gap-2 font-spec">
              <span>Shopping Bag</span>
              {isCartLoading ? (
                <span className="w-2.5 h-2.5 border-2 border-black/20 border-t-black rounded-full animate-spin" aria-label="Loading" />
              ) : (
                <span aria-label={`${totalItems} items`}>({totalItems})</span>
              )}
            </h2>
            <button
              onClick={() => setIsCartOpen(false)}
              className="p-1.5 text-[#111111] hover:opacity-60 transition-opacity rounded-none"
              aria-label="Close shopping bag"
            >
              <img src={BRAND_CONFIG.icons.close} alt="" aria-hidden="true" className="w-4 h-4" width={16} height={16} />
            </button>
          </div>

          {/* ───────────────────────────────────────────────────────────── */}
          {/* BODY: 3 VISUAL STATES                                         */}
          {/* ───────────────────────────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {isCartLoading ? (
              /* SKELETON: Supabase cart sync or initial load in flight */
              <div className="py-1">
                <div className="flex items-center gap-2 pb-4 mb-1 border-b border-[#F0F0F0]">
                  <span className="w-2 h-2 rounded-full bg-[#CCCCCC] animate-ping flex-shrink-0" />
                  <span className="text-[10px] font-mono text-[#AAAAAA] uppercase tracking-wider">
                    Syncing bag with archive...
                  </span>
                </div>
                <CartDrawerSkeleton count={3} />
              </div>
            ) : cart.length === 0 ? (
              /* ── STATE 1: EMPTY STATE ── */
              <div className="h-full flex flex-col items-center justify-center text-center space-y-5 py-12">
                <div className="w-14 h-14 rounded-full border border-spec-border flex items-center justify-center bg-[#FAFAFA] text-[#111111]">
                  <svg className="w-6 h-6 text-[#333333]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                  </svg>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] uppercase tracking-luxury text-[#888888] font-mono block">
                    Archive Bag · 0 Items
                  </span>
                  <p className="text-xs text-[#111111] tracking-wider uppercase font-medium">Your shopping bag is empty</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsCartOpen(false);
                    navigate('/shop');
                  }}
                  className="w-full bg-[#111111] hover:bg-black text-white text-[12px] uppercase tracking-luxury py-3.5 px-6 font-medium transition-colors"
                >
                  Explore Ready-to-Wear
                </button>

                {/* Login Nudge for Guests */}
                {!isLoggedIn && (
                  <div className="w-full mt-6 p-4 bg-[#FAFAFA] border border-spec-border text-center space-y-2">
                    <p className="text-[10px] uppercase tracking-luxury text-spec-muted font-mono font-semibold">
                      Archival Client Access
                    </p>
                    <p className="text-xs text-[#555555] leading-relaxed">
                      Have an account? Sign in to access your saved pieces and expedited checkout.
                    </p>
                    <Link
                      to="/login"
                      onClick={() => setIsCartOpen(false)}
                      className="inline-block text-[11px] uppercase tracking-wider text-black font-semibold underline underline-offset-4 hover:opacity-70 transition-opacity pt-1"
                    >
                      Sign In / Register
                    </Link>
                  </div>
                )}
              </div>
            ) : isJustAddedMode && justAddedItem ? (
              /* ── STATE 2: ITEM-JUST-ADDED CONFIRMATION STATE ── */
              <div className="py-2 space-y-6 animate-fade-in">
                {/* Confirmation banner */}
                <div className="flex items-center gap-2.5 p-3.5 bg-[#FAFAFA] border border-spec-border text-[#111111]">
                  <span className="w-5 h-5 rounded-full bg-black text-white flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] uppercase tracking-wider font-semibold">Item added to your shopping bag</p>
                    <p className="text-[10px] text-spec-muted">{totalItems} {totalItems === 1 ? 'item' : 'items'} in total</p>
                  </div>
                </div>

                {/* Product summary card with shared ProductImage */}
                <div className="p-4 border border-spec-border bg-white flex gap-4">
                  <div className="flex-shrink-0 border border-spec-border" aria-hidden="true">
                    <ProductImage
                      src={justAddedItem.image}
                      alt=""
                      placement="cart"
                    />
                  </div>
                  <div className="flex-1 flex flex-col justify-between py-0.5 min-w-0">
                    <div>
                      <h3 className="text-xs font-semibold text-[#111111] uppercase tracking-spec leading-snug truncate">
                        {justAddedItem.name}
                      </h3>
                      <p className="text-[11px] font-mono text-spec-muted mt-1 whitespace-nowrap">Size: {justAddedItem.size}</p>
                      <p className="text-[11px] font-mono text-spec-muted whitespace-nowrap">Qty: {justAddedItem.quantity}</p>
                    </div>
                    <p className="text-xs font-semibold text-[#111111] mt-2 whitespace-nowrap overflow-visible">
                      {justAddedItem.currency}{justAddedItem.price.toFixed(2)}
                    </p>
                  </div>
                </div>

                {/* Subtotal preview */}
                <div className="flex justify-between items-center text-xs tracking-wider uppercase font-semibold text-[#111111] pt-1">
                  <span>Bag Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>

                {/* Two Action Buttons: Check out and Continue shopping */}
                <div className="space-y-2.5 pt-2">
                  <button
                    type="button"
                    onClick={handleProceedToCheckout}
                    className="w-full bg-[#111111] hover:bg-black text-white text-[12px] uppercase tracking-luxury py-4 px-6 font-semibold transition-colors flex items-center justify-center gap-2"
                  >
                    Check out
                  </button>
                  <button
                    type="button"
                    onClick={handleContinueShopping}
                    className="w-full bg-white hover:bg-[#F5F5F5] text-[#111111] border border-spec-border text-[12px] uppercase tracking-luxury py-3.5 px-6 font-medium transition-colors"
                  >
                    Continue shopping
                  </button>
                </div>

                {/* Switch to filled bag view */}
                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => setIsJustAddedMode(false)}
                    className="text-[11px] text-spec-muted hover:text-black uppercase tracking-wider underline underline-offset-4"
                  >
                    View full bag ({totalItems})
                  </button>
                </div>
              </div>
            ) : (
              /* ── STATE 3: FILLED STATE ── */
              <div className="space-y-4">
                {/* Free Shipping Progress Bar per REFERENCE-SPEC 10.2 */}
                <div className="py-2">
                  <div className="flex justify-between items-center text-[11px] uppercase tracking-wider mb-2 font-mono text-spec-muted">
                    {isFreeShipping ? (
                      <span className="text-black font-semibold">Complimentary Express Shipping Unlocked</span>
                    ) : (
                      <span>${(freeShippingThreshold - subtotal).toFixed(2)} away from free shipping</span>
                    )}
                    <span>{Math.round(progressPercent)}%</span>
                  </div>
                  <div className="w-full h-1 bg-[#EAEAEA] rounded-none overflow-hidden">
                    <div
                      className="h-full bg-black transition-all duration-long ease-in-out"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>

                {/* Item List */}
                <ul className="divide-y divide-spec-border" aria-label="Items in your bag">
                  {cart.map((item) => (
                    <li key={item.id} className="py-4 flex gap-4">
                      {/* Item Image with shared ProductImage */}
                      <div className="flex-shrink-0 border border-spec-border" aria-hidden="true">
                        <ProductImage
                          src={item.image}
                          alt=""
                          placement="cart"
                        />
                      </div>

                      {/* Item Details */}
                      <div className="flex-1 flex flex-col justify-between py-0.5">
                        <div>
                          <div className="flex justify-between items-start gap-2">
                            <h3 className="text-xs font-semibold text-[#111111] leading-snug uppercase tracking-spec">
                              {item.name}
                            </h3>
                            <button
                              onClick={() => removeFromCart(item.id)}
                              className="text-[11px] text-spec-muted hover:text-black transition-colors underline font-mono"
                              aria-label={`Remove ${item.name} from bag`}
                            >
                              Remove
                            </button>
                          </div>
                          <p className="text-[11px] font-mono text-spec-muted mt-1 whitespace-nowrap">Size: {item.size}</p>
                          <p className="text-xs font-semibold text-[#111111] mt-1 whitespace-nowrap overflow-visible">
                            {item.currency}{item.price.toFixed(2)}
                          </p>
                        </div>

                        {/* Quantity Selector */}
                        <div className="flex items-center gap-3 pt-2">
                          <div
                            className="flex items-center border border-spec-border"
                            role="group"
                            aria-label={`Quantity for ${item.name}`}
                          >
                            <button
                              onClick={() => updateQuantity(item.id, -1)}
                              className="px-2.5 py-1 text-xs text-[#555555] hover:bg-[#F5F5F5] transition-colors"
                              aria-label={`Decrease quantity of ${item.name}`}
                            >−</button>
                            <span
                              className="px-2.5 min-w-[28px] text-center text-xs font-mono font-medium text-[#111111] whitespace-nowrap overflow-visible"
                              aria-live="polite"
                              aria-atomic="true"
                            >{item.quantity}</span>
                            <button
                              onClick={() => updateQuantity(item.id, 1)}
                              className="px-2.5 py-1 text-xs text-[#555555] hover:bg-[#F5F5F5] transition-colors"
                              aria-label={`Increase quantity of ${item.name}`}
                            >+</button>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* ───────────────────────────────────────────────────────────── */}
          {/* FOOTER & CHECKOUT (Filled State)                              */}
          {/* ───────────────────────────────────────────────────────────── */}
          {cart.length > 0 && !isJustAddedMode && (
            <div className="px-6 py-5 border-t border-spec-border bg-white space-y-4">
              {/* Authenticated Client Status */}
              {isLoggedIn && user && (
                <div className="text-[11px] text-[#555555] bg-[#FAFAFA] border border-spec-border px-3 py-2 flex items-center justify-between">
                  <span className="truncate">
                    Client: <strong className="text-black font-medium">{user.name}</strong>
                  </span>
                  <span className="text-[9px] tracking-wider text-black uppercase font-semibold bg-[#EEEEEE] px-1.5 py-0.5 font-mono">
                    Verified
                  </span>
                </div>
              )}

              <div className="flex justify-between items-center text-xs tracking-spec uppercase font-bold text-[#2D2D2D]">
                <span>Estimated Total</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              <p className="text-[11px] text-[#8E8E8E] font-spec leading-relaxed">
                Taxes and shipping calculated at checkout.
              </p>
              <button
                type="button"
                onClick={handleProceedToCheckout}
                className="w-full bg-[#4D4D4D] hover:bg-black text-white text-xs font-spec font-bold uppercase tracking-spec py-4 px-6 transition-colors flex items-center justify-center gap-2 rounded-none btn-fill-hover shadow-sm"
              >
                Check out — ${subtotal.toFixed(2)}
              </button>
              <div className="text-center">
                <Link
                  to="/shop"
                  onClick={() => setIsCartOpen(false)}
                  className="text-[11px] text-spec-muted hover:text-black uppercase tracking-wider underline underline-offset-4"
                >
                  Continue Shopping
                </Link>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
