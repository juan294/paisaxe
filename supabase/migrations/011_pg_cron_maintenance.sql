-- ============================================================================
-- Migration: 011_pg_cron_maintenance.sql
-- Purpose: Set up automated database maintenance via pg_cron
--
-- PREREQUISITE: Enable the pg_cron extension in Supabase Dashboard:
--   Database > Extensions > search "pg_cron" > Enable
--
-- This migration schedules recurring maintenance jobs for:
--   1. Weekly VACUUM ANALYZE on chunks table (vector embeddings)
--   2. Daily ANALYZE on all main tables (query planner stats)
--   3. Weekly cleanup of old cron job run history
--   4. Weekly VACUUM ANALYZE on analytics_events table
-- ============================================================================

-- Enable pg_cron extension for scheduled database maintenance
-- Note: pg_cron is available on all Supabase plans
create extension if not exists pg_cron with schema pg_catalog;

-- Grant usage to postgres role (required on Supabase)
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

-- Schedule weekly VACUUM ANALYZE on chunks table
-- The chunks table holds vector embeddings (1024 dimensions) and is the most
-- read-heavy table. VACUUM ANALYZE keeps query planner statistics fresh and
-- reclaims dead tuples after content re-seeding operations.
select cron.schedule(
  'vacuum-analyze-chunks',
  '0 3 * * 0',  -- Every Sunday at 3:00 AM UTC
  $$VACUUM ANALYZE public.chunks$$
);

-- Schedule daily ANALYZE on main tables
-- Keeps the query planner statistics up to date for optimal query performance
-- across all frequently queried tables.
select cron.schedule(
  'analyze-main-tables',
  '0 4 * * *',  -- Every day at 4:00 AM UTC
  $$ANALYZE public.chunks; ANALYZE public.images; ANALYZE public.stories$$
);

-- Schedule weekly cleanup of cron job run history
-- Prevents the cron.job_run_details table from growing unbounded by removing
-- entries older than 30 days.
select cron.schedule(
  'cleanup-cron-history',
  '0 5 * * 0',  -- Every Sunday at 5:00 AM UTC
  $$DELETE FROM cron.job_run_details WHERE end_time < now() - interval '30 days'$$
);

-- Schedule weekly VACUUM ANALYZE on analytics_events table
-- This table can grow quickly with event tracking data. Regular maintenance
-- ensures insert and query performance remains consistent.
select cron.schedule(
  'vacuum-analyze-analytics',
  '30 3 * * 0',  -- Every Sunday at 3:30 AM UTC
  $$VACUUM ANALYZE public.analytics_events$$
);

-- Verify scheduled jobs (run manually after migration):
-- SELECT * FROM cron.job ORDER BY jobname;
