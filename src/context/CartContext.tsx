import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Product } from '../config/assets';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabaseClient';

export interface CartItem {
  id: string; // unique combo of productId + size
  productId: string;
  name: string;
  price: number;
  currency: string;
  image: string;
  size: string;
  quantity: number;
}

interface CartContextType {
  cart: CartItem[];
  addToCart: (product: Product, size: string, quantity?: number, openDrawer?: boolean) => void;
  addItem: (product: Product, size: string, quantity?: number, openDrawer?: boolean) => void;
  removeFromCart: (id: string) => void;
  updateQuantity: (id: string, delta: number) => void;
  clearCart: () => void;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  isCartLoading: boolean;
  isCartBouncing: boolean;
  triggerCartBounce: () => void;
  totalItems: number;
  subtotal: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isLoggedIn, supabaseUser, loading: authLoading } = useAuth();

  // In-memory cart state
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('vbfits_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCartLoading, setIsCartLoading] = useState(false);
  const [isCartBouncing, setIsCartBouncing] = useState(false);

  const triggerCartBounce = () => {
    setIsCartBouncing(true);
    setTimeout(() => setIsCartBouncing(false), 700);
  };

  // Keep track of previous user ID to detect login transitions
  const prevUserIdRef = useRef<string | null>(null);

  // Sync / Merge on Authentication state changes
  useEffect(() => {
    if (authLoading) return;

    const currentUserId = supabaseUser?.id ?? null;

    // Transition 1: User just logged in (guest -> authenticated)
    if (currentUserId && currentUserId !== prevUserIdRef.current) {
      prevUserIdRef.current = currentUserId;

      const syncAndMergeCart = async () => {
        setIsCartLoading(true);
        try {
          // 1. Fetch remote cart from Supabase
          const { data: remoteRows, error } = await supabase
            .from('cart_items')
            .select('*')
            .eq('user_id', currentUserId);

          if (error) {
            console.warn('Could not fetch Supabase cart_items, maintaining local state:', error.message);
            return;
          }

          const remoteItems: CartItem[] = (remoteRows || []).map((row) => ({
            id: `${row.product_id}-${row.size}`,
            productId: row.product_id,
            name: row.name,
            price: Number(row.price),
            currency: row.currency || '$',
            image: row.image,
            size: row.size,
            quantity: row.quantity
          }));

          // 2. Read any guest items currently in localStorage
          let guestItems: CartItem[] = [];
          try {
            const guestSaved = localStorage.getItem('vbfits_cart');
            guestItems = guestSaved ? JSON.parse(guestSaved) : [];
          } catch {
            guestItems = [];
          }

          // 3. Merge guest items into remote items
          if (guestItems.length > 0) {
            const mergedMap = new Map<string, CartItem>();

            // Add remote items first
            remoteItems.forEach((item) => {
              mergedMap.set(item.id, { ...item });
            });

            // Merge guest items (summing quantities if duplicate)
            guestItems.forEach((guestItem) => {
              if (mergedMap.has(guestItem.id)) {
                const existing = mergedMap.get(guestItem.id)!;
                existing.quantity += guestItem.quantity;
              } else {
                mergedMap.set(guestItem.id, { ...guestItem });
              }
            });

            const mergedList = Array.from(mergedMap.values());

            // 4. Push merged items to Supabase
            const upsertPayload = mergedList.map((item) => ({
              user_id: currentUserId,
              product_id: item.productId,
              name: item.name,
              size: item.size,
              price: item.price,
              currency: item.currency,
              image: item.image,
              quantity: item.quantity
            }));

            await supabase
              .from('cart_items')
              .upsert(upsertPayload, { onConflict: 'user_id,product_id,size' });

            // Clear guest localStorage now that it's safely in Supabase
            localStorage.removeItem('vbfits_cart');

            setCart(mergedList);
          } else {
            // No guest items to merge; load remote cart
            setCart(remoteItems);
          }
        } catch (err) {
          console.warn('Error during cart sync/merge:', err);
        } finally {
          setIsCartLoading(false);
        }
      };

      syncAndMergeCart();
    }

    // Transition 2: User logged out (authenticated -> guest)
    if (!currentUserId && prevUserIdRef.current) {
      prevUserIdRef.current = null;
      // Revert to clean guest cart or empty
      setCart([]);
      localStorage.removeItem('vbfits_cart');
    }
  }, [isLoggedIn, supabaseUser, authLoading]);

  // Persist guest cart in localStorage only when NOT logged in
  useEffect(() => {
    if (!isLoggedIn) {
      try {
        localStorage.setItem('vbfits_cart', JSON.stringify(cart));
      } catch (e) {
        console.error('Failed to save guest cart to localStorage:', e);
      }
    }
  }, [cart, isLoggedIn]);

  const addToCart = (product: Product, size: string, quantity = 1, openDrawer = true) => {
    const itemKey = `${product.id}-${size}`;

    setCart((prev) => {
      const existing = prev.find((item) => item.id === itemKey);
      const updatedList = existing
        ? prev.map((item) =>
            item.id === itemKey
              ? { ...item, quantity: item.quantity + quantity }
              : item
          )
        : [
            ...prev,
            {
              id: itemKey,
              productId: product.id,
              name: product.name,
              price: product.price,
              currency: product.currency,
              image: product.images[0] || '/assets/products/black-shirt.jpeg',
              size,
              quantity
            }
          ];

      // If authenticated, sync with Supabase
      if (isLoggedIn && supabaseUser?.id) {
        const targetItem = updatedList.find((item) => item.id === itemKey);
        if (targetItem) {
          supabase
            .from('cart_items')
            .upsert(
              {
                user_id: supabaseUser.id,
                product_id: targetItem.productId,
                name: targetItem.name,
                size: targetItem.size,
                price: targetItem.price,
                currency: targetItem.currency,
                image: targetItem.image,
                quantity: targetItem.quantity
              },
              { onConflict: 'user_id,product_id,size' }
            )
            .then(({ error }) => {
              if (error) console.warn('Supabase cart addToCart sync notice:', error.message);
            });
        }
      }

      return updatedList;
    });

    triggerCartBounce();
    if (openDrawer) {
      setIsCartOpen(true);
    }
  };

  const addItem = (product: Product, size: string, quantity = 1, openDrawer = false) => {
    addToCart(product, size, quantity, openDrawer);
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => {
      const target = prev.find((item) => item.id === id);
      const filtered = prev.filter((item) => item.id !== id);

      if (isLoggedIn && supabaseUser?.id && target) {
        supabase
          .from('cart_items')
          .delete()
          .eq('user_id', supabaseUser.id)
          .eq('product_id', target.productId)
          .eq('size', target.size)
          .then(({ error }) => {
            if (error) console.warn('Supabase cart removeFromCart sync notice:', error.message);
          });
      }

      return filtered;
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart((prev) => {
      const target = prev.find((item) => item.id === id);
      if (!target) return prev;

      const newQty = target.quantity + delta;

      let updatedList: CartItem[];
      if (newQty > 0) {
        updatedList = prev.map((item) =>
          item.id === id ? { ...item, quantity: newQty } : item
        );

        if (isLoggedIn && supabaseUser?.id) {
          supabase
            .from('cart_items')
            .update({ quantity: newQty })
            .eq('user_id', supabaseUser.id)
            .eq('product_id', target.productId)
            .eq('size', target.size)
            .then(({ error }) => {
              if (error) console.warn('Supabase cart updateQuantity sync notice:', error.message);
            });
        }
      } else {
        updatedList = prev.filter((item) => item.id !== id);

        if (isLoggedIn && supabaseUser?.id) {
          supabase
            .from('cart_items')
            .delete()
            .eq('user_id', supabaseUser.id)
            .eq('product_id', target.productId)
            .eq('size', target.size)
            .then(({ error }) => {
              if (error) console.warn('Supabase cart delete sync notice:', error.message);
            });
        }
      }

      return updatedList;
    });
  };

  const clearCart = () => {
    setCart([]);

    if (isLoggedIn && supabaseUser?.id) {
      supabase
        .from('cart_items')
        .delete()
        .eq('user_id', supabaseUser.id)
        .then(({ error }) => {
          if (error) console.warn('Supabase cart clearCart sync notice:', error.message);
        });
    } else {
      localStorage.removeItem('vbfits_cart');
    }
  };

  // Real-time calculations (unchanged)
  const totalItems = cart.reduce((acc, item) => acc + item.quantity, 0);
  const subtotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        addItem,
        removeFromCart,
        updateQuantity,
        clearCart,
        isCartOpen,
        setIsCartOpen,
        isCartLoading: isCartLoading || (authLoading && isLoggedIn),
        isCartBouncing,
        triggerCartBounce,
        totalItems,
        subtotal
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
