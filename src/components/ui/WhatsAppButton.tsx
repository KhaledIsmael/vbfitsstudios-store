import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { BRAND_CONFIG } from '../../config/assets';
import { getProductById } from '../../lib/products';

export const WhatsAppButton: React.FC = () => {
  const location = useLocation();
  const [productName, setProductName] = useState<string | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  // Detect whether we are on a Product Details Page
  const isProductPage = location.pathname.startsWith('/product/');

  useEffect(() => {
    let isMounted = true;

    if (isProductPage) {
      // Extract product id or slug from /product/:id
      const idOrSlug = location.pathname.replace('/product/', '').split('/')[0]?.split('?')[0];
      if (idOrSlug) {
        getProductById(idOrSlug).then((prod) => {
          if (isMounted) {
            if (prod) {
              setProductName(prod.name);
            } else {
              setProductName(null);
            }
          }
        });
      }
    } else {
      setProductName(null);
    }

    return () => {
      isMounted = false;
    };
  }, [location.pathname, isProductPage]);

  // Determine phone number (configured via env or fallback)
  const rawNumber =
    (import.meta.env.VITE_WHATSAPP_NUMBER as string) ||
    (BRAND_CONFIG as any).whatsapp?.phoneNumber ||
    '201000000000';
  const cleanPhone = rawNumber.replace(/[^0-9]/g, '');

  // Formulate pre-filled greeting message
  const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
  let greetingMessage = 'Hello VB FITS STUDIOS! I have an inquiry regarding your collection.';

  if (isProductPage) {
    if (productName) {
      greetingMessage = `Hello VB FITS STUDIOS! I'm interested in the "${productName}" (${currentUrl}). Can you assist me with sizing and availability?`;
    } else {
      greetingMessage = `Hello VB FITS STUDIOS! I'm interested in this piece (${currentUrl}). Can you assist me with sizing and availability?`;
    }
  }

  const whatsappHref = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(greetingMessage)}`;

  return (
    <div
      className={`fixed right-5 sm:right-8 z-40 transition-all duration-300 ${
        isProductPage ? 'bottom-20 sm:bottom-24' : 'bottom-6 sm:bottom-8'
      }`}
    >
      <div className="relative flex items-center group">
        {/* Tooltip Pill (reveals on hover, or compact on desktop) */}
        <div
          className={`absolute right-full mr-3 whitespace-nowrap bg-[#111111] text-white text-[11px] tracking-wider uppercase px-3 py-1.5 rounded-full shadow-lg pointer-events-none transition-all duration-300 ${
            isHovered
              ? 'opacity-100 translate-x-0'
              : 'opacity-0 translate-x-2'
          }`}
        >
          {isProductPage && productName
            ? `Inquire about ${productName.length > 22 ? productName.slice(0, 20) + '...' : productName}`
            : 'Atelier Concierge · Chat with us'}
          {/* Caret pointing to the button */}
          <div className="absolute top-1/2 -right-1 -translate-y-1/2 w-2 h-2 bg-[#111111] rotate-45" />
        </div>

        {/* WhatsApp Floating Action Link */}
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Chat with Atelier Concierge on WhatsApp"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className="relative flex items-center justify-center w-13 h-13 sm:w-14 sm:h-14 rounded-full bg-[#25D366] text-white shadow-[0_4px_20px_rgba(37,211,102,0.35)] hover:shadow-[0_6px_26px_rgba(37,211,102,0.5)] hover:scale-105 active:scale-95 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-[#25D366] focus:ring-offset-2"
        >
          {/* Ambient ping effect when idle */}
          <span className="absolute inset-0 rounded-full bg-[#25D366] opacity-30 animate-ping pointer-events-none" />

          {/* Official WhatsApp SVG Icon */}
          <svg
            className="w-7 h-7 fill-current relative z-10"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="M17.472 14.382c-.301-.15-1.78-.878-2.056-.978-.276-.1-.476-.15-.677.15-.2.301-.777.978-.953 1.178-.175.2-.351.226-.652.075-.3-.15-1.267-.467-2.414-1.489-.893-.796-1.496-1.78-1.672-2.08-.175-.301-.019-.464.132-.614.136-.135.301-.351.451-.527.151-.175.201-.301.301-.501.101-.2.05-.376-.025-.526-.075-.15-.677-1.633-.928-2.238-.244-.59-.492-.51-.677-.52-.175-.008-.376-.01-.577-.01-.2 0-.527.075-.803.376-.276.301-1.053 1.028-1.053 2.508 0 1.48 1.079 2.909 1.229 3.109.15.2 2.123 3.242 5.144 4.547.719.311 1.28.497 1.718.636.722.23 1.379.198 1.9.12.58-.088 1.78-.728 2.03-1.431.251-.703.251-1.305.176-1.431-.076-.126-.277-.202-.578-.352z" />
            <path d="M12.004 2c-5.523 0-10 4.477-10 10 0 1.764.457 3.424 1.258 4.871L2 22l5.275-1.227A9.957 9.957 0 0 0 12.004 22c5.523 0 10-4.477 10-10s-4.477-10-10-10zm0 18.25c-1.579 0-3.072-.44-4.354-1.207l-.312-.186-3.237.754.767-3.155-.204-.325A8.212 8.212 0 0 1 3.754 12c0-4.549 3.701-8.25 8.25-8.25s8.25 3.701 8.25 8.25-3.701 8.25-8.25 8.25z" />
          </svg>
        </a>
      </div>
    </div>
  );
};
