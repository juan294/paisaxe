-- ============================================================================
-- Migration: 012_keep_alive_cron.sql
-- Purpose: Prevent Supabase free-tier auto-pause and expose database size
--
-- The Supabase free tier automatically pauses projects after 7 days of
-- inactivity. This migration adds a lightweight keep-alive job that runs
-- every 3 days to prevent the project from being paused.
--
-- It also creates a helper function to query the current database size,
-- used by the /api/health endpoint to monitor storage usage against the
-- free-tier 500 MB limit.
--
-- PREREQUISITE: pg_cron must already be enabled (see 011_pg_cron_maintenance.sql)
-- ============================================================================

-- Schedule a keep-alive job to prevent Supabase free-tier auto-pause.
-- Runs a trivial query (SELECT 1) every 3 days at 12:00 PM UTC.
-- This ensures the project stays active and is never paused due to inactivity.
select cron.schedule(
  'keep-alive',
  '0 12 */3 * *',  -- Every 3 days at 12:00 PM UTC
  $$SELECT 1$$
);

-- Create a function to return the current database size in bytes.
-- Called via supabase.rpc('get_database_size') from the health check endpoint
-- to monitor storage usage on the free tier (500 MB limit).
create or replace function get_database_size()
returns bigint
language sql
security definer
as $$
  select pg_database_size(current_database());
$$;

-- Verify scheduled jobs (run manually after migration):
-- SELECT jobname, schedule, command FROM cron.job ORDER BY jobname;
