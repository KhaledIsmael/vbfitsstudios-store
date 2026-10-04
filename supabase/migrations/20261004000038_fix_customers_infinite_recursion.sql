-- ==============================================================================
-- Migration: 20261004000038_fix_customers_infinite_recursion.sql
-- Description:
--   Permanently fixes "infinite recursion detected in policy for relation customers"
--   by rewriting is_admin() and is_admin_or_support() to inspect in-memory JWT claims
--   and removing all recursive policy calls on public.customers.
--   Enables seamless admin management for orders, banners, settings, and stats.
-- ==============================================================================

-- ── 1. REDEFINE is_admin() & is_admin_or_support() (NON-RECURSIVE) ────────────

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
DECLARE
  v_role TEXT;
  v_email TEXT;
BEGIN
  -- Check in-memory JWT claims first (Zero DB query, 100% immune to recursion)
  BEGIN
    v_email := NULLIF(current_setting('request.jwt.claims', true)::jsonb->>'email', '');
    IF v_email IN ('admin@vbfitsstudios.com', 'vbfitsstudios@gmail.com', 'owner@vbfitsstudios.com') THEN
      RETURN true;
    END IF;

    v_role := NULLIF(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '');
    IF v_role = 'admin' THEN
      RETURN true;
    END IF;

    v_role := NULLIF(current_setting('request.jwt.claims', true)::jsonb->'user_metadata'->>'role', '');
    IF v_role = 'admin' THEN
      RETURN true;
    END IF;
  EXCEPTION
    WHEN OTHERS THEN NULL;
  END;

  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  -- Fallback to auth.users (auth schema has no RLS policies, safe from recursion)
  IF EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
      AND (
        email IN ('admin@vbfitsstudios.com', 'vbfitsstudios@gmail.com', 'owner@vbfitsstudios.com')
        OR raw_app_meta_data->>'role' = 'admin'
        OR raw_user_meta_data->>'role' = 'admin'
      )
  ) THEN
    RETURN true;
  END IF;

  -- Fallback to customers (safe because customers RLS no longer calls is_admin)
  IF EXISTS (
    SELECT 1 FROM public.customers
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_support()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
DECLARE
  v_role TEXT;
  v_email TEXT;
BEGIN
  -- Check in-memory JWT claims first (Zero DB query, 100% immune to recursion)
  BEGIN
    v_email := NULLIF(current_setting('request.jwt.claims', true)::jsonb->>'email', '');
    IF v_email IN ('admin@vbfitsstudios.com', 'vbfitsstudios@gmail.com', 'owner@vbfitsstudios.com') THEN
      RETURN true;
    END IF;

    v_role := NULLIF(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '');
    IF v_role IN ('admin', 'support') THEN
      RETURN true;
    END IF;

    v_role := NULLIF(current_setting('request.jwt.claims', true)::jsonb->'user_metadata'->>'role', '');
    IF v_role IN ('admin', 'support') THEN
      RETURN true;
    END IF;
  EXCEPTION
    WHEN OTHERS THEN NULL;
  END;

  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  -- Fallback to auth.users (auth schema has no RLS policies, safe from recursion)
  IF EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
      AND (
        email IN ('admin@vbfitsstudios.com', 'vbfitsstudios@gmail.com', 'owner@vbfitsstudios.com')
        OR raw_app_meta_data->>'role' IN ('admin', 'support')
        OR raw_user_meta_data->>'role' IN ('admin', 'support')
      )
  ) THEN
    RETURN true;
  END IF;

  -- Fallback to customers (safe because customers RLS no longer calls is_admin)
  IF EXISTS (
    SELECT 1 FROM public.customers
    WHERE id = auth.uid() AND role IN ('admin', 'support')
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_admin()            TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin_or_support() TO anon, authenticated, service_role;

-- ── 2. REMOVE ALL RECURSIVE POLICIES FROM public.customers ─────────────────────

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customers_select_own_or_admin" ON public.customers;
DROP POLICY IF EXISTS "customers_select_own"          ON public.customers;
DROP POLICY IF EXISTS "customers_select_admin"        ON public.customers;
DROP POLICY IF EXISTS "customers_update_own"          ON public.customers;
DROP POLICY IF EXISTS "customers_update_admin"        ON public.customers;
DROP POLICY IF EXISTS "customers_insert_own"          ON public.customers;
DROP POLICY IF EXISTS "customers_delete_admin"        ON public.customers;
DROP POLICY IF EXISTS "Admins and support can view all customers" ON public.customers;
DROP POLICY IF EXISTS "Admins can update customers"   ON public.customers;
DROP POLICY IF EXISTS "Staff can update customers"    ON public.customers;
DROP POLICY IF EXISTS "Customers can view own profile" ON public.customers;
DROP POLICY IF EXISTS "Customers can insert own profile" ON public.customers;
DROP POLICY IF EXISTS "Customers can update own profile" ON public.customers;
DROP POLICY IF EXISTS "Public can view and manage customers" ON public.customers;
DROP POLICY IF EXISTS "customers_select_safe"         ON public.customers;
DROP POLICY IF EXISTS "customers_insert_safe"         ON public.customers;
DROP POLICY IF EXISTS "customers_update_safe"         ON public.customers;

-- Non-recursive SELECT policy:
CREATE POLICY "customers_select_safe"
  ON public.customers FOR SELECT
  USING (
    id = auth.uid()
    OR (auth.jwt()->>'email') IN ('admin@vbfitsstudios.com', 'vbfitsstudios@gmail.com', 'owner@vbfitsstudios.com')
    OR (auth.jwt()->'app_metadata'->>'role') IN ('admin', 'support')
    OR (auth.jwt()->'user_metadata'->>'role') IN ('admin', 'support')
    OR current_user = 'service_role'
  );

-- Non-recursive INSERT policy:
CREATE POLICY "customers_insert_safe"
  ON public.customers FOR INSERT
  WITH CHECK (
    id = auth.uid()
    OR (auth.jwt()->>'email') IN ('admin@vbfitsstudios.com', 'vbfitsstudios@gmail.com', 'owner@vbfitsstudios.com')
    OR (auth.jwt()->'app_metadata'->>'role') IN ('admin', 'support')
    OR (auth.jwt()->'user_metadata'->>'role') IN ('admin', 'support')
    OR current_user = 'service_role'
  );

-- Non-recursive UPDATE policy:
CREATE POLICY "customers_update_safe"
  ON public.customers FOR UPDATE
  USING (
    id = auth.uid()
    OR (auth.jwt()->>'email') IN ('admin@vbfitsstudios.com', 'vbfitsstudios@gmail.com', 'owner@vbfitsstudios.com')
    OR (auth.jwt()->'app_metadata'->>'role') IN ('admin', 'support')
    OR (auth.jwt()->'user_metadata'->>'role') IN ('admin', 'support')
    OR current_user = 'service_role'
  );

-- ── 3. REFRESH HERO_BANNERS POLICIES ───────────────────────────────────────────

ALTER TABLE public.hero_banners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hero_banners_public_read" ON public.hero_banners;
DROP POLICY IF EXISTS "hero_banners_admin_write" ON public.hero_banners;
DROP POLICY IF EXISTS "hero_banners_admin_all"   ON public.hero_banners;

CREATE POLICY "hero_banners_public_read"
  ON public.hero_banners FOR SELECT
  USING (true);

CREATE POLICY "hero_banners_admin_write"
  ON public.hero_banners FOR ALL
  USING (
    public.is_admin_or_support()
    OR (auth.jwt()->>'email') IN ('admin@vbfitsstudios.com', 'vbfitsstudios@gmail.com', 'owner@vbfitsstudios.com')
    OR current_user = 'service_role'
  )
  WITH CHECK (
    public.is_admin_or_support()
    OR (auth.jwt()->>'email') IN ('admin@vbfitsstudios.com', 'vbfitsstudios@gmail.com', 'owner@vbfitsstudios.com')
    OR current_user = 'service_role'
  );

-- ── 4. REFRESH ORDERS & ORDER_ITEMS POLICIES ───────────────────────────────────

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "orders_select" ON public.orders;
DROP POLICY IF EXISTS "orders_select_admin_or_own" ON public.orders;
DROP POLICY IF EXISTS "orders_select_own" ON public.orders;
DROP POLICY IF EXISTS "orders_insert" ON public.orders;
DROP POLICY IF EXISTS "orders_insert_checkout" ON public.orders;
DROP POLICY IF EXISTS "orders_update" ON public.orders;
DROP POLICY IF EXISTS "orders_update_admin_or_own" ON public.orders;
DROP POLICY IF EXISTS "orders_delete_admin" ON public.orders;

-- SELECT: own orders, all guest orders, or admin
CREATE POLICY "orders_select"
  ON public.orders FOR SELECT
  USING (
    customer_id = auth.uid()
    OR customer_id IS NULL
    OR public.is_admin_or_support()
    OR (auth.jwt()->>'email') IN ('admin@vbfitsstudios.com', 'vbfitsstudios@gmail.com', 'owner@vbfitsstudios.com')
    OR current_user = 'service_role'
  );

-- INSERT: anyone can create an order (guest checkout or logged-in customer)
CREATE POLICY "orders_insert"
  ON public.orders FOR INSERT
  WITH CHECK (true);

-- UPDATE: customer or admin
CREATE POLICY "orders_update"
  ON public.orders FOR UPDATE
  USING (
    customer_id = auth.uid()
    OR customer_id IS NULL
    OR public.is_admin_or_support()
    OR (auth.jwt()->>'email') IN ('admin@vbfitsstudios.com', 'vbfitsstudios@gmail.com', 'owner@vbfitsstudios.com')
    OR current_user = 'service_role'
  );

-- order_items
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "order_items_select" ON public.order_items;
DROP POLICY IF EXISTS "order_items_select_order_viewers" ON public.order_items;
DROP POLICY IF EXISTS "order_items_insert" ON public.order_items;
DROP POLICY IF EXISTS "order_items_insert_checkout" ON public.order_items;

CREATE POLICY "order_items_select"
  ON public.order_items FOR SELECT
  USING (true);

CREATE POLICY "order_items_insert"
  ON public.order_items FOR INSERT
  WITH CHECK (true);

CREATE POLICY "order_items_update"
  ON public.order_items FOR UPDATE
  USING (
    public.is_admin_or_support()
    OR (auth.jwt()->>'email') IN ('admin@vbfitsstudios.com', 'vbfitsstudios@gmail.com', 'owner@vbfitsstudios.com')
    OR current_user = 'service_role'
  );

-- ── 5. REFRESH STORE_SETTINGS & SITE_SETTINGS POLICIES ─────────────────────────

ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "store_settings_public_read"  ON public.store_settings;
DROP POLICY IF EXISTS "store_settings_admin_write"  ON public.store_settings;
DROP POLICY IF EXISTS "store_settings_admin_update" ON public.store_settings;

CREATE POLICY "store_settings_public_read"
  ON public.store_settings FOR SELECT
  USING (true);

CREATE POLICY "store_settings_admin_write"
  ON public.store_settings FOR INSERT
  WITH CHECK (
    public.is_admin_or_support()
    OR (auth.jwt()->>'email') IN ('admin@vbfitsstudios.com', 'vbfitsstudios@gmail.com', 'owner@vbfitsstudios.com')
    OR current_user = 'service_role'
  );

CREATE POLICY "store_settings_admin_update"
  ON public.store_settings FOR UPDATE
  USING (
    public.is_admin_or_support()
    OR (auth.jwt()->>'email') IN ('admin@vbfitsstudios.com', 'vbfitsstudios@gmail.com', 'owner@vbfitsstudios.com')
    OR current_user = 'service_role'
  );

-- Grant privileges
GRANT ALL ON public.customers TO authenticated, anon, service_role;
GRANT ALL ON public.orders TO authenticated, anon, service_role;
GRANT ALL ON public.order_items TO authenticated, anon, service_role;
GRANT ALL ON public.hero_banners TO authenticated, anon, service_role;
GRANT ALL ON public.store_settings TO authenticated, anon, service_role;
GRANT ALL ON public.site_settings TO authenticated, anon, service_role;

-- ── 6. ENSURE ADMIN ROLE FOR vbfitsstudios@gmail.com ───────────────────────────

UPDATE public.customers
SET role = 'admin'
WHERE email = 'vbfitsstudios@gmail.com';

UPDATE auth.users
SET 
  raw_app_meta_data = jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'role', 'admin'),
  raw_user_meta_data = jsonb_build_object('full_name', 'مدير المتجر الرئيسي', 'role', 'admin')
WHERE email = 'vbfitsstudios@gmail.com';

-- ── 7. NOTIFY POSTGREST SCHEMA CACHE ──────────────────────────────────────────

NOTIFY pgrst, 'reload schema';
