import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export const AdminRouteGuard: React.FC = () => {
  const { user, role, loading } = useAuth();
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

  // 3. Authenticated but neither admin nor support -> redirect to storefront (/)
  const hasAccess = role === 'admin' || role === 'support';
  if (!hasAccess) {
    return <Navigate to="/" replace />;
  }

  // 4. Authorized staff member (admin or support) -> allow access
  return <Outlet />;
};
