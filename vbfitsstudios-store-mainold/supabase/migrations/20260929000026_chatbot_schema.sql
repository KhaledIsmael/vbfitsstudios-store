-- ==============================================================================
-- Migration: 20260929000026_chatbot_schema.sql
-- Description: Adds tables for chatbot FAQs and conversation logging
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.chatbot_faqs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trigger_keywords TEXT[] NOT NULL DEFAULT '{}',
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure is_active is added if the table already existed from a previous partial run
ALTER TABLE public.chatbot_faqs ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.chatbot_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL,
    user_message TEXT NOT NULL,
    matched_faq_id UUID REFERENCES public.chatbot_faqs(id) ON DELETE SET NULL,
    is_unmatched BOOLEAN NOT NULL DEFAULT false,
    is_human_handoff BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.chatbot_faqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chatbot_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if re-running
DROP POLICY IF EXISTS "Allow public read access to chatbot_faqs" ON public.chatbot_faqs;
DROP POLICY IF EXISTS "Allow admin full access to chatbot_faqs" ON public.chatbot_faqs;
DROP POLICY IF EXISTS "Allow public insert access to chatbot_logs" ON public.chatbot_logs;
DROP POLICY IF EXISTS "Allow admin full access to chatbot_logs" ON public.chatbot_logs;

-- Policies for chatbot_faqs
CREATE POLICY "Allow public read access to chatbot_faqs"
    ON public.chatbot_faqs
    FOR SELECT
    TO public
    USING (true);

CREATE POLICY "Allow admin full access to chatbot_faqs"
    ON public.chatbot_faqs
    FOR ALL
    TO authenticated
    USING (public.is_admin_or_support());

-- Policies for chatbot_logs
CREATE POLICY "Allow public insert access to chatbot_logs"
    ON public.chatbot_logs
    FOR INSERT
    TO public
    WITH CHECK (true);

CREATE POLICY "Allow admin full access to chatbot_logs"
    ON public.chatbot_logs
    FOR ALL
    TO authenticated
    USING (public.is_admin_or_support());

-- Initial Seed Data
INSERT INTO public.chatbot_faqs (trigger_keywords, question, answer, display_order)
VALUES 
    (ARRAY['shipping', 'delivery', 'track', 'when'], 'Shipping & Delivery', 'We offer complimentary express courier shipping on all domestic and international orders surpassing 1,500 EGP. Orders placed before 2:00 PM EST ship same business day.', 1),
    (ARRAY['return', 'refund', 'exchange'], 'Returns & Refunds', 'We offer complimentary 14-day returns on unworn merchandise in pristine, original condition with all internal woven labels, security tags, and luxury presentation packaging intact.', 2),
    (ARRAY['size', 'sizing', 'fit', 'measure'], 'Sizing', 'Our pieces are tailored to an architectural drop-shoulder cut. We recommend taking your true size for the intended oversized look, or sizing down for a more standard fit.', 3),
    (ARRAY['payment', 'pay', 'visa', 'mastercard', 'cod', 'cash'], 'Payment Methods', 'We accept all major credit cards (Visa, Mastercard, Amex), Apple Pay, and offer Cash on Delivery (COD) for domestic orders.', 4),
    (ARRAY['track', 'order', 'status', 'where'], 'Track My Order', 'You can track the status of your order by visiting the "Track Order" page from the footer menu using your order number and email address.', 5),
    (ARRAY['human', 'agent', 'support', 'contact', 'talk', 'help'], 'Talk to a Human', 'Connecting you to a client concierge advisor...', 6)
ON CONFLICT DO NOTHING;
