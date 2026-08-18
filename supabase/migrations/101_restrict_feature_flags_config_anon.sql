-- ============================================================================
-- Migration: 101_restrict_feature_flags_config_anon.sql
-- Purpose: SE-H1 / BE-M9 -- feature_flags.config is directly readable by anon
--   via PostgREST, defeating the app-layer scrub that removes
--   whitelisted_emails/agent_id from visitor_voice_agent's config before
--   src/app/api/feature-flags/route.ts responds to a client. Any client could
--   bypass that scrub entirely by querying PostgREST directly
--   (feature_flags?select=flag_key,config) with the public anon key, reading
--   admin emails and an ElevenLabs agent id.
--
-- Regression risk (see src/lib/proxy/maintenance.ts:92): that file reads this
--   table over PostgREST with the anon key on the maintenance-mode hot path --
--   `feature_flags?flag_key=eq.maintenance_mode&environment=eq....&select=enabled`
--   -- and silently treats any fetch failure as maintenance-mode-off. That
--   query only ever touches flag_key/environment (filter) and enabled
--   (select), never config, so this migration revokes anon/authenticated
--   SELECT on the `config` COLUMN only, not the whole table, and verified
--   locally (Docker) that the exact maintenance.ts query still succeeds
--   afterwards (see src/lib/proxy/maintenance.postgrest-integration.test.ts,
--   which exercises the real isMaintenanceModeEnabled() against a local stack).
--
-- Fix: replace the blanket "expose every column, scrub in app code" posture
--   with a public-safe VIEW that mirrors the same denylist already enforced in
--   src/app/api/feature-flags/route.ts, so DB-layer access is no longer weaker
--   than the app layer. src/app/coming-soon/page.tsx (unauthenticated) also
--   reads feature_flags.config directly for the maintenance_mode flag's
--   title/message/tagline -- that flag's config is not sensitive, so the view
--   passes it through unmodified; only visitor_voice_agent's config is masked.
--
-- Known residual risk (tracked in #915, not fixed here): this is still a
-- denylist -- a future flag with a new secret in its config leaks through this
-- view by default unless someone remembers to add a CASE branch here. BE-M9's
-- broader recommendation (invert to an allowlist of publishable keys per flag)
-- is intentionally out of scope for this fix; see #915 for that follow-up.
-- ============================================================================

-- anon/authenticated keep every column except `config` on the base table.
-- This is what preserves maintenance.ts's raw PostgREST read.
REVOKE SELECT ON public.feature_flags FROM anon, authenticated;
GRANT SELECT (id, flag_key, enabled, label, description, environment, created_at, updated_at)
  ON public.feature_flags TO anon, authenticated;

-- Public-safe view: same masking the app layer already performs in
-- SENSITIVE_CONFIG_KEYS (src/app/api/feature-flags/route.ts), applied at the
-- DB layer so PostgREST callers can no longer bypass it. Views run with the
-- privileges of their owner for underlying-table access (not the querying
-- role), so this view can still read the raw `config` column even though
-- anon/authenticated no longer have a column grant for it on the base table.
CREATE OR REPLACE VIEW public.feature_flags_public
  WITH (security_barrier = true) AS
SELECT
  id,
  flag_key,
  enabled,
  label,
  description,
  CASE
    WHEN flag_key = 'visitor_voice_agent'
      THEN (config - 'whitelisted_emails' - 'agent_id')
    ELSE config
  END AS config,
  environment,
  created_at,
  updated_at
FROM public.feature_flags;

GRANT SELECT ON public.feature_flags_public TO anon, authenticated;

COMMENT ON VIEW public.feature_flags_public IS
  'SE-H1/BE-M9: public-safe projection of feature_flags (masks visitor_voice_agent config secrets). See 101_restrict_feature_flags_config_anon.sql for the full rationale.';

COMMENT ON COLUMN public.feature_flags.config IS
  'SE-H1/BE-M9: anon/authenticated cannot SELECT this column directly (migration 101) -- read it through public.feature_flags_public instead.';
