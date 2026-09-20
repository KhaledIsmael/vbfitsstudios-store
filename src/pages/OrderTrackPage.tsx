import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getOrderById, type OrderDetail } from '../lib/orders';

// ─── Pipeline Stages ──────────────────────────────────────────────────────────
// Maps from DB status values (lower-cased) to their visual stage index (0-based)
const STAGES = [
  {
    key: 'placed',
    label: 'Order Placed',
    sublabel: 'Registered in our registry',
    icon: (active: boolean) => (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
        fill="none" stroke={active ? '#FFFFFF' : '#AAAAAA'} strokeWidth="1.8">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    )
  },
  {
    key: 'confirmed',
    label: 'Confirmed',
    sublabel: 'Order verified by our team',
    icon: (active: boolean) => (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
        fill="none" stroke={active ? '#FFFFFF' : '#AAAAAA'} strokeWidth="1.8">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    )
  },
  {
    key: 'packed',
    label: 'Packed',
    sublabel: 'Garments prepared for dispatch',
    icon: (active: boolean) => (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
        fill="none" stroke={active ? '#FFFFFF' : '#AAAAAA'} strokeWidth="1.8">
        <line x1="16.5" y1="9.4" x2="7.5" y2="4.21" />
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" y1="22.08" x2="12" y2="12" />
      </svg>
    )
  },
  {
    key: 'shipped',
    label: 'Shipped',
    sublabel: 'En route to courier hub',
    icon: (active: boolean) => (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
        fill="none" stroke={active ? '#FFFFFF' : '#AAAAAA'} strokeWidth="1.8">
        <rect x="1" y="3" width="15" height="13" />
        <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
        <circle cx="5.5" cy="18.5" r="2.5" />
        <circle cx="18.5" cy="18.5" r="2.5" />
      </svg>
    )
  },
  {
    key: 'out_for_delivery',
    label: 'Out for Delivery',
    sublabel: 'Courier heading to you',
    icon: (active: boolean) => (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
        fill="none" stroke={active ? '#FFFFFF' : '#AAAAAA'} strokeWidth="1.8">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    )
  },
  {
    key: 'delivered',
    label: 'Delivered',
    sublabel: 'Successfully received',
    icon: (active: boolean) => (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
        fill="none" stroke={active ? '#FFFFFF' : '#AAAAAA'} strokeWidth="1.8">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    )
  }
] as const;

type StageKey = typeof STAGES[number]['key'];

// Status → stage index mapping (handles aliases)
const STATUS_TO_STAGE: Record<string, number> = {
  placed:           0,
  pending:          0,
  confirmed:        1,
  processing:       1,
  packed:           2,
  shipped:          3,
  in_transit:       3,
  out_for_delivery: 4,
  delivered:        5,
  cancelled:        -1,
  refunded:         -1
};

function getCurrentStageIndex(status: string): number {
  return STATUS_TO_STAGE[status.toLowerCase()] ?? 0;
}

type PagePhase = 'loading' | 'loaded' | 'error';

export const OrderTrackPage: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const [phase, setPhase] = useState<PagePhase>('loading');
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) {
      setFetchError('No order ID provided.');
      setPhase('error');
      return;
    }
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

  // ─── Loading ──────────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-10 h-10 border-2 border-black border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-[10px] uppercase tracking-luxury text-[#888888]">Loading Order…</p>
        </div>
      </div>
    );
  }

  // ─── Error ────────────────────────────────────────────────────────
  if (phase === 'error' || !order) {
    return (
      <div className="pt-36 min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center gap-6">
        <p className="text-xs text-[#666666]">{fetchError || 'Order not found.'}</p>
        <Link to="/profile" className="bg-[#111111] text-white text-xs uppercase tracking-luxury py-3.5 px-8 font-medium">
          My Orders
        </Link>
      </div>
    );
  }

  const currentStageIndex = getCurrentStageIndex(order.status);
  const isCancelled = ['cancelled', 'refunded'].includes(order.status.toLowerCase());
  const isCOD = order.paymentMethod === 'COD' || order.paymentMethod === 'Cash on Delivery';

  return (
    <div className="pt-24 sm:pt-32 pb-24 min-h-screen bg-white text-[#111111]">
      <div className="max-w-3xl mx-auto px-6 sm:px-8 space-y-12 animate-fade-in">

        {/* ── Breadcrumb ─────────────────────────────────────── */}
        <div className="text-[11px] text-[#888888] uppercase tracking-luxury flex items-center gap-2">
          <Link to="/profile" className="hover:text-black transition-colors">Profile</Link>
          <span>/</span>
          <Link to="/profile" className="hover:text-black transition-colors">Orders</Link>
          <span>/</span>
          <span className="text-black">{order.orderNumber}</span>
        </div>

        {/* ── Page Header ────────────────────────────────────── */}
        <div className="space-y-1">
          <span className="text-[10px] uppercase tracking-luxury text-[#888888]">
            Shipment Tracking
          </span>
          <h1 className="text-2xl sm:text-3xl font-light uppercase tracking-wider text-black">
            {order.orderNumber}
          </h1>
          <p className="text-xs text-[#666666]">
            Placed on {new Date(order.createdAt).toLocaleDateString('en-US', {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
            })}
          </p>
        </div>

        {/* ── Cancelled Banner ───────────────────────────────── */}
        {isCancelled && (
          <div className="border border-[#EAEAEA] p-5 bg-[#FAFAFA] flex items-start gap-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
              fill="none" stroke="#888888" strokeWidth="1.5" className="mt-0.5 flex-shrink-0">
              <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-black">
                Order {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
              </p>
              <p className="text-xs text-[#666666] mt-1">
                This order has been {order.status.toLowerCase()}. Please contact us if you have questions.
              </p>
            </div>
          </div>
        )}

        {/* ── Horizontal Timeline ────────────────────────────── */}
        {!isCancelled && (
          <div className="space-y-6">
            <h2 className="text-[10px] uppercase tracking-luxury text-[#888888] border-b border-[#EAEAEA] pb-2">
              Dispatch Pipeline
            </h2>

            {/* Stage nodes — horizontal on md+, vertical stack on mobile */}
            <div className="relative">
              {/* Connector line (desktop only) */}
              <div className="hidden md:block absolute top-[28px] left-[36px] right-[36px] h-px bg-[#EAEAEA] z-0" />
              {/* Progress fill */}
              {currentStageIndex > 0 && (
                <div
                  className="hidden md:block absolute top-[28px] h-px bg-black z-0 transition-all duration-700"
                  style={{
                    left: '36px',
                    // Progress: fraction of stages completed
                    width: `calc(${(currentStageIndex / (STAGES.length - 1)) * 100}% - 72px)`
                  }}
                />
              )}

              {/* Stages grid */}
              <div className="grid grid-cols-1 md:grid-cols-6 gap-4 md:gap-0">
                {STAGES.map((stage, idx) => {
                  const isCompleted = idx < currentStageIndex;
                  const isCurrent = idx === currentStageIndex;
                  const isFuture = idx > currentStageIndex;

                  return (
                    <div
                      key={stage.key}
                      className="flex md:flex-col items-center md:items-center gap-4 md:gap-3 relative z-10"
                    >
                      {/* Mobile connector line */}
                      {idx > 0 && (
                        <div className={`md:hidden absolute left-[27px] -top-4 w-px h-4 ${idx <= currentStageIndex ? 'bg-black' : 'bg-[#EAEAEA]'}`} />
                      )}

                      {/* Circle badge */}
                      <div
                        className={`
                          w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 border-2 transition-all duration-300
                          ${isCompleted
                            ? 'bg-black border-black shadow-lg'
                            : isCurrent
                              ? 'bg-black border-black shadow-xl ring-4 ring-black/10'
                              : 'bg-white border-[#EAEAEA]'
                          }
                        `}
                      >
                        {stage.icon(isCompleted || isCurrent)}
                      </div>

                      {/* Label */}
                      <div className="md:text-center md:mt-1 flex-1 md:flex-none">
                        <p className={`text-[11px] font-semibold uppercase tracking-wider leading-tight ${
                          isCurrent ? 'text-black' : isFuture ? 'text-[#BBBBBB]' : 'text-black'
                        }`}>
                          {stage.label}
                        </p>
                        <p className={`text-[10px] leading-relaxed mt-0.5 ${
                          isCurrent ? 'text-[#555555]' : 'text-[#AAAAAA]'
                        }`}>
                          {stage.sublabel}
                        </p>
                        {isCurrent && (
                          <span className="inline-block mt-1 text-[9px] uppercase tracking-widest bg-black text-white px-2 py-0.5">
                            Current
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── Order Summary Strip ─────────────────────────────── */}
        <div className="border border-[#EAEAEA] divide-y divide-[#EAEAEA]">
          <div className="flex justify-between items-center px-5 py-3.5 text-xs">
            <span className="text-[#888888] uppercase tracking-wider">Tracking ID</span>
            <span className="font-mono text-black">{order.trackingNumber || '—'}</span>
          </div>
          <div className="flex justify-between items-center px-5 py-3.5 text-xs">
            <span className="text-[#888888] uppercase tracking-wider">Payment</span>
            <span className="font-medium text-black uppercase tracking-wider">
              {isCOD ? 'Cash on Delivery' : 'Paid Online'}
            </span>
          </div>
          <div className="flex justify-between items-center px-5 py-3.5 text-xs">
            <span className="text-[#888888] uppercase tracking-wider">Total Value</span>
            <span className="font-semibold text-black">{order.total.toFixed(2)} {order.currency}</span>
          </div>
        </div>

        {/* ── Delivery Address ───────────────────────────────── */}
        {order.shippingAddress && (
          <div className="space-y-3">
            <h2 className="text-[10px] uppercase tracking-luxury text-[#888888] border-b border-[#EAEAEA] pb-2">
              Delivery Destination
            </h2>
            <div className="border border-[#EAEAEA] p-5 bg-[#FAFAFA] text-xs space-y-1">
              <p className="font-semibold text-black uppercase tracking-wider">
                {order.shippingAddress.name}
              </p>
              <p className="text-[#555555]">
                {order.shippingAddress.street}
                {order.shippingAddress.building ? `, Bldg ${order.shippingAddress.building}` : ''}
                {order.shippingAddress.floor ? `, Floor ${order.shippingAddress.floor}` : ''}
              </p>
              <p className="text-[#777777] uppercase tracking-wider text-[10px]">
                {order.shippingAddress.city}
                {order.shippingAddress.governorate ? `, ${order.shippingAddress.governorate}` : ''}
              </p>
              {order.shippingAddress.phone && (
                <p className="text-[#888888]">Tel: {order.shippingAddress.phone}</p>
              )}
            </div>
          </div>
        )}

        {/* ── Items in Order ─────────────────────────────────── */}
        {order.items.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-[10px] uppercase tracking-luxury text-[#888888] border-b border-[#EAEAEA] pb-2">
              Garments ({order.items.length})
            </h2>
            <div className="divide-y divide-[#EAEAEA] border border-[#EAEAEA]">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-center gap-4 p-4 bg-white">
                  <div className="w-14 h-18 bg-[#F5F5F5] border border-[#EAEAEA] flex-shrink-0 overflow-hidden">
                    <img src={item.image} alt={item.name}
                      className="w-full h-full object-contain p-1 mix-blend-multiply"
                      onError={(e) => { (e.target as HTMLImageElement).src = '/assets/products/black-shirt.jpeg'; }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xs font-semibold text-black uppercase tracking-wider truncate">{item.name}</h3>
                    <p className="text-[10px] text-[#777777] mt-0.5">Size: {item.size} · Qty: {item.quantity}</p>
                  </div>
                  <div className="text-xs font-medium text-black flex-shrink-0">
                    {(item.price * item.quantity).toFixed(2)} {order.currency}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Action CTAs ─────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row gap-4 pt-2">
          <Link
            to={`/order-confirmation/${orderId}`}
            className="border border-[#EAEAEA] hover:border-black text-black text-xs uppercase tracking-luxury py-4 px-8 font-medium transition-all text-center"
          >
            View Full Order Details
          </Link>
          <Link
            to="/profile"
            className="border border-[#EAEAEA] hover:border-black text-black text-xs uppercase tracking-luxury py-4 px-8 font-medium transition-all text-center"
          >
            Back to Profile
          </Link>
        </div>

      </div>
    </div>
  );
};
