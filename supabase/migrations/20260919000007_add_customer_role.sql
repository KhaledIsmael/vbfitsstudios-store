-- ==============================================================================
-- Migration: 20260919000007_add_customer_role.sql
-- Description: Add role column (customer/support/admin) to customers table.
-- ==============================================================================

-- 1. Add role column to public.customers if not exists
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'customer'
    CHECK (role IN ('customer', 'support', 'admin'));

-- 2. Index for role filtering
CREATE INDEX IF NOT EXISTS idx_customers_role ON public.customers(role);

-- 3. Update the handle_new_customer trigger function to propagate role from user_metadata
CREATE OR REPLACE FUNCTION public.handle_new_customer()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.customers (id, email, full_name, avatar_url, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url',
    COALESCE(NEW.raw_user_meta_data->>'role', 'customer')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.customers.full_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.customers.avatar_url),
    role = COALESCE(public.customers.role, EXCLUDED.role, 'customer'),
    updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. RLS policies: allow admin and support users to view all customer records
DROP POLICY IF EXISTS "Admins and support can view all customers" ON public.customers;
CREATE POLICY "Admins and support can view all customers"
  ON public.customers FOR SELECT
  USING (
    auth.uid() = id
    OR EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = auth.uid() AND c.role IN ('admin', 'support')
    )
  );

-- 5. RLS policies: allow admins to update customer roles
DROP POLICY IF EXISTS "Admins can update customers" ON public.customers;
CREATE POLICY "Admins can update customers"
  ON public.customers FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = auth.uid() AND c.role = 'admin'
    )
  );
