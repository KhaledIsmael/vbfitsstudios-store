-- ==============================================================================
-- VB FITS STUDIOS
-- Migration: 20260929000023_branch_field_and_integrity_constraints.sql
-- Description:
--   1. Add `branch` (region/governorate assignment) to public.customers
--   2. Ownership trigger: addresses can only be written by their owner
--   3. Ownership trigger: orders can only be inserted with the caller's uid
--   4. RLS / grants for branch column
-- ==============================================================================

-- ── 1. BRANCH FIELD ON CUSTOMERS ──────────────────────────────────────────────

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS branch TEXT;

COMMENT ON COLUMN public.customers.branch IS
  'Administrative region or branch assignment set by admin staff '
  '(e.g. Cairo-HQ, Alex-Warehouse, Remote). NULL = unassigned.';

CREATE INDEX IF NOT EXISTS idx_customers_branch ON public.customers(branch)
  WHERE branch IS NOT NULL;

-- ── 2. OWNERSHIP ENFORCEMENT — ADDRESSES ──────────────────────────────────────
-- Blocks INSERT/UPDATE where customer_id != auth.uid() for non-staff users.

CREATE OR REPLACE FUNCTION public.enforce_address_owner()
RETURNS TRIGGER AS $$
BEGIN
  -- Staff (admin / support) may write any customer's address
  IF public.is_admin_or_support() THEN
    RETURN NEW;
  END IF;

  -- Unauthenticated: block
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION
      'vbfits_address_auth_required: You must be logged in to manage addresses.'
      USING ERRCODE = '42501';
  END IF;

  -- Authenticated customer: customer_id must equal their own uid
  IF NEW.customer_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION
      'vbfits_address_ownership_violation: Cannot write an address for another customer.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS tr_enforce_address_owner ON public.addresses;
CREATE TRIGGER tr_enforce_address_owner
  BEFORE INSERT OR UPDATE ON public.addresses
  FOR EACH ROW EXECUTE FUNCTION public.enforce_address_owner();

-- ── 3. OWNERSHIP ENFORCEMENT — ORDERS (INSERT ONLY) ──────────────────────────
-- Guest orders (customer_id IS NULL) are exempt.
-- Staff can write any customer_id.
-- Authenticated customers: customer_id must match auth.uid().

CREATE OR REPLACE FUNCTION public.enforce_order_customer_id()
RETURNS TRIGGER AS $$
BEGIN
  -- Guest order: no constraint
  IF NEW.customer_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Staff bypass
  IF public.is_admin_or_support() THEN
    RETURN NEW;
  END IF;

  -- Unauthenticated with a customer_id set: block
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION
      'vbfits_order_auth_required: Cannot assign a customer_id without an active session.'
      USING ERRCODE = '42501';
  END IF;

  -- Authenticated: customer_id must be the caller's uid
  IF NEW.customer_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION
      'vbfits_order_ownership_violation: Order customer_id does not match the authenticated user.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS tr_enforce_order_customer_id ON public.orders;
CREATE TRIGGER tr_enforce_order_customer_id
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.enforce_order_customer_id();

-- ── 4. GRANTS FOR BRANCH COLUMN ───────────────────────────────────────────────
-- Existing RLS policies (migration 0 + 7) already gate row-level access.
-- Column-level grants ensure the field is readable/writable where rows are allowed.

GRANT SELECT (branch) ON public.customers TO authenticated, anon, service_role;
GRANT UPDATE (branch) ON public.customers TO authenticated, service_role;
