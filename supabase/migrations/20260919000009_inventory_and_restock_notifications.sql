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
