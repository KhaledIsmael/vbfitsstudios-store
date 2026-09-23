import React from 'react';
import { Navigate, Outlet, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export const AdminRouteGuard: React.FC = () => {
  const { user, role, loading, logout } = useAuth();
  const location = useLocation();

  // 1. While auth state is initializing from Supabase session & customer table
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0E0E10] flex flex-col items-center justify-center text-white px-6">
        <div className="w-10 h-10 border-2 border-white/20 border-t-white rounded-full animate-spin mb-4" />
        <p className="text-[10px] uppercase tracking-luxury text-[#888888] font-mono">
          VB FITS // Backoffice Authorizing...
        </p>
      </div>
    );
  }

  // 2. Unauthenticated -> redirect to /admin/login (store return path)
  if (!user) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  // 3. Authenticated but neither admin nor support -> show informative access guidance
  const hasAccess = role === 'admin' || role === 'support';
  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-[#0B0B0C] text-white flex flex-col items-center justify-center p-6 selection:bg-white selection:text-black">
        <div className="max-w-md w-full border border-white/10 bg-[#121214] p-8 sm:p-10 space-y-6">
          <div className="flex items-center gap-3 border-b border-white/10 pb-4">
            <div className="w-2.5 h-2.5 bg-amber-500 rounded-full animate-pulse" />
            <span className="text-[10px] uppercase font-mono tracking-widest text-[#888888]">
              Security Access Control
            </span>
          </div>

          <div className="space-y-2">
            <h1 className="text-xl uppercase font-light tracking-wider text-white">
              Staff Privileges Required
            </h1>
            <p className="text-xs text-[#999999] leading-relaxed">
              You are currently authenticated as <span className="text-white font-mono">{user.email}</span> with account role <span className="font-mono text-amber-400 font-bold uppercase">{role || 'customer'}</span>. Access to the Admin Backoffice is restricted to authorized personnel.
            </p>
          </div>

          <div className="border border-white/5 bg-black/40 p-4 space-y-2 rounded text-[11px] font-mono text-[#AAAAAA]">
            <p className="text-white font-bold text-[10px] uppercase tracking-wider">
              Grant Admin Access in Supabase:
            </p>
            <p className="text-[#888888] text-[10px]">
              Execute this command in your Supabase SQL Editor:
            </p>
            <pre className="bg-[#1A1A1D] p-2 text-white/90 overflow-x-auto text-[10px] border border-white/10 select-all">
              {`UPDATE customers SET role = 'admin' WHERE email = '${user.email}';`}
            </pre>
            <p className="text-[10px] text-[#777777]">
              Once executed, refresh this page to access the admin dashboard.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Link
              to="/"
              className="flex-1 text-center py-2.5 px-4 bg-white text-black text-xs uppercase font-medium tracking-wider hover:bg-neutral-200 transition-colors"
            >
              Return to Store
            </Link>
            <button
              onClick={() => logout()}
              className="flex-1 py-2.5 px-4 border border-white/20 text-white text-xs uppercase font-medium tracking-wider hover:bg-white/10 transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 4. Authorized staff member (admin or support) -> allow access
  return <Outlet />;
};
