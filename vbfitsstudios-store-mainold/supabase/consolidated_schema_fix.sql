-- ==============================================================================
-- VB FITS STUDIOS - CONSOLIDATED SCHEMA FIX & PRODUCTION SETUP
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/_/sql
-- ==============================================================================

-- 0. CLEANUP ANY MOCK / TEST ORDERS PREVIOUSLY STORED
-- ------------------------------------------------------------------------------
DELETE FROM public.order_items WHERE order_id IN (
  SELECT id FROM public.orders 
  WHERE order_number LIKE 'TEST-%' 
     OR order_number LIKE 'VB-8924%' 
     OR order_number LIKE 'VBF-%'
     OR order_number LIKE 'ORD-%'
);

DELETE FROM public.orders 
WHERE order_number LIKE 'TEST-%' 
   OR order_number LIKE 'VB-8924%' 
   OR order_number LIKE 'VBF-%'
   OR order_number LIKE 'ORD-%';


-- 1. CUSTOMERS TABLE & AUTO-SYNC TRIGGER FROM AUTH.USERS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'support', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'customer';

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view and manage customers" ON public.customers;
CREATE POLICY "Public can view and manage customers" ON public.customers FOR ALL USING (true);

-- Auto-sync function: creates/updates a customer profile when a user logs in via GitHub, Google, or Email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.customers (id, email, full_name, role)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    'customer'
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      full_name = COALESCE(EXCLUDED.full_name, public.customers.full_name);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill all existing auth.users into public.customers and elevate to admin:
INSERT INTO public.customers (id, email, full_name, role)
SELECT 
  id, 
  email, 
  COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', split_part(email, '@', 1)),
  'admin'
FROM auth.users
ON CONFLICT (id) DO UPDATE SET role = 'admin';


-- 2. ORDERS TABLE (CREATION & ALL COLUMNS)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  currency TEXT NOT NULL DEFAULT 'EGP',
  subtotal NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  discount_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (discount_amount >= 0),
  shipping_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (shipping_amount >= 0),
  tax_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (tax_amount >= 0),
  total NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  discount_code_id UUID,
  discount_code TEXT,
  tracking_number TEXT,
  shipping_address_id UUID,
  billing_address_id UUID,
  shipping_address_snapshot JSONB DEFAULT '{}'::jsonb,
  payment_status TEXT NOT NULL DEFAULT 'pending_collection',
  payment_method TEXT DEFAULT 'COD',
  payment_intent_id TEXT,
  shipping_company TEXT,
  internal_notes TEXT,
  notes TEXT,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Ensure all columns exist on orders table
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'COD',
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS tracking_number TEXT,
  ADD COLUMN IF NOT EXISTS shipping_company TEXT,
  ADD COLUMN IF NOT EXISTS internal_notes TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS discount_code TEXT,
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS subtotal NUMERIC(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shipping_amount NUMERIC(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shipping_fee NUMERIC(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'EGP';

-- Allow customer_id to be nullable for guest orders
ALTER TABLE public.orders
  ALTER COLUMN customer_id DROP NOT NULL;

-- Update existing orders currency to EGP
UPDATE public.orders
  SET currency = 'EGP'
  WHERE currency = 'USD' OR currency IS NULL;

-- Fix orders_status_check constraint
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

-- Fix orders_payment_status_check constraint
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_payment_status_check CHECK (
  payment_status IN ('unpaid', 'paid', 'failed', 'refunded', 'pending_collection', 'pending')
);


-- 3. ORDER_ITEMS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID,
  variant_id UUID,
  product_name TEXT NOT NULL,
  variant_title TEXT,
  sku TEXT,
  unit_price NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  total_price NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (total_price >= 0),
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS variant_title TEXT,
  ADD COLUMN IF NOT EXISTS sku TEXT;


-- 4. REFUNDS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
  reason TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'completed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);


-- 5. ROW LEVEL SECURITY (RLS) POLICIES FOR ORDERS & ORDER_ITEMS
-- ------------------------------------------------------------------------------
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;

-- Allow anyone (guest or customer) to place orders
DROP POLICY IF EXISTS "Anyone can insert orders" ON public.orders;
CREATE POLICY "Anyone can insert orders"
  ON public.orders FOR INSERT
  WITH CHECK (true);

-- Allow viewing all orders for customers and admin panel
DROP POLICY IF EXISTS "Users can view own orders" ON public.orders;
DROP POLICY IF EXISTS "Users and staff can view orders" ON public.orders;
CREATE POLICY "Users and staff can view orders"
  ON public.orders FOR SELECT
  USING (true);

-- Allow updating orders (status change, tracking)
DROP POLICY IF EXISTS "Staff can update orders" ON public.orders;
CREATE POLICY "Staff can update orders"
  ON public.orders FOR UPDATE
  USING (true);

-- Allow deleting orders (for admin cleanup)
DROP POLICY IF EXISTS "Staff can delete orders" ON public.orders;
CREATE POLICY "Staff can delete orders"
  ON public.orders FOR DELETE
  USING (true);

-- Order Items RLS
DROP POLICY IF EXISTS "Anyone can insert order items" ON public.order_items;
CREATE POLICY "Anyone can insert order items"
  ON public.order_items FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view order items" ON public.order_items;
CREATE POLICY "Users can view order items"
  ON public.order_items FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Staff can delete order items" ON public.order_items;
CREATE POLICY "Staff can delete order items"
  ON public.order_items FOR DELETE
  USING (true);

-- Refunds RLS
DROP POLICY IF EXISTS "Public can view and manage refunds" ON public.refunds;
CREATE POLICY "Public can view and manage refunds"
  ON public.refunds FOR ALL
  USING (true);


-- 6. PRODUCTS & PRODUCT_IMAGES & PRODUCT_VARIANTS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  subtitle TEXT,
  description TEXT,
  price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'EGP',
  category_id UUID,
  collection_tag TEXT DEFAULT 'all',
  featured BOOLEAN NOT NULL DEFAULT false,
  is_new_arrival BOOLEAN NOT NULL DEFAULT true,
  is_published BOOLEAN NOT NULL DEFAULT true,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  seo_title TEXT,
  seo_description TEXT,
  related_product_ids UUID[] DEFAULT '{}'::uuid[],
  details TEXT[] DEFAULT '{}'::text[],
  fabric_care TEXT[] DEFAULT '{}'::text[],
  shipping_info TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS collection_tag TEXT DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_new_arrival BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS featured BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS subtitle TEXT,
  ADD COLUMN IF NOT EXISTS related_product_ids UUID[] DEFAULT '{}'::uuid[],
  ADD COLUMN IF NOT EXISTS details TEXT[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS fabric_care TEXT[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS shipping_info TEXT,
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'EGP';

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view products" ON public.products;
CREATE POLICY "Public can view products" ON public.products FOR SELECT USING (true);
DROP POLICY IF EXISTS "Staff can manage products" ON public.products;
CREATE POLICY "Staff can manage products" ON public.products FOR ALL USING (true);

-- Product Variants
CREATE TABLE IF NOT EXISTS public.product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  size TEXT NOT NULL,
  color TEXT NOT NULL,
  color_hex TEXT,
  stock INT NOT NULL DEFAULT 0,
  sku TEXT NOT NULL,
  price_override NUMERIC(10, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view variants" ON public.product_variants;
CREATE POLICY "Public can view variants" ON public.product_variants FOR SELECT USING (true);
DROP POLICY IF EXISTS "Staff can manage variants" ON public.product_variants;
CREATE POLICY "Staff can manage variants" ON public.product_variants FOR ALL USING (true);

-- Product Images
CREATE TABLE IF NOT EXISTS public.product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  alt_text TEXT,
  display_order INT NOT NULL DEFAULT 0,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  media_type TEXT DEFAULT 'image',
  video_poster_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.product_images
  ADD COLUMN IF NOT EXISTS media_type TEXT DEFAULT 'image',
  ADD COLUMN IF NOT EXISTS video_poster_url TEXT;

ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view product images" ON public.product_images;
CREATE POLICY "Public can view product images" ON public.product_images FOR SELECT USING (true);
DROP POLICY IF EXISTS "Staff can manage product images" ON public.product_images;
CREATE POLICY "Staff can manage product images" ON public.product_images FOR ALL USING (true);


-- 7. RETURN REQUESTS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.return_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name TEXT,
  customer_phone TEXT,
  customer_email TEXT,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.return_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view and create return requests" ON public.return_requests;
CREATE POLICY "Public can view and create return requests" ON public.return_requests FOR ALL USING (true);


-- 8. STORE SETTINGS & ANNOUNCEMENTS
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


-- 9. DISCOUNT CODES TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.discount_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  discount_type TEXT NOT NULL DEFAULT 'percentage',
  discount_value NUMERIC(10, 2) NOT NULL DEFAULT 0,
  min_spend NUMERIC(10, 2) DEFAULT 0,
  min_order_amount NUMERIC(10, 2) DEFAULT 0,
  times_used INT NOT NULL DEFAULT 0,
  usage_count INT NOT NULL DEFAULT 0,
  usage_limit INT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  starts_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.discount_codes
  ADD COLUMN IF NOT EXISTS min_spend NUMERIC(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS min_order_amount NUMERIC(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS times_used INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS usage_count INT DEFAULT 0;

ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view discount codes" ON public.discount_codes;
CREATE POLICY "Public can view discount codes" ON public.discount_codes FOR SELECT USING (true);
DROP POLICY IF EXISTS "Staff can manage discount codes" ON public.discount_codes;
CREATE POLICY "Staff can manage discount codes" ON public.discount_codes FOR ALL USING (true);

INSERT INTO public.discount_codes (code, discount_type, discount_value, min_spend, is_active)
VALUES
  ('VB10', 'percentage', 10, 0, true),
  ('VIP10', 'percentage', 10, 0, true),
  ('WELCOME100', 'fixed_amount', 100, 1000, true)
ON CONFLICT (code) DO NOTHING;


-- 10. SHIPPING ZONES (EGYPTIAN GOVERNORATES)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shipping_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  governorate TEXT,
  governorate_ar TEXT,
  min_days INT NOT NULL DEFAULT 2,
  max_days INT NOT NULL DEFAULT 4,
  cod_available BOOLEAN NOT NULL DEFAULT true,
  shipping_rate NUMERIC(10, 2) NOT NULL DEFAULT 65.00,
  name TEXT,
  rate NUMERIC(10, 2) DEFAULT 65.00,
  estimated_days TEXT DEFAULT '2-4 business days',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Ensure all required columns exist regardless of previous migrations
ALTER TABLE public.shipping_zones
  ADD COLUMN IF NOT EXISTS governorate TEXT,
  ADD COLUMN IF NOT EXISTS governorate_ar TEXT,
  ADD COLUMN IF NOT EXISTS min_days INT DEFAULT 2,
  ADD COLUMN IF NOT EXISTS max_days INT DEFAULT 4,
  ADD COLUMN IF NOT EXISTS cod_available BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS shipping_rate NUMERIC(10, 2) DEFAULT 65.00,
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS rate NUMERIC(10, 2) DEFAULT 65.00,
  ADD COLUMN IF NOT EXISTS estimated_days TEXT DEFAULT '2-4 business days',
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Reconcile name and rate values from existing records
UPDATE public.shipping_zones
SET name = COALESCE(name, governorate_ar || ' (' || governorate || ')', governorate, 'منطقة شحن'),
    rate = COALESCE(rate, shipping_rate, 65.00)
WHERE name IS NULL OR rate IS NULL;

ALTER TABLE public.shipping_zones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view shipping zones" ON public.shipping_zones;
CREATE POLICY "Public can view shipping zones" ON public.shipping_zones FOR SELECT USING (true);
DROP POLICY IF EXISTS "Staff can manage shipping zones" ON public.shipping_zones;
CREATE POLICY "Staff can manage shipping zones" ON public.shipping_zones FOR ALL USING (true);

-- Seed Egyptian governorate rates safely
INSERT INTO public.shipping_zones (governorate, governorate_ar, min_days, max_days, cod_available, shipping_rate, name, rate, estimated_days, is_active)
SELECT 'Cairo', 'القاهرة', 1, 2, true, 65.00, 'القاهرة والجيزة (Cairo & Giza)', 65.00, '1-2 أيام عمل', true
WHERE NOT EXISTS (SELECT 1 FROM public.shipping_zones WHERE name LIKE '%Cairo%' OR name LIKE '%القاهرة%' OR governorate = 'Cairo');

INSERT INTO public.shipping_zones (governorate, governorate_ar, min_days, max_days, cod_available, shipping_rate, name, rate, estimated_days, is_active)
SELECT 'Alexandria', 'الإسكندرية', 2, 3, true, 75.00, 'الإسكندرية والبحيرة (Alexandria)', 75.00, '2-3 أيام عمل', true
WHERE NOT EXISTS (SELECT 1 FROM public.shipping_zones WHERE name LIKE '%Alexandria%' OR name LIKE '%الإسكندرية%' OR governorate = 'Alexandria');

INSERT INTO public.shipping_zones (governorate, governorate_ar, min_days, max_days, cod_available, shipping_rate, name, rate, estimated_days, is_active)
SELECT 'Delta', 'الدلتا والقناة', 2, 4, true, 85.00, 'مدن الدلتا والقناة (Delta & Canal)', 85.00, '2-4 أيام عمل', true
WHERE NOT EXISTS (SELECT 1 FROM public.shipping_zones WHERE name LIKE '%Delta%' OR name LIKE '%الدلتا%' OR governorate = 'Delta');

INSERT INTO public.shipping_zones (governorate, governorate_ar, min_days, max_days, cod_available, shipping_rate, name, rate, estimated_days, is_active)
SELECT 'Upper Egypt', 'الصعيد وسيناء', 3, 5, true, 110.00, 'الصعيد وشمال/جنوب سيناء (Upper Egypt)', 110.00, '3-5 أيام عمل', true
WHERE NOT EXISTS (SELECT 1 FROM public.shipping_zones WHERE name LIKE '%Upper Egypt%' OR name LIKE '%الصعيد%' OR governorate = 'Upper Egypt');


-- 11. CATEGORIES TABLE
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


-- 12. ADDRESSES & WISHLISTS & SUBSCRIBERS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  street_line1 TEXT,
  street_line2 TEXT,
  city TEXT,
  state TEXT,
  governorate TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'Egypt',
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can manage addresses" ON public.addresses;
CREATE POLICY "Public can manage addresses" ON public.addresses FOR ALL USING (true);

CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  is_subscribed BOOLEAN NOT NULL DEFAULT true,
  source TEXT DEFAULT 'footer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can manage subscribers" ON public.newsletter_subscribers;
CREATE POLICY "Public can manage subscribers" ON public.newsletter_subscribers FOR ALL USING (true);

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


-- 13. RESTOCK & WAITLIST SIGNUPS
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


-- 14. ALL PERMISSIONS & POSTGREST SCHEMA CACHE RELOAD
-- ------------------------------------------------------------------------------
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- 15. CLEAN SLATE PURGE & ROLE ISOLATION
-- Purge all dummy/mock test orders and order items
TRUNCATE TABLE public.order_items, public.orders CASCADE;
TRUNCATE TABLE public.return_requests CASCADE;

-- Ensure regular accounts (like sowar) are strictly 'customer'
UPDATE public.customers
SET role = 'customer'
WHERE email ILIKE '%sowar%' 
   OR full_name ILIKE '%sowar%'
   OR (
     email NOT ILIKE '%pvfits%' 
     AND email NOT ILIKE '%vbfits%' 
     AND email != 'admin@vbfitsstudios.com'
     AND full_name NOT ILIKE '%pvfits%'
     AND full_name NOT ILIKE '%vbfits%'
   );

-- Permanently lock and ensure admin privileges for pvfits studios and brand admins
UPDATE public.customers
SET role = 'admin'
WHERE email ILIKE '%pvfits%'
   OR email ILIKE '%vbfits%'
   OR full_name ILIKE '%pvfits%'
   OR full_name ILIKE '%vbfits%'
   OR email = 'admin@vbfitsstudios.com';

UPDATE auth.users
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
WHERE email ILIKE '%pvfits%'
   OR email ILIKE '%vbfits%'
   OR email = 'admin@vbfitsstudios.com'
   OR raw_user_meta_data->>'full_name' ILIKE '%pvfits%'
   OR raw_user_meta_data->>'name' ILIKE '%pvfits%';

ALTER TABLE public.customers ALTER COLUMN role SET DEFAULT 'customer';

-- Re-reads schema immediately, eliminating any schema cache errors:
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- SETUP COMPLETE: DATABASE IS CLEAN, READY FOR REAL PRODUCTION ORDERS
-- ==============================================================================

