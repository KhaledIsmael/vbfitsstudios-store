import React, { useState, useEffect } from 'react';
import { Lock, Clock, Sparkles } from 'lucide-react';
import { VaultModal } from './VaultModal';

export const DropVaultBanner: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [timeLeft, setTimeLeft] = useState({
    days: 4,
    hours: 14,
    minutes: 38,
    seconds: 22
  });

  // Ticking countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev.seconds > 0) {
          return { ...prev, seconds: prev.seconds - 1 };
        } else if (prev.minutes > 0) {
          return { ...prev, minutes: prev.minutes - 1, seconds: 59 };
        } else if (prev.hours > 0) {
          return { ...prev, hours: prev.hours - 1, minutes: 59, seconds: 59 };
        } else if (prev.days > 0) {
          return { ...prev, days: prev.days - 1, hours: 23, minutes: 59, seconds: 59 };
        }
        return prev;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const format2 = (n: number) => n.toString().padStart(2, '0');

  return (
    <>
      <section aria-label="Limited Drop Countdown" className="bg-[#0D0D10] text-white border-y border-white/10 py-3.5 px-4 sm:px-8 font-mono select-none">
        <div className="max-w-[1720px] mx-auto flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
          
          {/* Left: Drop Tag & Title */}
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 px-2 py-0.5 bg-red-950/60 text-red-300 border border-red-500/40 text-[9px] uppercase font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping" />
              <span>Next Capsule Drop</span>
            </span>
            <span className="text-[11px] uppercase tracking-wider text-white/90">
              Drop 02 // Winter Heavyweight Capsule
            </span>
          </div>

          {/* Center: Live Countdown Clocks */}
          <div className="flex items-center gap-3 text-[11px]">
            <div className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-white/40 mr-1" />
              <div className="flex items-center gap-1 text-white font-bold tracking-widest">
                <span>{format2(timeLeft.days)}d</span>
                <span className="text-white/30">:</span>
                <span>{format2(timeLeft.hours)}h</span>
                <span className="text-white/30">:</span>
                <span>{format2(timeLeft.minutes)}m</span>
                <span className="text-white/30">:</span>
                <span className="text-emerald-400">{format2(timeLeft.seconds)}s</span>
              </div>
            </div>
          </div>

          {/* Right: Secret Vault CTA */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-black hover:bg-white/90 text-[10px] uppercase font-bold tracking-wider transition-all"
            >
              <Lock className="w-3 h-3" />
              <span>Enter VIP Vault</span>
            </button>
          </div>

        </div>
      </section>

      {/* Vault Modal */}
      <VaultModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
};
