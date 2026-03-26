-- ============================================================================
-- Migration: 075_grant_missing_table_permissions.sql
-- Purpose: Grant missing table-level permissions for user-facing tables
--
-- Background: Tables created before migration 070 (ALTER DEFAULT PRIVILEGES)
-- have RLS policies but no table-level GRANT. Without GRANT, queries return
-- empty results silently — RLS is never evaluated.
--
-- Migration 069 fixed stories, chunks, images, feature_flags.
-- Migration 074 fixed user_profiles (SELECT for authenticated).
-- This migration fixes the remaining user-facing tables:
--   - user_favorites (authenticated: SELECT, INSERT, UPDATE, DELETE)
--   - story_suggestions (authenticated: SELECT, INSERT; anon: INSERT)
--   - voice_purchases (authenticated: SELECT)
-- ============================================================================

-- user_favorites: users can view, add (upsert), and remove their own favorites
-- RLS policies restrict to own rows via auth.uid() = user_id
GRANT SELECT ON public.user_favorites TO authenticated;
GRANT INSERT ON public.user_favorites TO authenticated;
GRANT UPDATE ON public.user_favorites TO authenticated;
GRANT DELETE ON public.user_favorites TO authenticated;

-- story_suggestions: authenticated users can view own suggestions and submit new ones
-- Anonymous users can also submit suggestions (user_id = null)
-- RLS policies handle row-level restrictions
GRANT SELECT ON public.story_suggestions TO authenticated;
GRANT INSERT ON public.story_suggestions TO authenticated;
GRANT INSERT ON public.story_suggestions TO anon;

-- voice_purchases: authenticated users can check their own purchase status
-- RLS policy restricts to own rows via auth.uid() = user_id
GRANT SELECT ON public.voice_purchases TO authenticated;
