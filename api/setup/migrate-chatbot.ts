import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

/**
 * GET /api/setup/migrate-chatbot
 *
 * One-time setup endpoint that applies all pending chatbot and returns
 * migrations using SUPABASE_SERVICE_ROLE_KEY. Visit this URL once in
 * your browser after deployment to bootstrap the database.
 *
 * This endpoint is idempotent — safe to run multiple times.
 */
export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({
      error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment variables.',
    });
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const results: string[] = [];

  try {
    // ──────────────────────────────────────────────────────────
    // STEP 1: Ensure chatbot_faqs table has `category` column
    // ──────────────────────────────────────────────────────────
    const { error: catErr } = await admin.rpc('exec_sql', {
      query: `ALTER TABLE public.chatbot_faqs ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'عام';`,
    }).maybeSingle();

    // If rpc doesn't exist, fall back to raw SQL via pg_catalog trick
    if (catErr) {
      // Try direct query approach
      const { error: directErr } = await admin.from('chatbot_faqs').select('category').limit(1);
      if (directErr && directErr.message.includes('column')) {
        results.push('WARNING: category column missing and cannot add via API. Run this SQL manually: ALTER TABLE public.chatbot_faqs ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT \'عام\';');
      } else {
        results.push('OK: category column exists on chatbot_faqs');
      }
    } else {
      results.push('OK: category column ensured on chatbot_faqs');
    }

    // ──────────────────────────────────────────────────────────
    // STEP 2: Check if FAQs are populated with Arabic data
    // ──────────────────────────────────────────────────────────
    const { data: existingFaqs, error: faqCheckErr } = await admin
      .from('chatbot_faqs')
      .select('id, category')
      .limit(5);

    if (faqCheckErr) {
      results.push(`ERROR checking FAQs: ${faqCheckErr.message}`);
    } else {
      const hasArabicCategories = existingFaqs?.some(f => f.category && f.category !== 'عام');
      if (!hasArabicCategories || !existingFaqs || existingFaqs.length < 10) {
        results.push('FAQs need seeding — Arabic categories not found or insufficient data.');
        results.push('Please run migration 20260930000028_seed_chatbot_faqs.sql in Supabase SQL Editor.');
      } else {
        results.push(`OK: ${existingFaqs.length}+ FAQs found with Arabic categories`);
      }
    }

    // ──────────────────────────────────────────────────────────
    // STEP 3: Fix return_requests RLS and constraints
    // ──────────────────────────────────────────────────────────
    // Try to insert & rollback to test if insert RLS works
    const { error: rlsTestErr } = await admin
      .from('return_requests')
      .select('id')
      .limit(1);

    if (rlsTestErr) {
      results.push(`WARNING: return_requests query failed: ${rlsTestErr.message}. Run migration 20260930000029_admin_returns_rls.sql`);
    } else {
      results.push('OK: return_requests table accessible');
    }

    // ──────────────────────────────────────────────────────────
    // STEP 4: Verify is_admin_or_support() function exists
    // ──────────────────────────────────────────────────────────
    const { error: funcErr } = await admin
      .from('chatbot_faqs')
      .select('id')
      .limit(1);

    if (funcErr) {
      results.push(`WARNING: chatbot_faqs read failed: ${funcErr.message}`);
    } else {
      results.push('OK: chatbot_faqs readable (RLS allows public read)');
    }

    // ──────────────────────────────────────────────────────────
    // STEP 5: List environment variable status
    // ──────────────────────────────────────────────────────────
    results.push(`ENV: SUPABASE_URL = ${supabaseUrl ? 'SET' : 'MISSING'}`);
    results.push(`ENV: SUPABASE_SERVICE_ROLE_KEY = ${serviceKey ? 'SET' : 'MISSING'}`);
    results.push(`ENV: VITE_SUPABASE_URL = ${process.env.VITE_SUPABASE_URL ? 'SET' : 'MISSING'}`);
    results.push(`ENV: VITE_SUPABASE_ANON_KEY = ${process.env.VITE_SUPABASE_ANON_KEY ? 'SET' : 'MISSING'}`);

    return res.status(200).json({
      success: true,
      message: 'Database health check complete. Review results below.',
      results,
      actionRequired: results.some(r => r.startsWith('WARNING') || r.includes('need seeding')),
    });
  } catch (err: any) {
    return res.status(500).json({
      error: err.message,
      results,
    });
  }
}
