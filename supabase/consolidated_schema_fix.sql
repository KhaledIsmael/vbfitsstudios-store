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


-- 2. PRODUCTS TABLE FIXES
-- ------------------------------------------------------------------------------
-- Ensure currency defaults to EGP
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'EGP';

ALTER TABLE public.products
  ALTER COLUMN currency SET DEFAULT 'EGP';

UPDATE public.products
  SET currency = 'EGP'
  WHERE currency = 'USD' OR currency IS NULL;

-- Ensure is_archived and is_published columns exist
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT true;


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


-- 7. ELEVATE ALL EXISTING CUSTOMERS OR SPECIFIC USER TO ADMIN
-- ------------------------------------------------------------------------------
-- To make your account admin, run:
-- UPDATE public.customers SET role = 'admin' WHERE email = 'your-email@example.com';
-- Or uncomment below to elevate all accounts in development:
-- UPDATE public.customers SET role = 'admin';

-- ==============================================================================
-- SCHEMA FIX COMPLETE
-- ==============================================================================
