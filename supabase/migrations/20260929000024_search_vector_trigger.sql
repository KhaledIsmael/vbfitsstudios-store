-- ==============================================================================
-- Migration: 20260929000024_search_vector_trigger.sql
-- Description: Adds a stored tsvector column to products and a trigger to auto-update
--              it on insert/update. Updates search_products to use this index
--              instead of computing to_tsvector on the fly.
-- ==============================================================================

-- 1. Add search_vector column to products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- 2. Create an index on the search_vector
CREATE INDEX IF NOT EXISTS idx_products_search_vector 
  ON public.products USING gin(search_vector);

-- 3. Backfill existing products
UPDATE public.products
SET search_vector = to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(subtitle, '') || ' ' || coalesce(description, ''));

-- 4. Create trigger to auto-update search_vector
CREATE OR REPLACE FUNCTION public.products_search_vector_trigger()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('simple', coalesce(NEW.name, '') || ' ' || coalesce(NEW.subtitle, '') || ' ' || coalesce(NEW.description, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_products_search_vector_update ON public.products;
CREATE TRIGGER tr_products_search_vector_update
  BEFORE INSERT OR UPDATE OF name, subtitle, description ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.products_search_vector_trigger();

-- 5. Update the search_products RPC to use the precomputed vector
CREATE OR REPLACE FUNCTION public.search_products(
  search_query TEXT,
  max_results INT DEFAULT 12
)
RETURNS TABLE (
  id TEXT,
  slug TEXT,
  name TEXT,
  subtitle TEXT,
  description TEXT,
  price NUMERIC,
  currency TEXT,
  category TEXT,
  color TEXT,
  images TEXT[],
  similarity_score REAL
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  clean_q TEXT;
BEGIN
  clean_q := trim(search_query);
  IF clean_q = '' THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH product_color_agg AS (
    SELECT 
      pv.product_id,
      string_agg(DISTINCT pv.color, ' ') AS all_colors,
      (array_agg(DISTINCT pv.color))[1] AS primary_color
    FROM public.product_variants pv
    GROUP BY pv.product_id
  ),
  product_image_agg AS (
    SELECT 
      pi.product_id,
      array_agg(pi.url ORDER BY pi.is_primary DESC, pi.display_order ASC) AS img_urls
    FROM public.product_images pi
    GROUP BY pi.product_id
  )
  SELECT 
    p.id::TEXT,
    p.slug::TEXT,
    p.name::TEXT,
    COALESCE(p.subtitle, '')::TEXT,
    COALESCE(p.description, '')::TEXT,
    p.price::NUMERIC,
    COALESCE(p.currency, '$')::TEXT,
    COALESCE(c.name, 'Collection')::TEXT,
    COALESCE(pca.primary_color, 'Standard')::TEXT,
    COALESCE(pia.img_urls, ARRAY[]::TEXT[]),
    (
      -- Title match (exact or trigram similarity)
      (similarity(p.name, clean_q) * 3.5) +
      -- Subtitle match
      (similarity(COALESCE(p.subtitle, ''), clean_q) * 1.5) +
      -- Category match
      (similarity(COALESCE(c.name, ''), clean_q) * 2.0) +
      -- Color match
      (similarity(COALESCE(pca.all_colors, ''), clean_q) * 2.5) +
      -- Substring presence bonus
      (CASE WHEN p.name ILIKE '%' || clean_q || '%' THEN 2.0 ELSE 0.0 END) +
      (CASE WHEN c.name ILIKE '%' || clean_q || '%' THEN 1.0 ELSE 0.0 END) +
      (CASE WHEN pca.all_colors ILIKE '%' || clean_q || '%' THEN 1.5 ELSE 0.0 END) +
      -- Full-text search rank (using precomputed vector + category + colors)
      (ts_rank(
        p.search_vector || to_tsvector('simple', coalesce(c.name, '') || ' ' || coalesce(pca.all_colors, '')),
        plainto_tsquery('simple', clean_q)
      ) * 1.5)
    )::REAL AS score
  FROM public.products p
  LEFT JOIN public.categories c ON c.id = p.category_id
  LEFT JOIN product_color_agg pca ON pca.product_id = p.id
  LEFT JOIN product_image_agg pia ON pia.product_id = p.id
  WHERE 
    p.is_published = true
    AND (
      -- Typo-tolerant trigram match (> 0.15 threshold)
      similarity(p.name, clean_q) > 0.15
      OR similarity(COALESCE(p.subtitle, ''), clean_q) > 0.15
      OR similarity(COALESCE(c.name, ''), clean_q) > 0.2
      OR similarity(COALESCE(pca.all_colors, ''), clean_q) > 0.2
      -- Partial / exact substring match
      OR p.name ILIKE '%' || clean_q || '%'
      OR p.description ILIKE '%' || clean_q || '%'
      OR c.name ILIKE '%' || clean_q || '%'
      OR pca.all_colors ILIKE '%' || clean_q || '%'
      -- Full-text search match using precomputed vector
      OR (p.search_vector || to_tsvector('simple', coalesce(c.name, '') || ' ' || coalesce(pca.all_colors, '')))
         @@ plainto_tsquery('simple', clean_q)
    )
  ORDER BY score DESC, p.created_at DESC
  LIMIT max_results;
END;
$$;