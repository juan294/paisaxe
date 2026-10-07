-- PayPal hackathon plan, Phase 4 entry condition (R1 from the Phase 1
-- re-review): reacquire_hold's lapsed branch read availability that still
-- counted the booking's own hold when it expired between transaction start
-- and the lock. Safe (never overbooks) but it could refund a captured payment
-- with places free. Only the lapsed branch changes.

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
COMMENT ON FUNCTION public.reacquire_hold(uuid) IS
  'Capture path only: re-takes capacity for a booking whose hold lapsed after the buyer approved. Returns true and extends the hold 10 min, or false when the slot is gone. Raises invalid_state for a booking in a terminal state or under compensation.';

REVOKE ALL ON FUNCTION public.reacquire_hold(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reacquire_hold(uuid) TO service_role;
