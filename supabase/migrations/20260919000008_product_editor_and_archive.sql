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
