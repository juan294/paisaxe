-- ============================================================================
-- Migration: 072_fix_story_suggestions_insert_policy.sql
-- Purpose: Fix multiple_permissive_policies warning on story_suggestions INSERT
--
-- The "Authenticated users can insert own suggestions" policy has no TO clause,
-- so it applies to ALL roles including anon. This overlaps with the
-- "Anonymous users can insert suggestions" policy (which targets anon).
-- Fix: scope the authenticated policy to the authenticated role only.
-- ============================================================================

DROP POLICY IF EXISTS "Authenticated users can insert own suggestions" ON public.story_suggestions;
CREATE POLICY "Authenticated users can insert own suggestions"
  ON public.story_suggestions FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);
