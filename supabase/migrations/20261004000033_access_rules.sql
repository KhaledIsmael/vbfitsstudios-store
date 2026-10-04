-- ==============================================================================
-- VB FITS STUDIOS
-- Migration: 20261004000033_access_rules.sql  (alias: 002_access_rules.sql)
-- Purpose:   Single authoritative file that defines every GRANT and RLS policy
--            the frozen application code requires.
--            Run AFTER all earlier migrations (000000 through 000032).
--
-- TABLE ACCESS MAP (derived by reading every .from() call in src/ and api/)
-- ----------------------------------------------------------------------------
-- BROWSER / ANON KEY (storefront + admin UI — both use the anon key):
--   Public reads (no session needed):
--     products, product_variants, product_images, categories,
--     hero_banners, chatbot_faqs, shipping_zones, store_settings, site_settings
--   Write (anon/guest):
--     orders (insert guest order), order_items (insert with order),
--     cart_items, newsletter_subscribers (subscribe), waitlist_signups,
--     restock_signups, chatbot_logs
--   Own-row access (authenticated customer session):
--     customers (own row), addresses (own rows), orders (own + guest),
--     order_items (via own orders), wishlists, return_requests (insert + own read)
--   Admin-only browser access (authenticated admin session, same anon key,
--   role check via is_admin() / is_admin_or_support()):
--     hero_banners (write), discount_codes (write), store_settings (write),
--     site_settings (write), newsletter_subscribers (read), waitlist_signups (read),
--     return_requests (admin read/update), refunds (write), customers (read all),
--     products/variants/images (write), categories (write), shipping_zones (write),
--     restock_signups (read all)
--
-- SERVICE ROLE (serverless /api/* routes — bypasses RLS automatically):
--     orders, order_items, customers, cart_items, abandoned_cart_emails,
--     email_logs, restock_notifications, chatbot_faqs, chatbot_logs,
--     return_requests, site_settings, store_settings
--
-- SECURITY NOTE — admin identity:
--   Both supabase and adminSupabase in the browser use the ANON key.
--   Admin identity = customers.role = 'admin', checked by is_admin() which is
--   SECURITY DEFINER and cannot be spoofed through RLS.
--   Migration 000032 ensures:
--     (a) handle_new_customer never copies role from user metadata.
--     (b) customers_update_own WITH CHECK prevents self-promotion.
--   Risk: if someone inserts directly into customers via a future misconfigured
--   policy they could self-promote. The policies below guard against this.
-- ==============================================================================

-- ============================================================
-- 0. HELPER FUNCTIONS (idempotent — recreate in case missing)
-- ============================================================

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

GRANT EXECUTE ON FUNCTION public.is_admin()            TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_or_support() TO anon, authenticated;

-- ============================================================
-- 1. GRANTS
--    Rule: grant the minimum privilege each role needs.
--    RLS then further restricts which ROWS each session can see.
-- ============================================================

-- ── Catalog (anyone can read published products) ──────────────────────────────
GRANT SELECT ON public.products         TO anon, authenticated, service_role;
GRANT SELECT ON public.product_variants TO anon, authenticated, service_role;
GRANT SELECT ON public.product_images   TO anon, authenticated, service_role;
GRANT SELECT ON public.categories       TO anon, authenticated, service_role;

-- Admin browser writes (authenticated session + is_admin_or_support RLS check)
GRANT INSERT, UPDATE, DELETE ON public.products         TO authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON public.product_variants TO authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON public.product_images   TO authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON public.categories       TO authenticated, service_role;

-- ── Orders ────────────────────────────────────────────────────────────────────
-- anon: INSERT only (guest checkout). RLS limits SELECT/UPDATE to own rows.
-- authenticated: own rows. service_role: all rows (webhooks, cron).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders      TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO anon, authenticated, service_role;

-- ── Customers ─────────────────────────────────────────────────────────────────
-- anon: no access (no SELECT grant). authenticated: own row only (RLS).
-- service_role: all rows (cron abandoned-cart, webhook).
GRANT SELECT, INSERT, UPDATE ON public.customers TO authenticated, service_role;

-- ── Addresses ────────────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.addresses TO authenticated, service_role;

-- ── Cart ─────────────────────────────────────────────────────────────────────
-- anon can also read/write cart (guest cart support)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cart_items TO anon, authenticated, service_role;

-- ── Wishlists ────────────────────────────────────────────────────────────────
GRANT SELECT, INSERT, DELETE ON public.wishlists TO authenticated, service_role;

-- ── Discount codes ───────────────────────────────────────────────────────────
-- anon: SELECT for code validation at checkout. Write via authenticated admin.
GRANT SELECT                         ON public.discount_codes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.discount_codes TO authenticated, service_role;

-- ── Returns ──────────────────────────────────────────────────────────────────
-- anon: INSERT (guest return). authenticated: own rows. admin: all.
GRANT SELECT, INSERT, UPDATE ON public.return_requests TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.refunds         TO authenticated, service_role;

-- ── Shipping ─────────────────────────────────────────────────────────────────
GRANT SELECT              ON public.shipping_zones TO anon, authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON public.shipping_zones TO authenticated, service_role;

-- ── Store config ─────────────────────────────────────────────────────────────
-- Public reads store_settings for product overrides and order status labels.
-- Only admin writes.
GRANT SELECT, INSERT, UPDATE ON public.store_settings TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.site_settings  TO anon, authenticated, service_role;

-- ── Hero banners ─────────────────────────────────────────────────────────────
GRANT SELECT              ON public.hero_banners TO anon, authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON public.hero_banners TO authenticated, service_role;

-- ── Chatbot ──────────────────────────────────────────────────────────────────
GRANT SELECT         ON public.chatbot_faqs TO anon, authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON public.chatbot_faqs TO authenticated, service_role;
GRANT SELECT, INSERT ON public.chatbot_logs TO anon, authenticated, service_role;

-- ── Newsletter & Waitlist ─────────────────────────────────────────────────────
GRANT INSERT ON public.newsletter_subscribers TO anon, authenticated;
GRANT SELECT ON public.newsletter_subscribers TO authenticated, service_role;

GRANT INSERT, SELECT ON public.waitlist_signups TO anon, authenticated, service_role;

-- ── Restock ──────────────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE ON public.restock_signups       TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.restock_notifications TO service_role;

-- ── Operational (server-only) ─────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE ON public.abandoned_cart_emails TO service_role;
GRANT SELECT, INSERT         ON public.email_logs           TO service_role;

-- Optional tables (created by migration 000032 if missing)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='order_status_history') THEN
    EXECUTE 'GRANT SELECT, INSERT ON public.order_status_history TO anon, authenticated, service_role';
  END IF;
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='loyalty_point_events') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE ON public.loyalty_point_events TO authenticated, service_role';
  END IF;
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='discount_code_uses') THEN
    EXECUTE 'GRANT SELECT, INSERT ON public.discount_code_uses TO anon, authenticated, service_role';
  END IF;
END $$;

-- ============================================================
-- 2. ROW LEVEL SECURITY POLICIES
--    Each table: enable RLS, drop every old policy, create the
--    exact minimum set the frozen code requires.
-- ============================================================

-- ── products ──────────────────────────────────────────────────────────────────
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "products_public_read"           ON public.products;
DROP POLICY IF EXISTS "products_select_all_or_admin"   ON public.products;
DROP POLICY IF EXISTS "Staff can insert products"      ON public.products;
DROP POLICY IF EXISTS "Staff can update products"      ON public.products;
DROP POLICY IF EXISTS "products_admin_write"           ON public.products;

-- Storefront sees only published+non-archived; admin sees everything
CREATE POLICY "products_select"
  ON public.products FOR SELECT
  USING (
    (is_published = true AND is_archived = false)
    OR public.is_admin_or_support()
  );

-- Only admin can create / edit / delete products
CREATE POLICY "products_admin_write"
  ON public.products FOR ALL
  USING (public.is_admin_or_support());

-- ── product_variants ─────────────────────────────────────────────────────────
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "variants_public_read"              ON public.product_variants;
DROP POLICY IF EXISTS "Staff can manage product variants" ON public.product_variants;

CREATE POLICY "variants_public_read"
  ON public.product_variants FOR SELECT USING (true);

CREATE POLICY "variants_admin_write"
  ON public.product_variants FOR ALL
  USING (public.is_admin_or_support());

-- ── product_images ────────────────────────────────────────────────────────────
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "product_images_public_read"      ON public.product_images;
DROP POLICY IF EXISTS "Staff can manage product images" ON public.product_images;

CREATE POLICY "product_images_public_read"
  ON public.product_images FOR SELECT USING (true);

CREATE POLICY "product_images_admin_write"
  ON public.product_images FOR ALL
  USING (public.is_admin_or_support());

-- ── categories ───────────────────────────────────────────────────────────────
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "categories_public_read" ON public.categories;
DROP POLICY IF EXISTS "categories_admin_write" ON public.categories;

CREATE POLICY "categories_public_read"
  ON public.categories FOR SELECT USING (true);

CREATE POLICY "categories_admin_write"
  ON public.categories FOR ALL
  USING (public.is_admin_or_support());

-- ── customers ─────────────────────────────────────────────────────────────────
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "customers_select_own_or_admin" ON public.customers;
DROP POLICY IF EXISTS "customers_update_own"          ON public.customers;
DROP POLICY IF EXISTS "customers_insert_own"          ON public.customers;

-- SELECT: own row or admin sees all
CREATE POLICY "customers_select_own_or_admin"
  ON public.customers FOR SELECT
  USING (id = auth.uid() OR public.is_admin_or_support());

-- INSERT: only through the auth trigger (handle_new_customer), or admin
CREATE POLICY "customers_insert_own"
  ON public.customers FOR INSERT
  WITH CHECK (id = auth.uid() OR public.is_admin());

-- UPDATE: own row or admin; role column is frozen for non-admins
CREATE POLICY "customers_update_own"
  ON public.customers FOR UPDATE
  USING (id = auth.uid() OR public.is_admin())
  WITH CHECK (
    CASE
      WHEN public.is_admin() THEN true
      -- Non-admin: new role must equal their current role (no self-promotion)
      ELSE role = (SELECT c.role FROM public.customers c WHERE c.id = auth.uid())
    END
  );

-- ── addresses ────────────────────────────────────────────────────────────────
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "addresses_select_own" ON public.addresses;
DROP POLICY IF EXISTS "addresses_insert_own" ON public.addresses;
DROP POLICY IF EXISTS "addresses_update_own" ON public.addresses;
DROP POLICY IF EXISTS "addresses_delete_own" ON public.addresses;

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

-- ── orders ────────────────────────────────────────────────────────────────────
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "orders_select_admin_or_own" ON public.orders;
DROP POLICY IF EXISTS "orders_insert_checkout"     ON public.orders;
DROP POLICY IF EXISTS "orders_update_admin_or_own" ON public.orders;
DROP POLICY IF EXISTS "orders_delete_admin"        ON public.orders;

-- SELECT: own orders, all guest orders (needed for order tracking), admin sees all
CREATE POLICY "orders_select"
  ON public.orders FOR SELECT
  USING (
    customer_id = auth.uid()
    OR customer_id IS NULL
    OR public.is_admin_or_support()
  );

-- INSERT: guest or authenticated customer or admin
CREATE POLICY "orders_insert"
  ON public.orders FOR INSERT
  WITH CHECK (
    customer_id IS NULL
    OR customer_id = auth.uid()
    OR public.is_admin_or_support()
  );

-- UPDATE: own order or admin
CREATE POLICY "orders_update"
  ON public.orders FOR UPDATE
  USING (
    customer_id = auth.uid()
    OR customer_id IS NULL
    OR public.is_admin_or_support()
  );

-- DELETE: admin only (test data purge)
CREATE POLICY "orders_delete"
  ON public.orders FOR DELETE
  USING (public.is_admin());

-- ── order_items ───────────────────────────────────────────────────────────────
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "order_items_select_admin_or_own" ON public.order_items;
DROP POLICY IF EXISTS "order_items_insert_checkout"     ON public.order_items;
DROP POLICY IF EXISTS "order_items_update_admin"        ON public.order_items;
DROP POLICY IF EXISTS "order_items_delete_admin"        ON public.order_items;

CREATE POLICY "order_items_select"
  ON public.order_items FOR SELECT
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

CREATE POLICY "order_items_insert"
  ON public.order_items FOR INSERT
  WITH CHECK (true);   -- order ownership enforced by the orders trigger

CREATE POLICY "order_items_update_admin"
  ON public.order_items FOR UPDATE
  USING (public.is_admin_or_support());

CREATE POLICY "order_items_delete_admin"
  ON public.order_items FOR DELETE
  USING (public.is_admin_or_support());

-- ── cart_items ────────────────────────────────────────────────────────────────
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cart_items_select_own" ON public.cart_items;
DROP POLICY IF EXISTS "cart_items_insert_own" ON public.cart_items;
DROP POLICY IF EXISTS "cart_items_update_own" ON public.cart_items;
DROP POLICY IF EXISTS "cart_items_delete_own" ON public.cart_items;

CREATE POLICY "cart_items_select_own"
  ON public.cart_items FOR SELECT
  USING (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "cart_items_insert_own"
  ON public.cart_items FOR INSERT
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "cart_items_update_own"
  ON public.cart_items FOR UPDATE
  USING (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "cart_items_delete_own"
  ON public.cart_items FOR DELETE
  USING (user_id = auth.uid() OR user_id IS NULL);

-- ── wishlists ─────────────────────────────────────────────────────────────────
ALTER TABLE public.wishlists ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "wishlists_select_own" ON public.wishlists;
DROP POLICY IF EXISTS "wishlists_insert_own" ON public.wishlists;
DROP POLICY IF EXISTS "wishlists_delete_own" ON public.wishlists;

CREATE POLICY "wishlists_select_own"
  ON public.wishlists FOR SELECT
  USING (customer_id = auth.uid() OR public.is_admin_or_support());

CREATE POLICY "wishlists_insert_own"
  ON public.wishlists FOR INSERT
  WITH CHECK (customer_id = auth.uid());

CREATE POLICY "wishlists_delete_own"
  ON public.wishlists FOR DELETE
  USING (customer_id = auth.uid() OR public.is_admin_or_support());

-- ── return_requests ───────────────────────────────────────────────────────────
ALTER TABLE public.return_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow inserts to return_requests"        ON public.return_requests;
DROP POLICY IF EXISTS "Customers can view own return requests"  ON public.return_requests;
DROP POLICY IF EXISTS "return_requests_admin_read"              ON public.return_requests;
DROP POLICY IF EXISTS "return_requests_admin_update"            ON public.return_requests;

-- Anyone can submit a return (guest or authenticated)
CREATE POLICY "return_requests_insert"
  ON public.return_requests FOR INSERT
  WITH CHECK (true);

-- SELECT: own or guest, or admin
CREATE POLICY "return_requests_select"
  ON public.return_requests FOR SELECT
  USING (
    customer_id = auth.uid()
    OR customer_id IS NULL
    OR public.is_admin_or_support()
  );

-- UPDATE: admin only (staff notes, status changes)
CREATE POLICY "return_requests_update"
  ON public.return_requests FOR UPDATE
  USING (public.is_admin_or_support());

-- ── refunds ───────────────────────────────────────────────────────────────────
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "refunds_admin_all"     ON public.refunds;
DROP POLICY IF EXISTS "refunds_customer_read" ON public.refunds;

CREATE POLICY "refunds_admin_all"
  ON public.refunds FOR ALL
  USING (public.is_admin_or_support());

-- Customer can read refunds linked to their own orders
CREATE POLICY "refunds_customer_read"
  ON public.refunds FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = refunds.order_id
        AND (o.customer_id = auth.uid() OR o.customer_id IS NULL)
    )
  );

-- ── discount_codes ────────────────────────────────────────────────────────────
ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "discount_codes_public_read" ON public.discount_codes;
DROP POLICY IF EXISTS "discount_codes_admin_write" ON public.discount_codes;
DROP POLICY IF EXISTS "Active discount codes are viewable by everyone" ON public.discount_codes;
DROP POLICY IF EXISTS "Public can check active discount codes" ON public.discount_codes;
DROP POLICY IF EXISTS "Staff can manage discount codes" ON public.discount_codes;

-- Storefront validates coupon codes at checkout (must read active codes)
CREATE POLICY "discount_codes_public_read"
  ON public.discount_codes FOR SELECT
  USING (is_active = true OR public.is_admin_or_support());

-- Only admin can create / edit / disable discount codes
CREATE POLICY "discount_codes_admin_write"
  ON public.discount_codes FOR ALL
  USING (public.is_admin_or_support());

-- ── shipping_zones ────────────────────────────────────────────────────────────
ALTER TABLE public.shipping_zones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can read shipping zones"  ON public.shipping_zones;
DROP POLICY IF EXISTS "Staff can manage shipping zones" ON public.shipping_zones;

CREATE POLICY "shipping_zones_public_read"
  ON public.shipping_zones FOR SELECT USING (true);

CREATE POLICY "shipping_zones_admin_write"
  ON public.shipping_zones FOR ALL
  USING (public.is_admin_or_support());

-- ── store_settings ────────────────────────────────────────────────────────────
-- Public needs SELECT (order status labels, product overrides, announcement bar).
-- Only admin writes.
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view store settings"         ON public.store_settings;
DROP POLICY IF EXISTS "Authenticated can upsert store settings" ON public.store_settings;
DROP POLICY IF EXISTS "Authenticated can insert store settings" ON public.store_settings;
DROP POLICY IF EXISTS "Staff can update store settings"        ON public.store_settings;
DROP POLICY IF EXISTS "store_settings_admin_write"             ON public.store_settings;
DROP POLICY IF EXISTS "store_settings_admin_update"            ON public.store_settings;

CREATE POLICY "store_settings_public_read"
  ON public.store_settings FOR SELECT USING (true);

CREATE POLICY "store_settings_admin_write"
  ON public.store_settings FOR INSERT
  WITH CHECK (public.is_admin_or_support());

CREATE POLICY "store_settings_admin_update"
  ON public.store_settings FOR UPDATE
  USING (public.is_admin_or_support());

-- ── site_settings ─────────────────────────────────────────────────────────────
-- Public SELECT needed for launch countdown. Admin writes.
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view site settings" ON public.site_settings;
DROP POLICY IF EXISTS "Staff can manage site settings" ON public.site_settings;

CREATE POLICY "site_settings_public_read"
  ON public.site_settings FOR SELECT USING (true);

CREATE POLICY "site_settings_admin_write"
  ON public.site_settings FOR ALL
  USING (public.is_admin_or_support());

-- ── hero_banners ──────────────────────────────────────────────────────────────
ALTER TABLE public.hero_banners ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "hero_banners_public_read" ON public.hero_banners;
DROP POLICY IF EXISTS "hero_banners_admin_write" ON public.hero_banners;

CREATE POLICY "hero_banners_public_read"
  ON public.hero_banners FOR SELECT USING (true);

CREATE POLICY "hero_banners_admin_write"
  ON public.hero_banners FOR ALL
  USING (public.is_admin_or_support());

-- ── chatbot_faqs ──────────────────────────────────────────────────────────────
ALTER TABLE public.chatbot_faqs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access to chatbot_faqs" ON public.chatbot_faqs;
DROP POLICY IF EXISTS "Allow admin full access to chatbot_faqs"  ON public.chatbot_faqs;

CREATE POLICY "chatbot_faqs_public_read"
  ON public.chatbot_faqs FOR SELECT USING (true);

CREATE POLICY "chatbot_faqs_admin_write"
  ON public.chatbot_faqs FOR ALL
  USING (public.is_admin_or_support());

-- ── chatbot_logs ──────────────────────────────────────────────────────────────
ALTER TABLE public.chatbot_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public insert access to chatbot_logs" ON public.chatbot_logs;
DROP POLICY IF EXISTS "Allow admin full access to chatbot_logs"    ON public.chatbot_logs;

-- Anyone can log a message; admin can read all logs
CREATE POLICY "chatbot_logs_insert"
  ON public.chatbot_logs FOR INSERT WITH CHECK (true);

CREATE POLICY "chatbot_logs_admin_read"
  ON public.chatbot_logs FOR SELECT
  USING (public.is_admin_or_support());

-- ── newsletter_subscribers ────────────────────────────────────────────────────
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "newsletter_insert_public" ON public.newsletter_subscribers;
DROP POLICY IF EXISTS "newsletter_select_none"   ON public.newsletter_subscribers;
DROP POLICY IF EXISTS "newsletter_admin_read"    ON public.newsletter_subscribers;

CREATE POLICY "newsletter_insert"
  ON public.newsletter_subscribers FOR INSERT WITH CHECK (true);

-- Admin reads the subscriber list from the browser (adminMarketing.ts)
CREATE POLICY "newsletter_admin_read"
  ON public.newsletter_subscribers FOR SELECT
  USING (public.is_admin_or_support());

-- Admin can update status (unsubscribe / re-subscribe from dashboard)
CREATE POLICY "newsletter_admin_write"
  ON public.newsletter_subscribers FOR UPDATE
  USING (public.is_admin_or_support());

-- ── waitlist_signups ──────────────────────────────────────────────────────────
ALTER TABLE public.waitlist_signups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "waitlist_insert_public" ON public.waitlist_signups;
DROP POLICY IF EXISTS "waitlist_admin_read"    ON public.waitlist_signups;

CREATE POLICY "waitlist_insert"
  ON public.waitlist_signups FOR INSERT WITH CHECK (true);

CREATE POLICY "waitlist_admin_read"
  ON public.waitlist_signups FOR SELECT
  USING (public.is_admin_or_support());

-- ── restock_signups ───────────────────────────────────────────────────────────
ALTER TABLE public.restock_signups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "restock_signups_insert" ON public.restock_signups;
DROP POLICY IF EXISTS "restock_signups_admin"  ON public.restock_signups;

CREATE POLICY "restock_signups_insert"
  ON public.restock_signups FOR INSERT WITH CHECK (true);

CREATE POLICY "restock_signups_select"
  ON public.restock_signups FOR SELECT
  USING (public.is_admin_or_support());

CREATE POLICY "restock_signups_update_admin"
  ON public.restock_signups FOR UPDATE
  USING (public.is_admin_or_support());

-- ── email_logs (service-role only; no client access needed) ──────────────────
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;
-- No browser policy: service_role bypasses RLS automatically.

-- ── abandoned_cart_emails (service-role only) ──────────────────────────────
ALTER TABLE public.abandoned_cart_emails ENABLE ROW LEVEL SECURITY;
-- No browser policy needed.

-- ============================================================
-- 3. RELOAD PostgREST schema cache
-- ============================================================
NOTIFY pgrst, 'reload schema';
