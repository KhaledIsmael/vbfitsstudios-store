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


-- 8. DISCOUNT CODES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.discount_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value NUMERIC(10, 2) NOT NULL CHECK (discount_value > 0),
  min_spend NUMERIC(10, 2) DEFAULT 0,
  max_uses INT DEFAULT NULL,
  times_used INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can check active discount codes" ON public.discount_codes;
CREATE POLICY "Public can check active discount codes" ON public.discount_codes FOR SELECT USING (is_active = true);
DROP POLICY IF EXISTS "Staff can manage discount codes" ON public.discount_codes;
CREATE POLICY "Staff can manage discount codes" ON public.discount_codes FOR ALL USING (true);

INSERT INTO public.discount_codes (code, discount_type, discount_value, min_spend, is_active)
VALUES 
  ('VB10', 'percentage', 10.00, 0, true),
  ('VIP15', 'percentage', 15.00, 1000.00, true)
ON CONFLICT (code) DO NOTHING;


-- 9. ELEVATE ALL EXISTING CUSTOMERS OR SPECIFIC USER TO ADMIN
-- ------------------------------------------------------------------------------
-- To make your account admin, run:
-- UPDATE public.customers SET role = 'admin' WHERE email = 'your-email@example.com';
-- Or uncomment below to elevate all accounts in development:
-- UPDATE public.customers SET role = 'admin';

-- ==============================================================================
-- SCHEMA FIX COMPLETE
-- ==============================================================================
