-- ============================================================
-- Migration: 20260919000017_rls_policies.sql
-- Purpose:   Row-Level Security hardening for customer data.
--            Customers can only read/write their own rows.
--            Service-role key (used in serverless functions) bypasses RLS.
-- ============================================================

-- ─── 1. ORDERS TABLE ──────────────────────────────────────────────────────────

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Customers see only their own orders (auth users)
DROP POLICY IF EXISTS "orders_select_own" ON public.orders;
CREATE POLICY "orders_select_own"
  ON public.orders
  FOR SELECT
  USING (
    customer_id = auth.uid()
    OR customer_id IS NULL  -- guest orders visible by session only (no auth check possible)
  );

-- Authenticated customers can insert their own orders
DROP POLICY IF EXISTS "orders_insert_own" ON public.orders;
CREATE POLICY "orders_insert_own"
  ON public.orders
  FOR INSERT
  WITH CHECK (
    customer_id = auth.uid() OR customer_id IS NULL
  );

-- Customers cannot update orders (admin/serverless functions use service_role)
DROP POLICY IF EXISTS "orders_no_client_update" ON public.orders;
CREATE POLICY "orders_no_client_update"
  ON public.orders
  FOR UPDATE
  USING (false);

-- ─── 2. ORDER_ITEMS TABLE ─────────────────────────────────────────────────────

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "order_items_select_own" ON public.order_items;
CREATE POLICY "order_items_select_own"
  ON public.order_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND (o.customer_id = auth.uid() OR o.customer_id IS NULL)
    )
  );

DROP POLICY IF EXISTS "order_items_insert_own" ON public.order_items;
CREATE POLICY "order_items_insert_own"
  ON public.order_items
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND (o.customer_id = auth.uid() OR o.customer_id IS NULL)
    )
  );

-- ─── 3. CART_ITEMS TABLE ──────────────────────────────────────────────────────

ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cart_items_select_own" ON public.cart_items;
CREATE POLICY "cart_items_select_own"
  ON public.cart_items
  FOR SELECT
  USING (user_id = auth.uid() OR session_id IS NOT NULL);

DROP POLICY IF EXISTS "cart_items_insert_own" ON public.cart_items;
CREATE POLICY "cart_items_insert_own"
  ON public.cart_items
  FOR INSERT
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

DROP POLICY IF EXISTS "cart_items_update_own" ON public.cart_items;
CREATE POLICY "cart_items_update_own"
  ON public.cart_items
  FOR UPDATE
  USING (user_id = auth.uid() OR session_id IS NOT NULL);

DROP POLICY IF EXISTS "cart_items_delete_own" ON public.cart_items;
CREATE POLICY "cart_items_delete_own"
  ON public.cart_items
  FOR DELETE
  USING (user_id = auth.uid() OR session_id IS NOT NULL);

-- ─── 4. PROFILES TABLE ────────────────────────────────────────────────────────

-- Profiles table may be named 'customers' in this schema — check both
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'profiles' AND table_schema = 'public') THEN
    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
    CREATE POLICY "profiles_select_own"
      ON public.profiles FOR SELECT
      USING (id = auth.uid());

    DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
    CREATE POLICY "profiles_update_own"
      ON public.profiles FOR UPDATE
      USING (id = auth.uid());
  END IF;
END $$;

-- customers table (used in this project)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'customers' AND table_schema = 'public') THEN
    ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "customers_select_own" ON public.customers;
    CREATE POLICY "customers_select_own"
      ON public.customers FOR SELECT
      USING (auth_id = auth.uid());

    DROP POLICY IF EXISTS "customers_update_own" ON public.customers;
    CREATE POLICY "customers_update_own"
      ON public.customers FOR UPDATE
      USING (auth_id = auth.uid());
  END IF;
END $$;

-- ─── 5. WISHLIST_ITEMS TABLE ──────────────────────────────────────────────────

DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'wishlist_items' AND table_schema = 'public') THEN
    ALTER TABLE public.wishlist_items ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "wishlist_select_own" ON public.wishlist_items;
    CREATE POLICY "wishlist_select_own"
      ON public.wishlist_items FOR SELECT
      USING (user_id = auth.uid());

    DROP POLICY IF EXISTS "wishlist_insert_own" ON public.wishlist_items;
    CREATE POLICY "wishlist_insert_own"
      ON public.wishlist_items FOR INSERT
      WITH CHECK (user_id = auth.uid());

    DROP POLICY IF EXISTS "wishlist_delete_own" ON public.wishlist_items;
    CREATE POLICY "wishlist_delete_own"
      ON public.wishlist_items FOR DELETE
      USING (user_id = auth.uid());
  END IF;
END $$;

-- ─── 6. NEWSLETTER_SUBSCRIBERS — Public insert, admin-only read ───────────────

DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'newsletter_subscribers' AND table_schema = 'public') THEN
    ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

    -- Anyone can subscribe (INSERT)
    DROP POLICY IF EXISTS "newsletter_insert_public" ON public.newsletter_subscribers;
    CREATE POLICY "newsletter_insert_public"
      ON public.newsletter_subscribers FOR INSERT
      WITH CHECK (true);

    -- Reading subscriber list is admin-only (via service_role; anon gets nothing)
    DROP POLICY IF EXISTS "newsletter_select_none" ON public.newsletter_subscribers;
    CREATE POLICY "newsletter_select_none"
      ON public.newsletter_subscribers FOR SELECT
      USING (false);
  END IF;
END $$;

-- ─── 7. RESTOCK_NOTIFICATIONS — Public insert ─────────────────────────────────

DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'restock_notifications' AND table_schema = 'public') THEN
    ALTER TABLE public.restock_notifications ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "restock_insert_public" ON public.restock_notifications;
    CREATE POLICY "restock_insert_public"
      ON public.restock_notifications FOR INSERT
      WITH CHECK (true);

    -- Only the server (service_role) reads/updates these
    DROP POLICY IF EXISTS "restock_select_none" ON public.restock_notifications;
    CREATE POLICY "restock_select_none"
      ON public.restock_notifications FOR SELECT
      USING (false);
  END IF;
END $$;

-- ─── 8. PRODUCTS & PRODUCT_VARIANTS — Public read ────────────────────────────

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "products_public_read" ON public.products;
CREATE POLICY "products_public_read"
  ON public.products FOR SELECT
  USING (true);

DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'product_variants' AND table_schema = 'public') THEN
    ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "variants_public_read" ON public.product_variants;
    CREATE POLICY "variants_public_read"
      ON public.product_variants FOR SELECT
      USING (true);
  END IF;
END $$;

-- ─── 9. DISCOUNT_CODES — Anon-read for validation, no write ──────────────────

DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'discount_codes' AND table_schema = 'public') THEN
    ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "discount_codes_public_read" ON public.discount_codes;
    CREATE POLICY "discount_codes_public_read"
      ON public.discount_codes FOR SELECT
      USING (is_active = true);
  END IF;
END $$;
