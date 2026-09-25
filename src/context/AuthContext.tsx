import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { Session, User as SupabaseUser } from '@supabase/supabase-js';
import {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  type WishlistProduct
} from '../lib/wishlist';
import { linkPastOrdersToCustomer } from '../lib/orders';
import { PRODUCTS } from '../config/assets';

export interface OrderItem {
  id: string;
  name: string;
  size: string;
  price: number;
  quantity: number;
  image: string;
}

export interface Order {
  id: string;
  date: string;
  status: 'Delivered' | 'In Transit' | 'Processing';
  items: OrderItem[];
  total: number;
  trackingNumber: string;
}

export type CustomerRole = 'customer' | 'support' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar: string;
  memberSince: string;
  orders: Order[];
  savedItems: string[]; // product IDs (derived from wishlistProducts)
  shippingAddress: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  role: CustomerRole;
}

interface AuthContextType {
  user: User | null;
  supabaseUser: SupabaseUser | null;
  session: Session | null;
  role: CustomerRole | null;
  isLoggedIn: boolean;
  loading: boolean;
  /** Full product data for the wishlist (thumbnail, price, slug) */
  wishlistProducts: WishlistProduct[];
  wishlistLoading: boolean;
  login: (email: string, pass: string) => Promise<{ error: string | null; role?: CustomerRole }>;
  register: (
    name: string,
    email: string,
    pass: string,
    phone?: string
  ) => Promise<{ error: string | null; needsEmailConfirmation?: boolean }>;
  updatePhone: (phone: string) => Promise<{ error: string | null }>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
  toggleSaveItem: (productId: string) => void;
  isItemSaved: (productId: string) => boolean;
}

const DEFAULT_ADDRESS = {
  street: "740 Park Avenue, Apt 14B",
  city: "New York",
  state: "NY",
  postalCode: "10021",
  country: "United States"
};

function formatMemberSince(createdAt?: string): string {
  if (!createdAt) return 'Recently';
  try {
    const date = new Date(createdAt);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  } catch {
    return 'Recently';
  }
}

async function fetchCustomerProfile(userIdOrUser: string | SupabaseUser): Promise<{ role: CustomerRole; phone?: string }> {
  try {
    const userId = typeof userIdOrUser === 'string' ? userIdOrUser : userIdOrUser.id;
    const sbUser = typeof userIdOrUser === 'object' ? userIdOrUser : null;

    const { data, error } = await supabase
      .from('customers')
      .select('role, phone')
      .eq('id', userId)
      .maybeSingle();

    if (!error && data) {
      const assignedRole = (data.role && ['customer', 'support', 'admin'].includes(data.role))
        ? (data.role as CustomerRole)
        : 'customer';
      return { role: assignedRole, phone: data.phone || undefined };
    }

    // Auto-create customers record if missing (e.g. OAuth or new email signup)
    if (sbUser) {
      const metadata = sbUser.user_metadata || {};
      const rawName = metadata.full_name || metadata.name || (sbUser.email ? sbUser.email.split('@')[0] : 'Client');
      
      // Strictly isolate customer accounts from admin roles.
      // Only explicit admin metadata or official admin emails can have admin privileges.
      const isAdminIdent = 
        metadata.role === 'admin' ||
        metadata.role === 'support' ||
        (sbUser.email && (sbUser.email.toLowerCase() === 'admin@vbfitsstudios.com' || sbUser.email.toLowerCase() === 'owner@vbfitsstudios.com'));

      const initialRole: CustomerRole = isAdminIdent ? 'admin' : ((metadata.role as CustomerRole) || 'customer');

      const { data: created } = await supabase
        .from('customers')
        .upsert(
          {
            id: sbUser.id,
            email: sbUser.email || '',
            full_name: rawName,
            phone: metadata.phone || sbUser.phone || null,
            role: initialRole
          },
          { onConflict: 'id' }
        )
        .select('role, phone')
        .maybeSingle();

      if (created) {
        return {
          role: (created.role && ['customer', 'support', 'admin'].includes(created.role))
            ? (created.role as CustomerRole)
            : initialRole,
          phone: created.phone || undefined
        };
      }
    }
  } catch (err) {
    console.warn('Could not fetch or auto-create customer profile:', err);
  }
  return { role: 'customer' };
}

function mapSupabaseUserToAppUser(
  sbUser: SupabaseUser,
  savedIds: string[] = [],
  role?: CustomerRole,
  livePhone?: string
): User {
  const metadata = sbUser.user_metadata || {};
  const rawName =
    metadata.full_name ||
    metadata.name ||
    (sbUser.email ? sbUser.email.split('@')[0].replace(/[._]/g, ' ') : 'Private Client');

  const resolvedPhone = livePhone || metadata.phone || sbUser.phone || '';

  return {
    id: sbUser.id,
    name: typeof rawName === 'string' ? rawName.toUpperCase() : String(rawName),
    email: sbUser.email || '',
    phone: typeof resolvedPhone === 'string' ? resolvedPhone : String(resolvedPhone),
    avatar:
      metadata.avatar_url ||
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
    memberSince: formatMemberSince(sbUser.created_at),
    orders: metadata.orders || [],
    savedItems: savedIds,
    shippingAddress: metadata.shipping_address || DEFAULT_ADDRESS,
    role: role || (metadata.role as CustomerRole) || 'customer'
  };
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
const GUEST_WISHLIST_KEY = 'vbfits_guest_wishlist';

function getLocalGuestWishlist(): WishlistProduct[] {
  try {
    const raw = localStorage.getItem(GUEST_WISHLIST_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setLocalGuestWishlist(items: WishlistProduct[]) {
  try {
    localStorage.setItem(GUEST_WISHLIST_KEY, JSON.stringify(items));
  } catch {}
}

  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Wishlist state: full product objects (for Profile grid)
  const [wishlistProducts, setWishlistProducts] = useState<WishlistProduct[]>([]);
  const [wishlistLoading, setWishlistLoading] = useState(false);

  // Derived set of saved product IDs and slugs for O(1) isItemSaved lookups
  const savedIdSet = useMemo(() => {
    const set = new Set<string>();
    wishlistProducts.forEach((w) => {
      if (w.productId) set.add(w.productId);
      if (w.slug) set.add(w.slug);
    });
    return set;
  }, [wishlistProducts]);

  // ── Load wishlist from Supabase or guest localStorage whenever user changes ──
  useEffect(() => {
    if (!supabaseUser?.id) {
      const guestItems = getLocalGuestWishlist();
      setWishlistProducts(guestItems);
      return;
    }

    setWishlistLoading(true);

    // If there were guest items saved before logging in, sync them to Supabase
    const guestItems = getLocalGuestWishlist();
    const syncGuestItems = async () => {
      if (guestItems.length > 0) {
        for (const item of guestItems) {
          await addToWishlist(supabaseUser.id, item.productId || item.slug);
        }
        localStorage.removeItem(GUEST_WISHLIST_KEY);
      }
      return getWishlist(supabaseUser.id);
    };

    syncGuestItems()
      .then((items) => {
        setWishlistProducts(items);
        setUser((prev) =>
          prev ? { ...prev, savedItems: items.map((i) => i.productId) } : null
        );
      })
      .catch((err) => {
        console.warn('Error loading wishlist:', err);
      })
      .finally(() => setWishlistLoading(false));
  }, [supabaseUser?.id]);

  // ── Auth session bootstrap ─────────────────────────────────────────────────
  useEffect(() => {
    let isMounted = true;

    supabase.auth
      .getSession()
      .then(async ({ data: { session: initialSession }, error }) => {
        if (!isMounted) return;
        if (error) console.warn('Error fetching Supabase session:', error.message);
        setSession(initialSession);
        setSupabaseUser(initialSession?.user ?? null);
        if (initialSession?.user) {
          const profile = await fetchCustomerProfile(initialSession.user);
          const appUser = mapSupabaseUserToAppUser(initialSession.user, [], profile.role, profile.phone);
          if (isMounted) {
            setUser(appUser);
            // Automatically link any guest orders placed during checkout before logging in
            linkPastOrdersToCustomer(initialSession.user.id, initialSession.user.email, profile.phone).catch(() => {});
          }
        } else {
          setUser(null);
        }
        setLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.warn('Supabase getSession exception:', err);
        setLoading(false);
      });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(async (_event, currentSession) => {
      if (!isMounted) return;
      setSession(currentSession);
      setSupabaseUser(currentSession?.user ?? null);
      if (currentSession?.user) {
        const profile = await fetchCustomerProfile(currentSession.user);
        const appUser = mapSupabaseUserToAppUser(currentSession.user, [], profile.role, profile.phone);
        if (isMounted) {
          setUser(appUser);
          linkPastOrdersToCustomer(currentSession.user.id, currentSession.user.email, profile.phone).catch(() => {});
        }
      } else {
        setUser(null);
        setWishlistProducts([]);
      }
      setLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // ── Auth actions ───────────────────────────────────────────────────────────
  const login = async (
    email: string,
    pass: string
  ): Promise<{ error: string | null; role?: CustomerRole }> => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (error) return { error: error.message };
    let assignedRole: CustomerRole =
      (data.user?.user_metadata?.role as CustomerRole) || 'customer';
    if (data.user?.id) {
      const profile = await fetchCustomerProfile(data.user.id);
      if (profile.role) assignedRole = profile.role;
      setUser((prev) => (prev ? { ...prev, role: assignedRole, phone: profile.phone || prev.phone } : null));
      // Auto-link past orders
      linkPastOrdersToCustomer(data.user.id, data.user.email, profile.phone).catch(() => {});
    }
    return { error: null, role: assignedRole };
  };

  const register = async (
    name: string,
    email: string,
    pass: string,
    phone?: string
  ): Promise<{ error: string | null; needsEmailConfirmation?: boolean }> => {
    const cleanPhone = phone ? phone.trim() : '';
    const { data, error } = await supabase.auth.signUp({
      email,
      password: pass,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: {
          full_name: name,
          name,
          phone: cleanPhone
        }
      }
    });
    if (error) return { error: error.message };
    if (data.user?.id) {
      linkPastOrdersToCustomer(data.user.id, email, cleanPhone).catch(() => {});
    }
    const needsEmailConfirmation = Boolean(data.user && !data.session);
    return { error: null, needsEmailConfirmation };
  };

  const updatePhone = async (newPhone: string): Promise<{ error: string | null }> => {
    try {
      const cleanPhone = newPhone.trim();
      // 1. Update Supabase Auth user metadata
      const { error: authError } = await supabase.auth.updateUser({
        data: { phone: cleanPhone }
      });
      if (authError) return { error: authError.message };

      // 2. Also update customers row if exists
      if (supabaseUser?.id) {
        await supabase
          .from('customers')
          .update({ phone: cleanPhone })
          .eq('id', supabaseUser.id);
      }

      // 3. Update local user state immediately
      setUser((prev) => (prev ? { ...prev, phone: cleanPhone } : null));
      return { error: null };
    } catch (err: any) {
      return { error: err?.message || 'Failed to update phone number' };
    }
  };

  const resetPassword = async (email: string): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback`
    });
    return { error: error ? error.message : null };
  };

  const logout = async (): Promise<void> => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setSupabaseUser(null);
    setWishlistProducts([]);
  };

  // ── Wishlist toggle (optimistic & guest-supported) ────────────────────────
  const toggleSaveItem = (productId: string) => {
    if (!productId) return;

    const alreadySaved = savedIdSet.has(productId);

    if (alreadySaved) {
      // Optimistic remove
      const updated = wishlistProducts.filter(
        (w) => w.productId !== productId && w.slug !== productId
      );
      setWishlistProducts(updated);
      setUser((prev) =>
        prev
          ? { ...prev, savedItems: prev.savedItems.filter((id) => id !== productId) }
          : null
      );

      if (!supabaseUser?.id) {
        setLocalGuestWishlist(updated);
        return;
      }

      removeFromWishlist(supabaseUser.id, productId).then(({ error }) => {
        if (error) {
          console.warn('removeFromWishlist failed — rolling back:', error);
          getWishlist(supabaseUser.id).then(setWishlistProducts);
        }
      });
    } else {
      // Find product data from catalog for instant rich display
      const found = PRODUCTS.find((p) => p.id === productId || p.slug === productId);
      const newEntry: WishlistProduct = {
        wishlistId: `item-${Date.now()}-${productId}`,
        productId,
        name: found?.name || 'Saved Silhouette',
        price: found?.price || 0,
        currency: found?.currency || 'EGP',
        image: found?.images?.[0] || '/assets/products/placeholder.jpeg',
        slug: found?.slug || productId
      };

      const updated = [newEntry, ...wishlistProducts];
      setWishlistProducts(updated);
      setUser((prev) =>
        prev ? { ...prev, savedItems: [productId, ...(prev.savedItems ?? [])] } : null
      );

      if (!supabaseUser?.id) {
        setLocalGuestWishlist(updated);
        return;
      }

      addToWishlist(supabaseUser.id, productId).then(({ error }) => {
        if (error) {
          console.warn('addToWishlist failed — rolling back:', error);
          setWishlistProducts((prev) =>
            prev.filter((w) => w.productId !== productId && w.slug !== productId)
          );
        } else {
          getWishlist(supabaseUser.id).then(setWishlistProducts);
        }
      });
    }
  };

  const isItemSaved = (productId: string): boolean => savedIdSet.has(productId);

  return (
    <AuthContext.Provider
      value={{
        user,
        supabaseUser,
        session,
        role: user?.role ?? null,
        isLoggedIn: !!user,
        loading,
        wishlistProducts,
        wishlistLoading,
        login,
        register,
        updatePhone,
        resetPassword,
        logout,
        toggleSaveItem,
        isItemSaved
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

