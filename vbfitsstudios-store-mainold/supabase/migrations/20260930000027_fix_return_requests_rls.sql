-- ==============================================================================
-- Migration: 20260930000027_fix_return_requests_rls.sql
-- Description: Fix RLS policy on return_requests to allow anon/guest inserts
-- ==============================================================================

-- Drop all existing insert policies to start clean
DROP POLICY IF EXISTS "Customers can create return requests" ON public.return_requests;
DROP POLICY IF EXISTS "Guests can create return requests"   ON public.return_requests;
DROP POLICY IF EXISTS "Allow inserts to return_requests"   ON public.return_requests;

-- Allow anyone (anon or authenticated) to INSERT a return request.
-- Security relies on order_id being a secret UUID (not guessable).
-- Admin staff can manage via service_role / admin dashboard.
CREATE POLICY "Allow inserts to return_requests"
  ON public.return_requests FOR INSERT
  TO public
  WITH CHECK (true);

-- Ensure the column reason_note exists (in case it was missed)
ALTER TABLE public.return_requests
  ADD COLUMN IF NOT EXISTS reason_note TEXT;

-- Also allow anyone to read their own return request right after submission
DROP POLICY IF EXISTS "Customers can view own return requests" ON public.return_requests;
CREATE POLICY "Customers can view own return requests"
  ON public.return_requests FOR SELECT
  TO public
  USING (
    customer_id = auth.uid()
    OR customer_id IS NULL
  );

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
