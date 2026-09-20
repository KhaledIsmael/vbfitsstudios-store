import React, { useState, useEffect } from 'react';
import { Mail, MessageCircle, Check, X, Bell, Loader2 } from 'lucide-react';
import { submitRestockSignup, type ContactType, isRestockSubscribed } from '../../lib/restock';

interface RestockModalProps {
  isOpen: boolean;
  onClose: () => void;
  productId: string;
  productName: string;
  productImage?: string;
  selectedSize: string;
  productVariantId?: string;
}

export const RestockModal: React.FC<RestockModalProps> = ({
  isOpen,
  onClose,
  productId,
  productName,
  productImage,
  selectedSize,
  productVariantId,
}) => {
  const [channel, setChannel] = useState<ContactType>('email');
  const [contact, setContact] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Reset or check state on open or size change
  useEffect(() => {
    if (isOpen) {
      const alreadySubscribed = isRestockSubscribed(productId, selectedSize);
      if (alreadySubscribed) {
        setIsSuccess(true);
        setSuccessMsg(`You're already subscribed to receive alerts for Size ${selectedSize}.`);
      } else {
        setIsSuccess(false);
        setSuccessMsg('');
      }
      setErrorMsg(null);
    }
  }, [isOpen, productId, selectedSize]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    const res = await submitRestockSignup({
      productId,
      productName,
      size: selectedSize,
      productVariantId,
      contact,
      contactType: channel,
    });

    setLoading(false);

    if (res.success) {
      setIsSuccess(true);
      setSuccessMsg(res.message);
    } else {
      setErrorMsg(res.message || 'Unable to register restock alert. Please try again.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white max-w-md w-full p-6 sm:p-8 shadow-2xl relative border border-[#EAEAEA] animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close modal"
          className="absolute top-4 right-4 text-[#888888] hover:text-black transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-[#777777] mb-2">
          <Bell className="w-3.5 h-3.5 text-black" />
          <span>Priority Restock Notification</span>
        </div>

        <h3 className="text-lg sm:text-xl font-light uppercase tracking-wider text-[#111111] mb-1">
          {productName}
        </h3>
        <p className="text-xs text-[#777777] mb-6">
          Selected Size: <span className="font-semibold text-black uppercase font-mono px-1.5 py-0.5 bg-[#F5F5F5] border border-[#EAEAEA] ml-1">{selectedSize}</span>
        </p>

        {isSuccess ? (
          <div className="py-6 text-center space-y-4 animate-fade-in">
            <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200">
              <Check className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="text-xs uppercase font-semibold tracking-wider text-[#111111]">
                Notification Confirmed
              </h4>
              <p className="text-xs text-[#555555] leading-relaxed max-w-xs mx-auto">
                {successMsg}
              </p>
            </div>
            <p className="text-[10px] text-[#999999] uppercase tracking-widest font-mono pt-2">
              We notify in order of registration.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="w-full mt-4 bg-[#111111] hover:bg-black text-white py-3 text-xs uppercase tracking-luxury font-medium transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Channel Switcher */}
            <div>
              <span className="text-[10px] uppercase tracking-widest text-[#888888] block mb-2">
                Notification Channel
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => { setChannel('email'); setErrorMsg(null); }}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 text-xs uppercase tracking-wider font-mono border transition-all ${
                    channel === 'email'
                      ? 'border-black bg-black text-white font-medium shadow-sm'
                      : 'border-[#EAEAEA] bg-[#FAFAFA] text-[#666666] hover:border-[#CCCCCC]'
                  }`}
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Email</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setChannel('whatsapp'); setErrorMsg(null); }}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 text-xs uppercase tracking-wider font-mono border transition-all ${
                    channel === 'whatsapp'
                      ? 'border-black bg-black text-white font-medium shadow-sm'
                      : 'border-[#EAEAEA] bg-[#FAFAFA] text-[#666666] hover:border-[#CCCCCC]'
                  }`}
                >
                  <MessageCircle className="w-3.5 h-3.5 text-[#25D366]" />
                  <span>WhatsApp</span>
                </button>
              </div>
            </div>

            {/* Input Field */}
            <div className="space-y-1.5">
              <label htmlFor="restock-contact-input" className="text-[10px] uppercase tracking-widest text-[#888888] block">
                {channel === 'email' ? 'Your Email Address' : 'Your WhatsApp Number'}
              </label>
              <input
                id="restock-contact-input"
                type={channel === 'email' ? 'email' : 'tel'}
                required
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder={
                  channel === 'email'
                    ? 'client@luxuryatelier.com'
                    : '+20 100 000 0000 or WhatsApp number'
                }
                className="w-full border border-[#D5D5D5] focus:border-black px-3.5 py-3 text-xs text-black placeholder-[#AAAAAA] focus:outline-none transition-colors bg-white font-mono"
              />
              <p className="text-[10px] text-[#888888] leading-tight">
                {channel === 'email'
                  ? 'We will dispatch an automated alert the moment this size is restocked.'
                  : 'Include country code (e.g. +20 for Egypt) for WhatsApp direct notification.'}
              </p>
            </div>

            {/* Error Message */}
            {errorMsg && (
              <p className="text-xs text-[#CC4444] font-mono animate-fade-in bg-red-50 border border-red-200 p-2">
                {errorMsg}
              </p>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#111111] hover:bg-black text-white py-3.5 px-6 text-xs uppercase tracking-luxury font-medium transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Registering...</span>
                </>
              ) : (
                <>
                  <Bell className="w-3.5 h-3.5" />
                  <span>Notify Me When Available</span>
                </>
              )}
            </button>

            <p className="text-[9px] text-[#AAAAAA] text-center uppercase tracking-widest">
              Zero spam. Single alert on inventory update.
            </p>
          </form>
        )}
      </div>
    </div>
  );
};
