-- ==============================================================================
-- Migration: 20260930000029_admin_returns_rls.sql
-- Description: Fix Admin RLS to view all return_requests.
-- ==============================================================================

-- Drop the restrictive select policy and replace it with a comprehensive one
DROP POLICY IF EXISTS "Customers can view own return requests" ON public.return_requests;

-- Fix the reason check constraint to include exchange_requested
ALTER TABLE public.return_requests DROP CONSTRAINT IF EXISTS return_requests_reason_check;
ALTER TABLE public.return_requests ADD CONSTRAINT return_requests_reason_check CHECK (
  reason IN (
    'wrong_size',
    'wrong_item',
    'damaged',
    'not_as_described',
    'changed_mind',
    'exchange_requested',
    'other'
  )
);

DROP POLICY IF EXISTS "Customers and Admins can view return requests" ON public.return_requests;
CREATE POLICY "Customers and Admins can view return requests"
  ON public.return_requests FOR SELECT
  TO public
  USING (
    customer_id = auth.uid()
    OR customer_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = auth.uid() AND c.role IN ('admin', 'support')
    )
  );

-- Also allow admins to update return_requests (like approving/rejecting)
DROP POLICY IF EXISTS "Admins can update return_requests" ON public.return_requests;
CREATE POLICY "Admins can update return_requests"
  ON public.return_requests FOR UPDATE
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = auth.uid() AND c.role IN ('admin', 'support')
    )
  );

-- Reload schema
NOTIFY pgrst, 'reload schema';
