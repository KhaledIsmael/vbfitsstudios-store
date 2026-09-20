import React, { useEffect, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import { NAV_LINKS, BRAND_CONFIG, FOOTER_DATA } from '../../config/assets';

function useFocusTrap(ref: React.RefObject<HTMLDivElement | null>, active: boolean) {
  useEffect(() => {
    if (!active || !ref.current) return;
    const el = ref.current;
    const SELECTOR = ['a[href]','button:not([disabled])','[tabindex]:not([tabindex="-1"])'].join(',');
    const getFocusable = () => Array.from(el.querySelectorAll<HTMLElement>(SELECTOR));
    getFocusable()[0]?.focus();
    const trap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const nodes = getFocusable(); if (!nodes.length) return;
      const first = nodes[0]; const last = nodes[nodes.length - 1];
      if (e.shiftKey) { if (document.activeElement === first) { e.preventDefault(); last.focus(); } }
      else            { if (document.activeElement === last)  { e.preventDefault(); first.focus(); } }
    };
    el.addEventListener('keydown', trap);
    return () => el.removeEventListener('keydown', trap);
  }, [active, ref]);
}

interface MenuDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MenuDrawer: React.FC<MenuDrawerProps> = ({ isOpen, onClose }) => {
  const panelRef = useRef<HTMLDivElement>(null);

  useFocusTrap(panelRef, isOpen);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="menu-drawer-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-over panel */}
      <div className="fixed inset-y-0 right-0 max-w-full flex">
        <div
          ref={panelRef}
          className="w-screen max-w-md sm:max-w-lg bg-white shadow-2xl flex flex-col justify-between p-8 sm:p-12 transform transition-transform duration-500 ease-in-out"
        >
          
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#EAEAEA] pb-6">
            <span
              id="menu-drawer-title"
              className="text-[11px] uppercase tracking-luxury text-[#888888] font-medium"
            >
              Navigation
            </span>
            <button
              onClick={onClose}
              className="p-2 text-[#111111] hover:opacity-60 transition-opacity rounded"
              aria-label="Close navigation menu"
            >
              <img src={BRAND_CONFIG.icons.close} alt="" aria-hidden="true" className="w-4 h-4" width={16} height={16} />
            </button>
          </div>

          {/* Main Navigation Links */}
          <div className="py-10 space-y-6">
            {NAV_LINKS.map((link, idx) => (
              <div key={link.path} className="overflow-hidden">
                <NavLink
                  to={link.path}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `group flex items-center justify-between text-2xl sm:text-3xl font-light tracking-wide transition-all duration-300 ${
                      isActive ? 'text-black font-normal' : 'text-[#555555] hover:text-black hover:translate-x-2'
                    }`
                  }
                >
                  <span>{link.name}</span>
                  <span className="text-xs tracking-widest text-[#AAAAAA] group-hover:text-black transition-colors">
                    0{idx + 1}
                  </span>
                </NavLink>
              </div>
            ))}
          </div>

          {/* Bottom Info & Socials */}
          <div className="border-t border-[#EAEAEA] pt-8 space-y-6">
            <div className="grid grid-cols-2 gap-4 text-xs text-[#666666]">
              <div>
                <p className="font-semibold text-black uppercase tracking-wider mb-2">Concierge</p>
                <p>contact@vbfits.com</p>
                <p>Mon - Fri: 9am - 6pm EST</p>
              </div>
              <div>
                <p className="font-semibold text-black uppercase tracking-wider mb-2">Socials</p>
                <div className="flex flex-wrap gap-3">
                  {FOOTER_DATA.socials.map((s) => (
                    <a
                      key={s.name}
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-black transition-colors"
                      aria-label={`${s.name} (opens in new tab)`}
                    >
                      {s.name}
                    </a>
                  ))}
                </div>
              </div>
            </div>

            <div className="text-[10px] text-[#999999] tracking-widest uppercase">
              {BRAND_CONFIG.copyright}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
