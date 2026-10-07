-- ============================================================================
-- Migration: 118_voucher_redemption.sql
-- Purpose: Atomic voucher redemption and metering for the booking demo
--          (PayPal hackathon plan, Phase 2).
--
--   vouchers.revoked_at                     replacement procedure: a revoked code is invalid
--   grant_voucher_voice_pass_idempotent     gains p_now (default now()) so the pass window
--                                           is judged on the caller's clock
--   redeem_voucher(code_hash, user, now, pass_until)
--                                           one transaction: lock the voucher, serve an
--                                           existing redemption even at the cap (F13),
--                                           otherwise enforce max_redemptions, insert,
--                                           and grant the voice pass. A failed grant
--                                           rolls the redemption back.
--   consume_voucher_counter                 now returns {allowed, remaining}
--
-- Expiry is judged against p_now, supplied by the server, so the date-advanced
-- tests (judging on Dec 1 to 15) exercise the same code path as production.
-- ============================================================================

ALTER TABLE public.vouchers
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz;

-- ---------------------------------------------------------------------------
-- grant_voucher_voice_pass_idempotent with an explicit clock.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.grant_voucher_voice_pass_idempotent(uuid, timestamptz);

CREATE OR REPLACE FUNCTION public.grant_voucher_voice_pass_idempotent(
  p_redemption_id uuid,
  p_until timestamptz,
  p_now timestamptz DEFAULT now()
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_grants boolean;
  v_provider_id text := 'voucher:' || p_redemption_id::text;
  v_existing_expiry timestamptz;
BEGIN
  SELECT r.user_id, v.grants_voice_pass
  INTO v_user_id, v_grants
  FROM public.voucher_redemptions r
  JOIN public.vouchers v ON v.id = r.voucher_id
  WHERE r.id = p_redemption_id
  FOR UPDATE OF r;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found';
  END IF;

  IF NOT v_grants THEN
    RETURN 'not_included';
  END IF;

  SELECT expires_at INTO v_existing_expiry
  FROM public.voice_purchases
  WHERE payment_provider_id = v_provider_id
  FOR UPDATE;

  IF FOUND AND v_existing_expiry > p_now THEN
    RETURN 'duplicate';
  END IF;

  IF FOUND THEN
    UPDATE public.voice_purchases
    SET expires_at = p_until
    WHERE payment_provider_id = v_provider_id;
  ELSE
    INSERT INTO public.voice_purchases (user_id, purchase_type, payment_provider_id, expires_at, amount_paid)
    VALUES (v_user_id, 'voucher_pass', v_provider_id, p_until, 0);
  END IF;

  UPDATE public.voucher_redemptions
  SET voice_pass_until = p_until, voice_pass_grants = voice_pass_grants + 1
  WHERE id = p_redemption_id;

  RETURN 'granted';
END;
$$;

COMMENT ON FUNCTION public.grant_voucher_voice_pass_idempotent(uuid, timestamptz, timestamptz) IS
  'Grants or renews the voucher voice pass (voice_purchases, purchase_type voucher_pass, amount_paid 0, payment_provider_id voucher:<redemption id>). Returns granted, duplicate (pass still active at p_now) or not_included. Audited on voucher_redemptions, never on stripe_webhook_events.';

-- ---------------------------------------------------------------------------
-- redeem_voucher
-- Returns jsonb:
--   {"status": "invalid" | "expired" | "exhausted"}
--   {"status": "new" | "existing", "redemption_id", "voice_pass": granted|duplicate|not_included,
--    "voice_pass_until", "chat_turns_used", "chat_turns_limit",
--    "booking_attempts_used", "booking_attempts_limit"}
-- A revoked voucher is reported as invalid, so a leaked code reveals nothing.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.redeem_voucher(
  p_code_hash text,
  p_user_id uuid,
  p_now timestamptz,
  p_pass_until timestamptz
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_voucher public.vouchers;
  v_redemption public.voucher_redemptions;
  v_status text := 'existing';
  v_voice_pass text;
BEGIN
  -- Locking the voucher serializes redemptions of the same code, so the cap
  -- check and the insert below cannot interleave.
  SELECT * INTO v_voucher FROM public.vouchers WHERE code_hash = p_code_hash FOR UPDATE;
  IF NOT FOUND OR v_voucher.revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'invalid');
  END IF;

  IF v_voucher.expires_at <= p_now THEN
    RETURN jsonb_build_object('status', 'expired');
  END IF;

  SELECT * INTO v_redemption
  FROM public.voucher_redemptions
  WHERE voucher_id = v_voucher.id AND user_id = p_user_id;

  IF NOT FOUND THEN
    IF (SELECT count(*) FROM public.voucher_redemptions WHERE voucher_id = v_voucher.id)
       >= v_voucher.max_redemptions THEN
      RETURN jsonb_build_object('status', 'exhausted');
    END IF;

    INSERT INTO public.voucher_redemptions (voucher_id, user_id)
    VALUES (v_voucher.id, p_user_id)
    RETURNING * INTO v_redemption;
    v_status := 'new';
  END IF;

  -- Any failure here (for example a missing user profile) aborts the whole
  -- function, so a redemption never exists without its grant attempt.
  v_voice_pass := public.grant_voucher_voice_pass_idempotent(v_redemption.id, p_pass_until, p_now);

  SELECT * INTO v_redemption FROM public.voucher_redemptions WHERE id = v_redemption.id;

  RETURN jsonb_build_object(
    'status', v_status,
    'redemption_id', v_redemption.id,
    'voice_pass', v_voice_pass,
    'voice_pass_until', CASE WHEN v_voice_pass = 'not_included' THEN NULL ELSE v_redemption.voice_pass_until END,
    'chat_turns_used', v_redemption.chat_turns_used,
    'chat_turns_limit', v_voucher.chat_turns_limit,
    'booking_attempts_used', v_redemption.booking_attempts_used,
    'booking_attempts_limit', v_voucher.booking_attempts_limit
  );
END;
$$;

COMMENT ON FUNCTION public.redeem_voucher(text, uuid, timestamptz, timestamptz) IS
  'Redeems a voucher (by SHA-256 code hash) for a user in one transaction: serves an existing redemption even at the cap, otherwise enforces max_redemptions, inserts the redemption and grants or renews the voice pass. Returns a jsonb status object.';

-- ---------------------------------------------------------------------------
-- consume_voucher_counter: same contract, richer result.
-- Returns {"allowed": boolean, "remaining": integer}.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.consume_voucher_counter(uuid, text);

CREATE OR REPLACE FUNCTION public.consume_voucher_counter(
  p_redemption_id uuid,
  p_counter text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_remaining integer;
BEGIN
  IF p_counter = 'chat_turns' THEN
    UPDATE public.voucher_redemptions r
    SET chat_turns_used = r.chat_turns_used + 1
    FROM public.vouchers v
    WHERE r.id = p_redemption_id
      AND v.id = r.voucher_id
      AND r.chat_turns_used < v.chat_turns_limit
    RETURNING v.chat_turns_limit - r.chat_turns_used INTO v_remaining;
  ELSIF p_counter = 'booking_attempts' THEN
    UPDATE public.voucher_redemptions r
    SET booking_attempts_used = r.booking_attempts_used + 1
    FROM public.vouchers v
    WHERE r.id = p_redemption_id
      AND v.id = r.voucher_id
      AND r.booking_attempts_used < v.booking_attempts_limit
    RETURNING v.booking_attempts_limit - r.booking_attempts_used INTO v_remaining;
  ELSE
    RAISE EXCEPTION 'invalid_counter';
  END IF;

  IF v_remaining IS NOT NULL THEN
    RETURN jsonb_build_object('allowed', true, 'remaining', v_remaining);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.voucher_redemptions WHERE id = p_redemption_id) THEN
    RAISE EXCEPTION 'not_found';
  END IF;

  RETURN jsonb_build_object('allowed', false, 'remaining', 0);
END;
$$;

COMMENT ON FUNCTION public.consume_voucher_counter(uuid, text) IS
  'Spends one unit of a redemption allowance (chat_turns or booking_attempts) if below the voucher limit. Returns {allowed, remaining}; raises invalid_counter or not_found.';

REVOKE ALL ON FUNCTION public.grant_voucher_voice_pass_idempotent(uuid, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_voucher_voice_pass_idempotent(uuid, timestamptz, timestamptz) TO service_role;

REVOKE ALL ON FUNCTION public.redeem_voucher(text, uuid, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_voucher(text, uuid, timestamptz, timestamptz) TO service_role;

REVOKE ALL ON FUNCTION public.consume_voucher_counter(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_voucher_counter(uuid, text) TO service_role;
