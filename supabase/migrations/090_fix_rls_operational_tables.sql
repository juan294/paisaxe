-- ============================================================================
-- Migration: 090_fix_rls_operational_tables.sql
-- Purpose: Re-apply RLS and service-role policies on 4 operational tables.
--
-- Background: Migration 087 (restrict_operational_table_access) was recorded
-- in schema_migrations but its ALTER TABLE ENABLE ROW LEVEL SECURITY statements
-- never applied to the live database. Confirmed by Supabase Advisor (2026-05-17)
-- and direct pg_tables query showing rowsecurity=false for all 4 tables.
-- These tables hold sensitive operational data (webhook events, SMS jobs).
-- ============================================================================

ALTER TABLE public.booking_sms_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.booking_sms_jobs FROM anon;
REVOKE ALL ON TABLE public.booking_sms_jobs FROM authenticated;
GRANT ALL ON TABLE public.booking_sms_jobs TO service_role;
DROP POLICY IF EXISTS "Service role can manage booking_sms_jobs" ON public.booking_sms_jobs;
CREATE POLICY "Service role can manage booking_sms_jobs"
  ON public.booking_sms_jobs FOR ALL TO service_role
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

ALTER TABLE public.elevenlabs_webhook_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.elevenlabs_webhook_events FROM anon;
REVOKE ALL ON TABLE public.elevenlabs_webhook_events FROM authenticated;
GRANT ALL ON TABLE public.elevenlabs_webhook_events TO service_role;
DROP POLICY IF EXISTS "Service role can manage elevenlabs_webhook_events" ON public.elevenlabs_webhook_events;
CREATE POLICY "Service role can manage elevenlabs_webhook_events"
  ON public.elevenlabs_webhook_events FOR ALL TO service_role
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

ALTER TABLE public.translate_webhook_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.translate_webhook_events FROM anon;
REVOKE ALL ON TABLE public.translate_webhook_events FROM authenticated;
GRANT ALL ON TABLE public.translate_webhook_events TO service_role;
DROP POLICY IF EXISTS "Service role can manage translate_webhook_events" ON public.translate_webhook_events;
CREATE POLICY "Service role can manage translate_webhook_events"
  ON public.translate_webhook_events FOR ALL TO service_role
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.stripe_webhook_events FROM anon;
REVOKE ALL ON TABLE public.stripe_webhook_events FROM authenticated;
GRANT ALL ON TABLE public.stripe_webhook_events TO service_role;
DROP POLICY IF EXISTS "Service role can manage stripe_webhook_events" ON public.stripe_webhook_events;
CREATE POLICY "Service role can manage stripe_webhook_events"
  ON public.stripe_webhook_events FOR ALL TO service_role
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
