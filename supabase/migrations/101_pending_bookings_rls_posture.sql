-- ============================================================================
-- Migration: 101_pending_bookings_rls_posture.sql
-- Purpose: Bring pending_bookings to the same explicit service-role-only
-- posture as the other sensitive operational tables (booking_sms_jobs,
-- elevenlabs_webhook_events, translate_webhook_events, stripe_webhook_events;
-- see migration 090).
--
-- Background: pending_bookings holds the highest-PII data in the schema
-- (customer names, customer phones, venue phones, special requests).
-- Migration 053 enabled RLS with no policies, which correctly denies
-- anon/authenticated by default today (Postgres default-deny with RLS
-- enabled and no permissive policy). But the table was never added to the
-- explicit REVOKE / GRANT / policy trio the other operational tables carry,
-- and it was omitted from the check-migrations.ts posture guard -- so a
-- future migration accidentally adding a permissive policy or grant on this
-- table would not be caught automatically. This migration is a no-op change
-- in effective access (still service-role only) but makes the posture
-- explicit and machine-checkable.
-- ============================================================================

ALTER TABLE public.pending_bookings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.pending_bookings FROM anon;
REVOKE ALL ON TABLE public.pending_bookings FROM authenticated;
GRANT ALL ON TABLE public.pending_bookings TO service_role;
DROP POLICY IF EXISTS "Service role can manage pending_bookings" ON public.pending_bookings;
CREATE POLICY "Service role can manage pending_bookings"
  ON public.pending_bookings FOR ALL TO service_role
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
