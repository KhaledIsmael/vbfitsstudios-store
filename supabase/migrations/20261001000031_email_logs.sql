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

-- Reload schema
NOTIFY pgrst, 'reload schema';
