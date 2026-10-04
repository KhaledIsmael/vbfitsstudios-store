-- =============================================================================
-- Migration: 20261004000037_bidirectional_sync_and_realtime.sql
-- Description: Closes all database gaps for storefront <-> admin bidirectional sync:
--   1. Ensures return_shipping_fee on return_requests with auto-calculation trigger.
--   2. Atomic stock decrement trigger on direct order_items insert.
--   3. Automatic past-guest-order linking when a new customer registers.
--   4. Hardens search_products & get_search_suggestions to strictly exclude archived.
--   5. Checks and ensures supabase_realtime publication is configured.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. return_requests: add return_shipping_fee and auto-computation trigger
-- -----------------------------------------------------------------------------
ALTER TABLE public.return_requests
  ADD COLUMN IF NOT EXISTS return_shipping_fee NUMERIC(10,2) DEFAULT 0;

CREATE OR REPLACE FUNCTION public.set_return_shipping_fee()
RETURNS TRIGGER AS $$
BEGIN
  -- Always compute return shipping fee from database shipping_zones table
  -- based on the order destination governorate (never trust client)
  IF NEW.return_shipping_fee IS NULL OR NEW.return_shipping_fee <= 0 THEN
    NEW.return_shipping_fee := COALESCE(public.get_return_shipping_fee(NEW.order_id), 65.00);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS tr_set_return_shipping_fee ON public.return_requests;
CREATE TRIGGER tr_set_return_shipping_fee
  BEFORE INSERT OR UPDATE OF order_id ON public.return_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.set_return_shipping_fee();

-- -----------------------------------------------------------------------------
-- 2. order_items: stock reservation trigger on direct checkout inserts
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reserve_stock_on_order_item_insert()
RETURNS TRIGGER AS $$
DECLARE
  v_variant_id UUID;
  v_size TEXT;
BEGIN
  -- Extract clean size name from variant_title (e.g. 'Size: M' -> 'M')
  v_size := trim(replace(replace(COALESCE(NEW.variant_title, ''), 'Size:', ''), 'size:', ''));

  -- Path A: variant_id / product_variant_id column exists
  IF (to_jsonb(NEW) ? 'product_variant_id') AND NEW.product_variant_id IS NOT NULL THEN
    UPDATE public.product_variants
    SET stock = GREATEST(0, stock - NEW.quantity)
    WHERE id = NEW.product_variant_id;

  -- Path B: product_id is known with size
  ELSIF (to_jsonb(NEW) ? 'product_id') AND NEW.product_id IS NOT NULL AND v_size <> '' THEN
    UPDATE public.product_variants
    SET stock = GREATEST(0, stock - NEW.quantity)
    WHERE id = (
      SELECT id FROM public.product_variants
      WHERE product_id = NEW.product_id AND lower(size) = lower(v_size)
      LIMIT 1
    );

  -- Path C: Match by product_name and size
  ELSIF NEW.product_name IS NOT NULL AND v_size <> '' THEN
    UPDATE public.product_variants
    SET stock = GREATEST(0, stock - NEW.quantity)
    WHERE id = (
      SELECT pv.id
      FROM public.product_variants pv
      JOIN public.products p ON p.id = pv.product_id
      WHERE lower(p.name) = lower(NEW.product_name)
        AND lower(pv.size) = lower(v_size)
      LIMIT 1
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS tr_reserve_stock_on_order_item ON public.order_items;
CREATE TRIGGER tr_reserve_stock_on_order_item
  AFTER INSERT ON public.order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.reserve_stock_on_order_item_insert();

-- -----------------------------------------------------------------------------
-- 3. customers: automatically link guest orders on customer account creation
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.link_guest_orders_on_customer_signup()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email IS NOT NULL AND NEW.email <> '' THEN
    UPDATE public.orders
    SET customer_id = NEW.id
    WHERE customer_id IS NULL
      AND lower(shipping_address_snapshot->>'email') = lower(NEW.email);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS tr_link_guest_orders_on_customer_signup ON public.customers;
CREATE TRIGGER tr_link_guest_orders_on_customer_signup
  AFTER INSERT ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.link_guest_orders_on_customer_signup();

-- -----------------------------------------------------------------------------
-- 4. search_products: harden to strictly filter out is_archived = true
-- -----------------------------------------------------------------------------
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
    COALESCE(p.currency, 'EGP')::TEXT,
    COALESCE(c.name, 'Collection')::TEXT,
    COALESCE(pca.primary_color, 'Standard')::TEXT,
    COALESCE(pia.img_urls, ARRAY[]::TEXT[]),
    (
      (similarity(p.name, clean_q) * 3.5) +
      (similarity(COALESCE(p.subtitle, ''), clean_q) * 1.5) +
      (similarity(COALESCE(c.name, ''), clean_q) * 2.0) +
      (similarity(COALESCE(pca.all_colors, ''), clean_q) * 2.5) +
      (CASE WHEN p.name ILIKE '%' || clean_q || '%' THEN 2.0 ELSE 0.0 END) +
      (CASE WHEN c.name ILIKE '%' || clean_q || '%' THEN 1.0 ELSE 0.0 END) +
      (CASE WHEN pca.all_colors ILIKE '%' || clean_q || '%' THEN 1.5 ELSE 0.0 END) +
      (ts_rank(
        COALESCE(p.search_vector, to_tsvector('simple', p.name || ' ' || COALESCE(p.description, '')))
        || to_tsvector('simple', coalesce(c.name, '') || ' ' || coalesce(pca.all_colors, '')),
        plainto_tsquery('simple', clean_q)
      ) * 1.5)
    )::REAL AS score
  FROM public.products p
  LEFT JOIN public.categories c ON c.id = p.category_id
  LEFT JOIN product_color_agg pca ON pca.product_id = p.id
  LEFT JOIN product_image_agg pia ON pia.product_id = p.id
  WHERE 
    p.is_published = true
    AND COALESCE(p.is_archived, false) = false
    AND (
      similarity(p.name, clean_q) > 0.15
      OR similarity(COALESCE(p.subtitle, ''), clean_q) > 0.15
      OR similarity(COALESCE(c.name, ''), clean_q) > 0.2
      OR similarity(COALESCE(pca.all_colors, ''), clean_q) > 0.2
      OR p.name ILIKE '%' || clean_q || '%'
      OR p.description ILIKE '%' || clean_q || '%'
      OR c.name ILIKE '%' || clean_q || '%'
      OR pca.all_colors ILIKE '%' || clean_q || '%'
      OR (COALESCE(p.search_vector, to_tsvector('simple', p.name || ' ' || COALESCE(p.description, '')))
          || to_tsvector('simple', coalesce(c.name, '') || ' ' || coalesce(pca.all_colors, '')))
         @@ plainto_tsquery('simple', clean_q)
    )
  ORDER BY score DESC, p.created_at DESC
  LIMIT max_results;
END;
$$;

-- -----------------------------------------------------------------------------
-- 5. get_search_suggestions: also exclude archived products
-- -----------------------------------------------------------------------------
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
    SELECT c.name AS term, 1 AS priority
    FROM public.categories c
    WHERE EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.category_id = c.id
        AND p.is_published = true
        AND COALESCE(p.is_archived, false) = false
    )
    
    UNION ALL
    
    SELECT DISTINCT pv.color AS term, 2 AS priority
    FROM public.product_variants pv
    JOIN public.products p ON p.id = pv.product_id
    WHERE p.is_published = true
      AND COALESCE(p.is_archived, false) = false
      AND pv.color IS NOT NULL AND pv.color <> ''
    
    UNION ALL
    
    SELECT p.name AS term, 3 AS priority
    FROM public.products p
    WHERE p.is_published = true
      AND COALESCE(p.is_archived, false) = false
      AND (p.featured = true OR p.is_new_arrival = true)
  )
  SELECT DISTINCT t.term::TEXT
  FROM terms t
  WHERE t.term IS NOT NULL AND length(trim(t.term)) > 1
  ORDER BY t.term::TEXT ASC
  LIMIT max_suggestions;
END;
$$;

-- -----------------------------------------------------------------------------
-- 6. Supabase Realtime Publication
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 7. Reload PostgREST schema cache
-- -----------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
