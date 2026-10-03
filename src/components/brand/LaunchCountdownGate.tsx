import React, { useState, useEffect } from 'react';
import {
  calculateCountdown,
  setPastGate,
  type SiteSettings,
  type TimeRemaining
} from '../../lib/siteSettings';
import {
  submitLaunchWaitlist,
  isLaunchWaitlistSubscribed,
  type WaitlistContactType
} from '../../lib/waitlist';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { useAuth } from '../../context/AuthContext';
import { BRAND_CONFIG } from '../../config/assets';
import {
  Mail,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Eye
} from 'lucide-react';

interface LaunchCountdownGateProps {
  settings: SiteSettings;
  onBypass?: () => void;
}

export const LaunchCountdownGate: React.FC<LaunchCountdownGateProps> = ({
  settings,
  onBypass
}) => {
  const { adminUser, isAdmin } = useAdminAuth();
  const { role: customerRole } = useAuth();

  // Check if current user is logged-in admin or support
  const isPrivilegedRole =
    isAdmin ||
    adminUser?.role === 'admin' ||
    adminUser?.role === 'support' ||
    customerRole === 'admin' ||
    customerRole === 'support';

  // Live countdown state
  const [timeLeft, setTimeLeft] = useState<TimeRemaining>(() =>
    calculateCountdown(settings.launch_at)
  );

  // Form states
  const [contactType, setContactType] = useState<WaitlistContactType>('email');
  const [contact, setContact] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<boolean>(() => isLaunchWaitlistSubscribed());
  const [feedback, setFeedback] = useState<{ success: boolean; msg: string } | null>(null);

  // Tick the countdown every second
  useEffect(() => {
    const timer = setInterval(() => {
      const remaining = calculateCountdown(settings.launch_at);
      setTimeLeft(remaining);
    }, 1000);

    return () => clearInterval(timer);
  }, [settings.launch_at]);

  const [initiallyPassed] = useState(() => calculateCountdown(settings.launch_at).isPassed);
  const [isRevealing, setIsRevealing] = useState(false);

  useEffect(() => {
    if (!initiallyPassed && timeLeft.isPassed && !isRevealing) {
      setIsRevealing(true);
      setTimeout(() => {
        if (onBypass) onBypass();
      }, 2500); // Let animation play out before unmounting
    }
  }, [timeLeft.isPassed, initiallyPassed, isRevealing, onBypass]);

  // If launch date has passed initially or gate is toggled off, gate does not render
  const isGateEnabled = settings.countdown_gate_enabled ?? settings.gate_enabled ?? true;
  if (!isGateEnabled || (initiallyPassed && timeLeft.isPassed)) {
    return null;
  }

  // Handle VIP QA Bypass
  const handlePreviewSite = () => {
    setPastGate(true);
    if (onBypass) {
      onBypass();
    }
  };

  // Handle Waitlist Notify Me submission
  const handleSubmitNotify = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!contact.trim()) {
      setFeedback({
        success: false,
        msg: contactType === 'email' ? 'Please enter a valid email address.' : 'Please enter your WhatsApp phone number.'
      });
      return;
    }

    setSubmitting(true);
    try {
      const res = await submitLaunchWaitlist({
        contact: contact.trim(),
        contactType,
        source: 'pre_launch_gate'
      });

      if (res.success) {
        setSubmitted(true);
        setFeedback({ success: true, msg: res.message });
      } else {
        setFeedback({ success: false, msg: res.message || 'Unable to register. Please try again.' });
      }
    } catch {
      setFeedback({ success: false, msg: 'A network error occurred. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  // Format double digits
  const pad = (n: number) => n.toString().padStart(2, '0');

  // Background image - fallback to a generic placeholder if BRAND_CONFIG.hero.src isn't set
  const bgImage = BRAND_CONFIG.hero?.src || '/assets/hero/hero.webp';

  return (
    <div
      id="launch-countdown-gate"
      className={`fixed inset-0 z-[999] flex flex-col items-center justify-between overflow-y-auto selection:bg-white selection:text-black font-sans bg-black bg-cover bg-center bg-no-repeat transition-all duration-[2000ms] ease-in-out ${
        isRevealing ? 'opacity-0 scale-110 pointer-events-none translate-y-[-100vh]' : 'opacity-100 scale-100'
      }`}
      style={{ backgroundImage: `url(${bgImage})` }}
      role="dialog"
      aria-modal="true"
      aria-label="Pre-Launch Drop Countdown Gate"
    >
      {/* Dark overlay for text readability */}
      <div className="absolute inset-0 bg-black/40 pointer-events-none" />

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 1. Header: Logo and Title                                     */}
      {/* ───────────────────────────────────────────────────────────── */}
      <header className="relative z-10 flex flex-col items-center mt-12 sm:mt-16 w-full">
        <img
          src={BRAND_CONFIG.logo.light || '/assets/logo/logo-light.png'}
          alt="VB FITS STUDIOS"
          className="h-12 sm:h-16 w-auto object-contain filter drop-shadow-lg"
        />
      </header>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 2. Main Center Hero: Countdown Cards                          */}
      {/* ───────────────────────────────────────────────────────────── */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center w-full px-4 py-8">
        
        {/* Large Days / Hours / Min / Sec Countdown Blocks */}
        <div className="flex gap-3 sm:gap-6 justify-center w-full max-w-3xl mb-6">
          {/* Days */}
          <div className="flex flex-col items-center bg-white/95 backdrop-blur-md rounded-2xl p-4 sm:p-6 w-20 sm:w-28 shadow-2xl">
            <span className="text-3xl sm:text-5xl font-black text-[#111111] tabular-nums tracking-tighter drop-shadow-sm">
              {pad(timeLeft.days)}
            </span>
            <span className="mt-1 sm:mt-2 text-[9px] sm:text-xs font-bold tracking-widest uppercase text-[#555555]">
              DAYS
            </span>
          </div>

          {/* Hours */}
          <div className="flex flex-col items-center bg-white/95 backdrop-blur-md rounded-2xl p-4 sm:p-6 w-20 sm:w-28 shadow-2xl">
            <span className="text-3xl sm:text-5xl font-black text-[#111111] tabular-nums tracking-tighter drop-shadow-sm">
              {pad(timeLeft.hours)}
            </span>
            <span className="mt-1 sm:mt-2 text-[9px] sm:text-xs font-bold tracking-widest uppercase text-[#555555]">
              HOURS
            </span>
          </div>

          {/* Minutes */}
          <div className="flex flex-col items-center bg-white/95 backdrop-blur-md rounded-2xl p-4 sm:p-6 w-20 sm:w-28 shadow-2xl">
            <span className="text-3xl sm:text-5xl font-black text-[#111111] tabular-nums tracking-tighter drop-shadow-sm">
              {pad(timeLeft.minutes)}
            </span>
            <span className="mt-1 sm:mt-2 text-[9px] sm:text-xs font-bold tracking-widest uppercase text-[#555555]">
              MIN
            </span>
          </div>

          {/* Seconds */}
          <div className="flex flex-col items-center bg-white/95 backdrop-blur-md rounded-2xl p-4 sm:p-6 w-20 sm:w-28 shadow-2xl">
            <span className={`text-3xl sm:text-5xl font-black text-[#111111] tabular-nums tracking-tighter drop-shadow-sm ${timeLeft.isPassed ? '' : 'animate-pulse'}`}>
              {pad(timeLeft.seconds)}
            </span>
            <span className="mt-1 sm:mt-2 text-[9px] sm:text-xs font-bold tracking-widest uppercase text-[#555555]">
              SEC
            </span>
          </div>
        </div>

        {isRevealing ? (
          <h2 className="text-2xl sm:text-4xl md:text-5xl font-black uppercase tracking-[0.2em] text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.5)] text-center animate-pulse">
            THE DROP IS LIVE
          </h2>
        ) : (
          <p className="text-xs sm:text-sm md:text-base font-semibold uppercase tracking-[0.2em] text-white drop-shadow-md text-center max-w-md">
            Time remaining until the exclusive launch
          </p>
        )}
      </main>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 3. Footer: Email Subscription Form                            */}
      {/* ───────────────────────────────────────────────────────────── */}
      <footer className="relative z-10 w-full flex flex-col items-center px-4 mb-12 sm:mb-16">
        <div className="w-full max-w-md bg-black/60 backdrop-blur-md p-6 sm:p-8 rounded-2xl border border-white/20 shadow-2xl">
          {submitted ? (
            <div className="space-y-4 py-4 animate-fade-in text-center font-sans">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-base sm:text-lg font-semibold text-white">
                VIP Allocation Confirmed
              </h3>
              <p className="text-sm text-white/70 max-w-sm mx-auto leading-relaxed">
                Your credentials have been indexed in the atelier waitlist. We will notify you immediately when the drop is live.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              <h3 className="text-sm sm:text-base font-semibold text-white text-center">
                Get Drop Notification
              </h3>
              
              <form onSubmit={handleSubmitNotify} className="flex flex-col gap-3">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-white/50">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    value={contact}
                    onChange={(e) => {
                      setContact(e.target.value);
                      setContactType('email'); // enforce email
                    }}
                    placeholder="Enter your email address"
                    disabled={submitting}
                    required
                    className="w-full bg-white/10 border border-white/20 focus:border-white focus:bg-white/20 pl-10 pr-4 py-3 rounded-xl text-sm text-white placeholder-white/50 focus:outline-none transition-all font-sans"
                    aria-label="Email address for drop notification"
                  />
                </div>

                {feedback && (
                  <div
                    className={`p-3 text-xs text-center rounded-xl font-medium border ${
                      feedback.success
                        ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                        : 'bg-red-500/20 border-red-500/40 text-red-300'
                    }`}
                  >
                    {feedback.msg}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-white hover:bg-white/90 text-black py-3 px-6 rounded-xl text-sm font-bold transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 group"
                >
                  {submitting ? (
                    <>
                      <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <>
                      <span>Notify Me</span>
                      <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                    </>
                  )}
                </button>
              </form>
            </div>
          )}
        </div>

        {/* 'Preview Site' Link: Visible ONLY to logged-in admin / support roles */}
        {isPrivilegedRole && (
          <div className="mt-8 text-center">
            <button
              type="button"
              onClick={handlePreviewSite}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white border border-white/30 rounded-full transition-all text-xs font-semibold shadow-lg mx-auto"
              title="Bypass pre-launch gate for QA testing"
              aria-label="Preview site for QA"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Preview Site (QA)</span>
            </button>
            <div className="mt-2 text-[10px] text-white/50 flex items-center justify-center gap-1">
              <ShieldCheck className="w-3 h-3" />
              <span>Admin Session Active</span>
            </div>
          </div>
        )}
      </footer>
    </div>
  );
};
