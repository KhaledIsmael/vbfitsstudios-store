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
