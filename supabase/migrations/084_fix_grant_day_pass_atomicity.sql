-- Migration: Fix BE-B2 — atomicity of grant_day_pass_idempotent
--
-- Bug (BE-B2):
--   The previous implementation in 078_grant_day_pass_idempotent.sql
--   inserted a dedup row first, then inserted into voice_purchases. If a
--   future change ever wrapped the function body in an EXCEPTION handler
--   (or if the function were ever called inside an outer block that traps
--   errors), the dedup row could be persisted while the voice_purchases
--   insert failed. The user would then be charged by Stripe but never
--   granted access, and every Stripe retry would return 'duplicate'
--   forever — there was no recovery path.
--
-- Fix:
--   1. Wrap the voice_purchases insert in an explicit sub-block with
--      EXCEPTION WHEN OTHERS THEN RAISE. This documents the atomicity
--      intent and guarantees any error propagates out of the function so
--      the entire RPC's effects (including the dedup row) are rolled back
--      by the outer transaction.
--   2. Persist p_amount_paid into the new amount_paid column so the
--      grant ledger captures the price actually charged. (The previous
--      definition accepted p_amount_paid but silently discarded it.)
--
-- Invariant after this migration:
--   The function returns one of:
--     'granted'    — both rows committed atomically.
--     'duplicate'  — same event_id already processed; nothing inserted.
--   Any other failure raises an exception, the outer transaction rolls
--   back the dedup row along with everything else, the webhook handler
--   returns non-200, and Stripe retries the event.

-- Add amount_paid column for grant ledger completeness. This is additive
-- and idempotent so the migration is safe to re-run.
ALTER TABLE public.voice_purchases
  ADD COLUMN IF NOT EXISTS amount_paid integer;

COMMENT ON COLUMN public.voice_purchases.amount_paid IS
  'Amount charged in the smallest currency unit (cents). Captured at grant time for audit and reconciliation.';

CREATE OR REPLACE FUNCTION public.grant_day_pass_idempotent(
  p_event_id text,
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
  -- Step 1: claim the event ID. ON CONFLICT DO NOTHING returns NULL if
  -- this event was already processed.
  INSERT INTO public.stripe_webhook_events (event_id)
  VALUES (p_event_id)
  ON CONFLICT (event_id) DO NOTHING
  RETURNING id INTO v_inserted;

  IF v_inserted IS NULL THEN
    RETURN 'duplicate';
  END IF;

  -- Step 2: grant the day pass. Wrapped in an explicit sub-block with
  -- EXCEPTION WHEN OTHERS THEN RAISE so the atomicity invariant is
  -- explicit: ANY failure here re-raises and rolls back the dedup row
  -- inserted in step 1. This prevents the BE-B2 deadlock where a paid
  -- user would be locked out of access and every Stripe retry would
  -- short-circuit on 'duplicate'.
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
      -- Re-raise so the outer transaction (managed by the webhook
      -- handler / supabase-js RPC) rolls back the dedup row above.
      -- DO NOT swallow this error — Stripe must retry.
      RAISE;
  END;

  RETURN 'granted';
END;
$$;

COMMENT ON FUNCTION public.grant_day_pass_idempotent(text, uuid, text, timestamptz, integer) IS
  'Atomically deduplicates a Stripe webhook event and grants a day pass. If the voice_purchases insert fails, the dedup row is rolled back so Stripe retries can succeed. Returns ''granted'' or ''duplicate''; raises on any other failure.';

REVOKE ALL ON FUNCTION public.grant_day_pass_idempotent(text, uuid, text, timestamptz, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grant_day_pass_idempotent(text, uuid, text, timestamptz, integer) TO service_role;
