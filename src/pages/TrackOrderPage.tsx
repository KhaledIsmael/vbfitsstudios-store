import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { lookupOrderForGuest } from '../lib/orders';

export const TrackOrderPage: React.FC = () => {
  const navigate = useNavigate();
  const [orderNumber, setOrderNumber] = useState('');
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!orderNumber.trim()) {
      setErrorMessage('Please enter your order reference (e.g. VBF-12345).');
      return;
    }
    if (!emailOrPhone.trim()) {
      setErrorMessage('Please enter the email address or phone number used during checkout.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await lookupOrderForGuest(orderNumber, emailOrPhone);
      setIsLoading(false);

      if (result.error || !result.orderId) {
        setErrorMessage(
          result.error ||
            'We could not locate an order matching these credentials. Please check your order reference and contact details.'
        );
        return;
      }

      // Navigate to the visual tracking timeline page
      navigate(`/orders/${result.orderId}/track`);
    } catch (err: any) {
      setIsLoading(false);
      setErrorMessage(err?.message || 'An unexpected error occurred. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-white pt-24 pb-20 px-4 sm:px-6">
      <div className="max-w-xl mx-auto">
        {/* Breadcrumb */}
        <div className="mb-8 text-[10px] uppercase tracking-luxury text-[#888888] flex items-center gap-2">
          <Link to="/" className="hover:text-black transition-colors">
            Home
          </Link>
          <span>/</span>
          <span className="text-black">Order Tracking</span>
        </div>

        {/* Header */}
        <div className="border-b border-[#EAEAEA] pb-6 mb-8 text-center sm:text-left">
          <span className="text-[10px] uppercase tracking-luxury text-[#888888] block mb-2">
            Private Client Registry
          </span>
          <h1 className="text-2xl sm:text-3xl font-light uppercase tracking-wider text-[#111111] mb-3">
            Track Dispatch Status
          </h1>
          <p className="text-xs text-[#666666] leading-relaxed max-w-md">
            Guest acquisitions and registered orders may be tracked below. Enter your order reference
            alongside the contact details provided at checkout to verify credentials.
          </p>
        </div>

        {/* Lookup Form */}
        <form onSubmit={handleSubmit} className="border border-[#EAEAEA] p-6 sm:p-8 bg-[#FAFAFA] space-y-6">
          {errorMessage && (
            <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs leading-relaxed animate-fade-in">
              {errorMessage}
            </div>
          )}

          <div>
            <label className="block text-[10px] uppercase tracking-widest text-[#555555] mb-2 font-medium">
              Order Reference Number *
            </label>
            <input
              type="text"
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              placeholder="e.g. VBF-54210"
              required
              className="w-full bg-white border border-[#EAEAEA] px-4 py-3 text-xs text-black font-mono focus:outline-none focus:border-black transition-colors rounded-none placeholder:font-sans placeholder:text-[#AAAAAA]"
            />
            <p className="text-[10px] text-[#888888] mt-1">
              Found on your order confirmation screen and email dispatch notice.
            </p>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-widest text-[#555555] mb-2 font-medium">
              Email Address or Mobile Phone Number *
            </label>
            <input
              type="text"
              value={emailOrPhone}
              onChange={(e) => setEmailOrPhone(e.target.value)}
              placeholder="e.g. client@domain.com or 01012345678"
              required
              className="w-full bg-white border border-[#EAEAEA] px-4 py-3 text-xs text-black focus:outline-none focus:border-black transition-colors rounded-none placeholder:text-[#AAAAAA]"
            />
            <p className="text-[10px] text-[#888888] mt-1">
              Used strictly to ensure order privacy and verify recipient identity.
            </p>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-[#111111] hover:bg-black text-white text-xs uppercase tracking-luxury py-4 px-8 font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Verifying Credentials…</span>
              </>
            ) : (
              <span>Locate Acquisition</span>
            )}
          </button>
        </form>

        {/* Assistance strip */}
        <div className="mt-8 border border-[#EAEAEA] p-5 bg-white text-xs text-[#666666] space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-black font-semibold uppercase tracking-wider text-[11px]">
              Need Personal Assistance?
            </span>
          </div>
          <p className="text-[11px] leading-relaxed">
            Our concierge team is available daily from 10:00 AM to 10:00 PM CLT. If you misplaced your
            order details, please reach out directly at{' '}
            <a href="mailto:concierge@vbfitsstudios.com" className="text-black underline font-medium">
              concierge@vbfitsstudios.com
            </a>{' '}
            or WhatsApp{' '}
            <span className="text-black font-mono font-medium">+20 100 000 0000</span>.
          </p>
        </div>
      </div>
    </div>
  );
};
