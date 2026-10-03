-- Migration: Allow guest checkouts on orders and order_items
-- Gives anon role insert rights and permits orders with customer_id IS NULL

GRANT INSERT ON public.orders TO anon;
GRANT INSERT ON public.order_items TO anon;

-- Orders insert policy
DROP POLICY IF EXISTS "Customers can create own orders" ON public.orders;
CREATE POLICY "Customers and guests can create orders"
  ON public.orders FOR INSERT
  WITH CHECK (
    customer_id IS NULL OR auth.uid() = customer_id
  );

-- Order items insert policy
DROP POLICY IF EXISTS "Customers can insert own order items" ON public.order_items;
CREATE POLICY "Customers and guests can insert order items"
  ON public.order_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_items.order_id
        AND (orders.customer_id IS NULL OR orders.customer_id = auth.uid())
    )
  );
