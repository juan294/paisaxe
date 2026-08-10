-- ============================================================================
-- Migration: 087_restrict_operational_table_access.sql
-- Purpose: Lock sensitive operational tables to service-role-only access and
--          enforce encrypted marketing credential storage.
--
-- Background: Migration 070 grants anon/authenticated SELECT on future public
-- tables by default. Operational tables created after that migration must
-- explicitly revoke those inherited privileges and rely on service-role RPCs.
-- ============================================================================

ALTER TABLE public.booking_sms_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.booking_sms_jobs FROM anon;
REVOKE ALL ON TABLE public.booking_sms_jobs FROM authenticated;
GRANT ALL ON TABLE public.booking_sms_jobs TO service_role;
DROP POLICY IF EXISTS "Service role can manage booking_sms_jobs" ON public.booking_sms_jobs;
CREATE POLICY "Service role can manage booking_sms_jobs"
  ON public.booking_sms_jobs
  FOR ALL
  TO service_role
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

ALTER TABLE public.elevenlabs_webhook_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.elevenlabs_webhook_events FROM anon;
REVOKE ALL ON TABLE public.elevenlabs_webhook_events FROM authenticated;
GRANT ALL ON TABLE public.elevenlabs_webhook_events TO service_role;
DROP POLICY IF EXISTS "Service role can manage elevenlabs_webhook_events" ON public.elevenlabs_webhook_events;
CREATE POLICY "Service role can manage elevenlabs_webhook_events"
  ON public.elevenlabs_webhook_events
  FOR ALL
  TO service_role
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

ALTER TABLE public.translate_webhook_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.translate_webhook_events FROM anon;
REVOKE ALL ON TABLE public.translate_webhook_events FROM authenticated;
GRANT ALL ON TABLE public.translate_webhook_events TO service_role;
DROP POLICY IF EXISTS "Service role can manage translate_webhook_events" ON public.translate_webhook_events;
CREATE POLICY "Service role can manage translate_webhook_events"
  ON public.translate_webhook_events
  FOR ALL
  TO service_role
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.stripe_webhook_events FROM anon;
REVOKE ALL ON TABLE public.stripe_webhook_events FROM authenticated;
GRANT ALL ON TABLE public.stripe_webhook_events TO service_role;
DROP POLICY IF EXISTS "Service role can manage stripe_webhook_events" ON public.stripe_webhook_events;
CREATE POLICY "Service role can manage stripe_webhook_events"
  ON public.stripe_webhook_events
  FOR ALL
  TO service_role
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Clear legacy plaintext marketing credentials before enforcing the shape.
-- Accounts with plaintext credentials must be reconnected through the admin UI.
UPDATE public.marketing_accounts
SET
  credentials = NULL,
  is_active = false,
  updated_at = now()
WHERE credentials IS NOT NULL
  AND NOT (
    jsonb_typeof(credentials) = 'object'
    AND credentials ? 'encrypted'
    AND jsonb_typeof(credentials->'encrypted') = 'string'
    AND length(credentials->>'encrypted') > 0
    AND NOT (credentials ? 'accessToken')
    AND NOT (credentials ? 'refreshToken')
    AND NOT (credentials ? 'apiKey')
    AND NOT (credentials ? 'apiSecret')
    AND NOT (credentials ? 'clientSecret')
    AND NOT (credentials ? 'access_token')
    AND NOT (credentials ? 'refresh_token')
    AND NOT (credentials ? 'api_key')
    AND NOT (credentials ? 'api_secret')
    AND NOT (credentials ? 'client_secret')
  );

ALTER TABLE public.marketing_accounts
  DROP CONSTRAINT IF EXISTS marketing_accounts_credentials_encrypted_shape;

ALTER TABLE public.marketing_accounts
  ADD CONSTRAINT marketing_accounts_credentials_encrypted_shape
  CHECK (
    credentials IS NULL
    OR (
      jsonb_typeof(credentials) = 'object'
      AND credentials ? 'encrypted'
      AND jsonb_typeof(credentials->'encrypted') = 'string'
      AND length(credentials->>'encrypted') > 0
      AND NOT (credentials ? 'accessToken')
      AND NOT (credentials ? 'refreshToken')
      AND NOT (credentials ? 'apiKey')
      AND NOT (credentials ? 'apiSecret')
      AND NOT (credentials ? 'clientSecret')
      AND NOT (credentials ? 'access_token')
      AND NOT (credentials ? 'refresh_token')
      AND NOT (credentials ? 'api_key')
      AND NOT (credentials ? 'api_secret')
      AND NOT (credentials ? 'client_secret')
    )
  );

COMMENT ON CONSTRAINT marketing_accounts_credentials_encrypted_shape
  ON public.marketing_accounts
  IS 'Marketing credentials must be null or stored as an encrypted payload wrapper.';
