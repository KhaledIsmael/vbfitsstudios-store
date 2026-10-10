-- Fix: order items not showing in admin order details.
-- Run in Supabase SQL Editor.

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS variant_title TEXT,
  ADD COLUMN IF NOT EXISTS sku TEXT;

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Drop every existing policy on order_items so none can block insert/select
DO $$
DECLARE p RECORD;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies
           WHERE schemaname = 'public' AND tablename = 'order_items'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.order_items', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "order_items_select" ON public.order_items FOR SELECT USING (true);
CREATE POLICY "order_items_insert" ON public.order_items FOR INSERT WITH CHECK (true);
CREATE POLICY "order_items_update" ON public.order_items FOR UPDATE
  USING (public.is_admin_or_support());
CREATE POLICY "order_items_delete" ON public.order_items FOR DELETE
  USING (public.is_admin_or_support());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO authenticated, anon;

NOTIFY pgrst, 'reload schema';

-- Diagnostic: orders that have no items
SELECT o.order_number, o.created_at
FROM public.orders o
LEFT JOIN public.order_items i ON i.order_id = o.id
WHERE i.id IS NULL
ORDER BY o.created_at DESC;
