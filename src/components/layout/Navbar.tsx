import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { BRAND_CONFIG } from '../../config/assets';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { AnnouncementBar } from './AnnouncementBar';

interface NavbarProps {
  onOpenSearch: () => void;
  onOpenMenu: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenSearch, onOpenMenu }) => {
  const { totalItems, setIsCartOpen, isCartBouncing } = useCart();
  const { isLoggedIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Scroll detection for transparent vs solid header behavior
  const [isScrolled, setIsScrolled] = useState(false);
  const isHomePage = location.pathname === '/';

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 40);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // When hero sits under header on home page and user hasn't scrolled past threshold
  const isTransparent = isHomePage && !isScrolled;

  const handleProfileClick = () => {
    if (isLoggedIn) {
      navigate('/profile');
    } else {
      navigate('/login');
    }
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-header transition-colors duration-default ${
        isTransparent
          ? 'bg-transparent border-b border-transparent'
          : 'bg-white/95 backdrop-blur-md border-b border-[#DDDDDD] shadow-xs'
      }`}
    >
      {!isTransparent && <AnnouncementBar />}

      {/* REFERENCE-SPEC Layout: Menu Left | Logo Center | EN + Search + Account + Cart Right */}
      <div className="grid grid-cols-3 items-center max-w-[1900px] mx-auto px-4 sm:px-8 h-16 sm:h-20 select-none">
        
        {/* LEFT: Navigation Menu Drawer Toggle & Mobile Search */}
        <div className="flex items-center justify-start space-x-1 sm:space-x-0">
          <button
            type="button"
            onClick={onOpenMenu}
            aria-label="Open Navigation Menu"
            className={`p-2 focus-visible:outline-2 focus-visible:outline-offset-2 rounded-none transition-opacity duration-default ${
              isTransparent
                ? 'text-white hover:opacity-75 focus-visible:outline-white'
                : 'text-[#2D2D2D] hover:opacity-50 focus-visible:outline-black'
            }`}
          >
            <img
              src={BRAND_CONFIG.icons.menu}
              alt=""
              aria-hidden="true"
              className={`w-5 h-5 object-contain transition-all duration-default ${
                isTransparent ? 'brightness-0 invert' : ''
              }`}
              width={20}
              height={20}
              decoding="async"
            />
          </button>

          {/* Search Trigger for Mobile (Sorvea Layout) */}
          <button
            type="button"
            onClick={onOpenSearch}
            aria-label="Search Catalog"
            className={`sm:hidden p-2 focus-visible:outline-2 focus-visible:outline-offset-2 rounded-none transition-opacity duration-default ${
              isTransparent
                ? 'text-white hover:opacity-75 focus-visible:outline-white'
                : 'text-[#2D2D2D] hover:opacity-50 focus-visible:outline-black'
            }`}
          >
            <img
              src={BRAND_CONFIG.icons.search}
              alt=""
              aria-hidden="true"
              className={`w-5 h-5 object-contain transition-all duration-default ${
                isTransparent ? 'brightness-0 invert' : ''
              }`}
              width={20}
              height={20}
              decoding="async"
            />
          </button>
        </div>

        {/* CENTER: Centered Logo with Light/Dark Transition */}
        <div className="flex items-center justify-center">
          <Link
            to="/"
            className="group flex items-center justify-center py-2 focus-visible:outline-2 focus-visible:outline-offset-2 rounded-none"
            aria-label={BRAND_CONFIG.name}
          >
            <div className="relative flex items-center justify-center h-8 sm:h-10 w-20 sm:w-[130px]">
              {/* Light logo variant (active when transparent over dark hero, mix-blend-screen to remove black bg) */}
              <img
                src={BRAND_CONFIG.logo.light}
                alt={BRAND_CONFIG.logo.alt}
                className={`h-8 sm:h-10 max-w-[80px] sm:max-w-[130px] w-auto object-contain mix-blend-screen transition-opacity duration-default absolute inset-0 mx-auto ${
                  isTransparent ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
                width={130}
                height={40}
                decoding="async"
              />

              {/* Dark logo variant (active when solid scrolled or on interior pages, mix-blend-multiply to remove white bg) */}
              <img
                src={BRAND_CONFIG.logo.dark}
                alt={BRAND_CONFIG.logo.alt}
                className={`h-8 sm:h-10 max-w-[80px] sm:max-w-[130px] w-auto object-contain mix-blend-multiply transition-opacity duration-default ${
                  isTransparent ? 'opacity-0 pointer-events-none' : 'opacity-100'
                }`}
                width={130}
                height={40}
                decoding="async"
              />
            </div>
          </Link>
        </div>

        {/* RIGHT: Search (Desktop), Profile, and Cart Drawer */}
        <div className="flex items-center justify-end space-x-2 sm:space-x-5">
          {/* 1. Search Trigger (Desktop) */}
          <button
            type="button"
            onClick={onOpenSearch}
            aria-label="Search Catalog"
            className={`hidden sm:block p-2 focus-visible:outline-2 focus-visible:outline-offset-2 rounded-none transition-opacity duration-default ${
              isTransparent
                ? 'text-white hover:opacity-75 focus-visible:outline-white'
                : 'text-[#2D2D2D] hover:opacity-50 focus-visible:outline-black'
            }`}
          >
            <img
              src={BRAND_CONFIG.icons.search}
              alt=""
              aria-hidden="true"
              className={`w-5 h-5 object-contain transition-all duration-default ${
                isTransparent ? 'brightness-0 invert' : ''
              }`}
              width={20}
              height={20}
              decoding="async"
            />
          </button>

          {/* 2. User Account / Profile */}
          <button
            type="button"
            onClick={handleProfileClick}
            aria-label={isLoggedIn ? "User Account (Signed in)" : "Sign In to Account"}
            className={`p-2 focus-visible:outline-2 focus-visible:outline-offset-2 rounded-none relative transition-opacity duration-default ${
              isTransparent
                ? 'text-white hover:opacity-75 focus-visible:outline-white'
                : 'text-[#111111] hover:opacity-50 focus-visible:outline-black'
            }`}
          >
            <img
              src={BRAND_CONFIG.icons.user}
              alt=""
              aria-hidden="true"
              className={`w-5 h-5 object-contain transition-all duration-default ${
                isTransparent ? 'brightness-0 invert' : ''
              }`}
              width={20}
              height={20}
              decoding="async"
            />
          </button>

          {/* 3. Shopping Bag Cart Trigger */}
          <button
            type="button"
            onClick={() => setIsCartOpen(true)}
            aria-label={`Shopping Bag, ${totalItems} ${totalItems === 1 ? 'item' : 'items'}`}
            className={`p-2 relative focus-visible:outline-2 focus-visible:outline-offset-2 rounded-none transition-all duration-default ${
              isTransparent
                ? 'text-white hover:opacity-75 focus-visible:outline-white'
                : 'text-[#2D2D2D] hover:opacity-50 focus-visible:outline-black'
            } ${isCartBouncing ? 'animate-cart-bounce' : ''}`}
          >
            <img
              src={BRAND_CONFIG.icons.cart}
              alt=""
              aria-hidden="true"
              className={`w-5 h-5 object-contain transition-all duration-default ${
                isTransparent ? 'brightness-0 invert' : ''
              }`}
              width={20}
              height={20}
              decoding="async"
            />
            {totalItems > 0 && (
              <span
                aria-hidden="true"
                className={`absolute -top-1 -right-1 text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center transition-transform duration-default ${
                  isTransparent
                    ? 'bg-white text-black ring-1 ring-black/20'
                    : 'bg-black text-white'
                } ${isCartBouncing ? 'scale-125 ring-2 ring-black ring-offset-1' : 'scale-100'}`}
              >
                {totalItems}
              </span>
            )}
          </button>
        </div>

      </div>
    </header>
  );
};
