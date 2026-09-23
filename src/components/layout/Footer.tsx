import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { BRAND_CONFIG } from '../../config/assets';
import { subscribeNewsletter } from '../../lib/adminMarketing';

interface FooterLinkItem {
  name: string;
  path: string;
}

export const Footer: React.FC = () => {
  // ── Newsletter Form Logic (Untouched per requirement) ──
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      await subscribeNewsletter(email.trim(), 'footer');
      setSubscribed(true);
      setTimeout(() => {
        setEmail('');
        setSubscribed(false);
      }, 4000);
    }
  };

  // ── Mobile Collapsible Accordion States (REFERENCE-SPEC 11.2) ──
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    service: false,
    policies: false,
    socials: false,
  });

  const toggleSection = (section: string) => {
    setOpenSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  // ── Verified Existing Service Routes in App.tsx ──
  const serviceLinks: FooterLinkItem[] = [
    { name: 'RETURN MY ORDER', path: '/track-order' },
    { name: 'CONTACT US', path: '/contact' },
    { name: 'SHIPPING', path: '/policies/shipping' },
  ];

  // ── Verified Existing Policy Routes in App.tsx / StaticPages.tsx ──
  const policyLinks: FooterLinkItem[] = [
    { name: 'LEGAL NOTICE', path: '/policies/legal' },
    { name: 'PRIVACY POLICY', path: '/policies/privacy' },
    { name: 'REFUND POLICY', path: '/policies/returns' },
    { name: 'TERMS OF SERVICE', path: '/policies/terms' },
  ];

  // ── Socials: WhatsApp, Instagram, TikTok, Pinterest (Sorvea Parity) ──
  const whatsappUrl = `https://wa.me/${BRAND_CONFIG.whatsapp.phoneNumber}?text=${encodeURIComponent(
    BRAND_CONFIG.whatsapp.defaultGreeting
  )}`;

  const socialLinks: { name: string; url: string }[] = [
    { name: 'WHATSAPP', url: whatsappUrl },
    { name: 'INSTAGRAM', url: 'https://instagram.com/vbfitsstudios' },
    { name: 'TIKTOK', url: 'https://tiktok.com/@vbfitsstudios' },
  ];

  return (
    <footer className="bg-white border-t border-[#DDDDDD] select-none">
      <div className="max-w-[1900px] mx-auto px-6 sm:px-10 lg:px-16 py-16 sm:py-24">
        {/* Multi-Column Architecture per REFERENCE-SPEC 11.1 & 11.2 */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-8 lg:gap-12 xl:gap-16">
          {/* Column 1: Newsletter subscription block (Persistently expanded) */}
          <div className="md:col-span-5 lg:col-span-4 space-y-3">
            <h4 className="font-spec font-bold text-xs sm:text-sm tracking-spec text-[#2D2D2D] uppercase">
              JOIN VB FITS TODAY!
            </h4>
            <p className="font-spec text-xs text-[#8E8E8E] uppercase tracking-spec">
              GET 10% OFF YOUR FIRST ORDER!
            </p>
            <form onSubmit={handleSubscribe} className="pt-2 max-w-sm">
              <div className="flex border border-[#DDDDDD] bg-white">
                <label htmlFor="footer-newsletter-email" className="sr-only">
                  Email address
                </label>
                <input
                  id="footer-newsletter-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="EMAIL"
                  required
                  aria-required="true"
                  className="w-full px-3.5 py-3 text-xs text-[#2D2D2D] placeholder-[#ADADAD] font-spec uppercase tracking-spec focus:outline-none bg-transparent rounded-none"
                />
                <button
                  type="submit"
                  className="px-5 py-3 text-xs font-spec font-bold uppercase tracking-spec text-[#2D2D2D] hover:opacity-60 border-l border-[#DDDDDD] flex-shrink-0 transition-opacity bg-transparent"
                >
                  {subscribed ? 'SUBMITTED' : 'SIGN UP'}
                </button>
              </div>
            </form>
          </div>

          {/* Column 2: Service */}
          <div className="md:col-span-2 lg:col-span-2 border-b md:border-b-0 border-[#DDDDDD] pb-4 md:pb-0">
            {/* Mobile Accordion Header */}
            <button
              type="button"
              onClick={() => toggleSection('service')}
              className="wt-collapse__trigger md:hidden w-full flex justify-between items-center py-2 font-spec font-bold text-xs tracking-spec text-[#2D2D2D] uppercase"
              aria-expanded={openSections.service}
            >
              <span>SERVICE</span>
              <span className="text-sm font-light select-none">
                {openSections.service ? '−' : '+'}
              </span>
            </button>

            {/* Desktop Static Header */}
            <h4 className="hidden md:block font-spec font-bold text-xs sm:text-sm tracking-spec text-[#2D2D2D] uppercase mb-4">
              SERVICE
            </h4>

            {/* Links List */}
            <div
              className={`${
                openSections.service ? 'max-h-60 opacity-100 py-3' : 'max-h-0 opacity-0 py-0'
              } md:max-h-none md:opacity-100 md:py-0 overflow-hidden transition-all duration-300`}
            >
              <ul className="space-y-2.5 pt-1">
                {serviceLinks.map((item) => (
                  <li key={item.name}>
                    <Link
                      to={item.path}
                      className="font-spec text-xs tracking-spec text-[#2D2D2D] hover:opacity-60 transition-opacity inline-block uppercase"
                    >
                      {item.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Column 3: Policies (Only pages that exist) */}
          <div className="md:col-span-3 lg:col-span-3 border-b md:border-b-0 border-[#DDDDDD] pb-4 md:pb-0">
            {/* Mobile Accordion Header */}
            <button
              type="button"
              onClick={() => toggleSection('policies')}
              className="wt-collapse__trigger md:hidden w-full flex justify-between items-center py-2 font-spec font-bold text-xs tracking-spec text-[#2D2D2D] uppercase"
              aria-expanded={openSections.policies}
            >
              <span>POLICIES</span>
              <span className="text-sm font-light select-none">
                {openSections.policies ? '−' : '+'}
              </span>
            </button>

            {/* Desktop Static Header */}
            <h4 className="hidden md:block font-spec font-bold text-xs sm:text-sm tracking-spec text-[#2D2D2D] uppercase mb-4">
              POLICIES
            </h4>

            {/* Links List */}
            <div
              className={`${
                openSections.policies ? 'max-h-72 opacity-100 py-3' : 'max-h-0 opacity-0 py-0'
              } md:max-h-none md:opacity-100 md:py-0 overflow-hidden transition-all duration-300`}
            >
              <ul className="space-y-2.5 pt-1">
                {policyLinks.map((item) => (
                  <li key={item.name}>
                    <Link
                      to={item.path}
                      className="font-spec text-xs tracking-spec text-[#2D2D2D] hover:opacity-60 transition-opacity inline-block uppercase"
                    >
                      {item.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Column 4: Socials */}
          <div className="md:col-span-2 lg:col-span-3 border-b md:border-b-0 border-[#DDDDDD] pb-4 md:pb-0">
            {/* Mobile Accordion Header */}
            <button
              type="button"
              onClick={() => toggleSection('socials')}
              className="wt-collapse__trigger md:hidden w-full flex justify-between items-center py-2 font-spec font-bold text-xs tracking-spec text-[#2D2D2D] uppercase"
              aria-expanded={openSections.socials}
            >
              <span>SOCIALS</span>
              <span className="text-sm font-light select-none">
                {openSections.socials ? '−' : '+'}
              </span>
            </button>

            {/* Desktop Static Header */}
            <h4 className="hidden md:block font-spec font-bold text-xs sm:text-sm tracking-spec text-[#2D2D2D] uppercase mb-4">
              SOCIALS
            </h4>

            {/* Links List */}
            <div
              className={`${
                openSections.socials ? 'max-h-60 opacity-100 py-3' : 'max-h-0 opacity-0 py-0'
              } md:max-h-none md:opacity-100 md:py-0 overflow-hidden transition-all duration-300`}
            >
              <ul className="space-y-2.5 pt-1">
                {socialLinks.map((item) => (
                  <li key={item.name}>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-spec text-xs tracking-spec text-[#2D2D2D] hover:opacity-60 transition-opacity inline-block uppercase"
                      aria-label={`${item.name} (opens in new tab)`}
                    >
                      {item.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom Bar: Social Icons & Copyright line (Sorvea Parity) */}
        <div className="mt-16 sm:mt-24 pt-8 border-t border-[#DDDDDD] flex flex-col items-center justify-center space-y-4">
          <div className="flex items-center space-x-6 text-[#2D2D2D]">
            {/* Instagram Icon */}
            <a
              href="https://instagram.com/vbfitsstudios"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              className="hover:opacity-60 transition-opacity"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
              </svg>
            </a>
            {/* TikTok Icon */}
            <a
              href="https://tiktok.com/@vbfitsstudios"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="TikTok"
              className="hover:opacity-60 transition-opacity"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.88 2.89 2.89 0 0 1-2.89-2.88 2.89 2.89 0 0 1 2.89-2.88c.3 0 .59.05.86.13v-3.52a6.38 6.38 0 0 0-.86-.06A6.34 6.34 0 0 0 3 15.67 6.34 6.34 0 0 0 9.34 22a6.34 6.34 0 0 0 6.33-6.33V9.17a8.28 8.28 0 0 0 4.92 1.6V7.32a4.85 4.85 0 0 1-1-.63z"/>
              </svg>
            </a>
          </div>
          <div className="flex items-center gap-3 text-[11px] font-spec tracking-spec uppercase text-[#ADADAD]">
            <span>© 2026 VB FITS STUDIOS</span>
            <span aria-hidden="true">•</span>
            <Link to="/admin/login" className="hover:text-black transition-colors underline underline-offset-2">
              Staff Portal
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};
