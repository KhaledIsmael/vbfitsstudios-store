const fs = require('fs');
const path = require('path');

const migrationsDir = path.join(__dirname, '../supabase/migrations');
const outputFile = path.join(__dirname, '../supabase/MASTER_DATABASE_RESET.sql');

const header = `-- ============================================================
-- VBFITS STUDIOS - MASTER DATABASE RESET
-- Generated from: vbfitsstudios-store-mainold (original working codebase)
-- Run this in Supabase SQL Editor to fully reset the database
-- WARNING: This will drop ALL existing tables and recreate them cleanly
-- ============================================================

-- Step 1: Drop all existing RLS policies, tables, and functions (clean slate)
DO $$
DECLARE
  r RECORD;
BEGIN
  -- Drop all RLS policies in public schema
  FOR r IN (SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname = 'public') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;

  -- Drop all tables in public schema
  FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT LIKE 'pg_%') LOOP
    EXECUTE format('DROP TABLE IF EXISTS public.%I CASCADE', r.tablename);
  END LOOP;

  -- Drop all custom functions in public schema
  FOR r IN (SELECT proname, oidvectortypes(proargtypes) as args FROM pg_proc WHERE pronamespace = 'public'::regnamespace) LOOP
    BEGIN
      EXECUTE format('DROP FUNCTION IF EXISTS public.%I(%s) CASCADE', r.proname, r.args);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $$;

-- Enable core PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

`;

const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
console.log(`Combining ${files.length} migrations...`);

let combinedSql = header;

for (const file of files) {
  console.log(`Processing ${file}...`);
  let content = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

  // Double check and fix any remaining auth_id in code
  content = content.replace(/\bauth_id\s*=\s*auth\.uid\(\)/g, 'id = auth.uid()');

  // Double check and fix uuid_generate_v4 to gen_random_uuid
  content = content.replace(/\buuid_generate_v4\(\)/g, 'gen_random_uuid()');

  combinedSql += `\n-- ============================================================\n`;
  combinedSql += `-- FILE: ${file}\n`;
  combinedSql += `-- ============================================================\n\n`;
  combinedSql += content.trim() + '\n';
}

// Final sanity check
if (combinedSql.includes('auth_id = auth.uid()')) {
  console.error('FATAL: auth_id = auth.uid() still found!');
  process.exit(1);
}

fs.writeFileSync(outputFile, combinedSql, 'utf8');
console.log(`Successfully generated ${outputFile} (${combinedSql.length} bytes, ${combinedSql.split('\n').length} lines).`);
