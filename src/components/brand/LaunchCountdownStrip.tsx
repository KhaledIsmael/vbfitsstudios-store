import React, { useState, useEffect } from 'react';
import {
  calculateCountdown,
  getSiteSettings,
  DEFAULT_SITE_SETTINGS,
  type SiteSettings,
  type TimeRemaining
} from '../../lib/siteSettings';
import { submitLaunchWaitlist, isLaunchWaitlistSubscribed, type WaitlistContactType } from '../../lib/waitlist';
import { Sparkles, Bell, X, Check, Mail, MessageSquare, ArrowRight } from 'lucide-react';

interface LaunchCountdownStripProps {
  settings?: SiteSettings;
}

export const LaunchCountdownStrip: React.FC<LaunchCountdownStripProps> = ({ settings: initialSettings }) => {
  const [currentSettings, setCurrentSettings] = useState<SiteSettings>(
    initialSettings || DEFAULT_SITE_SETTINGS
  );

  useEffect(() => {
    if (initialSettings) {
      setCurrentSettings(initialSettings);
    } else {
      getSiteSettings().then(setCurrentSettings);
    }

    const handleSettingsChanged = (e: any) => {
      if (e?.detail) {
        setCurrentSettings(e.detail);
      }
    };
    window.addEventListener('vbfits_site_settings_changed', handleSettingsChanged);
    return () => window.removeEventListener('vbfits_site_settings_changed', handleSettingsChanged);
  }, [initialSettings]);

  const [timeLeft, setTimeLeft] = useState<TimeRemaining>(() =>
    calculateCountdown(currentSettings.launch_at)
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [contactType, setContactType] = useState<WaitlistContactType>('email');
  const [contact, setContact] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<boolean>(() => isLaunchWaitlistSubscribed());
  const [feedback, setFeedback] = useState<{ success: boolean; msg: string } | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateCountdown(currentSettings.launch_at));
    }, 1000);
    return () => clearInterval(timer);
  }, [currentSettings.launch_at]);

  // If countdown_strip_enabled is false in site_settings, do not render
  if (!currentSettings.countdown_strip_enabled) {
    return null;
  }

  // Double digit pad
  const pad = (n: number) => n.toString().padStart(2, '0');

  const handleSubmitModal = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    if (!contact.trim()) return;

    setSubmitting(true);
    try {
      const res = await submitLaunchWaitlist({
        contact: contact.trim(),
        contactType,
        source: 'countdown_strip'
      });
      if (res.success) {
        setSubmitted(true);
        setFeedback({ success: true, msg: res.message });
      } else {
        setFeedback({ success: false, msg: res.message || 'Could not register. Try again.' });
      }
    } catch {
      setFeedback({ success: false, msg: 'Error submitting registration.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* ───────────────────────────────────────────────────────────── */}
      {/* Strip Element: Pinned Above Header with Nike-SNKRS Drop Feel   */}
      {/* ───────────────────────────────────────────────────────────── */}
      <aside
        id="launch-countdown-strip"
        aria-label="Pre-Launch Drop Countdown"
        className="w-full bg-[#09090D] text-white border-b border-white/15 px-3 sm:px-6 py-2 select-none font-mono text-[10px] sm:text-xs relative z-[45]"
      >
        <div className="max-w-[1900px] mx-auto flex items-center justify-between gap-2 sm:gap-4">
          
          {/* Left: Streetwear Drop Badge */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
            </span>
            <span className="font-bold tracking-[0.2em] uppercase text-white/90 text-[10px] sm:text-[11px] inline">
              SNKRS DROP // VAULT
            </span>
          </div>

          {/* Center: Countdown Ticker */}
          <div className="flex items-center justify-center gap-1.5 sm:gap-3 flex-1 min-w-0">
            <span className="text-white/60 tracking-wider uppercase text-[10px] sm:text-xs truncate hidden md:inline">
              {currentSettings.countdown_strip_text || 'OFFICIAL LAUNCH INCOMING · WORLDWIDE DROP'}
            </span>

            {timeLeft.isPassed ? (
              <span className="text-emerald-400 font-bold tracking-widest uppercase flex items-center gap-1">
                <Sparkles className="w-3 h-3 animate-spin" />
                <span>DROP IS NOW LIVE</span>
              </span>
            ) : (
              <div className="flex items-center gap-1 sm:gap-1.5 font-bold tracking-widest text-amber-300 bg-black/60 px-2 sm:px-3 py-0.5 border border-white/10 tabular-nums">
                <span>{pad(timeLeft.days)}D</span>
                <span className="text-white/30">:</span>
                <span>{pad(timeLeft.hours)}H</span>
                <span className="text-white/30">:</span>
                <span>{pad(timeLeft.minutes)}M</span>
                <span className="text-white/30">:</span>
                <span className="text-white">{pad(timeLeft.seconds)}S</span>
              </div>
            )}
          </div>

          {/* Right: Quick Notify Trigger */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="bg-white hover:bg-white/90 text-black px-2.5 sm:px-3.5 py-1 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider transition-all flex items-center gap-1 sm:gap-1.5 cursor-pointer shadow-sm active:scale-95"
            >
              <Bell className="w-3 h-3 fill-current" />
              <span>{submitted ? 'On VIP List' : 'Notify Me'}</span>
            </button>
          </div>
        </div>
      </aside>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* Quick Modal for Countdown Strip Waitlist Registration        */}
      {/* ───────────────────────────────────────────────────────────── */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-[1001] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in font-mono"
          onClick={() => setModalOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="bg-[#111116] border border-white/20 text-white max-w-md w-full p-6 sm:p-8 shadow-2xl relative animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-amber-400 mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Streetwear Drop Notification</span>
            </div>

            <h3 className="text-lg font-bold uppercase tracking-wider text-white mb-2">
              Atelier Vault Access
            </h3>
            <p className="text-xs text-white/70 mb-6 font-sans">
              Enter your email or WhatsApp number to receive immediate private access when the drop goes live.
            </p>

            {submitted ? (
              <div className="p-4 bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs space-y-2 text-center animate-fade-in">
                <Check className="w-5 h-5 mx-auto" />
                <p className="font-bold">You are on the VIP drop waitlist.</p>
                <p className="font-sans text-[11px] text-emerald-300/80">
                  We will transmit your private atelier link the moment Drop 01 releases.
                </p>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="mt-3 bg-white text-black text-[10px] uppercase px-4 py-1.5 font-bold"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmitModal} className="space-y-4">
                {/* Contact Type Toggle */}
                <div className="flex items-center bg-black/60 border border-white/15 p-0.5 rounded-none font-mono text-[10px] uppercase">
                  <button
                    type="button"
                    onClick={() => {
                      setContactType('email');
                      setFeedback(null);
                    }}
                    className={`flex-1 py-1.5 transition-all ${
                      contactType === 'email'
                        ? 'bg-white text-black font-bold'
                        : 'text-white/60 hover:text-white'
                    }`}
                  >
                    Email
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setContactType('whatsapp');
                      setFeedback(null);
                    }}
                    className={`flex-1 py-1.5 transition-all ${
                      contactType === 'whatsapp'
                        ? 'bg-white text-black font-bold'
                        : 'text-white/60 hover:text-white'
                    }`}
                  >
                    WhatsApp
                  </button>
                </div>

                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-white/40">
                    {contactType === 'email' ? <Mail className="w-4 h-4" /> : <MessageSquare className="w-4 h-4 text-emerald-400" />}
                  </div>
                  <input
                    type={contactType === 'email' ? 'email' : 'tel'}
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    placeholder={
                      contactType === 'email'
                        ? 'Enter your email'
                        : 'WhatsApp (+20 100 000 0000)'
                    }
                    required
                    className="w-full bg-black/70 border border-white/20 pl-9 pr-4 py-2.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-white font-mono"
                  />
                </div>

                {feedback && (
                  <p
                    className={`text-xs p-2 border ${
                      feedback.success
                        ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                        : 'bg-red-950/40 border-red-500/40 text-red-300'
                    }`}
                  >
                    {feedback.msg}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-white hover:bg-white/90 text-black py-2.5 text-xs uppercase tracking-widest font-bold transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Registering...' : 'Get VIP Drop Alert'}
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
};
