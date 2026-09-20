import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import {
  Package,
  Boxes,
  ShoppingBag,
  Users,
  Megaphone,
  BarChart3,
  LogOut,
  ExternalLink,
  Menu,
  X,
  ShieldAlert,
  LayoutDashboard,
  RotateCcw,
  Truck
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const NAV_ITEMS = [
  { label: 'Overview', path: '/admin', exact: true, icon: LayoutDashboard },
  { label: 'Products', path: '/admin/products', icon: Package },
  { label: 'Inventory', path: '/admin/inventory', icon: Boxes },
  { label: 'Orders', path: '/admin/orders', icon: ShoppingBag },
  { label: 'Returns', path: '/admin/returns', icon: RotateCcw },
  { label: 'Customers', path: '/admin/customers', icon: Users },
  { label: 'Marketing', path: '/admin/marketing', icon: Megaphone },
  { label: 'Analytics', path: '/admin/analytics', icon: BarChart3 },
  { label: 'Shipping', path: '/admin/shipping', icon: Truck }
];

export const AdminLayout: React.FC = () => {
  const { user, role, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const handleSignOut = async () => {
    await logout();
    navigate('/admin/login', { replace: true });
  };

  // Determine current active page title from route
  const currentNav = NAV_ITEMS.find((item) =>
    location.pathname.startsWith(item.path)
  ) || NAV_ITEMS[0];

  return (
    <div className="min-h-screen bg-[#0E0E10] text-[#EAEAEA] flex flex-col md:flex-row antialiased selection:bg-white selection:text-black">
      {/* ───────────────────────────────────────────────────────────── */}
      {/* LEFT SIDEBAR (Desktop: sticky, Mobile: slide-over overlay)   */}
      {/* ───────────────────────────────────────────────────────────── */}
      <aside
        className={`fixed md:sticky top-0 left-0 h-screen z-50 w-64 bg-[#121215] border-r border-white/10 flex flex-col justify-between transition-transform duration-300 md:translate-x-0 ${
          mobileNavOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div>
          {/* Atelier Brand Header */}
          <div className="h-16 px-6 border-b border-white/10 flex items-center justify-between">
            <div>
              <Link to="/admin" className="block">
                <span className="text-xs font-medium tracking-luxury uppercase text-white">
                  VB Fits Studios
                </span>
                <span className="block text-[9px] font-mono tracking-widest text-white/50 uppercase">
                  Atelier Backoffice
                </span>
              </Link>
            </div>
            {/* Mobile close button */}
            <button
              type="button"
              onClick={() => setMobileNavOpen(false)}
              className="md:hidden text-white/60 hover:text-white p-1"
              aria-label="Close navigation"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1">
            <div className="px-3 pb-2 pt-2">
              <span className="text-[9px] font-mono uppercase tracking-luxury text-white/40">
                Management
              </span>
            </div>
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.exact
                  ? location.pathname === '/admin' || location.pathname === '/admin/'
                  : location.pathname.startsWith(item.path);

              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileNavOpen(false)}
                  className={`flex items-center gap-3 px-3.5 py-2.5 text-xs tracking-wider uppercase transition-all duration-200 ${
                    isActive
                      ? 'bg-white text-black font-medium shadow-sm'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-white/10 space-y-3">
          <div className="px-3 py-2 bg-white/5 border border-white/5 rounded-none flex items-center justify-between">
            <span className="text-[10px] font-mono text-white/60">Live Sync</span>
            <span className="inline-flex items-center gap-1.5 text-[9px] font-mono text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Connected
            </span>
          </div>
          <div className="px-3 flex items-center justify-between text-[9px] font-mono text-white/30 uppercase tracking-wider">
            <span>Atelier OS</span>
            <span>v2.4.0</span>
          </div>
        </div>
      </aside>

      {/* Backdrop for mobile drawer */}
      {mobileNavOpen && (
        <div
          onClick={() => setMobileNavOpen(false)}
          className="fixed inset-0 bg-black/70 z-40 md:hidden backdrop-blur-sm animate-fade-in"
        />
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MAIN CONTAINER (Top Bar + Outlet Content)                     */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* TOP BAR */}
        <header className="h-16 sticky top-0 z-30 bg-[#121215]/90 backdrop-blur-md border-b border-white/10 px-4 sm:px-8 flex items-center justify-between">
          {/* Left: Mobile Toggle & Breadcrumb Title */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="md:hidden text-white/70 hover:text-white p-1"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-xs tracking-wider uppercase font-mono">
              <span className="text-white/40 hidden sm:inline">Backoffice</span>
              <span className="text-white/40 hidden sm:inline">/</span>
              <span className="text-white font-medium">{currentNav.label}</span>
            </div>
          </div>

          {/* Right: Storefront Link, Admin Badge & Sign-Out */}
          <div className="flex items-center gap-4 sm:gap-6">
            {/* Quick link to live storefront */}
            <Link
              to="/"
              target="_blank"
              rel="noopener noreferrer"
              title="Open storefront in new tab"
              className="hidden sm:flex items-center gap-1.5 text-[11px] text-white/60 hover:text-white transition-colors uppercase tracking-wider font-mono border border-white/10 px-2.5 py-1.5 hover:border-white/30"
            >
              <span>Live Store</span>
              <ExternalLink className="w-3 h-3" />
            </Link>

            {/* Admin identity pill */}
            <div className="flex items-center gap-2.5 border-l border-white/10 pl-4 sm:pl-6">
              <div className="w-7 h-7 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-xs font-semibold text-white">
                {user?.name ? user.name.charAt(0).toUpperCase() : 'A'}
              </div>
              <div className="hidden lg:block text-left">
                <p className="text-xs font-medium text-white truncate max-w-[130px]">
                  {user?.name || 'Staff Member'}
                </p>
                <div className="flex items-center gap-1">
                  <span
                    className={`inline-block w-1.5 h-1.5 rounded-full ${
                      role === 'admin' ? 'bg-amber-400' : 'bg-sky-400'
                    }`}
                  />
                  <span className="text-[9px] font-mono uppercase tracking-widest text-white/50">
                    {role || 'Staff'}
                  </span>
                </div>
              </div>
            </div>

            {/* Sign-Out Button */}
            <button
              type="button"
              onClick={handleSignOut}
              title="Sign out from Backoffice"
              className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-white/60 hover:text-red-400 transition-colors border border-white/10 px-3 py-1.5 hover:border-red-500/40"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </header>

        {/* MAIN OUTLET CONTENT */}
        <main className="flex-1 p-4 sm:p-8 lg:p-10 max-w-[1720px] w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
