-- ============================================================================
-- Migration: 110_revoke_definer_function_exec_from_anon.sql
-- Purpose: Close anon/authenticated EXECUTE on SECURITY DEFINER functions in
--          `public` (found 2026-10-02 against production and a fresh local DB).
--
-- Bug: migrations 091/092 revoked EXECUTE from anon/authenticated for the RPCs
-- that existed then. Functions created or DROP+CREATEd afterwards -- 093
-- patch_story_translation_metadata, 094 create_story_from_suggestion, 096
-- get_marketing_post_stats, 099 grant_day_pass_idempotent (and, once applied,
-- 104 claim_next_translate_webhook_event / fail_stale_story_translations) --
-- only ran `REVOKE ALL ... FROM PUBLIC`. That does not remove the explicit
-- anon/authenticated grants that Supabase's schema-level default privileges add
-- to every new function in `public`, so the public anon key could call them
-- over PostgREST. grant_day_pass_idempotent in particular grants a paid day
-- pass for an arbitrary user id.
--
-- Fix:
--   1. Revoke EXECUTE from PUBLIC, anon and authenticated on every SECURITY
--      DEFINER function in `public`, found through the catalog so it applies to
--      whatever signatures exist (production is at migration 100, a fresh
--      database at 109). service_role keeps its explicit grants; every caller of
--      these RPCs uses createAdminClient() (service key).
--   2. Stop future functions from inheriting the grants: revoke the schema-level
--      default EXECUTE from anon/authenticated, so the repo's existing
--      `REVOKE ALL ... FROM PUBLIC; GRANT EXECUTE ... TO service_role` pattern is
--      sufficient again (same approach as migration 103 for tables).
--   3. Fail closed: abort the migration if any SECURITY DEFINER function in
--      `public` is still executable by anon or authenticated.
--
-- Idempotent and safe to run on a database at any migration level >= 099.
-- ============================================================================

DO $$
DECLARE
  fn regprocedure;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
  LOOP
    EXECUTE format(
      'REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated',
      fn
    );
  END LOOP;
END
$$;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM authenticated;

DO $$
DECLARE
  exposed text;
BEGIN
  SELECT string_agg(p.oid::regprocedure::text, ', ' ORDER BY p.oid::regprocedure::text)
  INTO exposed
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prosecdef
    AND (
      has_function_privilege('anon', p.oid, 'EXECUTE')
      OR has_function_privilege('authenticated', p.oid, 'EXECUTE')
    );

  IF exposed IS NOT NULL THEN
    RAISE EXCEPTION
      'SECURITY DEFINER functions still executable by anon/authenticated: %', exposed;
  END IF;
END
$$;
