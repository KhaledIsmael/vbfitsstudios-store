-- ============================================================================
-- 20261014000044_product_size_charts.sql
--
-- Task 2: Build a dynamic, product-specific size chart system.
--
-- Adds:
-- 1. Optional size_chart JSONB column on public.products for direct denormalised access
-- 2. Dedicated public.product_size_charts relational table for product-specific charts
-- 3. Row Level Security: public read, admin-only write
--
-- Review before applying. Do NOT run against production without approval.
-- ============================================================================

-- 1. Add column to products table if not exists
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS size_chart JSONB DEFAULT NULL;

-- 2. Dedicated table for relational size chart tracking
CREATE TABLE IF NOT EXISTS public.product_size_charts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  category TEXT NOT NULL DEFAULT 't-shirt',
  unit TEXT NOT NULL DEFAULT 'cm',
  template_image_url TEXT,
  columns JSONB NOT NULL DEFAULT '[]'::jsonb,
  rows JSONB NOT NULL DEFAULT '[]'::jsonb,
  layout JSONB DEFAULT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_product_size_charts_product UNIQUE (product_id)
);

-- Index for fast lookup by product_id
CREATE INDEX IF NOT EXISTS idx_product_size_charts_product_id
  ON public.product_size_charts (product_id);

-- Enable RLS
ALTER TABLE public.product_size_charts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "product_size_charts_select_public" ON public.product_size_charts;
CREATE POLICY "product_size_charts_select_public"
  ON public.product_size_charts FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "product_size_charts_admin_write" ON public.product_size_charts;
CREATE POLICY "product_size_charts_admin_write"
  ON public.product_size_charts FOR ALL
  USING (public.is_admin_or_support())
  WITH CHECK (public.is_admin_or_support());

GRANT SELECT ON public.product_size_charts TO anon, authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON public.product_size_charts TO authenticated, service_role;
