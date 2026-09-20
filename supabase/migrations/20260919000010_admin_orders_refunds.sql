-- ==============================================================================
-- Migration: 20260919000010_admin_orders_refunds.sql
-- Description: Add internal_notes to orders, create refunds table, and set RLS.
-- ==============================================================================

-- 1. Add internal_notes to public.orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS internal_notes TEXT;

-- 2. Create refunds table
CREATE TABLE IF NOT EXISTS public.refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
  reason TEXT NOT NULL,
  refund_method TEXT NOT NULL DEFAULT 'original_payment',
  notes TEXT,
  created_by UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_refunds_order_id ON public.refunds(order_id);
CREATE INDEX IF NOT EXISTS idx_refunds_created_at ON public.refunds(created_at);

-- Trigger for refunds.updated_at
DROP TRIGGER IF EXISTS tr_refunds_updated_at ON public.refunds;
CREATE TRIGGER tr_refunds_updated_at
  BEFORE UPDATE ON public.refunds
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 3. RLS Policies for refunds table
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can manage refunds" ON public.refunds;
CREATE POLICY "Staff can manage refunds"
  ON public.refunds FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = auth.uid() AND c.role IN ('admin', 'support')
    )
  );

-- Customers can view refunds linked to their orders
DROP POLICY IF EXISTS "Customers can view their order refunds" ON public.refunds;
CREATE POLICY "Customers can view their order refunds"
  ON public.refunds FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = refunds.order_id AND o.customer_id = auth.uid()
    )
  );

-- 4. Staff policies for orders update
DROP POLICY IF EXISTS "Staff can update orders" ON public.orders;
CREATE POLICY "Staff can update orders"
  ON public.orders FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = auth.uid() AND c.role IN ('admin', 'support')
    )
  );
