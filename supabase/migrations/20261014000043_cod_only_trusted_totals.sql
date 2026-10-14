-- ============================================================================
-- 20261014000043_cod_only_trusted_totals.sql
--
-- Scope (strictly limited to the requested tasks):
--   Task 3  Cash on Delivery is the only payment method for NEW orders.
--           COD-disabled governorates are rejected (existing cod_available flag).
--   Task 4  Promo codes: case-insensitive uniqueness, authoritative validation
--           (no discount can exceed the subtotal), usage counting.
--   Task 5  Free-shipping threshold removed; the configured zone rate is always
--           charged. Order totals are computed by the database, not the client.
--
-- NOT touched: existing rows' prices/rates/discount rules, historical orders,
-- shipping_zones data (the legacy free_shipping_threshold column is left in
-- place but is no longer read), Paymob integration code, RLS policies.
--
-- Review before applying. Do NOT run against production without approval.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Promo codes: normalised, case-insensitive uniqueness (safe for old data)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.discount_codes
    GROUP BY upper(trim(code)) HAVING count(*) > 1
  ) THEN
    RAISE NOTICE 'discount_codes has codes that differ only by case/whitespace; '
                 'skipping normalisation + unique index. Resolve duplicates manually.';
  ELSE
    UPDATE public.discount_codes
       SET code = upper(trim(code))
     WHERE code <> upper(trim(code));
    CREATE UNIQUE INDEX IF NOT EXISTS uq_discount_codes_code_upper
      ON public.discount_codes (upper(code));
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2. Shipping: no free-shipping threshold. Same signature + JSON keys as before.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_shipping_fee(
  p_governorate TEXT, p_subtotal NUMERIC DEFAULT 0)
RETURNS JSON LANGUAGE plpgsql SECURITY INVOKER SET search_path=public STABLE AS $$
DECLARE
  z public.shipping_zones%ROWTYPE;
  v NUMERIC;
BEGIN
  SELECT * INTO z FROM public.shipping_zones
   WHERE lower(governorate)    = lower(trim(p_governorate))
      OR lower(governorate_ar) = lower(trim(p_governorate)) LIMIT 1;
  IF NOT FOUND THEN
    RETURN json_build_object('fee',65,'is_free',false,'shipping_rate',65,
      'free_shipping_threshold',null,'zone_id',null,
      'min_days',3,'max_days',7,'cod_available',true);
  END IF;
  v := COALESCE((to_jsonb(z)->>'shipping_rate')::NUMERIC,
                (to_jsonb(z)->>'shipping_fee')::NUMERIC,
                (to_jsonb(z)->>'rate')::NUMERIC, 65);
  RETURN json_build_object(
    'fee',v,'is_free',false,'shipping_rate',v,
    'free_shipping_threshold',null,'zone_id',z.id,
    'min_days',z.min_days,'max_days',z.max_days,'cod_available',z.cod_available);
END;$$;

-- ----------------------------------------------------------------------------
-- 3. Promo validation preview used by checkout: discount can never exceed
--    the subtotal (the previous percentage branch had no cap).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_discount_code(
  p_code TEXT, p_subtotal NUMERIC)
RETURNS JSON LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE
  r public.discount_codes%ROWTYPE;
  v NUMERIC := 0;
BEGIN
  p_code := upper(trim(p_code));
  SELECT * INTO r FROM public.discount_codes WHERE upper(code) = p_code;
  IF NOT FOUND THEN RETURN json_build_object('valid',false,'discount_amount',0,
    'message','Invalid or unrecognized coupon code.'); END IF;
  IF NOT r.is_active THEN RETURN json_build_object('valid',false,'discount_amount',0,
    'message','This coupon code is currently disabled.'); END IF;
  IF r.starts_at > now() THEN RETURN json_build_object('valid',false,'discount_amount',0,
    'message','This promotion has not started yet.'); END IF;
  IF r.expires_at IS NOT NULL AND r.expires_at < now() THEN
    RETURN json_build_object('valid',false,'discount_amount',0,
    'message','This coupon code has expired.'); END IF;
  IF r.max_uses IS NOT NULL AND r.times_used >= r.max_uses THEN
    RETURN json_build_object('valid',false,'discount_amount',0,
    'message','This coupon code has reached its usage limit.'); END IF;
  IF COALESCE(r.min_spend,0) > 0 AND p_subtotal < r.min_spend THEN
    RETURN json_build_object('valid',false,'discount_amount',0,
    'message',format('Requires a minimum cart spend of EGP %s.',
      to_char(r.min_spend,'FM999,999.00'))); END IF;
  IF r.discount_type = 'percentage' THEN
    v := round((p_subtotal * r.discount_value / 100)::NUMERIC, 2);
  ELSE
    v := r.discount_value;
  END IF;
  v := LEAST(p_subtotal, v);
  RETURN json_build_object(
    'valid',true,'discount_amount',v,
    'message',CASE r.discount_type WHEN 'percentage'
      THEN format('Promotion applied: %s%% savings.',r.discount_value)
      ELSE format('Promotion applied: EGP %s discount.',r.discount_value) END,
    'discount_type',r.discount_type,'discount_value',r.discount_value,
    'code_id',r.id,'min_spend',r.min_spend);
END;$$;

-- ----------------------------------------------------------------------------
-- 4. Internal promo calculator used by the order triggers (raises on invalid).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._order_promo_discount(
  p_code TEXT, p_subtotal NUMERIC, p_check_usage BOOLEAN)
RETURNS TABLE (code_id UUID, code TEXT, amount NUMERIC)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.discount_codes%ROWTYPE; v NUMERIC;
BEGIN
  SELECT * INTO r FROM public.discount_codes
   WHERE upper(discount_codes.code) = upper(trim(p_code)) FOR UPDATE;
  IF NOT FOUND OR NOT r.is_active THEN
    RAISE EXCEPTION 'Invalid or inactive promo code.' USING ERRCODE='P0001'; END IF;
  IF r.starts_at > now() THEN
    RAISE EXCEPTION 'This promotion has not started yet.' USING ERRCODE='P0001'; END IF;
  IF r.expires_at IS NOT NULL AND r.expires_at < now() THEN
    RAISE EXCEPTION 'This promo code has expired.' USING ERRCODE='P0001'; END IF;
  IF p_check_usage AND r.max_uses IS NOT NULL AND r.times_used >= r.max_uses THEN
    RAISE EXCEPTION 'This promo code has reached its usage limit.' USING ERRCODE='P0001'; END IF;
  IF COALESCE(r.min_spend,0) > 0 AND p_subtotal < r.min_spend THEN
    RAISE EXCEPTION 'Order does not meet the promo code minimum spend.' USING ERRCODE='P0001'; END IF;
  IF r.discount_type = 'percentage' THEN
    v := round((p_subtotal * r.discount_value / 100)::NUMERIC, 2);
  ELSE
    v := r.discount_value;
  END IF;
  RETURN QUERY SELECT r.id, r.code, GREATEST(0, LEAST(p_subtotal, v));
END;$$;
REVOKE EXECUTE ON FUNCTION public._order_promo_discount(TEXT,NUMERIC,BOOLEAN) FROM PUBLIC;

-- ----------------------------------------------------------------------------
-- 5. orders BEFORE INSERT: COD only, COD-zone check, trusted shipping/discount/total
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_order_cod_and_pricing()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  z    public.shipping_zones%ROWTYPE;
  gov  TEXT;
  ship NUMERIC := 65;           -- same last-resort fallback as get_shipping_fee()
  p    RECORD;
BEGIN
  -- Payment: only Cash on Delivery is accepted for new orders.
  IF NEW.payment_method IS NULL THEN NEW.payment_method := 'COD'; END IF;
  IF upper(trim(NEW.payment_method)) NOT IN ('COD','CASH ON DELIVERY') THEN
    RAISE EXCEPTION 'Only Cash on Delivery is available for new orders.' USING ERRCODE='P0001';
  END IF;
  NEW.payment_method := 'COD';

  -- Shipping: configured zone rate, always charged.
  gov := COALESCE(NEW.shipping_address_snapshot->>'governorate',
                  NEW.shipping_address_snapshot->>'state', '');
  SELECT * INTO z FROM public.shipping_zones
   WHERE lower(governorate)    = lower(trim(gov))
      OR lower(governorate_ar) = lower(trim(gov)) LIMIT 1;
  IF FOUND THEN
    IF z.cod_available IS NOT TRUE THEN
      RAISE EXCEPTION 'Cash on Delivery is unavailable for %.', gov USING ERRCODE='P0001';
    END IF;
    ship := COALESCE((to_jsonb(z)->>'shipping_rate')::NUMERIC,
                     (to_jsonb(z)->>'shipping_fee')::NUMERIC,
                     (to_jsonb(z)->>'rate')::NUMERIC, 65);
  END IF;
  NEW.shipping_amount := ship;

  -- Discount: recomputed from the discount_codes table; client value ignored.
  IF NEW.discount_code IS NOT NULL AND trim(NEW.discount_code) <> '' THEN
    SELECT * INTO p FROM public._order_promo_discount(NEW.discount_code, NEW.subtotal, true);
    NEW.discount_code    := p.code;
    NEW.discount_code_id := p.code_id;
    NEW.discount_amount  := p.amount;
  ELSE
    NEW.discount_code    := NULL;
    NEW.discount_code_id := NULL;
    NEW.discount_amount  := 0;
  END IF;

  NEW.total := GREATEST(0, NEW.subtotal - NEW.discount_amount + NEW.shipping_amount);
  RETURN NEW;
END;$$;

DROP TRIGGER IF EXISTS tr_enforce_order_cod_and_pricing ON public.orders;
CREATE TRIGGER tr_enforce_order_cod_and_pricing
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.enforce_order_cod_and_pricing();

-- ----------------------------------------------------------------------------
-- 6. orders AFTER INSERT: count promo usage (times_used / used_count + audit row)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_order_promo_use()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.discount_code_id IS NOT NULL THEN
    UPDATE public.discount_codes
       SET times_used = times_used + 1,
           used_count = COALESCE(used_count,0) + 1
     WHERE id = NEW.discount_code_id;
    INSERT INTO public.discount_code_uses(discount_code_id, order_id, customer_id)
    VALUES (NEW.discount_code_id, NEW.id, NEW.customer_id);
  END IF;
  RETURN NEW;
END;$$;

DROP TRIGGER IF EXISTS tr_record_order_promo_use ON public.orders;
CREATE TRIGGER tr_record_order_promo_use
  AFTER INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.record_order_promo_use();

-- ----------------------------------------------------------------------------
-- 7. order_items: line total = unit_price * quantity; then re-derive the order
--    totals from the stored items (only for orders created in the last 15 min,
--    so historical orders are never recalculated).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.normalize_order_item_total()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.total_price := round(NEW.unit_price * NEW.quantity, 2);
  RETURN NEW;
END;$$;

DROP TRIGGER IF EXISTS tr_normalize_order_item_total ON public.order_items;
CREATE TRIGGER tr_normalize_order_item_total
  BEFORE INSERT ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.normalize_order_item_total();

CREATE OR REPLACE FUNCTION public.recompute_order_totals_after_item()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  o    public.orders%ROWTYPE;
  sub  NUMERIC;
  disc NUMERIC := 0;
  p    RECORD;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id = NEW.order_id FOR UPDATE;
  IF NOT FOUND OR o.created_at < now() - INTERVAL '15 minutes' THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM(total_price),0) INTO sub FROM public.order_items WHERE order_id = o.id;

  IF o.discount_code_id IS NOT NULL THEN
    SELECT * INTO p FROM public._order_promo_discount(o.discount_code, sub, false);
    disc := p.amount;
  END IF;

  PERFORM set_config('app.order_pricing_internal','1',true);
  UPDATE public.orders
     SET subtotal        = sub,
         discount_amount = disc,
         total           = GREATEST(0, sub - disc + o.shipping_amount)
   WHERE id = o.id;
  PERFORM set_config('app.order_pricing_internal','',true);
  RETURN NEW;
END;$$;

DROP TRIGGER IF EXISTS tr_recompute_order_totals_after_item ON public.order_items;
CREATE TRIGGER tr_recompute_order_totals_after_item
  AFTER INSERT ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.recompute_order_totals_after_item();

-- ----------------------------------------------------------------------------
-- 8. orders BEFORE UPDATE: browsers (anon/authenticated, non-admin) cannot edit
--    the money fields of an order after creation. Admins, service_role and
--    direct SQL are unaffected. payment_method may only be set to COD
--    (needed by the existing "convert to COD" flow).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_order_financial_updates()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF current_setting('app.order_pricing_internal', true) = '1' THEN RETURN NEW; END IF;
  IF COALESCE(auth.role(),'') NOT IN ('anon','authenticated') THEN RETURN NEW; END IF;
  IF public.is_admin_or_support() THEN RETURN NEW; END IF;

  IF NEW.subtotal        IS DISTINCT FROM OLD.subtotal
  OR NEW.discount_amount IS DISTINCT FROM OLD.discount_amount
  OR NEW.shipping_amount IS DISTINCT FROM OLD.shipping_amount
  OR NEW.total           IS DISTINCT FROM OLD.total
  OR NEW.discount_code   IS DISTINCT FROM OLD.discount_code THEN
    RAISE EXCEPTION 'Order totals cannot be modified.' USING ERRCODE='P0001';
  END IF;

  IF NEW.payment_method IS DISTINCT FROM OLD.payment_method
     AND upper(COALESCE(NEW.payment_method,'')) NOT IN ('COD','CASH ON DELIVERY') THEN
    RAISE EXCEPTION 'Only Cash on Delivery is available.' USING ERRCODE='P0001';
  END IF;
  RETURN NEW;
END;$$;

DROP TRIGGER IF EXISTS tr_guard_order_financial_updates ON public.orders;
CREATE TRIGGER tr_guard_order_financial_updates
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.guard_order_financial_updates();
