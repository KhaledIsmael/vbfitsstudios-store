-- ==============================================================================
-- Migration: 20260919000011_admin_customers_loyalty.sql
-- Description: Add loyalty_points to customers and grant update permissions to support/admin.
-- ==============================================================================

-- 1. Add loyalty_points to public.customers (default 0, used for Phase 6 loyalty program)
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS loyalty_points INTEGER NOT NULL DEFAULT 0 CHECK (loyalty_points >= 0);

-- 2. Update RLS policies on customers table to allow both admin AND support to update customer profiles and roles
DROP POLICY IF EXISTS "Admins can update customers" ON public.customers;
DROP POLICY IF EXISTS "Staff can update customers" ON public.customers;

CREATE POLICY "Staff can update customers"
  ON public.customers FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = auth.uid() AND c.role IN ('admin', 'support')
    )
  );

-- 3. Ensure staff can read return_requests and addresses
DROP POLICY IF EXISTS "Staff can read all return requests" ON public.return_requests;
CREATE POLICY "Staff can read all return requests"
  ON public.return_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = auth.uid() AND c.role IN ('admin', 'support')
    )
  );

DROP POLICY IF EXISTS "Staff can read all addresses" ON public.addresses;
CREATE POLICY "Staff can read all addresses"
  ON public.addresses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = auth.uid() AND c.role IN ('admin', 'support')
    )
  );
