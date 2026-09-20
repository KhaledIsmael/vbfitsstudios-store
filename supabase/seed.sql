-- ==============================================================================
-- VB FITS STUDIOS - PRODUCT SEED DATA
-- Run this in Supabase SQL Editor to instantly populate the store catalog
-- ==============================================================================

-- 1. Insert Category
INSERT INTO public.categories (name, slug, description, image_url, display_order)
VALUES (
  'Long Sleeve',
  'long-sleeve',
  'Luxury ready-to-wear heavyweight long sleeve silhouettes with signature motifs.',
  '/assets/products/black-shirt.jpeg',
  1
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  image_url = EXCLUDED.image_url;

-- 2. Insert Products
DO $$
DECLARE
  cat_id UUID;
  prod_black_id UUID;
  prod_white_id UUID;
  prod_nocturne_id UUID;
  prod_monochrome_id UUID;
BEGIN
  -- Retrieve category ID
  SELECT id INTO cat_id FROM public.categories WHERE slug = 'long-sleeve' LIMIT 1;

  -- --------------------------------------------------------------------------
  -- Product 1: VB Fits Studios Long Sleeve — Black (Featured)
  -- --------------------------------------------------------------------------
  INSERT INTO public.products (
    slug, category_id, name, subtitle, description, price, currency,
    featured, is_new_arrival, is_published, details, fabric_care, shipping_info
  ) VALUES (
    'vb-long-sleeve-black',
    cat_id,
    'VB Fits Studios Long Sleeve — Black',
    'Ornate Sleeve Motif / Heavyweight Cotton',
    'Crafted from custom-milled 340 GSM organic French terry cotton. Featuring signature ornate baroque sleeve screenprint graphics with high-density archival ink and the iconic VB Fits Studios calligraphy chest signature.',
    195.00,
    'USD',
    true,
    true,
    true,
    '["Custom relaxed boxy silhouette", "Dropped shoulders with reinforced seam construction", "Signature ornate sleeve botanical pattern artwork", "VB Fits Studios chest embroidery signature", "Pre-shrunk vintage wash treatment", "Made in Portugal"]'::jsonb,
    '["100% Combed Heavyweight Organic Cotton (340 GSM)", "Machine wash cold inside out with like colors", "Do not tumble dry; lay flat to dry in shade", "Iron on reverse low heat, do not iron over prints"]'::jsonb,
    'Complimentary express shipping on orders over $250. Standard delivery 3–5 business days. 14-day hassle-free returns.'
  )
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    subtitle = EXCLUDED.subtitle,
    description = EXCLUDED.description,
    price = EXCLUDED.price,
    featured = EXCLUDED.featured,
    is_new_arrival = EXCLUDED.is_new_arrival,
    details = EXCLUDED.details,
    fabric_care = EXCLUDED.fabric_care,
    shipping_info = EXCLUDED.shipping_info
  RETURNING id INTO prod_black_id;

  -- Product 1 Variants
  INSERT INTO public.product_variants (product_id, size, color, color_hex, stock, sku)
  VALUES
    (prod_black_id, 'S', 'Washed Black', '#111111', 25, 'vb-long-sleeve-black-s'),
    (prod_black_id, 'M', 'Washed Black', '#111111', 35, 'vb-long-sleeve-black-m'),
    (prod_black_id, 'L', 'Washed Black', '#111111', 40, 'vb-long-sleeve-black-l'),
    (prod_black_id, 'XL', 'Washed Black', '#111111', 20, 'vb-long-sleeve-black-xl'),
    (prod_black_id, 'XXL', 'Washed Black', '#111111', 15, 'vb-long-sleeve-black-xxl')
  ON CONFLICT (sku) DO UPDATE SET stock = EXCLUDED.stock;

  -- Product 1 Images
  DELETE FROM public.product_images WHERE product_id = prod_black_id;
  INSERT INTO public.product_images (product_id, url, alt_text, display_order, is_primary)
  VALUES
    (prod_black_id, '/assets/products/black-shirt.jpeg', 'VB Fits Studios Long Sleeve Black - Front View', 0, true),
    (prod_black_id, '/assets/hero/hero.jpg', 'VB Fits Studios Long Sleeve Black - Editorial Look', 1, false);

  -- --------------------------------------------------------------------------
  -- Product 2: VB Fits Studios Long Sleeve — White (Featured)
  -- --------------------------------------------------------------------------
  INSERT INTO public.products (
    slug, category_id, name, subtitle, description, price, currency,
    featured, is_new_arrival, is_published, details, fabric_care, shipping_info
  ) VALUES (
    'vb-long-sleeve-white',
    cat_id,
    'VB Fits Studios Long Sleeve — White',
    'Royal Indigo Sleeve Motif / Clean Tailored Cut',
    'A pristine optic white rendition featuring intricate royal indigo botanical sleeve embellishments. Designed with an effortless drape and luxury streetwear fit for year-round layering.',
    195.00,
    'USD',
    true,
    true,
    true,
    '["Pure optic white heavyweight 340 GSM knit", "Precision tonal collar ribbing that retains shape", "Subtle VB Fits Studios chest script in midnight indigo", "Intricate sleeve floral scroll screenprint", "Finished with hand-distressed edge hems", "Made in Portugal"]'::jsonb,
    '["100% Combed Heavyweight Organic Cotton (340 GSM)", "Machine wash cold inside out with delicate cycle", "Lay flat to dry to preserve silhouette", "Do not bleach; warm iron inside out"]'::jsonb,
    'Complimentary express shipping on orders over $250. Standard delivery 3–5 business days. 14-day hassle-free returns.'
  )
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    subtitle = EXCLUDED.subtitle,
    description = EXCLUDED.description,
    price = EXCLUDED.price,
    featured = EXCLUDED.featured,
    is_new_arrival = EXCLUDED.is_new_arrival,
    details = EXCLUDED.details,
    fabric_care = EXCLUDED.fabric_care,
    shipping_info = EXCLUDED.shipping_info
  RETURNING id INTO prod_white_id;

  -- Product 2 Variants
  INSERT INTO public.product_variants (product_id, size, color, color_hex, stock, sku)
  VALUES
    (prod_white_id, 'S', 'Optic White', '#F5F5F5', 20, 'vb-long-sleeve-white-s'),
    (prod_white_id, 'M', 'Optic White', '#F5F5F5', 30, 'vb-long-sleeve-white-m'),
    (prod_white_id, 'L', 'Optic White', '#F5F5F5', 35, 'vb-long-sleeve-white-l'),
    (prod_white_id, 'XL', 'Optic White', '#F5F5F5', 20, 'vb-long-sleeve-white-xl'),
    (prod_white_id, 'XXL', 'Optic White', '#F5F5F5', 10, 'vb-long-sleeve-white-xxl')
  ON CONFLICT (sku) DO UPDATE SET stock = EXCLUDED.stock;

  -- Product 2 Images
  DELETE FROM public.product_images WHERE product_id = prod_white_id;
  INSERT INTO public.product_images (product_id, url, alt_text, display_order, is_primary)
  VALUES
    (prod_white_id, '/assets/products/white-shirt.jpeg', 'VB Fits Studios Long Sleeve White - Front View', 0, true),
    (prod_white_id, '/assets/hero/hero.jpg', 'VB Fits Studios Long Sleeve White - Editorial Look', 1, false);

  -- --------------------------------------------------------------------------
  -- Product 3: VB Fits Nocturne Long Sleeve
  -- --------------------------------------------------------------------------
  INSERT INTO public.products (
    slug, category_id, name, subtitle, description, price, currency,
    featured, is_new_arrival, is_published, details, fabric_care, shipping_info
  ) VALUES (
    'vb-long-sleeve-nocturne',
    cat_id,
    'VB Fits Nocturne Long Sleeve',
    'Deep Charcoal / Tonal Sleeve Graphics',
    'A limited runway edition in deep charcoal with tonal matte rubberized sleeve elements. Understated luxury at its pinnacle.',
    210.00,
    'USD',
    false,
    true,
    true,
    '["Heavyweight 360 GSM loopback cotton", "Tonal dark sleeve motif with subtle sheen", "Dropped oversized cut", "Single needle stitch finishes"]'::jsonb,
    '["100% Organic Cotton", "Gentle cold wash inside out", "Dry flat"]'::jsonb,
    'Complimentary express shipping on orders over $250.'
  )
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    subtitle = EXCLUDED.subtitle,
    description = EXCLUDED.description,
    price = EXCLUDED.price,
    featured = EXCLUDED.featured,
    is_new_arrival = EXCLUDED.is_new_arrival,
    details = EXCLUDED.details,
    fabric_care = EXCLUDED.fabric_care,
    shipping_info = EXCLUDED.shipping_info
  RETURNING id INTO prod_nocturne_id;

  INSERT INTO public.product_variants (product_id, size, color, color_hex, stock, sku)
  VALUES
    (prod_nocturne_id, 'S', 'Deep Charcoal', '#222222', 15, 'vb-long-sleeve-nocturne-s'),
    (prod_nocturne_id, 'M', 'Deep Charcoal', '#222222', 25, 'vb-long-sleeve-nocturne-m'),
    (prod_nocturne_id, 'L', 'Deep Charcoal', '#222222', 30, 'vb-long-sleeve-nocturne-l'),
    (prod_nocturne_id, 'XL', 'Deep Charcoal', '#222222', 15, 'vb-long-sleeve-nocturne-xl')
  ON CONFLICT (sku) DO UPDATE SET stock = EXCLUDED.stock;

  DELETE FROM public.product_images WHERE product_id = prod_nocturne_id;
  INSERT INTO public.product_images (product_id, url, alt_text, display_order, is_primary)
  VALUES
    (prod_nocturne_id, '/assets/products/black-shirt.jpeg', 'VB Fits Nocturne Long Sleeve - Front View', 0, true),
    (prod_nocturne_id, '/assets/hero/hero.jpg', 'VB Fits Nocturne Long Sleeve - Editorial Look', 1, false);

  -- --------------------------------------------------------------------------
  -- Product 4: VB Fits Studios Archival Long Sleeve
  -- --------------------------------------------------------------------------
  INSERT INTO public.products (
    slug, category_id, name, subtitle, description, price, currency,
    featured, is_new_arrival, is_published, details, fabric_care, shipping_info
  ) VALUES (
    'vb-long-sleeve-monochrome',
    cat_id,
    'VB Fits Studios Archival Long Sleeve',
    'Bone White / Matte Black Sleeve Artwork',
    'Archival edition in natural bone white. Tailored to an architectural drop-shoulder cut with high-density ink detailing.',
    210.00,
    'USD',
    false,
    false,
    true,
    '["Bone white unbleached heavyweight jersey", "Archival edition woven label at inner nape", "Reinforced twin needle hem"]'::jsonb,
    '["100% Organic Heavyweight Cotton", "Cold water wash", "Air dry only"]'::jsonb,
    'Complimentary express shipping on orders over $250.'
  )
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    subtitle = EXCLUDED.subtitle,
    description = EXCLUDED.description,
    price = EXCLUDED.price,
    featured = EXCLUDED.featured,
    is_new_arrival = EXCLUDED.is_new_arrival,
    details = EXCLUDED.details,
    fabric_care = EXCLUDED.fabric_care,
    shipping_info = EXCLUDED.shipping_info
  RETURNING id INTO prod_monochrome_id;

  INSERT INTO public.product_variants (product_id, size, color, color_hex, stock, sku)
  VALUES
    (prod_monochrome_id, 'S', 'Bone White', '#F2EFE9', 15, 'vb-long-sleeve-monochrome-s'),
    (prod_monochrome_id, 'M', 'Bone White', '#F2EFE9', 25, 'vb-long-sleeve-monochrome-m'),
    (prod_monochrome_id, 'L', 'Bone White', '#F2EFE9', 30, 'vb-long-sleeve-monochrome-l'),
    (prod_monochrome_id, 'XL', 'Bone White', '#F2EFE9', 15, 'vb-long-sleeve-monochrome-xl')
  ON CONFLICT (sku) DO UPDATE SET stock = EXCLUDED.stock;

  DELETE FROM public.product_images WHERE product_id = prod_monochrome_id;
  INSERT INTO public.product_images (product_id, url, alt_text, display_order, is_primary)
  VALUES
    (prod_monochrome_id, '/assets/products/white-shirt.jpeg', 'VB Fits Studios Archival Long Sleeve - Front View', 0, true),
    (prod_monochrome_id, '/assets/hero/hero.jpg', 'VB Fits Studios Archival Long Sleeve - Editorial Look', 1, false);

END $$;
