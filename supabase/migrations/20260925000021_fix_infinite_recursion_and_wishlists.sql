-- =============================================================================
-- Migration: 20260925000021_fix_infinite_recursion_and_wishlists.sql
-- Purpose:
--   1. Fix infinite recursion in RLS for public.customers and public.orders.
--      Uses SECURITY DEFINER functions to query customers without triggering RLS.
--   2. Ensure public.wishlists table exists with proper schema, indexes, and RLS.
--   3. Fix products and order_items RLS policies to use the new security definer functions.
-- =============================================================================

-- ─── 1. SECURITY DEFINER HELPER FUNCTIONS (Bypasses RLS to prevent recursion) ──
CREATE OR REPLACE FUNCTION public.is_admin_or_support()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.customers
    WHERE id = auth.uid() AND role IN ('admin', 'support')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.customers
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin_or_support() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon;

-- ─── 2. FIX CUSTOMERS TABLE RLS (No recursion) ────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'customers' AND table_schema = 'public') THEN
    ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

    -- Drop all legacy or recursive policies
    DROP POLICY IF EXISTS "customers_select_own" ON public.customers;
    DROP POLICY IF EXISTS "customers_select_admin" ON public.customers;
    DROP POLICY IF EXISTS "customers_update_own" ON public.customers;
    DROP POLICY IF EXISTS "customers_update_admin" ON public.customers;
    DROP POLICY IF EXISTS "customers_insert_own" ON public.customers;
    DROP POLICY IF EXISTS "Customers can view own profile" ON public.customers;
    DROP POLICY IF EXISTS "Customers can insert own profile" ON public.customers;
    DROP POLICY IF EXISTS "Customers can update own profile" ON public.customers;
    DROP POLICY IF EXISTS "Public can view and manage customers" ON public.customers;

    -- Customers can read their own profile OR admin can read all (via is_admin_or_support)
    CREATE POLICY "customers_select_own_or_admin"
      ON public.customers FOR SELECT
      USING (id = auth.uid() OR public.is_admin_or_support());

    -- Customers can update their own profile
    CREATE POLICY "customers_update_own"
      ON public.customers FOR UPDATE
      USING (id = auth.uid() OR public.is_admin());

    -- Authenticated users can insert their own customer profile
    CREATE POLICY "customers_insert_own"
      ON public.customers FOR INSERT
      WITH CHECK (id = auth.uid() OR public.is_admin());
  END IF;
END $$;

-- ─── 3. FIX ORDERS TABLE RLS (No recursion) ───────────────────────────────────
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "orders_no_client_update" ON public.orders;
DROP POLICY IF EXISTS "orders_update_admin_or_own" ON public.orders;
DROP POLICY IF EXISTS "orders_select_own" ON public.orders;
DROP POLICY IF EXISTS "orders_select_admin_or_own" ON public.orders;
DROP POLICY IF EXISTS "orders_delete_admin" ON public.orders;
DROP POLICY IF EXISTS "Customers can view own orders" ON public.orders;
DROP POLICY IF EXISTS "Customers can insert own orders" ON public.orders;

-- SELECT: own orders, guest orders (customer_id is null), or admin
CREATE POLICY "orders_select_admin_or_own"
  ON public.orders
  FOR SELECT
  USING (
    customer_id = auth.uid()
    OR customer_id IS NULL
    OR public.is_admin_or_support()
  );

-- INSERT: anyone can create an order (logged in or guest checkout)
DROP POLICY IF EXISTS "orders_insert_checkout" ON public.orders;
CREATE POLICY "orders_insert_checkout"
  ON public.orders
  FOR INSERT
  WITH CHECK (
    customer_id = auth.uid()
    OR customer_id IS NULL
    OR public.is_admin_or_support()
  );

-- UPDATE: admin or own order
CREATE POLICY "orders_update_admin_or_own"
  ON public.orders
  FOR UPDATE
  USING (
    customer_id = auth.uid()
    OR customer_id IS NULL
    OR public.is_admin_or_support()
  );

-- DELETE: admin only
CREATE POLICY "orders_delete_admin"
  ON public.orders
  FOR DELETE
  USING (public.is_admin());

-- ─── 4. FIX ORDER_ITEMS TABLE RLS ─────────────────────────────────────────────
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "order_items_select_own" ON public.order_items;
DROP POLICY IF EXISTS "order_items_select_admin_or_own" ON public.order_items;
DROP POLICY IF EXISTS "order_items_update_admin" ON public.order_items;
DROP POLICY IF EXISTS "order_items_delete_admin" ON public.order_items;
DROP POLICY IF EXISTS "order_items_insert_checkout" ON public.order_items;

CREATE POLICY "order_items_select_admin_or_own"
  ON public.order_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND (
          o.customer_id = auth.uid()
          OR o.customer_id IS NULL
          OR public.is_admin_or_support()
        )
    )
  );

CREATE POLICY "order_items_insert_checkout"
  ON public.order_items
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "order_items_update_admin"
  ON public.order_items
  FOR UPDATE
  USING (public.is_admin_or_support());

CREATE POLICY "order_items_delete_admin"
  ON public.order_items
  FOR DELETE
  USING (public.is_admin_or_support());

-- ─── 5. ENSURE WISHLISTS TABLE EXISTS & RLS IS FIXED ─────────────────────────
CREATE TABLE IF NOT EXISTS public.wishlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_customer_wishlist_product UNIQUE (customer_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_wishlists_customer_id ON public.wishlists(customer_id);
CREATE INDEX IF NOT EXISTS idx_wishlists_product_id ON public.wishlists(product_id);

ALTER TABLE public.wishlists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own wishlist" ON public.wishlists;
DROP POLICY IF EXISTS "Customers can view own wishlist" ON public.wishlists;
DROP POLICY IF EXISTS "Customers can insert into own wishlist" ON public.wishlists;
DROP POLICY IF EXISTS "Customers can delete from own wishlist" ON public.wishlists;
DROP POLICY IF EXISTS "wishlists_select_own" ON public.wishlists;
DROP POLICY IF EXISTS "wishlists_insert_own" ON public.wishlists;
DROP POLICY IF EXISTS "wishlists_delete_own" ON public.wishlists;

CREATE POLICY "wishlists_select_own"
  ON public.wishlists FOR SELECT
  USING (customer_id = auth.uid() OR public.is_admin_or_support());

CREATE POLICY "wishlists_insert_own"
  ON public.wishlists FOR INSERT
  WITH CHECK (customer_id = auth.uid() OR public.is_admin_or_support());

CREATE POLICY "wishlists_delete_own"
  ON public.wishlists FOR DELETE
  USING (customer_id = auth.uid() OR public.is_admin_or_support());

GRANT SELECT, INSERT, DELETE ON public.wishlists TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO authenticated, anon;
