import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth, type CustomerRole } from '../../context/AuthContext';

export const AdminLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, logout, user, role } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // If already logged in as staff, redirect directly to admin
  React.useEffect(() => {
    if (user && (role === 'admin' || role === 'support')) {
      const destination = location.state?.from?.pathname || '/admin';
      navigate(destination, { replace: true });
    }
  }, [user, role, navigate, location.state]);

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

      const assignedRole: CustomerRole = res.role || 'customer';
      if (assignedRole !== 'admin' && assignedRole !== 'support') {
        // Log out immediately so the customer session isn't kept on admin screen
        await logout();
        setErrorMsg('Access Denied: This account lacks administrative credentials (role: customer).');
        setLoading(false);
        return;
      }

      const from = location.state?.from?.pathname || '/admin';
      navigate(from, { replace: true });
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication failed. Please check credentials.');
      setLoading(false);
    }
  };

  const fillDemoAdmin = () => {
    setEmail('admin@vbfitsstudios.com');
    setPassword('Admin@VB2026!');
  };

  return (
    <div className="min-h-screen bg-[#0A0A0C] text-white flex flex-col justify-between px-6 py-12 select-none">
      {/* Top Bar / Brand header */}
      <div className="max-w-6xl mx-auto w-full flex items-center justify-between text-xs tracking-luxury">
        <Link to="/" className="text-white/80 hover:text-white transition-colors flex items-center gap-2">
          <span>←</span>
          <span className="uppercase text-[11px]">Storefront</span>
        </Link>
        <span className="text-[10px] font-mono uppercase text-white/40 tracking-widest">
          SECURITY PROTOCOL // 2.4.0
        </span>
      </div>

      {/* Main Login Card */}
      <div className="w-full max-w-md mx-auto my-auto py-12">
        <div className="border border-white/10 bg-[#121215] p-8 sm:p-10 shadow-2xl backdrop-blur-xl">
          {/* Header */}
          <div className="text-center space-y-2 mb-8 border-b border-white/10 pb-6">
            <span className="text-[10px] uppercase font-mono tracking-luxury text-emerald-400/90 block">
              ● Restricted Access
            </span>
            <h1 className="text-xl sm:text-2xl font-light uppercase tracking-wider text-white">
              VB FITS STUDIOS
            </h1>
            <p className="text-[11px] uppercase tracking-widest text-white/50">
              Atelier Backoffice Console
            </p>
          </div>

          {/* Error notice */}
          {errorMsg && (
            <div className="mb-6 p-3.5 bg-red-950/40 border border-red-500/40 text-red-300 text-xs tracking-wide animate-fade-in flex items-start gap-2.5">
              <span className="text-red-400 flex-shrink-0 font-mono">✕</span>
              <p className="leading-relaxed">{errorMsg}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-white/60 mb-2 font-mono">
                Staff Email Address
              </label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="staff@vbfitsstudios.com"
                className="w-full bg-[#18181D] border border-white/15 px-3.5 py-3 text-xs text-white placeholder-white/20 focus:outline-none focus:border-white transition-colors rounded-none"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-widest text-white/60 mb-2 font-mono">
                Security Password
              </label>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-[#18181D] border border-white/15 px-3.5 py-3 text-xs text-white placeholder-white/20 focus:outline-none focus:border-white transition-colors rounded-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 bg-white text-black hover:bg-white/90 py-3.5 px-4 text-xs uppercase tracking-luxury font-medium transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <span>Authenticate Staff Access</span>
              )}
            </button>
          </form>

          {/* Demo credential helper */}
          <div className="mt-6 pt-6 border-t border-white/10 flex items-center justify-between text-[11px] text-white/40">
            <span>Development Mode</span>
            <button
              type="button"
              onClick={fillDemoAdmin}
              className="underline hover:text-white transition-colors text-[10px] uppercase tracking-wider font-mono"
            >
              Fill Demo Credentials
            </button>
          </div>
        </div>
      </div>

      {/* Footer info */}
      <div className="max-w-6xl mx-auto w-full text-center text-[10px] font-mono text-white/30 uppercase tracking-widest">
        <span>© 2026 VB Fits Studios Backoffice Console · All sessions logged</span>
      </div>
    </div>
  );
};
