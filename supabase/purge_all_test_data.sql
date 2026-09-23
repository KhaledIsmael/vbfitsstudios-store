-- ==============================================================================
-- VB FITS STUDIOS — Production Slate Purge & Security Isolation Script
-- Completely cleans and purges all mock data, dummy orders, and junk records.
-- Strictly resets all customer accounts (e.g. sowar) to regular 'customer' role.
-- ==============================================================================

-- 1. Wipe all test orders and order items cleanly
TRUNCATE TABLE public.order_items, public.orders CASCADE;

-- 2. Wipe test return requests if any exist
TRUNCATE TABLE public.return_requests CASCADE;

-- 3. Reset any customer accounts (including sowar) to regular 'customer' role
UPDATE public.customers
SET role = 'customer'
WHERE email NOT IN ('admin@vbfitsstudios.com');

-- 4. Ensure the default role for any new customer in the schema is strictly 'customer'
ALTER TABLE public.customers ALTER COLUMN role SET DEFAULT 'customer';

-- 5. RPC Helper for clean slate reset directly if called
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

GRANT EXECUTE ON FUNCTION public.purge_all_test_data() TO authenticated, anon;
