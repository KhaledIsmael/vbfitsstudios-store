-- ==============================================================================
-- VB FITS STUDIOS - Fix missing order items + admin purge + admin hard delete
-- Migration: 20261010000041
--
-- ROOT CAUSE of "order has 0 items":
--   The trigger tr_reserve_stock_on_order_item (migration 20261004000037) runs
--   AFTER INSERT on public.order_items and references NEW.product_variant_id.
--   That column does NOT exist on order_items, so PL/pgSQL raises
--   'record "new" has no field "product_variant_id"' and the whole INSERT is
--   rolled back. The order row (a separate request) survived, the items did not,
--   and the frontend only logged a warning. The same migration family also
--   created release_stock_* triggers that reference a non-existent oi.size
--   column, which would break cancelling an order / updating payment_status.
--
-- This migration:
--   1. Rewrites the 3 stock triggers so they only use real columns and can
--      NEVER block an order/order_item write.
--   2. Resets order_items RLS/grants to a known-good state.
--   3. Creates a secured purge_all_test_data() RPC (admin only).
--   4. Creates a secured admin_delete_product() RPC + delete policies.
-- Safe to run multiple times.
-- ==============================================================================

-- ── 0. Make sure optional columns exist ──────────────────────────────────────
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS variant_title TEXT,
  ADD COLUMN IF NOT EXISTS sku TEXT;

-- ── 1. Stock helpers (only reference columns that really exist) ──────────────
CREATE OR REPLACE FUNCTION public.reserve_stock_on_order_item_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_size TEXT;
  v_vid  UUID;
BEGIN
  -- "Size: M / Color: Black" -> "m"
  v_size := lower(trim(COALESCE(
    substring(lower(COALESCE(NEW.variant_title, '')) FROM 'size:\s*([^/,]+)'),
    NEW.variant_title,
    ''
  )));

  v_vid := NEW.variant_id;

  IF v_vid IS NULL AND NEW.product_id IS NOT NULL AND v_size <> '' THEN
    SELECT id INTO v_vid FROM public.product_variants
    WHERE product_id = NEW.product_id AND lower(size) = v_size
    LIMIT 1;
  END IF;

  IF v_vid IS NULL AND NEW.product_name IS NOT NULL AND v_size <> '' THEN
    SELECT pv.id INTO v_vid
    FROM public.product_variants pv
    JOIN public.products p ON p.id = pv.product_id
    WHERE lower(p.name) = lower(NEW.product_name) AND lower(pv.size) = v_size
    LIMIT 1;
  END IF;

  IF v_vid IS NOT NULL THEN
    UPDATE public.product_variants
    SET stock = GREATEST(0, stock - NEW.quantity)
    WHERE id = v_vid;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Stock bookkeeping must never prevent an order line from being saved.
  RAISE WARNING 'reserve_stock_on_order_item_insert skipped: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_reserve_stock_on_order_item ON public.order_items;
CREATE TRIGGER tr_reserve_stock_on_order_item
  AFTER INSERT ON public.order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.reserve_stock_on_order_item_insert();

-- Shared release logic (cancel / failed payment)
CREATE OR REPLACE FUNCTION public.release_order_stock(p_order_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r      RECORD;
  v_size TEXT;
  v_vid  UUID;
BEGIN
  FOR r IN
    SELECT product_id, variant_id, product_name, variant_title, quantity
    FROM public.order_items WHERE order_id = p_order_id
  LOOP
    v_vid  := r.variant_id;
    v_size := lower(trim(COALESCE(
      substring(lower(COALESCE(r.variant_title, '')) FROM 'size:\s*([^/,]+)'),
      r.variant_title, '')));

    IF v_vid IS NULL AND r.product_id IS NOT NULL AND v_size <> '' THEN
      SELECT id INTO v_vid FROM public.product_variants
      WHERE product_id = r.product_id AND lower(size) = v_size LIMIT 1;
    END IF;

    IF v_vid IS NULL AND r.product_name IS NOT NULL AND v_size <> '' THEN
      SELECT pv.id INTO v_vid
      FROM public.product_variants pv
      JOIN public.products p ON p.id = pv.product_id
      WHERE lower(p.name) = lower(r.product_name) AND lower(pv.size) = v_size LIMIT 1;
    END IF;

    IF v_vid IS NOT NULL THEN
      UPDATE public.product_variants SET stock = stock + r.quantity WHERE id = v_vid;
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_stock_on_cancel()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('cancelled', 'refunded') AND OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM public.release_order_stock(NEW.id);
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'release_stock_on_cancel skipped: %', SQLERRM;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_stock_on_failed_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.payment_status = 'failed' AND OLD.payment_status IS DISTINCT FROM 'failed' THEN
    PERFORM public.release_order_stock(NEW.id);
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'release_stock_on_failed_payment skipped: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- ── 2. order_items RLS / grants: known-good state ────────────────────────────
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE p RECORD;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies
           WHERE schemaname = 'public' AND tablename = 'order_items'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.order_items', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "order_items_select"  ON public.order_items FOR SELECT USING (true);
CREATE POLICY "order_items_insert"  ON public.order_items FOR INSERT WITH CHECK (true);
CREATE POLICY "order_items_update"  ON public.order_items FOR UPDATE
  USING (public.is_admin_or_support());
CREATE POLICY "order_items_delete"  ON public.order_items FOR DELETE
  USING (public.is_admin_or_support());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO authenticated, anon;

-- ── 3. Secure 1-click purge of test data (ADMIN ONLY) ────────────────────────
CREATE OR REPLACE FUNCTION public.purge_all_test_data()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'vbfits_forbidden: admin access required.' USING ERRCODE = '42501';
  END IF;

  TRUNCATE TABLE public.order_items, public.orders CASCADE;

  BEGIN
    TRUNCATE TABLE public.return_requests CASCADE;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  -- Cloud status overrides that point at the purged orders
  DELETE FROM public.store_settings WHERE key = 'order_status_updates';

  RETURN json_build_object('success', true, 'message', 'All test orders and items purged.');
END;
$$;

REVOKE ALL ON FUNCTION public.purge_all_test_data() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purge_all_test_data() TO authenticated, service_role;

-- ── 4. Hard delete products (ADMIN ONLY) ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_delete_product(p_product_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin_or_support() THEN
    RAISE EXCEPTION 'vbfits_forbidden: admin access required.' USING ERRCODE = '42501';
  END IF;

  -- order_items.product_id is ON DELETE SET NULL, so order history is preserved
  -- (product_name / variant_title / price are stored on the order line itself).
  DELETE FROM public.product_variants WHERE product_id = p_product_id;
  DELETE FROM public.product_images   WHERE product_id = p_product_id;
  DELETE FROM public.products         WHERE id = p_product_id;

  RETURN json_build_object('success', true, 'deleted', p_product_id);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_product(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_product(UUID) TO authenticated, service_role;

-- Direct DELETE policies (defence in depth, in case the RPC is bypassed)
DROP POLICY IF EXISTS "products_admin_delete"          ON public.products;
DROP POLICY IF EXISTS "product_variants_admin_delete"  ON public.product_variants;
DROP POLICY IF EXISTS "product_images_admin_delete"    ON public.product_images;

CREATE POLICY "products_admin_delete" ON public.products
  FOR DELETE USING (public.is_admin_or_support());
CREATE POLICY "product_variants_admin_delete" ON public.product_variants
  FOR DELETE USING (public.is_admin_or_support());
CREATE POLICY "product_images_admin_delete" ON public.product_images
  FOR DELETE USING (public.is_admin_or_support());

GRANT DELETE ON public.products, public.product_variants, public.product_images
  TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
