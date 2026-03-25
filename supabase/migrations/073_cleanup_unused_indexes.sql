-- ============================================================================
-- Migration: 073_cleanup_unused_indexes.sql
-- Purpose: Address Supabase linter INFO suggestions for indexes
--
-- Actions:
--   1. Add missing FK index on platform_costs.created_by
--   2. Drop unused indexes on dead/inactive features (marketing)
--   3. Drop unused indexes on low-value columns
--
-- Kept (will be used as features scale):
--   - stories_category_idx, stories_location_idx (visitor filtering)
--   - idx_pending_bookings_status, idx_pending_bookings_customer_phone (active feature)
--   - stories_agent_discovered_idx (content discovery pipeline)
-- ============================================================================


-- ============================================================================
-- FIX 1: Add missing foreign key index
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_platform_costs_created_by
  ON public.platform_costs (created_by);


-- ============================================================================
-- FIX 2: Drop unused indexes on inactive marketing tables
-- Marketing features are not active — these indexes have never been hit.
-- They can be recreated if marketing is activated.
-- ============================================================================

DROP INDEX IF EXISTS public.idx_marketing_accounts_active;
DROP INDEX IF EXISTS public.idx_marketing_posts_scheduled;
DROP INDEX IF EXISTS public.idx_marketing_posts_account_id;
DROP INDEX IF EXISTS public.idx_marketing_schedule_active;
DROP INDEX IF EXISTS public.idx_marketing_content_bank_unused;
DROP INDEX IF EXISTS public.idx_marketing_agent_logs_agent;
DROP INDEX IF EXISTS public.idx_marketing_agent_logs_post_id;


-- ============================================================================
-- FIX 3: Drop other unused indexes on low-traffic/low-value columns
-- ============================================================================

-- platform_costs: service_id index never used (queries filter by date range, not service)
DROP INDEX IF EXISTS public.idx_platform_costs_service_id;

-- user_favorites: created_at ordering index never used
DROP INDEX IF EXISTS public.user_favorites_created_idx;

-- chunks: full-text content index never used (we use vector similarity, not text search)
DROP INDEX IF EXISTS public.chunks_content_idx;

-- story_suggestions: user_id and status indexes never used (low-traffic table)
DROP INDEX IF EXISTS public.story_suggestions_user_idx;
DROP INDEX IF EXISTS public.story_suggestions_status_idx;

-- feature_flags: environment index never used (small table, full scans are fine)
DROP INDEX IF EXISTS public.idx_feature_flags_environment;
