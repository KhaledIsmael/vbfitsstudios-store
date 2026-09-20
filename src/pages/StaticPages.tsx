import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Plus, ShoppingBag, Check, Eye, Sparkles, ShieldCheck } from 'lucide-react';
import { BRAND_CONFIG, PRODUCTS } from '../config/assets';
import { useCart } from '../context/CartContext';
import { CraftsmanshipExplorer } from '../components/brand/CraftsmanshipExplorer';
import { PackagingVisualizer } from '../components/brand/PackagingVisualizer';
import { DropVaultBanner } from '../components/brand/DropVaultBanner';

import { InteractiveLookbook } from '../components/brand/InteractiveLookbook';

// Collections Lookbook Page with Interactive Shoppable Hotspots
export const CollectionsPage: React.FC = () => {
  return (
    <div className="pt-24 sm:pt-32 pb-24 min-h-screen bg-white">
      <h1 className="sr-only">VB Fits Studios — Lookbook &amp; Collections</h1>
      {/* Drop Vault Countdown Banner */}
      <DropVaultBanner />

      <div className="max-w-[1720px] mx-auto px-6 sm:px-10 lg:px-16 pt-8">
        <InteractiveLookbook isSpotlight={false} />
      </div>
    </div>
  );
};

// About Page with 340 GSM Craftsmanship Explorer & Packaging Experience
export const AboutPage: React.FC = () => {
  return (
    <div className="pt-24 sm:pt-32 pb-24 min-h-screen bg-white">
      <div className="max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-16 space-y-16">
        
        {/* Header */}
        <div className="text-center space-y-4 py-8 border-b border-[#EAEAEA]">
          <span className="text-[10px] text-[#888888] tracking-luxury uppercase">
            Atelier Narrative & Provenance
          </span>
          <h1 className="text-3xl sm:text-5xl font-light uppercase tracking-wider text-black">
            About VB Fits Studios
          </h1>
          <p className="text-base sm:text-lg text-black font-light leading-relaxed max-w-2xl mx-auto pt-2">
            Founded with an unyielding dedication to luxury streetwear, <span className="font-medium">VB Fits Studios</span> bridges haute couture tailoring with raw urban brutalism.
          </p>
        </div>

        {/* 1. Interactive 340 GSM Craftsmanship Explorer */}
        <CraftsmanshipExplorer />

        {/* 2. Bespoke Packaging & Unboxing Visualizer */}
        <PackagingVisualizer />

        {/* 3. Certificate of Authenticity Link Strip */}
        <div className="bg-[#FAFAFA] border border-[#EAEAEA] p-8 sm:p-10 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="space-y-1 text-center sm:text-left">
            <span className="text-[10px] uppercase font-mono tracking-widest text-[#777777] block">
              Provenance Registry
            </span>
            <h3 className="text-xl font-light uppercase tracking-wider text-black">
              Verify Garment Authenticity
            </h3>
            <p className="text-xs text-[#666666] max-w-md">
              Every garment carries a unique serial number on its interior label. Access our digital registry to verify Portuguese mill provenance and batch production.
            </p>
          </div>
          <Link
            to="/verify"
            className="bg-black hover:bg-[#222222] text-white px-8 py-3.5 text-xs uppercase tracking-luxury font-medium transition-colors whitespace-nowrap flex-shrink-0"
          >
            Authenticate Piece
          </Link>
        </div>

      </div>
    </div>
  );
};

// Contact Page
export const ContactPage: React.FC = () => {
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="pt-24 sm:pt-32 pb-24 min-h-screen bg-white">
      <div className="max-w-[1200px] mx-auto px-6 sm:px-10 lg:px-16">
        
        <div className="text-center space-y-4 py-8 border-b border-[#EAEAEA]">
          <span className="text-[10px] text-[#888888] tracking-luxury uppercase">
            Client Concierge
          </span>
          <h1 className="text-3xl sm:text-5xl font-light uppercase tracking-wider text-black">
            Contact Us
          </h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 sm:gap-20 pt-16">
          
          <div className="space-y-8 text-xs text-[#555555]">
            <div>
              <h3 className="text-xs uppercase tracking-widest font-semibold text-black mb-2">
                Atelier Concierge
              </h3>
              <p>For order inquiries, VIP styling assistance, and private showroom viewings:</p>
              <p className="text-black font-medium mt-1">concierge@vbfits.com</p>
            </div>

            <div>
              <h3 className="text-xs uppercase tracking-widest font-semibold text-black mb-2">
                Press & Wholesale
              </h3>
              <p>For editorial loans and partner boutique correspondence:</p>
              <p className="text-black font-medium mt-1">press@vbfits.com</p>
            </div>

            <div>
              <h3 className="text-xs uppercase tracking-widest font-semibold text-black mb-2">
                Hours of Operation
              </h3>
              <p>Monday — Friday: 9:00 AM — 6:00 PM EST</p>
              <p>Saturday — Sunday: Closed</p>
            </div>
          </div>

          <div>
            {submitted ? (
              <div
                className="bg-[#FAFAFA] border border-[#EAEAEA] p-8 text-center space-y-3"
                role="status"
                aria-live="polite"
              >
                <h4 className="text-xs uppercase tracking-widest font-semibold text-black">Message Transmitted</h4>
                <p className="text-xs text-[#666666]">
                  A client concierge advisor will review your transmission within 24 business hours.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6" noValidate>
                <div>
                  <label
                    htmlFor="contact-name"
                    className="block text-[11px] uppercase tracking-widest text-[#555555] mb-2 font-medium"
                  >
                    Name
                  </label>
                  <input
                    id="contact-name"
                    type="text"
                    required
                    aria-required="true"
                    className="w-full bg-[#FAFAFA] border border-[#EAEAEA] px-4 py-3 text-xs text-black focus:outline-none focus:border-black rounded-none"
                    placeholder="Your Full Name"
                  />
                </div>
                <div>
                  <label
                    htmlFor="contact-email"
                    className="block text-[11px] uppercase tracking-widest text-[#555555] mb-2 font-medium"
                  >
                    Email Address
                  </label>
                  <input
                    id="contact-email"
                    type="email"
                    required
                    aria-required="true"
                    className="w-full bg-[#FAFAFA] border border-[#EAEAEA] px-4 py-3 text-xs text-black focus:outline-none focus:border-black rounded-none"
                    placeholder="name@domain.com"
                  />
                </div>
                <div>
                  <label
                    htmlFor="contact-inquiry"
                    className="block text-[11px] uppercase tracking-widest text-[#555555] mb-2 font-medium"
                  >
                    Inquiry
                  </label>
                  <textarea
                    id="contact-inquiry"
                    rows={5}
                    required
                    aria-required="true"
                    className="w-full bg-[#FAFAFA] border border-[#EAEAEA] px-4 py-3 text-xs text-black focus:outline-none focus:border-black rounded-none"
                    placeholder="How may our concierge assist you?"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-black text-white text-xs uppercase tracking-luxury py-4 font-medium hover:bg-[#333333] transition-colors"
                >
                  Send Transmission
                </button>
              </form>
            )}
          </div>

        </div>

      </div>
    </div>
  );
};

// Policies Page (Shipping, Returns, Legal, Privacy, Refund, Terms)
export const PoliciesPage: React.FC = () => {
  const { type } = useParams<{ type: string }>();

  const getPolicyContent = () => {
    switch (type) {
      case 'shipping':
        return {
          title: 'Shipping Policy',
          content: 'All orders from VB Fits Studios are processed Monday through Friday, excluding public holidays. Orders placed before 2:00 PM EST ship same business day. We offer complimentary express courier shipping on all domestic and international orders surpassing $250. Full tracking telemetry is transmitted to your registered email upon courier handover.'
        };
      case 'returns':
      case 'refund':
        return {
          title: 'Returns & Refund Policy',
          content: 'We offer complimentary 14-day returns on unworn merchandise in pristine, original condition with all internal woven labels, security tags, and luxury presentation packaging intact. Once authenticated by our atelier inspection team, refunds are processed directly to the original payment instrument within 3–5 banking days.'
        };
      case 'privacy':
        return {
          title: 'Privacy Policy',
          content: 'VB Fits Studios respects your absolute privacy. We collect only necessary client information required to execute orders and provide bespoke client services. We will never sell, rent, or distribute personal identity markers to unapproved external entities.'
        };
      case 'legal':
      case 'terms':
      default:
        return {
          title: 'Terms of Service & Legal Notice',
          content: 'All content, iconography, sleeve artwork patterns, photography, and brand marks depicted on this website are the intellectual property of VB Fits Studios. Unauthorized duplication, redistribution, or modification is strictly prohibited. By accessing this platform, you agree to comply with international intellectual property regulations.'
        };
    }
  };

  const policy = getPolicyContent();

  return (
    <div className="pt-24 sm:pt-32 pb-24 min-h-screen bg-white">
      <div className="max-w-[900px] mx-auto px-6 sm:px-10 lg:px-16">
        <div className="text-center space-y-4 py-8 border-b border-[#EAEAEA]">
          <span className="text-[10px] text-[#888888] tracking-luxury uppercase">
            Official Documentation
          </span>
          <h1 className="text-3xl sm:text-4xl font-light uppercase tracking-wider text-black">
            {policy.title}
          </h1>
        </div>
        <div className="pt-12 text-xs sm:text-sm text-[#555555] leading-relaxed space-y-6">
          <p>{policy.content}</p>
          <p>
            For specialized inquiries regarding legal compliance or shipping tracking, please contact our concierge team at <span className="font-semibold text-black">concierge@vbfits.com</span>.
          </p>
        </div>
      </div>
    </div>
  );
};
