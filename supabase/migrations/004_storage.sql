-- ==========================================================================
-- VB FITS STUDIOS
-- Migration: 20261004000035_storage.sql  (alias: 004_storage)
-- Purpose:   Create every Supabase Storage bucket the application uses,
--            set size limits and MIME-type restrictions, and apply the
--            correct storage.objects RLS policies.
--
-- BUCKETS FOUND IN src/lib/image.ts
--   STORAGE_BUCKET        = 'store-media'   (primary, public)
--   LEGACY_STORAGE_BUCKET = 'product-media' (legacy fallback, public)
--
-- FOLDER STRUCTURE INSIDE store-media / product-media
--   products/{productId}/{timestamp}-{filename}   <- product images
--   hero/{timestamp}-{filename}                   <- hero banner images
--   lookbook/{timestamp}-{filename}               <- editorial content
--
-- SEPARATE PRIVATE BUCKET
--   'return-photos'  <- customer-uploaded return evidence photos (private)
--     Customers upload to: returns/{customerId}/{orderId}/{filename}
--     Guests:              returns/guest/{orderId}/{filename}
--
-- SECURITY POSTURE
--   store-media  : public read; admin-only write/delete
--   product-media: public read; admin-only write/delete (legacy)
--   return-photos: NO public read; customers upload to own folder only;
--                  admin can read/delete all; storefront reads nothing
-- ==========================================================================


-- ============================================================
-- STEP 1 – Create / ensure buckets exist
--
--   Supabase's storage.buckets table supports upsert via
--   INSERT ... ON CONFLICT DO NOTHING.
--   file_size_limit is in bytes. 10 MB = 10485760.
--   allowed_mime_types is a TEXT[] column (Postgres array).
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  -- Primary media bucket: product images, hero banners, lookbooks
  (
    'store-media',
    'store-media',
    true,                -- public: storefront reads URLs directly via CDN
    10485760,            -- 10 MB per file
    ARRAY[
      'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
      'image/gif', 'image/avif', 'image/svg+xml',
      'video/mp4', 'video/webm'  -- hero banners can be video
    ]
  ),
  -- Legacy bucket: kept for backwards-compatible URLs already stored in DB
  (
    'product-media',
    'product-media',
    true,
    10485760,
    ARRAY[
      'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
      'image/gif', 'image/avif', 'image/svg+xml',
      'video/mp4', 'video/webm'
    ]
  ),
  -- Private return photos bucket
  (
    'return-photos',
    'return-photos',
    false,               -- private: no direct CDN access
    5242880,             -- 5 MB per file
    ARRAY[
      'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic',
      'image/heif'
    ]
  )
ON CONFLICT (id) DO UPDATE
  SET
    public             = EXCLUDED.public,
    file_size_limit    = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;


-- ============================================================
-- STEP 2 – RLS on storage.objects
--   Already enabled and owned by Supabase internally.
--   No ALTER TABLE needed — CREATE POLICY works directly.
-- ============================================================


-- ============================================================
-- STEP 3 – store-media policies
-- ============================================================

-- 3a. Public read – anyone can GET files from this bucket
DROP POLICY IF EXISTS "store-media public read" ON storage.objects;
CREATE POLICY "store-media public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'store-media');

-- 3b. Admin upload – only authenticated admins may INSERT
DROP POLICY IF EXISTS "store-media admin insert" ON storage.objects;
CREATE POLICY "store-media admin insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'store-media'
    AND auth.uid() IS NOT NULL
    AND public.is_admin_or_support()
  );

-- 3c. Admin update
DROP POLICY IF EXISTS "store-media admin update" ON storage.objects;
CREATE POLICY "store-media admin update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'store-media'
    AND auth.uid() IS NOT NULL
    AND public.is_admin_or_support()
  );

-- 3d. Admin delete
DROP POLICY IF EXISTS "store-media admin delete" ON storage.objects;
CREATE POLICY "store-media admin delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'store-media'
    AND auth.uid() IS NOT NULL
    AND public.is_admin_or_support()
  );


-- ============================================================
-- STEP 4 – product-media policies  (legacy bucket, same rules)
-- ============================================================

DROP POLICY IF EXISTS "product-media public read"   ON storage.objects;
DROP POLICY IF EXISTS "product-media admin insert"  ON storage.objects;
DROP POLICY IF EXISTS "product-media admin update"  ON storage.objects;
DROP POLICY IF EXISTS "product-media admin delete"  ON storage.objects;

CREATE POLICY "product-media public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-media');

CREATE POLICY "product-media admin insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'product-media'
    AND auth.uid() IS NOT NULL
    AND public.is_admin_or_support()
  );

CREATE POLICY "product-media admin update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'product-media'
    AND auth.uid() IS NOT NULL
    AND public.is_admin_or_support()
  );

CREATE POLICY "product-media admin delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'product-media'
    AND auth.uid() IS NOT NULL
    AND public.is_admin_or_support()
  );


-- ============================================================
-- STEP 5 – return-photos policies (private bucket)
-- ============================================================

DROP POLICY IF EXISTS "return-photos no public read"     ON storage.objects;
DROP POLICY IF EXISTS "return-photos customer insert"    ON storage.objects;
DROP POLICY IF EXISTS "return-photos guest insert"       ON storage.objects;
DROP POLICY IF EXISTS "return-photos admin read"         ON storage.objects;
DROP POLICY IF EXISTS "return-photos admin delete"       ON storage.objects;

-- 5a. Authenticated customers upload ONLY into their own folder:
--     returns/{their-uuid}/{anything}
CREATE POLICY "return-photos customer insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'return-photos'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = 'returns'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- 5b. Guest uploads go to returns/guest/{orderId}/{file} — allowed
--     from anon key (the /api/returns/submit server route handles auth)
CREATE POLICY "return-photos guest insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'return-photos'
    AND (storage.foldername(name))[1] = 'returns'
    AND (storage.foldername(name))[2] = 'guest'
  );

-- 5c. Admin can read all return photos
CREATE POLICY "return-photos admin read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'return-photos'
    AND auth.uid() IS NOT NULL
    AND public.is_admin_or_support()
  );

-- 5d. Admin can delete return photos
CREATE POLICY "return-photos admin delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'return-photos'
    AND auth.uid() IS NOT NULL
    AND public.is_admin_or_support()
  );


-- ============================================================
-- STEP 6 – Reload PostgREST schema cache
-- ============================================================
NOTIFY pgrst, 'reload schema';
