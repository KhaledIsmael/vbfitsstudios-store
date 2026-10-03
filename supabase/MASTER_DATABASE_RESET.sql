-- ============================================================
-- VBFITS STUDIOS - MASTER DATABASE RESET
-- Generated from: vbfitsstudios-store-mainold (original working codebase)
-- Run this in Supabase SQL Editor to fully reset the database
-- WARNING: This will drop ALL existing tables and recreate them
-- ============================================================

-- Step 1: Drop all existing RLS policies, tables, and functions (clean slate)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname = 'public') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
  FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT LIKE 'pg_%') LOOP
    EXECUTE format('DROP TABLE IF EXISTS public.%I CASCADE', r.tablename);
  END LOOP;
  FOR r IN (SELECT proname, oidvectortypes(proargtypes) as args FROM pg_proc WHERE pronamespace = 'public'::regnamespace) LOOP
    BEGIN
      EXECUTE format('DROP FUNCTION IF EXISTS public.%I(%s) CASCADE', r.proname, r.args);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $$;

-- ============================================================
-- FILE: 20260919000000_create_ecommerce_schema.sql
-- ============================================================
-- ==============================================================================
-- VB FITS STUDIOS - SUPABASE POSTGRES INITIAL E-COMMERCE SCHEMA MIGRATION
-- Migration: 20260919000000_create_ecommerce_schema.sql
-- Description: Complete schema with UUID primary keys, foreign keys, 
--              timestamps, triggers, indexes, and Row-Level Security (RLS).
-- ==============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 1. HELPER FUNCTIONS & TRIGGERS
-- ==============================================================================

-- Function to automatically update 'updated_at' column on row modification
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- 2. CORE E-COMMERCE CATALOG TABLES
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- Table: categories
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  image_url TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Trigger for categories.updated_at
DROP TRIGGER IF EXISTS tr_categories_updated_at ON public.categories;
CREATE TRIGGER tr_categories_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- Table: products
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  subtitle TEXT,
  description TEXT,
  price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  featured BOOLEAN NOT NULL DEFAULT false,
  is_new_arrival BOOLEAN NOT NULL DEFAULT false,
  is_published BOOLEAN NOT NULL DEFAULT true,
  details JSONB NOT NULL DEFAULT '[]'::jsonb,
  fabric_care JSONB NOT NULL DEFAULT '[]'::jsonb,
  shipping_info TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Trigger for products.updated_at
DROP TRIGGER IF EXISTS tr_products_updated_at ON public.products;
CREATE TRIGGER tr_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- Table: product_variants (size, color, stock, sku)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  size TEXT NOT NULL,
  color TEXT NOT NULL,
  color_hex TEXT,
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  sku TEXT NOT NULL UNIQUE,
  price_override NUMERIC(10, 2) CHECK (price_override >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_product_variant UNIQUE (product_id, size, color)
);

-- Trigger for product_variants.updated_at
DROP TRIGGER IF EXISTS tr_product_variants_updated_at ON public.product_variants;
CREATE TRIGGER tr_product_variants_updated_at
  BEFORE UPDATE ON public.product_variants
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- Table: product_images
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL,
  url TEXT NOT NULL,
  alt_text TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- 3. CUSTOMER & USER MANAGEMENT TABLES
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- Table: customers (linked to auth.users)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Trigger for customers.updated_at
DROP TRIGGER IF EXISTS tr_customers_updated_at ON public.customers;
CREATE TRIGGER tr_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Automatic profile sync from auth.users to public.customers
CREATE OR REPLACE FUNCTION public.handle_new_customer()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.customers (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.customers.full_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.customers.avatar_url),
    updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_customer();

-- ------------------------------------------------------------------------------
-- Table: addresses
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  address_type TEXT NOT NULL DEFAULT 'shipping' CHECK (address_type IN ('shipping', 'billing', 'both')),
  is_default BOOLEAN NOT NULL DEFAULT false,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  company TEXT,
  street_line1 TEXT NOT NULL,
  street_line2 TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'United States',
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Trigger for addresses.updated_at
DROP TRIGGER IF EXISTS tr_addresses_updated_at ON public.addresses;
CREATE TRIGGER tr_addresses_updated_at
  BEFORE UPDATE ON public.addresses
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ==============================================================================
-- 4. ORDERS & COMMERCE TRANSACTIONS
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- Table: discount_codes
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.discount_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed_amount')),
  discount_value NUMERIC(10, 2) NOT NULL CHECK (discount_value > 0),
  min_order_value NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (min_order_value >= 0),
  max_uses INTEGER CHECK (max_uses IS NULL OR max_uses > 0),
  used_count INTEGER NOT NULL DEFAULT 0 CHECK (used_count >= 0),
  starts_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Trigger for discount_codes.updated_at
DROP TRIGGER IF EXISTS tr_discount_codes_updated_at ON public.discount_codes;
CREATE TRIGGER tr_discount_codes_updated_at
  BEFORE UPDATE ON public.discount_codes
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- Table: orders
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'in_transit', 'delivered', 'cancelled', 'refunded')),
  currency TEXT NOT NULL DEFAULT 'USD',
  subtotal NUMERIC(10, 2) NOT NULL CHECK (subtotal >= 0),
  discount_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (discount_amount >= 0),
  shipping_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (shipping_amount >= 0),
  tax_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (tax_amount >= 0),
  total NUMERIC(10, 2) NOT NULL CHECK (total >= 0),
  discount_code_id UUID REFERENCES public.discount_codes(id) ON DELETE SET NULL,
  tracking_number TEXT,
  shipping_address_id UUID REFERENCES public.addresses(id) ON DELETE SET NULL,
  billing_address_id UUID REFERENCES public.addresses(id) ON DELETE SET NULL,
  shipping_address_snapshot JSONB,
  payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid', 'failed', 'refunded')),
  payment_intent_id TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Trigger for orders.updated_at
DROP TRIGGER IF EXISTS tr_orders_updated_at ON public.orders;
CREATE TRIGGER tr_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- Table: order_items
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  variant_title TEXT,
  sku TEXT,
  unit_price NUMERIC(10, 2) NOT NULL CHECK (unit_price >= 0),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  total_price NUMERIC(10, 2) NOT NULL CHECK (total_price >= 0),
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- 5. SOCIAL, ENGAGEMENT & MARKETING TABLES
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- Table: reviews
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title TEXT,
  comment TEXT NOT NULL,
  is_verified_purchase BOOLEAN NOT NULL DEFAULT false,
  is_approved BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_product_customer_review UNIQUE (product_id, customer_id)
);

-- Trigger for reviews.updated_at
DROP TRIGGER IF EXISTS tr_reviews_updated_at ON public.reviews;
CREATE TRIGGER tr_reviews_updated_at
  BEFORE UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- Table: wishlists
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.wishlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_customer_wishlist_product UNIQUE (customer_id, product_id)
);

-- ------------------------------------------------------------------------------
-- Table: waitlist_signups (for drop notify-me)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.waitlist_signups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  notified BOOLEAN NOT NULL DEFAULT false,
  notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ------------------------------------------------------------------------------
-- Table: newsletter_subscribers
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'subscribed' CHECK (status IN ('subscribed', 'unsubscribed')),
  source TEXT DEFAULT 'website_footer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Trigger for newsletter_subscribers.updated_at
DROP TRIGGER IF EXISTS tr_newsletter_subscribers_updated_at ON public.newsletter_subscribers;
CREATE TRIGGER tr_newsletter_subscribers_updated_at
  BEFORE UPDATE ON public.newsletter_subscribers
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ==============================================================================
-- 6. PERFORMANCE INDEXES
-- ==============================================================================

CREATE INDEX IF NOT EXISTS idx_products_category_id ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_slug ON public.products(slug);
CREATE INDEX IF NOT EXISTS idx_products_is_published ON public.products(is_published);
CREATE INDEX IF NOT EXISTS idx_products_featured ON public.products(featured);

CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON public.product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_sku ON public.product_variants(sku);

CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON public.product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_product_images_variant_id ON public.product_images(variant_id);

CREATE INDEX IF NOT EXISTS idx_addresses_customer_id ON public.addresses(customer_id);

CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON public.orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON public.orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON public.order_items(product_id);

CREATE INDEX IF NOT EXISTS idx_reviews_product_id ON public.reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_customer_id ON public.reviews(customer_id);

CREATE INDEX IF NOT EXISTS idx_wishlists_customer_id ON public.wishlists(customer_id);
CREATE INDEX IF NOT EXISTS idx_wishlists_product_id ON public.wishlists(product_id);

CREATE INDEX IF NOT EXISTS idx_waitlist_signups_product_id ON public.waitlist_signups(product_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_signups_email ON public.waitlist_signups(email);

CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_email ON public.newsletter_subscribers(email);

-- ==============================================================================
-- 7. ENABLE ROW-LEVEL SECURITY (RLS) ON ALL TABLES
-- ==============================================================================

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waitlist_signups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- 8. ROW-LEVEL SECURITY POLICIES
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- Categories Policies (Publicly readable)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Categories are viewable by everyone" ON public.categories;
CREATE POLICY "Categories are viewable by everyone"
  ON public.categories FOR SELECT
  USING (true);

-- ------------------------------------------------------------------------------
-- Products Policies (Publicly readable)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Published products are viewable by everyone" ON public.products;
CREATE POLICY "Published products are viewable by everyone"
  ON public.products FOR SELECT
  USING (is_published = true);

-- ------------------------------------------------------------------------------
-- Product Variants Policies (Publicly readable)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Product variants are viewable by everyone" ON public.product_variants;
CREATE POLICY "Product variants are viewable by everyone"
  ON public.product_variants FOR SELECT
  USING (true);

-- ------------------------------------------------------------------------------
-- Product Images Policies (Publicly readable)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Product images are viewable by everyone" ON public.product_images;
CREATE POLICY "Product images are viewable by everyone"
  ON public.product_images FOR SELECT
  USING (true);

-- ------------------------------------------------------------------------------
-- Customers Policies (Customers can only read & write their own profile)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Customers can view own profile" ON public.customers;
CREATE POLICY "Customers can view own profile"
  ON public.customers FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Customers can insert own profile" ON public.customers;
CREATE POLICY "Customers can insert own profile"
  ON public.customers FOR INSERT
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Customers can update own profile" ON public.customers;
CREATE POLICY "Customers can update own profile"
  ON public.customers FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ------------------------------------------------------------------------------
-- Addresses Policies (Customers can only read/write their own addresses)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Customers can view own addresses" ON public.addresses;
CREATE POLICY "Customers can view own addresses"
  ON public.addresses FOR SELECT
  USING (auth.uid() = customer_id);

DROP POLICY IF EXISTS "Customers can insert own addresses" ON public.addresses;
CREATE POLICY "Customers can insert own addresses"
  ON public.addresses FOR INSERT
  WITH CHECK (auth.uid() = customer_id);

DROP POLICY IF EXISTS "Customers can update own addresses" ON public.addresses;
CREATE POLICY "Customers can update own addresses"
  ON public.addresses FOR UPDATE
  USING (auth.uid() = customer_id)
  WITH CHECK (auth.uid() = customer_id);

DROP POLICY IF EXISTS "Customers can delete own addresses" ON public.addresses;
CREATE POLICY "Customers can delete own addresses"
  ON public.addresses FOR DELETE
  USING (auth.uid() = customer_id);

-- ------------------------------------------------------------------------------
-- Discount Codes Policies (Active codes readable by everyone to validate promo codes)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Active discount codes are viewable by everyone" ON public.discount_codes;
CREATE POLICY "Active discount codes are viewable by everyone"
  ON public.discount_codes FOR SELECT
  USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));

-- ------------------------------------------------------------------------------
-- Orders Policies (Customers can only view and create their own orders)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Customers can view own orders" ON public.orders;
CREATE POLICY "Customers can view own orders"
  ON public.orders FOR SELECT
  USING (auth.uid() = customer_id);

DROP POLICY IF EXISTS "Customers can create own orders" ON public.orders;
CREATE POLICY "Customers can create own orders"
  ON public.orders FOR INSERT
  WITH CHECK (auth.uid() = customer_id);

-- ------------------------------------------------------------------------------
-- Order Items Policies (Customers can only view and create items for their own orders)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Customers can view own order items" ON public.order_items;
CREATE POLICY "Customers can view own order items"
  ON public.order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_items.order_id
        AND orders.customer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Customers can insert own order items" ON public.order_items;
CREATE POLICY "Customers can insert own order items"
  ON public.order_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_items.order_id
        AND orders.customer_id = auth.uid()
    )
  );

-- ------------------------------------------------------------------------------
-- Reviews Policies (Publicly readable, customers manage their own reviews)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Approved reviews are viewable by everyone" ON public.reviews;
CREATE POLICY "Approved reviews are viewable by everyone"
  ON public.reviews FOR SELECT
  USING (is_approved = true);

DROP POLICY IF EXISTS "Customers can insert own reviews" ON public.reviews;
CREATE POLICY "Customers can insert own reviews"
  ON public.reviews FOR INSERT
  WITH CHECK (auth.uid() = customer_id);

DROP POLICY IF EXISTS "Customers can update own reviews" ON public.reviews;
CREATE POLICY "Customers can update own reviews"
  ON public.reviews FOR UPDATE
  USING (auth.uid() = customer_id)
  WITH CHECK (auth.uid() = customer_id);

DROP POLICY IF EXISTS "Customers can delete own reviews" ON public.reviews;
CREATE POLICY "Customers can delete own reviews"
  ON public.reviews FOR DELETE
  USING (auth.uid() = customer_id);

-- ------------------------------------------------------------------------------
-- Wishlists Policies (Customers can only view and manage their own wishlists)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Customers can view own wishlist" ON public.wishlists;
CREATE POLICY "Customers can view own wishlist"
  ON public.wishlists FOR SELECT
  USING (auth.uid() = customer_id);

DROP POLICY IF EXISTS "Customers can insert into own wishlist" ON public.wishlists;
CREATE POLICY "Customers can insert into own wishlist"
  ON public.wishlists FOR INSERT
  WITH CHECK (auth.uid() = customer_id);

DROP POLICY IF EXISTS "Customers can delete from own wishlist" ON public.wishlists;
CREATE POLICY "Customers can delete from own wishlist"
  ON public.wishlists FOR DELETE
  USING (auth.uid() = customer_id);

-- ------------------------------------------------------------------------------
-- Waitlist Signups Policies (Anyone can signup; users can see their own)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can join waitlist" ON public.waitlist_signups;
CREATE POLICY "Anyone can join waitlist"
  ON public.waitlist_signups FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Customers can view own waitlist signups" ON public.waitlist_signups;
CREATE POLICY "Customers can view own waitlist signups"
  ON public.waitlist_signups FOR SELECT
  USING (
    auth.uid() = customer_id 
    OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- ------------------------------------------------------------------------------
-- Newsletter Subscribers Policies (Anyone can subscribe)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can subscribe to newsletter" ON public.newsletter_subscribers;
CREATE POLICY "Anyone can subscribe to newsletter"
  ON public.newsletter_subscribers FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Subscribers can view own subscription status" ON public.newsletter_subscribers;
CREATE POLICY "Subscribers can view own subscription status"
  ON public.newsletter_subscribers FOR SELECT
  USING (
    auth.uid() IS NOT NULL 
    AND email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Subscribers can update own subscription status" ON public.newsletter_subscribers;
CREATE POLICY "Subscribers can update own subscription status"
  ON public.newsletter_subscribers FOR UPDATE
  USING (
    auth.uid() IS NOT NULL 
    AND email = (SELECT email FROM auth.users WHERE id = auth.uid())
  )
  WITH CHECK (
    auth.uid() IS NOT NULL 
    AND email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- ============================================================
-- FILE: 20260919000001_create_cart_items.sql
-- ============================================================
-- ==============================================================================
-- VB FITS STUDIOS - CART ITEMS TABLE & ROW-LEVEL SECURITY
-- Migration: 20260919000001_create_cart_items.sql
-- Description: Synced shopping bag table for authenticated clients
-- ==============================================================================

-- 1. Create cart_items table
CREATE TABLE IF NOT EXISTS public.cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  name TEXT NOT NULL,
  size TEXT NOT NULL,
  price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  currency TEXT NOT NULL DEFAULT '$',
  image TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_cart_user_product_size UNIQUE (user_id, product_id, size)
);

-- 2. Trigger for updated_at
DROP TRIGGER IF EXISTS tr_cart_items_updated_at ON public.cart_items;
CREATE TRIGGER tr_cart_items_updated_at
  BEFORE UPDATE ON public.cart_items
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 3. Performance Index
CREATE INDEX IF NOT EXISTS idx_cart_items_user_id ON public.cart_items(user_id);

-- 4. Enable Row-Level Security (RLS)
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies: Authenticated users can only read/write their own items
DROP POLICY IF EXISTS "Users can view own cart items" ON public.cart_items;
CREATE POLICY "Users can view own cart items"
  ON public.cart_items FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own cart items" ON public.cart_items;
CREATE POLICY "Users can insert own cart items"
  ON public.cart_items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own cart items" ON public.cart_items;
CREATE POLICY "Users can update own cart items"
  ON public.cart_items FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own cart items" ON public.cart_items;
CREATE POLICY "Users can delete own cart items"
  ON public.cart_items FOR DELETE
  USING (auth.uid() = user_id);

-- 6. Grant Permissions to authenticated role
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cart_items TO authenticated;

-- ============================================================
-- FILE: 20260919000002_allow_placed_order_status.sql
-- ============================================================
-- ==============================================================================
-- VB FITS STUDIOS - ALLOW 'Placed' ORDER STATUS
-- Migration: 20260919000002_allow_placed_order_status.sql
-- ==============================================================================

-- Drop existing status check constraint and add updated one including 'placed' / 'Placed'
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check CHECK (
  LOWER(status) IN ('placed', 'pending', 'processing', 'in_transit', 'delivered', 'cancelled', 'refunded')
);

-- ============================================================
-- FILE: 20260919000003_add_address_fields.sql
-- ============================================================
-- Migration: Add localized / regional address columns to public.addresses
-- Allows saving Egyptian and international delivery addresses smoothly

ALTER TABLE public.addresses 
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS governorate TEXT,
  ADD COLUMN IF NOT EXISTS street TEXT,
  ADD COLUMN IF NOT EXISTS building TEXT,
  ADD COLUMN IF NOT EXISTS floor TEXT,
  ADD COLUMN IF NOT EXISTS landmark TEXT;

-- Make existing US-centric columns nullable so regional address submissions succeed without schema errors
ALTER TABLE public.addresses 
  ALTER COLUMN first_name DROP NOT NULL,
  ALTER COLUMN last_name DROP NOT NULL,
  ALTER COLUMN street_line1 DROP NOT NULL,
  ALTER COLUMN state DROP NOT NULL,
  ALTER COLUMN postal_code DROP NOT NULL;

-- ============================================================
-- FILE: 20260919000004_allow_guest_orders.sql
-- ============================================================
-- Migration: Allow guest checkouts on orders and order_items
-- Gives anon role insert rights and permits orders with customer_id IS NULL

GRANT INSERT ON public.orders TO anon;
GRANT INSERT ON public.order_items TO anon;

-- Orders insert policy
DROP POLICY IF EXISTS "Customers can create own orders" ON public.orders;
CREATE POLICY "Customers and guests can create orders"
  ON public.orders FOR INSERT
  WITH CHECK (
    customer_id IS NULL OR auth.uid() = customer_id
  );

-- Order items insert policy
DROP POLICY IF EXISTS "Customers can insert own order items" ON public.order_items;
CREATE POLICY "Customers and guests can insert order items"
  ON public.order_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_items.order_id
        AND (orders.customer_id IS NULL OR orders.customer_id = auth.uid())
    )
  );

-- ============================================================
-- FILE: 20260919000005_add_cod_payment_support.sql
-- ============================================================
-- Migration: Add payment_method column and allow 'pending_collection' in payment_status
-- 20260919000005_add_cod_payment_support.sql

-- 1. Add payment_method column to orders if not already present
ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'COD';

-- 2. Update payment_status check constraint to include 'pending_collection'
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_payment_status_check CHECK (
  payment_status IN ('unpaid', 'paid', 'failed', 'refunded', 'pending_collection')
);

-- ============================================================
-- FILE: 20260919000006_tracking_and_returns.sql
-- ============================================================
-- ==============================================================================
-- VB FITS STUDIOS
-- Migration: 20260919000006_tracking_and_returns.sql
-- Adds: delivered_at timestamp to orders, return_requests table, extended status
-- ==============================================================================

-- 1. Add delivered_at + status values to orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

-- Extend status constraint to include all pipeline stages
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

-- 2. Create return_requests table
CREATE TABLE IF NOT EXISTS public.return_requests (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  customer_id  UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  reason       TEXT NOT NULL CHECK (reason IN (
    'wrong_size',
    'wrong_item',
    'damaged',
    'not_as_described',
    'changed_mind',
    'other'
  )),
  reason_note  TEXT,
  -- JSONB array of {order_item_id, name, size, quantity_to_return}
  items        JSONB NOT NULL DEFAULT '[]'::jsonb,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'approved', 'rejected', 'collected', 'refunded'
  )),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

DROP TRIGGER IF EXISTS tr_return_requests_updated_at ON public.return_requests;
CREATE TRIGGER tr_return_requests_updated_at
  BEFORE UPDATE ON public.return_requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 3. Row-Level Security for return_requests
ALTER TABLE public.return_requests ENABLE ROW LEVEL SECURITY;

-- Authenticated customers can insert their own return requests
DROP POLICY IF EXISTS "Customers can create return requests" ON public.return_requests;
CREATE POLICY "Customers can create return requests"
  ON public.return_requests FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND customer_id = auth.uid()
  );

-- Customers can read their own return requests
DROP POLICY IF EXISTS "Customers can view own return requests" ON public.return_requests;
CREATE POLICY "Customers can view own return requests"
  ON public.return_requests FOR SELECT
  USING (customer_id = auth.uid());

-- Guests: no insert (order_id check done at application level)
-- Service role (admin) has full access via bypass RLS

-- 4. Index for fast customer lookups
CREATE INDEX IF NOT EXISTS idx_return_requests_customer_id
  ON public.return_requests(customer_id);

CREATE INDEX IF NOT EXISTS idx_return_requests_order_id
  ON public.return_requests(order_id);

-- ============================================================
-- FILE: 20260919000007_add_customer_role.sql
-- ============================================================
-- ==============================================================================
-- Migration: 20260919000007_add_customer_role.sql
-- Description: Add role column (customer/support/admin) to customers table.
-- ==============================================================================

-- 1. Add role column to public.customers if not exists
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'customer'
    CHECK (role IN ('customer', 'support', 'admin'));

-- 2. Index for role filtering
CREATE INDEX IF NOT EXISTS idx_customers_role ON public.customers(role);

-- 3. Update the handle_new_customer trigger function to propagate role from user_metadata
CREATE OR REPLACE FUNCTION public.handle_new_customer()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.customers (id, email, full_name, avatar_url, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url',
    COALESCE(NEW.raw_user_meta_data->>'role', 'customer')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.customers.full_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.customers.avatar_url),
    role = COALESCE(public.customers.role, EXCLUDED.role, 'customer'),
    updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. RLS policies: allow admin and support users to view all customer records
DROP POLICY IF EXISTS "Admins and support can view all customers" ON public.customers;
CREATE POLICY "Admins and support can view all customers"
  ON public.customers FOR SELECT
  USING (
    auth.uid() = id
    OR EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = auth.uid() AND c.role IN ('admin', 'support')
    )
  );

-- 5. RLS policies: allow admins to update customer roles
DROP POLICY IF EXISTS "Admins can update customers" ON public.customers;
CREATE POLICY "Admins can update customers"
  ON public.customers FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = auth.uid() AND c.role = 'admin'
    )
  );

-- ============================================================
-- FILE: 20260919000008_product_editor_and_archive.sql
-- ============================================================
-- ==============================================================================
-- Migration: 20260919000008_product_editor_and_archive.sql
-- Description: Add product editor fields (is_archived, collection_tag, seo_title,
--              seo_description, related_product_ids) and grant full staff RLS policies.
-- ==============================================================================

-- 1. Add editor & archiving columns to products table
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS collection_tag TEXT DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS seo_title TEXT,
  ADD COLUMN IF NOT EXISTS seo_description TEXT,
  ADD COLUMN IF NOT EXISTS related_product_ids JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Index on archiving & publication status
CREATE INDEX IF NOT EXISTS idx_products_archived ON public.products(is_archived);
CREATE INDEX IF NOT EXISTS idx_products_status ON public.products(is_archived, is_published);

-- 2. Staff RLS policies for products (admin & support can view all, admin can write)
DROP POLICY IF EXISTS "Published products are viewable by everyone" ON public.products;
CREATE POLICY "Public can view active products, staff can view all"
  ON public.products FOR SELECT
  USING (
    (is_published = true AND is_archived = false)
    OR EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = auth.uid() AND c.role IN ('admin', 'support')
    )
  );

DROP POLICY IF EXISTS "Staff can insert products" ON public.products;
CREATE POLICY "Staff can insert products"
  ON public.products FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = auth.uid() AND c.role IN ('admin', 'support')
    )
  );

DROP POLICY IF EXISTS "Staff can update products" ON public.products;
CREATE POLICY "Staff can update products"
  ON public.products FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = auth.uid() AND c.role IN ('admin', 'support')
    )
  );

DROP POLICY IF EXISTS "Staff can delete products" ON public.products;
CREATE POLICY "Staff can delete products"
  ON public.products FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = auth.uid() AND c.role = 'admin'
    )
  );

-- 3. Staff RLS policies for product_variants
DROP POLICY IF EXISTS "Staff can manage product variants" ON public.product_variants;
CREATE POLICY "Staff can manage product variants"
  ON public.product_variants FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = auth.uid() AND c.role IN ('admin', 'support')
    )
  );

-- 4. Staff RLS policies for product_images
DROP POLICY IF EXISTS "Staff can manage product images" ON public.product_images;
CREATE POLICY "Staff can manage product images"
  ON public.product_images FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = auth.uid() AND c.role IN ('admin', 'support')
    )
  );

-- 5. Storage policies for product-media bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-media', 'product-media', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Public can view product-media" ON storage.objects;
CREATE POLICY "Public can view product-media"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-media');

DROP POLICY IF EXISTS "Staff can upload product-media" ON storage.objects;
CREATE POLICY "Staff can upload product-media"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'product-media'
    AND (
      auth.role() = 'authenticated'
      OR auth.uid() IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "Staff can update/delete product-media" ON storage.objects;
CREATE POLICY "Staff can update/delete product-media"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'product-media');

-- ============================================================
-- FILE: 20260919000009_inventory_and_restock_notifications.sql
-- ============================================================
-- ==============================================================================
-- Migration: 20260919000009_inventory_and_restock_notifications.sql
-- Description: Add low_stock_threshold to product_variants and size to waitlist_signups.
-- ==============================================================================

-- 1. Add low_stock_threshold to product_variants (default: 5)
ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS low_stock_threshold INTEGER NOT NULL DEFAULT 5 CHECK (low_stock_threshold >= 0);

-- 2. Add size column to waitlist_signups if missing
ALTER TABLE public.waitlist_signups
  ADD COLUMN IF NOT EXISTS size TEXT;

-- Index for speedy waitlist matching upon restock
CREATE INDEX IF NOT EXISTS idx_waitlist_signups_lookup 
  ON public.waitlist_signups(product_id, variant_id, notified);

-- 3. Ensure staff can read & write waitlist_signups
DROP POLICY IF EXISTS "Staff can manage waitlist signups" ON public.waitlist_signups;
CREATE POLICY "Staff can manage waitlist signups"
  ON public.waitlist_signups FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = auth.uid() AND c.role IN ('admin', 'support')
    )
  );

-- 4. Public can insert waitlist signups (for Notify Me form on Product Details Page)
DROP POLICY IF EXISTS "Public can insert waitlist signups" ON public.waitlist_signups;
CREATE POLICY "Public can insert waitlist signups"
  ON public.waitlist_signups FOR INSERT
  WITH CHECK (true);

-- ============================================================
-- FILE: 20260919000010_admin_orders_refunds.sql
-- ============================================================
-- ==============================================================================
-- Migration: 20260919000010_admin_orders_refunds.sql
-- Description: Add internal_notes to orders, create refunds table, and set RLS.
-- ==============================================================================

-- 1. Add internal_notes to public.orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS internal_notes TEXT;

-- 2. Create refunds table
CREATE TABLE IF NOT EXISTS public.refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
  reason TEXT NOT NULL,
  refund_method TEXT NOT NULL DEFAULT 'original_payment',
  notes TEXT,
  created_by UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_refunds_order_id ON public.refunds(order_id);
CREATE INDEX IF NOT EXISTS idx_refunds_created_at ON public.refunds(created_at);

-- Trigger for refunds.updated_at
DROP TRIGGER IF EXISTS tr_refunds_updated_at ON public.refunds;
CREATE TRIGGER tr_refunds_updated_at
  BEFORE UPDATE ON public.refunds
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 3. RLS Policies for refunds table
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can manage refunds" ON public.refunds;
CREATE POLICY "Staff can manage refunds"
  ON public.refunds FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = auth.uid() AND c.role IN ('admin', 'support')
    )
  );

-- Customers can view refunds linked to their orders
DROP POLICY IF EXISTS "Customers can view their order refunds" ON public.refunds;
CREATE POLICY "Customers can view their order refunds"
  ON public.refunds FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = refunds.order_id AND o.customer_id = auth.uid()
    )
  );

-- 4. Staff policies for orders update
DROP POLICY IF EXISTS "Staff can update orders" ON public.orders;
CREATE POLICY "Staff can update orders"
  ON public.orders FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = auth.uid() AND c.role IN ('admin', 'support')
    )
  );

-- ============================================================
-- FILE: 20260919000011_admin_customers_loyalty.sql
-- ============================================================
-- ==============================================================================
-- Migration: 20260919000011_admin_customers_loyalty.sql
-- Description: Add loyalty_points to customers and grant update permissions to support/admin.
-- ==============================================================================

-- 1. Add loyalty_points to public.customers (default 0, used for Phase 6 loyalty program)
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS loyalty_points INTEGER NOT NULL DEFAULT 0 CHECK (loyalty_points >= 0);

-- 2. Update RLS policies on customers table to allow both admin AND support to update customer profiles and roles
DROP POLICY IF EXISTS "Admins can update customers" ON public.customers;
DROP POLICY IF EXISTS "Staff can update customers" ON public.customers;

CREATE POLICY "Staff can update customers"
  ON public.customers FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = auth.uid() AND c.role IN ('admin', 'support')
    )
  );

-- 3. Ensure staff can read return_requests and addresses
DROP POLICY IF EXISTS "Staff can read all return requests" ON public.return_requests;
CREATE POLICY "Staff can read all return requests"
  ON public.return_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = auth.uid() AND c.role IN ('admin', 'support')
    )
  );

DROP POLICY IF EXISTS "Staff can read all addresses" ON public.addresses;
CREATE POLICY "Staff can read all addresses"
  ON public.addresses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = auth.uid() AND c.role IN ('admin', 'support')
    )
  );

-- ============================================================
-- FILE: 20260919000012_admin_phase4_complete.sql
-- ============================================================
-- =============================================================================
-- Migration 20260919000012: Phase 4 Complete Back-office Suite
-- Tables: discount_codes, newsletter_subscribers, store_settings
-- Enhancements: shipping_zones rate column, return_requests staff management
-- =============================================================================

-- 1. DISCOUNT CODES (Coupons & Promotions)
CREATE TABLE IF NOT EXISTS public.discount_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value NUMERIC(10, 2) NOT NULL CHECK (discount_value > 0),
  min_spend NUMERIC(10, 2) DEFAULT 0 CHECK (min_spend >= 0),
  max_uses INT DEFAULT NULL,
  times_used INT NOT NULL DEFAULT 0,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  expires_at TIMESTAMPTZ DEFAULT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_discount_codes_code ON public.discount_codes(code);

-- Seed luxury launch discount codes
INSERT INTO public.discount_codes (code, discount_type, discount_value, min_spend, max_uses, is_active)
VALUES
  ('WELCOME10', 'percentage', 10.00, 0, 1000, true),
  ('VIP20', 'percentage', 20.00, 250.00, 500, true),
  ('ATELIER50', 'fixed', 50.00, 300.00, 200, true)
ON CONFLICT (code) DO NOTHING;

-- 2. NEWSLETTER SUBSCRIBERS
CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL DEFAULT 'footer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_email ON public.newsletter_subscribers(email);

-- Seed initial newsletter subscribers
INSERT INTO public.newsletter_subscribers (email, source)
VALUES
  ('yasmine.fahmy@artscouncil.eg', 'footer'),
  ('k.mansour@cairoatelier.eg', 'checkout'),
  ('nour.sherif@fashionhouse.com', 'footer')
ON CONFLICT (email) DO NOTHING;

-- 3. STORE SETTINGS (Key-Value for Announcement Bar & Store-wide Configurations)
CREATE TABLE IF NOT EXISTS public.store_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Seed default announcement bar settings
INSERT INTO public.store_settings (key, value)
VALUES (
  'announcement_bar',
  '{"enabled": true, "text": "COMPLIMENTARY EXPRESS DELIVERY ON ALL ORDERS ABOVE $200 · CAIRO & GIZA HUB", "link": "/shop"}'::jsonb
) ON CONFLICT (key) DO NOTHING;

-- 4. SHIPPING ZONES: Ensure shipping_rate column exists
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'shipping_zones') THEN
    IF NOT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'shipping_zones' AND column_name = 'shipping_rate'
    ) THEN
      ALTER TABLE public.shipping_zones ADD COLUMN shipping_rate NUMERIC(10, 2) NOT NULL DEFAULT 15.00;
    END IF;
  ELSE
    CREATE TABLE public.shipping_zones (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      governorate TEXT NOT NULL UNIQUE,
      governorate_ar TEXT,
      min_days INT NOT NULL,
      max_days INT NOT NULL,
      cod_available BOOLEAN NOT NULL DEFAULT true,
      shipping_rate NUMERIC(10, 2) NOT NULL DEFAULT 15.00,
      created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
    );
  END IF;
END $$;

-- 5. RLS POLICIES

-- Discount codes: Public can select active codes; Staff can manage all
ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can check active discount codes" ON public.discount_codes;
CREATE POLICY "Public can check active discount codes"
  ON public.discount_codes FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "Staff can manage discount codes" ON public.discount_codes;
CREATE POLICY "Staff can manage discount codes"
  ON public.discount_codes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = auth.uid() AND c.role IN ('admin', 'support')
    )
  );

-- Newsletter subscribers: Public can insert; Staff can view/delete
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can subscribe to newsletter" ON public.newsletter_subscribers;
CREATE POLICY "Public can subscribe to newsletter"
  ON public.newsletter_subscribers FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Staff can view and manage subscribers" ON public.newsletter_subscribers;
CREATE POLICY "Staff can view and manage subscribers"
  ON public.newsletter_subscribers FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = auth.uid() AND c.role IN ('admin', 'support')
    )
  );

-- Store settings: Public can read; Staff can update
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view store settings" ON public.store_settings;
CREATE POLICY "Public can view store settings"
  ON public.store_settings FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Staff can update store settings" ON public.store_settings;
CREATE POLICY "Staff can update store settings"
  ON public.store_settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = auth.uid() AND c.role IN ('admin', 'support')
    )
  );

-- Shipping zones: Staff can update shipping zones
ALTER TABLE public.shipping_zones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read shipping zones" ON public.shipping_zones;
CREATE POLICY "Public can read shipping zones"
  ON public.shipping_zones FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Staff can update shipping zones" ON public.shipping_zones;
CREATE POLICY "Staff can update shipping zones"
  ON public.shipping_zones FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = auth.uid() AND c.role IN ('admin', 'support')
    )
  );

-- Return requests: Staff can update return requests
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'return_requests') THEN
    ALTER TABLE public.return_requests ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Staff can update return requests" ON public.return_requests;
    CREATE POLICY "Staff can update return requests"
      ON public.return_requests FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM public.customers c
          WHERE c.id = auth.uid() AND c.role IN ('admin', 'support')
        )
      );
  END IF;
END $$;

-- ============================================================
-- FILE: 20260919000013_hero_banners.sql
-- ============================================================
-- ============================================================
-- Migration: hero_banners table for rotating homepage carousel
-- ============================================================

CREATE TABLE IF NOT EXISTS public.hero_banners (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url     text NOT NULL,
  season_tag    text NOT NULL DEFAULT '',
  title         text NOT NULL DEFAULT '',
  subtitle      text NOT NULL DEFAULT '',
  cta_text      text NOT NULL DEFAULT 'Shop Now',
  cta_link      text NOT NULL DEFAULT '/shop',
  sort_order    integer NOT NULL DEFAULT 0,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.hero_banners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hero_banners_public_read" ON public.hero_banners
  FOR SELECT USING (is_active = true);

CREATE POLICY "hero_banners_admin_all" ON public.hero_banners
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = auth.uid() AND c.role IN ('admin', 'support')
    )
  );

INSERT INTO public.hero_banners (image_url, season_tag, title, subtitle, cta_text, cta_link, sort_order)
VALUES
  ('/assets/hero/hero.jpg',            'AUTUMN / WINTER 2026', 'Long Sleeve Shirt',         'Architectural silhouettes, heavyweight textiles, archival sleeve artwork.',  'Shop Now',       '/shop',                       0),
  ('/assets/products/black-shirt.jpeg','NEW ARRIVALS 2026',    'The Washed Black Edition',  'Custom-milled 340 GSM organic cotton. Signature ornate baroque sleeve art.', 'Shop The Black', '/shop?color=black',            1),
  ('/assets/products/white-shirt.jpeg','COLLECTION ESSENTIALS','The Optic White Edition',   'Royal indigo botanical sleeve embellishments. Effortless drape and fit.',     'Shop The White', '/shop?color=white',            2)
ON CONFLICT DO NOTHING;

-- ============================================================
-- FILE: 20260919000014_abandoned_cart_recovery.sql
-- ============================================================
-- ==============================================================================
-- VB FITS STUDIOS - ABANDONED CART RECOVERY & TRACKING
-- Migration: 20260919000014_abandoned_cart_recovery.sql
-- Description: Tracking table and columns for automated abandoned cart reminders
-- ==============================================================================

-- 1. Add abandoned_email_sent_at to cart_items
ALTER TABLE public.cart_items 
  ADD COLUMN IF NOT EXISTS abandoned_email_sent_at TIMESTAMPTZ;

-- 2. Create abandoned_cart_emails log table
CREATE TABLE IF NOT EXISTS public.abandoned_cart_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_email TEXT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (subtotal >= 0),
  currency TEXT NOT NULL DEFAULT '$',
  sent_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. Indexes for fast lookup by user and timestamp
CREATE INDEX IF NOT EXISTS idx_abandoned_cart_user_sent 
  ON public.abandoned_cart_emails(user_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_abandoned_cart_email_sent 
  ON public.abandoned_cart_emails(customer_email, sent_at DESC);

-- 4. Enable Row-Level Security
ALTER TABLE public.abandoned_cart_emails ENABLE ROW LEVEL SECURITY;

-- 5. Staff and service role can read/insert
DROP POLICY IF EXISTS "Staff can view abandoned cart logs" ON public.abandoned_cart_emails;
CREATE POLICY "Staff can view abandoned cart logs"
  ON public.abandoned_cart_emails FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.customers c 
      WHERE c.id = auth.uid() AND c.role IN ('admin', 'support')
    )
  );

GRANT SELECT, INSERT ON public.abandoned_cart_emails TO authenticated, service_role;

-- 6. Ensure service_role has access to cart_items for cron tasks
GRANT ALL ON public.cart_items TO service_role;
GRANT ALL ON public.abandoned_cart_emails TO service_role;

-- ============================================================
-- FILE: 20260919000015_supabase_storage_setup.sql
-- ============================================================
-- ==============================================================================
-- VB FITS STUDIOS - PUBLIC STORAGE BUCKET SETUP
-- Migration: 20260919000015_supabase_storage_setup.sql
-- Description: Sets up public storage buckets for product, hero, and lookbook media
--              Folder structure: products/{id}/, hero/, lookbook/
-- ==============================================================================

-- 1. Create or update 'store-media' bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'store-media',
  'store-media',
  true,
  52428800, -- 50 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif', 'video/mp4', 'video/webm']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif', 'video/mp4', 'video/webm']::text[];

-- 2. Maintain 'product-media' bucket compatibility
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-media',
  'product-media',
  true,
  52428800,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif', 'video/mp4', 'video/webm']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif', 'video/mp4', 'video/webm']::text[];

-- 3. Public Read Policies
DROP POLICY IF EXISTS "Public can view store-media" ON storage.objects;
CREATE POLICY "Public can view store-media"
  ON storage.objects FOR SELECT
  USING (bucket_id IN ('store-media', 'product-media'));

-- 4. Staff Upload Policies (INSERT)
DROP POLICY IF EXISTS "Staff can upload store-media" ON storage.objects;
CREATE POLICY "Staff can upload store-media"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id IN ('store-media', 'product-media')
    AND (
      auth.role() = 'authenticated'
      OR auth.uid() IS NOT NULL
    )
  );

-- 5. Staff Update/Delete Policies (UPDATE & DELETE)
DROP POLICY IF EXISTS "Staff can update store-media" ON storage.objects;
CREATE POLICY "Staff can update store-media"
  ON storage.objects FOR UPDATE
  USING (bucket_id IN ('store-media', 'product-media'));

DROP POLICY IF EXISTS "Staff can delete store-media" ON storage.objects;
CREATE POLICY "Staff can delete store-media"
  ON storage.objects FOR DELETE
  USING (bucket_id IN ('store-media', 'product-media'));

-- ============================================================
-- FILE: 20260919000016_postgres_trigram_search.sql
-- ============================================================
-- ==============================================================================
-- VB FITS STUDIOS - POSTGRES FULL-TEXT & TRIGRAM SEARCH (TYPO-TOLERANT)
-- Migration: 20260919000016_postgres_trigram_search.sql
-- Description: Enables pg_trgm for typo tolerance and exposes search_products RPC
--              searching titles, categories, colors, and descriptions.
-- ==============================================================================

-- 1. Enable pg_trgm extension for typo-tolerant trigram search
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- 2. Create GIN Trigram Indexes for high-performance fuzzy matching
CREATE INDEX IF NOT EXISTS idx_products_trgm_name 
  ON public.products USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_products_trgm_subtitle 
  ON public.products USING gin (subtitle gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_products_trgm_description 
  ON public.products USING gin (description gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_categories_trgm_name 
  ON public.categories USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_product_variants_trgm_color 
  ON public.product_variants USING gin (color gin_trgm_ops);

-- 3. Typo-Tolerant Search RPC Function
CREATE OR REPLACE FUNCTION public.search_products(
  search_query TEXT,
  max_results INT DEFAULT 12
)
RETURNS TABLE (
  id TEXT,
  slug TEXT,
  name TEXT,
  subtitle TEXT,
  description TEXT,
  price NUMERIC,
  currency TEXT,
  category TEXT,
  color TEXT,
  images TEXT[],
  similarity_score REAL
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  clean_q TEXT;
BEGIN
  clean_q := trim(search_query);
  IF clean_q = '' THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH product_color_agg AS (
    SELECT 
      pv.product_id,
      string_agg(DISTINCT pv.color, ' ') AS all_colors,
      (array_agg(DISTINCT pv.color))[1] AS primary_color
    FROM public.product_variants pv
    GROUP BY pv.product_id
  ),
  product_image_agg AS (
    SELECT 
      pi.product_id,
      array_agg(pi.url ORDER BY pi.is_primary DESC, pi.display_order ASC) AS img_urls
    FROM public.product_images pi
    GROUP BY pi.product_id
  )
  SELECT 
    p.id::TEXT,
    p.slug::TEXT,
    p.name::TEXT,
    COALESCE(p.subtitle, '')::TEXT,
    COALESCE(p.description, '')::TEXT,
    p.price::NUMERIC,
    COALESCE(p.currency, '$')::TEXT,
    COALESCE(c.name, 'Collection')::TEXT,
    COALESCE(pca.primary_color, 'Standard')::TEXT,
    COALESCE(pia.img_urls, ARRAY[]::TEXT[]),
    (
      -- Title match (exact or trigram similarity)
      (similarity(p.name, clean_q) * 3.5) +
      -- Subtitle match
      (similarity(COALESCE(p.subtitle, ''), clean_q) * 1.5) +
      -- Category match
      (similarity(COALESCE(c.name, ''), clean_q) * 2.0) +
      -- Color match
      (similarity(COALESCE(pca.all_colors, ''), clean_q) * 2.5) +
      -- Substring presence bonus
      (CASE WHEN p.name ILIKE '%' || clean_q || '%' THEN 2.0 ELSE 0.0 END) +
      (CASE WHEN c.name ILIKE '%' || clean_q || '%' THEN 1.0 ELSE 0.0 END) +
      (CASE WHEN pca.all_colors ILIKE '%' || clean_q || '%' THEN 1.5 ELSE 0.0 END) +
      -- Full-text search rank
      (ts_rank(
        to_tsvector('simple', coalesce(p.name, '') || ' ' || coalesce(p.subtitle, '') || ' ' || coalesce(p.description, '') || ' ' || coalesce(c.name, '') || ' ' || coalesce(pca.all_colors, '')),
        plainto_tsquery('simple', clean_q)
      ) * 1.5)
    )::REAL AS score
  FROM public.products p
  LEFT JOIN public.categories c ON c.id = p.category_id
  LEFT JOIN product_color_agg pca ON pca.product_id = p.id
  LEFT JOIN product_image_agg pia ON pia.product_id = p.id
  WHERE 
    p.is_published = true
    AND (
      -- Typo-tolerant trigram match (> 0.15 threshold)
      similarity(p.name, clean_q) > 0.15
      OR similarity(COALESCE(p.subtitle, ''), clean_q) > 0.15
      OR similarity(COALESCE(c.name, ''), clean_q) > 0.2
      OR similarity(COALESCE(pca.all_colors, ''), clean_q) > 0.2
      -- Partial / exact substring match
      OR p.name ILIKE '%' || clean_q || '%'
      OR p.description ILIKE '%' || clean_q || '%'
      OR c.name ILIKE '%' || clean_q || '%'
      OR pca.all_colors ILIKE '%' || clean_q || '%'
      -- Full-text search match
      OR to_tsvector('simple', coalesce(p.name, '') || ' ' || coalesce(p.subtitle, '') || ' ' || coalesce(p.description, '') || ' ' || coalesce(c.name, '') || ' ' || coalesce(pca.all_colors, ''))
         @@ plainto_tsquery('simple', clean_q)
    )
  ORDER BY score DESC, p.created_at DESC
  LIMIT max_results;
END;
$$;

-- 4. Dynamic Search Suggestion Pills RPC Function
CREATE OR REPLACE FUNCTION public.get_search_suggestions(
  max_suggestions INT DEFAULT 6
)
RETURNS TABLE (suggestion TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  RETURN QUERY
  WITH terms AS (
    -- 1. Published Categories
    SELECT c.name AS term, 1 AS priority
    FROM public.categories c
    WHERE EXISTS (SELECT 1 FROM public.products p WHERE p.category_id = c.id AND p.is_published = true)
    
    UNION ALL
    
    -- 2. Published Colors
    SELECT DISTINCT pv.color AS term, 2 AS priority
    FROM public.product_variants pv
    JOIN public.products p ON p.id = pv.product_id
    WHERE p.is_published = true AND pv.color IS NOT NULL AND pv.color <> ''
    
    UNION ALL
    
    -- 3. Popular or Featured Silhouettes
    SELECT p.name AS term, 3 AS priority
    FROM public.products p
    WHERE p.is_published = true AND (p.featured = true OR p.is_new_arrival = true)
  )
  SELECT DISTINCT t.term::TEXT
  FROM terms t
  WHERE t.term IS NOT NULL AND length(trim(t.term)) > 1
  ORDER BY t.term::TEXT ASC
  LIMIT max_suggestions;
END;
$$;

-- 5. Grant Execute Permissions
GRANT EXECUTE ON FUNCTION public.search_products(TEXT, INT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_search_suggestions(INT) TO anon, authenticated, service_role;

-- ============================================================
-- FILE: 20260919000017_rls_policies.sql
-- ============================================================
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

-- ============================================================
-- FILE: 20260919000018_create_restock_signups.sql
-- ============================================================
-- ==============================================================================
-- Migration: 20260919000018_create_restock_signups.sql
-- Description: Create restock_signups table for PDP "Restock Me" alerts
--              capturing product_variant_id + contact (email or WhatsApp).
-- ==============================================================================

-- 1. Create restock_signups table
CREATE TABLE IF NOT EXISTS public.restock_signups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
  contact TEXT NOT NULL,
  contact_type TEXT NOT NULL DEFAULT 'email' CHECK (contact_type IN ('email', 'whatsapp')),
  notified BOOLEAN NOT NULL DEFAULT false,
  notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_restock_signup UNIQUE (product_variant_id, contact)
);

-- 2. Performance indexes for fast lookups during inventory restock
CREATE INDEX IF NOT EXISTS idx_restock_signups_variant_notified 
  ON public.restock_signups(product_variant_id, notified);

CREATE INDEX IF NOT EXISTS idx_restock_signups_contact 
  ON public.restock_signups(contact);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.restock_signups ENABLE ROW LEVEL SECURITY;

-- 4. Public can insert restock requests (PDP customer signups)
DROP POLICY IF EXISTS "Public can insert restock signups" ON public.restock_signups;
CREATE POLICY "Public can insert restock signups"
  ON public.restock_signups FOR INSERT
  WITH CHECK (true);

-- 5. Staff and authenticated users can view/manage signups
DROP POLICY IF EXISTS "Staff can manage restock signups" ON public.restock_signups;
CREATE POLICY "Staff can manage restock signups"
  ON public.restock_signups FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = auth.uid() AND c.role IN ('admin', 'support')
    )
  );

-- 6. Grant permissions to anon and authenticated roles
GRANT INSERT, SELECT, UPDATE ON public.restock_signups TO anon, authenticated;

-- ============================================================
-- FILE: 20260919000019_sync_phone_to_customers.sql
-- ============================================================
-- ==============================================================================
-- Migration: 20260919000019_sync_phone_to_customers.sql
-- Description: Ensure phone is synced from auth user_metadata into customers
--              table on both INSERT (new signup) and UPDATE (profile edits).
-- ==============================================================================

-- 1. Ensure phone column exists (safe no-op if already present)
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS phone TEXT;

-- 2. Update handle_new_customer trigger to include phone from user_metadata
--    so that new signups automatically get their phone persisted.
CREATE OR REPLACE FUNCTION public.handle_new_customer()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.customers (id, email, full_name, avatar_url, phone, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'phone',
    COALESCE(NEW.raw_user_meta_data->>'role', 'customer')
  )
  ON CONFLICT (id) DO UPDATE SET
    email        = EXCLUDED.email,
    full_name    = COALESCE(EXCLUDED.full_name, public.customers.full_name),
    avatar_url   = COALESCE(EXCLUDED.avatar_url, public.customers.avatar_url),
    phone        = COALESCE(EXCLUDED.phone, public.customers.phone),
    role         = COALESCE(public.customers.role, EXCLUDED.role, 'customer'),
    updated_at   = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Ensure the trigger is attached (re-create in case it was dropped)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_customer();

-- 4. Also fire on UPDATE of auth.users so that phone edits via
--    supabase.auth.updateUser({ data: { phone } }) propagate automatically.
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  WHEN (
    OLD.raw_user_meta_data IS DISTINCT FROM NEW.raw_user_meta_data
    OR OLD.email IS DISTINCT FROM NEW.email
  )
  EXECUTE FUNCTION public.handle_new_customer();

-- 5. Allow authenticated users to update their own phone in customers table
--    (needed for the updatePhone function in AuthContext)
DROP POLICY IF EXISTS "Users can update their own phone" ON public.customers;
CREATE POLICY "Users can update their own phone"
  ON public.customers FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ============================================================
-- FILE: 20260925000020_critical_bug_fixes.sql
-- ============================================================
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

-- ─── 0. HELPER FUNCTIONS WITH SECURITY DEFINER (Prevents RLS infinite recursion) ──
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

-- ─── 1. FIX ORDERS RLS: Allow admin/staff to update orders (was blocked to all) ─
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "orders_no_client_update" ON public.orders;
DROP POLICY IF EXISTS "orders_update_admin_or_own" ON public.orders;
CREATE POLICY "orders_update_admin_or_own"
  ON public.orders
  FOR UPDATE
  USING (
    customer_id = auth.uid()
    OR customer_id IS NULL
    OR public.is_admin_or_support()
  );

-- Also allow admin to delete orders (for test data purge)
DROP POLICY IF EXISTS "orders_delete_admin" ON public.orders;
CREATE POLICY "orders_delete_admin"
  ON public.orders
  FOR DELETE
  USING (public.is_admin());

-- Fix SELECT: admin can see ALL orders, user sees own or guest orders
DROP POLICY IF EXISTS "orders_select_own" ON public.orders;
DROP POLICY IF EXISTS "orders_select_admin_or_own" ON public.orders;
CREATE POLICY "orders_select_admin_or_own"
  ON public.orders
  FOR SELECT
  USING (
    customer_id = auth.uid()
    OR customer_id IS NULL
    OR public.is_admin_or_support()
  );

-- Allow order creation from checkout (guest or authenticated)
DROP POLICY IF EXISTS "orders_insert_checkout" ON public.orders;
CREATE POLICY "orders_insert_checkout"
  ON public.orders
  FOR INSERT
  WITH CHECK (
    customer_id = auth.uid()
    OR customer_id IS NULL
    OR public.is_admin_or_support()
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
          OR public.is_admin_or_support()
        )
    )
  );

DROP POLICY IF EXISTS "order_items_insert_checkout" ON public.order_items;
CREATE POLICY "order_items_insert_checkout"
  ON public.order_items
  FOR INSERT
  WITH CHECK (true);

-- Admin can update/delete order_items too
DROP POLICY IF EXISTS "order_items_update_admin" ON public.order_items;
CREATE POLICY "order_items_update_admin"
  ON public.order_items
  FOR UPDATE
  USING (public.is_admin_or_support());

DROP POLICY IF EXISTS "order_items_delete_admin" ON public.order_items;
CREATE POLICY "order_items_delete_admin"
  ON public.order_items
  FOR DELETE
  USING (public.is_admin_or_support());

-- ─── 3. FIX CUSTOMERS TABLE RLS ───────────────────────────────────────────────
-- The previous policy used auth_id = auth.uid() but the column is named 'id'.
-- This caused customers to not be able to read/update their own profile.


DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'customers' AND table_schema = 'public') THEN
    ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

    -- Allow customers to read their own row (using id not auth_id) or admin
    DROP POLICY IF EXISTS "customers_select_own" ON public.customers;
    DROP POLICY IF EXISTS "customers_select_admin" ON public.customers;
    DROP POLICY IF EXISTS "customers_select_own_or_admin" ON public.customers;
    CREATE POLICY "customers_select_own_or_admin"
      ON public.customers FOR SELECT
      USING (id = auth.uid() OR public.is_admin_or_support());

    -- Allow customers to update their own row or admin
    DROP POLICY IF EXISTS "customers_update_own" ON public.customers;
    DROP POLICY IF EXISTS "customers_update_admin" ON public.customers;
    CREATE POLICY "customers_update_own"
      ON public.customers FOR UPDATE
      USING (id = auth.uid() OR public.is_admin());

    -- Allow new authenticated user to insert their own customer row
    DROP POLICY IF EXISTS "customers_insert_own" ON public.customers;
    CREATE POLICY "customers_insert_own"
      ON public.customers FOR INSERT
      WITH CHECK (id = auth.uid() OR public.is_admin());
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
    OR public.is_admin_or_support()
  );

-- Allow admin INSERT (create new products)
DROP POLICY IF EXISTS "Staff can insert products" ON public.products;
CREATE POLICY "Staff can insert products"
  ON public.products FOR INSERT
  WITH CHECK (public.is_admin_or_support());

-- Allow admin UPDATE
DROP POLICY IF EXISTS "Staff can update products" ON public.products;
CREATE POLICY "Staff can update products"
  ON public.products FOR UPDATE
  USING (public.is_admin_or_support());

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
      USING (public.is_admin_or_support());
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
      USING (public.is_admin_or_support());
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

-- ============================================================
-- FILE: 20260925000021_fix_infinite_recursion_and_wishlists.sql
-- ============================================================
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

-- ============================================================
-- FILE: 20260929000022_site_settings_and_launch_gate.sql
-- ============================================================
-- ==============================================================================
-- Migration: 20260929000022_site_settings_and_launch_gate.sql
-- Description: Create site_settings table for launch_at date/time and gate controls.
--              Extend waitlist_signups for phone/contact_type support.
-- ==============================================================================

-- 1. Create site_settings table
CREATE TABLE IF NOT EXISTS public.site_settings (
  id TEXT PRIMARY KEY DEFAULT 'current',
  launch_at TIMESTAMPTZ NOT NULL DEFAULT '2026-10-10T00:00:00+03:00',
  countdown_gate_enabled BOOLEAN NOT NULL DEFAULT true,
  gate_enabled BOOLEAN NOT NULL DEFAULT true,
  countdown_strip_enabled BOOLEAN NOT NULL DEFAULT true,
  teaser_headline TEXT NOT NULL DEFAULT 'THE ARCHIVAL VAULT OPENS SOON',
  teaser_subtext TEXT NOT NULL DEFAULT 'SECURE EARLY ATELIER ACCESS & PRIVATE VIP DROP DISPATCHES',
  teaser_text TEXT NOT NULL DEFAULT 'THE ARCHIVAL VAULT OPENS SOON. SECURE EARLY ATELIER ACCESS.',
  countdown_strip_text TEXT NOT NULL DEFAULT 'OFFICIAL LAUNCH INCOMING · WORLDWIDE DROP',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Ensure columns exist if table was already created
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS countdown_gate_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS gate_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS teaser_headline TEXT NOT NULL DEFAULT 'THE ARCHIVAL VAULT OPENS SOON',
  ADD COLUMN IF NOT EXISTS teaser_subtext TEXT NOT NULL DEFAULT 'SECURE EARLY ATELIER ACCESS & PRIVATE VIP DROP DISPATCHES';

-- 2. Seed default row
INSERT INTO public.site_settings (id, launch_at, countdown_gate_enabled, gate_enabled, countdown_strip_enabled, teaser_headline, teaser_subtext, teaser_text, countdown_strip_text)
VALUES (
  'current',
  '2026-10-10T00:00:00+03:00',
  true,
  true,
  true,
  'THE ARCHIVAL VAULT OPENS SOON',
  'SECURE EARLY ATELIER ACCESS & PRIVATE VIP DROP DISPATCHES',
  'THE ARCHIVAL VAULT OPENS SOON. SECURE EARLY ATELIER ACCESS.',
  'OFFICIAL LAUNCH INCOMING · WORLDWIDE DROP'
) ON CONFLICT (id) DO UPDATE SET
  launch_at = EXCLUDED.launch_at,
  countdown_gate_enabled = EXCLUDED.countdown_gate_enabled,
  gate_enabled = EXCLUDED.gate_enabled,
  countdown_strip_enabled = EXCLUDED.countdown_strip_enabled,
  teaser_headline = EXCLUDED.teaser_headline,
  teaser_subtext = EXCLUDED.teaser_subtext,
  teaser_text = EXCLUDED.teaser_text,
  countdown_strip_text = EXCLUDED.countdown_strip_text,
  updated_at = timezone('utc'::text, now());

-- 3. Also sync into store_settings key-value store for dual-compatibility
INSERT INTO public.store_settings (key, value)
VALUES (
  'site_settings',
  '{"launch_at": "2026-10-10T00:00:00+03:00", "countdown_strip_enabled": true, "gate_enabled": true, "teaser_text": "THE ARCHIVAL VAULT OPENS SOON. SECURE EARLY ATELIER ACCESS.", "countdown_strip_text": "OFFICIAL LAUNCH INCOMING · WORLDWIDE DROP"}'::jsonb
) ON CONFLICT (key) DO NOTHING;

-- 4. Enable Row Level Security (RLS) on site_settings
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view site settings" ON public.site_settings;
CREATE POLICY "Public can view site settings"
  ON public.site_settings FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Staff can manage site settings" ON public.site_settings;
CREATE POLICY "Staff can manage site settings"
  ON public.site_settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = auth.uid() AND c.role IN ('admin', 'support')
    )
  );

GRANT ALL ON public.site_settings TO anon, authenticated, service_role;

-- 5. Extend waitlist_signups to support WhatsApp/phone, source, and name
ALTER TABLE public.waitlist_signups
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS contact_type TEXT DEFAULT 'email',
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'launch_gate',
  ADD COLUMN IF NOT EXISTS name TEXT;

-- Allow email to be nullable in case customer registers exclusively via WhatsApp
DO $$
BEGIN
  ALTER TABLE public.waitlist_signups ALTER COLUMN email DROP NOT NULL;
EXCEPTION
  WHEN others THEN
    NULL;
END $$;

-- Performance index for source and contact_type
CREATE INDEX IF NOT EXISTS idx_waitlist_signups_source ON public.waitlist_signups(source);
CREATE INDEX IF NOT EXISTS idx_waitlist_signups_phone ON public.waitlist_signups(phone);

-- ============================================================
-- FILE: 20260929000023_branch_field_and_integrity_constraints.sql
-- ============================================================
-- ==============================================================================
-- VB FITS STUDIOS
-- Migration: 20260929000023_branch_field_and_integrity_constraints.sql
-- Description:
--   1. Add `branch` (region/governorate assignment) to public.customers
--   2. Ownership trigger: addresses can only be written by their owner
--   3. Ownership trigger: orders can only be inserted with the caller's uid
--   4. RLS / grants for branch column
-- ==============================================================================

-- ── 1. BRANCH FIELD ON CUSTOMERS ──────────────────────────────────────────────

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS branch TEXT;

COMMENT ON COLUMN public.customers.branch IS
  'Administrative region or branch assignment set by admin staff '
  '(e.g. Cairo-HQ, Alex-Warehouse, Remote). NULL = unassigned.';

CREATE INDEX IF NOT EXISTS idx_customers_branch ON public.customers(branch)
  WHERE branch IS NOT NULL;

-- ── 2. OWNERSHIP ENFORCEMENT — ADDRESSES ──────────────────────────────────────
-- Blocks INSERT/UPDATE where customer_id != auth.uid() for non-staff users.

CREATE OR REPLACE FUNCTION public.enforce_address_owner()
RETURNS TRIGGER AS $$
BEGIN
  -- Staff (admin / support) may write any customer's address
  IF public.is_admin_or_support() THEN
    RETURN NEW;
  END IF;

  -- Unauthenticated: block
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION
      'vbfits_address_auth_required: You must be logged in to manage addresses.'
      USING ERRCODE = '42501';
  END IF;

  -- Authenticated customer: customer_id must equal their own uid
  IF NEW.customer_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION
      'vbfits_address_ownership_violation: Cannot write an address for another customer.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS tr_enforce_address_owner ON public.addresses;
CREATE TRIGGER tr_enforce_address_owner
  BEFORE INSERT OR UPDATE ON public.addresses
  FOR EACH ROW EXECUTE FUNCTION public.enforce_address_owner();

-- ── 3. OWNERSHIP ENFORCEMENT — ORDERS (INSERT ONLY) ──────────────────────────
-- Guest orders (customer_id IS NULL) are exempt.
-- Staff can write any customer_id.
-- Authenticated customers: customer_id must match auth.uid().

CREATE OR REPLACE FUNCTION public.enforce_order_customer_id()
RETURNS TRIGGER AS $$
BEGIN
  -- Guest order: no constraint
  IF NEW.customer_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Staff bypass
  IF public.is_admin_or_support() THEN
    RETURN NEW;
  END IF;

  -- Unauthenticated with a customer_id set: block
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION
      'vbfits_order_auth_required: Cannot assign a customer_id without an active session.'
      USING ERRCODE = '42501';
  END IF;

  -- Authenticated: customer_id must be the caller's uid
  IF NEW.customer_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION
      'vbfits_order_ownership_violation: Order customer_id does not match the authenticated user.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS tr_enforce_order_customer_id ON public.orders;
CREATE TRIGGER tr_enforce_order_customer_id
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.enforce_order_customer_id();

-- ── 4. GRANTS FOR BRANCH COLUMN ───────────────────────────────────────────────
-- Existing RLS policies (migration 0 + 7) already gate row-level access.
-- Column-level grants ensure the field is readable/writable where rows are allowed.

GRANT SELECT (branch) ON public.customers TO authenticated, anon, service_role;
GRANT UPDATE (branch) ON public.customers TO authenticated, service_role;

-- ============================================================
-- FILE: 20260929000024_search_vector_trigger.sql
-- ============================================================
-- ==============================================================================
-- Migration: 20260929000024_search_vector_trigger.sql
-- Description: Adds a stored tsvector column to products and a trigger to auto-update
--              it on insert/update. Updates search_products to use this index
--              instead of computing to_tsvector on the fly.
-- ==============================================================================

-- 1. Add search_vector column to products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- 2. Create an index on the search_vector
CREATE INDEX IF NOT EXISTS idx_products_search_vector 
  ON public.products USING gin(search_vector);

-- 3. Backfill existing products
UPDATE public.products
SET search_vector = to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(subtitle, '') || ' ' || coalesce(description, ''));

-- 4. Create trigger to auto-update search_vector
CREATE OR REPLACE FUNCTION public.products_search_vector_trigger()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('simple', coalesce(NEW.name, '') || ' ' || coalesce(NEW.subtitle, '') || ' ' || coalesce(NEW.description, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_products_search_vector_update ON public.products;
CREATE TRIGGER tr_products_search_vector_update
  BEFORE INSERT OR UPDATE OF name, subtitle, description ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.products_search_vector_trigger();

-- 5. Update the search_products RPC to use the precomputed vector
CREATE OR REPLACE FUNCTION public.search_products(
  search_query TEXT,
  max_results INT DEFAULT 12
)
RETURNS TABLE (
  id TEXT,
  slug TEXT,
  name TEXT,
  subtitle TEXT,
  description TEXT,
  price NUMERIC,
  currency TEXT,
  category TEXT,
  color TEXT,
  images TEXT[],
  similarity_score REAL
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  clean_q TEXT;
BEGIN
  clean_q := trim(search_query);
  IF clean_q = '' THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH product_color_agg AS (
    SELECT 
      pv.product_id,
      string_agg(DISTINCT pv.color, ' ') AS all_colors,
      (array_agg(DISTINCT pv.color))[1] AS primary_color
    FROM public.product_variants pv
    GROUP BY pv.product_id
  ),
  product_image_agg AS (
    SELECT 
      pi.product_id,
      array_agg(pi.url ORDER BY pi.is_primary DESC, pi.display_order ASC) AS img_urls
    FROM public.product_images pi
    GROUP BY pi.product_id
  )
  SELECT 
    p.id::TEXT,
    p.slug::TEXT,
    p.name::TEXT,
    COALESCE(p.subtitle, '')::TEXT,
    COALESCE(p.description, '')::TEXT,
    p.price::NUMERIC,
    COALESCE(p.currency, '$')::TEXT,
    COALESCE(c.name, 'Collection')::TEXT,
    COALESCE(pca.primary_color, 'Standard')::TEXT,
    COALESCE(pia.img_urls, ARRAY[]::TEXT[]),
    (
      -- Title match (exact or trigram similarity)
      (similarity(p.name, clean_q) * 3.5) +
      -- Subtitle match
      (similarity(COALESCE(p.subtitle, ''), clean_q) * 1.5) +
      -- Category match
      (similarity(COALESCE(c.name, ''), clean_q) * 2.0) +
      -- Color match
      (similarity(COALESCE(pca.all_colors, ''), clean_q) * 2.5) +
      -- Substring presence bonus
      (CASE WHEN p.name ILIKE '%' || clean_q || '%' THEN 2.0 ELSE 0.0 END) +
      (CASE WHEN c.name ILIKE '%' || clean_q || '%' THEN 1.0 ELSE 0.0 END) +
      (CASE WHEN pca.all_colors ILIKE '%' || clean_q || '%' THEN 1.5 ELSE 0.0 END) +
      -- Full-text search rank (using precomputed vector + category + colors)
      (ts_rank(
        p.search_vector || to_tsvector('simple', coalesce(c.name, '') || ' ' || coalesce(pca.all_colors, '')),
        plainto_tsquery('simple', clean_q)
      ) * 1.5)
    )::REAL AS score
  FROM public.products p
  LEFT JOIN public.categories c ON c.id = p.category_id
  LEFT JOIN product_color_agg pca ON pca.product_id = p.id
  LEFT JOIN product_image_agg pia ON pia.product_id = p.id
  WHERE 
    p.is_published = true
    AND (
      -- Typo-tolerant trigram match (> 0.15 threshold)
      similarity(p.name, clean_q) > 0.15
      OR similarity(COALESCE(p.subtitle, ''), clean_q) > 0.15
      OR similarity(COALESCE(c.name, ''), clean_q) > 0.2
      OR similarity(COALESCE(pca.all_colors, ''), clean_q) > 0.2
      -- Partial / exact substring match
      OR p.name ILIKE '%' || clean_q || '%'
      OR p.description ILIKE '%' || clean_q || '%'
      OR c.name ILIKE '%' || clean_q || '%'
      OR pca.all_colors ILIKE '%' || clean_q || '%'
      -- Full-text search match using precomputed vector
      OR (p.search_vector || to_tsvector('simple', coalesce(c.name, '') || ' ' || coalesce(pca.all_colors, '')))
         @@ plainto_tsquery('simple', clean_q)
    )
  ORDER BY score DESC, p.created_at DESC
  LIMIT max_results;
END;
$$;
-- ============================================================
-- FILE: 20260929000025_hero_media_types.sql
-- ============================================================
-- ==============================================================================
-- Migration: 20260929000025_hero_media_types.sql
-- Description: Extends hero_banners table to support video (mp4), image, and gif.
-- ==============================================================================

ALTER TABLE public.hero_banners 
  ADD COLUMN IF NOT EXISTS media_type TEXT NOT NULL DEFAULT 'image' CHECK (media_type IN ('image', 'video', 'gif')),
  ADD COLUMN IF NOT EXISTS media_url TEXT;

-- Migrate existing data
UPDATE public.hero_banners 
SET media_url = image_url 
WHERE media_url IS NULL AND image_url IS NOT NULL;

-- Make media_url required and drop old image_url safely
ALTER TABLE public.hero_banners 
  ALTER COLUMN media_url SET NOT NULL,
  DROP COLUMN IF EXISTS image_url;

-- ============================================================
-- FILE: 20260929000026_chatbot_schema.sql
-- ============================================================
-- ==============================================================================
-- Migration: 20260929000026_chatbot_schema.sql
-- Description: Adds tables for chatbot FAQs and conversation logging
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.chatbot_faqs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trigger_keywords TEXT[] NOT NULL DEFAULT '{}',
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure is_active is added if the table already existed from a previous partial run
ALTER TABLE public.chatbot_faqs ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.chatbot_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL,
    user_message TEXT NOT NULL,
    matched_faq_id UUID REFERENCES public.chatbot_faqs(id) ON DELETE SET NULL,
    is_unmatched BOOLEAN NOT NULL DEFAULT false,
    is_human_handoff BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.chatbot_faqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chatbot_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if re-running
DROP POLICY IF EXISTS "Allow public read access to chatbot_faqs" ON public.chatbot_faqs;
DROP POLICY IF EXISTS "Allow admin full access to chatbot_faqs" ON public.chatbot_faqs;
DROP POLICY IF EXISTS "Allow public insert access to chatbot_logs" ON public.chatbot_logs;
DROP POLICY IF EXISTS "Allow admin full access to chatbot_logs" ON public.chatbot_logs;

-- Policies for chatbot_faqs
CREATE POLICY "Allow public read access to chatbot_faqs"
    ON public.chatbot_faqs
    FOR SELECT
    TO public
    USING (true);

CREATE POLICY "Allow admin full access to chatbot_faqs"
    ON public.chatbot_faqs
    FOR ALL
    TO authenticated
    USING (public.is_admin_or_support());

-- Policies for chatbot_logs
CREATE POLICY "Allow public insert access to chatbot_logs"
    ON public.chatbot_logs
    FOR INSERT
    TO public
    WITH CHECK (true);

CREATE POLICY "Allow admin full access to chatbot_logs"
    ON public.chatbot_logs
    FOR ALL
    TO authenticated
    USING (public.is_admin_or_support());

-- Initial Seed Data
INSERT INTO public.chatbot_faqs (trigger_keywords, question, answer, display_order)
VALUES 
    (ARRAY['shipping', 'delivery', 'track', 'when'], 'Shipping & Delivery', 'We offer complimentary express courier shipping on all domestic and international orders surpassing 1,500 EGP. Orders placed before 2:00 PM EST ship same business day.', 1),
    (ARRAY['return', 'refund', 'exchange'], 'Returns & Refunds', 'We offer complimentary 14-day returns on unworn merchandise in pristine, original condition with all internal woven labels, security tags, and luxury presentation packaging intact.', 2),
    (ARRAY['size', 'sizing', 'fit', 'measure'], 'Sizing', 'Our pieces are tailored to an architectural drop-shoulder cut. We recommend taking your true size for the intended oversized look, or sizing down for a more standard fit.', 3),
    (ARRAY['payment', 'pay', 'visa', 'mastercard', 'cod', 'cash'], 'Payment Methods', 'We accept all major credit cards (Visa, Mastercard, Amex), Apple Pay, and offer Cash on Delivery (COD) for domestic orders.', 4),
    (ARRAY['track', 'order', 'status', 'where'], 'Track My Order', 'You can track the status of your order by visiting the "Track Order" page from the footer menu using your order number and email address.', 5),
    (ARRAY['human', 'agent', 'support', 'contact', 'talk', 'help'], 'Talk to a Human', 'Connecting you to a client concierge advisor...', 6)
ON CONFLICT DO NOTHING;

-- ============================================================
-- FILE: 20260930000027_fix_return_requests_rls.sql
-- ============================================================
-- ==============================================================================
-- Migration: 20260930000027_fix_return_requests_rls.sql
-- Description: Fix RLS policy on return_requests to allow anon/guest inserts
-- ==============================================================================

-- Drop all existing insert policies to start clean
DROP POLICY IF EXISTS "Customers can create return requests" ON public.return_requests;
DROP POLICY IF EXISTS "Guests can create return requests"   ON public.return_requests;
DROP POLICY IF EXISTS "Allow inserts to return_requests"   ON public.return_requests;

-- Allow anyone (anon or authenticated) to INSERT a return request.
-- Security relies on order_id being a secret UUID (not guessable).
-- Admin staff can manage via service_role / admin dashboard.
CREATE POLICY "Allow inserts to return_requests"
  ON public.return_requests FOR INSERT
  TO public
  WITH CHECK (true);

-- Ensure the column reason_note exists (in case it was missed)
ALTER TABLE public.return_requests
  ADD COLUMN IF NOT EXISTS reason_note TEXT;

-- Also allow anyone to read their own return request right after submission
DROP POLICY IF EXISTS "Customers can view own return requests" ON public.return_requests;
CREATE POLICY "Customers can view own return requests"
  ON public.return_requests FOR SELECT
  TO public
  USING (
    customer_id = auth.uid()
    OR customer_id IS NULL
  );

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- ============================================================
-- FILE: 20260930000028_seed_chatbot_faqs.sql
-- ============================================================
-- ==============================================================================
-- Migration: 20260930000028_seed_chatbot_faqs.sql
-- Description: Seeds structured Arabic FAQ categories and Q&A pairs
--              inspired by Zara, ASOS, and leading Egyptian fashion brands.
--              Resets existing FAQs and inserts fresh categorized data.
-- ==============================================================================

-- Add category column if not present
ALTER TABLE public.chatbot_faqs ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'عام';

-- Clear existing FAQs and re-seed cleanly
TRUNCATE TABLE public.chatbot_faqs RESTART IDENTITY CASCADE;

-- ─────────────────────────────────────────────────────────────────
-- CATEGORY 1: المقاسات والمقاييس
-- ─────────────────────────────────────────────────────────────────
INSERT INTO public.chatbot_faqs (category, trigger_keywords, question, answer, display_order, is_active) VALUES
(
  'المقاسات والمقاييس',
  ARRAY['مقاس', 'size', 'مقاسات', 'ازاي', 'قياس', 'بيفضل', 'ايه المقاس', 'كبير', 'صغير', 'جداول المقاسات'],
  'كيف أختار المقاس الصحيح؟',
  'نعتمد جدول مقاسات دقيقاً. قِس محيط صدرك، خصرك، وطولك. قمصاننا بقصة oversized مريحة — ننصح بالمقاس العادي إذا كنت بين مقاسين. اضغط على "جدول المقاسات" في صفحة المنتج لمقارنة القياسات بالسنتيمتر.',
  10, true
),
(
  'المقاسات والمقاييس',
  ARRAY['مقاس صغير', 'مقاس كبير', 'oversized', 'فضفاض', 'ضيق', 'fit'],
  'هل القطع oversized أم slim fit؟',
  'جميع قطع VB Fits Studios مصممة بقصة oversized فاخرة مع كتفين منخفضين لتحقيق الأناقة الشارعية. إذا كنت تفضل fit أضيق، خذ مقاساً أصغر من مقاسك العادي.',
  11, true
),
(
  'المقاسات والمقاييس',
  ARRAY['XXL', 'كبير', 'بلاس', 'plus size', 'مقاس كبير جداً'],
  'هل تتوفر مقاسات كبيرة؟',
  'نعم، نوفر مقاسات من S حتى XXL في معظم القطع. بعض الإصدارات المحدودة قد تختلف — تحقق من توفر المقاسات في صفحة المنتج مباشرةً.',
  12, true
);

-- ─────────────────────────────────────────────────────────────────
-- CATEGORY 2: الشحن والتوصيل
-- ─────────────────────────────────────────────────────────────────
INSERT INTO public.chatbot_faqs (category, trigger_keywords, question, answer, display_order, is_active) VALUES
(
  'الشحن والتوصيل',
  ARRAY['شحن', 'delivery', 'توصيل', 'وصول', 'بياخد كام يوم', 'متى يوصل', 'موعد', 'تتوقع', 'وقت الشحن'],
  'كم يستغرق التوصيل؟',
  'التوصيل داخل القاهرة والجيزة: 1-2 يوم عمل. باقي المحافظات: 2-4 أيام عمل. الطلبات الدولية: 7-14 يوم عمل. يبدأ العد بعد تأكيد الطلب وشحنه.',
  20, true
),
(
  'الشحن والتوصيل',
  ARRAY['رسوم شحن', 'تكلفة توصيل', 'شحن مجاني', 'free shipping', 'كم الشحن'],
  'هل التوصيل مجاني؟',
  'نعم، التوصيل مجاني على جميع الطلبات التي تتجاوز 250 ج.م. للطلبات الأقل، يُضاف رسم شحن بسيط يُعرض عند إتمام الطلب.',
  21, true
),
(
  'الشحن والتوصيل',
  ARRAY['تتبع', 'track', 'tracking', 'رقم تتبع', 'أين طلبي', 'وين طلبي', 'track order'],
  'كيف أتتبع طلبي؟',
  'بعد شحن طلبك، ستصلك رسالة تأكيد بها رابط تتبع. يمكنك أيضاً الدخول على صفحة "تتبع الطلب" من القائمة وإدخال رقم الطلب والبريد الإلكتروني.',
  22, true
),
(
  'الشحن والتوصيل',
  ARRAY['خارج مصر', 'دولي', 'international', 'shipping abroad', 'بيوصل لبرا'],
  'هل تشحنون خارج مصر؟',
  'نعم، نشحن إلى جميع دول العالم. يتم احتساب تكلفة الشحن الدولي عند إتمام الطلب بناءً على الدولة والوزن.',
  23, true
);

-- ─────────────────────────────────────────────────────────────────
-- CATEGORY 3: الإرجاع والاستبدال
-- ─────────────────────────────────────────────────────────────────
INSERT INTO public.chatbot_faqs (category, trigger_keywords, question, answer, display_order, is_active) VALUES
(
  'الإرجاع والاستبدال',
  ARRAY['إرجاع', 'return', 'استرداد', 'عايز أرجع', 'بدل', 'refund', 'ارجع المنتج'],
  'ما هي سياسة الإرجاع؟',
  'نقبل الإرجاع خلال 14 يوم من تاريخ الاستلام. يجب أن تكون القطعة غير مستخدمة وبتاجها الأصلي. لبدء طلب إرجاع، ادخل على صفحة "تتبع الطلب" واختر "طلب إرجاع".',
  30, true
),
(
  'الإرجاع والاستبدال',
  ARRAY['استبدال', 'exchange', 'تبديل', 'تغيير مقاس', 'مقاس تاني'],
  'كيف أستبدل مقاساً؟',
  'يمكنك طلب استبدال المقاس خلال 14 يوم من الاستلام. ادخل على صفحة "تتبع الطلب"، اختر طلبك، ثم اضغط "طلب استبدال". سيتواصل معك فريقنا خلال 24 ساعة.',
  31, true
),
(
  'الإرجاع والاستبدال',
  ARRAY['استرداد المبلغ', 'فلوس', 'كاش', 'money back', 'refund متى', 'امتى هاخد فلوسي'],
  'متى أستلم المبلغ المسترد؟',
  'بعد استلامنا للقطعة المرتجعة وفحصها (1-2 يوم عمل)، يتم رد المبلغ خلال 5-7 أيام عمل على نفس وسيلة الدفع الأصلية.',
  32, true
);

-- ─────────────────────────────────────────────────────────────────
-- CATEGORY 4: الدفع والطلبات
-- ─────────────────────────────────────────────────────────────────
INSERT INTO public.chatbot_faqs (category, trigger_keywords, question, answer, display_order, is_active) VALUES
(
  'الدفع والطلبات',
  ARRAY['دفع', 'payment', 'طرق الدفع', 'كاش', 'كريدت', 'فيزا', 'cash', 'اونلاين'],
  'ما هي طرق الدفع المتاحة؟',
  'نقبل الدفع بـ: الفيزا وماستركارد، الدفع عند الاستلام (كاش)، ومحافظ الدفع الإلكتروني. جميع المدفوعات الإلكترونية محمية بتشفير SSL.',
  40, true
),
(
  'الدفع والطلبات',
  ARRAY['الدفع عند الاستلام', 'COD', 'كاش عند الاستلام', 'بدفع لما يجي'],
  'هل يتوفر الدفع عند الاستلام؟',
  'نعم، خيار الدفع عند الاستلام (COD) متاح في معظم المحافظات المصرية مع رسوم إضافية رمزية.',
  41, true
),
(
  'الدفع والطلبات',
  ARRAY['إلغاء', 'cancel', 'الغاء طلب', 'عايز الغي', 'ارجع من الطلب'],
  'كيف أُلغي طلبي؟',
  'يمكن إلغاء الطلب خلال ساعتين من تقديمه. بعد ذلك، يكون الطلب قيد التجهيز ولا يمكن إلغاؤه. تواصل معنا فوراً عبر واتساب لمحاولة الإلغاء.',
  42, true
),
(
  'الدفع والطلبات',
  ARRAY['كود خصم', 'promo', 'coupon', 'discount', 'خصم', 'كوبون'],
  'كيف أستخدم كود الخصم؟',
  'أدخل كود الخصم في خانة "كود الخصم" أثناء إتمام الطلب قبل الدفع. يُطبق الخصم تلقائياً على إجمالي الطلب.',
  43, true
);

-- ─────────────────────────────────────────────────────────────────
-- CATEGORY 5: المنتجات والتوفر
-- ─────────────────────────────────────────────────────────────────
INSERT INTO public.chatbot_faqs (category, trigger_keywords, question, answer, display_order, is_active) VALUES
(
  'المنتجات والتوفر',
  ARRAY['نافذ', 'out of stock', 'مش متوفر', 'خلص', 'sold out', 'لما بيرجع'],
  'ماذا أفعل إذا كان المقاس غير متوفر؟',
  'اضغط على زر "ابلغني عند التوفر" في صفحة المنتج وأدخل بريدك الإلكتروني. ستصلك رسالة فوراً عند إعادة توفر المقاس المطلوب.',
  50, true
),
(
  'المنتجات والتوفر',
  ARRAY['جودة', 'quality', 'قماش', 'خامة', 'material', 'cotton', 'قطن', 'مصنوع من ايه'],
  'ما هي جودة الخامات المستخدمة؟',
  'نستخدم قطناً عضوياً ثقيلاً بوزن 340 جرام/متر مربع من مزارع معتمدة. جميع الطباعة بحبر أرشيفي عالي الكثافة لا يبهت بالغسيل. القطع مصنوعة في البرتغال بمعايير فاخرة.',
  51, true
),
(
  'المنتجات والتوفر',
  ARRAY['إصدار محدود', 'limited edition', 'limited', 'drop', 'كولكشن جديد', 'موعد'],
  'متى يكون الإصدار الجديد؟',
  'ننزل إصدارات محدودة بشكل دوري. تابع حسابنا على إنستجرام وتيك توك للتوقيت الدقيق، أو سجل في قائمة الانتظار VIP عبر الصفحة الرئيسية.',
  52, true
);

-- ─────────────────────────────────────────────────────────────────
-- CATEGORY 6: العناية بالملابس
-- ─────────────────────────────────────────────────────────────────
INSERT INTO public.chatbot_faqs (category, trigger_keywords, question, answer, display_order, is_active) VALUES
(
  'العناية بالملابس',
  ARRAY['غسيل', 'wash', 'كيف اغسل', 'washing', 'نشر', 'عناية'],
  'كيف أغسل القطع للحفاظ عليها؟',
  'اغسل من الداخل بماء بارد على دورة ناعمة مع ألوان مماثلة. لا تستخدم المجفف — انشر القطعة أفقياً في الظل. اكوي من الداخل على حرارة منخفضة بعيداً عن الطباعة.',
  60, true
),
(
  'العناية بالملابس',
  ARRAY['الألوان تبهت', 'فقدان لون', 'بتبهت', 'color fade', 'مش زي الأول'],
  'كيف أحافظ على الألوان من البهتان؟',
  'اقلب القطعة دائماً قبل الغسيل، استخدم منظفاً ملائماً للألوان القاتمة، تجنب التعرض المباشر للشمس أثناء النشر. الطباعة بحبر أرشيفي مصمم ليصمد لسنوات.',
  61, true
);

-- ─────────────────────────────────────────────────────────────────
-- CATEGORY 7: حسابي وطلباتي
-- ─────────────────────────────────────────────────────────────────
INSERT INTO public.chatbot_faqs (category, trigger_keywords, question, answer, display_order, is_active) VALUES
(
  'حسابي وطلباتي',
  ARRAY['حساب', 'account', 'تسجيل', 'register', 'إنشاء حساب', 'signup'],
  'كيف أنشئ حساباً؟',
  'اضغط على أيقونة الشخص في أعلى الصفحة، ثم اختر "إنشاء حساب". أدخل بريدك الإلكتروني وكلمة مرور. ستصلك رسالة تأكيد على بريدك.',
  70, true
),
(
  'حسابي وطلباتي',
  ARRAY['نسيت كلمة المرور', 'forgot password', 'reset', 'password', 'مش عارف كلمة السر'],
  'نسيت كلمة المرور، ماذا أفعل؟',
  'اضغط على "نسيت كلمة المرور" في صفحة تسجيل الدخول. سيصلك رابط إعادة تعيين على بريدك الإلكتروني المسجل. تحقق من مجلد Spam إذا لم تجد الرسالة.',
  71, true
),
(
  'حسابي وطلباتي',
  ARRAY['سجل دخول', 'login', 'تسجيل دخول', 'دخول'],
  'لا أستطيع تسجيل الدخول، ماذا أفعل؟',
  'تأكد من صحة البريد الإلكتروني وكلمة المرور. إذا استمرت المشكلة، اضغط "نسيت كلمة المرور" لإعادة تعيينها. للمساعدة الفورية، تواصل معنا عبر واتساب.',
  72, true
);

-- Reload schema cache
NOTIFY pgrst, 'reload schema';

-- ============================================================
-- FILE: 20260930000029_admin_returns_rls.sql
-- ============================================================
-- ==============================================================================
-- Migration: 20260930000029_admin_returns_rls.sql
-- Description: Fix Admin RLS to view all return_requests.
-- ==============================================================================

-- Drop the restrictive select policy and replace it with a comprehensive one
DROP POLICY IF EXISTS "Customers can view own return requests" ON public.return_requests;

-- Fix the reason check constraint to include exchange_requested
ALTER TABLE public.return_requests DROP CONSTRAINT IF EXISTS return_requests_reason_check;
ALTER TABLE public.return_requests ADD CONSTRAINT return_requests_reason_check CHECK (
  reason IN (
    'wrong_size',
    'wrong_item',
    'damaged',
    'not_as_described',
    'changed_mind',
    'exchange_requested',
    'other'
  )
);

DROP POLICY IF EXISTS "Customers and Admins can view return requests" ON public.return_requests;
CREATE POLICY "Customers and Admins can view return requests"
  ON public.return_requests FOR SELECT
  TO public
  USING (
    customer_id = auth.uid()
    OR customer_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = auth.uid() AND c.role IN ('admin', 'support')
    )
  );

-- Also allow admins to update return_requests (like approving/rejecting)
DROP POLICY IF EXISTS "Admins can update return_requests" ON public.return_requests;
CREATE POLICY "Admins can update return_requests"
  ON public.return_requests FOR UPDATE
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = auth.uid() AND c.role IN ('admin', 'support')
    )
  );

-- Reload schema
NOTIFY pgrst, 'reload schema';

-- ============================================================
-- FILE: 20261001000030_refund_payout_details.sql
-- ============================================================
-- ==============================================================================
-- Migration: 20261001000030_refund_payout_details.sql
-- Description: Add refund method and payout details to return requests
-- ==============================================================================

ALTER TABLE public.return_requests
ADD COLUMN IF NOT EXISTS refund_method TEXT CHECK (refund_method IN ('vodafone_cash', 'instapay', 'bank_transfer', 'original_payment_method')),
ADD COLUMN IF NOT EXISTS refund_account_details JSONB,
ADD COLUMN IF NOT EXISTS refund_transaction_ref TEXT,
ADD COLUMN IF NOT EXISTS refund_completed_at TIMESTAMPTZ;

-- Reload schema
NOTIFY pgrst, 'reload schema';

-- ============================================================
-- FILE: 20261001000031_email_logs.sql
-- ============================================================
-- ==============================================================================
-- Migration: 20261001000031_email_logs.sql
-- Description: Table for logging email dispatch status to prevent duplicates
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  reference_id UUID NOT NULL,
  recipient_email TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed')),
  error_details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index to quickly check if an email was already sent for a specific event and reference
CREATE INDEX IF NOT EXISTS email_logs_event_ref_idx ON public.email_logs (event_type, reference_id);

-- Enable RLS (Service role can bypass, users cannot read/write)
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- Reload schema
NOTIFY pgrst, 'reload schema';
