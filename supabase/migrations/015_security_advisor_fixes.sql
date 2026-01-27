-- ============================================================================
-- Migration: 015_security_advisor_fixes.sql
-- Purpose: Address all warnings from Supabase Security Advisor
--
-- Fixes:
--   1. Extension in Public — move pgvector from public to extensions schema
--   2. Function Search Path Mutable — set search_path = '' on all 7 functions
--   3. RLS Policy Always True — tighten analytics_events INSERT policy
--
-- NOT fixable via SQL (requires Supabase Dashboard):
--   4. Leaked Password Protection Disabled
--      Enable at: Dashboard > Authentication > Providers > Email >
--      "Leaked password protection"
-- ============================================================================


-- ============================================================================
-- FIX 1: Move pgvector extension from public to extensions schema
-- ============================================================================
-- Supabase recommends installing extensions in the 'extensions' schema
-- (which is on the default search_path) rather than cluttering public.
-- Existing columns using vector type are stored by OID and are unaffected.
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension e
    JOIN pg_namespace n ON e.extnamespace = n.oid
    WHERE e.extname = 'vector' AND n.nspname = 'public'
  ) THEN
    ALTER EXTENSION vector SET SCHEMA extensions;
  END IF;
END $$;


-- ============================================================================
-- FIX 2: Set search_path on all functions
-- ============================================================================
-- Functions without an explicit search_path are vulnerable to search path
-- injection attacks. Using search_path = '' (empty) with fully qualified
-- table references is the most secure approach.
--
-- For SQL functions: the body is parsed at creation time using the session
-- search_path, so vector types and operators resolve correctly.
-- At runtime, operators are also resolved via argument type schemas.
--
-- For PL/pgSQL trigger functions: NEW/OLD records and built-in functions
-- (now(), coalesce, etc.) do not depend on search_path.
-- ============================================================================

-- match_chunks: Vector similarity search for embeddings
-- Original: 002_voyage_embeddings.sql
CREATE OR REPLACE FUNCTION match_chunks(
  query_embedding vector(1024),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  content text,
  source_pdf text,
  page_number int,
  section_title text,
  image_refs text[],
  similarity float
)
LANGUAGE sql STABLE
SET search_path = ''
AS $$
  SELECT
    chunks.id,
    chunks.content,
    chunks.source_pdf,
    chunks.page_number,
    chunks.section_title,
    chunks.image_refs,
    1 - (chunks.embedding <=> query_embedding) AS similarity
  FROM public.chunks
  WHERE 1 - (chunks.embedding <=> query_embedding) > match_threshold
  ORDER BY chunks.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- update_stories_updated_at: Auto-update timestamp trigger
-- Original: 003_stories_table.sql
CREATE OR REPLACE FUNCTION update_stories_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = '';

-- get_story_favorite_count: Count favorites for a story
-- Original: 006_user_favorites.sql
CREATE OR REPLACE FUNCTION get_story_favorite_count(p_story_id uuid)
RETURNS bigint AS $$
  SELECT count(*) FROM public.user_favorites WHERE story_id = p_story_id;
$$ LANGUAGE sql STABLE
SET search_path = '';

-- is_story_favorited: Check if a user has favorited a story
-- Original: 006_user_favorites.sql
CREATE OR REPLACE FUNCTION is_story_favorited(p_user_id uuid, p_story_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.user_favorites
    WHERE user_id = p_user_id AND story_id = p_story_id
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = '';

-- update_feature_flags_updated_at: Auto-update timestamp trigger
-- Original: 008_feature_flags.sql
CREATE OR REPLACE FUNCTION update_feature_flags_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = '';

-- get_database_size: Return current database size in bytes
-- Original: 012_keep_alive_cron.sql
CREATE OR REPLACE FUNCTION get_database_size()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT pg_database_size(current_database());
$$;

-- notify_webhook: Send HTTP POST on table changes
-- Original: 013_database_webhooks.sql
CREATE OR REPLACE FUNCTION public.notify_webhook()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _base_url text;
  _secret text;
  _payload jsonb;
BEGIN
  _base_url := current_setting('app.webhook_base_url', true);
  _secret := current_setting('app.webhook_secret', true);

  IF _base_url IS NULL OR _base_url = '' THEN
    RAISE NOTICE '[webhook] app.webhook_base_url not configured — skipping';
    RETURN coalesce(NEW, OLD);
  END IF;

  _payload := jsonb_build_object(
    'table_name', TG_TABLE_NAME,
    'operation', TG_OP,
    'record', CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW)::jsonb ELSE NULL END,
    'old_record', CASE WHEN TG_OP IN ('DELETE', 'UPDATE') THEN row_to_json(OLD)::jsonb ELSE NULL END,
    'timestamp', now()::text
  );

  PERFORM net.http_post(
    url := _base_url || '/api/webhooks/supabase',
    body := _payload::text,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', coalesce(_secret, '')
    )
  );

  RETURN coalesce(NEW, OLD);
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '[webhook] Failed to send webhook: % %', SQLERRM, SQLSTATE;
    RETURN coalesce(NEW, OLD);
END;
$$;


-- ============================================================================
-- FIX 3: Tighten RLS policy on analytics_events
-- ============================================================================
-- The original INSERT policy used WITH CHECK (true), which Supabase flags as
-- "RLS Policy Always True". Replace with validation that ensures events have
-- a non-empty event_name within a reasonable length.
-- ============================================================================
DROP POLICY IF EXISTS "Public can insert analytics events" ON analytics_events;

CREATE POLICY "Public can insert analytics events"
  ON analytics_events FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    event_name IS NOT NULL
    AND length(event_name) BETWEEN 1 AND 200
  );


-- ============================================================================
-- MANUAL STEP (Supabase Dashboard):
--
-- Enable "Leaked Password Protection" to check passwords against known breaches:
--   Dashboard > Authentication > Providers > Email > Leaked password protection
--
-- This uses the HaveIBeenPwned API and cannot be configured via SQL.
-- ============================================================================
