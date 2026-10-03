-- ==============================================================================
-- Migration: 20260929000022_site_settings_and_launch_gate.sql
-- Description: Create site_settings table for launch_at date/time and gate controls.
--              Extend waitlist_signups for phone/contact_type support.
-- ==============================================================================

-- 1. Create site_settings table
CREATE TABLE IF NOT EXISTS public.site_settings (
  id TEXT PRIMARY KEY DEFAULT 'current',
  launch_at TIMESTAMPTZ NOT NULL DEFAULT '2026-10-10T00:00:00+03:00',
  countdown_gate_enabled BOOLEAN NOT NULL DEFAULT true,
  gate_enabled BOOLEAN NOT NULL DEFAULT true,
  countdown_strip_enabled BOOLEAN NOT NULL DEFAULT true,
  teaser_headline TEXT NOT NULL DEFAULT 'THE ARCHIVAL VAULT OPENS SOON',
  teaser_subtext TEXT NOT NULL DEFAULT 'SECURE EARLY ATELIER ACCESS & PRIVATE VIP DROP DISPATCHES',
  teaser_text TEXT NOT NULL DEFAULT 'THE ARCHIVAL VAULT OPENS SOON. SECURE EARLY ATELIER ACCESS.',
  countdown_strip_text TEXT NOT NULL DEFAULT 'OFFICIAL LAUNCH INCOMING · WORLDWIDE DROP',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Ensure columns exist if table was already created
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS countdown_gate_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS gate_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS teaser_headline TEXT NOT NULL DEFAULT 'THE ARCHIVAL VAULT OPENS SOON',
  ADD COLUMN IF NOT EXISTS teaser_subtext TEXT NOT NULL DEFAULT 'SECURE EARLY ATELIER ACCESS & PRIVATE VIP DROP DISPATCHES';

-- 2. Seed default row
INSERT INTO public.site_settings (id, launch_at, countdown_gate_enabled, gate_enabled, countdown_strip_enabled, teaser_headline, teaser_subtext, teaser_text, countdown_strip_text)
VALUES (
  'current',
  '2026-10-10T00:00:00+03:00',
  true,
  true,
  true,
  'THE ARCHIVAL VAULT OPENS SOON',
  'SECURE EARLY ATELIER ACCESS & PRIVATE VIP DROP DISPATCHES',
  'THE ARCHIVAL VAULT OPENS SOON. SECURE EARLY ATELIER ACCESS.',
  'OFFICIAL LAUNCH INCOMING · WORLDWIDE DROP'
) ON CONFLICT (id) DO UPDATE SET
  launch_at = EXCLUDED.launch_at,
  countdown_gate_enabled = EXCLUDED.countdown_gate_enabled,
  gate_enabled = EXCLUDED.gate_enabled,
  countdown_strip_enabled = EXCLUDED.countdown_strip_enabled,
  teaser_headline = EXCLUDED.teaser_headline,
  teaser_subtext = EXCLUDED.teaser_subtext,
  teaser_text = EXCLUDED.teaser_text,
  countdown_strip_text = EXCLUDED.countdown_strip_text,
  updated_at = timezone('utc'::text, now());

-- 3. Also sync into store_settings key-value store for dual-compatibility
INSERT INTO public.store_settings (key, value)
VALUES (
  'site_settings',
  '{"launch_at": "2026-10-10T00:00:00+03:00", "countdown_strip_enabled": true, "gate_enabled": true, "teaser_text": "THE ARCHIVAL VAULT OPENS SOON. SECURE EARLY ATELIER ACCESS.", "countdown_strip_text": "OFFICIAL LAUNCH INCOMING · WORLDWIDE DROP"}'::jsonb
) ON CONFLICT (key) DO NOTHING;

-- 4. Enable Row Level Security (RLS) on site_settings
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view site settings" ON public.site_settings;
CREATE POLICY "Public can view site settings"
  ON public.site_settings FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Staff can manage site settings" ON public.site_settings;
CREATE POLICY "Staff can manage site settings"
  ON public.site_settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = auth.uid() AND c.role IN ('admin', 'support')
    )
  );

GRANT ALL ON public.site_settings TO anon, authenticated, service_role;

-- 5. Extend waitlist_signups to support WhatsApp/phone, source, and name
ALTER TABLE public.waitlist_signups
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS contact_type TEXT DEFAULT 'email',
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'launch_gate',
  ADD COLUMN IF NOT EXISTS name TEXT;

-- Allow email to be nullable in case customer registers exclusively via WhatsApp
DO $$
BEGIN
  ALTER TABLE public.waitlist_signups ALTER COLUMN email DROP NOT NULL;
EXCEPTION
  WHEN others THEN
    NULL;
END $$;

-- Performance index for source and contact_type
CREATE INDEX IF NOT EXISTS idx_waitlist_signups_source ON public.waitlist_signups(source);
CREATE INDEX IF NOT EXISTS idx_waitlist_signups_phone ON public.waitlist_signups(phone);
