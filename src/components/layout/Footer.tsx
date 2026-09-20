import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { FOOTER_DATA, BRAND_CONFIG } from '../../config/assets';
import { subscribeNewsletter } from '../../lib/adminMarketing';

export const Footer: React.FC = () => {
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

  return (
    <footer className="bg-white border-t border-[#EAEAEA] mt-24 sm:mt-36">
      <div className="max-w-[1720px] mx-auto px-6 sm:px-10 lg:px-16 py-16 sm:py-24">
        
        {/* 4 Columns Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 lg:gap-16">
          
          {/* Column 1: Newsletter */}
          <div className="space-y-4">
            <h4 className="text-xs sm:text-sm font-semibold tracking-widest text-[#111111] uppercase">
              {FOOTER_DATA.newsletter.title}
            </h4>
            <p className="text-xs text-[#666666] leading-relaxed">
              {FOOTER_DATA.newsletter.subtitle}
            </p>
            <form onSubmit={handleSubscribe} className="pt-2 flex flex-col space-y-3">
              <div className="relative">
                <label htmlFor="footer-newsletter-email" className="sr-only">Email address</label>
                <input
                  id="footer-newsletter-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={FOOTER_DATA.newsletter.placeholder}
                  required
                  aria-required="true"
                  className="w-full bg-[#FAFAFA] border border-[#EAEAEA] px-4 py-3 text-xs text-[#111111] placeholder-[#888888] focus:outline-none focus:border-black transition-colors rounded-none"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-[#111111] hover:bg-black text-white text-xs uppercase tracking-luxury py-3.5 px-6 font-medium transition-colors"
              >
                {subscribed ? 'Thank You for Subscribing' : FOOTER_DATA.newsletter.buttonText}
              </button>
            </form>
          </div>

          {/* Column 2: Service */}
          <div className="space-y-4">
            <h4 className="text-xs sm:text-sm font-semibold tracking-widest text-[#111111] uppercase">
              Service
            </h4>
            <ul className="space-y-3 pt-1">
              {FOOTER_DATA.service.map((item) => (
                <li key={item.name}>
                  <Link
                    to={item.path}
                    className="text-xs text-[#666666] hover:text-black transition-colors"
                  >
                    {item.name}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  to="/track-order"
                  className="text-xs text-[#111111] font-medium hover:text-black transition-colors flex items-center gap-1.5"
                >
                  <span>Track Order</span>
                  <span className="text-[8px] bg-[#111111] text-white px-1 py-0.5 uppercase tracking-wider font-mono">Live</span>
                </Link>
              </li>
              <li>
                <Link
                  to="/verify"
                  className="text-xs text-[#111111] font-medium hover:text-black transition-colors flex items-center gap-1.5"
                >
                  <span>Verify Authenticity</span>
                  <span className="text-[8px] bg-emerald-600 text-white px-1 py-0.5 uppercase tracking-wider font-mono">Cert</span>
                </Link>
              </li>
              <li>
                <Link
                  to="/collections"
                  className="text-xs text-[#666666] hover:text-black transition-colors"
                >
                  Interactive Lookbook
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Policies */}
          <div className="space-y-4">
            <h4 className="text-xs sm:text-sm font-semibold tracking-widest text-[#111111] uppercase">
              Policies
            </h4>
            <ul className="space-y-3 pt-1">
              {FOOTER_DATA.policies.map((item) => (
                <li key={item.name}>
                  <Link
                    to={item.path}
                    className="text-xs text-[#666666] hover:text-black transition-colors"
                  >
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 4: Socials */}
          <div className="space-y-4">
            <h4 className="text-xs sm:text-sm font-semibold tracking-widest text-[#111111] uppercase">
              Socials
            </h4>
            <ul className="space-y-3 pt-1">
              {FOOTER_DATA.socials.map((item) => (
                <li key={item.name}>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[#666666] hover:text-black transition-colors"
                    aria-label={`${item.name} (opens in new tab)`}
                  >
                    {item.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

        </div>

        {/* Bottom Footer: Centered copyright */}
        <div className="mt-20 sm:mt-28 pt-8 border-t border-[#EAEAEA] text-center">
          <p className="text-[11px] text-[#888888] tracking-widest uppercase">
            {BRAND_CONFIG.copyright}
          </p>
        </div>

      </div>
    </footer>
  );
};
