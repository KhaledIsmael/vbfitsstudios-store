-- ==============================================================================
-- VB FITS STUDIOS - ALLOW 'Placed' ORDER STATUS
-- Migration: 20260919000002_allow_placed_order_status.sql
-- ==============================================================================

-- Drop existing status check constraint and add updated one including 'placed' / 'Placed'
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check CHECK (
  LOWER(status) IN ('placed', 'pending', 'processing', 'in_transit', 'delivered', 'cancelled', 'refunded')
);
