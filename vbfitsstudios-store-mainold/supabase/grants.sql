-- ==============================================================================
-- VB FITS STUDIOS - PERMISSIONS GRANT SCRIPT
-- Run this once in Supabase SQL Editor to grant table access to anon and authenticated roles
-- (Row-Level Security / RLS will continue to protect and isolate user rows)
-- ==============================================================================

-- 1. Grant Schema Usage
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- 2. Public Read Access (Catalog & Reviews)
GRANT SELECT ON public.categories TO anon, authenticated;
GRANT SELECT ON public.products TO anon, authenticated;
GRANT SELECT ON public.product_variants TO anon, authenticated;
GRANT SELECT ON public.product_images TO anon, authenticated;
GRANT SELECT ON public.reviews TO anon, authenticated;
GRANT SELECT ON public.discount_codes TO anon, authenticated;

-- 3. Marketing Signups (Waitlist, Restock & Newsletter)
GRANT INSERT, SELECT ON public.waitlist_signups TO anon, authenticated;
GRANT INSERT, SELECT, UPDATE ON public.restock_signups TO anon, authenticated;
GRANT INSERT, SELECT, UPDATE ON public.newsletter_subscribers TO anon, authenticated;

-- 4. Customer Tables (Protected by RLS to own rows only)
GRANT SELECT, INSERT, UPDATE ON public.customers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.addresses TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.orders TO authenticated;
GRANT SELECT, INSERT ON public.order_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reviews TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.wishlists TO authenticated;

-- 5. Sequences usage for auto-generated values
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
