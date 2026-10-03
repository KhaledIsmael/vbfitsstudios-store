import React, { useState } from 'react';
import { Lock, Unlock, Key, X, Sparkles, Check, ArrowRight, ShieldAlert } from 'lucide-react';
import { useCart } from '../../context/CartContext';

interface VaultModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const VALID_PASSCODES = ['VB2026', 'VIP', 'ATELIER', 'ARCHIVE', 'SECRET'];

export const VaultModal: React.FC<VaultModalProps> = ({ isOpen, onClose }) => {
  const [passcode, setPasscode] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [waitlistEmail, setWaitlistEmail] = useState('');
  const [waitlistJoined, setWaitlistJoined] = useState(false);
  const { addToCart, setIsCartOpen } = useCart();
  const [addedNotice, setAddedNotice] = useState(false);

  if (!isOpen) return null;

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const clean = passcode.trim().toUpperCase();
    if (VALID_PASSCODES.includes(clean)) {
      setIsUnlocked(true);
    } else {
      setErrorMsg('Invalid VIP passkey. Check your private atelier invitation or sign up below.');
    }
  };

  const handleJoinVaultWaitlist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!waitlistEmail.trim()) return;
    setWaitlistJoined(true);
  };

  const handleClaimPrototype = () => {
    // Add exclusive prototype piece to cart
    addToCart({
      id: 'vb-vault-prototype-01',
      name: 'VB Fits Nocturne Anorak — Prototype 01',
      subtitle: 'VIP Vault Exclusive / Limited to 50 Units Worldwide',
      price: 260,
      currency: '$',
      category: 'long-sleeve',
      featured: false,
      images: ['/assets/products/black-shirt.jpeg'],
      color: 'Matte Obsidian',
      colorsAvailable: [{ name: 'Matte Obsidian', hex: '#0B0B0C', productId: 'vb-vault-prototype-01' }],
      sizes: ['M', 'L', 'XL'],
      description: 'Exclusive Archival Vault release. Heavyweight 380 GSM Japanese technical nylon blend with Italian RiRi zippers.',
      details: ['Hand-numbered 1 of 50', 'Water-repellent technical coating', 'High-density matte chest logo'],
      fabricCare: ['Dry clean only'],
      shippingInfo: 'Complimentary priority delivery with bespoke wooden presentation case.'
    }, 'L', 1);

    setAddedNotice(true);
    setTimeout(() => {
      setAddedNotice(false);
      setIsCartOpen(true);
      onClose();
    }, 1200);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in font-mono"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-[#121216] border border-white/20 text-white max-w-lg w-full p-6 sm:p-8 shadow-2xl relative animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-emerald-400 mb-2">
          {isUnlocked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
          <span>{isUnlocked ? 'Vault Access Granted' : 'Restricted Archival Vault'}</span>
        </div>

        <h3 className="text-xl sm:text-2xl font-light uppercase tracking-wider text-white mb-2">
          {isUnlocked ? 'Archival Sample 01 Unlocked' : 'Enter VIP Passcode'}
        </h3>
        <p className="text-xs text-white/60 mb-6 font-sans">
          {isUnlocked
            ? 'You have unlocked the unreleased Drop 02 prototype runway silhouette before public launch.'
            : 'Private vault access is restricted to VIP clients and verified collectors holding an atelier key.'}
        </p>

        {isUnlocked ? (
          /* Unlocked Product Showcase */
          <div className="space-y-6 animate-fade-in">
            <div className="p-4 bg-black/60 border border-white/15 flex gap-4 items-center">
              <div className="w-20 h-24 bg-[#18181D] border border-white/10 flex-shrink-0 overflow-hidden">
                <img
                  src="/assets/products/black-shirt.jpeg"
                  alt="Vault Prototype"
                  className="w-full h-full object-contain p-1"
                />
              </div>
              <div className="space-y-1 min-w-0">
                <span className="text-[9px] uppercase tracking-widest text-emerald-400 block font-bold">
                  ● 1 of 50 Numbered Units
                </span>
                <h4 className="text-sm font-medium text-white truncate uppercase tracking-wider">
                  Nocturne Anorak Prototype
                </h4>
                <p className="text-xs text-white/60 font-sans">
                  380 GSM Technical Archival Cotton
                </p>
                <p className="text-sm font-bold text-white pt-1">
                  $260.00 <span className="text-[10px] text-white/40 font-normal">USD</span>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleClaimPrototype}
              className="w-full bg-white hover:bg-white/90 text-black py-3.5 px-6 text-xs uppercase tracking-widest font-bold transition-all shadow-lg flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>Reserve Exclusive Prototype</span>
            </button>

            {addedNotice && (
              <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs text-center animate-fade-in">
                ✓ Prototype added to your Shopping Bag. Proceed to checkout to secure allocation.
              </div>
            )}
          </div>
        ) : (
          /* Lock Screen */
          <div className="space-y-6">
            <form onSubmit={handleUnlock} className="space-y-4">
              <div>
                <label className="text-[10px] uppercase tracking-widest text-white/60 block mb-1.5">
                  Private Access Key
                </label>
                <div className="relative">
                  <Key className="w-4 h-4 text-white/40 absolute left-3 top-3.5" />
                  <input
                    type="password"
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    placeholder="Enter passkey (try: VB2026)"
                    className="w-full bg-black/60 border border-white/20 focus:border-white pl-9 pr-4 py-3 text-xs uppercase text-white placeholder-white/30 focus:outline-none transition-colors"
                  />
                </div>
              </div>

              {errorMsg && (
                <p className="text-xs text-red-400 bg-red-950/40 border border-red-500/40 p-2.5">
                  {errorMsg}
                </p>
              )}

              <button
                type="submit"
                className="w-full bg-white text-black hover:bg-white/90 py-3 text-xs uppercase tracking-widest font-bold transition-all flex items-center justify-center gap-2"
              >
                <Unlock className="w-3.5 h-3.5" />
                <span>Unlock Private Vault</span>
              </button>
            </form>

            {/* Waitlist form for non-passcode holders */}
            <div className="border-t border-white/10 pt-5">
              <span className="text-[10px] uppercase tracking-widest text-white/40 block mb-2">
                Don't have a passkey?
              </span>
              {waitlistJoined ? (
                <div className="p-3 bg-white/5 border border-white/10 text-emerald-400 text-xs flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  <span>Your VIP invitation key will be transmitted 1 hour before launch.</span>
                </div>
              ) : (
                <form onSubmit={handleJoinVaultWaitlist} className="flex gap-2">
                  <input
                    type="email"
                    required
                    value={waitlistEmail}
                    onChange={(e) => setWaitlistEmail(e.target.value)}
                    placeholder="Enter email for secret key"
                    className="flex-1 bg-black/40 border border-white/15 px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-white"
                  />
                  <button
                    type="submit"
                    className="bg-white/10 hover:bg-white/20 text-white border border-white/20 px-4 py-2 text-xs uppercase tracking-wider"
                  >
                    Request
                  </button>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
