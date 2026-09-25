-- =============================================================================
-- Migration: 20260925000020_critical_bug_fixes.sql
-- Purpose:   Fix all critical platform bugs reported by store owner:
--   1. Catalog CRUD — proper INSERT + variant/image upsert for products
--   2. Order status updates — allow admin/staff to update orders via anon key
--   3. Admin user/customer isolation — fix customers RLS policy (uses id not auth_id)
--   4. Shipping zones — ensure shipping_rate + free_shipping_threshold columns exist
--   5. Store settings — ensure public can INSERT (for order status sync)
--   6. Products price/archive updates via anon when admin is logged in
-- =============================================================================

-- ─── 1. FIX ORDERS RLS: Allow admin/staff to update orders (was blocked to all) ─
-- The previous policy "orders_no_client_update" blocked ALL updates including admin.
-- Fix: allow update when customer_id matches auth.uid() OR the user is admin/support.

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "orders_no_client_update" ON public.orders;
DROP POLICY IF EXISTS "orders_update_admin_or_own" ON public.orders;
CREATE POLICY "orders_update_admin_or_own"
  ON public.orders
  FOR UPDATE
  USING (
    customer_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = auth.uid() AND c.role IN ('admin', 'support')
    )
  );

-- Also allow admin to delete orders (for test data purge)
DROP POLICY IF EXISTS "orders_delete_admin" ON public.orders;
CREATE POLICY "orders_delete_admin"
  ON public.orders
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = auth.uid() AND c.role = 'admin'
    )
  );

-- Fix SELECT: admin can see ALL orders (not just own or guest)
DROP POLICY IF EXISTS "orders_select_own" ON public.orders;
DROP POLICY IF EXISTS "orders_select_admin_or_own" ON public.orders;
CREATE POLICY "orders_select_admin_or_own"
  ON public.orders
  FOR SELECT
  USING (
    customer_id = auth.uid()
    OR customer_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = auth.uid() AND c.role IN ('admin', 'support')
    )
  );

-- ─── 2. FIX ORDER_ITEMS RLS: Admin can see all order items ────────────────────
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "order_items_select_own" ON public.order_items;
DROP POLICY IF EXISTS "order_items_select_admin_or_own" ON public.order_items;
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
          OR EXISTS (
            SELECT 1 FROM public.customers c
            WHERE c.id = auth.uid() AND c.role IN ('admin', 'support')
          )
        )
    )
  );

-- Admin can update/delete order_items too
DROP POLICY IF EXISTS "order_items_update_admin" ON public.order_items;
CREATE POLICY "order_items_update_admin"
  ON public.order_items
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = auth.uid() AND c.role IN ('admin', 'support')
    )
  );

DROP POLICY IF EXISTS "order_items_delete_admin" ON public.order_items;
CREATE POLICY "order_items_delete_admin"
  ON public.order_items
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = auth.uid() AND c.role IN ('admin', 'support')
    )
  );

-- ─── 3. FIX CUSTOMERS TABLE RLS ───────────────────────────────────────────────
-- The previous policy used auth_id = auth.uid() but the column is named 'id'.
-- This caused customers to not be able to read/update their own profile.

DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'customers' AND table_schema = 'public') THEN
    ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

    -- Allow customers to read their own row (using id not auth_id)
    DROP POLICY IF EXISTS "customers_select_own" ON public.customers;
    CREATE POLICY "customers_select_own"
      ON public.customers FOR SELECT
      USING (id = auth.uid());

    -- Allow customers to update their own row
    DROP POLICY IF EXISTS "customers_update_own" ON public.customers;
    CREATE POLICY "customers_update_own"
      ON public.customers FOR UPDATE
      USING (id = auth.uid());

    -- Allow new authenticated user to insert their own customer row
    DROP POLICY IF EXISTS "customers_insert_own" ON public.customers;
    CREATE POLICY "customers_insert_own"
      ON public.customers FOR INSERT
      WITH CHECK (id = auth.uid());

    -- Admin can read all customers
    DROP POLICY IF EXISTS "customers_select_admin" ON public.customers;
    CREATE POLICY "customers_select_admin"
      ON public.customers FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.customers c
          WHERE c.id = auth.uid() AND c.role IN ('admin', 'support')
        )
      );

    -- Admin can update all customers (for role assignment)
    DROP POLICY IF EXISTS "customers_update_admin" ON public.customers;
    CREATE POLICY "customers_update_admin"
      ON public.customers FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM public.customers c
          WHERE c.id = auth.uid() AND c.role = 'admin'
        )
      );
  END IF;
END $$;

-- ─── 4. FIX PRODUCTS RLS: Allow admin INSERT for new products ─────────────────
-- Previous policy only had UPDATE + SELECT, no INSERT policy for staff creating new products.
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Fix SELECT: everyone sees published+non-archived; admin sees all
DROP POLICY IF EXISTS "products_public_read" ON public.products;
DROP POLICY IF EXISTS "Public can view active products, staff can view all" ON public.products;
DROP POLICY IF EXISTS "products_select_all_or_admin" ON public.products;
CREATE POLICY "products_select_all_or_admin"
  ON public.products FOR SELECT
  USING (
    (is_published = true AND is_archived = false)
    OR EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = auth.uid() AND c.role IN ('admin', 'support')
    )
  );

-- Allow admin INSERT (create new products)
DROP POLICY IF EXISTS "Staff can insert products" ON public.products;
CREATE POLICY "Staff can insert products"
  ON public.products FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = auth.uid() AND c.role IN ('admin', 'support')
    )
  );

-- Allow admin UPDATE
DROP POLICY IF EXISTS "Staff can update products" ON public.products;
CREATE POLICY "Staff can update products"
  ON public.products FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = auth.uid() AND c.role IN ('admin', 'support')
    )
  );

-- ─── 5. FIX PRODUCT_VARIANTS RLS ─────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'product_variants') THEN
    ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "variants_public_read" ON public.product_variants;
    CREATE POLICY "variants_public_read"
      ON public.product_variants FOR SELECT
      USING (true);

    DROP POLICY IF EXISTS "Staff can manage product variants" ON public.product_variants;
    CREATE POLICY "Staff can manage product variants"
      ON public.product_variants FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.customers c
          WHERE c.id = auth.uid() AND c.role IN ('admin', 'support')
        )
      );
  END IF;
END $$;

-- ─── 6. FIX PRODUCT_IMAGES RLS ────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'product_images') THEN
    ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "product_images_public_read" ON public.product_images;
    CREATE POLICY "product_images_public_read"
      ON public.product_images FOR SELECT
      USING (true);

    DROP POLICY IF EXISTS "Staff can manage product images" ON public.product_images;
    CREATE POLICY "Staff can manage product images"
      ON public.product_images FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.customers c
          WHERE c.id = auth.uid() AND c.role IN ('admin', 'support')
        )
      );
  END IF;
END $$;

-- ─── 7. FIX STORE_SETTINGS RLS: Allow public INSERT (for order status sync) ────
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view store settings" ON public.store_settings;
CREATE POLICY "Public can view store settings"
  ON public.store_settings FOR SELECT
  USING (true);

-- Allow insert from authenticated users (order status sync from storefront)
DROP POLICY IF EXISTS "Authenticated can insert store settings" ON public.store_settings;
CREATE POLICY "Authenticated can insert store settings"
  ON public.store_settings FOR INSERT
  WITH CHECK (true);

-- Allow update from authenticated admin or any user (for order_status_updates sync)
DROP POLICY IF EXISTS "Staff can update store settings" ON public.store_settings;
DROP POLICY IF EXISTS "Authenticated can upsert store settings" ON public.store_settings;
CREATE POLICY "Authenticated can upsert store settings"
  ON public.store_settings FOR UPDATE
  USING (true);

-- ─── 8. SHIPPING ZONES: Ensure shipping_rate + free_shipping_threshold columns ─
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'shipping_zones') THEN
    -- shipping_rate column
    IF NOT EXISTS (
      SELECT FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'shipping_zones' AND column_name = 'shipping_rate'
    ) THEN
      ALTER TABLE public.shipping_zones ADD COLUMN shipping_rate NUMERIC(10, 2) NOT NULL DEFAULT 65.00;
    END IF;

    -- free_shipping_threshold column
    IF NOT EXISTS (
      SELECT FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'shipping_zones' AND column_name = 'free_shipping_threshold'
    ) THEN
      ALTER TABLE public.shipping_zones ADD COLUMN free_shipping_threshold NUMERIC(10, 2) DEFAULT 1500.00;
    END IF;

    -- Upsert shipping rates for all Egyptian governorates with correct EGP rates
    INSERT INTO public.shipping_zones (governorate, governorate_ar, min_days, max_days, cod_available, shipping_rate, free_shipping_threshold) VALUES
      ('Cairo',          'القاهرة',       2, 4, true,  60,  1500),
      ('Giza',           'الجيزة',        2, 4, true,  60,  1500),
      ('Qalyubia',       'القليوبية',     2, 4, true,  60,  1500),
      ('Alexandria',     'الإسكندرية',    3, 5, true,  65,  1500),
      ('Sharqia',        'الشرقية',       3, 5, true,  65,  1500),
      ('Dakahlia',       'الدقهلية',      3, 5, true,  65,  1500),
      ('Gharbia',        'الغربية',       3, 5, true,  65,  1500),
      ('Monufia',        'المنوفية',      3, 5, true,  65,  1500),
      ('Ismailia',       'الإسماعيلية',   3, 5, true,  65,  1500),
      ('Suez',           'السويس',        3, 5, true,  65,  1500),
      ('Port Said',      'بورسعيد',       3, 5, true,  65,  1500),
      ('Faiyum',         'الفيوم',        3, 5, true,  65,  1500),
      ('Kafr El Sheikh', 'كفر الشيخ',     4, 6, true,  65,  1500),
      ('Beheira',        'البحيرة',       4, 6, true,  65,  1500),
      ('Damietta',       'دمياط',         4, 6, true,  65,  1500),
      ('Beni Suef',      'بني سويف',      4, 7, true,  75,  1500),
      ('Minya',          'المنيا',        4, 7, true,  75,  1500),
      ('Asyut',          'أسيوط',         4, 7, true,  75,  1500),
      ('Sohag',          'سوهاج',         4, 7, false, 80,  1500),
      ('Qena',           'قنا',           4, 7, false, 80,  1500),
      ('Luxor',          'الأقصر',        5, 7, false, 85,  1500),
      ('Aswan',          'أسوان',         5, 7, false, 85,  1500),
      ('Red Sea',        'البحر الأحمر',  5, 8, false, 85,  1500),
      ('Matruh',         'مطروح',         5, 8, false, 85,  1500),
      ('Matrouh',        'مطروح',         5, 8, false, 85,  1500),
      ('North Sinai',    'شمال سيناء',    5, 8, false, 90,  1500),
      ('South Sinai',    'جنوب سيناء',    5, 8, false, 90,  1500),
      ('New Valley',     'الوادي الجديد', 6, 9, false, 90,  1500)
    ON CONFLICT (governorate) DO UPDATE SET
      shipping_rate            = EXCLUDED.shipping_rate,
      free_shipping_threshold  = EXCLUDED.free_shipping_threshold,
      min_days                 = EXCLUDED.min_days,
      max_days                 = EXCLUDED.max_days,
      cod_available            = EXCLUDED.cod_available,
      governorate_ar           = EXCLUDED.governorate_ar;
  END IF;
END $$;

-- Shipping zones RLS: Public read, admin write
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'shipping_zones') THEN
    ALTER TABLE public.shipping_zones ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Public can read shipping zones" ON public.shipping_zones;
    CREATE POLICY "Public can read shipping zones"
      ON public.shipping_zones FOR SELECT
      USING (true);

    DROP POLICY IF EXISTS "Staff can update shipping zones" ON public.shipping_zones;
    DROP POLICY IF EXISTS "Staff can manage shipping zones" ON public.shipping_zones;
    CREATE POLICY "Staff can manage shipping zones"
      ON public.shipping_zones FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.customers c
          WHERE c.id = auth.uid() AND c.role IN ('admin', 'support')
        )
      );
  END IF;
END $$;

-- ─── 9. FIX ORDERS: Ensure payment_method column stores correct values ─────────
-- Add index to speed up order status lookups
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON public.orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON public.orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_method ON public.orders(payment_method);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);

-- ─── 10. ORDERS: Ensure order status link works for order-account linking ──────
-- Add index on shipping_address_snapshot for faster guest order lookups
CREATE INDEX IF NOT EXISTS idx_orders_customer_null ON public.orders(customer_id) WHERE customer_id IS NULL;
