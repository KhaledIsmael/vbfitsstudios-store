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
