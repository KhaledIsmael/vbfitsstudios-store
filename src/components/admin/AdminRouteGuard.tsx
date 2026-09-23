import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAdminAuth } from '../../context/AdminAuthContext';

export const AdminRouteGuard: React.FC = () => {
  const { adminUser, isAdmin, loading } = useAdminAuth();
  const location = useLocation();

  // 1. Loading admin authentication state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0E0E10] flex flex-col items-center justify-center text-white px-6">
        <div className="w-10 h-10 border-2 border-white/20 border-t-amber-400 rounded-full animate-spin mb-4" />
        <p className="text-[11px] uppercase tracking-luxury text-[#AAAAAA] font-mono">
          VB FITS // جارٍ التحقق من صلاحيات الإدارة...
        </p>
      </div>
    );
  }

  // 2. Unauthenticated or not an admin -> redirect to /admin/login (completely isolated from customer storefront)
  if (!adminUser || !isAdmin) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  // 3. Authorized staff member (admin or support) -> allow access to admin console
  return <Outlet />;
};
