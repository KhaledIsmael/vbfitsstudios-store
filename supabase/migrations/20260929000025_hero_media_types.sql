-- ==============================================================================
-- Migration: 20260929000025_hero_media_types.sql
-- Description: Extends hero_banners table to support video (mp4), image, and gif.
-- ==============================================================================

ALTER TABLE public.hero_banners 
  ADD COLUMN IF NOT EXISTS media_type TEXT NOT NULL DEFAULT 'image' CHECK (media_type IN ('image', 'video', 'gif')),
  ADD COLUMN IF NOT EXISTS media_url TEXT;

-- Migrate existing data
UPDATE public.hero_banners 
SET media_url = image_url 
WHERE media_url IS NULL AND image_url IS NOT NULL;

-- Make media_url required and drop old image_url safely
ALTER TABLE public.hero_banners 
  ALTER COLUMN media_url SET NOT NULL,
  DROP COLUMN IF EXISTS image_url;
