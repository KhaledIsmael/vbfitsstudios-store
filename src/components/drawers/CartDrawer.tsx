import React, { useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { BRAND_CONFIG } from '../../config/assets';
import { CartDrawerSkeleton } from '../ui/SkeletonCard';

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

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cart-drawer-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
        onClick={() => setIsCartOpen(false)}
        aria-hidden="true"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div ref={panelRef} className="w-screen max-w-md bg-white shadow-2xl flex flex-col transform transition-transform duration-500 ease-in-out">
          
          {/* Header */}
          <div className="px-6 py-5 border-b border-[#EAEAEA] flex items-center justify-between">
            <h2 id="cart-drawer-title" className="text-xs uppercase tracking-widest font-semibold text-[#111111] flex items-center gap-2">
              <span>Shopping Bag</span>
              {isCartLoading ? (
                <span className="w-2.5 h-2.5 border-2 border-black/20 border-t-black rounded-full animate-spin" aria-label="Loading" />
              ) : (
                <span aria-label={`${totalItems} items`}>({totalItems})</span>
              )}
            </h2>
            <button
              onClick={() => setIsCartOpen(false)}
              className="p-2 text-[#111111] hover:opacity-60 transition-opacity rounded"
              aria-label="Close shopping bag"
            >
              <img src={BRAND_CONFIG.icons.close} alt="" aria-hidden="true" className="w-4 h-4" width={16} height={16} />
            </button>
          </div>

          {/* Cart Content */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {isCartLoading ? (
              /* ── SKELETON: Supabase cart sync or initial load in flight ── */
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
              <div className="h-full flex flex-col items-center justify-center text-center space-y-4 py-16">
                <div className="w-12 h-12 rounded-full border border-black/15 flex items-center justify-center bg-[#FAFAFA] text-[#111111]">
                  <svg className="w-5 h-5 text-[#333333]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                  </svg>
                </div>
                <span className="text-[10px] uppercase tracking-luxury text-[#888888] font-mono">
                  Archive Bag · 0 Items
                </span>
                <p className="text-xs text-[#222222] tracking-wider uppercase font-light">Your shopping bag is empty</p>
                <button
                  onClick={() => setIsCartOpen(false)}
                  className="text-xs uppercase tracking-luxury text-[#111111] underline underline-offset-4 hover:opacity-60 transition-opacity pt-1"
                >
                  Explore Ready-to-Wear
                </button>
              </div>
            ) : (
              <ul className="divide-y divide-[#EAEAEA]" aria-label="Items in your bag">
                {cart.map((item) => (<li key={item.id} className="py-5 flex gap-4">
                    {/* Item Image — decorative, name already in h3 */}
                    <div className="w-20 h-24 bg-[#FAFAFA] flex-shrink-0 overflow-hidden" aria-hidden="true">
                      <img
                        src={item.image}
                        alt=""
                        className="w-full h-full object-cover"
                        loading="lazy"
                        decoding="async"
                        width={80}
                        height={96}
                      />
                    </div>

                    {/* Item Details */}
                    <div className="flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start gap-2">
                          <h3 className="text-xs font-medium text-[#111111] leading-snug">{item.name}</h3>
                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="text-[11px] text-[#999999] hover:text-black transition-colors underline"
                            aria-label={`Remove ${item.name} from bag`}
                          >
                            Remove
                          </button>
                        </div>
                        <p className="text-[11px] text-[#777777] mt-1">Size: {item.size}</p>
                        <p className="text-xs font-medium text-[#111111] mt-1">{item.currency}{item.price.toFixed(2)}</p>
                      </div>

                      {/* Quantity Selector */}
                      <div className="flex items-center gap-3 pt-2">
                        <div
                          className="flex items-center border border-[#EAEAEA]"
                          role="group"
                          aria-label={`Quantity for ${item.name}`}
                        >
                          <button
                            onClick={() => updateQuantity(item.id, -1)}
                            className="px-2.5 py-1 text-xs text-[#555555] hover:bg-[#F5F5F5] transition-colors"
                            aria-label={`Decrease quantity of ${item.name}`}
                          >−</button>
                          <span
                            className="px-3 text-xs font-medium text-[#111111]"
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
            )}
          </div>

          {/* Footer & Checkout */}
          {cart.length > 0 && (
            <div className="px-6 py-5 border-t border-[#EAEAEA] bg-white space-y-4">
              {/* Authenticated Client Status */}
              {isLoggedIn && user && (
                <div className="text-[11px] text-[#555555] bg-[#FAFAFA] border border-[#EAEAEA] px-3 py-2 flex items-center justify-between">
                  <span className="truncate">
                    Client: <strong className="text-black font-medium">{user.name}</strong>
                  </span>
                  <span className="text-[9px] tracking-wider text-black uppercase font-semibold bg-[#EEEEEE] px-1.5 py-0.5">
                    Verified
                  </span>
                </div>
              )}

              <div className="flex justify-between items-center text-xs tracking-wider uppercase font-semibold text-[#111111]">
                <span>Estimated Total</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              <p className="text-[11px] text-[#777777]">
                Taxes and shipping calculated at checkout. Complimentary luxury packaging included.
              </p>
              <button
                type="button"
                onClick={handleProceedToCheckout}
                className="w-full bg-[#111111] hover:bg-black text-white text-xs uppercase tracking-luxury py-4 px-6 font-medium transition-colors flex items-center justify-center gap-2"
              >
                Proceed to Checkout — ${subtotal.toFixed(2)}
              </button>
              <div className="text-center">
                <Link
                  to="/shop"
                  onClick={() => setIsCartOpen(false)}
                  className="text-[11px] text-[#666666] hover:text-black uppercase tracking-wider underline underline-offset-4"
                >
                  View All Products
                </Link>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
