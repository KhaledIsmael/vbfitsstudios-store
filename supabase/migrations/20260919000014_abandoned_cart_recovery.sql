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
