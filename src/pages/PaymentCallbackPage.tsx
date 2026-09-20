import React, { useEffect, useState, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { getOrderPaymentStatus, convertOrderToCOD } from '../lib/orders';
import { useCart } from '../context/CartContext';

/**
 * PaymentCallbackPage
 *
 * Landing page after a Paymob payment attempt completes.
 * The Paymob hosted page redirects here (or the webhook redirects here).
 *
 * URL params:
 *   - order_number: VBF-XXXXX (required)
 *   - payment_status: 'paid' | 'failed' | 'pending' (from webhook redirect)
 *   - order_id: Supabase UUID (optional, for quick lookup)
 *   - txn_id: Paymob transaction ID (display only)
 *
 * Strategy:
 *   1. If payment_status is already in the URL (webhook set it), jump straight there.
 *   2. Otherwise poll Supabase every 2s (max 15 attempts / 30s) until status resolves.
 *   3. Redirect to /order-confirmation on success, or show error state on failure.
 */

type StatusPhase = 'loading' | 'paid' | 'failed' | 'timeout';

const MAX_POLLS = 15;
const POLL_INTERVAL_MS = 2000;

export const PaymentCallbackPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { clearCart } = useCart();

  const orderNumber = searchParams.get('order_number') || '';
  const urlStatus = searchParams.get('payment_status') || '';
  const txnId = searchParams.get('txn_id') || '';
  const orderId = searchParams.get('order_id') || '';

  const [phase, setPhase] = useState<StatusPhase>('loading');
  const [pollCount, setPollCount] = useState(0);
  const [isConvertingToCOD, setIsConvertingToCOD] = useState(false);
  const [convertError, setConvertError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Helper: navigate to confirmation (clears cart and uses deep-link if orderId available)
  const goToConfirmation = (ps: string) => {
    clearCart();
    const target = orderId
      ? `/order-confirmation/${orderId}`
      : '/order-confirmation';
    navigate(target, {
      replace: true,
      state: {
        orderNumber,
        paymentMethod: 'Pay Online',
        paymentStatus: ps,
        fromPaymob: true,
        txnId
      }
    });
  };

  // Convert failed online order to Cash on Delivery
  const handleConvertToCOD = async () => {
    const target = orderId || orderNumber;
    if (!target) return;

    setIsConvertingToCOD(true);
    setConvertError(null);

    const { order, error } = await convertOrderToCOD(target);
    setIsConvertingToCOD(false);

    if (error || !order) {
      setConvertError(error || 'Could not convert order to COD. Please try again.');
      return;
    }

    clearCart();
    navigate(`/order-confirmation/${order.id}`, {
      replace: true,
      state: {
        orderNumber: order.orderNumber,
        paymentMethod: 'COD',
        paymentStatus: 'pending_collection',
        fromConversion: true
      }
    });
  };

  useEffect(() => {
    // If the webhook already embedded the status in the URL → use it immediately
    if (urlStatus === 'paid') {
      goToConfirmation('paid');
      return;
    }
    if (urlStatus === 'failed') {
      setPhase('failed');
      return;
    }

    // Otherwise: start polling Supabase until the webhook updates the row
    if (!orderNumber) {
      setPhase('failed');
      return;
    }

    let count = 0;

    const poll = async () => {
      count += 1;
      setPollCount(count);

      const { paymentStatus } = await getOrderPaymentStatus(orderNumber);

      if (paymentStatus === 'paid') {
        if (pollRef.current) clearInterval(pollRef.current);
        goToConfirmation('paid');
        return;
      }

      if (paymentStatus === 'failed') {
        if (pollRef.current) clearInterval(pollRef.current);
        setPhase('failed');
        return;
      }

      if (count >= MAX_POLLS) {
        if (pollRef.current) clearInterval(pollRef.current);
        setPhase('timeout');
      }
    };

    // Run once immediately, then every POLL_INTERVAL_MS
    poll();
    pollRef.current = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderNumber, urlStatus]);

  // ─────────────────────────────────────────────────────────────────
  // RENDER: Loading / Polling State
  // ─────────────────────────────────────────────────────────────────
  if (phase === 'loading') {
    const progress = Math.min(100, Math.round((pollCount / MAX_POLLS) * 100));

    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center">
        {/* Animated logo mark */}
        <div className="w-16 h-16 border border-[#EAEAEA] rounded-full flex items-center justify-center mb-8 relative">
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-black animate-spin" />
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#111111"
            strokeWidth="1.5"
          >
            <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
            <line x1="1" y1="10" x2="23" y2="10" />
          </svg>
        </div>

        <span className="text-[10px] uppercase tracking-luxury text-[#888888] mb-2">
          Secure Payment Processing
        </span>
        <h1 className="text-xl sm:text-2xl font-light uppercase tracking-wider text-black mb-3">
          Verifying Your Payment
        </h1>
        <p className="text-xs text-[#666666] max-w-xs leading-relaxed mb-8">
          Please wait while we confirm your transaction with the payment gateway. Do not close this window.
        </p>

        {/* Progress bar */}
        <div className="w-48 h-px bg-[#EAEAEA] relative overflow-hidden">
          <div
            className="absolute left-0 top-0 h-full bg-black transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-[10px] text-[#AAAAAA] mt-3 uppercase tracking-widest">
          {orderNumber ? `Order ${orderNumber}` : 'Processing…'}
        </p>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // RENDER: Timeout State (took too long — webhook may still arrive)
  // ─────────────────────────────────────────────────────────────────
  if (phase === 'timeout') {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center">
        <div className="w-16 h-16 border border-[#EAEAEA] rounded-full flex items-center justify-center mb-8 text-[#888888]">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>

        <span className="text-[10px] uppercase tracking-luxury text-[#888888] mb-2">
          Extended Verification
        </span>
        <h1 className="text-xl sm:text-2xl font-light uppercase tracking-wider text-black mb-3">
          Still Processing
        </h1>
        <p className="text-xs text-[#666666] max-w-sm leading-relaxed mb-8">
          Your payment is taking longer than expected to verify. Your order{' '}
          <strong className="text-black">{orderNumber}</strong> has been registered. Check your
          Profile → Orders in a few minutes for the updated status.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            to="/profile"
            className="bg-[#111111] hover:bg-black text-white text-xs uppercase tracking-luxury py-4 px-8 font-medium transition-all"
          >
            View My Orders
          </Link>
          <Link
            to="/shop"
            className="border border-[#EAEAEA] hover:border-black text-black text-xs uppercase tracking-luxury py-4 px-8 font-medium transition-all"
          >
            Continue Shopping
          </Link>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // RENDER: Failed Payment State
  // ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center">
      <div className="w-16 h-16 border border-[#EAEAEA] rounded-full flex items-center justify-center mb-8 text-[#888888]">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="26"
          height="26"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </div>

      <span className="text-[10px] uppercase tracking-luxury text-[#888888] mb-2">
        Transaction Declined
      </span>
      <h1 className="text-xl sm:text-2xl font-light uppercase tracking-wider text-black mb-3">
        Payment Unsuccessful
      </h1>
      <p className="text-xs text-[#666666] max-w-sm leading-relaxed mb-4">
        Your payment could not be processed at this time. <strong className="text-black">Your shopping bag has been preserved.</strong>
      </p>

      {convertError && (
        <p className="text-xs text-red-600 mb-4 bg-red-50 border border-red-200 py-2 px-4 max-w-sm">
          {convertError}
        </p>
      )}

      {/* Suggested 1-Click Action for Egyptian Market */}
      <div className="border border-[#EAEAEA] p-5 max-w-md w-full mb-8 bg-[#FAFAFA] text-left space-y-3">
        <div className="flex items-center justify-between border-b border-[#EAEAEA] pb-2">
          <span className="text-[10px] uppercase tracking-luxury text-black font-semibold">
            Instant Resolution
          </span>
          <span className="text-[9px] bg-black text-white px-2 py-0.5 uppercase tracking-wider">
            Egyptian Market Choice
          </span>
        </div>
        <p className="text-[11px] text-[#555555] leading-relaxed">
          Switch this order to <strong className="text-black font-medium">Cash on Delivery</strong> now. Pay physically or by card with the private courier at your doorstep.
        </p>
        <button
          type="button"
          onClick={handleConvertToCOD}
          disabled={isConvertingToCOD}
          className="w-full bg-[#111111] hover:bg-black text-white text-xs uppercase tracking-luxury py-3.5 px-6 font-medium transition-all disabled:opacity-50"
        >
          {isConvertingToCOD ? 'Converting Order…' : 'Switch to Cash on Delivery (COD)'}
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <Link
          to="/checkout"
          className="border border-[#111111] text-black hover:bg-black hover:text-white text-xs uppercase tracking-luxury py-3.5 px-8 font-medium transition-all"
        >
          Return to Checkout to Retry
        </Link>
        <Link
          to="/shop"
          className="border border-[#EAEAEA] hover:border-black text-[#666666] hover:text-black text-xs uppercase tracking-luxury py-3.5 px-8 font-medium transition-all"
        >
          Continue Shopping
        </Link>
      </div>
    </div>
  );
};
