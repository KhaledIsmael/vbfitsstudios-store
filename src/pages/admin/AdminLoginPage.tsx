import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { ShieldCheck, Lock, Mail, ArrowRight, AlertCircle } from 'lucide-react';

export const AdminLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, adminUser, isAdmin } = useAdminAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // If already authenticated as admin, redirect directly into the dashboard
  useEffect(() => {
    if (adminUser && isAdmin) {
      const destination = location.state?.from?.pathname || '/admin';
      navigate(destination, { replace: true });
    }
  }, [adminUser, isAdmin, navigate, location.state]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      const res = await login(email, password);
      if (res.error) {
        setErrorMsg(res.error);
        setLoading(false);
        return;
      }

      const destination = location.state?.from?.pathname || '/admin';
      navigate(destination, { replace: true });
    } catch (err: any) {
      setErrorMsg(err.message || 'فشل تسجيل الدخول. يرجى مراجعة البريد وكلمة المرور.');
      setLoading(false);
    }
  };

  const fillDemoAdmin = () => {
    setEmail('admin@vbfitsstudios.com');
    setPassword('Admin@VB2026!');
  };

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-[#090A0F] text-white flex flex-col justify-between px-4 sm:px-6 py-8 selection:bg-amber-400 selection:text-black font-sans"
    >
      {/* Top Bar */}
      <div className="max-w-6xl mx-auto w-full flex items-center justify-between text-xs">
        <Link
          to="/"
          className="text-slate-400 hover:text-white transition-colors flex items-center gap-1.5 text-xs font-medium"
        >
          <ArrowRight className="w-3.5 h-3.5" />
          <span>الرجوع للمتجر</span>
        </Link>
        <span className="text-[10px] font-mono uppercase text-slate-500 tracking-wider">
          ISOLATED BACKOFFICE PROTOCOL // v2.5
        </span>
      </div>

      {/* Main Card */}
      <div className="w-full max-w-md mx-auto my-auto py-8">
        <div className="border border-white/10 bg-[#12131A] p-7 sm:p-9 shadow-2xl rounded-2xl relative overflow-hidden backdrop-blur-xl">
          {/* Subtle top amber glow */}
          <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600" />

          {/* Header */}
          <div className="text-center space-y-2 mb-7 border-b border-white/10 pb-6">
            <div className="w-12 h-12 mx-auto rounded-xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center text-amber-400 mb-3 shadow-inner">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              لوحة تحكم VB FITS STUDIOS
            </h1>
            <p className="text-xs text-slate-400">
              تسجيل دخول فريق الإدارة (معزول تماماً عن حسابات المتجر)
            </p>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="mb-5 p-3.5 bg-red-950/40 border border-red-500/40 text-red-200 text-xs rounded-xl flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="leading-relaxed">{errorMsg}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-amber-400" />
                <span>البريد الإلكتروني للإدارة</span>
              </label>
              <input
                type="email"
                required
                dir="ltr"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@vbfitsstudios.com"
                className="w-full bg-[#1A1B24] border border-white/10 focus:border-amber-400 text-white placeholder-slate-500 px-3.5 py-2.5 rounded-xl text-sm focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>كلمة المرور الإدارية</span>
              </label>
              <input
                type="password"
                required
                dir="ltr"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-[#1A1B24] border border-white/10 focus:border-amber-400 text-white placeholder-slate-500 px-3.5 py-2.5 rounded-xl text-sm focus:outline-none transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold py-3 px-4 rounded-xl text-sm transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>جارٍ التحقق وتأكيد الجلسة...</span>
                </>
              ) : (
                <span>دخول لوحة الإدارة</span>
              )}
            </button>
          </form>

          {/* Quick Demo Helper */}
          <div className="mt-6 pt-5 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
            <span>تجربة النظام:</span>
            <button
              type="button"
              onClick={fillDemoAdmin}
              className="text-amber-400 hover:text-amber-300 font-semibold underline underline-offset-2 transition-colors"
            >
              تعبئة بيانات الأدمن الافتراضية
            </button>
          </div>
        </div>
      </div>

      {/* Footer info */}
      <div className="max-w-6xl mx-auto w-full text-center text-[11px] text-slate-600">
        <span>© 2026 VB Fits Studios · جلسات الإدارة منفصلة تماماً ومؤمنة بالتشفير</span>
      </div>
    </div>
  );
};
