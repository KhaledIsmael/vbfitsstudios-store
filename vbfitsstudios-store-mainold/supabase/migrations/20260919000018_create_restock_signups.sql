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
