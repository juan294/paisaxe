-- ============================================================================
-- Migration: 051_add_foreign_key_indexes.sql
-- Purpose: Add indexes for foreign keys that were missing coverage
--
-- Foreign keys without indexes can cause slow DELETE/UPDATE operations on
-- the parent table because PostgreSQL must scan the child table to check
-- for referential integrity.
-- ============================================================================

-- marketing_agent_logs.post_id -> marketing_posts.id
CREATE INDEX IF NOT EXISTS idx_marketing_agent_logs_post_id
  ON public.marketing_agent_logs(post_id)
  WHERE post_id IS NOT NULL;

-- marketing_content_bank.story_id -> stories.id
CREATE INDEX IF NOT EXISTS idx_marketing_content_bank_story_id
  ON public.marketing_content_bank(story_id)
  WHERE story_id IS NOT NULL;

-- marketing_posts.account_id -> marketing_accounts.id
CREATE INDEX IF NOT EXISTS idx_marketing_posts_account_id
  ON public.marketing_posts(account_id);

-- stories.suggestion_id -> story_suggestions.id
CREATE INDEX IF NOT EXISTS idx_stories_suggestion_id
  ON public.stories(suggestion_id)
  WHERE suggestion_id IS NOT NULL;

-- story_suggestions.converted_story_id -> stories.id
CREATE INDEX IF NOT EXISTS idx_story_suggestions_converted_story_id
  ON public.story_suggestions(converted_story_id)
  WHERE converted_story_id IS NOT NULL;

-- ============================================================================
-- Note on unused indexes:
--
-- The following indexes are flagged as unused but should be KEPT:
-- - stories_category_idx, stories_location_idx: Used for visitor filtering
-- - chunks_content_idx: GIN index for full-text search fallback
-- - marketing_* indexes: Marketing automation not active yet
-- - story_suggestions_* indexes: Feature not heavily used yet
-- - feature_flags_environment: Used for environment-specific flags
--
-- These will see usage once the app is in production with real traffic.
-- Revisit after 30 days of production data.
-- ============================================================================
