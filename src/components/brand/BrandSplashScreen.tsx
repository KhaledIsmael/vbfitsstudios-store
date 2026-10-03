import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export const BrandSplashScreen: React.FC = () => {
  const [showSplash, setShowSplash] = useState(false);

  useEffect(() => {
    const hasSeenSplash = sessionStorage.getItem('vbfits_splash_shown');
    if (!hasSeenSplash) {
      setShowSplash(true);
      
      // Prevent scrolling
      document.body.style.overflow = 'hidden';
      
      // The animation takes about 2.5 seconds total before it unmounts
      const timer = setTimeout(() => {
        setShowSplash(false);
        sessionStorage.setItem('vbfits_splash_shown', 'true');
        document.body.style.overflow = '';
      }, 2500);

      return () => {
        clearTimeout(timer);
        document.body.style.overflow = '';
      };
    }
  }, []);

  return (
    <AnimatePresence>
      {showSplash && (
        <motion.div
          key="splash"
          initial={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: '-10%', transition: { duration: 0.8, ease: [0.76, 0, 0.24, 1] } }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-white"
        >
          <motion.img
            src="/assets/logo/logo-dark.png"
            alt="VB FITS STUDIOS"
            className="w-48 sm:w-64 h-auto object-contain"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.5, ease: "easeOut" }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
};
