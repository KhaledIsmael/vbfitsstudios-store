import React, { useEffect, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import { BRAND_CONFIG, FOOTER_DATA } from '../../config/assets';
import { useAuth } from '../../context/AuthContext';

function useFocusTrap(ref: React.RefObject<HTMLDivElement | null>, active: boolean) {
  useEffect(() => {
    if (!active || !ref.current) return;
    const el = ref.current;
    const SELECTOR = ['a[href]', 'button:not([disabled])', '[tabindex]:not([tabindex="-1"])'].join(',');
    const getFocusable = () => Array.from(el.querySelectorAll<HTMLElement>(SELECTOR));
    getFocusable()[0]?.focus();
    const trap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const nodes = getFocusable();
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    el.addEventListener('keydown', trap);
    return () => el.removeEventListener('keydown', trap);
  }, [active, ref]);
}

interface MenuDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

// 3 curated primary links per REFERENCE-SPEC
const MENU_LINKS = [
  { name: 'Home', path: '/' },
  { name: 'Shop', path: '/shop' },
  { name: 'Contact', path: '/contact' },
];

export const MenuDrawer: React.FC<MenuDrawerProps> = ({ isOpen, onClose }) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const { role, user } = useAuth();
  const isStaff = role === 'admin' || role === 'support' || user?.role === 'admin' || user?.role === 'support';

  useFocusTrap(panelRef, isOpen);

  // Esc to close
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  // Body scroll lock
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Render only WhatsApp, Instagram, TikTok (exclude Pinterest)
  const allowedSocials = FOOTER_DATA.socials.filter((s) =>
    ['WhatsApp', 'Instagram', 'TikTok'].includes(s.name)
  );

  return (
    <div
      className="fixed inset-0 z-drawer overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Navigation Menu"
    >
      {/* Dark Scrim with backdrop blur per REFERENCE-SPEC */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-medium"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-over panel */}
      <div className="fixed inset-y-0 right-0 max-w-full flex">
        <div
          ref={panelRef}
          className="w-screen max-w-full sm:max-w-md bg-white shadow-2xl flex flex-col justify-between p-6 sm:p-10 transform transition-transform duration-medium ease-drawer"
        >
          {/* Top Bar with Close Button (Navigation heading removed) */}
          <div className="flex items-center justify-end pb-4 border-b border-[#EAEAEA]">
            <button
              onClick={onClose}
              className="p-2 text-[#111111] hover:opacity-60 transition-opacity focus-visible:outline-2 focus-visible:outline-black focus-visible:outline-offset-2 rounded-none"
              aria-label="Close navigation menu"
            >
              <img
                src={BRAND_CONFIG.icons.close}
                alt=""
                aria-hidden="true"
                className="w-4 h-4 object-contain"
                width={16}
                height={16}
              />
            </button>
          </div>

          {/* Main Navigation Links: Refined uppercase editorial typography */}
          <nav className="py-8 sm:py-12 space-y-6 sm:space-y-7 my-auto" aria-label="Primary Navigation">
            {MENU_LINKS.map((link, idx) => (
              <div key={link.path} className="overflow-hidden">
                <NavLink
                  to={link.path}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `group flex items-center justify-between font-sans font-medium uppercase tracking-[0.14em] transition-all duration-200 text-lg sm:text-xl lg:text-2xl py-1 ${
                      isActive
                        ? 'text-black font-semibold'
                        : 'text-[#333333] hover:text-black hover:translate-x-1.5'
                    }`
                  }
                >
                  <span>{link.name}</span>
                  <span className="text-[11px] tracking-wider text-[#999999] group-hover:text-black transition-colors font-mono">
                    0{idx + 1}
                  </span>
                </NavLink>
              </div>
            ))}

            {isStaff && (
              <div className="overflow-hidden pt-3 border-t border-[#F0F0F0]">
                <NavLink
                  to="/admin"
                  onClick={onClose}
                  className="group flex items-center justify-between font-sans font-medium uppercase tracking-[0.14em] text-sm text-[#777777] hover:text-black py-1 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Admin Dashboard
                  </span>
                  <span className="text-[10px] tracking-wider text-[#999999] group-hover:text-black transition-colors font-mono">
                    MGMT
                  </span>
                </NavLink>
              </div>
            )}
          </nav>

          {/* Bottom Area: Socials (WhatsApp, Instagram, TikTok) & Watermark */}
          <div className="border-t border-[#EAEAEA] pt-8 space-y-6">
            <div>
              <p className="text-[10px] font-sans font-bold uppercase tracking-spec text-[#111111] mb-3">
                Socials
              </p>
              <div className="flex flex-wrap items-center gap-6 text-xs uppercase font-sans tracking-spec font-medium text-[#6B6B6B]">
                {allowedSocials.map((s) => (
                  <a
                    key={s.name}
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-black transition-colors focus-visible:outline-2 focus-visible:outline-black"
                    aria-label={`${s.name} (opens in new tab)`}
                  >
                    {s.name}
                  </a>
                ))}
              </div>
            </div>

            {/* Existing Watermark */}
            <div className="text-[10px] text-[#999999] tracking-widest uppercase font-mono">
              {BRAND_CONFIG.copyright}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
