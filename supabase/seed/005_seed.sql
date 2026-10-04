-- ==============================================================================
-- VB FITS STUDIOS - PRODUCTION SEED DATA
-- File: supabase/seed/005_seed.sql
-- Description: Essential starting data for store launch (NO fake products).
-- Idempotency: Completely safe to re-run at any time (ON CONFLICT DO UPDATE / NOTHING).
-- ==============================================================================

BEGIN;

-- ==============================================================================
-- 1. EGYPTIAN GOVERNORATES & SHIPPING ZONES (ALL 27 GOVERNORATES)
-- ==============================================================================
-- Sensible defaults: Greater Cairo: 60 EGP, Delta/Canal: 65 EGP,
-- Upper Egypt: 75-80 EGP, Far/Frontier: 85-90 EGP. Free threshold: 1,500 EGP.

INSERT INTO public.shipping_zones (
  governorate,
  governorate_ar,
  min_days,
  max_days,
  cod_available,
  shipping_rate,
  free_shipping_threshold
) VALUES
  -- Greater Cairo Hub (Fastest: 2–4 days, COD Enabled)
  ('Cairo',           'القاهرة',        2, 4, true,  60.00, 1500.00),
  ('Giza',            'الجيزة',         2, 4, true,  60.00, 1500.00),
  ('Qalyubia',        'القليوبية',      2, 4, true,  60.00, 1500.00),

  -- Delta & Canal Zone (3–5 days, COD Enabled)
  ('Alexandria',      'الإسكندرية',     3, 5, true,  65.00, 1500.00),
  ('Sharqia',         'الشرقية',        3, 5, true,  65.00, 1500.00),
  ('Dakahlia',        'الدقهلية',       3, 5, true,  65.00, 1500.00),
  ('Gharbia',         'الغربية',        3, 5, true,  65.00, 1500.00),
  ('Monufia',         'المنوفية',       3, 5, true,  65.00, 1500.00),
  ('Ismailia',        'الإسماعيلية',    3, 5, true,  65.00, 1500.00),
  ('Suez',            'السويس',         3, 5, true,  65.00, 1500.00),
  ('Port Said',       'بورسعيد',        3, 5, true,  65.00, 1500.00),
  ('Faiyum',          'الفيوم',         3, 5, true,  65.00, 1500.00),

  -- Northern Delta (4–6 days, COD Enabled)
  ('Kafr El Sheikh',  'كفر الشيخ',      4, 6, true,  65.00, 1500.00),
  ('Beheira',         'البحيرة',        4, 6, true,  65.00, 1500.00),
  ('Damietta',        'دمياط',          4, 6, true,  65.00, 1500.00),

  -- Upper Egypt Central (4–7 days, COD Enabled)
  ('Beni Suef',       'بني سويف',       4, 7, true,  75.00, 1500.00),
  ('Minya',           'المنيا',         4, 7, true,  75.00, 1500.00),
  ('Asyut',           'أسيوط',          4, 7, true,  75.00, 1500.00),

  -- Upper Egypt South (4–7 days, Prepaid Only)
  ('Sohag',           'سوهاج',          4, 7, false, 80.00, 1500.00),
  ('Qena',            'قنا',            4, 7, false, 80.00, 1500.00),

  -- Far Upper Egypt & Frontier Zones (5–9 days, Prepaid Only)
  ('Luxor',           'الأقصر',         5, 7, false, 85.00, 1500.00),
  ('Aswan',           'أسوان',          5, 7, false, 85.00, 1500.00),
  ('Red Sea',         'البحر الأحمر',   5, 8, false, 85.00, 1500.00),
  ('Matruh',          'مطروح',          5, 8, false, 85.00, 1500.00),
  ('North Sinai',     'شمال سيناء',     5, 8, false, 90.00, 1500.00),
  ('South Sinai',     'جنوب سيناء',     5, 8, false, 90.00, 1500.00),
  ('New Valley',      'الوادي الجديد',  6, 9, false, 90.00, 1500.00)
ON CONFLICT (governorate) DO UPDATE SET
  governorate_ar          = EXCLUDED.governorate_ar,
  min_days                = EXCLUDED.min_days,
  max_days                = EXCLUDED.max_days,
  cod_available           = EXCLUDED.cod_available,
  shipping_rate           = EXCLUDED.shipping_rate,
  free_shipping_threshold = EXCLUDED.free_shipping_threshold;

-- Also update alias columns if they exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'shipping_zones' AND column_name = 'shipping_fee'
  ) THEN
    UPDATE public.shipping_zones SET shipping_fee = shipping_rate;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'shipping_zones' AND column_name = 'rate'
  ) THEN
    UPDATE public.shipping_zones SET rate = shipping_rate;
  END IF;
END $$;


-- ==============================================================================
-- 2. STORE SETTINGS (KEY-VALUE & LAUNCH GATE ENGINE)
-- ==============================================================================

-- 2.1 Store-wide Configuration & Brand Identity
INSERT INTO public.store_settings (key, value, updated_at) VALUES
(
  'store_info',
  jsonb_build_object(
    'store_name',           'VB Fits Studios',
    'brand_email',          'vbfitsstudios@gmail.com',
    'support_email',        'vbfitsstudios@gmail.com',
    'currency',             'EGP',
    'currency_symbol',      'EGP',
    'return_window_days',   14,
    'exchange_window_days', 14,
    'working_hours',        'Monday — Friday: 9:00 AM — 6:00 PM (Cairo Time), Saturday — Sunday: Closed',
    'working_hours_ar',     'من الإثنين إلى الجمعة: 9:00 صباحاً — 6:00 مساءً (بتوقيت القاهرة)، السبت والأحد: مغلق'
  ),
  timezone('utc'::text, now())
),
(
  'store_name',
  '"VB Fits Studios"'::jsonb,
  timezone('utc'::text, now())
),
(
  'brand_email',
  '"vbfitsstudios@gmail.com"'::jsonb,
  timezone('utc'::text, now())
),
(
  'currency',
  '"EGP"'::jsonb,
  timezone('utc'::text, now())
),
(
  'return_window',
  jsonb_build_object(
    'days', 14,
    'conditions', 'Unworn, unwashed, original tags attached, in luxury archive presentation box.'
  ),
  timezone('utc'::text, now())
),
(
  'working_hours',
  jsonb_build_object(
    'en', 'Monday — Friday: 9:00 AM — 6:00 PM EST',
    'ar', 'من الإثنين إلى الجمعة: 9:00 ص — 6:00 م'
  ),
  timezone('utc'::text, now())
),

-- 2.2 Free Shipping Threshold & COD Policy Rules
(
  'free_shipping_threshold',
  jsonb_build_object(
    'threshold', 1500.00,
    'currency', 'EGP',
    'label', 'Complimentary express shipping on all Egyptian orders over 1,500 EGP',
    'label_ar', 'شحن سريع مجاني لجميع الطلبات داخل مصر التي تتجاوز 1,500 ج.م'
  ),
  timezone('utc'::text, now())
),
(
  'cod_rules',
  jsonb_build_object(
    'enabled', true,
    'fee', 0.00,
    'eligible_zones', jsonb_build_array(
      'Cairo', 'Giza', 'Qalyubia', 'Alexandria', 'Sharqia', 'Dakahlia',
      'Gharbia', 'Monufia', 'Ismailia', 'Suez', 'Port Said', 'Faiyum',
      'Kafr El Sheikh', 'Beheira', 'Damietta', 'Beni Suef', 'Minya', 'Asyut'
    ),
    'restricted_zones', jsonb_build_array(
      'Sohag', 'Qena', 'Luxor', 'Aswan', 'Red Sea', 'Matruh',
      'North Sinai', 'South Sinai', 'New Valley'
    ),
    'note', 'Cash on Delivery is limited to supported governorates with courier verification.'
  ),
  timezone('utc'::text, now())
),

-- 2.3 WhatsApp Support Number Placeholder (Editable from Admin, Never Hardcoded)
(
  'whatsapp_support',
  jsonb_build_object(
    'phone_number', '+201000000000',
    'is_placeholder', true,
    'note', 'Placeholder support number. Update to official business phone number in Admin settings.'
  ),
  timezone('utc'::text, now())
),
(
  'contact_whatsapp',
  '"+201000000000"'::jsonb,
  timezone('utc'::text, now())
),

-- 2.4 Social Links (Left empty for admin to configure)
(
  'social_instagram',
  jsonb_build_object(
    'url', '',
    'handle', '',
    'is_active', true
  ),
  timezone('utc'::text, now())
),
(
  'social_tiktok',
  jsonb_build_object(
    'url', '',
    'handle', '',
    'is_active', true
  ),
  timezone('utc'::text, now())
),
(
  'social_whatsapp',
  jsonb_build_object(
    'url', '',
    'phone', '',
    'is_active', true
  ),
  timezone('utc'::text, now())
),
(
  'social_links',
  jsonb_build_object(
    'instagram', '',
    'tiktok', '',
    'whatsapp', ''
  ),
  timezone('utc'::text, now())
),

-- 2.5 Announcement Bar Settings
(
  'announcement_bar',
  jsonb_build_object(
    'enabled', true,
    'text', 'COMPLIMENTARY EXPRESS DELIVERY ON ALL ORDERS ABOVE 1,500 EGP · ATELIER DIRECT',
    'link', '/shop'
  ),
  timezone('utc'::text, now())
)
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = timezone('utc'::text, now());


-- ==============================================================================
-- 3. SITE SETTINGS & PRE-LAUNCH GATE CONTROLS
-- ==============================================================================

-- Ensure all extended columns exist on site_settings
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS countdown_gate_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS gate_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS countdown_strip_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS teaser_headline TEXT NOT NULL DEFAULT 'THE ARCHIVAL VAULT OPENS SOON',
  ADD COLUMN IF NOT EXISTS teaser_subtext TEXT NOT NULL DEFAULT 'SECURE EARLY ATELIER ACCESS & PRIVATE VIP DROP DISPATCHES',
  ADD COLUMN IF NOT EXISTS teaser_text TEXT NOT NULL DEFAULT 'THE ARCHIVAL VAULT OPENS SOON. SECURE EARLY ATELIER ACCESS.',
  ADD COLUMN IF NOT EXISTS countdown_strip_text TEXT NOT NULL DEFAULT 'OFFICIAL LAUNCH INCOMING · WORLDWIDE DROP',
  ADD COLUMN IF NOT EXISTS editorial_media_url TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS editorial_media_type TEXT DEFAULT 'image',
  ADD COLUMN IF NOT EXISTS social_proof_media_url TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS social_proof_media_type TEXT DEFAULT 'image',
  ADD COLUMN IF NOT EXISTS social_whatsapp_url TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS social_instagram_url TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS social_tiktok_url TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS credits_developer_name TEXT DEFAULT 'Khaled Ismail',
  ADD COLUMN IF NOT EXISTS credits_developer_url TEXT DEFAULT 'https://www.linkedin.com/in/khaled-ismail-27899a306',
  ADD COLUMN IF NOT EXISTS credits_agency_name TEXT DEFAULT 'ERTH',
  ADD COLUMN IF NOT EXISTS credits_agency_url TEXT DEFAULT 'https://www.linkedin.com/company/erth-%D8%A5%D8%B1%D8%AB/';

INSERT INTO public.site_settings (
  id,
  launch_at,
  countdown_gate_enabled,
  gate_enabled,
  countdown_strip_enabled,
  teaser_headline,
  teaser_subtext,
  teaser_text,
  countdown_strip_text,
  social_whatsapp_url,
  social_instagram_url,
  social_tiktok_url,
  credits_developer_name,
  credits_developer_url,
  credits_agency_name,
  credits_agency_url,
  updated_at
) VALUES (
  'current',
  '2026-10-10T00:00:00+03:00',
  true,
  true,
  true,
  'THE ARCHIVAL VAULT OPENS SOON',
  'SECURE EARLY ATELIER ACCESS & PRIVATE VIP DROP DISPATCHES',
  'THE ARCHIVAL VAULT OPENS SOON. SECURE EARLY ATELIER ACCESS.',
  'OFFICIAL LAUNCH INCOMING · WORLDWIDE DROP',
  '', -- Left empty for admin to fill
  '', -- Left empty for admin to fill
  '', -- Left empty for admin to fill
  'Khaled Ismail',
  'https://www.linkedin.com/in/khaled-ismail-27899a306',
  'ERTH',
  'https://www.linkedin.com/company/erth-%D8%A5%D8%B1%D8%AB/',
  timezone('utc'::text, now())
)
ON CONFLICT (id) DO UPDATE SET
  launch_at               = EXCLUDED.launch_at,
  countdown_gate_enabled  = EXCLUDED.countdown_gate_enabled,
  gate_enabled            = EXCLUDED.gate_enabled,
  countdown_strip_enabled = EXCLUDED.countdown_strip_enabled,
  teaser_headline         = EXCLUDED.teaser_headline,
  teaser_subtext          = EXCLUDED.teaser_subtext,
  teaser_text             = EXCLUDED.teaser_text,
  countdown_strip_text    = EXCLUDED.countdown_strip_text,
  updated_at              = timezone('utc'::text, now());


-- ==============================================================================
-- 4. OFFICIAL PRODUCT CATEGORIES
-- ==============================================================================

INSERT INTO public.categories (
  name,
  slug,
  description,
  image_url,
  display_order
) VALUES
  (
    'Long Sleeve',
    'long-sleeve',
    'Luxury ready-to-wear heavyweight long sleeve silhouettes with signature motifs.',
    '/assets/products/black-shirt.jpeg',
    1
  ),
  (
    'Tops & T-Shirts',
    'tops',
    'Heavyweight organic combed cotton tees with minimalist architectural silhouettes.',
    '/assets/products/white-shirt.jpeg',
    2
  ),
  (
    'Bottoms & Trousers',
    'bottoms',
    'Tailored street trousers, structured track pants, and refined oversized joggers.',
    '/assets/hero/hero.jpg',
    3
  ),
  (
    'Hoodies & Sweats',
    'hoodies',
    '360+ GSM custom-milled French terry hoodies and crewnecks with bespoke hardware.',
    '/assets/products/black-shirt.jpeg',
    4
  ),
  (
    'Accessories & Objects',
    'accessories',
    'Curated atelier accessories, archival headwear, and signature leather accents.',
    '/assets/hero/hero.jpg',
    5
  )
ON CONFLICT (slug) DO UPDATE SET
  name          = EXCLUDED.name,
  description   = EXCLUDED.description,
  image_url     = EXCLUDED.image_url,
  display_order = EXCLUDED.display_order;


-- ==============================================================================
-- 5. ATELIER COLOR PALETTE SPECIFICATION
-- ==============================================================================

-- 5.1 Ensure dedicated colors table exists
CREATE TABLE IF NOT EXISTS public.colors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  name_ar TEXT,
  hex TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.colors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "colors_public_read" ON public.colors;
CREATE POLICY "colors_public_read" ON public.colors FOR SELECT USING (true);

DROP POLICY IF EXISTS "colors_admin_write" ON public.colors;
CREATE POLICY "colors_admin_write" ON public.colors FOR ALL USING (public.is_admin_or_support());

GRANT SELECT ON public.colors TO anon, authenticated;
GRANT ALL ON public.colors TO authenticated;

-- 5.2 Seed official monochrome swatch palette with accurate hex codes
INSERT INTO public.colors (name, name_ar, hex, display_order, is_active) VALUES
  ('Washed Black',           'أسود مغسول',     '#111111', 1, true),
  ('Deep Charcoal',          'فحمي داكن',      '#222222', 2, true),
  ('Charcoal',               'فحمي كلاسيكي',   '#2A2A2A', 3, true),
  ('Deep Obsidian Charcoal', 'أوبسيديان فحمي', '#0E0E11', 4, true),
  ('Matte Obsidian',         'أوبسيديان مطفأ', '#0B0B0C', 5, true),
  ('Bone White',             'أبيض عاجي',      '#F2EFE9', 6, true),
  ('Bone',                   'بيج عظمي',       '#EBE7DF', 7, true),
  ('Optic White',            'أبيض ناصع',      '#F5F5F5', 8, true),
  ('Pure White',             'أبيض نقي',       '#FFFFFF', 9, true)
ON CONFLICT (name) DO UPDATE SET
  name_ar       = EXCLUDED.name_ar,
  hex           = EXCLUDED.hex,
  display_order = EXCLUDED.display_order,
  is_active     = EXCLUDED.is_active;

-- 5.3 Also sync into store_settings for universal client lookup
INSERT INTO public.store_settings (key, value, updated_at) VALUES
(
  'colors',
  jsonb_build_array(
    jsonb_build_object('name', 'Washed Black', 'name_ar', 'أسود مغسول', 'hex', '#111111'),
    jsonb_build_object('name', 'Deep Charcoal', 'name_ar', 'فحمي داكن', 'hex', '#222222'),
    jsonb_build_object('name', 'Charcoal', 'name_ar', 'فحمي كلاسيكي', 'hex', '#2A2A2A'),
    jsonb_build_object('name', 'Deep Obsidian Charcoal', 'name_ar', 'أوبسيديان فحمي', 'hex', '#0E0E11'),
    jsonb_build_object('name', 'Matte Obsidian', 'name_ar', 'أوبسيديان مطفأ', 'hex', '#0B0B0C'),
    jsonb_build_object('name', 'Bone White', 'name_ar', 'أبيض عاجي', 'hex', '#F2EFE9'),
    jsonb_build_object('name', 'Bone', 'name_ar', 'بيج عظمي', 'hex', '#EBE7DF'),
    jsonb_build_object('name', 'Optic White', 'name_ar', 'أبيض ناصع', 'hex', '#F5F5F5'),
    jsonb_build_object('name', 'Pure White', 'name_ar', 'أبيض نقي', 'hex', '#FFFFFF')
  ),
  timezone('utc'::text, now())
)
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = timezone('utc'::text, now());


-- ==============================================================================
-- 6. CHATBOT & FAQ KNOWLEDGE BASE (ENGLISH & ARABIC)
-- ==============================================================================

-- 6.1 Ensure unique constraint on question to guarantee safe re-runs
CREATE UNIQUE INDEX IF NOT EXISTS uq_chatbot_faqs_question ON public.chatbot_faqs (question);

-- 6.2 Category: Shipping & Delivery / الشحن والتوصيل
INSERT INTO public.chatbot_faqs (category, trigger_keywords, question, answer, display_order, is_active) VALUES
(
  'الشحن والتوصيل',
  ARRAY['شحن', 'delivery', 'توصيل', 'وصول', 'بياخد كام يوم', 'متى يوصل', 'موعد', 'تتوقع', 'وقت الشحن'],
  'كم يستغرق التوصيل داخل مصر؟',
  'التوصيل داخل القاهرة والجيزة والقليوبية: 2-4 أيام عمل. الإسكندرية ومحافظات الدلتا والقناة: 3-5 أيام عمل. محافظات الصعيد وسيناء والمحافظات الحدودية: 4-8 أيام عمل. يبدأ التجهيز فور تأكيد الطلب.',
  10, true
),
(
  'Shipping & Delivery',
  ARRAY['shipping', 'delivery', 'time', 'how long', 'transit', 'duration', 'arrive'],
  'How long does shipping take within Egypt?',
  'Cairo, Giza, and Qalyubia: 2–4 business days. Alexandria, Delta, and Canal: 3–5 business days. Upper Egypt, Sinai, and frontier governorates: 4–8 business days.',
  11, true
),
(
  'الشحن والتوصيل',
  ARRAY['رسوم شحن', 'تكلفة توصيل', 'شحن مجاني', 'free shipping', 'كم الشحن', 'توصيل بكام'],
  'هل يتوفر شحن مجاني؟ وما هي الرسوم؟',
  'نعم! نوفر شحناً سريعاً مجانياً على جميع الطلبات داخل جمهورية مصر العربية التي تتجاوز قيمتها 1,500 ج.م. للطلبات الأقل، تتراوح رسوم الشحن بين 60 إلى 90 ج.م حسب محافظتك وتظهر بوضوح قبل الدفع.',
  12, true
),
(
  'Shipping & Delivery',
  ARRAY['free shipping', 'cost', 'shipping fee', 'rates', 'threshold', 'delivery price'],
  'Is shipping free, and what are the rates?',
  'We offer complimentary express courier shipping on all domestic orders surpassing 1,500 EGP. For orders under 1,500 EGP, shipping rates range between 60 and 90 EGP depending on your governorate.',
  13, true
),
(
  'الشحن والتوصيل',
  ARRAY['خارج مصر', 'دولي', 'international', 'worldwide', 'شحن خارجي', 'دول الخليج'],
  'هل تشحنون خارج مصر؟',
  'نعم، نوفر خدمة الشحن الدولي لجميع دول العالم عبر شركائنا العالميين في الشحن السريع. يتم احتساب تكلفة الشحن ومواعيد الوصول تلقائياً عند تحديد دولة التوصيل أثناء إتمام الطلب.',
  14, true
),
(
  'Shipping & Delivery',
  ARRAY['international', 'worldwide', 'abroad', 'overseas', 'global', 'gulf'],
  'Do you ship internationally?',
  'Yes, we ship globally via express international couriers. International rates and estimated customs/transit windows are calculated at checkout based on destination country.',
  15, true
),

-- 6.3 Category: Payment & Checkout / الدفع والتحصيل
(
  'الدفع والطلبات',
  ARRAY['دفع', 'payment', 'طرق الدفع', 'كاش', 'كريدت', 'فيزا', 'cash', 'اونلاين', 'محفظة', 'فودافون'],
  'ما هي طرق الدفع المتاحة؟',
  'نقبل جميع البطاقات الائتمانية والخصم المباشر (فيزا وماستركارد وميزة)، الدفع عند الاستلام (COD) في المحافظات المدعومة، ومحافظ الدفع الإلكتروني. جميع العمليات الإلكترونية مؤمنة بنظام تشفير SSL البنكي.',
  20, true
),
(
  'Payment & Methods',
  ARRAY['payment', 'pay', 'visa', 'mastercard', 'meeza', 'credit card', 'debit card'],
  'What payment methods do you accept?',
  'We accept all major credit and debit cards (Visa, Mastercard, Meeza), Cash on Delivery (COD) in eligible governorates, and mobile electronic wallets. All online transactions are SSL encrypted.',
  21, true
),
(
  'الدفع والطلبات',
  ARRAY['الدفع عند الاستلام', 'COD', 'كاش عند الاستلام', 'بدفع لما يجي', 'دفع عند الباب'],
  'هل خيار الدفع عند الاستلام (COD) متاح في محافظتي؟',
  'يتوفر الدفع عند الاستلام في القاهرة الكبرى، الإسكندرية، محافظات الدلتا، القناة، وشمال الصعيد (بني سويف، المنيا، أسيوط). المحافظات النائية وجنوب الصعيد تتطلب الدفع الإلكتروني المسبق لضمان جدية التوصيل.',
  22, true
),
(
  'Payment & Methods',
  ARRAY['cod', 'cash on delivery', 'pay on arrival', 'doorstep'],
  'Is Cash on Delivery (COD) available for my location?',
  'Cash on Delivery is available across Greater Cairo, Alexandria, Delta, Canal, and Northern Upper Egypt. Southern Upper Egypt and remote frontier governorates require advance digital payment.',
  23, true
),

-- 6.4 Category: Returns & Exchanges / الإرجاع والاستبدال
(
  'الإرجاع والاستبدال',
  ARRAY['إرجاع', 'return', 'استرداد', 'عايز أرجع', 'بدل', 'refund', 'ارجع المنتج', 'مرتجع'],
  'ما هي شروط وسياسة الإرجاع؟',
  'نمنح عملاءنا فترة إرجاع واستبدال مجانية لمدة 14 يوماً من تاريخ استلام الشحنة. يُشترط أن تكون القطعة غير ملبوسة، غير مغسولة، ببطاقات العلامة الأصلية (Woven Labels & Security Tags) وداخل صندوق العرض الفاخر.',
  30, true
),
(
  'Returns & Exchanges',
  ARRAY['return', 'refund', 'exchange', 'policy', 'money back', 'send back'],
  'What is your return and exchange policy?',
  'We offer a 14-day return and exchange window from the date of delivery. Garments must be unworn, unwashed, in pristine original condition with all woven security tags and atelier packaging intact.',
  31, true
),
(
  'الإرجاع والاستبدال',
  ARRAY['كيف أرجع', 'طريقة الإرجاع', 'خطوات', 'طلب إرجاع', 'بدء إرجاع'],
  'كيف أقدم طلب إرجاع أو استبدال؟',
  'توجه إلى صفحة "تتبع الطلب" في الموقع، أدخل رقم طلبك والبريد الإلكتروني، ثم اختر "طلب إرجاع". حدد سبب الإرجاع وصور القطعة، وسيتولى مندوب الشحن استلامها خلال 48 ساعة لفحصها ورد مستحقاتك.',
  32, true
),
(
  'Returns & Exchanges',
  ARRAY['how to return', 'request return', 'start exchange', 'portal'],
  'How do I initiate a return or exchange request?',
  'Visit our "Track Order" portal, enter your Order Number and registered Email, then select "Request Return". Our concierge team will review and schedule courier collection within 48 hours.',
  33, true
),
(
  'الإرجاع والاستبدال',
  ARRAY['استرداد المبلغ', 'فلوس', 'كاش', 'money back', 'refund متى', 'امتى هاخد فلوسي'],
  'متى وكيف أسترد أموالي بعد الإرجاع؟',
  'بمجرد وصول القطعة لمقر الأتيليه وفحص جودتها (خلال 24-48 ساعة عمل)، يتم تحويل المبلغ بنفس وسيلة الدفع الأصلية (خلال 3-5 أيام عمل للبطاقات البنكية)، أو تحويل محفظة إلكترونية لطلبات الدفع عند الاستلام.',
  34, true
),
(
  'Returns & Exchanges',
  ARRAY['refund timing', 'when money', 'bank refund', 'payout'],
  'How and when will I receive my refund?',
  'Once inspected and approved by our atelier team (1–2 business days), refunds are credited to the original payment instrument within 3–5 banking days, or via mobile wallet for COD orders.',
  35, true
),

-- 6.5 Category: Sizes, Fit & Materials / المقاسات والمقاييس
(
  'المقاسات والمقاييس',
  ARRAY['مقاس', 'size', 'مقاسات', 'ازاي', 'قياس', 'بيفضل', 'ايه المقاس', 'كبير', 'صغير', 'جداول المقاسات'],
  'كيف أختار المقاس المناسب لي بدقة؟',
  'قطع VB Fits Studios مصممة بقصة Oversized معاصرة مستوحاة من أزياء الشارع الفاخرة مع أكتاف منسدلة (Dropped Shoulders). إذا كنت تفضل القصة الفضفاضة خذ مقاسك الطبيعي، أما إذا كنت تفضل مظهراً مضبوطاً (Tailored Fit) فاختر مقاساً أصغر.',
  40, true
),
(
  'Sizes & Craftsmanship',
  ARRAY['size guide', 'sizing', 'oversized', 'fit', 'measurement', 'chart'],
  'How do I choose the correct size and fit?',
  'All VB Fits Studios garments feature an architectural relaxed, oversized drop-shoulder silhouette. Choose your true size for the intended streetwear drape, or size down one size for a closer standard fit.',
  41, true
),
(
  'المقاسات والمقاييس',
  ARRAY['جودة', 'quality', 'قماش', 'خامة', 'material', 'cotton', 'قطن', 'gsm', 'وزن القماش'],
  'ما هي خامات القطع وأوزان الأقمشة المستخدمة؟',
  'نستخدم قطناً فرنسياً عضوي تيري (French Terry) عالي الكثافة بوزن يبدأ من 340 إلى 360 جرام/متر مربع (GSM)، معالجاً مسبقاً ضد الانكماش مع طباعة أرشيفية يدوية وتطريز صدري عالي الدقة.',
  42, true
),
(
  'Sizes & Craftsmanship',
  ARRAY['fabric', 'gsm', 'cotton', 'quality', 'material', 'terry', 'weight'],
  'What fabrics and weights are used in your garments?',
  'We engineer custom-milled 340 to 360 GSM heavyweight combed organic cotton and French terry. Pre-shrunk with vintage wash treatments and screenprinted using archival high-density inks.',
  43, true
),

-- 6.6 Category: Orders & Tracking / الطلبات وتتبع الشحنات
(
  'الطلبات وتتبع الشحنات',
  ARRAY['تتبع', 'track', 'tracking', 'رقم تتبع', 'أين طلبي', 'وين طلبي', 'track order', 'شحنتي'],
  'كيف أتتبع حالة طلبي ومكانه؟',
  'فور تجهيز الشحنة وتسليمها لمندوب التوصيل، تصلك رسالة تأكيد إلكترونية تحتوي على رقم التتبع المباشر. كما يمكنك الدخول على رابط "تتبع الطلب" أسفل الصفحة وإدخال رقم طلبك لمتابعة خط سير الشحنة لحظياً.',
  50, true
),
(
  'Orders & Tracking',
  ARRAY['track', 'order status', 'where is my order', 'tracking code', 'courier update'],
  'How do I track the status of my order?',
  'Live tracking telemetry is transmitted to your registered email upon courier handover. You can also visit our dedicated "Track Order" page and input your Order Number and Email for real-time milestones.',
  51, true
),
(
  'الطلبات وتتبع الشحنات',
  ARRAY['إلغاء', 'cancel', 'الغاء طلب', 'عايز الغي', 'تعديل عنوان', 'غلطت في العنوان'],
  'هل يمكنني تعديل أو إلغاء طلبي بعد تأكيده؟',
  'يمكن تعديل بيانات الشحن أو إلغاء الطلب خلال ساعتين فقط من إرساله وقبل دخوله مرحلة التجهيز بالأرشيف. يرجى التواصل فوراً مع خدمة العملاء عبر البريد vbfitsstudios@gmail.com أو عبر واتساب.',
  52, true
),
(
  'Orders & Tracking',
  ARRAY['cancel', 'modify order', 'change address', 'wrong phone', 'update order'],
  'Can I modify my shipping address or cancel my order?',
  'Orders can be modified or cancelled within 2 hours of placement before dispatch to warehouse fulfillment. Please contact concierge immediately at vbfitsstudios@gmail.com.',
  53, true
),
(
  'الطلبات وتتبع الشحنات',
  ARRAY['كود خصم', 'promo', 'coupon', 'discount', 'خصم', 'كوبون', 'أول طلب'],
  'كيف أستخدم كود الخصم الترحيبي؟',
  'سجل بريدك الإلكتروني في النشرة البريدية أسفل الموقع لتحصل فوراً على كود خصم 10% على أول طلب لك. ضع الكود في خانة "كود الخصم" أثناء الدفع وسيتم خصم القيمة تلقائياً من الإجمالي.',
  54, true
),
(
  'Orders & Tracking',
  ARRAY['coupon', 'discount code', 'promo', 'welcome code', 'newsletter discount'],
  'How do I apply my welcome promo code?',
  'Subscribe to our newsletter at the footer to receive a single-use 10% first-order discount code. Enter the code in the "Discount Code" field at checkout to apply the savings.',
  55, true
)
ON CONFLICT (question) DO UPDATE SET
  category         = EXCLUDED.category,
  trigger_keywords = EXCLUDED.trigger_keywords,
  answer           = EXCLUDED.answer,
  display_order    = EXCLUDED.display_order,
  is_active        = EXCLUDED.is_active;


-- ==============================================================================
-- 7. THE FOUR MANDATORY LEGAL & COMPLIANCE POLICY PAGES
-- ==============================================================================

-- 7.1 Ensure dedicated policy_pages table exists
CREATE TABLE IF NOT EXISTS public.policy_pages (
  slug TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  title_ar TEXT NOT NULL,
  content TEXT NOT NULL,
  content_ar TEXT NOT NULL,
  contact_email TEXT NOT NULL DEFAULT 'vbfitsstudios@gmail.com',
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.policy_pages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "policy_pages_public_read" ON public.policy_pages;
CREATE POLICY "policy_pages_public_read" ON public.policy_pages FOR SELECT USING (true);

DROP POLICY IF EXISTS "policy_pages_admin_write" ON public.policy_pages;
CREATE POLICY "policy_pages_admin_write" ON public.policy_pages FOR ALL USING (public.is_admin_or_support());

GRANT SELECT ON public.policy_pages TO anon, authenticated;
GRANT ALL ON public.policy_pages TO authenticated;

-- 7.2 Insert or update the 4 policies with official brand email
INSERT INTO public.policy_pages (
  slug,
  title,
  title_ar,
  content,
  content_ar,
  contact_email,
  is_active,
  updated_at
) VALUES
  (
    'legal',
    'Legal Notice',
    'الإشعار القانوني والملكية الفكرية',
    'All content, iconography, ornate sleeve artwork patterns, photography, typography, brand marks, and digital assets depicted on this website are the exclusive intellectual property of VB Fits Studios. Unauthorized reproduction, commercial distribution, imitation, or modification without prior written authorization is strictly prohibited under international copyright conventions and Egyptian IP laws. For inquiries or licensing, contact vbfitsstudios@gmail.com.',
    'كافة المحتويات، الرسومات، نقوش الأكمام الأرشيفية، الصور الفوتوغرافية، الخطوط، والعلامات التجارية المنشورة على هذا الموقع هي ملكية فكرية حصرية لـ VB Fits Studios. يُحظر تماماً أي نسخ، أو توزيع تجاري، أو تقليد، أو تعديل دون الحصول على موافقة خطية مسبقة بموجب قوانين حماية الملكية الفكرية المعمول بها محلياً ودولياً. للاستفسارات الرسمية: vbfitsstudios@gmail.com.',
    'vbfitsstudios@gmail.com',
    true,
    timezone('utc'::text, now())
  ),
  (
    'privacy',
    'Privacy Policy',
    'سياسة الخصوصية وأمان البيانات',
    'VB Fits Studios respects your absolute privacy. We collect only necessary client information (such as contact telemetry, delivery addresses, and encrypted payment confirmations) strictly required to execute orders and provide bespoke concierge client services. We never sell, rent, or distribute personal identity markers or client communication to unapproved third-party entities. All transaction communications are secured by 256-bit SSL encryption. For data privacy inquiries or deletion requests, contact vbfitsstudios@gmail.com.',
    'تلتزم VB Fits Studios باحترام خصوصيتك المطلقة. نحن نجمع فقط البيانات الضرورية (مثل بيانات الاتصال، عناوين التوصيل، وتأكيدات الدفع المشفرة) اللازمة لتنفيذ طلباتك وتقديم خدمات دعم العملاء الراقية. نحن لا نبيع أو نؤجر أو نشارك أي بيانات شخصية مع أي جهات خارجية غير معتمدة. جميع المعاملات مؤمنة بتشفير 256-bit SSL. لطلبات الاستفسار أو حذف البيانات، تواصل معنا عبر: vbfitsstudios@gmail.com.',
    'vbfitsstudios@gmail.com',
    true,
    timezone('utc'::text, now())
  ),
  (
    'refund',
    'Refund & Returns Policy',
    'سياسة الاستبدال والاسترجاع المالي',
    'We offer complimentary 14-day returns and exchanges on unworn, unwashed merchandise in pristine original condition with all internal woven labels, security tags, and luxury archival presentation packaging intact. Once authenticated and inspected by our atelier team within 1–2 business days of receipt, refunds are processed directly to the original payment instrument within 3–5 banking days, or via instant digital wallet payout for COD orders. Return courier collection is arranged directly via our online order tracking portal. For assistance, contact vbfitsstudios@gmail.com.',
    'نوفر فترة إرجاع واستبدال مجانية لمدة 14 يوماً من تاريخ استلام الشحنة لجميع القطع غير المستعملة وغير المغسولة وبحالتها الأصلية بكافة بطاقات العلامة وصندوق التغليف الفاخر. بعد فحص القطع من قبل فريق الجودة في الأتيليه خلال 1-2 يوم عمل، يتم تحويل المبلغ المسترد إلى وسيلة الدفع الأصلية خلال 3-5 أيام عمل بنكية، أو عبر المحافظ الإلكترونية لطلبات الدفع عند الاستلام. يتم حجز موعد استلام المرتجع عبر صفحة تتبع الطلبات. للدعم: vbfitsstudios@gmail.com.',
    'vbfitsstudios@gmail.com',
    true,
    timezone('utc'::text, now())
  ),
  (
    'terms',
    'Terms of Service',
    'شروط الخدمة والبيع',
    'By accessing, browsing, or purchasing from VB Fits Studios, you agree to comply with our Terms of Service, applicable commercial regulations, and fair-use conditions. All catalog prices are stated in Egyptian Pounds (EGP). Orders are subject to stock availability and address verification. We reserve the right to limit quantities or cancel orders placed with unauthorized promotional anomalies. All commercial transactions are governed by the commercial laws of the Arab Republic of Egypt. For contractual correspondence, contact vbfitsstudios@gmail.com.',
    'باستخدامك أو شرائك من موقع VB Fits Studios، فإنك توافق على الالتزام بشروط الخدمة واللوائح التجارية وشروط الاستخدام العادل. جميع أسعار الكتالوج معلنة بالجنيه المصري (EGP). تخضع الطلبات لتوفر المخزون والتحقق من العنوان. نحتفظ بالحق في تحديد الكميات أو إلغاء الطلبات غير المتوافقة مع الشروط. تخضع المعاملات التجارية لقوانين التجارة المعمول بها في جمهورية مصر العربية. للمراسلات الرسمية: vbfitsstudios@gmail.com.',
    'vbfitsstudios@gmail.com',
    true,
    timezone('utc'::text, now())
  )
ON CONFLICT (slug) DO UPDATE SET
  title         = EXCLUDED.title,
  title_ar      = EXCLUDED.title_ar,
  content       = EXCLUDED.content,
  content_ar    = EXCLUDED.content_ar,
  contact_email = EXCLUDED.contact_email,
  is_active     = EXCLUDED.is_active,
  updated_at    = timezone('utc'::text, now());

-- 7.3 Also dual-sync policies into store_settings for instant client JSON consumption
INSERT INTO public.store_settings (key, value, updated_at) VALUES
(
  'policy_pages',
  jsonb_build_object(
    'legal_notice', jsonb_build_object(
      'title', 'Legal Notice',
      'title_ar', 'الإشعار القانوني',
      'contact_email', 'vbfitsstudios@gmail.com',
      'summary', 'Exclusive intellectual property of VB Fits Studios. Unauthorized reproduction prohibited.'
    ),
    'privacy_policy', jsonb_build_object(
      'title', 'Privacy Policy',
      'title_ar', 'سياسة الخصوصية',
      'contact_email', 'vbfitsstudios@gmail.com',
      'summary', 'Strict confidentiality. SSL encrypted payments. Zero personal data sharing.'
    ),
    'refund_policy', jsonb_build_object(
      'title', 'Refund & Returns Policy',
      'title_ar', 'سياسة الاسترجاع والاسترداد',
      'contact_email', 'vbfitsstudios@gmail.com',
      'summary', '14-day hassle-free returns on unworn items with tags. Payout within 3-5 banking days.'
    ),
    'terms_of_service', jsonb_build_object(
      'title', 'Terms of Service',
      'title_ar', 'شروط الخدمة',
      'contact_email', 'vbfitsstudios@gmail.com',
      'summary', 'Official retail conditions in Egyptian Pounds (EGP) under Egyptian commercial law.'
    )
  ),
  timezone('utc'::text, now())
)
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = timezone('utc'::text, now());

COMMIT;

-- Reload Supabase PostgREST schema cache to immediately reflect all updates
NOTIFY pgrst, 'reload schema';
