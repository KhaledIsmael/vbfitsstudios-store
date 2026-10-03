import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getOrderById, type OrderDetail } from '../lib/orders';
import { isWithinReturnWindow, hasExistingReturnRequest, RETURN_WINDOW_DAYS, createReturnRequest, RETURN_REASONS, type ReturnReason, REFUND_METHODS, type RefundMethod } from '../lib/returns';
import { Smartphone, AtSign, Landmark, CreditCard } from 'lucide-react';

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
  const [hasReturn, setHasReturn] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Return modal state
  const [returnReason, setReturnReason] = useState<ReturnReason>('wrong_size');
  const [returnNote, setReturnNote] = useState('');
  const [returnSelectedItems, setReturnSelectedItems] = useState<Set<string>>(new Set());
  const [returnSubmitting, setReturnSubmitting] = useState(false);
  const [returnError, setReturnError] = useState<string | null>(null);
  const [returnSuccess, setReturnSuccess] = useState(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);

  // Refund details
  const [refundMethod, setRefundMethod] = useState<RefundMethod>('vodafone_cash');
  const [refundAccountDetails, setRefundAccountDetails] = useState('');

  const openReturnModal = (type: ReturnReason = 'wrong_size') => {
    setReturnReason(type);
    setReturnNote('');
    setRefundMethod('vodafone_cash');
    setRefundAccountDetails('');
    setReturnSelectedItems(new Set(order?.items.map((i) => i.id) || []));
    setReturnError(null);
    setReturnSuccess(false);
    setIsReturnModalOpen(true);
  };

  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;
    if (returnSelectedItems.size === 0) {
      setReturnError('Please select at least one item to return.');
      return;
    }
    if (refundMethod !== 'original_payment_method' && !refundAccountDetails.trim()) {
      setReturnError('Please provide refund account details.');
      return;
    }

    setReturnSubmitting(true);
    setReturnError(null);

    const itemsToReturn = order.items
      .filter((i) => returnSelectedItems.has(i.id))
      .map((i) => ({
        order_item_id: i.id,
        name: i.name,
        size: i.size,
        quantity_to_return: i.quantity
      }));

    // Customer ID might be null for guest orders, so we omit or pass null
    const { error } = await createReturnRequest({
      customerId: null, // guest orders do not have an active user ID here
      orderId: order.rawId,
      reason: returnReason,
      reasonNote: returnNote,
      refundMethod,
      refundAccountDetails: refundMethod !== 'original_payment_method' ? { details: refundAccountDetails.trim() } : undefined,
      items: itemsToReturn
    });

    setReturnSubmitting(false);

    if (error) {
      setReturnError(error);
    } else {
      setReturnSuccess(true);
      setHasReturn(true);
    }
  };

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
        // Check if a return request already exists for this order
        if (o.status.toLowerCase() === 'delivered') {
          hasExistingReturnRequest(o.rawId).then(setHasReturn);
        }
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
        <div className="flex flex-col sm:flex-row gap-4 pt-2 flex-wrap">
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

          {/* Request Return — within the return window */}
          {isWithinReturnWindow(order.deliveredAt, order.createdAt) &&
            !hasReturn && (
              <>
                <button
                  type="button"
                  onClick={() => openReturnModal('wrong_size')}
                  className="border border-black bg-black hover:bg-[#222] text-white text-xs uppercase tracking-luxury py-4 px-8 font-medium transition-all text-center"
                >
                  Request Return
                </button>
                <button
                  type="button"
                  onClick={() => openReturnModal('exchange_requested')}
                  className="border border-[#EAEAEA] hover:border-black text-black text-xs uppercase tracking-luxury py-4 px-8 font-medium transition-all text-center"
                >
                  Request Exchange
                </button>
              </>
            )}

          {/* Already submitted return */}
          {hasReturn && (
            <span className="border border-[#EAEAEA] text-[#888888] text-[10px] uppercase tracking-luxury py-4 px-6 font-medium text-center flex items-center justify-center">
              Return Request Submitted
            </span>
          )}
        </div>

      </div>

      {/* Return Request Modal */}
      {isReturnModalOpen && order && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
          onClick={(e) => { if (e.target === e.currentTarget) setIsReturnModalOpen(false); }}
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

          <div className="relative z-10 bg-white border border-[#EAEAEA] w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between px-6 py-5 border-b border-[#EAEAEA]">
              <div>
                <span className="text-[9px] uppercase tracking-luxury text-[#888888] block mb-0.5">
                  Order {order.id}
                </span>
                <h2 className="text-sm font-light uppercase tracking-wider text-black">
                  Request a Return / Exchange
                </h2>
              </div>
              <button
                onClick={() => setIsReturnModalOpen(false)}
                className="w-8 h-8 flex items-center justify-center hover:bg-[#F5F5F5] transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            {returnSuccess ? (
              <div className="p-8 text-center space-y-4">
                <div className="w-12 h-12 border border-black rounded-full flex items-center justify-center mx-auto">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
                <p className="text-[10px] uppercase tracking-luxury text-[#888888]">Return Submitted</p>
                <h3 className="text-lg font-light uppercase tracking-wider text-black">
                  Request Received
                </h3>
                <p className="text-xs text-[#666666] max-w-xs mx-auto leading-relaxed">
                  Our team will review your request within 1–2 business days and contact you with next steps.
                </p>
                <button
                  onClick={() => setIsReturnModalOpen(false)}
                  className="mt-2 bg-[#111111] text-white text-xs uppercase tracking-luxury py-3.5 px-8 font-medium hover:opacity-80 transition-opacity"
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleReturnSubmit} className="p-6 space-y-6">
                <div className="bg-[#FAFAFA] border border-[#EAEAEA] p-4 text-[10px] text-[#777777] uppercase tracking-wider">
                  Returns accepted within {RETURN_WINDOW_DAYS} days of delivery · Items must be unworn with tags attached
                </div>

                <div className="space-y-2">
                  <label className="block text-[11px] uppercase tracking-widest text-[#555555] font-medium">
                    Select Items
                  </label>
                  <div className="divide-y divide-[#EAEAEA] border border-[#EAEAEA]">
                    {order.items.map((item) => (
                      <label key={item.id} className="flex items-center gap-4 p-3 cursor-pointer hover:bg-[#FAFAFA] transition-colors">
                        <input
                          type="checkbox"
                          checked={returnSelectedItems.has(item.id)}
                          onChange={(e) => {
                            const next = new Set(returnSelectedItems);
                            if (e.target.checked) next.add(item.id);
                            else next.delete(item.id);
                            setReturnSelectedItems(next);
                          }}
                          className="w-4 h-4 border-[#CCCCCC] rounded-none accent-black"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-semibold text-black uppercase tracking-wider truncate">{item.name}</p>
                          <p className="text-[10px] text-[#777777]">Size: {item.size} · Qty: {item.quantity}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-[11px] uppercase tracking-widest text-[#555555] font-medium">
                    Reason
                  </label>
                  <select
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value as ReturnReason)}
                    className="w-full bg-[#FAFAFA] border border-[#EAEAEA] px-4 py-3 text-xs text-black focus:outline-none focus:border-black transition-colors rounded-none appearance-none"
                  >
                    {RETURN_REASONS.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2 pt-2">
                  <label className="block text-[11px] uppercase tracking-widest text-[#555555] font-medium">
                    Select Payout Method
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {REFUND_METHODS.map((m) => (
                      <button
                        key={m.value}
                        type="button"
                        onClick={() => {
                          setRefundMethod(m.value as RefundMethod);
                          setRefundAccountDetails('');
                        }}
                        className={`flex flex-col items-center justify-center p-4 border transition-all ${
                          refundMethod === m.value
                            ? 'border-black bg-black text-white'
                            : 'border-[#EAEAEA] bg-[#FAFAFA] text-black hover:border-gray-400'
                        }`}
                      >
                        {m.value === 'vodafone_cash' && <Smartphone className="w-5 h-5 mb-2 opacity-80" />}
                        {m.value === 'instapay' && <AtSign className="w-5 h-5 mb-2 opacity-80" />}
                        {m.value === 'bank_transfer' && <Landmark className="w-5 h-5 mb-2 opacity-80" />}
                        {m.value === 'original_payment_method' && <CreditCard className="w-5 h-5 mb-2 opacity-80" />}
                        <span className="text-[10px] font-bold uppercase tracking-wider text-center leading-tight">
                          {m.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {refundMethod !== 'original_payment_method' && (
                  <div className="space-y-2">
                    <label className="block text-[11px] uppercase tracking-widest text-[#555555] font-medium">
                      {refundMethod === 'vodafone_cash' ? 'Wallet Mobile Number' : refundMethod === 'instapay' ? 'Instapay IPA or Number' : 'IBAN / Bank Account'}
                    </label>
                    <input
                      type="text"
                      value={refundAccountDetails}
                      onChange={(e) => setRefundAccountDetails(e.target.value)}
                      placeholder={refundMethod === 'vodafone_cash' ? 'e.g., 01012345678' : refundMethod === 'instapay' ? 'e.g., username@instapay' : 'e.g., EG123456789...'}
                      required
                      className="w-full bg-[#FAFAFA] border border-[#EAEAEA] px-4 py-3 text-xs text-black focus:outline-none focus:border-black transition-colors rounded-none"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <label className="block text-[11px] uppercase tracking-widest text-[#555555] font-medium">
                    Additional Notes <span className="text-[#AAAAAA] normal-case tracking-normal">(optional)</span>
                  </label>
                  <textarea
                    value={returnNote}
                    onChange={(e) => setReturnNote(e.target.value)}
                    rows={3}
                    placeholder="Describe the issue in more detail…"
                    className="w-full bg-[#FAFAFA] border border-[#EAEAEA] px-4 py-3 text-xs text-black focus:outline-none focus:border-black transition-colors rounded-none resize-none"
                  />
                </div>

                {/* Live Refund Summary Card */}
                <div className="bg-[#F9F9F9] border border-[#EAEAEA] p-5 space-y-3 mt-4">
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-[#888888]">Refund Summary</h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between items-center text-[#555555]">
                      <span>Items Selected ({returnSelectedItems.size})</span>
                      <span>
                        EGP {Array.from(returnSelectedItems).reduce((sum, itemId) => {
                          const item = order?.items.find((i) => i.id === itemId);
                          return sum + (item ? item.price * item.quantity : 0);
                        }, 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[#555555]">
                      <span>Return Shipping Fee</span>
                      <span className="text-red-500">- EGP 0.00</span>
                    </div>
                    <div className="border-t border-[#EAEAEA] my-2 pt-2 flex justify-between items-center font-bold text-black text-sm">
                      <span>Total Estimated Refund</span>
                      <span>
                        EGP {Array.from(returnSelectedItems).reduce((sum, itemId) => {
                          const item = order?.items.find((i) => i.id === itemId);
                          return sum + (item ? item.price * item.quantity : 0);
                        }, 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                {returnError && (
                  <p className="text-xs text-red-500 uppercase tracking-wider">{returnError}</p>
                )}

                <div className="flex gap-3 pt-1">
                  <button
                    type="submit"
                    disabled={returnSubmitting || returnSelectedItems.size === 0}
                    className="flex-1 bg-[#111111] hover:bg-black text-white text-xs uppercase tracking-luxury py-4 font-medium transition-all disabled:opacity-40"
                  >
                    {returnSubmitting ? 'Submitting…' : 'Submit Request'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsReturnModalOpen(false)}
                    disabled={returnSubmitting}
                    className="border border-[#EAEAEA] hover:border-black text-black text-xs uppercase tracking-luxury py-4 px-6 font-medium transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
