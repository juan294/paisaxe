-- Reconcile production drift for recorded migrations 083, 085, and 088.
--
-- Production's migration ledger contains those versions, but a live schema
-- audit found their durable voice-booking functions were absent or still on
-- older signatures. Recreate the intended objects in a new forward migration
-- so every environment converges without rewriting migration history.

-- Keep the legacy three-argument overload during the application cutover.
-- The five-argument overload is selected unambiguously by the new webhook and
-- atomically persists the SMS delivery intent with the booking outcome.
CREATE OR REPLACE FUNCTION public.process_elevenlabs_event_idempotent(
  p_event_key text,
  p_booking_id uuid,
  p_outcome text,
  p_to_phone text DEFAULT NULL,
  p_sms_message text DEFAULT NULL
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_inserted uuid;
  v_booking_id uuid;
BEGIN
  INSERT INTO public.elevenlabs_webhook_events (event_key, booking_id)
  VALUES (p_event_key, p_booking_id)
  ON CONFLICT (event_key) DO NOTHING
  RETURNING id INTO v_inserted;

  IF v_inserted IS NULL THEN
    RETURN 'duplicate';
  END IF;

  UPDATE public.pending_bookings
  SET status = p_outcome
  WHERE id = p_booking_id
  RETURNING id INTO v_booking_id;

  IF v_booking_id IS NULL THEN
    DELETE FROM public.elevenlabs_webhook_events
    WHERE id = v_inserted;
    RETURN 'booking_missing';
  END IF;

  IF p_to_phone IS NOT NULL AND p_sms_message IS NOT NULL THEN
    INSERT INTO public.booking_sms_jobs (
      event_key,
      booking_id,
      to_phone,
      message,
      status,
      updated_at
    )
    VALUES (
      p_event_key,
      p_booking_id,
      p_to_phone,
      p_sms_message,
      'pending',
      now()
    )
    ON CONFLICT (event_key) DO NOTHING;
  END IF;

  RETURN 'processed';
END;
$$;

COMMENT ON FUNCTION public.process_elevenlabs_event_idempotent(text, uuid, text, text, text) IS
  'Claims an ElevenLabs webhook event once and atomically persists the booking outcome and optional SMS outbox row.';

REVOKE ALL ON FUNCTION public.process_elevenlabs_event_idempotent(text, uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_elevenlabs_event_idempotent(text, uuid, text, text, text) TO service_role;

-- Replace the stale two-argument completion function. Existing callers that
-- omit p_outcome_message continue to work through its default value.
DROP FUNCTION IF EXISTS public.complete_booking_sms_job(text, text);

CREATE OR REPLACE FUNCTION public.complete_booking_sms_job(
  p_event_key text,
  p_provider_sid text DEFAULT NULL,
  p_outcome_message text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_booking_id uuid;
BEGIN
  UPDATE public.booking_sms_jobs
  SET
    status = 'sent',
    provider_sid = p_provider_sid,
    sent_at = now(),
    lease_expires_at = NULL,
    last_error = NULL,
    updated_at = now()
  WHERE event_key = p_event_key
  RETURNING booking_id INTO v_booking_id;

  IF p_outcome_message IS NOT NULL AND v_booking_id IS NOT NULL THEN
    UPDATE public.pending_bookings
    SET
      outcome_message = p_outcome_message,
      updated_at = now()
    WHERE id = v_booking_id;
  END IF;

  RETURN v_booking_id IS NOT NULL;
END;
$$;

COMMENT ON FUNCTION public.complete_booking_sms_job(text, text, text) IS
  'Marks a durable booking SMS job as sent and atomically updates the booking outcome message when provided.';

REVOKE ALL ON FUNCTION public.complete_booking_sms_job(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_booking_sms_job(text, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.fail_stale_initiating_bookings(
  p_stale_minutes integer DEFAULT 5
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.pending_bookings
  SET
    status = 'failed',
    updated_at = now()
  WHERE status = 'initiating'
    AND created_at < now() - (p_stale_minutes || ' minutes')::interval;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.fail_stale_initiating_bookings(integer) IS
  'Fails bookings stuck in initiating longer than the configured threshold.';

REVOKE ALL ON FUNCTION public.fail_stale_initiating_bookings(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fail_stale_initiating_bookings(integer) TO service_role;

CREATE TABLE IF NOT EXISTS public.cron_job_locks (
  lock_key text PRIMARY KEY,
  lock_token uuid NOT NULL,
  lease_expires_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cron_job_locks_lease_expires_at
  ON public.cron_job_locks (lease_expires_at);

ALTER TABLE public.cron_job_locks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.cron_job_locks FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.cron_job_locks TO service_role;

CREATE OR REPLACE FUNCTION public.try_acquire_cron_job_lock(
  p_lock_key text,
  p_lease_seconds integer DEFAULT 900
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_token uuid := gen_random_uuid();
  v_acquired uuid;
BEGIN
  INSERT INTO public.cron_job_locks (
    lock_key,
    lock_token,
    lease_expires_at,
    updated_at
  )
  VALUES (
    p_lock_key,
    v_token,
    now() + make_interval(secs => GREATEST(p_lease_seconds, 1)),
    now()
  )
  ON CONFLICT (lock_key) DO UPDATE
  SET
    lock_token = EXCLUDED.lock_token,
    lease_expires_at = EXCLUDED.lease_expires_at,
    updated_at = now()
  WHERE public.cron_job_locks.lease_expires_at <= now()
  RETURNING lock_token INTO v_acquired;

  RETURN v_acquired;
END;
$$;

COMMENT ON FUNCTION public.try_acquire_cron_job_lock(text, integer) IS
  'Acquires a durable cron job lease and returns its ownership token.';

REVOKE ALL ON FUNCTION public.try_acquire_cron_job_lock(text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.try_acquire_cron_job_lock(text, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.release_cron_job_lock(
  p_lock_key text,
  p_lock_token uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.cron_job_locks
  WHERE lock_key = p_lock_key
    AND lock_token = p_lock_token;

  RETURN FOUND;
END;
$$;

COMMENT ON FUNCTION public.release_cron_job_lock(text, uuid) IS
  'Releases a durable cron job lease only when the caller owns its token.';

REVOKE ALL ON FUNCTION public.release_cron_job_lock(text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_cron_job_lock(text, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.claim_retryable_booking_sms_jobs(
  p_limit integer DEFAULT 10,
  p_lease_seconds integer DEFAULT 900,
  p_max_attempts integer DEFAULT 3
) RETURNS TABLE (
  booking_id uuid,
  event_key text,
  to_phone text,
  message text,
  attempts integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT j.id
    FROM public.booking_sms_jobs j
    WHERE (
        j.status IN ('pending', 'failed')
        OR (
          j.status = 'processing'
          AND j.lease_expires_at IS NOT NULL
          AND j.lease_expires_at <= now()
        )
      )
      AND j.attempts < GREATEST(p_max_attempts, 1)
    ORDER BY j.updated_at, j.created_at
    LIMIT GREATEST(p_limit, 1)
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.booking_sms_jobs j
  SET
    status = 'processing',
    attempts = j.attempts + 1,
    lease_expires_at = now() + make_interval(secs => GREATEST(p_lease_seconds, 1)),
    updated_at = now()
  FROM candidates
  WHERE j.id = candidates.id
  RETURNING j.booking_id, j.event_key, j.to_phone, j.message, j.attempts;
END;
$$;

COMMENT ON FUNCTION public.claim_retryable_booking_sms_jobs(integer, integer, integer) IS
  'Claims retryable SMS jobs with row locks, a bounded attempt count, and a renewable lease.';

REVOKE ALL ON FUNCTION public.claim_retryable_booking_sms_jobs(integer, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_retryable_booking_sms_jobs(integer, integer, integer) TO service_role;
