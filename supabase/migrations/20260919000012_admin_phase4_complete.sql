-- =============================================================================
-- Migration 20260919000012: Phase 4 Complete Back-office Suite
-- Tables: discount_codes, newsletter_subscribers, store_settings
-- Enhancements: shipping_zones rate column, return_requests staff management
-- =============================================================================

-- 1. DISCOUNT CODES (Coupons & Promotions)
CREATE TABLE IF NOT EXISTS public.discount_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value NUMERIC(10, 2) NOT NULL CHECK (discount_value > 0),
  min_spend NUMERIC(10, 2) DEFAULT 0 CHECK (min_spend >= 0),
  max_uses INT DEFAULT NULL,
  times_used INT NOT NULL DEFAULT 0,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  expires_at TIMESTAMPTZ DEFAULT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_discount_codes_code ON public.discount_codes(code);

-- Seed luxury launch discount codes
INSERT INTO public.discount_codes (code, discount_type, discount_value, min_spend, max_uses, is_active)
VALUES
  ('WELCOME10', 'percentage', 10.00, 0, 1000, true),
  ('VIP20', 'percentage', 20.00, 250.00, 500, true),
  ('ATELIER50', 'fixed', 50.00, 300.00, 200, true)
ON CONFLICT (code) DO NOTHING;

-- 2. NEWSLETTER SUBSCRIBERS
CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL DEFAULT 'footer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_email ON public.newsletter_subscribers(email);

-- Seed initial newsletter subscribers
INSERT INTO public.newsletter_subscribers (email, source)
VALUES
  ('yasmine.fahmy@artscouncil.eg', 'footer'),
  ('k.mansour@cairoatelier.eg', 'checkout'),
  ('nour.sherif@fashionhouse.com', 'footer')
ON CONFLICT (email) DO NOTHING;

-- 3. STORE SETTINGS (Key-Value for Announcement Bar & Store-wide Configurations)
CREATE TABLE IF NOT EXISTS public.store_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Seed default announcement bar settings
INSERT INTO public.store_settings (key, value)
VALUES (
  'announcement_bar',
  '{"enabled": true, "text": "COMPLIMENTARY EXPRESS DELIVERY ON ALL ORDERS ABOVE $200 · CAIRO & GIZA HUB", "link": "/shop"}'::jsonb
) ON CONFLICT (key) DO NOTHING;

-- 4. SHIPPING ZONES: Ensure shipping_rate column exists
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'shipping_zones') THEN
    IF NOT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'shipping_zones' AND column_name = 'shipping_rate'
    ) THEN
      ALTER TABLE public.shipping_zones ADD COLUMN shipping_rate NUMERIC(10, 2) NOT NULL DEFAULT 15.00;
    END IF;
  ELSE
    CREATE TABLE public.shipping_zones (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      governorate TEXT NOT NULL UNIQUE,
      governorate_ar TEXT,
      min_days INT NOT NULL,
      max_days INT NOT NULL,
      cod_available BOOLEAN NOT NULL DEFAULT true,
      shipping_rate NUMERIC(10, 2) NOT NULL DEFAULT 15.00,
      created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
    );
  END IF;
END $$;

-- 5. RLS POLICIES

-- Discount codes: Public can select active codes; Staff can manage all
ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can check active discount codes" ON public.discount_codes;
CREATE POLICY "Public can check active discount codes"
  ON public.discount_codes FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "Staff can manage discount codes" ON public.discount_codes;
CREATE POLICY "Staff can manage discount codes"
  ON public.discount_codes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = auth.uid() AND c.role IN ('admin', 'support')
    )
  );

-- Newsletter subscribers: Public can insert; Staff can view/delete
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can subscribe to newsletter" ON public.newsletter_subscribers;
CREATE POLICY "Public can subscribe to newsletter"
  ON public.newsletter_subscribers FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Staff can view and manage subscribers" ON public.newsletter_subscribers;
CREATE POLICY "Staff can view and manage subscribers"
  ON public.newsletter_subscribers FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = auth.uid() AND c.role IN ('admin', 'support')
    )
  );

-- Store settings: Public can read; Staff can update
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view store settings" ON public.store_settings;
CREATE POLICY "Public can view store settings"
  ON public.store_settings FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Staff can update store settings" ON public.store_settings;
CREATE POLICY "Staff can update store settings"
  ON public.store_settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = auth.uid() AND c.role IN ('admin', 'support')
    )
  );

-- Shipping zones: Staff can update shipping zones
ALTER TABLE public.shipping_zones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read shipping zones" ON public.shipping_zones;
CREATE POLICY "Public can read shipping zones"
  ON public.shipping_zones FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Staff can update shipping zones" ON public.shipping_zones;
CREATE POLICY "Staff can update shipping zones"
  ON public.shipping_zones FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = auth.uid() AND c.role IN ('admin', 'support')
    )
  );

-- Return requests: Staff can update return requests
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'return_requests') THEN
    ALTER TABLE public.return_requests ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Staff can update return requests" ON public.return_requests;
    CREATE POLICY "Staff can update return requests"
      ON public.return_requests FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM public.customers c
          WHERE c.id = auth.uid() AND c.role IN ('admin', 'support')
        )
      );
  END IF;
END $$;
