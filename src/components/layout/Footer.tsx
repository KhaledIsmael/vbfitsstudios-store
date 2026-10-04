import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { BRAND_CONFIG } from '../../config/assets';
import { subscribeNewsletter } from '../../lib/adminMarketing';
import { getSiteSettings, type SiteSettings, DEFAULT_SITE_SETTINGS, formatSocialUrl } from '../../lib/siteSettings';
import { supabase } from '../../lib/supabaseClient';

interface FooterLinkItem {
  name: string;
  path: string;
}

export const Footer: React.FC = () => {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return;

    setSubmitting(true);
    // 1. Record newsletter subscription + discount voucher
    await subscribeNewsletter(cleanEmail, 'footer');

    // 2. Dispatch real signup / login magic verification email
    try {
      await supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: {
          emailRedirectTo: `${window.location.origin}/profile`,
          shouldCreateUser: true
        }
      });
    } catch (err) {
      console.warn('Footer signup dispatch notice:', err);
    }

    setSubmitting(false);
    setSubscribed(true);
    setTimeout(() => {
      setEmail('');
      setSubscribed(false);
    }, 6000);
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

  // ── Site Settings for Social URLs ──
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SITE_SETTINGS);
  
  React.useEffect(() => {
    getSiteSettings().then(setSettings);
  }, []);

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

  // ── Socials: Dynamic from Site Settings ──
  const whatsappUrl = formatSocialUrl('whatsapp', settings.social_whatsapp_url);
  const instagramUrl = formatSocialUrl('instagram', settings.social_instagram_url);
  const tiktokUrl = formatSocialUrl('tiktok', settings.social_tiktok_url);

  const socialLinks: { name: string; url: string }[] = [
    { name: 'WHATSAPP', url: whatsappUrl },
    { name: 'INSTAGRAM', url: instagramUrl },
    { name: 'TIKTOK', url: tiktokUrl },
  ];

  return (
    <footer className="bg-white border-t border-[#DDDDDD] select-none">
      <div className="max-w-[1900px] mx-auto px-6 sm:px-10 lg:px-16 py-16 sm:py-24">
        {/* Multi-Column Architecture per REFERENCE-SPEC 11.1 & 11.2 */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-8 lg:gap-12 xl:gap-16">
          {/* Column 1: Newsletter subscription block (Persistently expanded) */}
          <div className="md:col-span-5 lg:col-span-4 space-y-3">
            <h4 className="font-spec font-bold text-xs sm:text-sm tracking-spec text-black uppercase">
              JOIN VB FITS TODAY!
            </h4>
            <p className="font-spec text-xs text-[#555555] uppercase tracking-spec">
              GET 10% OFF YOUR FIRST ORDER!
            </p>
            <form onSubmit={handleSubscribe} className="pt-2 max-w-sm">
              <div className="flex border border-[#CCCCCC] bg-white">
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
                  className="w-full px-3.5 py-3 text-xs text-black placeholder-[#888888] font-spec normal-case tracking-spec focus:outline-none bg-transparent rounded-none"
                />
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-3 text-xs font-spec font-bold uppercase tracking-spec text-black hover:opacity-60 border-l border-[#CCCCCC] flex-shrink-0 transition-opacity bg-transparent disabled:opacity-50"
                >
                  {submitting ? 'SENDING...' : subscribed ? 'CHECK EMAIL!' : 'SIGN UP'}
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
              className="wt-collapse__trigger md:hidden w-full flex justify-between items-center py-2 font-spec font-bold text-xs tracking-spec text-black uppercase"
              aria-expanded={openSections.service}
            >
              <span>SERVICE</span>
              <span className="text-sm font-light select-none">
                {openSections.service ? '−' : '+'}
              </span>
            </button>

            {/* Desktop Static Header */}
            <h4 className="hidden md:block font-spec font-bold text-xs sm:text-sm tracking-spec text-black uppercase mb-4">
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
                      className="font-spec text-xs tracking-spec text-black hover:opacity-60 transition-opacity inline-block uppercase"
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
              className="wt-collapse__trigger md:hidden w-full flex justify-between items-center py-2 font-spec font-bold text-xs tracking-spec text-black uppercase"
              aria-expanded={openSections.policies}
            >
              <span>POLICIES</span>
              <span className="text-sm font-light select-none">
                {openSections.policies ? '−' : '+'}
              </span>
            </button>

            {/* Desktop Static Header */}
            <h4 className="hidden md:block font-spec font-bold text-xs sm:text-sm tracking-spec text-black uppercase mb-4">
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
                      className="font-spec text-xs tracking-spec text-black hover:opacity-60 transition-opacity inline-block uppercase"
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
              className="wt-collapse__trigger md:hidden w-full flex justify-between items-center py-2 font-spec font-bold text-xs tracking-spec text-black uppercase"
              aria-expanded={openSections.socials}
            >
              <span>SOCIALS</span>
              <span className="text-sm font-light select-none">
                {openSections.socials ? '−' : '+'}
              </span>
            </button>

            {/* Desktop Static Header */}
            <h4 className="hidden md:block font-spec font-bold text-xs sm:text-sm tracking-spec text-black uppercase mb-4">
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
                      className="font-spec text-xs tracking-spec text-black hover:opacity-60 transition-opacity inline-block uppercase"
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
              href={instagramUrl}
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
              href={tiktokUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="TikTok"
              className="hover:opacity-60 transition-opacity"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.88 2.89 2.89 0 0 1-2.89-2.88 2.89 2.89 0 0 1 2.89-2.88c.3 0 .59.05.86.13v-3.52a6.38 6.38 0 0 0-.86-.06A6.34 6.34 0 0 0 3 15.67 6.34 6.34 0 0 0 9.34 22a6.34 6.34 0 0 0 6.33-6.33V9.17a8.28 8.28 0 0 0 4.92 1.6V7.32a4.85 4.85 0 0 1-1-.63z"/>
              </svg>
            </a>
            {/* WhatsApp Icon */}
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="WhatsApp"
              className="hover:opacity-60 transition-opacity"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
              </svg>
            </a>
          </div>
          <div className="flex flex-col items-center gap-1.5 text-center">
            <div className="flex items-center gap-3 text-[11px] font-spec tracking-spec uppercase text-[#555555]">
              <span>© 2026 VB FITS STUDIOS</span>
            </div>
            
            <div className="text-[9px] font-spec tracking-widest uppercase text-[#555555] mt-1 flex items-center justify-center gap-1.5">
              <span>Built by</span>
              <a 
                href={formatSocialUrl('url', settings.credits_developer_url)} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-black hover:opacity-60 transition-colors font-bold"
              >
                {settings.credits_developer_name || 'Khaled Ismail'}
              </a>
              <span>&amp;</span>
              <a 
                href={formatSocialUrl('url', settings.credits_agency_url)} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-black hover:opacity-60 transition-colors font-bold"
              >
                {settings.credits_agency_name || 'ERTH'}
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};
