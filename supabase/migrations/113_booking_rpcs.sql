-- ============================================================================
-- Migration: 113_booking_rpcs.sql
-- Purpose: Inventory and acceptance RPCs for the booking domain (migration 112).
--
--   experience_availability(experience, date)  capacity left per start time
--   accept_quote(quote, user)                  atomic, idempotent acceptance
--   reacquire_hold(booking)                    capture path, hold lapsed after approval
--   consume_hold_and_confirm(booking, capture) hands inventory to the booking
--   expire_holds()                             expires unpaid bookings whose hold lapsed
--
-- Errors are raised with a bare code as the message (not_found, quote_expired,
-- no_capacity, hold_not_live, invalid_state, invalid_input, capture_mismatch,
-- payment_not_found); src/lib/booking maps them to BookingError codes.
--
-- Security: SECURITY DEFINER + SET search_path = '' with fully qualified
-- references; EXECUTE revoked from PUBLIC, anon and authenticated and granted
-- to service_role only (migrations 099, 110).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- experience_availability: capacity − Σ party of confirmed bookings − Σ party
-- of live holds, per start time of the slot rule on that weekday (F04).
-- A pending_payment booking is represented only by its hold. A slot that has
-- already started (in the merchant's timezone) reports 0.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.experience_availability(
  p_experience_id uuid,
  p_date date
) RETURNS TABLE (start_time time, available integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH slots AS (
    SELECT e.id, e.capacity_per_slot, m.timezone, t.value::time AS start_time
    FROM public.experiences e
    JOIN public.merchants m ON m.id = e.merchant_id
    CROSS JOIN LATERAL jsonb_array_elements_text(e.slot_rule -> 'start_times') AS t(value)
    WHERE e.id = p_experience_id
      AND e.active
      AND (e.slot_rule -> 'weekdays') @> to_jsonb(extract(isodow FROM p_date)::int)
  )
  SELECT
    s.start_time,
    CASE
      WHEN ((p_date + s.start_time) AT TIME ZONE s.timezone) <= now() THEN 0
      ELSE greatest(0,
        s.capacity_per_slot
        - COALESCE((
            SELECT sum(b.party_size)
            FROM public.bookings b
            WHERE b.experience_id = s.id
              AND b.slot_date = p_date
              AND b.slot_time = s.start_time
              AND b.status = 'confirmed'
          ), 0)
        - COALESCE((
            SELECT sum(h.party_size)
            FROM public.holds h
            WHERE h.experience_id = s.id
              AND h.slot_date = p_date
              AND h.slot_time = s.start_time
              AND h.expires_at > now()
              AND h.released_at IS NULL
              AND h.consumed_at IS NULL
          ), 0)
      )::integer
    END AS available
  FROM slots s
  ORDER BY s.start_time;
$$;

COMMENT ON FUNCTION public.experience_availability(uuid, date) IS
  'Places left per start time (never negative): capacity minus confirmed bookings minus live holds. Started slots report 0. One inventory owner per stage (F04).';

-- ---------------------------------------------------------------------------
-- accept_quote: one transaction that locks the experience, checks capacity,
-- inserts the hold and the booking, stamps the quote and closes the draft.
-- Idempotent: an existing booking for the quote is returned, checked before
-- the lock (fast path) and AGAIN after acquiring it (R2-03), because two
-- concurrent accepts can both pass the fast path. The unique(quote_id)
-- constraints on holds and bookings are the final backstop.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accept_quote(
  p_quote_id uuid,
  p_user_id uuid
) RETURNS public.bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_quote public.quotes;
  v_booking public.bookings;
  v_available integer;
  v_hold_id uuid;
BEGIN
  SELECT * INTO v_quote FROM public.quotes WHERE id = p_quote_id;
  -- A quote whose owner was deleted (user_id NULL) is never acceptable.
  IF NOT FOUND OR (v_quote.user_id = p_user_id) IS NOT TRUE THEN
    RAISE EXCEPTION 'not_found';
  END IF;

  -- 1. Fast path.
  SELECT * INTO v_booking FROM public.bookings WHERE quote_id = p_quote_id;
  IF FOUND THEN
    RETURN v_booking;
  END IF;

  -- 2. Serialize acceptance per experience.
  PERFORM 1 FROM public.experiences WHERE id = v_quote.experience_id FOR UPDATE;

  -- 3. Recheck inside the lock: a concurrent first request may have committed
  --    while this one waited (READ COMMITTED: this statement sees it).
  SELECT * INTO v_booking FROM public.bookings WHERE quote_id = p_quote_id;
  IF FOUND THEN
    RETURN v_booking;
  END IF;

  -- 4. Validity, on a fresh read of the quote under its row lock: a
  --    concurrent createQuote may have superseded it while this one waited.
  SELECT * INTO v_quote FROM public.quotes WHERE id = p_quote_id FOR UPDATE;
  IF v_quote.superseded_at IS NOT NULL OR v_quote.accepted_at IS NOT NULL
     OR v_quote.expires_at <= clock_timestamp() THEN
    RAISE EXCEPTION 'quote_expired';
  END IF;

  -- 5. Capacity for the slot.
  SELECT a.available INTO v_available
  FROM public.experience_availability(v_quote.experience_id, v_quote.slot_date) a
  WHERE a.start_time = v_quote.slot_time;

  IF v_available IS NULL OR v_quote.party_size > v_available THEN
    RAISE EXCEPTION 'no_capacity';
  END IF;

  -- 6. Hold, booking, quote stamp, draft closed.
  BEGIN
    INSERT INTO public.holds (quote_id, experience_id, slot_date, slot_time, party_size, expires_at)
    VALUES (
      v_quote.id, v_quote.experience_id, v_quote.slot_date, v_quote.slot_time,
      v_quote.party_size, now() + interval '15 minutes'
    )
    RETURNING id INTO v_hold_id;

    INSERT INTO public.bookings (
      reference, user_id, quote_id, hold_id, experience_id, slot_date, slot_time,
      party_size, total_cents, deposit_cents, currency, cancellation_window_hours
    ) VALUES (
      'RS-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)),
      p_user_id, v_quote.id, v_hold_id, v_quote.experience_id, v_quote.slot_date,
      v_quote.slot_time, v_quote.party_size, v_quote.total_cents, v_quote.deposit_cents,
      v_quote.currency, v_quote.cancellation_window_hours
    )
    RETURNING * INTO v_booking;
  EXCEPTION
    WHEN unique_violation THEN
      -- Belt and braces: another transaction committed a booking for this quote.
      SELECT * INTO v_booking FROM public.bookings WHERE quote_id = p_quote_id;
      IF FOUND THEN
        RETURN v_booking;
      END IF;
      RAISE;
  END;

  UPDATE public.quotes SET accepted_at = now() WHERE id = v_quote.id;

  IF v_quote.draft_id IS NOT NULL THEN
    UPDATE public.booking_drafts SET status = 'accepted'
    WHERE id = v_quote.draft_id AND status = 'open';
  END IF;

  RETURN v_booking;
END;
$$;

COMMENT ON FUNCTION public.accept_quote(uuid, uuid) IS
  'Atomically accepts a quote: one hold (15 min) and one pending_payment booking per quote. Idempotent: returns the existing booking on retry or concurrent accept (R2-03). Raises not_found, quote_expired or no_capacity.';

-- ---------------------------------------------------------------------------
-- Both capture-path functions below lock the experience row first, in the
-- same order as accept_quote, and judge hold liveness with clock_timestamp()
-- after the lock. A hold that expires while a caller waits is therefore never
-- treated as live by one transaction while accept_quote hands its places to
-- another (review finding 2, F04).
--
-- Neither touches a booking under compensation: once a payment is
-- refund_pending, refunded or refund_failed, or carries a compensation_reason,
-- the refund is the outcome and the booking cannot be re-confirmed (review
-- finding 1).
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- reacquire_hold: used only by the capture path when the buyer approved and
-- the hold then lapsed. Re-takes capacity for the same slot if it is still
-- there and extends the hold by 10 minutes.
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- consume_hold_and_confirm: the hand-over from hold to confirmed booking, in
-- one transaction. The capture id is persisted on the payment before this is
-- called; a payment row without one is claimed as a fallback.
-- ---------------------------------------------------------------------------
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

COMMENT ON FUNCTION public.consume_hold_and_confirm(uuid, text) IS
  'Consumes the live hold and confirms the booking and its payment in one transaction, under the experience lock. Returns confirmed or already_confirmed; raises hold_not_live (caller re-acquires or compensates), capture_mismatch, invalid_state (terminal or compensating booking), invalid_input (no capture id), payment_not_found or not_found.';

-- ---------------------------------------------------------------------------
-- expire_holds: marks pending_payment bookings expired once their hold is no
-- longer live AND no PayPal order exists that could still be approved or
-- captured. Bookings with such a payment are left to reconciliation, which
-- asks PayPal first. Capacity was already freed when the hold lapsed.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.expire_holds()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.bookings b
  SET status = 'expired'
  FROM public.holds h
  WHERE h.id = b.hold_id
    AND b.status = 'pending_payment'
    AND h.consumed_at IS NULL
    AND (h.released_at IS NOT NULL OR h.expires_at <= now())
    AND NOT EXISTS (
      SELECT 1 FROM public.payments p
      WHERE p.booking_id = b.id
        AND p.status NOT IN ('expired', 'capture_failed')
    );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.expire_holds() IS
  'Expires pending_payment bookings whose hold lapsed and that have no live PayPal payment. Returns the number of bookings expired.';

-- ---------------------------------------------------------------------------
-- Privileges: service_role only.
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.experience_availability(uuid, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.experience_availability(uuid, date) TO service_role;

REVOKE ALL ON FUNCTION public.accept_quote(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_quote(uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.reacquire_hold(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reacquire_hold(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.consume_hold_and_confirm(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_hold_and_confirm(uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public.expire_holds() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_holds() TO service_role;
