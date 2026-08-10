-- Migration: BE-M3 — align the Stripe webhook audit row with its intended shape
--
-- Bug (BE-M3):
--   stripe_webhook_events (migration 077) was created with only
--   (id, event_id, created_at). The atomic RPC grant_day_pass_idempotent
--   (migration 084) therefore claimed the event_id but recorded NONE of the
--   audit context (event type, payer, amount, expiry) that the audit trail is
--   supposed to capture. The route had the data but no column to put it in, so
--   the audit log was effectively empty.
--
-- Fix:
--   1. Widen public.stripe_webhook_events with the intended audit columns
--      (event_type, user_id, payment_provider_id, amount_paid, expires_at).
--      All additive + idempotent so the migration is safe to re-run.
--   2. Redefine grant_day_pass_idempotent to accept p_event_type and persist
--      the full audit context onto the dedup/audit row in the SAME atomic
--      INSERT. The BE-B2 atomicity invariant from migration 084 is preserved:
--      the voice_purchases insert is still wrapped in an explicit sub-block
--      that re-raises so a failure rolls back the audit row and Stripe retries.
--
-- Security:
--   SECURITY DEFINER + SET search_path = '' with fully-qualified references.
--   EXECUTE granted only to service_role.

-- 1. Widen the audit table to the intended shape.
ALTER TABLE public.stripe_webhook_events
  ADD COLUMN IF NOT EXISTS event_type text,
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS payment_provider_id text,
  ADD COLUMN IF NOT EXISTS amount_paid integer,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

COMMENT ON COLUMN public.stripe_webhook_events.event_type IS
  'Stripe event type (e.g. checkout.session.completed) captured for the audit trail.';
COMMENT ON COLUMN public.stripe_webhook_events.amount_paid IS
  'Amount charged in the smallest currency unit (cents), captured at processing time.';

-- 2. Redefine the RPC to accept p_event_type and persist the audit context.
--    The previous 5-arg signature (without p_event_type) is dropped so callers
--    must supply the full audit context.
DROP FUNCTION IF EXISTS public.grant_day_pass_idempotent(text, uuid, text, timestamptz, integer);

CREATE OR REPLACE FUNCTION public.grant_day_pass_idempotent(
  p_event_id text,
  p_event_type text,
  p_user_id uuid,
  p_payment_provider_id text,
  p_expires_at timestamptz,
  p_amount_paid integer
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_inserted uuid;
BEGIN
  -- Step 1: claim the event ID AND record the full audit context in one row.
  -- ON CONFLICT DO NOTHING returns NULL if this event was already processed.
  INSERT INTO public.stripe_webhook_events (
    event_id,
    event_type,
    user_id,
    payment_provider_id,
    amount_paid,
    expires_at
  )
  VALUES (
    p_event_id,
    p_event_type,
    p_user_id,
    p_payment_provider_id,
    p_amount_paid,
    p_expires_at
  )
  ON CONFLICT (event_id) DO NOTHING
  RETURNING id INTO v_inserted;

  IF v_inserted IS NULL THEN
    RETURN 'duplicate';
  END IF;

  -- Step 2: grant the day pass. Wrapped in an explicit sub-block with
  -- EXCEPTION WHEN OTHERS THEN RAISE so ANY failure here re-raises and rolls
  -- back the audit row inserted in step 1 (BE-B2 invariant). This prevents a
  -- paid user from being locked out while every Stripe retry short-circuits on
  -- 'duplicate'.
  BEGIN
    INSERT INTO public.voice_purchases (
      user_id,
      purchase_type,
      payment_provider_id,
      expires_at,
      amount_paid
    ) VALUES (
      p_user_id,
      'day_pass',
      p_payment_provider_id,
      p_expires_at,
      p_amount_paid
    );
  EXCEPTION
    WHEN OTHERS THEN
      RAISE;
  END;

  RETURN 'granted';
END;
$$;

COMMENT ON FUNCTION public.grant_day_pass_idempotent(text, text, uuid, text, timestamptz, integer) IS
  'Atomically deduplicates a Stripe webhook event, records the full audit context on stripe_webhook_events, and grants a day pass. If the voice_purchases insert fails, the audit row is rolled back so Stripe retries can succeed. Returns ''granted'' or ''duplicate''; raises on any other failure.';

REVOKE ALL ON FUNCTION public.grant_day_pass_idempotent(text, text, uuid, text, timestamptz, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grant_day_pass_idempotent(text, text, uuid, text, timestamptz, integer) TO service_role;
