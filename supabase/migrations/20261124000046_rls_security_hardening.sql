-- ============================================================================
-- VB FITS STUDIOS
-- Migration: 20261124000046_rls_security_hardening.sql
-- Status:    PREPARED FOR STAGING — DO NOT APPLY TO PRODUCTION WITHOUT APPROVAL
--
-- Addresses live-verified RLS & storage findings from 03_RLS_SECURITY.md:
--   RLS-01 : orders SELECT no longer exposes customer_id IS NULL to any auth user
--   RLS-02 : order_items SELECT restricted to order owner or admin/support
--   RLS-03 : cart_items restricted to user_id = auth.uid() or admin/support
--   RLS-04 : orders UPDATE restricted to customer_id = auth.uid() or admin/support
--   RLS-05 : return_requests SELECT restricted to customer_id = auth.uid() or admin/support
--   RLS-08 : customers UPDATE blocks non-admin role self-promotion
--   RLS-10 : order_items INSERT restricted to order owner or recent guest order
--   RLS-11 : site_settings REVOKE ALL from anon; GRANT SELECT only
--   RLS-14 : Drop legacy permissive storage.objects policies on product-media/store-media
--   RPCs   : link_guest_orders_to_customer() & lookup_guest_order() with rate limits
-- ============================================================================

-- ── 1. orders: remove customer_id IS NULL from SELECT and UPDATE ─────────────
DROP POLICY IF EXISTS "orders_select" ON public.orders;
DROP POLICY IF EXISTS "orders_select_admin_or_own" ON public.orders;
CREATE POLICY "orders_select"
  ON public.orders FOR SELECT
  USING (
    auth.uid() = customer_id
    OR public.is_admin_or_support()
  );

DROP POLICY IF EXISTS "orders_update" ON public.orders;
CREATE POLICY "orders_update"
  ON public.orders FOR UPDATE
  USING (
    auth.uid() = customer_id
    OR public.is_admin_or_support()
  )
  WITH CHECK (
    auth.uid() = customer_id
    OR public.is_admin_or_support()
  );

-- ── 2. order_items: restrict SELECT & INSERT to order owner / admin ──────────
DROP POLICY IF EXISTS "order_items_select" ON public.order_items;
CREATE POLICY "order_items_select"
  ON public.order_items FOR SELECT
  USING (
    public.is_admin_or_support()
    OR EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND o.customer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "order_items_insert" ON public.order_items;
CREATE POLICY "order_items_insert"
  ON public.order_items FOR INSERT
  WITH CHECK (
    public.is_admin_or_support()
    OR EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND o.created_at >= now() - INTERVAL '5 minutes'
        AND (
          o.customer_id = auth.uid()
          OR (o.customer_id IS NULL AND auth.uid() IS NULL)
        )
    )
  );

-- ── 3. cart_items: remove user_id IS NULL / session_id IS NOT NULL exposure ──
DROP POLICY IF EXISTS "cart_items_select" ON public.cart_items;
CREATE POLICY "cart_items_select"
  ON public.cart_items FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.is_admin_or_support()
  );

DROP POLICY IF EXISTS "cart_items_insert" ON public.cart_items;
CREATE POLICY "cart_items_insert"
  ON public.cart_items FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    OR public.is_admin_or_support()
  );

DROP POLICY IF EXISTS "cart_items_update" ON public.cart_items;
CREATE POLICY "cart_items_update"
  ON public.cart_items FOR UPDATE
  USING (
    user_id = auth.uid()
    OR public.is_admin_or_support()
  )
  WITH CHECK (
    user_id = auth.uid()
    OR public.is_admin_or_support()
  );

DROP POLICY IF EXISTS "cart_items_delete" ON public.cart_items;
CREATE POLICY "cart_items_delete"
  ON public.cart_items FOR DELETE
  USING (
    user_id = auth.uid()
    OR public.is_admin_or_support()
  );

-- ── 4. return_requests: remove customer_id IS NULL from SELECT ───────────────
DROP POLICY IF EXISTS "return_requests_select" ON public.return_requests;
DROP POLICY IF EXISTS "return_requests_admin_read" ON public.return_requests;
CREATE POLICY "return_requests_select"
  ON public.return_requests FOR SELECT
  USING (
    customer_id = auth.uid()
    OR public.is_admin_or_support()
  );

-- ── 5. customers: prevent self-promotion via role column on UPDATE ───────────
DROP POLICY IF EXISTS "customers_update" ON public.customers;
DROP POLICY IF EXISTS "customers_update_own" ON public.customers;
CREATE POLICY "customers_update"
  ON public.customers FOR UPDATE
  USING (
    id = auth.uid()
    OR public.is_admin_or_support()
  )
  WITH CHECK (
    public.is_admin_or_support()
    OR (
      id = auth.uid()
      AND role = (SELECT c.role FROM public.customers c WHERE c.id = auth.uid())
    )
  );

-- ── 6. site_settings: revoke write/delete grants from anon ───────────────────
REVOKE ALL ON public.site_settings FROM anon;
GRANT SELECT ON public.site_settings TO anon;

-- ── 7. storage.objects: drop legacy permissive upload/update/delete policies ─
DROP POLICY IF EXISTS "Staff can upload product-media" ON storage.objects;
DROP POLICY IF EXISTS "Staff can upload store-media" ON storage.objects;
DROP POLICY IF EXISTS "Staff can update/delete product-media" ON storage.objects;
DROP POLICY IF EXISTS "Staff can update store-media" ON storage.objects;
DROP POLICY IF EXISTS "Staff can delete store-media" ON storage.objects;

-- ── 8. Audit table & SECURITY DEFINER RPCs for guest linking & tracking ──────
CREATE TABLE IF NOT EXISTS public.guest_lookup_audit (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_key    TEXT NOT NULL,
  action_type  TEXT NOT NULL,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.guest_lookup_audit ENABLE ROW LEVEL SECURITY;
-- No public/authenticated policies: accessible only inside SECURITY DEFINER functions.

CREATE INDEX IF NOT EXISTS idx_guest_lookup_audit_actor_time
  ON public.guest_lookup_audit (actor_key, action_type, attempted_at DESC);

-- 8a. Server-scoped guest order linking (replaces client full-table scan)
CREATE OR REPLACE FUNCTION public.link_guest_orders_to_customer(
  p_customer_id UUID,
  p_email       TEXT DEFAULT NULL,
  p_phone       TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean_email TEXT := NULLIF(lower(trim(COALESCE(p_email, ''))), '');
  v_clean_phone TEXT := NULLIF(regexp_replace(trim(COALESCE(p_phone, '')), '[\s\-()]', '', 'g'), '');
  v_linked      INT  := 0;
BEGIN
  -- Caller must be the authenticated customer themselves (or service_role)
  IF COALESCE(auth.role(), '') <> 'service_role' AND auth.uid() IS DISTINCT FROM p_customer_id THEN
    RAISE EXCEPTION 'vbfits_forbidden: cannot link orders for another user.' USING ERRCODE = '42501';
  END IF;

  IF p_customer_id IS NULL OR (v_clean_email IS NULL AND v_clean_phone IS NULL) THEN
    RETURN json_build_object('linked_count', 0, 'error', null);
  END IF;

  -- Rate limit: max 5 attempts per customer per hour
  IF (
    SELECT count(*) FROM public.guest_lookup_audit
    WHERE actor_key = p_customer_id::text
      AND action_type = 'link_guest_orders'
      AND attempted_at >= now() - INTERVAL '1 hour'
  ) >= 5 THEN
    RETURN json_build_object('linked_count', 0, 'error', 'rate_limited');
  END IF;

  INSERT INTO public.guest_lookup_audit (actor_key, action_type)
  VALUES (p_customer_id::text, 'link_guest_orders');

  WITH matched AS (
    SELECT id
    FROM public.orders
    WHERE customer_id IS NULL
      AND (
        (v_clean_email IS NOT NULL AND (
          lower(COALESCE(shipping_address_snapshot->>'email', '')) = v_clean_email
          OR lower(COALESCE(notes, '')) LIKE '%' || v_clean_email || '%'
        ))
        OR (v_clean_phone IS NOT NULL AND length(v_clean_phone) >= 8 AND (
          regexp_replace(COALESCE(shipping_address_snapshot->>'phone', ''), '[\s\-()]', '', 'g')
            LIKE '%' || right(v_clean_phone, 8)
        ))
      )
  )
  UPDATE public.orders
  SET customer_id = p_customer_id
  WHERE id IN (SELECT id FROM matched)
    AND customer_id IS NULL;

  GET DIAGNOSTICS v_linked = ROW_COUNT;

  RETURN json_build_object('linked_count', v_linked, 'error', null);
END;
$$;

REVOKE ALL ON FUNCTION public.link_guest_orders_to_customer(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.link_guest_orders_to_customer(UUID, TEXT, TEXT)
  TO authenticated, service_role;

-- 8b. Server-verified guest order tracking (order_number + email challenge)
CREATE OR REPLACE FUNCTION public.lookup_guest_order(
  p_order_number TEXT,
  p_email        TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_num   TEXT := upper(trim(COALESCE(p_order_number, '')));
  v_email TEXT := lower(trim(COALESCE(p_email, '')));
  v_order public.orders%ROWTYPE;
  v_items JSON;
BEGIN
  IF v_num = '' OR v_email = '' THEN
    RETURN NULL;
  END IF;

  -- Rate limit: max 10 lookup attempts per order_number per hour
  IF (
    SELECT count(*) FROM public.guest_lookup_audit
    WHERE actor_key = v_num
      AND action_type = 'lookup_guest_order'
      AND attempted_at >= now() - INTERVAL '1 hour'
  ) >= 10 THEN
    RAISE EXCEPTION 'Too many lookup attempts. Please try again later.' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.guest_lookup_audit (actor_key, action_type)
  VALUES (v_num, 'lookup_guest_order');

  SELECT * INTO v_order
  FROM public.orders
  WHERE upper(order_number) = v_num
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Verify email matches snapshot or notes
  IF lower(COALESCE(v_order.shipping_address_snapshot->>'email', '')) <> v_email
     AND position(v_email IN lower(COALESCE(v_order.notes, ''))) = 0 THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(json_agg(row_to_json(i)), '[]'::json) INTO v_items
  FROM (
    SELECT id, product_name, variant_title, unit_price, quantity, total_price, image_url
    FROM public.order_items
    WHERE order_id = v_order.id
  ) i;

  RETURN json_build_object(
    'id', v_order.id,
    'order_number', v_order.order_number,
    'status', v_order.status,
    'currency', v_order.currency,
    'total', v_order.total,
    'tracking_number', v_order.tracking_number,
    'delivered_at', v_order.delivered_at,
    'created_at', v_order.created_at,
    'order_items', v_items
  );
END;
$$;

REVOKE ALL ON FUNCTION public.lookup_guest_order(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_guest_order(TEXT, TEXT)
  TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
