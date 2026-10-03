-- ============================================================
-- Migration: hero_banners table for rotating homepage carousel
-- ============================================================

CREATE TABLE IF NOT EXISTS public.hero_banners (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url     text NOT NULL,
  season_tag    text NOT NULL DEFAULT '',
  title         text NOT NULL DEFAULT '',
  subtitle      text NOT NULL DEFAULT '',
  cta_text      text NOT NULL DEFAULT 'Shop Now',
  cta_link      text NOT NULL DEFAULT '/shop',
  sort_order    integer NOT NULL DEFAULT 0,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.hero_banners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hero_banners_public_read" ON public.hero_banners
  FOR SELECT USING (is_active = true);

CREATE POLICY "hero_banners_admin_all" ON public.hero_banners
  FOR ALL USING (auth.role() = ''service_role'');

INSERT INTO public.hero_banners (image_url, season_tag, title, subtitle, cta_text, cta_link, sort_order)
VALUES
  (''/assets/hero/hero.jpg'',            ''AUTUMN / WINTER 2026'', ''Long Sleeve Shirt'',         ''Architectural silhouettes, heavyweight textiles, archival sleeve artwork.'',  ''Shop Now'',       ''/shop'',                       0),
  (''/assets/products/black-shirt.jpeg'',''NEW ARRIVALS 2026'',    ''The Washed Black Edition'',  ''Custom-milled 340 GSM organic cotton. Signature ornate baroque sleeve art.'', ''Shop The Black'', ''/shop?color=black'',            1),
  (''/assets/products/white-shirt.jpeg'',''COLLECTION ESSENTIALS'',''The Optic White Edition'',   ''Royal indigo botanical sleeve embellishments. Effortless drape and fit.'',     ''Shop The White'', ''/shop?color=white'',            2)
ON CONFLICT DO NOTHING;
