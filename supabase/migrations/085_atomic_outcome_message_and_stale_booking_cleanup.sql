-- Migration 084: Atomic outcome_message in complete_booking_sms_job + stale initiating booking cleanup
--
-- BE-M6: Add p_outcome_message parameter to complete_booking_sms_job so that the
-- outcome_message column on pending_bookings is updated in the same DB operation as the
-- booking_sms_jobs row. Previously the webhook handler did a separate UPDATE after the
-- RPC call; if that UPDATE failed the outcome_message was lost forever because the
-- idempotency key prevents re-attempt.
--
-- BE-H4: Add fail_stale_initiating_bookings() function and a pg_cron job to set
-- pending_bookings rows stuck in 'initiating' > 5 minutes to 'failed'. A hung
-- ElevenLabs fetch (now guarded by a 15-second AbortSignal in the route) could
-- previously leave these rows stuck indefinitely, blocking retries with 409.

-- ============================================================================
-- BE-M6: Update complete_booking_sms_job to accept and persist outcome_message
-- ============================================================================

-- Drop the old 2-argument overload from migration 079 to avoid ambiguity.
-- The new 3-argument version (with DEFAULT NULL for p_outcome_message) is a
-- drop-in replacement — callers omitting p_outcome_message behave identically.
DROP FUNCTION IF EXISTS public.complete_booking_sms_job(text, text);

CREATE OR REPLACE FUNCTION public.complete_booking_sms_job(
  p_event_key       text,
  p_provider_sid    text    DEFAULT NULL,
  p_outcome_message text    DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_booking_id uuid;
BEGIN
  -- Mark the SMS job as sent
  UPDATE public.booking_sms_jobs
  SET
    status           = 'sent',
    provider_sid     = p_provider_sid,
    sent_at          = now(),
    lease_expires_at = NULL,
    last_error       = NULL,
    updated_at       = now()
  WHERE event_key = p_event_key
  RETURNING booking_id INTO v_booking_id;

  -- Atomically persist the outcome message on the booking row when provided.
  -- Doing this in the same function call prevents the separate UPDATE in the
  -- webhook handler from being lost on failure (BE-M6).
  IF p_outcome_message IS NOT NULL AND v_booking_id IS NOT NULL THEN
    UPDATE public.pending_bookings
    SET
      outcome_message = p_outcome_message,
      updated_at      = now()
    WHERE id = v_booking_id;
  END IF;

  RETURN FOUND;
END;
$$;

COMMENT ON FUNCTION public.complete_booking_sms_job(text, text, text) IS
  'Marks a durable booking SMS job as sent and atomically updates the outcome_message on the booking (BE-M6).';

REVOKE ALL ON FUNCTION public.complete_booking_sms_job(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_booking_sms_job(text, text, text) TO service_role;

-- ============================================================================
-- BE-H4: Cleanup function for stale 'initiating' bookings
-- ============================================================================

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
  -- Set 'initiating' rows older than p_stale_minutes to 'failed'.
  -- These rows are created before the ElevenLabs outbound call is placed.
  -- If the call hangs (now guarded by AbortSignal.timeout(15s)), the row can
  -- stay in 'initiating' forever, blocking retries with 409 Conflict.
  UPDATE public.pending_bookings
  SET
    status     = 'failed',
    updated_at = now()
  WHERE
    status     = 'initiating'
    AND created_at < now() - (p_stale_minutes || ' minutes')::interval;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.fail_stale_initiating_bookings(integer) IS
  'Fails pending_bookings rows stuck in initiating state older than p_stale_minutes (default 5). Prevents 409 conflicts on retry after hung ElevenLabs fetches (BE-H4).';

REVOKE ALL ON FUNCTION public.fail_stale_initiating_bookings(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fail_stale_initiating_bookings(integer) TO service_role;
