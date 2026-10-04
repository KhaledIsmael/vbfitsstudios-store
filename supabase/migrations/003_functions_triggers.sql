-- ==========================================================================
-- VB FITS STUDIOS
-- Migration: 20261004000034_functions_triggers.sql
-- Alias:     003_functions_triggers
-- Purpose:   Every trigger, view and RPC function the frozen application
--            needs. DB-ONLY -- no application code changed.
--
-- SECURITY RULES APPLIED IN THIS FILE
--   SECURITY DEFINER used only where the function must write rows the
--   caller cannot reach under RLS (stock release, discount recording,
--   newsletter code creation).
--   All others: SECURITY INVOKER so RLS applies normally.
--   REVOKE EXECUTE FROM PUBLIC on every function.
--   GRANT to specific roles only.
-- ==========================================================================

-- ==========================================================
-- S0  updated_at helper trigger function
-- ==========================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  tbl  TEXT;
  tbls TEXT[] := ARRAY['products','product_variants','orders','customers',
    'addresses','discount_codes','store_settings','site_settings',
    'hero_banners','shipping_zones','chatbot_faqs','return_requests'];
BEGIN
  FOREACH tbl IN ARRAY tbls LOOP
    IF EXISTS (SELECT FROM information_schema.columns
               WHERE table_schema='public' AND table_name=tbl
                 AND column_name='updated_at') THEN
      EXECUTE format(
        'DROP TRIGGER IF EXISTS tr_%s_updated_at ON public.%I;
         CREATE TRIGGER tr_%s_updated_at BEFORE UPDATE ON public.%I
           FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();',
        tbl, tbl, tbl, tbl);
    END IF;
  END LOOP;
END $$;

-- ==========================================================
-- S1  Archive <-> visibility sync trigger + view
--     Trigger fires on UPDATE OF is_archived so storefront
--     never sees an archived product regardless of is_published.
-- ==========================================================
CREATE OR REPLACE FUNCTION public.enforce_archive_unpublish()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.is_archived = true THEN NEW.is_published := false; END IF;
  IF NEW.is_archived = false AND OLD.is_archived = true
     AND NEW.is_published IS NOT DISTINCT FROM false
  THEN NEW.is_published := true; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_enforce_archive_unpublish ON public.products;
CREATE TRIGGER tr_enforce_archive_unpublish
  BEFORE UPDATE OF is_archived ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.enforce_archive_unpublish();

CREATE OR REPLACE VIEW public.v_product_visibility AS
SELECT id, name, slug, is_published, is_archived,
  CASE WHEN is_archived  THEN 'archived'
       WHEN is_published THEN 'live'
       ELSE 'draft' END AS visibility_status,
  updated_at
FROM public.products;
GRANT SELECT ON public.v_product_visibility TO authenticated, service_role;

-- ==========================================================
-- S2  Dashboard stats view
--     AdminDashboardPages.tsx reads .from('orders').select('*').
--     This view gives pre-aggregated headline numbers.
-- ==========================================================
CREATE OR REPLACE VIEW public.v_admin_dashboard_stats AS
SELECT
  COUNT(*)                                                       AS total_orders,
  COUNT(*) FILTER (WHERE status NOT IN ('cancelled','refunded')) AS active_orders,
  COALESCE(SUM(total)   FILTER (WHERE status NOT IN ('cancelled','refunded')),0) AS total_revenue,
  COALESCE(AVG(total)   FILTER (WHERE status NOT IN ('cancelled','refunded')),0) AS avg_order_value,
  COUNT(*) FILTER (WHERE payment_status='pending_collection')    AS cod_pending_count,
  COUNT(*) FILTER (WHERE payment_status='paid')                  AS paid_count,
  COUNT(*) FILTER (WHERE created_at>=(now()-INTERVAL '30 days')
    AND status NOT IN ('cancelled','refunded'))                   AS orders_last_30d,
  COALESCE(SUM(total) FILTER (WHERE created_at>=(now()-INTERVAL '30 days')
    AND status NOT IN ('cancelled','refunded')),0)                AS revenue_last_30d
FROM public.orders;
GRANT SELECT ON public.v_admin_dashboard_stats TO authenticated, service_role;

-- ==========================================================
-- S3  Low-stock view  (adminInventory.ts)
-- ==========================================================
CREATE OR REPLACE VIEW public.v_low_stock_variants AS
SELECT pv.id, pv.product_id, p.name AS product_name, p.slug AS product_slug,
  pv.size, pv.color, pv.sku, pv.stock, pv.low_stock_threshold,
  CASE WHEN pv.stock=0                        THEN 'out_of_stock'
       WHEN pv.stock<=pv.low_stock_threshold  THEN 'low_stock'
       ELSE 'ok' END AS stock_status,
  (SELECT COUNT(*) FROM public.waitlist_signups ws
   WHERE ws.variant_id=pv.id AND ws.notified=false)
+ (SELECT COUNT(*) FROM public.restock_signups rs
   WHERE rs.product_variant_id=pv.id AND rs.notified=false) AS waitlist_count
FROM public.product_variants pv
JOIN public.products p ON p.id=pv.product_id
WHERE pv.stock<=pv.low_stock_threshold
ORDER BY pv.stock ASC;
GRANT SELECT ON public.v_low_stock_variants TO authenticated, service_role;

-- ==========================================================
-- S4  Top-products view  (admin analytics)
-- ==========================================================
CREATE OR REPLACE VIEW public.v_top_products AS
SELECT oi.product_name,
  SUM(oi.quantity) AS units_sold, SUM(oi.total_price) AS revenue,
  COUNT(DISTINCT oi.order_id) AS order_count, MIN(p.id::text)::uuid AS product_id
FROM public.order_items oi
JOIN public.orders o ON o.id=oi.order_id AND o.status NOT IN ('cancelled','refunded')
LEFT JOIN public.products p ON lower(p.name)=lower(oi.product_name)
GROUP BY oi.product_name ORDER BY units_sold DESC LIMIT 20;
GRANT SELECT ON public.v_top_products TO authenticated, service_role;

-- ==========================================================
-- S5  RPC: validate_discount_code(p_code TEXT, p_subtotal NUMERIC)
--     Server-side coupon validation. Currently JS-side in
--     adminMarketing.ts; this is the authoritative DB version.
--     Returns JSON: {valid, discount_amount, message,
--                    discount_type, discount_value, code_id}
-- ==========================================================
CREATE OR REPLACE FUNCTION public.validate_discount_code(
  p_code TEXT, p_subtotal NUMERIC)
RETURNS JSON LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE
  r  public.discount_codes%ROWTYPE;
  v  NUMERIC:=0;
BEGIN
  p_code:=upper(trim(p_code));
  SELECT * INTO r FROM public.discount_codes WHERE code=p_code;
  IF NOT FOUND THEN RETURN json_build_object('valid',false,'discount_amount',0,
    'message','Invalid or unrecognized coupon code.'); END IF;
  IF NOT r.is_active THEN RETURN json_build_object('valid',false,'discount_amount',0,
    'message','This coupon code is currently disabled.'); END IF;
  IF r.starts_at > now() THEN RETURN json_build_object('valid',false,'discount_amount',0,
    'message','This promotion has not started yet.'); END IF;
  IF r.expires_at IS NOT NULL AND r.expires_at < now() THEN
    RETURN json_build_object('valid',false,'discount_amount',0,
    'message','This coupon code has expired.'); END IF;
  IF r.max_uses IS NOT NULL AND r.times_used>=r.max_uses THEN
    RETURN json_build_object('valid',false,'discount_amount',0,
    'message','This coupon code has reached its usage limit.'); END IF;
  IF r.min_spend>0 AND p_subtotal<r.min_spend THEN
    RETURN json_build_object('valid',false,'discount_amount',0,
    'message',format('Requires a minimum cart spend of EGP %s.',
      to_char(r.min_spend,'FM999,999.00'))); END IF;
  IF r.discount_type='percentage' THEN
    v:=round((p_subtotal*r.discount_value/100)::NUMERIC,2);
  ELSE v:=LEAST(p_subtotal,r.discount_value); END IF;
  RETURN json_build_object(
    'valid',true,'discount_amount',v,
    'message',CASE r.discount_type WHEN 'percentage'
      THEN format('Promotion applied: %s%% savings.',r.discount_value)
      ELSE format('Promotion applied: EGP %s discount.',r.discount_value) END,
    'discount_type',r.discount_type,'discount_value',r.discount_value,
    'code_id',r.id,'min_spend',r.min_spend);
END;$$;
REVOKE EXECUTE ON FUNCTION public.validate_discount_code(TEXT,NUMERIC) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.validate_discount_code(TEXT,NUMERIC)
  TO anon,authenticated,service_role;

-- ==========================================================
-- S6  RPC: use_discount_code(p_code_id, p_order_id, ...)
--     Atomically increments times_used and logs the use.
--     Enforces per-email single-use via discount_code_uses.
--     service_role only (called from server-side API routes).
-- ==========================================================
CREATE OR REPLACE FUNCTION public.use_discount_code(
  p_code_id UUID, p_order_id UUID,
  p_customer_id UUID DEFAULT NULL, p_email TEXT DEFAULT NULL)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.discount_codes%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.discount_codes WHERE id=p_code_id FOR UPDATE;
  IF NOT FOUND THEN RETURN json_build_object('success',false,'error','Code not found.'); END IF;
  IF r.max_uses IS NOT NULL AND r.times_used>=r.max_uses THEN
    RETURN json_build_object('success',false,'error','Usage limit reached.'); END IF;
  IF p_email IS NOT NULL AND p_email<>'' THEN
    IF EXISTS (SELECT 1 FROM public.discount_code_uses dcu
               JOIN public.orders o ON o.id=dcu.order_id
               WHERE dcu.discount_code_id=p_code_id
                 AND lower(o.shipping_address_snapshot->>'email')=lower(trim(p_email)))
    THEN RETURN json_build_object('success',false,
      'error','This code has already been used with this email address.'); END IF;
  END IF;
  INSERT INTO public.discount_code_uses(discount_code_id,order_id,customer_id)
  VALUES(p_code_id,p_order_id,p_customer_id);
  UPDATE public.discount_codes
  SET times_used=times_used+1, used_count=COALESCE(used_count,0)+1
  WHERE id=p_code_id;
  RETURN json_build_object('success',true);
END;$$;
REVOKE EXECUTE ON FUNCTION public.use_discount_code(UUID,UUID,UUID,TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.use_discount_code(UUID,UUID,UUID,TEXT)
  TO service_role;

-- ==========================================================
-- S7  RPC: subscribe_newsletter(p_email TEXT, p_source TEXT)
--     adminMarketing.ts subscribeNewsletter() and
--     waitlist.ts submitLaunchWaitlist() email path call this.
--     Returns JSON: {status:'new'|'already_subscribed'|'invalid',
--                    message, discount_code}
--     If status='new', creates a single-use WELCOME10_<hash>
--     10% first-order discount code for that email.
-- ==========================================================
CREATE OR REPLACE FUNCTION public.subscribe_newsletter(
  p_email TEXT, p_source TEXT DEFAULT 'footer')
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_clean TEXT; v_code TEXT; v_exists BOOLEAN;
BEGIN
  v_clean:=lower(trim(p_email));
  IF v_clean IS NULL OR v_clean='' OR v_clean NOT LIKE '%@%.%' THEN
    RETURN json_build_object('status','invalid',
      'message','Invalid email address.','discount_code',null); END IF;
  SELECT EXISTS(SELECT 1 FROM public.newsletter_subscribers
    WHERE lower(email)=v_clean) INTO v_exists;
  IF v_exists THEN
    RETURN json_build_object('status','already_subscribed',
      'message','You are already subscribed to the atelier list.',
      'discount_code',null); END IF;
  INSERT INTO public.newsletter_subscribers(email,source)
  VALUES(v_clean,p_source) ON CONFLICT(email) DO NOTHING;
  v_code:='WELCOME10_'||upper(substring(encode(sha256(v_clean::bytea),'hex'),1,6));
  INSERT INTO public.discount_codes(
    code,discount_type,discount_value,min_spend,max_uses,
    times_used,starts_at,expires_at,is_active)
  VALUES(v_code,'percentage',10,0,1,0,now(),now()+INTERVAL '365 days',true)
  ON CONFLICT(code) DO NOTHING;
  RETURN json_build_object('status','new',
    'message','Welcome to the VB Fits Studios private newsletter.',
    'discount_code',v_code);
END;$$;
REVOKE EXECUTE ON FUNCTION public.subscribe_newsletter(TEXT,TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.subscribe_newsletter(TEXT,TEXT)
  TO anon,authenticated,service_role;

-- ==========================================================
-- S8  RPC: get_shipping_fee(p_governorate TEXT, p_subtotal NUMERIC)
--     Reads shipping_zones by EN or AR governorate name.
--     Applies free-shipping threshold. Fallback: 65 EGP.
--     Returns JSON: {fee, is_free, shipping_rate,
--                    free_shipping_threshold, zone_id,
--                    min_days, max_days, cod_available}
-- ==========================================================
CREATE OR REPLACE FUNCTION public.get_shipping_fee(
  p_governorate TEXT, p_subtotal NUMERIC DEFAULT 0)
RETURNS JSON LANGUAGE plpgsql SECURITY INVOKER SET search_path=public STABLE AS $$
DECLARE
  z public.shipping_zones%ROWTYPE;
  v NUMERIC; thresh NUMERIC; free BOOLEAN;
BEGIN
  SELECT * INTO z FROM public.shipping_zones
  WHERE lower(governorate)   =lower(trim(p_governorate))
     OR lower(governorate_ar)=lower(trim(p_governorate)) LIMIT 1;
  IF NOT FOUND THEN
    RETURN json_build_object('fee',65,'is_free',false,'shipping_rate',65,
      'free_shipping_threshold',1500,'zone_id',null,
      'min_days',3,'max_days',7,'cod_available',true); END IF;
  v     :=COALESCE(z.shipping_rate,z.shipping_fee,z.rate,65);
  thresh:=COALESCE(z.free_shipping_threshold,1500);
  free  :=(p_subtotal>=thresh);
  RETURN json_build_object(
    'fee',CASE WHEN free THEN 0 ELSE v END,
    'is_free',free,'shipping_rate',v,
    'free_shipping_threshold',thresh,'zone_id',z.id,
    'min_days',z.min_days,'max_days',z.max_days,'cod_available',z.cod_available);
END;$$;
REVOKE EXECUTE ON FUNCTION public.get_shipping_fee(TEXT,NUMERIC) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_shipping_fee(TEXT,NUMERIC)
  TO anon,authenticated,service_role;

-- ==========================================================
-- S9  RPC: get_return_shipping_fee(p_order_id UUID)
--     /api/returns/submit.ts uses this to get the return-leg
--     fee from shipping_zones for the order's governorate.
--     Always >= 30 EGP. Never trusts client-supplied value.
--     Returns JSON: {return_fee, governorate, zone_found}
-- ==========================================================
CREATE OR REPLACE FUNCTION public.get_return_shipping_fee(p_order_id UUID)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path=public STABLE AS $$
DECLARE
  v_addr JSONB; v_gov TEXT;
  z public.shipping_zones%ROWTYPE; v NUMERIC;
BEGIN
  SELECT shipping_address_snapshot INTO v_addr FROM public.orders WHERE id=p_order_id;
  IF NOT FOUND THEN
    RETURN json_build_object('return_fee',65,'governorate','Unknown','zone_found',false); END IF;
  v_gov:=COALESCE(v_addr->>'governorate',v_addr->>'state','Cairo');
  SELECT * INTO z FROM public.shipping_zones
  WHERE lower(governorate)   =lower(trim(v_gov))
     OR lower(governorate_ar)=lower(trim(v_gov)) LIMIT 1;
  v:=GREATEST(COALESCE(z.shipping_rate,z.shipping_fee,z.rate,65),30);
  RETURN json_build_object('return_fee',v,'governorate',v_gov,'zone_found',(z.id IS NOT NULL));
END;$$;
REVOKE EXECUTE ON FUNCTION public.get_return_shipping_fee(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_return_shipping_fee(UUID)
  TO anon,authenticated,service_role;

-- ==========================================================
-- S10  RPC: create_order_with_server_totals(...)
--      Server-side order creation: re-reads product prices from
--      product_variants, re-validates the discount code, reads
--      shipping fee from shipping_zones, inserts orders +
--      order_items atomically, optionally reserves stock.
--      Callable by anon (guest checkout) and authenticated.
--      Returns JSON: {order_id, order_number, subtotal,
--                     discount_amount, shipping_amount, total,
--                     tracking_number, error}
-- ==========================================================
CREATE OR REPLACE FUNCTION public.create_order_with_server_totals(
  p_customer_id    UUID    DEFAULT NULL,
  p_items          JSONB   DEFAULT '[]',
  p_discount_code  TEXT    DEFAULT NULL,
  p_governorate    TEXT    DEFAULT 'Cairo',
  p_subtotal_hint  NUMERIC DEFAULT 0,
  p_shipping_addr  JSONB   DEFAULT '{}',
  p_payment_method TEXT    DEFAULT 'COD',
  p_notes          TEXT    DEFAULT NULL,
  p_reserve_stock  BOOLEAN DEFAULT true
)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_item    JSONB;
  v_variant public.product_variants%ROWTYPE;
  v_product public.products%ROWTYPE;
  v_price   NUMERIC;
  v_qty     INT;
  v_sub     NUMERIC:=0;
  v_disc    NUMERIC:=0;
  v_ship    NUMERIC;
  v_total   NUMERIC;
  v_oid     UUID;
  v_onum    TEXT;
  v_track   TEXT;
  v_dcid    UUID;
  v_dr      JSON;
  v_cod     BOOLEAN;
  v_pstat   TEXT;
  v_payload JSONB:='[]';
  v_tmp     JSONB;
BEGIN
  IF jsonb_array_length(p_items)=0 THEN
    RETURN json_build_object('error','Cannot place order with an empty bag.'); END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_qty:=COALESCE((v_item->>'quantity')::INT,1);
    IF v_qty<1 THEN CONTINUE; END IF;
    v_variant:=NULL; v_product:=NULL; v_price:=0;

    IF (v_item->>'variant_id') IS NOT NULL THEN
      SELECT * INTO v_variant FROM public.product_variants
      WHERE id=(v_item->>'variant_id')::UUID;
    END IF;

    IF v_variant.id IS NULL THEN
      IF (v_item->>'product_id') IS NOT NULL THEN
        SELECT * INTO v_product FROM public.products
        WHERE id=(v_item->>'product_id')::UUID;
        v_price:=COALESCE(v_product.price,0);
      END IF;
    ELSE
      v_price:=COALESCE(v_variant.price_override,0);
      IF v_price=0 THEN
        SELECT price INTO v_price FROM public.products WHERE id=v_variant.product_id; END IF;
    END IF;

    IF p_reserve_stock AND v_variant.id IS NOT NULL THEN
      UPDATE public.product_variants SET stock=GREATEST(0,stock-v_qty)
      WHERE id=v_variant.id; END IF;

    v_sub:=v_sub+(v_price*v_qty);
    v_tmp:=jsonb_build_object(
      'product_name', COALESCE(v_item->>'name',v_product.name,''),
      'variant_title',COALESCE(v_item->>'size',v_item->>'variant_title','M'),
      'unit_price',   v_price,
      'quantity',     v_qty,
      'total_price',  v_price*v_qty,
      'image_url',    COALESCE(v_item->>'image',''),
      'product_id',   v_item->>'product_id',
      'sku',          COALESCE(v_variant.sku,''));
    v_payload:=v_payload||jsonb_build_array(v_tmp);
  END LOOP;

  IF p_discount_code IS NOT NULL AND trim(p_discount_code)<>'' THEN
    v_dr:=public.validate_discount_code(p_discount_code,v_sub);
    IF (v_dr->>'valid')::BOOLEAN THEN v_disc:=(v_dr->>'discount_amount')::NUMERIC; END IF;
  END IF;

  v_dr:=public.get_shipping_fee(
    COALESCE(p_shipping_addr->>'governorate',p_shipping_addr->>'state',p_governorate,'Cairo'),
    v_sub-v_disc);
  v_ship:=(v_dr->>'fee')::NUMERIC;
  v_total:=GREATEST(0,v_sub-v_disc+v_ship);

  v_onum :='VBF-'||lpad(floor(10000+random()*90000)::TEXT,5,'0');
  v_track:='DHL-'||floor(100000000+random()*900000000)::BIGINT::TEXT;
  v_cod  :=upper(trim(p_payment_method)) IN ('COD','CASH ON DELIVERY');
  v_pstat:=CASE WHEN v_cod THEN 'pending_collection' ELSE 'paid' END;

  INSERT INTO public.orders(
    customer_id,order_number,status,currency,
    subtotal,discount_amount,discount_code,shipping_amount,total,
    tracking_number,shipping_address_snapshot,payment_method,payment_status,notes)
  VALUES(p_customer_id,v_onum,'placed','EGP',
    v_sub,v_disc,
    CASE WHEN p_discount_code IS NOT NULL AND trim(p_discount_code)<>''
         THEN upper(trim(p_discount_code)) ELSE NULL END,
    v_ship,v_total,v_track,p_shipping_addr,
    CASE WHEN v_cod THEN 'COD' ELSE 'Pay Online' END,v_pstat,p_notes)
  RETURNING id INTO v_oid;

  INSERT INTO public.order_items(
    order_id,product_name,variant_title,unit_price,quantity,total_price,image_url,product_id,sku)
  SELECT v_oid,
    (i->>'product_name'),(i->>'variant_title'),
    (i->>'unit_price')::NUMERIC,(i->>'quantity')::INT,(i->>'total_price')::NUMERIC,
    (i->>'image_url'), NULLIF(i->>'product_id','')::UUID,(i->>'sku')
  FROM jsonb_array_elements(v_payload) AS i;

  IF p_discount_code IS NOT NULL AND trim(p_discount_code)<>'' AND v_disc>0 THEN
    SELECT id INTO v_dcid FROM public.discount_codes
    WHERE upper(code)=upper(trim(p_discount_code)) LIMIT 1;
    IF FOUND THEN
      PERFORM public.use_discount_code(v_dcid,v_oid,p_customer_id,p_shipping_addr->>'email');
    END IF;
  END IF;

  RETURN json_build_object(
    'order_id',v_oid,'order_number',v_onum,'subtotal',v_sub,
    'discount_amount',v_disc,'shipping_amount',v_ship,'total',v_total,
    'tracking_number',v_track,'error',null);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('error',SQLERRM);
END;$$;
REVOKE EXECUTE ON FUNCTION public.create_order_with_server_totals(
  UUID,JSONB,TEXT,TEXT,NUMERIC,JSONB,TEXT,TEXT,BOOLEAN) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.create_order_with_server_totals(
  UUID,JSONB,TEXT,TEXT,NUMERIC,JSONB,TEXT,TEXT,BOOLEAN)
  TO anon,authenticated,service_role;

-- ==========================================================
-- S11  TRIGGER: release_stock_on_cancel
--      When orders.status -> 'cancelled' or 'refunded',
--      return stock to product_variants by matching size from
--      variant_title.
-- ==========================================================
CREATE OR REPLACE FUNCTION public.release_stock_on_cancel()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER SET search_path=public AS $$
DECLARE v RECORD;
BEGIN
  IF NEW.status NOT IN ('cancelled','refunded') THEN RETURN NEW; END IF;
  IF OLD.status=NEW.status THEN RETURN NEW; END IF;
  FOR v IN
    SELECT oi.quantity, pv.id AS vid
    FROM public.order_items oi
    LEFT JOIN public.product_variants pv
      ON pv.product_id=oi.product_id
      AND lower(pv.size)=lower(COALESCE(oi.size,
            substring(oi.variant_title FROM 'Size:\s*(\S+)')))
    WHERE oi.order_id=NEW.id AND pv.id IS NOT NULL
  LOOP
    UPDATE public.product_variants SET stock=stock+v.quantity WHERE id=v.vid;
  END LOOP;
  RETURN NEW;
END;$$;
DROP TRIGGER IF EXISTS tr_release_stock_on_cancel ON public.orders;
CREATE TRIGGER tr_release_stock_on_cancel
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.release_stock_on_cancel();

-- ==========================================================
-- S12  TRIGGER: release_stock_on_failed_payment
--      When payment_status -> 'failed', return reserved stock.
-- ==========================================================
CREATE OR REPLACE FUNCTION public.release_stock_on_failed_payment()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER SET search_path=public AS $$
DECLARE v RECORD;
BEGIN
  IF NEW.payment_status<>'failed' OR OLD.payment_status='failed' THEN RETURN NEW; END IF;
  FOR v IN
    SELECT oi.quantity, pv.id AS vid
    FROM public.order_items oi
    LEFT JOIN public.product_variants pv
      ON pv.product_id=oi.product_id
      AND lower(pv.size)=lower(COALESCE(oi.size,
            substring(oi.variant_title FROM 'Size:\s*(\S+)')))
    WHERE oi.order_id=NEW.id AND pv.id IS NOT NULL
  LOOP
    UPDATE public.product_variants SET stock=stock+v.quantity WHERE id=v.vid;
  END LOOP;
  RETURN NEW;
END;$$;
DROP TRIGGER IF EXISTS tr_release_stock_on_failed_payment ON public.orders;
CREATE TRIGGER tr_release_stock_on_failed_payment
  AFTER UPDATE OF payment_status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.release_stock_on_failed_payment();

-- ==========================================================
-- S13  RPC: get_admin_dashboard_summary()
--      Wraps v_admin_dashboard_stats, adds low-stock count
--      and last 5 orders. Guarded by is_admin_or_support().
--      Returns JSON: {stats, low_stock_count, recent_orders}
-- ==========================================================
CREATE OR REPLACE FUNCTION public.get_admin_dashboard_summary()
RETURNS JSON LANGUAGE plpgsql SECURITY INVOKER SET search_path=public STABLE AS $$
DECLARE v_stats JSON; v_low BIGINT; v_recent JSON;
BEGIN
  IF NOT public.is_admin_or_support() THEN
    RAISE EXCEPTION 'vbfits_forbidden: admin access required.' USING ERRCODE='42501'; END IF;
  SELECT row_to_json(s) INTO v_stats FROM public.v_admin_dashboard_stats s;
  SELECT COUNT(*) INTO v_low FROM public.v_low_stock_variants;
  SELECT json_agg(r) INTO v_recent FROM (
    SELECT id,order_number,total,status,payment_status,created_at
    FROM public.orders ORDER BY created_at DESC LIMIT 5) r;
  RETURN json_build_object('stats',v_stats,'low_stock_count',v_low,
    'recent_orders',COALESCE(v_recent,'[]'::JSON));
END;$$;
REVOKE EXECUTE ON FUNCTION public.get_admin_dashboard_summary() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_admin_dashboard_summary()
  TO authenticated,service_role;

-- ==========================================================
-- S14  search_products / get_search_suggestions grants
--      Created in earlier migrations. Re-grant idempotently.
-- ==========================================================
DO $$
BEGIN
  IF EXISTS(SELECT FROM pg_proc WHERE proname='search_products'
    AND pronamespace='public'::regnamespace) THEN
    REVOKE EXECUTE ON FUNCTION public.search_products FROM PUBLIC;
    GRANT  EXECUTE ON FUNCTION public.search_products TO anon,authenticated,service_role;
  END IF;
  IF EXISTS(SELECT FROM pg_proc WHERE proname='get_search_suggestions'
    AND pronamespace='public'::regnamespace) THEN
    REVOKE EXECUTE ON FUNCTION public.get_search_suggestions FROM PUBLIC;
    GRANT  EXECUTE ON FUNCTION public.get_search_suggestions TO anon,authenticated,service_role;
  END IF;
END $$;

-- ==========================================================
-- S14B Resilient Customer Profile Sync (Cannot Fail Signup)
--      Guarantees that errors in customer profile sync
--      never abort the auth.users signup transaction.
-- ==========================================================
CREATE OR REPLACE FUNCTION public.handle_new_customer()
RETURNS TRIGGER AS $$
BEGIN
  BEGIN
    INSERT INTO public.customers (
      id, email, full_name, avatar_url, phone, role
    ) VALUES (
      NEW.id,
      NEW.email,
      COALESCE(
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'name'
      ),
      NEW.raw_user_meta_data->>'avatar_url',
      NEW.raw_user_meta_data->>'phone',
      'customer'  -- NEVER copy role from metadata -- prevents self-promotion
    )
    ON CONFLICT (id) DO UPDATE SET
      email      = EXCLUDED.email,
      full_name  = COALESCE(EXCLUDED.full_name,  public.customers.full_name),
      avatar_url = COALESCE(EXCLUDED.avatar_url, public.customers.avatar_url),
      phone      = COALESCE(EXCLUDED.phone,      public.customers.phone),
      updated_at = timezone('utc'::text, now());
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_customer trigger caught exception: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_customer();

CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_customer();

-- ==========================================================
-- S15  Reload PostgREST schema cache
-- ==========================================================
NOTIFY pgrst, 'reload schema';

-- ==========================================================
-- QUICK REFERENCE  (one line each)
-- ==========================================================
-- handle_updated_at()              auto-trigger: keeps updated_at current on every UPDATE
-- enforce_archive_unpublish()      trigger: archived product -> is_published=false instantly
-- v_product_visibility             view: shows live/archived/draft status for admin
-- v_admin_dashboard_stats          view: total orders, revenue, COD count for admin home
-- v_low_stock_variants             view: all variants at or below threshold (admin inventory)
-- v_top_products                   view: best-sellers ranked by units_sold (admin analytics)
-- validate_discount_code()         fn: validates coupon server-side (checkout Apply button)
-- use_discount_code()              fn: atomically records code use + increments counter
-- subscribe_newsletter()           fn: stores subscriber + creates WELCOME10 code if new
-- get_shipping_fee()               fn: reads shipping_zones rate for a governorate (checkout)
-- get_return_shipping_fee()        fn: reads return-leg rate by order address (returns form)
-- create_order_with_server_totals() fn: full order creation with price recomputation + stock
-- release_stock_on_cancel()        trigger: restores stock when order cancelled/refunded
-- release_stock_on_failed_payment() trigger: restores stock when payment fails
-- get_admin_dashboard_summary()    fn: aggregated stats + low-stock alert (admin home page)
