-- ==============================================================================
-- VB FITS STUDIOS - POSTGRES FULL-TEXT & TRIGRAM SEARCH (TYPO-TOLERANT)
-- Migration: 20260919000016_postgres_trigram_search.sql
-- Description: Enables pg_trgm for typo tolerance and exposes search_products RPC
--              searching titles, categories, colors, and descriptions.
-- ==============================================================================

-- 1. Enable pg_trgm extension for typo-tolerant trigram search
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- 2. Create GIN Trigram Indexes for high-performance fuzzy matching
CREATE INDEX IF NOT EXISTS idx_products_trgm_name 
  ON public.products USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_products_trgm_subtitle 
  ON public.products USING gin (subtitle gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_products_trgm_description 
  ON public.products USING gin (description gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_categories_trgm_name 
  ON public.categories USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_product_variants_trgm_color 
  ON public.product_variants USING gin (color gin_trgm_ops);

-- 3. Typo-Tolerant Search RPC Function
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
      -- Full-text search rank
      (ts_rank(
        to_tsvector('simple', coalesce(p.name, '') || ' ' || coalesce(p.subtitle, '') || ' ' || coalesce(p.description, '') || ' ' || coalesce(c.name, '') || ' ' || coalesce(pca.all_colors, '')),
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
      -- Full-text search match
      OR to_tsvector('simple', coalesce(p.name, '') || ' ' || coalesce(p.subtitle, '') || ' ' || coalesce(p.description, '') || ' ' || coalesce(c.name, '') || ' ' || coalesce(pca.all_colors, ''))
         @@ plainto_tsquery('simple', clean_q)
    )
  ORDER BY score DESC, p.created_at DESC
  LIMIT max_results;
END;
$$;

-- 4. Dynamic Search Suggestion Pills RPC Function
CREATE OR REPLACE FUNCTION public.get_search_suggestions(
  max_suggestions INT DEFAULT 6
)
RETURNS TABLE (suggestion TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  RETURN QUERY
  WITH terms AS (
    -- 1. Published Categories
    SELECT c.name AS term, 1 AS priority
    FROM public.categories c
    WHERE EXISTS (SELECT 1 FROM public.products p WHERE p.category_id = c.id AND p.is_published = true)
    
    UNION ALL
    
    -- 2. Published Colors
    SELECT DISTINCT pv.color AS term, 2 AS priority
    FROM public.product_variants pv
    JOIN public.products p ON p.id = pv.product_id
    WHERE p.is_published = true AND pv.color IS NOT NULL AND pv.color <> ''
    
    UNION ALL
    
    -- 3. Popular or Featured Silhouettes
    SELECT p.name AS term, 3 AS priority
    FROM public.products p
    WHERE p.is_published = true AND (p.featured = true OR p.is_new_arrival = true)
  )
  SELECT DISTINCT t.term::TEXT
  FROM terms t
  WHERE t.term IS NOT NULL AND length(trim(t.term)) > 1
  ORDER BY t.term::TEXT ASC
  LIMIT max_suggestions;
END;
$$;

-- 5. Grant Execute Permissions
GRANT EXECUTE ON FUNCTION public.search_products(TEXT, INT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_search_suggestions(INT) TO anon, authenticated, service_role;
