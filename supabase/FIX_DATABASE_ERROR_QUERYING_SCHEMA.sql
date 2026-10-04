-- ==============================================================================
-- VB FITS STUDIOS - COMPLETE FIX FOR "Database error querying schema"
-- ==============================================================================
-- 
-- Why this error happens:
-- Supabase GoTrue Auth service (written in Go) expects specific token columns in
-- `auth.users` to never be NULL (e.g. confirmation_token, recovery_token, email_change).
-- When a user is inserted via raw SQL with NULLs in these columns, GoTrue fails
-- during login queries and throws: "500: Database error querying schema".
--
-- RUN THIS SCRIPT IN SUPABASE SQL EDITOR TO PERMANENTLY RESOLVE IT.
-- ==============================================================================

-- STEP 1: Fix all NULL token columns across auth.users to empty strings
UPDATE auth.users
SET 
  confirmation_token = COALESCE(confirmation_token, ''),
  recovery_token = COALESCE(recovery_token, ''),
  email_change_token_new = COALESCE(email_change_token_new, ''),
  email_change = COALESCE(email_change, ''),
  email_change_token_current = COALESCE(email_change_token_current, ''),
  reauthentication_token = COALESCE(reauthentication_token, ''),
  phone_change_token = COALESCE(phone_change_token, ''),
  phone_change = COALESCE(phone_change, '')
WHERE email = 'vbfitsstudios@gmail.com'
   OR confirmation_token IS NULL
   OR recovery_token IS NULL
   OR email_change_token_new IS NULL;

-- STEP 2: Ensure vbfitsstudios@gmail.com has valid GoTrue metadata & confirmation
UPDATE auth.users
SET 
  aud = 'authenticated',
  role = 'authenticated',
  email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
  raw_app_meta_data = jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'role', 'admin'),
  raw_user_meta_data = jsonb_build_object('full_name', 'مدير المتجر الرئيسي', 'role', 'admin'),
  is_super_admin = false,
  updated_at = NOW()
WHERE email = 'vbfitsstudios@gmail.com';

-- STEP 3: Ensure identity exists in auth.identities for GoTrue auth lookup
DO $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'vbfitsstudios@gmail.com';
  
  IF v_user_id IS NOT NULL THEN
    -- Delete any mismatched identity
    DELETE FROM auth.identities WHERE user_id = v_user_id;

    -- Insert valid identity record
    INSERT INTO auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      v_user_id::text,
      v_user_id,
      json_build_object('sub', v_user_id::text, 'email', 'vbfitsstudios@gmail.com', 'email_verified', true),
      'email',
      v_user_id::text,
      NOW(),
      NOW(),
      NOW()
    );
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- Fallback for Supabase versions where auth.identities has different PK schema
    RAISE NOTICE 'Handled identity sync notice: %', SQLERRM;
END $$;

-- STEP 4: Ensure public.customers has the admin role set
INSERT INTO public.customers (
  id,
  email,
  full_name,
  role,
  created_at,
  updated_at
)
SELECT 
  id,
  'vbfitsstudios@gmail.com',
  'مدير المتجر الرئيسي',
  'admin',
  NOW(),
  NOW()
FROM auth.users
WHERE email = 'vbfitsstudios@gmail.com'
ON CONFLICT (id) DO UPDATE SET
  role = 'admin',
  full_name = 'مدير المتجر الرئيسي',
  updated_at = NOW();

-- Also ensure any customer row matching email is set to admin
UPDATE public.customers
SET role = 'admin'
WHERE email = 'vbfitsstudios@gmail.com';

-- STEP 5: Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

SELECT 
  id, 
  email, 
  email_confirmed_at, 
  raw_app_meta_data->>'role' as app_role,
  raw_user_meta_data->>'role' as user_role
FROM auth.users 
WHERE email = 'vbfitsstudios@gmail.com';
