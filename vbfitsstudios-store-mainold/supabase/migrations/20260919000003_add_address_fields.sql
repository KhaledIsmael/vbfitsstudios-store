-- Migration: Add localized / regional address columns to public.addresses
-- Allows saving Egyptian and international delivery addresses smoothly

ALTER TABLE public.addresses 
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS governorate TEXT,
  ADD COLUMN IF NOT EXISTS street TEXT,
  ADD COLUMN IF NOT EXISTS building TEXT,
  ADD COLUMN IF NOT EXISTS floor TEXT,
  ADD COLUMN IF NOT EXISTS landmark TEXT;

-- Make existing US-centric columns nullable so regional address submissions succeed without schema errors
ALTER TABLE public.addresses 
  ALTER COLUMN first_name DROP NOT NULL,
  ALTER COLUMN last_name DROP NOT NULL,
  ALTER COLUMN street_line1 DROP NOT NULL,
  ALTER COLUMN state DROP NOT NULL,
  ALTER COLUMN postal_code DROP NOT NULL;
