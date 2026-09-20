import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getStorefrontAnnouncement, type StoreAnnouncement } from '../../lib/adminMarketing';
import { Sparkles, Radio, Volume2 } from 'lucide-react';

export const AnnouncementBar: React.FC = () => {
  const [announcement, setAnnouncement] = useState<StoreAnnouncement | null>(null);

  useEffect(() => {
    getStorefrontAnnouncement().then((data) => {
      if (data && data.enabled && data.text) {
        setAnnouncement(data);
      }
    });
  }, []);

  const handleToggleSound = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent('toggle-atelier-audio'));
  };

  const displayText = announcement?.text || "COMPLIMENTARY WORLDWIDE EXPRESS DISPATCH ON ORDERS OVER $250 // CERTIFIED 340 GSM PORTO ATELIER";
  const displayLink = announcement?.link || "/lookbook";

  return (
    <div className="bg-[#0B0B0E] text-white py-2 px-4 text-center text-[10px] sm:text-xs font-mono tracking-widest uppercase transition-all flex items-center justify-between border-b border-white/10 select-none">
      <div className="hidden md:flex items-center gap-2 text-white/50 text-[10px]">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        <span>Porto Atelier Active</span>
      </div>

      <Link
        to={displayLink}
        className="flex-1 text-center hover:text-amber-300 transition-colors flex items-center justify-center gap-2 truncate px-2"
      >
        <Sparkles className="w-3 h-3 text-amber-300 animate-pulse hidden sm:inline flex-shrink-0" />
        <span className="truncate">{displayText}</span>
        <Sparkles className="w-3 h-3 text-amber-300 animate-pulse hidden sm:inline flex-shrink-0" />
      </Link>

      <button
        type="button"
        onClick={handleToggleSound}
        className="hidden sm:flex items-center gap-1.5 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 px-2 py-0.5 rounded text-[9px] uppercase tracking-wider transition-colors flex-shrink-0"
        aria-label="Toggle ambient runway soundscape"
      >
        <Volume2 className="w-3 h-3 text-emerald-400" aria-hidden="true" />
        <span>Soundscape</span>
      </button>
    </div>
  );
};
