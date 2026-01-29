-- Migration: Marketing automation tables
-- Adds tables for social media marketing automation (X, Instagram, Pinterest, TikTok)

-- =============================================================================
-- MARKETING ACCOUNTS TABLE
-- Stores platform credentials and account configuration
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.marketing_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL CHECK (platform IN ('x', 'instagram', 'pinterest', 'tiktok')),
  account_name text NOT NULL,
  account_handle text, -- @handle for display
  credentials jsonb, -- encrypted OAuth tokens (access_token, refresh_token, etc.)
  platform_user_id text, -- platform-specific user ID
  is_active boolean DEFAULT true,
  last_sync_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(platform) -- one account per platform
);

-- Index for active accounts lookup
CREATE INDEX IF NOT EXISTS idx_marketing_accounts_active
  ON public.marketing_accounts(platform)
  WHERE is_active = true;

-- =============================================================================
-- MARKETING POSTS TABLE
-- Content queue and post history
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.marketing_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.marketing_accounts(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('x', 'instagram', 'pinterest', 'tiktok')),
  content text NOT NULL,
  media_urls text[], -- URLs to images/videos to include
  hashtags text[], -- extracted hashtags for analytics
  link_url text, -- link to Paisaxe story if applicable
  scheduled_for timestamptz, -- when to post (null = draft)
  posted_at timestamptz, -- when actually posted
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'posting', 'posted', 'failed')),
  platform_post_id text, -- ID returned by platform after posting
  post_url text, -- public URL of the post
  error_message text, -- error details if failed
  engagement jsonb DEFAULT '{}', -- likes, reposts, comments, etc.
  story_id uuid REFERENCES public.stories(id) ON DELETE SET NULL, -- linked Paisaxe story
  content_theme text, -- monthly theme: 'cozy', 'spring', 'summer', etc.
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index for scheduled posts lookup (for agent to find what to post)
CREATE INDEX IF NOT EXISTS idx_marketing_posts_scheduled
  ON public.marketing_posts(scheduled_for, status)
  WHERE status = 'scheduled';

-- Index for platform + status queries
CREATE INDEX IF NOT EXISTS idx_marketing_posts_platform_status
  ON public.marketing_posts(platform, status);

-- Index for story linkage
CREATE INDEX IF NOT EXISTS idx_marketing_posts_story
  ON public.marketing_posts(story_id)
  WHERE story_id IS NOT NULL;

-- =============================================================================
-- MARKETING SCHEDULE TABLE
-- Recurring posting schedule configuration
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.marketing_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL CHECK (platform IN ('x', 'instagram', 'pinterest', 'tiktok')),
  day_of_week int CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Sunday, null=every day
  time_utc time NOT NULL, -- time to post in UTC
  content_type text DEFAULT 'auto', -- 'photo', 'reel', 'thread', 'pin', 'auto'
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(platform, day_of_week, time_utc)
);

-- Index for schedule lookup
CREATE INDEX IF NOT EXISTS idx_marketing_schedule_active
  ON public.marketing_schedule(platform, is_active)
  WHERE is_active = true;

-- =============================================================================
-- MARKETING CONTENT BANK TABLE
-- Pre-generated content templates ready for posting
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.marketing_content_bank (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL CHECK (platform IN ('x', 'instagram', 'pinterest', 'tiktok', 'all')),
  content_type text NOT NULL CHECK (content_type IN ('photo_caption', 'reel_caption', 'thread', 'pin_description', 'story_prompt')),
  content text NOT NULL,
  media_suggestions text[], -- suggested image paths from stories
  hashtag_set text[], -- recommended hashtags
  story_id uuid REFERENCES public.stories(id) ON DELETE SET NULL,
  theme text, -- 'cozy', 'spring', 'summer', 'autumn', 'winter', etc.
  is_used boolean DEFAULT false,
  times_used int DEFAULT 0,
  last_used_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Index for unused content lookup
CREATE INDEX IF NOT EXISTS idx_marketing_content_bank_unused
  ON public.marketing_content_bank(platform, content_type, is_used)
  WHERE is_used = false;

-- =============================================================================
-- MARKETING AGENT LOGS TABLE
-- Audit trail of agent actions for debugging and monitoring
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.marketing_agent_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name text NOT NULL, -- 'x-agent', 'instagram-agent', etc.
  action text NOT NULL, -- 'generate_content', 'schedule_post', 'post', 'refresh_tokens', etc.
  status text NOT NULL CHECK (status IN ('started', 'success', 'failed')),
  details jsonb DEFAULT '{}', -- action-specific details
  error_message text,
  post_id uuid REFERENCES public.marketing_posts(id) ON DELETE SET NULL,
  duration_ms int, -- how long the action took
  created_at timestamptz DEFAULT now()
);

-- Index for recent logs (for admin dashboard)
CREATE INDEX IF NOT EXISTS idx_marketing_agent_logs_recent
  ON public.marketing_agent_logs(created_at DESC);

-- Index for agent-specific logs
CREATE INDEX IF NOT EXISTS idx_marketing_agent_logs_agent
  ON public.marketing_agent_logs(agent_name, created_at DESC);

-- =============================================================================
-- AUTO-UPDATE TRIGGERS
-- =============================================================================

-- Auto-update updated_at on marketing_accounts changes
CREATE OR REPLACE FUNCTION public.handle_marketing_accounts_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER marketing_accounts_updated_at
  BEFORE UPDATE ON public.marketing_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_marketing_accounts_updated_at();

-- Auto-update updated_at on marketing_posts changes
CREATE OR REPLACE FUNCTION public.handle_marketing_posts_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER marketing_posts_updated_at
  BEFORE UPDATE ON public.marketing_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_marketing_posts_updated_at();

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

-- Enable RLS on all marketing tables
ALTER TABLE public.marketing_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_content_bank ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_agent_logs ENABLE ROW LEVEL SECURITY;

-- Service role can manage all marketing data (for agents and admin API)
CREATE POLICY "Service role can manage marketing_accounts"
  ON public.marketing_accounts
  FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage marketing_posts"
  ON public.marketing_posts
  FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage marketing_schedule"
  ON public.marketing_schedule
  FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage marketing_content_bank"
  ON public.marketing_content_bank
  FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage marketing_agent_logs"
  ON public.marketing_agent_logs
  FOR ALL
  USING (auth.role() = 'service_role');

-- Admins can read all marketing data (via authenticated role + admin check)
-- Note: Admin check done in application layer via user_profiles.role

CREATE POLICY "Admins can read marketing_accounts"
  ON public.marketing_accounts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can read marketing_posts"
  ON public.marketing_posts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can read marketing_schedule"
  ON public.marketing_schedule
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can read marketing_content_bank"
  ON public.marketing_content_bank
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can read marketing_agent_logs"
  ON public.marketing_agent_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- =============================================================================
-- SEED DEFAULT SCHEDULE (based on marketing strategy)
-- =============================================================================

-- X (Twitter): Daily posting
INSERT INTO public.marketing_schedule (platform, day_of_week, time_utc, content_type)
VALUES
  ('x', NULL, '14:00', 'photo_caption'), -- Daily at 2 PM UTC (3 PM Madrid)
  ('x', 1, '10:00', 'thread'), -- Monday thread
  ('x', 4, '10:00', 'thread'); -- Thursday thread

-- Instagram: 2x/week (Monday and Wednesday)
INSERT INTO public.marketing_schedule (platform, day_of_week, time_utc, content_type)
VALUES
  ('instagram', 1, '17:00', 'reel_caption'), -- Monday Reel at 5 PM UTC
  ('instagram', 3, '17:00', 'photo_caption'); -- Wednesday post at 5 PM UTC

-- Pinterest: 3-5 pins/week (Mon, Wed, Fri)
INSERT INTO public.marketing_schedule (platform, day_of_week, time_utc, content_type)
VALUES
  ('pinterest', 1, '15:00', 'pin_description'),
  ('pinterest', 3, '15:00', 'pin_description'),
  ('pinterest', 5, '15:00', 'pin_description');

-- =============================================================================
-- CLEANUP OLD LOGS (add to pg_cron)
-- =============================================================================

-- Schedule cleanup of old agent logs (keep 90 days)
SELECT cron.schedule(
  'cleanup-marketing-logs',
  '0 3 1 * *', -- 1st of each month at 3 AM UTC
  $$DELETE FROM public.marketing_agent_logs WHERE created_at < now() - interval '90 days'$$
);

-- =============================================================================
-- COMMENTS FOR DOCUMENTATION
-- =============================================================================

COMMENT ON TABLE public.marketing_accounts IS 'Social media platform credentials and configuration for automated posting';
COMMENT ON TABLE public.marketing_posts IS 'Content queue and posting history for all platforms';
COMMENT ON TABLE public.marketing_schedule IS 'Recurring posting schedule configuration';
COMMENT ON TABLE public.marketing_content_bank IS 'Pre-generated content templates ready for posting';
COMMENT ON TABLE public.marketing_agent_logs IS 'Audit trail of marketing agent actions';

COMMENT ON COLUMN public.marketing_accounts.credentials IS 'Encrypted OAuth tokens - never expose in API responses';
COMMENT ON COLUMN public.marketing_posts.status IS 'draft=not scheduled, scheduled=queued, posting=in progress, posted=complete, failed=error';
COMMENT ON COLUMN public.marketing_schedule.day_of_week IS '0=Sunday, 1=Monday, ..., 6=Saturday, NULL=every day';
