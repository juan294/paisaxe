-- PayPal hackathon plan, Phase 5 review (finding R0, second pass): a booking
-- whose cancellation was confirmed is never confirmed again. Every capture
-- path (return page, CHECKOUT.ORDER.APPROVED and PAYMENT.CAPTURE.COMPLETED
-- webhooks, reconciliation) reaches consume_hold_and_confirm, and on a lapsed
-- hold reacquire_hold. For such a booking the hold is consumed, so
-- reacquire_hold returned false and the captured payment was compensated: a
-- full refund, even for a cancellation that refunds nothing. Both now raise
-- invalid_state, which the capture code treats as "compensating" with no
-- refund call.

CREATE OR REPLACE FUNCTION public.consume_hold_and_confirm(
  p_booking_id uuid,
  p_capture_id text
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_booking public.bookings;
  v_hold public.holds;
  v_payment_id uuid;
BEGIN
  IF p_capture_id IS NULL OR p_capture_id = '' THEN
    RAISE EXCEPTION 'invalid_input';
  END IF;

  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found';
  END IF;

  PERFORM 1 FROM public.experiences WHERE id = v_booking.experience_id FOR UPDATE;

  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;

  IF v_booking.status = 'confirmed' THEN
    IF EXISTS (
      SELECT 1 FROM public.payments
      WHERE booking_id = p_booking_id AND capture_id = p_capture_id
    ) THEN
      RETURN 'already_confirmed';
    END IF;
    RAISE EXCEPTION 'capture_mismatch';
  END IF;

  IF v_booking.status NOT IN ('pending_payment', 'needs_attention', 'expired')
     OR v_booking.cancellation_confirmed_at IS NOT NULL
     OR EXISTS (
       SELECT 1 FROM public.payments p
       WHERE p.booking_id = p_booking_id
         AND (p.status IN ('refund_pending', 'refunded', 'refund_failed')
              OR p.compensation_reason IS NOT NULL)
     ) THEN
    RAISE EXCEPTION 'invalid_state';
  END IF;

  SELECT * INTO v_hold FROM public.holds WHERE id = v_booking.hold_id FOR UPDATE;
  IF v_hold.consumed_at IS NOT NULL OR v_hold.released_at IS NOT NULL
     OR v_hold.expires_at <= clock_timestamp() THEN
    RAISE EXCEPTION 'hold_not_live';
  END IF;

  SELECT id INTO v_payment_id
  FROM public.payments
  WHERE booking_id = p_booking_id
    AND (
      (capture_id = p_capture_id AND status IN ('created', 'approved', 'capture_pending', 'captured'))
      OR (capture_id IS NULL AND status IN ('created', 'approved', 'capture_pending'))
    )
  ORDER BY (capture_id IS NOT DISTINCT FROM p_capture_id) DESC, created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_payment_id IS NULL THEN
    RAISE EXCEPTION 'payment_not_found';
  END IF;

  UPDATE public.holds SET consumed_at = now() WHERE id = v_hold.id;

  UPDATE public.bookings
  SET status = 'confirmed', confirmed_at = now()
  WHERE id = p_booking_id;

  UPDATE public.payments
  SET status = 'captured', capture_id = p_capture_id, captured_at = coalesce(captured_at, now())
  WHERE id = v_payment_id;

  RETURN 'confirmed';
END;
$$;

CREATE OR REPLACE FUNCTION public.reacquire_hold(
  p_booking_id uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_booking public.bookings;
  v_hold public.holds;
  v_available integer;
BEGIN
  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found';
  END IF;

  PERFORM 1 FROM public.experiences WHERE id = v_booking.experience_id FOR UPDATE;

  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  SELECT * INTO v_hold FROM public.holds WHERE id = v_booking.hold_id FOR UPDATE;

  -- A confirmed cancellation is never re-confirmed: before the consumed check,
  -- whose false would send a captured payment to compensation.
  IF v_booking.cancellation_confirmed_at IS NOT NULL THEN
    RAISE EXCEPTION 'invalid_state';
  END IF;

  -- Already handed to a confirmed booking: the booking owns the capacity.
  IF v_hold.consumed_at IS NOT NULL THEN
    RETURN v_booking.status = 'confirmed';
  END IF;

  IF v_booking.status NOT IN ('pending_payment', 'needs_attention', 'expired')
     OR EXISTS (
       SELECT 1 FROM public.payments p
       WHERE p.booking_id = p_booking_id
         AND (p.status IN ('refund_pending', 'refunded', 'refund_failed')
              OR p.compensation_reason IS NOT NULL)
     ) THEN
    RAISE EXCEPTION 'invalid_state';
  END IF;

  -- Still live: only extend.
  IF v_hold.released_at IS NULL AND v_hold.expires_at > clock_timestamp() THEN
    UPDATE public.holds
    SET expires_at = greatest(expires_at, clock_timestamp() + interval '10 minutes')
    WHERE id = v_hold.id;
    RETURN true;
  END IF;

  -- Lapsed or released: this hold no longer counts, so availability excludes it.
  SELECT a.available INTO v_available
  FROM public.experience_availability(v_booking.experience_id, v_booking.slot_date) a
  WHERE a.start_time = v_booking.slot_time;

  -- experience_availability reads the transaction-start now(), so a hold that
  -- lapsed while this call waited for the lock is still counted there. That
  -- hold is this booking's own: give its places back (R1).
  IF v_hold.released_at IS NULL AND v_hold.expires_at > now() THEN
    v_available := v_available + v_booking.party_size;
  END IF;

  IF v_available IS NULL OR v_booking.party_size > v_available THEN
    RETURN false;
  END IF;

  UPDATE public.holds
  SET expires_at = clock_timestamp() + interval '10 minutes', released_at = NULL
  WHERE id = v_hold.id;
  RETURN true;
END;
$$;


REVOKE ALL ON FUNCTION public.consume_hold_and_confirm(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_hold_and_confirm(uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public.reacquire_hold(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reacquire_hold(uuid) TO service_role;

