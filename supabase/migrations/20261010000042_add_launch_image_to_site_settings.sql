-- ==============================================================================
-- VB FITS STUDIOS - ADD LAUNCH IMAGE TO SITE SETTINGS
-- Migration: 20261010000042_add_launch_image_to_site_settings.sql
-- ==============================================================================

ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS launch_image_url text;
