-- ============================================================================
-- Migration: 069_fix_anon_table_grants.sql
-- Purpose: Restore SELECT grants for anon role on public-facing tables
--
-- Root cause: The anon role lacks SELECT permission on tables that should
-- be publicly readable (stories, chunks, images, feature_flags).
-- RLS policies exist but are bypassed by the table-level permission denial.
-- This causes the immersive page to fall back to placeholder stock images
-- instead of loading real stories from the database.
--
-- These tables have RLS policies that control row-level access:
-- - stories: "Public read access for active stories" (is_active = true)
-- - chunks: RLS policies for vector search
-- - feature_flags: "Public can read feature flags"
-- - images: Public read access
-- ============================================================================

-- Grant SELECT on public-facing tables to anon role
-- RLS policies still control which rows are visible
GRANT SELECT ON public.stories TO anon;
GRANT SELECT ON public.stories TO authenticated;

GRANT SELECT ON public.chunks TO anon;
GRANT SELECT ON public.chunks TO authenticated;

GRANT SELECT ON public.images TO anon;
GRANT SELECT ON public.images TO authenticated;

GRANT SELECT ON public.feature_flags TO anon;
GRANT SELECT ON public.feature_flags TO authenticated;

-- Note: analytics_events was dropped in migration 019
