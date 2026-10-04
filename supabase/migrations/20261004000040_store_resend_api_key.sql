-- ==============================================================================
-- Migration: 20261004000040_store_resend_api_key.sql
-- Stores the Resend API key in store_settings so the contact email endpoint
-- works independently of Vercel env vars.
-- After running: update the resend_api_key row with your actual re_... key.
-- ==============================================================================

INSERT INTO public.store_settings (key, value)
VALUES ('resend_api_key', '"PASTE_YOUR_RESEND_API_KEY_HERE"')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.store_settings (key, value)
VALUES ('brand_notification_email', '"vbfitsstudios@gmail.com"')
ON CONFLICT (key) DO NOTHING;

NOTIFY pgrst, 'reload schema';
