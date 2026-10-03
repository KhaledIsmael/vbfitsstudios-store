-- ==============================================================================
-- Migration: 20260919000019_sync_phone_to_customers.sql
-- Description: Ensure phone is synced from auth user_metadata into customers
--              table on both INSERT (new signup) and UPDATE (profile edits).
-- ==============================================================================

-- 1. Ensure phone column exists (safe no-op if already present)
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS phone TEXT;

-- 2. Update handle_new_customer trigger to include phone from user_metadata
--    so that new signups automatically get their phone persisted.
CREATE OR REPLACE FUNCTION public.handle_new_customer()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.customers (id, email, full_name, avatar_url, phone, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'phone',
    COALESCE(NEW.raw_user_meta_data->>'role', 'customer')
  )
  ON CONFLICT (id) DO UPDATE SET
    email        = EXCLUDED.email,
    full_name    = COALESCE(EXCLUDED.full_name, public.customers.full_name),
    avatar_url   = COALESCE(EXCLUDED.avatar_url, public.customers.avatar_url),
    phone        = COALESCE(EXCLUDED.phone, public.customers.phone),
    role         = COALESCE(public.customers.role, EXCLUDED.role, 'customer'),
    updated_at   = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Ensure the trigger is attached (re-create in case it was dropped)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_customer();

-- 4. Also fire on UPDATE of auth.users so that phone edits via
--    supabase.auth.updateUser({ data: { phone } }) propagate automatically.
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  WHEN (
    OLD.raw_user_meta_data IS DISTINCT FROM NEW.raw_user_meta_data
    OR OLD.email IS DISTINCT FROM NEW.email
  )
  EXECUTE FUNCTION public.handle_new_customer();

-- 5. Allow authenticated users to update their own phone in customers table
--    (needed for the updatePhone function in AuthContext)
DROP POLICY IF EXISTS "Users can update their own phone" ON public.customers;
CREATE POLICY "Users can update their own phone"
  ON public.customers FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
