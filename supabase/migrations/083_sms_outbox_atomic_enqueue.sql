-- Migration 082: Atomic SMS outbox enqueue within the booking event transaction
--
-- Problem (BE-H2): The webhook called process_elevenlabs_event_idempotent (which
-- commits booking status) and then enqueue_booking_sms_job as a separate RPC call.
-- There was a window between the two calls where booking state was committed but
-- the SMS outbox row did not yet exist, so a Twilio failure at that point could
-- permanently drop the confirmation SMS.
--
-- Fix: Extend process_elevenlabs_event_idempotent to also INSERT the SMS outbox
-- row atomically within the same transaction.  The row is only inserted when the
-- event is freshly processed (not a duplicate) and phone / message are provided.
-- The webhook handler can still call enqueue_booking_sms_job afterwards as an
-- upsert (idempotent); that call becomes a no-op for already-queued rows.

CREATE OR REPLACE FUNCTION public.process_elevenlabs_event_idempotent(
  p_event_key   text,
  p_booking_id  uuid,
  p_outcome     text,
  p_to_phone    text    DEFAULT NULL,
  p_sms_message text    DEFAULT NULL
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_inserted     uuid;
  v_booking_id   uuid;
BEGIN
  -- Claim the event (idempotent gate)
  INSERT INTO public.elevenlabs_webhook_events (event_key, booking_id)
  VALUES (p_event_key, p_booking_id)
  ON CONFLICT (event_key) DO NOTHING
  RETURNING id INTO v_inserted;

  IF v_inserted IS NULL THEN
    RETURN 'duplicate';
  END IF;

  -- Persist booking outcome atomically
  UPDATE public.pending_bookings
  SET status = p_outcome
  WHERE id = p_booking_id
  RETURNING id INTO v_booking_id;

  IF v_booking_id IS NULL THEN
    DELETE FROM public.elevenlabs_webhook_events
    WHERE id = v_inserted;
    RETURN 'booking_missing';
  END IF;

  -- Atomically persist SMS delivery intent so no window exists between booking
  -- state commit and the outbox row, even if the caller crashes before the next
  -- RPC.  Only inserted when phone and message are supplied; callers that do not
  -- pass SMS parameters fall back to the separate enqueue_booking_sms_job RPC.
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
  'Claims an ElevenLabs webhook event once and atomically persists the booking outcome '
  'and (optionally) the SMS outbox row in a single transaction.';

REVOKE ALL ON FUNCTION public.process_elevenlabs_event_idempotent(text, uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_elevenlabs_event_idempotent(text, uuid, text, text, text) TO service_role;
