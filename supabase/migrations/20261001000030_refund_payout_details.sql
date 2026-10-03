-- ==============================================================================
-- Migration: 20261001000030_refund_payout_details.sql
-- Description: Add refund method and payout details to return requests
-- ==============================================================================

ALTER TABLE public.return_requests
ADD COLUMN IF NOT EXISTS refund_method TEXT CHECK (refund_method IN ('vodafone_cash', 'instapay', 'bank_transfer', 'original_payment_method')),
ADD COLUMN IF NOT EXISTS refund_account_details JSONB,
ADD COLUMN IF NOT EXISTS refund_transaction_ref TEXT,
ADD COLUMN IF NOT EXISTS refund_completed_at TIMESTAMPTZ;

-- Reload schema
NOTIFY pgrst, 'reload schema';
