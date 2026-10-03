-- ============================================================================
-- Migration: 114_vouchers.sql
-- Purpose: Voucher access for the booking demo (PayPal hackathon plan,
--          design "Access and identity" items 1 to 3).
--
--   vouchers             code stored as a SHA-256 hex hash, never in clear
--   voucher_redemptions  one row per (voucher, user); holds the metering counters
--   voice_purchases      purchase_type widened with 'voucher_pass'
--   grant_voucher_voice_pass_idempotent(redemption, until)
--   consume_voucher_counter(redemption, counter)
--
-- A voucher's voice pass is written to voice_purchases with
-- purchase_type = 'voucher_pass', amount_paid = 0 and
-- payment_provider_id = 'voucher:<redemption id>'. It is audited on
-- voucher_redemptions and never touches stripe_webhook_events. Renewal after
-- the pass lapses updates the same row (payment_provider_id is UNIQUE).
--
-- Voice minutes are NOT metered (plan F13); max_redemptions limits distinct
-- guest identities only.
-- ============================================================================

CREATE TABLE public.vouchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash text NOT NULL UNIQUE CHECK (code_hash ~ '^[0-9a-f]{64}$'),
  label text NOT NULL,
  expires_at timestamptz NOT NULL,
  max_redemptions integer NOT NULL DEFAULT 50 CHECK (max_redemptions > 0),
  chat_turns_limit integer NOT NULL DEFAULT 60 CHECK (chat_turns_limit >= 0),
  booking_attempts_limit integer NOT NULL DEFAULT 10 CHECK (booking_attempts_limit >= 0),
  -- false issues a voucher without the voice pass (F13 fallback).
  grants_voice_pass boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.voucher_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id uuid NOT NULL REFERENCES public.vouchers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chat_turns_used integer NOT NULL DEFAULT 0 CHECK (chat_turns_used >= 0),
  booking_attempts_used integer NOT NULL DEFAULT 0 CHECK (booking_attempts_used >= 0),
  voice_pass_until timestamptz,
  voice_pass_grants integer NOT NULL DEFAULT 0 CHECK (voice_pass_grants >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT voucher_redemptions_voucher_user_unique UNIQUE (voucher_id, user_id)
);

CREATE INDEX idx_voucher_redemptions_user_id ON public.voucher_redemptions(user_id);

CREATE TRIGGER vouchers_updated_at BEFORE UPDATE ON public.vouchers
  FOR EACH ROW EXECUTE FUNCTION public.set_booking_updated_at();
CREATE TRIGGER voucher_redemptions_updated_at BEFORE UPDATE ON public.voucher_redemptions
  FOR EACH ROW EXECUTE FUNCTION public.set_booking_updated_at();

ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.vouchers FROM anon;
REVOKE ALL ON TABLE public.vouchers FROM authenticated;
GRANT ALL ON TABLE public.vouchers TO service_role;
CREATE POLICY "Service role can manage vouchers"
  ON public.vouchers FOR ALL TO service_role
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

ALTER TABLE public.voucher_redemptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.voucher_redemptions FROM anon;
REVOKE ALL ON TABLE public.voucher_redemptions FROM authenticated;
GRANT ALL ON TABLE public.voucher_redemptions TO service_role;
CREATE POLICY "Service role can manage voucher_redemptions"
  ON public.voucher_redemptions FOR ALL TO service_role
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ---------------------------------------------------------------------------
-- Widen voice_purchases.purchase_type (pattern: migration 099).
-- Readers already treat any unexpired row as access-granting.
-- ---------------------------------------------------------------------------
ALTER TABLE public.voice_purchases
  DROP CONSTRAINT IF EXISTS voice_purchases_purchase_type_check;

ALTER TABLE public.voice_purchases
  ADD CONSTRAINT voice_purchases_purchase_type_check
  CHECK (purchase_type IN ('day_pass', 'weekly_pass', 'monthly_pass', 'voucher_pass'))
  NOT VALID;

ALTER TABLE public.voice_purchases
  VALIDATE CONSTRAINT voice_purchases_purchase_type_check;

-- ---------------------------------------------------------------------------
-- grant_voucher_voice_pass_idempotent: 'granted' when a pass was written or
-- renewed, 'duplicate' while the redemption's pass is still active,
-- 'not_included' when the voucher carries no voice pass. The redemption row is
-- locked first, so concurrent calls serialize.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.grant_voucher_voice_pass_idempotent(
  p_redemption_id uuid,
  p_until timestamptz
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

  IF FOUND AND v_existing_expiry > now() THEN
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

COMMENT ON FUNCTION public.grant_voucher_voice_pass_idempotent(uuid, timestamptz) IS
  'Grants or renews the voucher voice pass (voice_purchases, purchase_type voucher_pass, amount_paid 0, payment_provider_id voucher:<redemption id>). Returns granted, duplicate (pass still active) or not_included. Audited on voucher_redemptions, never on stripe_webhook_events.';

-- ---------------------------------------------------------------------------
-- consume_voucher_counter: atomically spends one unit of a metered allowance.
-- p_counter is 'chat_turns' or 'booking_attempts'. Returns 'consumed' or
-- 'limit_reached'.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.consume_voucher_counter(
  p_redemption_id uuid,
  p_counter text
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_updated uuid;
BEGIN
  IF p_counter = 'chat_turns' THEN
    UPDATE public.voucher_redemptions r
    SET chat_turns_used = r.chat_turns_used + 1
    FROM public.vouchers v
    WHERE r.id = p_redemption_id
      AND v.id = r.voucher_id
      AND r.chat_turns_used < v.chat_turns_limit
    RETURNING r.id INTO v_updated;
  ELSIF p_counter = 'booking_attempts' THEN
    UPDATE public.voucher_redemptions r
    SET booking_attempts_used = r.booking_attempts_used + 1
    FROM public.vouchers v
    WHERE r.id = p_redemption_id
      AND v.id = r.voucher_id
      AND r.booking_attempts_used < v.booking_attempts_limit
    RETURNING r.id INTO v_updated;
  ELSE
    RAISE EXCEPTION 'invalid_counter';
  END IF;

  IF v_updated IS NOT NULL THEN
    RETURN 'consumed';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.voucher_redemptions WHERE id = p_redemption_id) THEN
    RAISE EXCEPTION 'not_found';
  END IF;

  RETURN 'limit_reached';
END;
$$;

COMMENT ON FUNCTION public.consume_voucher_counter(uuid, text) IS
  'Spends one unit of a redemption allowance (chat_turns or booking_attempts) if below the voucher limit. Returns consumed or limit_reached; raises invalid_counter or not_found.';

REVOKE ALL ON FUNCTION public.grant_voucher_voice_pass_idempotent(uuid, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_voucher_voice_pass_idempotent(uuid, timestamptz) TO service_role;

REVOKE ALL ON FUNCTION public.consume_voucher_counter(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_voucher_counter(uuid, text) TO service_role;
