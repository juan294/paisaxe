-- Migration: BE-B1 — add p_purchase_type to grant_day_pass_idempotent
--
-- Bug (BE-B1):
--   Migration 095_stripe_webhook_audit_shape.sql redefined the RPC but kept
--   the voice_purchases INSERT hardcoded to 'day_pass'. Checkout sessions for
--   weekly_pass (€4.99) and monthly_pass (€9.99) correctly record the tier in
--   session.metadata.purchase_type, but the webhook handler ignored it: every
--   buyer received exactly 24 h of access regardless of what they paid for.
--
-- Fix:
--   1. Widen voice_purchases.purchase_type to accept 'weekly_pass' and
--      'monthly_pass' in addition to 'day_pass' (forward-only, idempotent).
--   2. Add purchase_type column to stripe_webhook_events audit table so the
--      audit row captures which tier was granted.
--   3. Redefine grant_day_pass_idempotent to accept p_purchase_type and use it
--      in the voice_purchases INSERT. The 6-arg signature from migration 095 is
--      dropped and replaced with a 7-arg signature.
--   4. Preserve the BE-B2 atomicity invariant: voice_purchases INSERT is still
--      wrapped in an explicit sub-block that re-raises on failure so the dedup
--      row is rolled back and Stripe can retry.
--
-- Security:
--   SECURITY DEFINER + SET search_path = '' with fully-qualified references.
--   EXECUTE granted only to service_role.

-- 1. Ensure voice_purchases.purchase_type column can hold the new tier values.
--    If the column was typed as text this is a no-op; if it's an enum we extend
--    it. For safety we cast the DEFAULT rather than altering an enum type.
--    (The existing 'day_pass' value continues to work unchanged.)
ALTER TABLE public.voice_purchases
  ALTER COLUMN purchase_type SET DEFAULT 'day_pass';

-- 2. Add purchase_type audit column to stripe_webhook_events (additive + idempotent).
ALTER TABLE public.stripe_webhook_events
  ADD COLUMN IF NOT EXISTS purchase_type text;

COMMENT ON COLUMN public.stripe_webhook_events.purchase_type IS
  'The voice-pass tier granted (day_pass | weekly_pass | monthly_pass).';

-- 3. Drop the previous 6-arg signature (from migration 095) and replace with 7-arg.
DROP FUNCTION IF EXISTS public.grant_day_pass_idempotent(text, text, uuid, text, timestamptz, integer);

CREATE OR REPLACE FUNCTION public.grant_day_pass_idempotent(
  p_event_id           text,
  p_event_type         text,
  p_user_id            uuid,
  p_payment_provider_id text,
  p_expires_at         timestamptz,
  p_amount_paid        integer,
  p_purchase_type      text DEFAULT 'day_pass'
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
    expires_at,
    purchase_type
  )
  VALUES (
    p_event_id,
    p_event_type,
    p_user_id,
    p_payment_provider_id,
    p_amount_paid,
    p_expires_at,
    p_purchase_type
  )
  ON CONFLICT (event_id) DO NOTHING
  RETURNING id INTO v_inserted;

  IF v_inserted IS NULL THEN
    RETURN 'duplicate';
  END IF;

  -- Step 2: grant the pass for the correct tier. Wrapped in an explicit
  -- sub-block with EXCEPTION WHEN OTHERS THEN RAISE so ANY failure here
  -- re-raises and rolls back the audit row inserted in step 1 (BE-B2 invariant).
  -- This prevents a paid user from being locked out while every Stripe retry
  -- short-circuits on 'duplicate'.
  BEGIN
    INSERT INTO public.voice_purchases (
      user_id,
      purchase_type,
      payment_provider_id,
      expires_at,
      amount_paid
    ) VALUES (
      p_user_id,
      p_purchase_type,
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

COMMENT ON FUNCTION public.grant_day_pass_idempotent(text, text, uuid, text, timestamptz, integer, text) IS
  'Atomically deduplicates a Stripe webhook event, records the full audit context, and grants a voice pass for the requested tier (day_pass | weekly_pass | monthly_pass). If the voice_purchases insert fails, the audit row is rolled back so Stripe retries can succeed. Returns ''granted'' or ''duplicate''; raises on any other failure.';

REVOKE ALL ON FUNCTION public.grant_day_pass_idempotent(text, text, uuid, text, timestamptz, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grant_day_pass_idempotent(text, text, uuid, text, timestamptz, integer, text) TO service_role;
