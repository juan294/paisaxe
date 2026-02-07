-- ============================================================================
-- Migration: 062_fix_github_traffic_cron.sql
-- Purpose: Update GitHub traffic cron job to use webhook_config table
--
-- The previous migration (061) used current_setting('app.*') which requires
-- ALTER DATABASE SET permissions that Supabase restricts. This migration
-- replaces the cron job to read from the webhook_config table instead,
-- matching the pattern established in migration 025.
-- ============================================================================

-- Drop the old cron job
SELECT cron.unschedule('github-traffic-sync');

-- Re-create with webhook_config table lookup
SELECT cron.schedule(
  'github-traffic-sync',
  '0 3 */12 * *',
  $$
  SELECT net.http_post(
    url := (SELECT value FROM public.webhook_config WHERE key = 'base_url') || '/api/cron/github-traffic-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', (SELECT value FROM public.webhook_config WHERE key = 'secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
