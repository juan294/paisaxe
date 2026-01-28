-- Remove custom analytics (replaced by PostHog)
-- The analytics_events table and related cron jobs are no longer needed
-- as all analytics are now tracked via PostHog EU Cloud

-- Unschedule the pg_cron jobs for analytics maintenance
SELECT cron.unschedule('vacuum-analyze-analytics');
SELECT cron.unschedule('edge-cleanup-analytics');

-- Drop the analytics_events table and all its indexes/policies
DROP TABLE IF EXISTS public.analytics_events CASCADE;
