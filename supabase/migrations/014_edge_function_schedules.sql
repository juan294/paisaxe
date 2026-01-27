-- ============================================================================
-- Migration: 014_edge_function_schedules.sql
-- Purpose: Schedule Supabase Edge Functions via pg_cron + pg_net
--
-- PREREQUISITES:
--   1. pg_cron enabled (done in migration 011)
--   2. pg_net enabled (created below if not already present)
--   3. Edge Functions deployed via `supabase functions deploy`
--
-- SETUP (run in Supabase SQL Editor after deploying edge functions):
--
--   1. Deploy the edge functions:
--        supabase functions deploy keep-alive
--        supabase functions deploy cleanup-analytics
--
--   2. Set the app settings so pg_cron can reach the functions:
--        ALTER DATABASE postgres SET app.supabase_functions_url = 'https://YOUR_PROJECT_REF.supabase.co/functions/v1';
--        ALTER DATABASE postgres SET app.service_role_key = 'YOUR_SERVICE_ROLE_KEY';
--
--   3. Run this migration (or apply via Supabase dashboard).
--
--   4. Verify scheduled jobs:
--        SELECT jobname, schedule, command FROM cron.job ORDER BY jobname;
-- ============================================================================

-- Ensure pg_net is available for HTTP calls from within PostgreSQL
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ---------------------------------------------------------------------------
-- Schedule: keep-alive
-- Runs every 3 days at noon UTC.
-- Calls the keep-alive Edge Function to generate database activity and
-- prevent free-tier auto-pause (7-day inactivity timeout).
-- ---------------------------------------------------------------------------
SELECT cron.schedule(
  'edge-keep-alive',
  '0 12 */3 * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_functions_url', true) || '/keep-alive',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ---------------------------------------------------------------------------
-- Schedule: cleanup-analytics
-- Runs on the first day of each month at 2:00 AM UTC.
-- Deletes analytics events older than 90 days to manage storage under
-- the 500 MB free tier limit.
-- ---------------------------------------------------------------------------
SELECT cron.schedule(
  'edge-cleanup-analytics',
  '0 2 1 * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_functions_url', true) || '/cleanup-analytics?days=90',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $$
);
