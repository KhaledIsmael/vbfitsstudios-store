import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
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

  const handleProfileClick = () => {
    if (isLoggedIn) {
      navigate('/profile');
    } else {
      navigate('/login');
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-white border-b border-[#EAEAEA] transition-all duration-300">
      <AnnouncementBar />
      <div className="max-w-[1720px] mx-auto px-4 sm:px-8 lg:px-12 h-16 sm:h-20 flex items-center justify-between">
        
        {/* Left: Replaceable Brand Logo */}
        <div className="flex items-center">
          <Link to="/" className="group flex items-center gap-3">
            <img
              src={BRAND_CONFIG.logo.src}
              alt={BRAND_CONFIG.logo.alt}
              className="h-8 sm:h-10 w-auto object-contain mix-blend-multiply transition-opacity duration-300 group-hover:opacity-75"
              width={120}
              height={40}
              decoding="async"
            />
          </Link>
        </div>

        {/* Right: Exactly in this order: Search, Profile, Cart, Hamburger Menu */}
        <div className="flex items-center space-x-5 sm:space-x-8">
          {/* 1. Search Icon */}
          <button
            type="button"
            onClick={onOpenSearch}
            aria-label="Search Catalog"
            className="text-[#111111] hover:opacity-50 transition-opacity p-1.5 focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 rounded"
          >
            <img
              src={BRAND_CONFIG.icons.search}
              alt=""
              aria-hidden="true"
              className="w-5 h-5 object-contain"
              width={20}
              height={20}
              decoding="async"
            />
          </button>

          {/* 2. Profile Icon */}
          <button
            type="button"
            onClick={handleProfileClick}
            aria-label={isLoggedIn ? "User Account (Signed in)" : "Sign In to Account"}
            className="text-[#111111] hover:opacity-50 transition-opacity p-1.5 focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 rounded relative"
          >
            <img
              src={BRAND_CONFIG.icons.user}
              alt=""
              aria-hidden="true"
              className="w-5 h-5 object-contain"
              width={20}
              height={20}
              decoding="async"
            />
            {isLoggedIn && (
              <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-black rounded-full ring-2 ring-white"></span>
            )}
          </button>

          {/* 3. Cart Icon */}
          <button
            type="button"
            onClick={() => setIsCartOpen(true)}
            aria-label={`Shopping Bag, ${totalItems} ${totalItems === 1 ? 'item' : 'items'}`}
            className={`text-[#111111] hover:opacity-50 transition-all p-1.5 relative focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 rounded ${
              isCartBouncing ? 'animate-cart-bounce' : ''
            }`}
          >
            <img
              src={BRAND_CONFIG.icons.cart}
              alt=""
              aria-hidden="true"
              className="w-5 h-5 object-contain"
              width={20}
              height={20}
              decoding="async"
            />
            {totalItems > 0 && (
              <span
                aria-hidden="true"
                className={`absolute -top-1 -right-1 bg-black text-white text-[10px] font-medium w-4 h-4 rounded-full flex items-center justify-center transition-transform duration-300 ${
                  isCartBouncing ? 'scale-125 ring-2 ring-black ring-offset-1' : 'scale-100'
                }`}
              >
                {totalItems}
              </span>
            )}
          </button>

          {/* 4. Hamburger Menu Icon */}
          <button
            type="button"
            onClick={onOpenMenu}
            aria-label="Open Navigation Menu"
            className="text-[#111111] hover:opacity-50 transition-opacity p-1.5 focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 rounded"
          >
            <img
              src={BRAND_CONFIG.icons.menu}
              alt=""
              aria-hidden="true"
              className="w-5 h-5 object-contain"
              width={20}
              height={20}
              decoding="async"
            />
          </button>
        </div>

      </div>
    </header>
  );
};
