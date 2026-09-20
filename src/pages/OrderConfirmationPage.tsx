import React, { useEffect, useState } from 'react';
import { Link, useParams, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getOrderById, type OrderDetail } from '../lib/orders';

// ─── Delivery window helper ────────────────────────────────────────────────────
// Returns e.g. "Mon, Sep 22 – Wed, Sep 24"
function getDeliveryWindow(createdAt: string): string {
  const base = createdAt ? new Date(createdAt) : new Date();
  const minDays = 3;
  const maxDays = 6;
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const lo = new Date(base);
  lo.setDate(lo.getDate() + minDays);
  const hi = new Date(base);
  hi.setDate(hi.getDate() + maxDays);
  return `${fmt(lo)} – ${fmt(hi)}`;
}

// ─── Fallback from location.state (used when navigating directly after checkout)
interface LocationState {
  orderNumber?: string;
  trackingNumber?: string;
  email?: string;
  total?: number;
  paymentMethod?: string;
  paymentStatus?: string;
  address?: any;
  fromPaymob?: boolean;
  txnId?: string;
}

type PagePhase = 'loading' | 'loaded' | 'error';

export const OrderConfirmationPage: React.FC = () => {
  const { orderId } = useParams<{ orderId?: string }>();
  const location = useLocation();
  const { isLoggedIn } = useAuth();

  const stateData = (location.state as LocationState) || {};

  const [phase, setPhase] = useState<PagePhase>(orderId ? 'loading' : 'loaded');
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) return; // No UUID param → rely on location.state fallback

    setPhase('loading');
    getOrderById(orderId).then(({ order: o, error }) => {
      if (error || !o) {
        setFetchError(error || 'Order not found.');
        setPhase('error');
      } else {
        setOrder(o);
        setPhase('loaded');
      }
    });
  }, [orderId]);

  // ─── Derived display values ─────────────────────────────────────────────────
  const displayOrderNumber =
    order?.orderNumber || stateData.orderNumber || 'VBF-CONFIRMED';
  const displayTracking =
    order?.trackingNumber || stateData.trackingNumber || '—';
  const displayTotal =
    order != null ? order.total : (stateData.total ?? 0);
  const displayCurrency = order?.currency || 'USD';
  const displayPaymentMethod =
    order?.paymentMethod || stateData.paymentMethod || 'COD';
  const displayPaymentStatus =
    order?.paymentStatus || stateData.paymentStatus || 'pending_collection';
  const displayAddress = order?.shippingAddress || stateData.address || null;
  const displayItems = order?.items || [];
  const displayCreatedAt = order?.createdAt || new Date().toISOString();
  const displayDeliveryWindow = getDeliveryWindow(displayCreatedAt);

  const isCOD =
    displayPaymentMethod === 'COD' ||
    displayPaymentMethod === 'Cash on Delivery';
  const isPaid = displayPaymentStatus === 'paid';

  // ─── LOADING ────────────────────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-2 border-black border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-[10px] uppercase tracking-luxury text-[#888888]">
            Loading Order Details…
          </p>
        </div>
      </div>
    );
  }

  // ─── ERROR ──────────────────────────────────────────────────────────────────
  if (phase === 'error') {
    return (
      <div className="pt-36 pb-24 min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center">
        <div className="w-14 h-14 border border-[#EAEAEA] rounded-full flex items-center justify-center mb-6 text-[#888888]">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h1 className="text-xl font-light uppercase tracking-wider text-black mb-2">Order Not Found</h1>
        <p className="text-xs text-[#666666] max-w-xs leading-relaxed mb-8">{fetchError}</p>
        <div className="flex gap-4">
          {isLoggedIn && (
            <Link to="/profile" className="bg-[#111111] text-white text-xs uppercase tracking-luxury py-3.5 px-8 font-medium hover:opacity-80 transition-opacity">
              View My Orders
            </Link>
          )}
          <Link to="/shop" className="border border-[#EAEAEA] hover:border-black text-black text-xs uppercase tracking-luxury py-3.5 px-8 font-medium transition-all">
            Continue Shopping
          </Link>
        </div>
      </div>
    );
  }

  // ─── MAIN CONFIRMATION VIEW ─────────────────────────────────────────────────
  return (
    <div className="pt-24 sm:pt-32 pb-24 min-h-screen bg-white text-[#111111]">
      <div className="max-w-3xl mx-auto px-6 sm:px-8 space-y-10 animate-fade-in">

        {/* ── Header ─────────────────────────────────────────── */}
        <div className="text-center space-y-4">
          {/* Animated success ring */}
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full border border-black text-black mx-auto">
            <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div>
            <span className="block text-[10px] uppercase tracking-luxury text-[#888888] mb-1">
              Acquisition Confirmed
            </span>
            <h1 className="text-2xl sm:text-4xl font-light uppercase tracking-wider text-black">
              Order Placed Successfully
            </h1>
            <p className="text-xs text-[#666666] max-w-md mx-auto mt-3 leading-relaxed">
              Your garments have been logged into our private dispatch registry.
              A confirmation notice has been sent to your email address.
            </p>
          </div>
        </div>

        {/* ── Order Meta Card ─────────────────────────────────── */}
        <div className="border border-[#EAEAEA] divide-y divide-[#EAEAEA] bg-[#FAFAFA]">

          {/* Order Reference */}
          <div className="flex justify-between items-center px-6 py-4 text-xs">
            <span className="text-[#888888] uppercase tracking-wider">Order Reference</span>
            <span className="font-semibold text-black uppercase tracking-wider font-mono">
              {displayOrderNumber}
            </span>
          </div>

          {/* Tracking */}
          <div className="flex justify-between items-center px-6 py-4 text-xs">
            <span className="text-[#888888] uppercase tracking-wider">Discreet Tracking ID</span>
            <span className="font-mono text-black">{displayTracking || '—'}</span>
          </div>

          {/* Payment */}
          <div className="flex justify-between items-center px-6 py-4 text-xs">
            <span className="text-[#888888] uppercase tracking-wider">Settlement</span>
            <span className="font-semibold text-black uppercase tracking-wider flex items-center gap-2">
              <span>{isCOD ? 'Cash on Delivery' : 'Paid Online'}</span>
              {isCOD && (
                <span className="text-[9px] uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 font-medium">
                  Pending Collection
                </span>
              )}
              {isPaid && (
                <span className="text-[9px] uppercase tracking-wider bg-[#F0F9F0] text-[#166534] border border-[#BBF7D0] px-2 py-0.5 font-medium">
                  Paid
                </span>
              )}
            </span>
          </div>

          {/* Status */}
          <div className="flex justify-between items-center px-6 py-4 text-xs">
            <span className="text-[#888888] uppercase tracking-wider">Dispatch Status</span>
            <span className="text-black font-medium uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-black inline-block" />
              Placed
            </span>
          </div>

          {/* Estimated Delivery */}
          <div className="flex justify-between items-center px-6 py-4 text-xs">
            <span className="text-[#888888] uppercase tracking-wider">Estimated Delivery</span>
            <span className="text-black font-semibold">{displayDeliveryWindow}</span>
          </div>

          {/* Total */}
          <div className="flex justify-between items-center px-6 py-4">
            <span className="text-xs text-[#888888] uppercase tracking-wider">Total Value</span>
            <span className="text-sm font-semibold text-black">
              {displayTotal > 0 ? `${displayTotal.toFixed(2)} ${displayCurrency}` : '—'}
            </span>
          </div>
        </div>

        {/* ── Order Items Grid ─────────────────────────────────── */}
        {displayItems.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-[10px] uppercase tracking-luxury text-[#888888] border-b border-[#EAEAEA] pb-2">
              Garments in This Acquisition
            </h2>
            <div className="divide-y divide-[#EAEAEA] border border-[#EAEAEA]">
              {displayItems.map((item) => (
                <div key={item.id} className="flex items-center gap-4 p-4 bg-white">
                  {/* Thumbnail */}
                  <div className="w-16 h-20 bg-[#F5F5F5] border border-[#EAEAEA] flex-shrink-0 overflow-hidden">
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-full h-full object-contain p-1 mix-blend-multiply"
                      loading="lazy"
                      decoding="async"
                      width={64}
                      height={80}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/assets/products/black-shirt.jpeg';
                      }}
                    />
                  </div>
                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xs font-semibold text-black uppercase tracking-wider truncate">
                      {item.name}
                    </h3>
                    <p className="text-[10px] text-[#777777] mt-0.5">
                      Size: {item.size} &nbsp;·&nbsp; Qty: {item.quantity}
                    </p>
                  </div>
                  {/* Line price */}
                  <div className="text-xs font-medium text-black flex-shrink-0">
                    {(item.price * item.quantity).toFixed(2)} {displayCurrency}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Delivery Address ─────────────────────────────────── */}
        {displayAddress && (
          <div className="space-y-3">
            <h2 className="text-[10px] uppercase tracking-luxury text-[#888888] border-b border-[#EAEAEA] pb-2">
              Destination Coordinates
            </h2>
            <div className="border border-[#EAEAEA] p-5 bg-[#FAFAFA] text-xs space-y-1">
              <p className="font-semibold text-black uppercase tracking-wider">
                {displayAddress.name}
                {displayAddress.phone && (
                  <span className="font-normal text-[#666666] normal-case tracking-normal ml-2">
                    · {displayAddress.phone}
                  </span>
                )}
              </p>
              <p className="text-[#555555]">
                {displayAddress.street}
                {displayAddress.building ? `, Bldg ${displayAddress.building}` : ''}
                {displayAddress.floor ? `, Floor ${displayAddress.floor}` : ''}
              </p>
              <p className="text-[#777777] uppercase tracking-wider text-[10px]">
                {displayAddress.city}
                {displayAddress.governorate && displayAddress.governorate !== displayAddress.city
                  ? `, ${displayAddress.governorate}`
                  : ''}
                {displayAddress.country ? ` · ${displayAddress.country}` : ''}
              </p>
              {displayAddress.landmark && (
                <p className="text-[#999999] text-[10px] italic">{displayAddress.landmark}</p>
              )}
            </div>
          </div>
        )}

        {/* ── COD Notice ──────────────────────────────────────── */}
        {isCOD && (
          <div className="border border-[#EAEAEA] p-5 bg-white flex gap-4">
            <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#555555" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <div className="text-xs text-[#555555] space-y-1">
              <p className="font-semibold text-black text-[11px] uppercase tracking-wider">
                Cash on Delivery Guidelines
              </p>
              <p className="leading-relaxed">
                Please have the exact total{' '}
                <strong className="text-black">{displayTotal.toFixed(2)} {displayCurrency}</strong>{' '}
                ready in cash or via POS card machine when the private courier contacts you prior to arrival.
              </p>
            </div>
          </div>
        )}

        {/* ── Delivery Promise Strip ───────────────────────────── */}
        <div className="border border-[#EAEAEA] divide-y divide-[#EAEAEA]">
          {[
            { icon: '✦', label: 'Archival luxury box & garment bag included' },
            { icon: '✦', label: 'Discreet express courier transit with live tracking' },
            { icon: '✦', label: '14-day returns & complimentary sizing exchange' }
          ].map(({ icon, label }) => (
            <div key={label} className="flex items-center gap-3 px-5 py-3 text-[10px] text-[#777777] uppercase tracking-wider">
              <span className="text-black">{icon}</span>
              <span>{label}</span>
            </div>
          ))}
        </div>

        {/* ── Action CTAs ──────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-2">
          {isLoggedIn ? (
            <Link
              to="/profile"
              className="bg-[#111111] hover:bg-black text-white text-xs uppercase tracking-luxury py-4 px-10 font-medium transition-all text-center"
            >
              View Order in Profile
            </Link>
          ) : (
            <Link
              to="/register"
              className="bg-[#111111] hover:bg-black text-white text-xs uppercase tracking-luxury py-4 px-10 font-medium transition-all text-center"
            >
              Create Account to Track
            </Link>
          )}
          <Link
            to="/shop"
            className="border border-[#EAEAEA] hover:border-black text-black text-xs uppercase tracking-luxury py-4 px-10 font-medium transition-all text-center"
          >
            Continue Exploring
          </Link>
        </div>

      </div>
    </div>
  );
};
