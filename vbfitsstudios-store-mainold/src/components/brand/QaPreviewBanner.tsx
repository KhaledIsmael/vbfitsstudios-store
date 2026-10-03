import React from 'react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { useAuth } from '../../context/AuthContext';
import { setPastGate, isPastGate, type SiteSettings } from '../../lib/siteSettings';
import { Eye, Lock, ShieldCheck } from 'lucide-react';

interface QaPreviewBannerProps {
  settings: SiteSettings;
  onResetGate: () => void;
}

export const QaPreviewBanner: React.FC<QaPreviewBannerProps> = ({ settings, onResetGate }) => {
  const { adminUser, isAdmin } = useAdminAuth();
  const { role: customerRole } = useAuth();

  const isPrivileged =
    isAdmin ||
    adminUser?.role === 'admin' ||
    adminUser?.role === 'support' ||
    customerRole === 'admin' ||
    customerRole === 'support';

  // Only show if user is admin/support and gate was bypassed
  if (!isPrivileged || !isPastGate()) {
    return null;
  }

  const handleLockAgain = () => {
    setPastGate(false);
    onResetGate();
  };

  return (
    <div
      className="fixed bottom-4 left-4 z-50 bg-[#0F0F14] text-white border border-white/20 shadow-2xl px-3.5 py-2 flex items-center gap-3 font-mono text-[11px] backdrop-blur-md animate-fade-in select-none"
      role="status"
      aria-label="Admin QA Preview Mode"
    >
      <div className="flex items-center gap-1.5 text-amber-300 font-bold">
        <Eye className="w-3.5 h-3.5" />
        <span>QA PREVIEW MODE</span>
      </div>

      <div className="hidden sm:inline text-white/50">|</div>

      <span className="hidden sm:inline text-white/70">
        Gate Bypassed for {adminUser?.role || customerRole}
      </span>

      <button
        type="button"
        onClick={handleLockAgain}
        className="bg-white/10 hover:bg-white text-white hover:text-black border border-white/20 px-2.5 py-1 text-[10px] uppercase tracking-wider transition-colors flex items-center gap-1 cursor-pointer"
        title="Re-enable gate to test first-visit experience"
      >
        <Lock className="w-3 h-3" />
        <span>Re-Lock Gate</span>
      </button>
    </div>
  );
};
