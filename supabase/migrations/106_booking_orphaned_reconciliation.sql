-- BE-H2: Timed-out booking calls were unrecoverable. `fail_stale_initiating_bookings`
-- previously flipped every stale 'initiating' row straight to the terminal
-- 'failed' status with no lookup — including calls that may have actually
-- reached the venue (the fetch to ElevenLabs timed out on OUR side; we never
-- learned whether ElevenLabs accepted the call). That silently discarded
-- bookings with zero operator visibility.
--
-- Fix: stale 'initiating' rows now move to a distinct 'orphaned' status
-- instead of 'failed', so they read as "needs attention" rather than
-- "definitely didn't happen". A late-arriving ElevenLabs webhook can still
-- reconcile an 'orphaned' row: src/app/api/mcp/make-booking/route.ts now
-- sends the pending_bookings row id as an extra `booking_id` dynamic
-- variable on every outbound call (persisted before the call is placed), and
-- the webhook handler (src/app/api/webhooks/elevenlabs/route.ts) falls back
-- to looking up that id when the primary conversation_id lookup finds
-- nothing. Matching on our own primary key id makes the fallback lookup
-- unambiguous by construction — it cannot let one webhook event match two
-- bookings, so the existing unique index on conversation_id
-- (idx_pending_bookings_conversation_id) is unaffected.
--
-- pending_bookings.status has no CHECK constraint (free text, see
-- 053_pending_bookings.sql), so no schema change is needed to introduce the
-- new value.

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
    status = 'orphaned',
    updated_at = now()
  WHERE status = 'initiating'
    AND created_at < now() - (p_stale_minutes || ' minutes')::interval;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.fail_stale_initiating_bookings(integer) IS
  'Marks bookings stuck in initiating longer than the configured threshold as orphaned (not failed) so operators can reconcile them; a late webhook may still resolve the row via its booking_id fallback lookup.';
