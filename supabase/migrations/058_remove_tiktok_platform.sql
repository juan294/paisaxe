-- Migration: Remove TikTok from marketing platform options
-- TikTok was eliminated from the marketing strategy.

-- =============================================================================
-- DELETE EXISTING TIKTOK DATA (if any)
-- =============================================================================

DELETE FROM public.marketing_content_bank WHERE platform = 'tiktok';
DELETE FROM public.marketing_posts WHERE platform = 'tiktok';
DELETE FROM public.marketing_schedule WHERE platform = 'tiktok';
DELETE FROM public.marketing_accounts WHERE platform = 'tiktok';

-- =============================================================================
-- UPDATE CHECK CONSTRAINTS
-- =============================================================================

-- marketing_accounts: drop and recreate platform check
ALTER TABLE public.marketing_accounts
  DROP CONSTRAINT IF EXISTS marketing_accounts_platform_check;
ALTER TABLE public.marketing_accounts
  ADD CONSTRAINT marketing_accounts_platform_check
  CHECK (platform IN ('x', 'instagram', 'pinterest'));

-- marketing_posts: drop and recreate platform check
ALTER TABLE public.marketing_posts
  DROP CONSTRAINT IF EXISTS marketing_posts_platform_check;
ALTER TABLE public.marketing_posts
  ADD CONSTRAINT marketing_posts_platform_check
  CHECK (platform IN ('x', 'instagram', 'pinterest'));

-- marketing_schedule: drop and recreate platform check
ALTER TABLE public.marketing_schedule
  DROP CONSTRAINT IF EXISTS marketing_schedule_platform_check;
ALTER TABLE public.marketing_schedule
  ADD CONSTRAINT marketing_schedule_platform_check
  CHECK (platform IN ('x', 'instagram', 'pinterest'));

-- marketing_content_bank: drop and recreate platform check (keep 'all')
ALTER TABLE public.marketing_content_bank
  DROP CONSTRAINT IF EXISTS marketing_content_bank_platform_check;
ALTER TABLE public.marketing_content_bank
  ADD CONSTRAINT marketing_content_bank_platform_check
  CHECK (platform IN ('x', 'instagram', 'pinterest', 'all'));
