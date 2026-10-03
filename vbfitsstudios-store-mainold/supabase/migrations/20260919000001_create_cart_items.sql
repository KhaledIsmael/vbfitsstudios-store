-- ==============================================================================
-- VB FITS STUDIOS - CART ITEMS TABLE & ROW-LEVEL SECURITY
-- Migration: 20260919000001_create_cart_items.sql
-- Description: Synced shopping bag table for authenticated clients
-- ==============================================================================

-- 1. Create cart_items table
CREATE TABLE IF NOT EXISTS public.cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  name TEXT NOT NULL,
  size TEXT NOT NULL,
  price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  currency TEXT NOT NULL DEFAULT '$',
  image TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_cart_user_product_size UNIQUE (user_id, product_id, size)
);

-- 2. Trigger for updated_at
DROP TRIGGER IF EXISTS tr_cart_items_updated_at ON public.cart_items;
CREATE TRIGGER tr_cart_items_updated_at
  BEFORE UPDATE ON public.cart_items
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 3. Performance Index
CREATE INDEX IF NOT EXISTS idx_cart_items_user_id ON public.cart_items(user_id);

-- 4. Enable Row-Level Security (RLS)
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies: Authenticated users can only read/write their own items
DROP POLICY IF EXISTS "Users can view own cart items" ON public.cart_items;
CREATE POLICY "Users can view own cart items"
  ON public.cart_items FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own cart items" ON public.cart_items;
CREATE POLICY "Users can insert own cart items"
  ON public.cart_items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own cart items" ON public.cart_items;
CREATE POLICY "Users can update own cart items"
  ON public.cart_items FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own cart items" ON public.cart_items;
CREATE POLICY "Users can delete own cart items"
  ON public.cart_items FOR DELETE
  USING (auth.uid() = user_id);

-- 6. Grant Permissions to authenticated role
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cart_items TO authenticated;
