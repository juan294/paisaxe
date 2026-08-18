-- ============================================================================
-- Migration: 103_revoke_anon_default_privileges.sql
-- Purpose: Close SE-H3 -- revoke the blanket ALTER DEFAULT PRIVILEGES grant
--          from migration 070 so future tables in the public schema no
--          longer get anon/authenticated SELECT automatically. Replace it
--          with explicit per-table grants on the tables that are genuinely
--          meant to be public.
--
-- Background: Migration 070 set:
--   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon;
--   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO authenticated;
-- intending to fix an incident where new tables' RLS policies existed but
-- couldn't be evaluated, because anon lacked table-level SELECT (permission
-- denied before RLS was even checked).
--
-- That fix over-corrected: it made "forgot to add RLS to a new table" fail
-- OPEN (anon-readable) instead of closed. Four operational tables --
-- booking_sms_jobs, elevenlabs_webhook_events, translate_webhook_events, and
-- stripe_webhook_events (booking_sms_jobs holds customer phone numbers) --
-- were created (migrations 077, 079) after 070 and briefly relied on this
-- default grant with no RLS of their own, until migrations 087/090 caught
-- and locked them down reactively.
--
-- Fix: revoke the blanket default privilege. The four tables that are
-- genuinely meant to be public already have EXPLICIT per-table grants from
-- migration 069 (stories, chunks, images, feature_flags) -- restated below
-- so this migration is a complete, self-documenting substitute for the
-- blanket grant it replaces (GRANT is idempotent if already held).
--
-- Regression audit (see remediation report for SE-H3 / issue #843): default
-- privileges only govern tables created AFTER the ALTER DEFAULT PRIVILEGES
-- statement runs -- they do not retroactively change grants already applied
-- to existing tables. A full audit of every CREATE TABLE in
-- supabase/migrations/*.sql created after 070 confirms every one of them
-- either enables RLS in the same migration that creates it (admin_audit_log,
-- cron_job_locks, anthropic_usage, voice_saved_places) or was locked down by
-- 087/090 with an explicit REVOKE from anon and authenticated. No
-- currently-live table depends on this default grant remaining in place for
-- read access. This migration only changes the default for tables created
-- from this point forward -- it does not touch most existing tables' grants.
--
-- One exception found by querying information_schema.role_table_grants
-- against a local Docker stack: anthropic_usage and voice_saved_places
-- (created by 097/098, both RLS-enabled with zero policies in the same
-- migration) still carry the residual anon/authenticated SELECT grant
-- inherited from migration 070's default privilege. RLS with no policy
-- already returns zero rows to those roles, so this was never a live
-- exposure -- but it is exactly the kind of implicit, easy-to-miss grant
-- this migration exists to stop creating, so it is revoked below too.
-- ============================================================================

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE SELECT ON TABLES FROM anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE SELECT ON TABLES FROM authenticated;

-- Re-affirm explicit SELECT grants for the tables that are genuinely public
-- (already granted by migration 069; restated here for a complete record).
GRANT SELECT ON public.stories TO anon;
GRANT SELECT ON public.stories TO authenticated;

GRANT SELECT ON public.chunks TO anon;
GRANT SELECT ON public.chunks TO authenticated;

GRANT SELECT ON public.images TO anon;
GRANT SELECT ON public.images TO authenticated;

-- feature_flags: migration 101 (SE-H1/BE-M9, merged concurrently) narrowed
-- this from a blanket table grant to a column list that excludes `config`
-- (routing config reads through the public.feature_flags_public view
-- instead). Restate that SAME narrower grant here -- a plain
-- `GRANT SELECT ON public.feature_flags` would silently re-open the
-- `config` column that 101 revoked.
GRANT SELECT (id, flag_key, enabled, label, description, environment, created_at, updated_at)
  ON public.feature_flags TO anon, authenticated;

-- Close the residual default-privilege grant found on two service-role-only
-- tables (see audit note above). No policy exists for anon/authenticated on
-- either table, so this is defense-in-depth, not a behavior change.
REVOKE SELECT ON public.anthropic_usage FROM anon;
REVOKE SELECT ON public.anthropic_usage FROM authenticated;

REVOKE SELECT ON public.voice_saved_places FROM anon;
REVOKE SELECT ON public.voice_saved_places FROM authenticated;
