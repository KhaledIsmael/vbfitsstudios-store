-- ==============================================================================
-- VB FITS STUDIOS
-- Migration: 20261004000032_close_all_remaining_gaps.sql
-- Description: Closes every remaining gap identified in DB_GAP_REPORT.md:
--   1. Missing columns on orders, product_images, return_requests, shipping_zones
--   2. discount_codes.discount_type CHECK extended to accept 'fixed'
--   3. orders.status CHECK extended to include 'placed', 'confirmed', 'packed',
--      'shipped', 'out_for_delivery' + payment_status includes 'pending',
--      'pending_collection'
--   4. purge_all_test_data() revoked from anon / authenticated (admin RPC only)
--   5. handle_new_customer trigger hardened -- no longer copies role from metadata
--   6. customers_update_own policy blocks self-promotion (role column guarded)
--   7. Missing GRANTs on every table the browser / service-role touches
--   8. archive flag auto-unpublishes products (trigger + back-fill)
--   9. chatbot_faqs.category column added
--  10. Alias columns shipping_fee and rate added to shipping_zones
--  11. low_stock_threshold column added to product_variants (used by inventory)
--  12. Reload PostgREST schema cache
-- ==============================================================================

-- =============================================================================
-- 1. ORDERS -- missing columns and CHECK fixes
-- =============================================================================

-- 1a. discount_code (raw string the customer typed, not the FK)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS discount_code TEXT;

-- 1b. shipping_company (carrier name set by admin when dispatching)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS shipping_company TEXT;

-- 1c. internal_notes (staff-only memo, read/written by AdminOrdersPage)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS internal_notes TEXT;

-- 1d. delivered_at (timestamp set when status reaches 'delivered')
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

-- 1e. payment_method (guard in case earlier migration did not add it)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_method TEXT;

-- 1f. Widen status CHECK to all values the code sends
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_status_check CHECK (
    status IN (
      'placed', 'pending', 'confirmed', 'processing',
      'packed', 'shipped', 'in_transit', 'out_for_delivery',
      'delivered', 'cancelled', 'refunded'
    )
  );

-- 1g. Widen payment_status CHECK to include 'pending' and 'pending_collection'
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_payment_status_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_payment_status_check CHECK (
    payment_status IN (
      'pending', 'unpaid', 'paid', 'failed', 'refunded', 'pending_collection'
    )
  );

-- =============================================================================
-- 2. PRODUCT_IMAGES -- add media_type and video_poster_url
--    (migration 25 added these to hero_banners only, not product_images)
-- =============================================================================

ALTER TABLE public.product_images
  ADD COLUMN IF NOT EXISTS media_type TEXT NOT NULL DEFAULT 'image'
    CHECK (media_type IN ('image', 'video', 'gif')),
  ADD COLUMN IF NOT EXISTS video_poster_url TEXT;

-- =============================================================================
-- 3. RETURN_REQUESTS -- missing columns
--    (migration 30 added refund_method etc. but missed staff_notes,
--     refund_amount, items, updated_at)
-- =============================================================================

ALTER TABLE public.return_requests
  ADD COLUMN IF NOT EXISTS staff_notes   TEXT,
  ADD COLUMN IF NOT EXISTS refund_amount NUMERIC(10, 2)
    CHECK (refund_amount IS NULL OR refund_amount >= 0),
  ADD COLUMN IF NOT EXISTS items         JSONB,
  ADD COLUMN IF NOT EXISTS updated_at    TIMESTAMPTZ NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS tr_return_requests_updated_at ON public.return_requests;
CREATE TRIGGER tr_return_requests_updated_at
  BEFORE UPDATE ON public.return_requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =============================================================================
-- 4. SHIPPING_ZONES -- add shipping_fee and rate alias columns
--    adminShipping.ts writes all three: shipping_rate, shipping_fee, rate
-- =============================================================================

ALTER TABLE public.shipping_zones
  ADD COLUMN IF NOT EXISTS shipping_fee NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS rate         NUMERIC(10, 2);

-- Back-fill from the authoritative shipping_rate column
UPDATE public.shipping_zones
SET
  shipping_fee = COALESCE(shipping_fee, shipping_rate),
  rate         = COALESCE(rate,         shipping_rate)
WHERE shipping_fee IS NULL OR rate IS NULL;

-- Trigger: keep all three columns in sync
CREATE OR REPLACE FUNCTION public.sync_shipping_zone_rate()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.shipping_rate IS DISTINCT FROM OLD.shipping_rate THEN
    NEW.shipping_fee := NEW.shipping_rate;
    NEW.rate         := NEW.shipping_rate;
  ELSIF NEW.shipping_fee IS DISTINCT FROM OLD.shipping_fee THEN
    NEW.shipping_rate := NEW.shipping_fee;
    NEW.rate          := NEW.shipping_fee;
  ELSIF NEW.rate IS DISTINCT FROM OLD.rate THEN
    NEW.shipping_rate := NEW.rate;
    NEW.shipping_fee  := NEW.rate;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_sync_shipping_zone_rate ON public.shipping_zones;
CREATE TRIGGER tr_sync_shipping_zone_rate
  BEFORE UPDATE ON public.shipping_zones
  FOR EACH ROW EXECUTE FUNCTION public.sync_shipping_zone_rate();

-- =============================================================================
-- 5. DISCOUNT_CODES -- extend CHECK to also accept 'fixed'
--    The code sends 'fixed'; the DB only allowed 'fixed_amount'.
-- =============================================================================

ALTER TABLE public.discount_codes
  DROP CONSTRAINT IF EXISTS discount_codes_discount_type_check;

ALTER TABLE public.discount_codes
  ADD CONSTRAINT discount_codes_discount_type_check
    CHECK (discount_type IN ('percentage', 'fixed_amount', 'fixed'));

-- alias columns that adminMarketing.ts reads
ALTER TABLE public.discount_codes
  ADD COLUMN IF NOT EXISTS min_spend  NUMERIC(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS times_used INT            NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_uses   INT,
  ADD COLUMN IF NOT EXISTS starts_at  TIMESTAMPTZ   NOT NULL DEFAULT now();

-- back-fill alias columns from older column names where they exist
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.columns
             WHERE table_schema='public' AND table_name='discount_codes'
               AND column_name='used_count') THEN
    UPDATE public.discount_codes
    SET times_used = COALESCE(used_count, 0)
    WHERE times_used = 0 AND used_count > 0;
  END IF;
  IF EXISTS (SELECT FROM information_schema.columns
             WHERE table_schema='public' AND table_name='discount_codes'
               AND column_name='min_order_value') THEN
    UPDATE public.discount_codes
    SET min_spend = COALESCE(min_order_value, 0)
    WHERE min_spend = 0 AND min_order_value > 0;
  END IF;
END $$;

-- =============================================================================
-- 6. PRODUCT_VARIANTS -- low_stock_threshold used by inventory admin
-- =============================================================================

ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS low_stock_threshold INTEGER NOT NULL DEFAULT 5;

-- =============================================================================
-- 7. CHATBOT_FAQS -- category column
-- =============================================================================

ALTER TABLE public.chatbot_faqs
  ADD COLUMN IF NOT EXISTS category TEXT;

-- =============================================================================
-- 8. SECURITY -- revoke purge_all_test_data() from anon / authenticated
--    (migration 31 accidentally granted it to everyone)
-- =============================================================================

REVOKE EXECUTE ON FUNCTION public.purge_all_test_data() FROM anon;
REVOKE EXECUTE ON FUNCTION public.purge_all_test_data() FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.purge_all_test_data() TO service_role;

-- Recreate with hard is_admin() guard
CREATE OR REPLACE FUNCTION public.purge_all_test_data()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'vbfits_forbidden: admin session required to purge data.'
      USING ERRCODE = '42501';
  END IF;
  TRUNCATE TABLE public.order_items, public.orders CASCADE;
  TRUNCATE TABLE public.return_requests CASCADE;
  RETURN json_build_object(
    'success', true,
    'message', 'All test orders and items purged successfully.'
  );
END;
$$;

-- =============================================================================
-- 9. SECURITY -- harden handle_new_customer trigger
--    Never copy role from user metadata; always assign 'customer'.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_customer()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.customers (
    id, email, full_name, avatar_url, phone, role
  ) VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name'
    ),
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'phone',
    'customer'  -- NEVER copy role from metadata -- prevents self-promotion
  )
  ON CONFLICT (id) DO UPDATE SET
    email      = EXCLUDED.email,
    full_name  = COALESCE(EXCLUDED.full_name,  public.customers.full_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.customers.avatar_url),
    phone      = COALESCE(EXCLUDED.phone,      public.customers.phone),
    updated_at = timezone('utc'::text, now());
    -- role intentionally NOT updated; only admin can change role
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_customer();

CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_customer();

-- =============================================================================
-- 10. SECURITY -- block customers from self-promoting their own role
-- =============================================================================

DROP POLICY IF EXISTS "customers_update_own" ON public.customers;

CREATE POLICY "customers_update_own"
  ON public.customers FOR UPDATE
  USING (id = auth.uid() OR public.is_admin())
  WITH CHECK (
    CASE
      WHEN public.is_admin() THEN true
      ELSE (role = (SELECT c.role FROM public.customers c WHERE c.id = auth.uid()))
    END
  );

-- =============================================================================
-- 11. ARCHIVE AUTO-UNPUBLISH
--     When is_archived = true, force is_published = false.
--     When is_archived = false (un-archive), restore is_published = true.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.enforce_archive_unpublish()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_archived = true THEN
    NEW.is_published := false;
  END IF;
  IF NEW.is_archived = false AND OLD.is_archived = true
     AND NEW.is_published IS NOT DISTINCT FROM false THEN
    NEW.is_published := true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_enforce_archive_unpublish ON public.products;
CREATE TRIGGER tr_enforce_archive_unpublish
  BEFORE UPDATE OF is_archived ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.enforce_archive_unpublish();

-- Back-fill: archived products still showing as published
UPDATE public.products
SET is_published = false
WHERE is_archived = true AND is_published = true;

-- =============================================================================
-- 12. GRANTs -- every table the browser or service-role touches
-- =============================================================================

-- Catalog (public read)
GRANT SELECT ON public.products          TO anon, authenticated, service_role;
GRANT SELECT ON public.product_variants  TO anon, authenticated, service_role;
GRANT SELECT ON public.product_images    TO anon, authenticated, service_role;
GRANT SELECT ON public.categories        TO anon, authenticated, service_role;

-- Catalog management (admin/staff via is_admin_or_support() RLS)
GRANT INSERT, UPDATE, DELETE ON public.products         TO authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON public.product_variants TO authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON public.product_images   TO authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON public.categories       TO authenticated, service_role;

-- Orders + items
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders      TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO anon, authenticated, service_role;

-- Customers & addresses
GRANT SELECT, INSERT, UPDATE ON public.customers             TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.addresses     TO authenticated, service_role;

-- Discount codes (anon read for validation; admin writes via RLS)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.discount_codes TO authenticated, service_role;
GRANT SELECT                         ON public.discount_codes TO anon;

-- Refunds & returns
GRANT SELECT, INSERT, UPDATE ON public.refunds         TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.return_requests TO anon, authenticated, service_role;

-- Shipping zones
GRANT SELECT              ON public.shipping_zones TO anon, authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON public.shipping_zones TO authenticated, service_role;

-- Store config
GRANT SELECT, INSERT, UPDATE ON public.store_settings TO anon, authenticated, service_role;
GRANT ALL                    ON public.site_settings  TO anon, authenticated, service_role;

-- Hero banners
GRANT SELECT                 ON public.hero_banners TO anon, authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON public.hero_banners TO authenticated, service_role;

-- Chatbot
GRANT SELECT             ON public.chatbot_faqs TO anon, authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON public.chatbot_faqs TO authenticated, service_role;
GRANT SELECT, INSERT     ON public.chatbot_logs TO anon, authenticated, service_role;

-- Newsletter
GRANT INSERT ON public.newsletter_subscribers TO anon, authenticated, service_role;
GRANT SELECT ON public.newsletter_subscribers TO service_role;

-- Waitlist
GRANT INSERT, SELECT ON public.waitlist_signups TO anon, authenticated, service_role;

-- Restock
GRANT SELECT, INSERT, UPDATE ON public.restock_signups       TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.restock_notifications TO service_role;

-- Cart
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cart_items TO anon, authenticated, service_role;

-- Wishlists
GRANT SELECT, INSERT, DELETE ON public.wishlists TO authenticated, service_role;

-- Abandoned cart emails (cron)
GRANT SELECT, INSERT, UPDATE ON public.abandoned_cart_emails TO service_role;

-- Email logs
GRANT SELECT, INSERT ON public.email_logs TO service_role;

-- =============================================================================
-- 13. ADDITIONAL RLS POLICIES for tables missing them
-- =============================================================================

-- categories
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "categories_public_read" ON public.categories;
CREATE POLICY "categories_public_read"
  ON public.categories FOR SELECT USING (true);
DROP POLICY IF EXISTS "categories_admin_write" ON public.categories;
CREATE POLICY "categories_admin_write"
  ON public.categories FOR ALL USING (public.is_admin_or_support());

-- hero_banners
ALTER TABLE public.hero_banners ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "hero_banners_public_read" ON public.hero_banners;
CREATE POLICY "hero_banners_public_read"
  ON public.hero_banners FOR SELECT USING (true);
DROP POLICY IF EXISTS "hero_banners_admin_write" ON public.hero_banners;
CREATE POLICY "hero_banners_admin_write"
  ON public.hero_banners FOR ALL USING (public.is_admin_or_support());

-- newsletter_subscribers
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "newsletter_insert_public" ON public.newsletter_subscribers;
CREATE POLICY "newsletter_insert_public"
  ON public.newsletter_subscribers FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "newsletter_select_none" ON public.newsletter_subscribers;
DROP POLICY IF EXISTS "newsletter_admin_read" ON public.newsletter_subscribers;
CREATE POLICY "newsletter_admin_read"
  ON public.newsletter_subscribers FOR SELECT USING (public.is_admin_or_support());

-- discount_codes
ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "discount_codes_public_read" ON public.discount_codes;
CREATE POLICY "discount_codes_public_read"
  ON public.discount_codes FOR SELECT USING (is_active = true);
DROP POLICY IF EXISTS "discount_codes_admin_write" ON public.discount_codes;
CREATE POLICY "discount_codes_admin_write"
  ON public.discount_codes FOR ALL USING (public.is_admin_or_support());

-- return_requests (supplement migrations 27/29/30)
ALTER TABLE public.return_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "return_requests_admin_read" ON public.return_requests;
CREATE POLICY "return_requests_admin_read"
  ON public.return_requests FOR SELECT
  USING (public.is_admin_or_support()
         OR customer_id = auth.uid()
         OR customer_id IS NULL);
DROP POLICY IF EXISTS "return_requests_admin_update" ON public.return_requests;
CREATE POLICY "return_requests_admin_update"
  ON public.return_requests FOR UPDATE
  USING (public.is_admin_or_support());

-- refunds
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "refunds_admin_all" ON public.refunds;
CREATE POLICY "refunds_admin_all"
  ON public.refunds FOR ALL USING (public.is_admin_or_support());
DROP POLICY IF EXISTS "refunds_customer_read" ON public.refunds;
CREATE POLICY "refunds_customer_read"
  ON public.refunds FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = refunds.order_id
        AND (o.customer_id = auth.uid() OR o.customer_id IS NULL)
    )
  );

-- store_settings: tighten -- only admin writes
DROP POLICY IF EXISTS "Authenticated can upsert store settings" ON public.store_settings;
DROP POLICY IF EXISTS "Authenticated can insert store settings" ON public.store_settings;
DROP POLICY IF EXISTS "Staff can update store settings" ON public.store_settings;
DROP POLICY IF EXISTS "store_settings_admin_write" ON public.store_settings;
DROP POLICY IF EXISTS "store_settings_admin_update" ON public.store_settings;
CREATE POLICY "store_settings_admin_write"
  ON public.store_settings FOR INSERT WITH CHECK (public.is_admin_or_support());
CREATE POLICY "store_settings_admin_update"
  ON public.store_settings FOR UPDATE USING (public.is_admin_or_support());

-- addresses
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "addresses_select_own"  ON public.addresses;
DROP POLICY IF EXISTS "addresses_insert_own"  ON public.addresses;
DROP POLICY IF EXISTS "addresses_update_own"  ON public.addresses;
DROP POLICY IF EXISTS "addresses_delete_own"  ON public.addresses;
CREATE POLICY "addresses_select_own"
  ON public.addresses FOR SELECT
  USING (customer_id = auth.uid() OR public.is_admin_or_support());
CREATE POLICY "addresses_insert_own"
  ON public.addresses FOR INSERT
  WITH CHECK (customer_id = auth.uid() OR public.is_admin_or_support());
CREATE POLICY "addresses_update_own"
  ON public.addresses FOR UPDATE
  USING (customer_id = auth.uid() OR public.is_admin_or_support());
CREATE POLICY "addresses_delete_own"
  ON public.addresses FOR DELETE
  USING (customer_id = auth.uid() OR public.is_admin_or_support());

-- waitlist_signups
ALTER TABLE public.waitlist_signups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "waitlist_insert_public" ON public.waitlist_signups;
CREATE POLICY "waitlist_insert_public"
  ON public.waitlist_signups FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "waitlist_admin_read" ON public.waitlist_signups;
CREATE POLICY "waitlist_admin_read"
  ON public.waitlist_signups FOR SELECT USING (public.is_admin_or_support());

-- =============================================================================
-- 14. OPTIONAL TABLES -- create if missing
-- =============================================================================

DO $$
BEGIN
  -- order_status_history
  IF NOT EXISTS (
    SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'order_status_history'
  ) THEN
    CREATE TABLE public.order_status_history (
      id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id   UUID        NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
      status     TEXT        NOT NULL,
      note       TEXT,
      created_by UUID        REFERENCES public.customers(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "order_status_history_admin"
      ON public.order_status_history FOR ALL USING (public.is_admin_or_support());
    CREATE POLICY "order_status_history_read_own"
      ON public.order_status_history FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.orders o
          WHERE o.id = order_status_history.order_id
            AND (o.customer_id = auth.uid() OR o.customer_id IS NULL)
        )
      );
  END IF;

  -- loyalty_point_events
  IF NOT EXISTS (
    SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'loyalty_point_events'
  ) THEN
    CREATE TABLE public.loyalty_point_events (
      id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      customer_id UUID        NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
      points      INTEGER     NOT NULL,
      event_type  TEXT        NOT NULL,
      reference   TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    ALTER TABLE public.loyalty_point_events ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "loyalty_admin_all"
      ON public.loyalty_point_events FOR ALL USING (public.is_admin_or_support());
    CREATE POLICY "loyalty_customer_read"
      ON public.loyalty_point_events FOR SELECT USING (customer_id = auth.uid());
  END IF;

  -- discount_code_uses
  IF NOT EXISTS (
    SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'discount_code_uses'
  ) THEN
    CREATE TABLE public.discount_code_uses (
      id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      discount_code_id UUID        REFERENCES public.discount_codes(id) ON DELETE SET NULL,
      order_id         UUID        REFERENCES public.orders(id)          ON DELETE SET NULL,
      customer_id      UUID        REFERENCES public.customers(id)       ON DELETE SET NULL,
      used_at          TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    ALTER TABLE public.discount_code_uses ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "discount_code_uses_admin"
      ON public.discount_code_uses FOR ALL USING (public.is_admin_or_support());
    CREATE POLICY "discount_code_uses_insert"
      ON public.discount_code_uses FOR INSERT WITH CHECK (true);
  END IF;
END $$;

-- =============================================================================
-- 15. Reload PostgREST schema cache
-- =============================================================================
NOTIFY pgrst, 'reload schema';
