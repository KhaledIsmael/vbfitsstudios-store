-- ==============================================================================
-- Migration: 20261004000039_create_contact_messages.sql
-- Description:
--   Creates the public.contact_messages table with full RLS policies to persist
--   all client inquiries from the Contact Us page, ensuring no inquiries are lost.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.contact_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unread',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contact_messages_created_at ON public.contact_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_messages_status ON public.contact_messages(status);

ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contact_messages_insert_public" ON public.contact_messages;
DROP POLICY IF EXISTS "contact_messages_admin_all"      ON public.contact_messages;

-- 1. Public / Guest Submission
CREATE POLICY "contact_messages_insert_public"
  ON public.contact_messages FOR INSERT
  WITH CHECK (true);

-- 2. Admin Management Access
CREATE POLICY "contact_messages_admin_all"
  ON public.contact_messages FOR ALL
  USING (
    public.is_admin_or_support()
    OR (auth.jwt()->>'email') IN ('admin@vbfitsstudios.com', 'vbfitsstudios@gmail.com', 'owner@vbfitsstudios.com')
    OR current_user = 'service_role'
  )
  WITH CHECK (
    public.is_admin_or_support()
    OR (auth.jwt()->>'email') IN ('admin@vbfitsstudios.com', 'vbfitsstudios@gmail.com', 'owner@vbfitsstudios.com')
    OR current_user = 'service_role'
  );

GRANT ALL ON public.contact_messages TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
