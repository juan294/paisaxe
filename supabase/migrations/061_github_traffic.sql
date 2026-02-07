-- ============================================================================
-- Migration: 061_github_traffic.sql
-- Purpose: Store GitHub repository traffic data for the admin analytics panel
--
-- GitHub Traffic API only retains 14 days of data. This table stores
-- historical snapshots so we can build long-term traffic trends.
--
-- A pg_cron job syncs data every 12 days via the Next.js sync endpoint.
--
-- SETUP:
--   1. Add GITHUB_TOKEN env var to Vercel (GitHub PAT with `repo` scope)
--   2. Verify pg_cron + pg_net are enabled (done in migrations 011 + 014)
--   3. Update app.supabase_functions_url and app.service_role_key if not set
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Table: github_traffic_daily
-- Stores per-day views and clones. Upserted by date on each sync.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.github_traffic_daily (
  date DATE PRIMARY KEY,
  views INTEGER NOT NULL DEFAULT 0,
  views_unique INTEGER NOT NULL DEFAULT 0,
  clones INTEGER NOT NULL DEFAULT 0,
  clones_unique INTEGER NOT NULL DEFAULT 0,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.github_traffic_daily IS 'Daily GitHub repo traffic (views + clones). Synced from GitHub Traffic API.';

-- ---------------------------------------------------------------------------
-- Table: github_traffic_referrers
-- Top referring sites, snapshotted per sync.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.github_traffic_referrers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  referrer TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  uniques INTEGER NOT NULL DEFAULT 0
);

COMMENT ON TABLE public.github_traffic_referrers IS 'GitHub traffic referrer snapshots. Aggregated over 14-day window per sync.';

-- ---------------------------------------------------------------------------
-- Table: github_traffic_paths
-- Most viewed repo paths, snapshotted per sync.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.github_traffic_paths (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  path TEXT NOT NULL,
  title TEXT,
  count INTEGER NOT NULL DEFAULT 0,
  uniques INTEGER NOT NULL DEFAULT 0
);

COMMENT ON TABLE public.github_traffic_paths IS 'GitHub traffic popular paths snapshots. Aggregated over 14-day window per sync.';

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_github_traffic_daily_date
  ON public.github_traffic_daily (date DESC);

CREATE INDEX IF NOT EXISTS idx_github_traffic_referrers_fetched
  ON public.github_traffic_referrers (fetched_at DESC);

CREATE INDEX IF NOT EXISTS idx_github_traffic_paths_fetched
  ON public.github_traffic_paths (fetched_at DESC);

-- ---------------------------------------------------------------------------
-- RLS: Admin-only access via service role (API routes use service key)
-- ---------------------------------------------------------------------------
ALTER TABLE public.github_traffic_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.github_traffic_referrers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.github_traffic_paths ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (used by API routes)
CREATE POLICY "Service role full access on github_traffic_daily"
  ON public.github_traffic_daily
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access on github_traffic_referrers"
  ON public.github_traffic_referrers
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access on github_traffic_paths"
  ON public.github_traffic_paths
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- pg_cron: Sync GitHub traffic every 12 days at 3 AM UTC
-- Calls the Next.js sync endpoint via pg_net
-- ---------------------------------------------------------------------------
SELECT cron.schedule(
  'github-traffic-sync',
  '0 3 */12 * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.site_url', true) || '/api/cron/github-traffic-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', current_setting('app.webhook_secret', true)
    ),
    body := '{}'::jsonb
  );
  $$
);
