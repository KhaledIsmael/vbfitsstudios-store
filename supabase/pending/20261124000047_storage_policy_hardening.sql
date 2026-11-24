-- ==============================================================================
-- VB FITS STUDIOS — Supabase Storage Security Hardening Migration
-- File: supabase/pending/20261124000047_storage_policy_hardening.sql
-- Status: PENDING / PROPOSED (Do NOT apply automatically without explicit approval)
--
-- Objective:
--   Differentiate public object download (GET) from storage directory listing (LIST).
--   In Supabase Storage, public buckets (storage.buckets.public = true) serve public CDN
--   downloads at /storage/v1/object/public/{bucket}/{name} without requiring a SELECT policy
--   on storage.objects.
--
--   Broad SELECT policies (e.g. USING (bucket_id = 'product-media')) allow unauthenticated
--   callers to query the storage.objects table directly or call .list(), enumerating the
--   entire contents of the bucket.
--
--   This migration tightens storage.objects SELECT policies so only authenticated
--   staff/admin users can list bucket directories via the API, while leaving public
--   CDN downloads fully functioning through the bucket's public flag.
--
--   Private buckets (return-photos) and existing objects are NOT modified or deleted.
--   Never use SQL DELETE on storage.objects to delete files.
-- ==============================================================================

-- 1. store-media bucket: restrict directory listing to authenticated staff/admin
DROP POLICY IF EXISTS "store-media public read" ON storage.objects;

CREATE POLICY "store-media staff list"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'store-media'
    AND auth.role() = 'authenticated'
    AND public.is_admin_or_support()
  );

-- 2. product-media bucket: restrict directory listing to authenticated staff/admin
DROP POLICY IF EXISTS "product-media public read" ON storage.objects;

CREATE POLICY "product-media staff list"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'product-media'
    AND auth.role() = 'authenticated'
    AND public.is_admin_or_support()
  );

-- Verification:
-- 1. Public CDN downloads continue to resolve without auth:
--    GET /storage/v1/object/public/product-media/products/... -> HTTP 200
-- 2. Anonymous calls to supabase.storage.from('product-media').list() return empty / 403.
-- 3. Admin dashboard uploads, reads and mutations continue to function under is_admin_or_support().
