import React, { useState, useEffect, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { CartProvider } from './context/CartContext';
import { AuthProvider } from './context/AuthContext';
import { AdminAuthProvider } from './context/AdminAuthContext';

// Core layout chrome (loaded eagerly for instant shell)
import { Navbar } from './components/layout/Navbar';
import { Footer } from './components/layout/Footer';
import { CartDrawer } from './components/drawers/CartDrawer';
import { MenuDrawer } from './components/drawers/MenuDrawer';
import { SearchOverlay } from './components/drawers/SearchOverlay';
import { WhatsAppButton } from './components/ui/WhatsAppButton';
import { CookieConsent } from './components/ui/CookieConsent';
import { trackPageView } from './lib/analytics';

// Primary Landing Page
import { LandingPage } from './pages/LandingPage';

// Code-split storefront routes with React.lazy
const ShopPage = lazy(() => import('./pages/ShopPage').then(m => ({ default: m.ShopPage })));
const ProductDetailPage = lazy(() => import('./pages/ProductDetailPage').then(m => ({ default: m.ProductDetailPage })));
const LoginPage = lazy(() => import('./pages/AuthPages').then(m => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('./pages/AuthPages').then(m => ({ default: m.RegisterPage })));
const ForgotPasswordPage = lazy(() => import('./pages/AuthPages').then(m => ({ default: m.ForgotPasswordPage })));
const ProfilePage = lazy(() => import('./pages/ProfilePage').then(m => ({ default: m.ProfilePage })));
const CheckoutPage = lazy(() => import('./pages/CheckoutPage').then(m => ({ default: m.CheckoutPage })));
const OrderConfirmationPage = lazy(() => import('./pages/OrderConfirmationPage').then(m => ({ default: m.OrderConfirmationPage })));
const PaymentCallbackPage = lazy(() => import('./pages/PaymentCallbackPage').then(m => ({ default: m.PaymentCallbackPage })));
const OrderTrackPage = lazy(() => import('./pages/OrderTrackPage').then(m => ({ default: m.OrderTrackPage })));
const TrackOrderPage = lazy(() => import('./pages/TrackOrderPage').then(m => ({ default: m.TrackOrderPage })));
const CollectionsPage = lazy(() => import('./pages/StaticPages').then(m => ({ default: m.CollectionsPage })));
const AboutPage = lazy(() => import('./pages/StaticPages').then(m => ({ default: m.AboutPage })));
const ContactPage = lazy(() => import('./pages/StaticPages').then(m => ({ default: m.ContactPage })));
const PoliciesPage = lazy(() => import('./pages/StaticPages').then(m => ({ default: m.PoliciesPage })));
const VerifyPage = lazy(() => import('./pages/VerifyPage').then(m => ({ default: m.VerifyPage })));
const AuthCallbackPage = lazy(() => import('./pages/AuthCallbackPage').then(m => ({ default: m.AuthCallbackPage })));

// Code-split backoffice admin routes (loaded on-demand only when visiting /admin)
const AdminLoginPage = lazy(() => import('./pages/admin/AdminLoginPage').then(m => ({ default: m.AdminLoginPage })));
const AdminRouteGuard = lazy(() => import('./components/admin/AdminRouteGuard').then(m => ({ default: m.AdminRouteGuard })));
const AdminLayout = lazy(() => import('./components/admin/AdminLayout').then(m => ({ default: m.AdminLayout })));
const AdminOverviewPage = lazy(() => import('./pages/admin/AdminOverviewPage').then(m => ({ default: m.AdminOverviewPage })));
const AdminProductsPage = lazy(() => import('./pages/admin/AdminProductsPage').then(m => ({ default: m.AdminProductsPage })));
const AdminInventoryPage = lazy(() => import('./pages/admin/AdminInventoryPage').then(m => ({ default: m.AdminInventoryPage })));
const AdminOrdersPage = lazy(() => import('./pages/admin/AdminOrdersPage').then(m => ({ default: m.AdminOrdersPage })));
const AdminReturnsPage = lazy(() => import('./pages/admin/AdminReturnsPage').then(m => ({ default: m.AdminReturnsPage })));
const AdminCustomersPage = lazy(() => import('./pages/admin/AdminCustomersPage').then(m => ({ default: m.AdminCustomersPage })));
const AdminMarketingPage = lazy(() => import('./pages/admin/AdminMarketingPage').then(m => ({ default: m.AdminMarketingPage })));
const AdminAnalyticsPage = lazy(() => import('./pages/admin/AdminAnalyticsPage').then(m => ({ default: m.AdminAnalyticsPage })));
const AdminShippingPage = lazy(() => import('./pages/admin/AdminShippingPage').then(m => ({ default: m.AdminShippingPage })));

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
  const location = useLocation();

  // Close overlays on navigation
  useEffect(() => {
    setIsSearchOpen(false);
    setIsMenuOpen(false);
  }, [location.pathname]);

  // Checkout has its own self-contained header — suppress global chrome
  const isCheckout = location.pathname === '/checkout';

  return (
    <div className="flex flex-col min-h-screen bg-white text-[#111111] selection:bg-black selection:text-white">
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

      {/* Storefront Page Views with Suspense */}
      <main id="main-content" className="flex-1">
        <Suspense fallback={<RouteLoadingFallback />}>
          <Routes>
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
          </Routes>
        </Suspense>
      </main>

      {/* Footer — hidden on checkout */}
      {!isCheckout && <Footer />}

      {/* Floating Concierge WhatsApp Action — hidden on checkout */}
      {!isCheckout && <WhatsAppButton />}
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
                  </Route>
                </Route>

                {/* 3. Customer Storefront (All other routes) */}
                <Route path="/*" element={<StorefrontLayout />} />
              </Routes>
            </Suspense>

            {/* Global GDPR Cookie Consent Banner (mounts once, outside route switching) */}
            <CookieConsent />
          </BrowserRouter>
        </CartProvider>
      </AuthProvider>
    </AdminAuthProvider>
  );
};

export default App;
