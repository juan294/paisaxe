-- PayPal hackathon plan, Phase 5: visitor cancellation in two steps (F01, R2-05).
--
-- cancellation_terms is read-only: the refund a cancellation would give at an
-- instant (the full deposit before slot start minus cancellation_window_hours
-- in the merchant's time zone, nothing after). The preview tool and the
-- booking page show it; it writes nothing.
--
-- confirm_cancellation is the only writer of cancellation_confirmed_at. It
-- locks the booking, recomputes the terms at that instant and compares them
-- with the refund the visitor was shown: a difference writes nothing and
-- returns the fresh terms (terms_changed). Otherwise one UPDATE records the
-- confirmation and the server's refund: cancel_pending when a refund is due
-- (the caller requests it; reconciliation retries it with the payment's key),
-- cancelled when none is. A booking that is no longer confirmed is returned
-- as it is (with whether a cancellation was confirmed), so a second confirm
-- changes nothing. Inventory returns by itself:
-- availability counts only confirmed bookings and live holds.
--
-- p_now exists for tests at the cutoff; the application never passes it.

CREATE OR REPLACE FUNCTION public.cancellation_terms(
  p_booking_id uuid,
  p_now timestamptz DEFAULT NULL
) RETURNS TABLE (refund_cents integer, slot_start timestamptz, refund_until timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    CASE WHEN coalesce(p_now, clock_timestamp()) < t.refund_until THEN b.deposit_cents ELSE 0 END,
    t.slot_start,
    t.refund_until
  FROM public.bookings b
  JOIN public.experiences e ON e.id = b.experience_id
  JOIN public.merchants m ON m.id = e.merchant_id
  CROSS JOIN LATERAL (
    SELECT
      (b.slot_date + b.slot_time) AT TIME ZONE m.timezone AS slot_start,
      ((b.slot_date + b.slot_time) AT TIME ZONE m.timezone) - make_interval(hours => b.cancellation_window_hours) AS refund_until
  ) t
  WHERE b.id = p_booking_id;
$$;

COMMENT ON FUNCTION public.cancellation_terms(uuid, timestamptz) IS
  'Read-only cancellation terms at an instant: the deposit before slot start minus cancellation_window_hours (merchant time zone), else 0. Writes nothing (F01).';

CREATE OR REPLACE FUNCTION public.confirm_cancellation(
  p_booking_id uuid,
  p_expected_refund_cents integer,
  p_now timestamptz DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_booking public.bookings;
  v_now timestamptz := coalesce(p_now, clock_timestamp());
  v_terms record;
  v_status text;
BEGIN
  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found';
  END IF;

  IF v_booking.status <> 'confirmed' THEN
    RETURN jsonb_build_object(
      'outcome', 'unchanged',
      'status', v_booking.status,
      'refund_cents', v_booking.refund_cents,
      'cancellation_confirmed', v_booking.cancellation_confirmed_at IS NOT NULL
    );
  END IF;

  SELECT * INTO v_terms FROM public.cancellation_terms(p_booking_id, v_now);

  IF p_expected_refund_cents IS DISTINCT FROM v_terms.refund_cents THEN
    RETURN jsonb_build_object(
      'outcome', 'terms_changed',
      'status', v_booking.status,
      'refund_cents', v_terms.refund_cents,
      'slot_start', v_terms.slot_start,
      'refund_until', v_terms.refund_until
    );
  END IF;

  v_status := CASE WHEN v_terms.refund_cents > 0 THEN 'cancel_pending' ELSE 'cancelled' END;
  UPDATE public.bookings
  SET status = v_status,
      cancellation_confirmed_at = v_now,
      refund_cents = v_terms.refund_cents
  WHERE id = p_booking_id;

  RETURN jsonb_build_object('outcome', 'cancelled', 'status', v_status, 'refund_cents', v_terms.refund_cents);
END;
$$;

COMMENT ON FUNCTION public.confirm_cancellation(uuid, integer, timestamptz) IS
  'The only writer of cancellation_confirmed_at: recomputes the refund, refuses with the fresh terms if it differs from the expected one (R2-05), else sets cancel_pending (refund due) or cancelled. Idempotent by state.';

REVOKE ALL ON FUNCTION public.cancellation_terms(uuid, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancellation_terms(uuid, timestamptz) TO service_role;

REVOKE ALL ON FUNCTION public.confirm_cancellation(uuid, integer, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_cancellation(uuid, integer, timestamptz) TO service_role;
