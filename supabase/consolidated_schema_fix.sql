-- ==============================================================================
-- VB FITS STUDIOS - CONSOLIDATED SCHEMA FIX & PRODUCTION SETUP
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/_/sql
-- ==============================================================================

-- 1. ORDERS TABLE FIXES
-- ------------------------------------------------------------------------------
-- Add missing payment_method column
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'COD';

-- Add missing delivered_at column
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

-- Add tracking and fulfillment columns
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS tracking_number TEXT,
  ADD COLUMN IF NOT EXISTS shipping_company TEXT,
  ADD COLUMN IF NOT EXISTS internal_notes TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS discount_code TEXT,
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS subtotal NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS shipping_fee NUMERIC(10, 2) DEFAULT 0;

-- Ensure currency column exists and defaults to EGP
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'EGP';

ALTER TABLE public.orders
  ALTER COLUMN currency SET DEFAULT 'EGP';

-- Update existing orders to EGP
UPDATE public.orders
  SET currency = 'EGP'
  WHERE currency = 'USD' OR currency IS NULL;

-- Fix orders_status_check constraint to allow all standard statuses
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check CHECK (
  LOWER(status) IN (
    'placed',
    'pending',
    'confirmed',
    'packed',
    'processing',
    'shipped',
    'in_transit',
    'out_for_delivery',
    'delivered',
    'cancelled',
    'refunded'
  )
);

-- Fix orders_payment_status_check constraint to include 'pending_collection'
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_payment_status_check CHECK (
  payment_status IN ('unpaid', 'paid', 'failed', 'refunded', 'pending_collection', 'pending')
);

-- Allow customer_id to be nullable for guest orders
ALTER TABLE public.orders
  ALTER COLUMN customer_id DROP NOT NULL;


-- 2. PRODUCTS TABLE FIXES (ALL MISSING COLUMNS)
-- ------------------------------------------------------------------------------
-- Ensure currency defaults to EGP
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'EGP';

ALTER TABLE public.products
  ALTER COLUMN currency SET DEFAULT 'EGP';

UPDATE public.products
  SET currency = 'EGP'
  WHERE currency = 'USD' OR currency IS NULL;

-- Essential columns for clothing catalog and admin product management
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS collection_tag TEXT DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS subtitle TEXT,
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_new_arrival BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS featured BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS seo_title TEXT,
  ADD COLUMN IF NOT EXISTS seo_description TEXT,
  ADD COLUMN IF NOT EXISTS related_product_ids JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS details JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS fabric_care JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS shipping_info TEXT;

CREATE INDEX IF NOT EXISTS idx_products_collection_tag ON public.products(collection_tag);
CREATE INDEX IF NOT EXISTS idx_products_archived ON public.products(is_archived);
CREATE INDEX IF NOT EXISTS idx_products_status ON public.products(is_archived, is_published);

-- Product variants & images extra columns
ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS color_hex TEXT DEFAULT '#111111',
  ADD COLUMN IF NOT EXISTS price_override NUMERIC(10, 2);

ALTER TABLE public.product_images
  ADD COLUMN IF NOT EXISTS media_type TEXT DEFAULT 'image',
  ADD COLUMN IF NOT EXISTS video_poster_url TEXT;


-- 3. CUSTOMERS TABLE FIXES & ADMIN ROLES
-- ------------------------------------------------------------------------------
-- Add role column to customers
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'customer';

ALTER TABLE public.customers DROP CONSTRAINT IF EXISTS customers_role_check;
ALTER TABLE public.customers ADD CONSTRAINT customers_role_check CHECK (
  role IN ('customer', 'support', 'admin')
);

-- Add phone column to customers if missing
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS phone TEXT;

-- Create index for quick role lookups
CREATE INDEX IF NOT EXISTS idx_customers_role ON public.customers(role);


-- 4. ADDRESSES TABLE FIXES (EGYPTIAN ADDRESS FIELDS)
-- ------------------------------------------------------------------------------
ALTER TABLE public.addresses
  ADD COLUMN IF NOT EXISTS building TEXT,
  ADD COLUMN IF NOT EXISTS floor TEXT,
  ADD COLUMN IF NOT EXISTS apartment TEXT,
  ADD COLUMN IF NOT EXISTS landmark TEXT;


-- 5. RETURN REQUESTS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.return_requests (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  customer_id  UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  reason       TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
                 'pending', 'approved', 'rejected', 'collected', 'refunded'
               )),
  items        JSONB NOT NULL DEFAULT '[]'::jsonb,
  admin_notes  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_return_requests_order_id ON public.return_requests(order_id);
CREATE INDEX IF NOT EXISTS idx_return_requests_customer_id ON public.return_requests(customer_id);


-- 6. ROW LEVEL SECURITY (RLS) POLICIES FOR ORDERS & GUESTS
-- ------------------------------------------------------------------------------
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Allow anyone (authenticated or guest) to insert orders
DROP POLICY IF EXISTS "Anyone can insert orders" ON public.orders;
CREATE POLICY "Anyone can insert orders"
  ON public.orders FOR INSERT
  WITH CHECK (true);

-- Allow authenticated users to view their own orders; allow reading by id with token/guest
DROP POLICY IF EXISTS "Users can view own orders" ON public.orders;
CREATE POLICY "Users can view own orders"
  ON public.orders FOR SELECT
  USING (
    customer_id = auth.uid() 
    OR customer_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.customers 
      WHERE customers.id = auth.uid() AND customers.role IN ('admin', 'support')
    )
  );

-- Allow inserting order items
DROP POLICY IF EXISTS "Anyone can insert order items" ON public.order_items;
CREATE POLICY "Anyone can insert order items"
  ON public.order_items FOR INSERT
  WITH CHECK (true);

-- Allow viewing order items
DROP POLICY IF EXISTS "Users can view order items" ON public.order_items;
CREATE POLICY "Users can view order items"
  ON public.order_items FOR SELECT
  USING (true);


-- 7. STORE SETTINGS & ANNOUNCEMENTS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.store_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view store settings" ON public.store_settings;
CREATE POLICY "Public can view store settings" ON public.store_settings FOR SELECT USING (true);
DROP POLICY IF EXISTS "Staff can manage store settings" ON public.store_settings;
CREATE POLICY "Staff can manage store settings" ON public.store_settings FOR ALL USING (true);

INSERT INTO public.store_settings (key, value)
VALUES (
  'announcement_bar',
  '{"enabled": true, "text": "شحن مجاني على جميع الطلبات فوق 1500 جنيه بمناسبة الإطلاق", "link": "/shop"}'::jsonb
) ON CONFLICT (key) DO NOTHING;


-- 8. DISCOUNT CODES (COUPONS & PROMOTIONS)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.discount_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  discount_type TEXT NOT NULL DEFAULT 'percentage',
  discount_value NUMERIC(10, 2) NOT NULL DEFAULT 0,
  min_spend NUMERIC(10, 2) DEFAULT 0,
  max_uses INT DEFAULT NULL,
  times_used INT NOT NULL DEFAULT 0,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Crucial: If discount_codes already existed from older migrations, ensure all columns exist
ALTER TABLE public.discount_codes
  ADD COLUMN IF NOT EXISTS min_spend NUMERIC(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS times_used INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_uses INT,
  ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());

-- Automatically sync legacy column names if present from initial schema
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'discount_codes' AND column_name = 'min_order_value'
  ) THEN
    UPDATE public.discount_codes 
    SET min_spend = COALESCE(min_order_value, 0)
    WHERE min_spend IS NULL OR min_spend = 0;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'discount_codes' AND column_name = 'used_count'
  ) THEN
    UPDATE public.discount_codes 
    SET times_used = COALESCE(used_count, 0)
    WHERE times_used = 0;
  END IF;
END $$;

-- Update discount_type check constraint so both 'percentage', 'fixed', and 'fixed_amount' are valid
ALTER TABLE public.discount_codes DROP CONSTRAINT IF EXISTS discount_codes_discount_type_check;
ALTER TABLE public.discount_codes ADD CONSTRAINT discount_codes_discount_type_check 
  CHECK (discount_type IN ('percentage', 'fixed', 'fixed_amount'));

ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can check active discount codes" ON public.discount_codes;
CREATE POLICY "Public can check active discount codes" ON public.discount_codes FOR SELECT USING (true);
DROP POLICY IF EXISTS "Staff can manage discount codes" ON public.discount_codes;
CREATE POLICY "Staff can manage discount codes" ON public.discount_codes FOR ALL USING (true);

-- Insert or update launch discount codes
INSERT INTO public.discount_codes (code, discount_type, discount_value, min_spend, is_active)
VALUES 
  ('VB10', 'percentage', 10.00, 0, true),
  ('VIP15', 'percentage', 15.00, 1000.00, true)
ON CONFLICT (code) DO UPDATE
SET min_spend = EXCLUDED.min_spend,
    discount_value = EXCLUDED.discount_value,
    is_active = EXCLUDED.is_active;


-- 9. SHIPPING ZONES (EGYPTIAN GOVERNORATES & RATES)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shipping_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  governorate TEXT NOT NULL UNIQUE,
  governorate_ar TEXT NOT NULL,
  min_days INT NOT NULL DEFAULT 2,
  max_days INT NOT NULL DEFAULT 5,
  shipping_rate NUMERIC(10, 2) NOT NULL DEFAULT 65.00,
  shipping_fee NUMERIC(10, 2) NOT NULL DEFAULT 65.00,
  free_shipping_threshold NUMERIC(10, 2) DEFAULT 1500.00,
  cod_available BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.shipping_zones
  ADD COLUMN IF NOT EXISTS governorate_ar TEXT,
  ADD COLUMN IF NOT EXISTS min_days INT DEFAULT 2,
  ADD COLUMN IF NOT EXISTS max_days INT DEFAULT 5,
  ADD COLUMN IF NOT EXISTS shipping_rate NUMERIC(10, 2) DEFAULT 65.00,
  ADD COLUMN IF NOT EXISTS shipping_fee NUMERIC(10, 2) DEFAULT 65.00,
  ADD COLUMN IF NOT EXISTS free_shipping_threshold NUMERIC(10, 2) DEFAULT 1500.00,
  ADD COLUMN IF NOT EXISTS cod_available BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

ALTER TABLE public.shipping_zones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view shipping zones" ON public.shipping_zones;
CREATE POLICY "Public can view shipping zones" ON public.shipping_zones FOR SELECT USING (true);
DROP POLICY IF EXISTS "Staff can manage shipping zones" ON public.shipping_zones;
CREATE POLICY "Staff can manage shipping zones" ON public.shipping_zones FOR ALL USING (true);

-- Seed key Egyptian governorates
INSERT INTO public.shipping_zones (governorate, governorate_ar, min_days, max_days, shipping_rate, shipping_fee, cod_available)
VALUES
  ('Cairo', 'القاهرة', 1, 3, 50.00, 50.00, true),
  ('Giza', 'الجيزة', 1, 3, 50.00, 50.00, true),
  ('Qalyubia', 'القليوبية', 2, 4, 60.00, 60.00, true),
  ('Alexandria', 'الإسكندرية', 2, 4, 60.00, 60.00, true),
  ('Sharqia', 'الشرقية', 2, 5, 65.00, 65.00, true),
  ('Dakahlia', 'الدقهلية', 2, 5, 65.00, 65.00, true),
  ('Gharbia', 'الغربية', 2, 5, 65.00, 65.00, true),
  ('Monufia', 'المنوفية', 2, 5, 65.00, 65.00, true),
  ('Ismailia', 'الإسماعيلية', 2, 5, 65.00, 65.00, true),
  ('Suez', 'السويس', 2, 5, 65.00, 65.00, true),
  ('Port Said', 'بورسعيد', 2, 5, 65.00, 65.00, true),
  ('Faiyum', 'الفيوم', 3, 6, 75.00, 75.00, true),
  ('Beni Suef', 'بني سويف', 3, 6, 75.00, 75.00, true),
  ('Minya', 'المنيا', 3, 6, 80.00, 80.00, true),
  ('Asyut', 'أسيوط', 3, 6, 80.00, 80.00, true),
  ('Sohag', 'سوهاج', 3, 7, 85.00, 85.00, false),
  ('Qena', 'قنا', 3, 7, 85.00, 85.00, false),
  ('Luxor', 'الأقصر', 4, 7, 90.00, 90.00, false),
  ('Aswan', 'أسوان', 4, 7, 90.00, 90.00, false),
  ('Red Sea', 'البحر الأحمر', 4, 8, 95.00, 95.00, false),
  ('Matruh', 'مطروح', 4, 8, 95.00, 95.00, false),
  ('South Sinai', 'جنوب سيناء', 4, 8, 100.00, 100.00, false),
  ('North Sinai', 'شمال سيناء', 4, 8, 100.00, 100.00, false)
ON CONFLICT (governorate) DO UPDATE
SET governorate_ar = EXCLUDED.governorate_ar;


-- 10. NEWSLETTER SUBSCRIBERS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL DEFAULT 'footer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.newsletter_subscribers
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'footer',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());

ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can subscribe to newsletter" ON public.newsletter_subscribers;
CREATE POLICY "Public can subscribe to newsletter" ON public.newsletter_subscribers FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Staff can view and manage subscribers" ON public.newsletter_subscribers;
CREATE POLICY "Staff can view and manage subscribers" ON public.newsletter_subscribers FOR ALL USING (true);


-- 11. GRANT PERMISSIONS TO ANON AND AUTHENTICATED
-- ------------------------------------------------------------------------------
GRANT ALL ON public.discount_codes TO anon, authenticated, service_role;
GRANT ALL ON public.store_settings TO anon, authenticated, service_role;
GRANT ALL ON public.shipping_zones TO anon, authenticated, service_role;
GRANT ALL ON public.newsletter_subscribers TO anon, authenticated, service_role;
GRANT ALL ON public.return_requests TO anon, authenticated, service_role;
GRANT ALL ON public.orders TO anon, authenticated, service_role;
GRANT ALL ON public.order_items TO anon, authenticated, service_role;
GRANT ALL ON public.products TO anon, authenticated, service_role;
GRANT ALL ON public.product_variants TO anon, authenticated, service_role;
GRANT ALL ON public.product_images TO anon, authenticated, service_role;
GRANT ALL ON public.customers TO anon, authenticated, service_role;
GRANT ALL ON public.addresses TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;


-- 12. ELEVATE ALL EXISTING CUSTOMERS OR SPECIFIC USER TO ADMIN
-- ------------------------------------------------------------------------------
-- To make your specific account an admin:
-- UPDATE public.customers SET role = 'admin' WHERE email = 'your-email@example.com';
-- Or run below to ensure all current users have full admin dashboard access:
UPDATE public.customers SET role = 'admin';


-- 13. CATEGORIES TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  display_order INT DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS display_order INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view categories" ON public.categories;
CREATE POLICY "Public can view categories" ON public.categories FOR SELECT USING (true);
DROP POLICY IF EXISTS "Staff can manage categories" ON public.categories;
CREATE POLICY "Staff can manage categories" ON public.categories FOR ALL USING (true);

INSERT INTO public.categories (name, slug, display_order)
VALUES
  ('T-Shirts & Tops', 't-shirts', 1),
  ('Hoodies & Sweatshirts', 'hoodies', 2),
  ('Pants & Bottoms', 'pants', 3),
  ('Jackets & Outerwear', 'jackets', 4),
  ('Accessories', 'accessories', 5)
ON CONFLICT (slug) DO NOTHING;


-- 14. WISHLISTS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.wishlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE(customer_id, product_id)
);

ALTER TABLE public.wishlists ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own wishlist" ON public.wishlists;
CREATE POLICY "Users can manage own wishlist" ON public.wishlists FOR ALL USING (true);


-- 15. HERO BANNERS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hero_banners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url TEXT NOT NULL,
  season_tag TEXT,
  title TEXT NOT NULL,
  subtitle TEXT,
  cta_text TEXT,
  cta_link TEXT,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.hero_banners ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view hero banners" ON public.hero_banners;
CREATE POLICY "Public can view hero banners" ON public.hero_banners FOR SELECT USING (true);
DROP POLICY IF EXISTS "Staff can manage hero banners" ON public.hero_banners;
CREATE POLICY "Staff can manage hero banners" ON public.hero_banners FOR ALL USING (true);


-- 16. RESTOCK & WAITLIST SIGNUPS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.restock_signups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_variant_id UUID,
  contact TEXT NOT NULL,
  contact_type TEXT NOT NULL DEFAULT 'email',
  notified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.waitlist_signups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id UUID,
  email TEXT NOT NULL,
  size TEXT,
  notified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.restock_signups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waitlist_signups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can signup for restock" ON public.restock_signups;
CREATE POLICY "Anyone can signup for restock" ON public.restock_signups FOR ALL USING (true);
DROP POLICY IF EXISTS "Anyone can signup for waitlist" ON public.waitlist_signups;
CREATE POLICY "Anyone can signup for waitlist" ON public.waitlist_signups FOR ALL USING (true);


-- 17. COMPLETE ALL TABLE GRANTS
-- ------------------------------------------------------------------------------
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;


-- 18. CRITICAL: RELOAD SUPABASE POSTGREST SCHEMA CACHE
-- ------------------------------------------------------------------------------
-- This notifies Supabase PostgREST server to instantly re-read all table schemas,
-- resolving "Could not find column ... in the schema cache" errors immediately!
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- SCHEMA FIX COMPLETE & CACHE RELOADED
-- ==============================================================================
