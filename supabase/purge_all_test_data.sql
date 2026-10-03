-- ==============================================================================
-- VB FITS STUDIOS — Production Slate Purge & Permanent Admin Role Lock
-- 1. Completely cleans and purges all mock data, dummy orders, and junk records.
-- 2. Permanently locks and preserves the 'admin' role for "pvfits studios" and brand admins.
-- 3. Resets regular user accounts (like sowar) to 'customer'.
-- ==============================================================================

-- 1. Clean and purge all mock / test orders and order items
TRUNCATE TABLE public.order_items, public.orders CASCADE;
TRUNCATE TABLE public.return_requests CASCADE;

-- 2. Reset regular accounts (like sowar) to 'customer'
UPDATE public.customers
SET role = 'customer'
WHERE email ILIKE '%sowar%' 
   OR full_name ILIKE '%sowar%'
   OR (
     email NOT ILIKE '%pvfits%' 
     AND email NOT ILIKE '%vbfits%' 
     AND email != 'admin@vbfitsstudios.com'
     AND full_name NOT ILIKE '%pvfits%'
     AND full_name NOT ILIKE '%vbfits%'
   );

-- 3. Permanently assign and enforce 'admin' role for "pvfits studios" & brand admins
UPDATE public.customers
SET role = 'admin'
WHERE email ILIKE '%pvfits%'
   OR email ILIKE '%vbfits%'
   OR full_name ILIKE '%pvfits%'
   OR full_name ILIKE '%vbfits%'
   OR email = 'admin@vbfitsstudios.com';

-- 4. Also bake the admin role directly into auth.users metadata so the session token ALWAYS has admin privileges
UPDATE auth.users
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
WHERE email ILIKE '%pvfits%'
   OR email ILIKE '%vbfits%'
   OR email = 'admin@vbfitsstudios.com'
   OR raw_user_meta_data->>'full_name' ILIKE '%pvfits%'
   OR raw_user_meta_data->>'name' ILIKE '%pvfits%';

-- 5. Ensure the default role for brand new customer signups is strictly 'customer'
ALTER TABLE public.customers ALTER COLUMN role SET DEFAULT 'customer';

-- 6. RPC Helper: Allows 1-click clean slate purge directly from Admin Dashboard
CREATE OR REPLACE FUNCTION public.purge_all_test_data()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  TRUNCATE TABLE public.order_items, public.orders CASCADE;
  TRUNCATE TABLE public.return_requests CASCADE;
  RETURN json_build_object('success', true, 'message', 'All test orders and items purged successfully.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.purge_all_test_data() TO authenticated, anon, service_role;
