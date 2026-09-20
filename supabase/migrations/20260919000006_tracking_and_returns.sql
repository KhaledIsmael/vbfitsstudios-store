-- ==============================================================================
-- VB FITS STUDIOS
-- Migration: 20260919000006_tracking_and_returns.sql
-- Adds: delivered_at timestamp to orders, return_requests table, extended status
-- ==============================================================================

-- 1. Add delivered_at + status values to orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

-- Extend status constraint to include all pipeline stages
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check CHECK (
  LOWER(status) IN (
    'placed',
    'pending',
    'confirmed',
    'packed',
    'processing',
    'shipped',
    'in_transit',
    'out_for_delivery',
    'delivered',
    'cancelled',
    'refunded'
  )
);

-- 2. Create return_requests table
CREATE TABLE IF NOT EXISTS public.return_requests (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  customer_id  UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  reason       TEXT NOT NULL CHECK (reason IN (
    'wrong_size',
    'wrong_item',
    'damaged',
    'not_as_described',
    'changed_mind',
    'other'
  )),
  reason_note  TEXT,
  -- JSONB array of {order_item_id, name, size, quantity_to_return}
  items        JSONB NOT NULL DEFAULT '[]'::jsonb,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'approved', 'rejected', 'collected', 'refunded'
  )),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

DROP TRIGGER IF EXISTS tr_return_requests_updated_at ON public.return_requests;
CREATE TRIGGER tr_return_requests_updated_at
  BEFORE UPDATE ON public.return_requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 3. Row-Level Security for return_requests
ALTER TABLE public.return_requests ENABLE ROW LEVEL SECURITY;

-- Authenticated customers can insert their own return requests
DROP POLICY IF EXISTS "Customers can create return requests" ON public.return_requests;
CREATE POLICY "Customers can create return requests"
  ON public.return_requests FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND customer_id = auth.uid()
  );

-- Customers can read their own return requests
DROP POLICY IF EXISTS "Customers can view own return requests" ON public.return_requests;
CREATE POLICY "Customers can view own return requests"
  ON public.return_requests FOR SELECT
  USING (customer_id = auth.uid());

-- Guests: no insert (order_id check done at application level)
-- Service role (admin) has full access via bypass RLS

-- 4. Index for fast customer lookups
CREATE INDEX IF NOT EXISTS idx_return_requests_customer_id
  ON public.return_requests(customer_id);

CREATE INDEX IF NOT EXISTS idx_return_requests_order_id
  ON public.return_requests(order_id);
