-- =============================================================================
-- 00_inspect.sql  -  READ-ONLY inspection of the live Supabase database
-- VB Fits Studios
--
-- This script ONLY READS. It creates, changes and deletes nothing.
-- It is safe to run any number of times.
--
-- HOW TO RUN
--   1. Supabase Dashboard > your project > SQL Editor (left sidebar).
--   2. Click "New query", paste this whole file, click RUN (or Ctrl+Enter).
--   3. The result is ONE row with ONE column called "inspection".
--   4. Click that cell, then the small "copy" icon (or right-click > Copy cell)
--      and paste the text back into the chat.
--      (If the text is very long, paste it in two or three messages.)
--   Never paste any key or password. This output contains none.
-- =============================================================================

SELECT jsonb_pretty(jsonb_build_object(

  -- 1. Postgres + extensions ---------------------------------------------------
  'postgres_version', (SELECT version()),
  'extensions', (
    SELECT COALESCE(jsonb_agg(extname ORDER BY extname), '[]'::jsonb) FROM pg_extension
  ),

  -- 2. Tables and columns (public schema) ------------------------------------
  --    format: "column type NULL|NOT NULL DEFAULT ..."
  'tables', (
    SELECT COALESCE(jsonb_object_agg(t.table_name, t.cols ORDER BY t.table_name), '{}'::jsonb)
    FROM (
      SELECT c.table_name,
             jsonb_agg(
               c.column_name || ' ' || c.udt_name
               || CASE WHEN c.is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END
               || COALESCE(' DEFAULT ' || c.column_default, '')
               ORDER BY c.ordinal_position
             ) AS cols
      FROM information_schema.columns c
      JOIN information_schema.tables tb
        ON tb.table_schema = c.table_schema AND tb.table_name = c.table_name
      WHERE c.table_schema = 'public' AND tb.table_type = 'BASE TABLE'
      GROUP BY c.table_name
    ) t
  ),

  -- 3. Views -------------------------------------------------------------------
  'views', (
    SELECT COALESCE(jsonb_agg(table_name ORDER BY table_name), '[]'::jsonb)
    FROM information_schema.views WHERE table_schema = 'public'
  ),

  -- 4. Constraints (PK, UNIQUE, CHECK, FK) -----------------------------------
  'constraints', (
    SELECT COALESCE(jsonb_agg(
      cl.relname || ' :: ' || co.conname || ' :: ' || pg_get_constraintdef(co.oid)
      ORDER BY cl.relname, co.conname), '[]'::jsonb)
    FROM pg_constraint co
    JOIN pg_class cl ON cl.oid = co.conrelid
    JOIN pg_namespace n ON n.oid = cl.relnamespace
    WHERE n.nspname = 'public'
  ),

  -- 5. Indexes -----------------------------------------------------------------
  'indexes', (
    SELECT COALESCE(jsonb_agg(tablename || ' :: ' || indexname ORDER BY tablename, indexname), '[]'::jsonb)
    FROM pg_indexes WHERE schemaname = 'public'
  ),

  -- 6. Row Level Security on/off per table -----------------------------------
  'rls_enabled', (
    SELECT COALESCE(jsonb_object_agg(c.relname, c.relrowsecurity ORDER BY c.relname), '{}'::jsonb)
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
  ),

  -- 7. Policies (public + storage) -------------------------------------------
  'policies', (
    SELECT COALESCE(jsonb_agg(
      schemaname || '.' || tablename || ' :: ' || policyname || ' :: ' || cmd
      || ' :: roles=' || array_to_string(roles, ',')
      || ' :: USING ' || COALESCE(qual, '-')
      || ' :: CHECK ' || COALESCE(with_check, '-')
      ORDER BY schemaname, tablename, policyname), '[]'::jsonb)
    FROM pg_policies WHERE schemaname IN ('public', 'storage')
  ),

  -- 8. Table grants for the API roles ----------------------------------------
  'table_grants', (
    SELECT COALESCE(jsonb_object_agg(g.table_name, g.perms ORDER BY g.table_name), '{}'::jsonb)
    FROM (
      SELECT table_name,
             jsonb_agg(grantee || ':' || privs ORDER BY grantee) AS perms
      FROM (
        SELECT table_name, grantee, string_agg(privilege_type, ',' ORDER BY privilege_type) AS privs
        FROM information_schema.role_table_grants
        WHERE table_schema = 'public' AND grantee IN ('anon', 'authenticated', 'service_role')
        GROUP BY table_name, grantee
      ) x
      GROUP BY table_name
    ) g
  ),

  -- 9. Public tables that have NO grant at all for anon/authenticated ---------
  'tables_without_any_api_grant', (
    SELECT COALESCE(jsonb_agg(c.relname ORDER BY c.relname), '[]'::jsonb)
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
      AND NOT EXISTS (
        SELECT 1 FROM information_schema.role_table_grants g
        WHERE g.table_schema = 'public' AND g.table_name = c.relname
          AND g.grantee IN ('anon', 'authenticated')
      )
  ),

  -- 10. Functions (public) -----------------------------------------------------
  'functions', (
    SELECT COALESCE(jsonb_agg(
      p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
      || CASE WHEN p.prosecdef THEN ' SECURITY DEFINER' ELSE '' END
      || ' EXEC:' || COALESCE((
           SELECT string_agg(r.rolname, ',' ORDER BY r.rolname)
           FROM pg_roles r
           WHERE r.rolname IN ('anon', 'authenticated', 'service_role')
             AND has_function_privilege(r.rolname, p.oid, 'EXECUTE')), '-')
      ORDER BY p.proname), '[]'::jsonb)
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
  ),

  -- 11. Triggers (public tables and auth.users) -------------------------------
  'triggers', (
    SELECT COALESCE(jsonb_agg(
      n.nspname || '.' || c.relname || ' :: ' || t.tgname || ' :: ' || pg_get_triggerdef(t.oid)
      ORDER BY n.nspname, c.relname, t.tgname), '[]'::jsonb)
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE NOT t.tgisinternal
      AND ((n.nspname = 'public') OR (n.nspname = 'auth' AND c.relname = 'users'))
  ),

  -- 12. Enum types ------------------------------------------------------------
  'enums', (
    SELECT COALESCE(jsonb_agg(
      t.typname || ' = ' || (SELECT string_agg(e.enumlabel, ',' ORDER BY e.enumsortorder)
                              FROM pg_enum e WHERE e.enumtypid = t.oid)
      ORDER BY t.typname), '[]'::jsonb)
    FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typtype = 'e'
  ),

  -- 13. Storage buckets -------------------------------------------------------
  'storage_buckets', (
    SELECT COALESCE(jsonb_agg(
      id || ' public=' || public::text
      || ' size_limit=' || COALESCE(file_size_limit::text, 'none')
      ORDER BY id), '[]'::jsonb)
    FROM storage.buckets
  ),

  -- 14. Realtime publication --------------------------------------------------
  'realtime_tables', (
    SELECT COALESCE(jsonb_agg(schemaname || '.' || tablename ORDER BY tablename), '[]'::jsonb)
    FROM pg_publication_tables WHERE pubname = 'supabase_realtime'
  ),

  -- 15. Row counts per public table (exact, read-only) -------------------------
  'row_counts', (
    SELECT COALESCE(jsonb_object_agg(
      t.tablename,
      (xpath('/row/c/text()',
        query_to_xml(format('SELECT count(*) AS c FROM public.%I', t.tablename), false, true, '')))[1]::text::int
      ORDER BY t.tablename), '{}'::jsonb)
    FROM pg_tables t WHERE t.schemaname = 'public'
  ),

  -- 16. Accounts: is there an admin? (emails only, no passwords/hashes) -------
  'auth_users_count', (SELECT count(*) FROM auth.users),
  'auth_users_emails', (
    SELECT COALESCE(jsonb_agg(
      email || ' confirmed=' || (email_confirmed_at IS NOT NULL)::text
      || ' meta_role=' || COALESCE(raw_user_meta_data->>'role', '-')
      ORDER BY created_at), '[]'::jsonb)
    FROM (SELECT * FROM auth.users ORDER BY created_at LIMIT 50) u
  ),
  'customers_staff_rows', (
    SELECT CASE
      WHEN NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'role'
      ) THEN to_jsonb('customers table or role column is MISSING'::text)
      ELSE to_jsonb((xpath('/row/c/text()', query_to_xml(
        'SELECT COALESCE(string_agg(email || '' role='' || role, '', '' ORDER BY email), ''none'') AS c '
        || 'FROM public.customers WHERE role IN (''admin'', ''support'')',
        false, true, '')))[1]::text)
    END
  )

)) AS inspection;
