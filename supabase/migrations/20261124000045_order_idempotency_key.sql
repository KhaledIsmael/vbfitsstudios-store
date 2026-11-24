-- ============================================================================
-- Migration: 20261124000045_order_idempotency_key.sql
-- Purpose:   Add client_request_id column + unique index to orders table for
--            idempotent order creation.
--
-- STATUS: PREPARED — DO NOT APPLY until CheckoutPage.tsx fix/egress-reliability
--         branch is reviewed and approved for production deployment.
--
-- Why:
--   The checkout page generates a stable UUID (clientRequestId) per checkout
--   session and passes it to createOrder(). Once this migration is live, the
--   unique index on client_request_id prevents duplicate orders even when:
--     - The user taps "Confirm order" twice before the first response arrives
--     - A network retry after a timeout re-sends the same request
--
-- Risk:
--   Low — adding a nullable column with a partial unique index is non-breaking.
--   Existing orders retain NULL and are unaffected.
--
-- Rollback:
--   DROP INDEX IF EXISTS orders_client_request_id_key;
--   ALTER TABLE public.orders DROP COLUMN IF EXISTS client_request_id;
-- ============================================================================

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS client_request_id UUID;

-- Partial unique index: only enforces uniqueness for non-NULL values
CREATE UNIQUE INDEX IF NOT EXISTS orders_client_request_id_key
  ON public.orders (client_request_id)
  WHERE client_request_id IS NOT NULL;

COMMENT ON COLUMN public.orders.client_request_id IS
  'Client-generated UUID set once per checkout session. Used for idempotency: '
  'prevents duplicate orders on network-level retries. Nullable for legacy orders.';
