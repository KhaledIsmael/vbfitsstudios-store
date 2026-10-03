import React, { useState, useEffect, Suspense } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { lazyWithRetry } from './lib/lazyWithRetry';
import { BrowserRouter, Routes, Route, useLocation, Outlet } from 'react-router-dom';
import { CartProvider } from './context/CartContext';
import { AuthProvider } from './context/AuthContext';
import { AdminAuthProvider } from './context/AdminAuthContext';

// Core layout chrome (loaded eagerly for instant shell)
import { Navbar } from './components/layout/Navbar';
import { Footer } from './components/layout/Footer';
import { CartDrawer } from './components/drawers/CartDrawer';
import { MenuDrawer } from './components/drawers/MenuDrawer';
import { SearchOverlay } from './components/drawers/SearchOverlay';
import { FloatingChatWidget } from './components/chat/FloatingChatWidget';

import { CookieConsent } from './components/ui/CookieConsent';
import { trackPageView } from './lib/analytics';
import { LaunchCountdownGate } from './components/brand/LaunchCountdownGate';
import { QaPreviewBanner } from './components/brand/QaPreviewBanner';
import { BrandSplashScreen } from './components/brand/BrandSplashScreen';
import {
  getSiteSettings,
  calculateCountdown,
  isPastGate,
  type SiteSettings,
  DEFAULT_SITE_SETTINGS,
  LOCAL_SETTINGS_KEY
} from './lib/siteSettings';

// Primary Landing Page
import { LandingPage } from './pages/LandingPage';

// Code-split storefront routes with lazyWithRetry
const ShopPage = lazyWithRetry(() => import('./pages/ShopPage').then(m => ({ default: m.ShopPage })));
const ProductDetailPage = lazyWithRetry(() => import('./pages/ProductDetailPage').then(m => ({ default: m.ProductDetailPage })));
const LoginPage = lazyWithRetry(() => import('./pages/AuthPages').then(m => ({ default: m.LoginPage })));
const RegisterPage = lazyWithRetry(() => import('./pages/AuthPages').then(m => ({ default: m.RegisterPage })));
const ForgotPasswordPage = lazyWithRetry(() => import('./pages/AuthPages').then(m => ({ default: m.ForgotPasswordPage })));
const ProfilePage = lazyWithRetry(() => import('./pages/ProfilePage').then(m => ({ default: m.ProfilePage })));
const CheckoutPage = lazyWithRetry(() => import('./pages/CheckoutPage').then(m => ({ default: m.CheckoutPage })));
const OrderConfirmationPage = lazyWithRetry(() => import('./pages/OrderConfirmationPage').then(m => ({ default: m.OrderConfirmationPage })));
const PaymentCallbackPage = lazyWithRetry(() => import('./pages/PaymentCallbackPage').then(m => ({ default: m.PaymentCallbackPage })));
const OrderTrackPage = lazyWithRetry(() => import('./pages/OrderTrackPage').then(m => ({ default: m.OrderTrackPage })));
const TrackOrderPage = lazyWithRetry(() => import('./pages/TrackOrderPage').then(m => ({ default: m.TrackOrderPage })));
const CollectionsPage = lazyWithRetry(() => import('./pages/StaticPages').then(m => ({ default: m.CollectionsPage })));
const AboutPage = lazyWithRetry(() => import('./pages/StaticPages').then(m => ({ default: m.AboutPage })));
const ContactPage = lazyWithRetry(() => import('./pages/StaticPages').then(m => ({ default: m.ContactPage })));
const PoliciesPage = lazyWithRetry(() => import('./pages/StaticPages').then(m => ({ default: m.PoliciesPage })));
const VerifyPage = lazyWithRetry(() => import('./pages/VerifyPage').then(m => ({ default: m.VerifyPage })));
const AuthCallbackPage = lazyWithRetry(() => import('./pages/AuthCallbackPage').then(m => ({ default: m.AuthCallbackPage })));

// Code-split backoffice admin routes (loaded on-demand only when visiting /admin)
const AdminLoginPage = lazyWithRetry(() => import('./pages/admin/AdminLoginPage').then(m => ({ default: m.AdminLoginPage })));
const AdminRouteGuard = lazyWithRetry(() => import('./components/admin/AdminRouteGuard').then(m => ({ default: m.AdminRouteGuard })));
const AdminLayout = lazyWithRetry(() => import('./components/admin/AdminLayout').then(m => ({ default: m.AdminLayout })));
const AdminOverviewPage = lazyWithRetry(() => import('./pages/admin/AdminOverviewPage').then(m => ({ default: m.AdminOverviewPage })));
const AdminProductsPage = lazyWithRetry(() => import('./pages/admin/AdminProductsPage').then(m => ({ default: m.AdminProductsPage })));
const AdminInventoryPage = lazyWithRetry(() => import('./pages/admin/AdminInventoryPage').then(m => ({ default: m.AdminInventoryPage })));
const AdminOrdersPage = lazyWithRetry(() => import('./pages/admin/AdminOrdersPage').then(m => ({ default: m.AdminOrdersPage })));
const AdminReturnsPage = lazyWithRetry(() => import('./pages/admin/AdminReturnsPage').then(m => ({ default: m.AdminReturnsPage })));
const AdminCustomersPage = lazyWithRetry(() => import('./pages/admin/AdminCustomersPage').then(m => ({ default: m.AdminCustomersPage })));
const AdminMarketingPage = lazyWithRetry(() => import('./pages/admin/AdminMarketingPage').then(m => ({ default: m.AdminMarketingPage })));
const AdminAnalyticsPage = lazyWithRetry(() => import('./pages/admin/AdminAnalyticsPage').then(m => ({ default: m.AdminAnalyticsPage })));
const AdminShippingPage = lazyWithRetry(() => import('./pages/admin/AdminShippingPage').then(m => ({ default: m.AdminShippingPage })));
const AdminChatbotPage = lazyWithRetry(() => import('./pages/admin/AdminChatbotPage').then(m => ({ default: m.AdminChatbotPage })));

// Scroll to top on route change + fire analytics page_view
const ScrollToTop: React.FC = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
    trackPageView(pathname);
  }, [pathname]);
  return null;
};

// Luxury Minimalist Route Loading Fallback
const RouteLoadingFallback: React.FC = () => (
  <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-4 bg-white select-none">
    <img
      src="/assets/logo/logo-dark.png"
      alt="VB FITS STUDIOS"
      className="w-48 sm:w-56 h-auto object-contain animate-pulse"
      width={220}
      height={55}
    />
  </div>
);

// Storefront Chrome (Navbar, Footers, Cart & Menu Drawers)
const StorefrontLayout: React.FC = () => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [siteSettings, setSiteSettings] = useState<SiteSettings>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem(LOCAL_SETTINGS_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && parsed.launch_at) return { ...DEFAULT_SITE_SETTINGS, ...parsed };
        }
      } catch {}
    }
    return DEFAULT_SITE_SETTINGS;
  });
  const [bypassed, setBypassed] = useState<boolean>(() => isPastGate());
  const location = useLocation();

  // Close overlays on navigation
  useEffect(() => {
    setIsSearchOpen(false);
    setIsMenuOpen(false);
  }, [location.pathname]);

  // Load site settings and subscribe to live changes and past_gate toggle
  useEffect(() => {
    getSiteSettings().then(setSiteSettings);

    const handleSettingsChanged = (e: any) => {
      if (e?.detail) setSiteSettings(e.detail);
    };
    const handlePastGateChanged = (e: any) => {
      setBypassed(!!e?.detail?.bypassed);
    };

    window.addEventListener('vbfits_site_settings_changed', handleSettingsChanged);
    window.addEventListener('vbfits_past_gate_changed', handlePastGateChanged);

    return () => {
      window.removeEventListener('vbfits_site_settings_changed', handleSettingsChanged);
      window.removeEventListener('vbfits_past_gate_changed', handlePastGateChanged);
    };
  }, []);

  // Determine if launch gate should render:
  // 1. launch_at has NOT passed yet
  const remaining = calculateCountdown(siteSettings.launch_at);
  const isGateActive = siteSettings.countdown_gate_enabled ?? siteSettings.gate_enabled ?? true;
  const showGate = !bypassed && isGateActive;

  // Checkout has its own self-contained header — suppress global chrome
  const isCheckout = location.pathname === '/checkout';

  return (
    <div className="flex flex-col min-h-screen bg-white text-[#111111] selection:bg-black selection:text-white">
      {/* Brand Splash Screen on Initial Load */}
      <BrandSplashScreen />

      {/* 1. Full-screen pre-launch countdown gate */}
      {showGate && (
        <LaunchCountdownGate
          settings={siteSettings}
          onBypass={() => setBypassed(true)}
        />
      )}

      {/* 2. Admin QA Preview Status Banner (when gate is bypassed for testing) */}
      <QaPreviewBanner
        settings={siteSettings}
        onResetGate={() => setBypassed(false)}
      />

      {/* Skip to Main Content (WCAG 2.4.1 Bypass Blocks) */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2.5 focus:bg-black focus:text-white focus:text-xs focus:uppercase focus:tracking-luxury focus:outline-none focus:ring-2 focus:ring-white shadow-xl"
      >
        Skip to main content
      </a>

      {/* Global Navigation — hidden on checkout */}
      {!isCheckout && (
        <Navbar
          onOpenSearch={() => setIsSearchOpen(true)}
          onOpenMenu={() => setIsMenuOpen(true)}
        />
      )}

      {/* Global Slide Drawers & Modals */}
      <CartDrawer />
      <MenuDrawer isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
      <SearchOverlay isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
      {!isCheckout && <FloatingChatWidget />}

      {/* Storefront Page Views with Suspense */}
      <main id="main-content" className="flex-1">
        <ErrorBoundary>
          <Suspense fallback={<RouteLoadingFallback />}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </main>

      {/* Footer — hidden on checkout */}
      {!isCheckout && <Footer />}

    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AdminAuthProvider>
      <AuthProvider>
        <CartProvider>
          <BrowserRouter>
            <ScrollToTop />
            <ErrorBoundary>
              <Suspense fallback={<RouteLoadingFallback />}>
                <Routes>
                {/* 1. Dedicated Admin Staff Login (/admin/login) */}
                <Route path="/admin/login" element={<AdminLoginPage />} />

                {/* 2. Backoffice Shell (/admin/*) — Restricted to role: admin or support */}
                <Route path="/admin" element={<AdminRouteGuard />}>
                  <Route element={<AdminLayout />}>
                    <Route index element={<AdminOverviewPage />} />
                    <Route path="products" element={<AdminProductsPage />} />
                    <Route path="inventory" element={<AdminInventoryPage />} />
                    <Route path="orders" element={<AdminOrdersPage />} />
                    <Route path="returns" element={<AdminReturnsPage />} />
                    <Route path="customers" element={<AdminCustomersPage />} />
                    <Route path="marketing" element={<AdminMarketingPage />} />
                    <Route path="analytics" element={<AdminAnalyticsPage />} />
                    <Route path="shipping" element={<AdminShippingPage />} />
                    <Route path="chatbot" element={<AdminChatbotPage />} />
                  </Route>
                </Route>

                {/* 3. Customer Storefront Layout (Unified Route Tree) */}
                <Route element={<StorefrontLayout />}>
                  <Route path="/" element={<LandingPage />} />
                  <Route path="/shop" element={<ShopPage />} />
                  <Route path="/product/:id" element={<ProductDetailPage />} />
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/register" element={<RegisterPage />} />
                  <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                  <Route path="/auth/callback" element={<AuthCallbackPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/checkout" element={<CheckoutPage />} />
                  <Route path="/order-confirmation" element={<OrderConfirmationPage />} />
                  <Route path="/order-confirmation/:orderId" element={<OrderConfirmationPage />} />
                  <Route path="/orders/:orderId/track" element={<OrderTrackPage />} />
                  <Route path="/track-order" element={<TrackOrderPage />} />
                  <Route path="/payment-callback" element={<PaymentCallbackPage />} />
                  <Route path="/collections" element={<CollectionsPage />} />
                  <Route path="/lookbook" element={<CollectionsPage />} />
                  <Route path="/about" element={<AboutPage />} />
                  <Route path="/contact" element={<ContactPage />} />
                  <Route path="/policies/:type" element={<PoliciesPage />} />
                  <Route path="/verify" element={<VerifyPage />} />
                  <Route path="/authenticate" element={<VerifyPage />} />
                  <Route path="*" element={<ShopPage />} />
                </Route>
              </Routes>
              </Suspense>
            </ErrorBoundary>

            {/* Global GDPR Cookie Consent Banner (mounts once, outside route switching) */}
            <CookieConsent />
          </BrowserRouter>
        </CartProvider>
      </AuthProvider>
    </AdminAuthProvider>
  );
};

export default App;
