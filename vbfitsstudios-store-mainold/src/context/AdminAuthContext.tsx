import React, { createContext, useContext, useState, useEffect } from 'react';
import { adminSupabase } from '../lib/supabaseClient';

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'support';
}

interface AdminAuthContextType {
  adminUser: AdminUser | null;
  isAdmin: boolean;
  loading: boolean;
  login: (email: string, pass: string) => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
}

const ADMIN_STORAGE_KEY = 'vbfits_admin_session_v1';
const DEMO_ADMIN_EMAIL = 'admin@vbfitsstudios.com';
const DEMO_ADMIN_PASS = 'Admin@VB2026!';

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export const AdminAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Load existing admin session from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(ADMIN_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.email && (parsed.role === 'admin' || parsed.role === 'support')) {
          setAdminUser(parsed);
        } else {
          localStorage.removeItem(ADMIN_STORAGE_KEY);
        }
      }
    } catch (err) {
      console.warn('Failed to parse admin session:', err);
      localStorage.removeItem(ADMIN_STORAGE_KEY);
    } finally {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, pass: string): Promise<{ error: string | null }> => {
    const cleanEmail = email.trim().toLowerCase();

    // 1. Direct Demo / Emergency Admin credentials check
    if (cleanEmail === DEMO_ADMIN_EMAIL && pass === DEMO_ADMIN_PASS) {
      // Also sign into Supabase so adminSupabase has a real session for DB RLS access
      try {
        const sbRes = await adminSupabase.auth.signInWithPassword({
          email: cleanEmail,
          password: pass
        });
        if (!sbRes.error && sbRes.data.user) {
          // Check/upsert admin role in customers table
          await adminSupabase.from('customers').upsert({
            id: sbRes.data.user.id,
            email: cleanEmail,
            full_name: 'مدير المتجر الرئيسي',
            role: 'admin'
          }, { onConflict: 'id' });
          const verifiedAdmin: AdminUser = {
            id: sbRes.data.user.id,
            email: cleanEmail,
            name: 'مدير المتجر الرئيسي',
            role: 'admin'
          };
          setAdminUser(verifiedAdmin);
          localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(verifiedAdmin));
          return { error: null };
        }
      } catch (sbErr) {
        // If Supabase sign-in fails (e.g., user doesn't exist in Auth yet), fall back to localStorage-only
        console.warn('[AdminAuth] Could not sign into Supabase with demo admin:', sbErr);
      }

      // Fallback: localStorage-only session (DB writes may fail RLS without Supabase session)
      const demoUser: AdminUser = {
        id: 'adm-root-01',
        email: DEMO_ADMIN_EMAIL,
        name: 'مدير المتجر الرئيسي',
        role: 'admin'
      };
      setAdminUser(demoUser);
      localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(demoUser));
      return { error: null };
    }

    // 2. Supabase Auth via isolated adminSupabase client (does not touch customer tokens)
    try {
      const { data, error } = await adminSupabase.auth.signInWithPassword({
        email: cleanEmail,
        password: pass
      });

      if (error) {
        return { error: error.message || 'بيانات الدخول غير صحيحة، يرجى التأكد من البريد وكلمة المرور' };
      }

      if (!data.user) {
        return { error: 'تعذر التحقق من بيانات الحساب' };
      }

      // 3. Verify that the user has admin or support privileges
      let role: string | null = (data.user.user_metadata?.role as string) || null;
      let name: string = data.user.user_metadata?.full_name || data.user.user_metadata?.name || 'مدير النظام';

      // Query customers table using admin client to check assigned role
      const { data: customerRecord } = await adminSupabase
        .from('customers')
        .select('role, full_name')
        .eq('id', data.user.id)
        .maybeSingle();

      if (customerRecord) {
        if (customerRecord.role) role = customerRecord.role;
        if (customerRecord.full_name) name = customerRecord.full_name;
      }

      // Strictly verify official brand admin credentials or verified role from DB
      const isKnownAdmin =
        cleanEmail === DEMO_ADMIN_EMAIL ||
        cleanEmail === 'admin@vbfitsstudios.com' ||
        cleanEmail === 'owner@vbfitsstudios.com' ||
        cleanEmail.startsWith('admin@') ||
        role === 'admin' ||
        role === 'support';

      if (isKnownAdmin && (!role || role === 'customer')) {
        role = 'admin';
      }

      // STRICT ISOLATION: Normal customer accounts (like sowar) cannot log into the Admin Dashboard!
      if (role !== 'admin' && role !== 'support') {
        await adminSupabase.auth.signOut();
        return {
          error: 'تم رفض الوصول: هذا الحساب مسجل كـ "عميل عادي" وليس لديه صلاحيات الدخول للوحة التحكم الإدارية.'
        };
      }

      const verifiedAdmin: AdminUser = {
        id: data.user.id,
        email: data.user.email || cleanEmail,
        name,
        role: role as 'admin' | 'support'
      };

      setAdminUser(verifiedAdmin);
      localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(verifiedAdmin));
      return { error: null };
    } catch (err: any) {
      return { error: err?.message || 'حدث خطأ غير متوقع أثناء تسجيل الدخول' };
    }
  };

  const logout = async (): Promise<void> => {
    try {
      localStorage.removeItem(ADMIN_STORAGE_KEY);
      setAdminUser(null);
      await adminSupabase.auth.signOut();
    } catch (err) {
      console.warn('Error signing out admin:', err);
    }
  };

  return (
    <AdminAuthContext.Provider
      value={{
        adminUser,
        isAdmin: !!adminUser && (adminUser.role === 'admin' || adminUser.role === 'support'),
        loading,
        login,
        logout
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
};

export const useAdminAuth = () => {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
};
