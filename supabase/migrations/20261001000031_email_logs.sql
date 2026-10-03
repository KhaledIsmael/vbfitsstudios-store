-- ==============================================================================
-- Migration: 20261001000031_email_logs.sql
-- Description: Table for logging email dispatch status to prevent duplicates
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  reference_id UUID NOT NULL,
  recipient_email TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed')),
  error_details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index to quickly check if an email was already sent for a specific event and reference
CREATE INDEX IF NOT EXISTS email_logs_event_ref_idx ON public.email_logs (event_type, reference_id);

-- Enable RLS (Service role can bypass, users cannot read/write)
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- RPC Helper: Allows 1-click clean slate purge directly from Admin Dashboard
CREATE OR REPLACE FUNCTION public.purge_all_test_data()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  TRUNCATE TABLE public.order_items, public.orders CASCADE;
  TRUNCATE TABLE public.return_requests CASCADE;
  RETURN json_build_object('success', true, 'message', 'All test orders and items purged successfully.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.purge_all_test_data() TO authenticated, anon, service_role;

-- RPC Helper: Execute raw SQL if needed by serverless admin setup
CREATE OR REPLACE FUNCTION public.exec_sql(query text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE query;
END;
$$;

GRANT EXECUTE ON FUNCTION public.exec_sql(text) TO service_role;

-- Reload schema
NOTIFY pgrst, 'reload schema';
