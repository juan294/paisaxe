-- ============================================================================
-- Migration: 071_fix_rls_linter_warnings.sql
-- Purpose: Resolve all Supabase Security Advisor RLS warnings
--
-- Fixes:
--   1. multiple_permissive_policies: Drop `deny_anon_all` policies that were
--      created outside migrations (likely via Supabase dashboard API access toggle).
--      These conflict with our proper RLS policies and hurt query performance.
--   2. auth_rls_initplan: Wrap auth.uid() in (select auth.uid()) for
--      story_suggestions policies to prevent per-row re-evaluation.
--
-- Tables affected by deny_anon_all removal:
--   chunks, feature_flags, images, stories, story_suggestions,
--   user_favorites, user_profiles, voice_purchases
--
-- Access control is already handled by:
--   - Table-level GRANT (migrations 069/070)
--   - Proper RLS policies with role-specific USING clauses
-- ============================================================================


-- ============================================================================
-- FIX 1: Drop all deny_anon_all policies
-- These were not created by migrations and conflict with our RLS policies.
-- ============================================================================

DROP POLICY IF EXISTS "deny_anon_all" ON public.chunks;
DROP POLICY IF EXISTS "deny_anon_all" ON public.feature_flags;
DROP POLICY IF EXISTS "deny_anon_all" ON public.images;
DROP POLICY IF EXISTS "deny_anon_all" ON public.stories;
DROP POLICY IF EXISTS "deny_anon_all" ON public.story_suggestions;
DROP POLICY IF EXISTS "deny_anon_all" ON public.user_favorites;
DROP POLICY IF EXISTS "deny_anon_all" ON public.user_profiles;
DROP POLICY IF EXISTS "deny_anon_all" ON public.voice_purchases;


-- ============================================================================
-- FIX 2: Wrap auth.uid() in (select auth.uid()) for story_suggestions
-- Migration 049 fixed this for other tables but missed story_suggestions
-- (which was later recreated in migration 059).
-- ============================================================================

DROP POLICY IF EXISTS "Authenticated users can view own suggestions" ON public.story_suggestions;
CREATE POLICY "Authenticated users can view own suggestions"
  ON public.story_suggestions FOR SELECT
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Authenticated users can insert own suggestions" ON public.story_suggestions;
CREATE POLICY "Authenticated users can insert own suggestions"
  ON public.story_suggestions FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);


-- ============================================================================
-- VERIFICATION: Run this query after migration to confirm no warnings remain:
--
-- SELECT * FROM extensions.supabase_db_lint()
-- WHERE level = 'WARN'
--   AND name IN ('auth_rls_initplan', 'multiple_permissive_policies');
-- ============================================================================
