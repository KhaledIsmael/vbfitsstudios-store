import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import {
  Package,
  ShoppingBag,
  Megaphone,
  LogOut,
  ExternalLink,
  Menu,
  X,
  LayoutDashboard,
  Truck,
  Sparkles
} from 'lucide-react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { AdminInfoTooltip } from './AdminInfoTooltip';

const NAV_ITEMS = [
  {
    label: 'الرئيسية والمبيعات',
    sublabel: 'أداء اليوم والأرباح',
    path: '/admin',
    exact: true,
    icon: LayoutDashboard,
    tooltipTitle: 'لوحة التحكم الرئيسية',
    tooltipDesc: 'هنا بتشوف ملخص سريع لمبيعات اليوم، عدد الطلبات الجديدة، وأي منتج قرب يخلص من المخزن عشان تلحق تعمل منه ريستوك.'
  },
  {
    label: 'الطلبات والشحن',
    sublabel: 'تجهيز وتوصيل الأوردرات',
    path: '/admin/orders',
    icon: ShoppingBag,
    tooltipTitle: 'إدارة طلبات الزبائن',
    tooltipDesc: 'كل أوردر بيدخل متجرك بتلاقيه هنا بالتفصيل (اسم العميل، رقمه، عنوانه، مقاساته)، وتقدر تغير حالة الطلب (تم التجهيز، مع المندوب، تم التوصيل) وتطبع بوليصة الشحن.'
  },
  {
    label: 'المنتجات والمخزون',
    sublabel: 'الملابس والمقاسات والصور',
    path: '/admin/products',
    icon: Package,
    tooltipTitle: 'كتالوج المنتجات والمخزن',
    tooltipDesc: 'ضيف دروب جديد لبراندك، حدد الأسعار بالجنيه المصري، ارفع صور السيشن، وحدد الكميات المتاحة من كل مقاس (S, M, L, XL).'
  },
  {
    label: 'العروض وكوبونات الخصم',
    sublabel: 'البروموكود وإعلانات المتجر',
    path: '/admin/marketing',
    icon: Megaphone,
    tooltipTitle: 'الخصومات وشريط الإعلانات',
    tooltipDesc: 'اعمل أكواد خصم للإنفلونسرز وعملاء الـ VIP (نسبة مئوية أو رقم ثابت بالجنيه)، وعدل النص اللي بيظهر في الشريط الأسود أعلى المتجر لايف بلحظة.'
  },
  {
    label: 'تكاليف ومناطق الشحن',
    sublabel: 'أسعار المحافظات والدفع',
    path: '/admin/shipping',
    icon: Truck,
    tooltipTitle: 'إعدادات الشحن المصري',
    tooltipDesc: 'حدد مصاريف الشحن لكل محافظة (القاهرة، الجيزة، الإسكندرية، باقي المحافظات)، وشغل أو وقف الدفع عند الاستلام (COD) حسب رغبتك.'
  }
];

export const AdminLayout: React.FC = () => {
  const { adminUser, logout } = useAdminAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const handleSignOut = async () => {
    await logout();
    navigate('/admin/login', { replace: true });
  };

  // Determine current active page title from route
  const currentNav =
    NAV_ITEMS.find((item) =>
      item.exact
        ? location.pathname === '/admin' || location.pathname === '/admin/'
        : location.pathname.startsWith(item.path)
    ) || NAV_ITEMS[0];

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-[#F8FAFC] text-slate-800 flex flex-col md:flex-row antialiased selection:bg-amber-400 selection:text-black font-sans"
    >
      {/* ───────────────────────────────────────────────────────────── */}
      {/* RIGHT SIDEBAR (Desktop: sticky, Mobile: slide-over overlay)   */}
      {/* ───────────────────────────────────────────────────────────── */}
      <aside
        className={`fixed md:sticky top-0 right-0 h-screen z-40 w-72 bg-[#0F172A] border-l border-slate-800 text-white flex flex-col justify-between transition-transform duration-300 shadow-xl md:translate-x-0 ${
          mobileNavOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'
        }`}
      >
        <div>
          {/* Atelier Brand Header */}
          <div className="h-20 px-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
            <div>
              <Link to="/admin" className="block text-right group">
                <span className="text-sm font-extrabold tracking-wider uppercase text-white block group-hover:text-amber-400 transition-colors">
                  VB FITS STUDIOS
                </span>
                <span className="text-[10px] font-mono tracking-widest text-amber-400 block mt-0.5">
                  لوحة تحكم البراند · الإدارة
                </span>
              </Link>
            </div>
            {/* Mobile close button */}
            <button
              type="button"
              onClick={() => setMobileNavOpen(false)}
              className="md:hidden text-slate-400 hover:text-white p-1"
              aria-label="إغلاق القائمة"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1.5">
            <div className="px-3 pb-2 pt-2 flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span>أقسام المتجر الأساسية</span>
              <AdminInfoTooltip
                title="أقسام لوحة التحكم"
                description="تم تبسيط هذه الأقسام لتناسب إدارة براند ملابس محلي في مصر بكل سهولة بدون أي تعقيدات غير لازمة."
                align="left"
              />
            </div>

            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = item.exact
                ? location.pathname === '/admin' || location.pathname === '/admin/'
                : location.pathname.startsWith(item.path);

              return (
                <div key={item.path} className="relative flex items-center group">
                  <NavLink
                    to={item.path}
                    onClick={() => setMobileNavOpen(false)}
                    className={`flex-1 flex items-center justify-between px-3.5 py-3 rounded-lg text-xs transition-all duration-200 ${
                      isActive
                        ? 'bg-amber-400 text-slate-950 font-bold shadow-md shadow-amber-400/20'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-slate-950' : 'text-amber-400'}`} />
                      <div className="text-right">
                        <span className="block leading-tight text-[13px]">{item.label}</span>
                        <span
                          className={`block text-[10px] mt-0.5 font-normal ${
                            isActive ? 'text-slate-900 font-medium' : 'text-slate-400'
                          }`}
                        >
                          {item.sublabel}
                        </span>
                      </div>
                    </div>
                  </NavLink>

                  <div className="mr-2">
                    <AdminInfoTooltip
                      title={item.tooltipTitle}
                      description={item.tooltipDesc}
                      align="left"
                    />
                  </div>
                </div>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-slate-800 space-y-3 bg-slate-950/40">
          <div className="px-3 py-2.5 bg-emerald-950/40 border border-emerald-500/30 rounded-lg flex items-center justify-between">
            <span className="text-[11px] font-medium text-emerald-300">مزامنة المتجر لايف</span>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-mono text-emerald-400 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              قاعدة البيانات متصلة
            </span>
          </div>

          <div className="px-3 flex items-center justify-between text-[10px] font-mono text-slate-400">
            <span>VB FITS CORE</span>
            <span className="text-slate-300 font-bold">EGP EDITION</span>
          </div>
        </div>
      </aside>

      {/* Backdrop for mobile drawer */}
      {mobileNavOpen && (
        <div
          onClick={() => setMobileNavOpen(false)}
          className="fixed inset-0 bg-slate-900/60 z-30 md:hidden backdrop-blur-xs animate-fade-in"
        />
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MAIN CONTAINER (Top Bar + Outlet Content)                     */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* TOP BAR */}
        <header className="h-16 sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-slate-200 px-4 sm:px-8 flex items-center justify-between shadow-2xs">
          {/* Left: Mobile Toggle & Page Title */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="md:hidden text-slate-600 hover:text-slate-900 p-1.5 rounded-lg hover:bg-slate-100"
              aria-label="فتح القائمة"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-xs font-medium">
              <span className="text-slate-400 hidden sm:inline">لوحة الإدارة</span>
              <span className="text-slate-300 hidden sm:inline">/</span>
              <span className="text-slate-900 font-bold text-sm sm:text-base">{currentNav.label}</span>
              <AdminInfoTooltip
                title={currentNav.tooltipTitle}
                description={currentNav.tooltipDesc}
                align="right"
              />
            </div>
          </div>

          {/* Right: Storefront Link, Admin Badge & Sign-Out */}
          <div className="flex items-center gap-2.5 sm:gap-4">
            {/* Quick link to live storefront */}
            <Link
              to="/"
              target="_blank"
              rel="noopener noreferrer"
              title="معاينة المتجر المباشر للزبائن"
              className="flex items-center gap-1.5 text-xs text-slate-700 hover:text-slate-950 bg-slate-100 hover:bg-slate-200 border border-slate-200 px-3 py-1.5 rounded-lg transition-all font-medium shadow-2xs"
            >
              <ExternalLink className="w-3.5 h-3.5 text-amber-600" />
              <span className="hidden sm:inline">معاينة المتجر</span>
            </Link>

            {/* Admin identity pill */}
            <div className="flex items-center gap-2.5 border-r border-slate-200 pr-2.5 sm:pr-4">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-xs font-bold text-slate-950 shadow-xs">
                {adminUser?.name ? adminUser.name.charAt(0).toUpperCase() : 'A'}
              </div>
              <div className="hidden lg:block text-right">
                <p className="text-xs font-bold text-slate-900 truncate max-w-[130px]">
                  {adminUser?.name || 'مدير المتجر'}
                </p>
                <div className="flex items-center gap-1.5 justify-end">
                  <span className="text-[10px] text-amber-600 font-bold">
                    {adminUser?.role === 'admin' ? 'مدير عام' : 'فريق الدعم'}
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                </div>
              </div>
            </div>

            {/* Sign-Out Button */}
            <button
              type="button"
              onClick={handleSignOut}
              title="تسجيل الخروج من لوحة التحكم"
              className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-red-600 transition-colors border border-slate-200 px-2.5 sm:px-3 py-1.5 rounded-lg hover:border-red-300 hover:bg-red-50"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline font-medium">خروج</span>
            </button>
          </div>
        </header>

        {/* MAIN OUTLET CONTENT */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1720px] w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
