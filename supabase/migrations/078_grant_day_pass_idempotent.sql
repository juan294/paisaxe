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
  INSERT INTO public.stripe_webhook_events (event_id)
  VALUES (p_event_id)
  ON CONFLICT (event_id) DO NOTHING
  RETURNING id INTO v_inserted;

  IF v_inserted IS NULL THEN
    RETURN 'duplicate';
  END IF;

  INSERT INTO public.voice_purchases (
    user_id,
    purchase_type,
    payment_provider_id,
    expires_at
  ) VALUES (
    p_user_id,
    'day_pass',
    p_payment_provider_id,
    p_expires_at
  );

  RETURN 'granted';
END;
$$;

COMMENT ON FUNCTION public.grant_day_pass_idempotent(text, uuid, text, timestamptz, integer) IS
  'Atomically deduplicates a Stripe webhook event and grants a day pass.';

REVOKE ALL ON FUNCTION public.grant_day_pass_idempotent(text, uuid, text, timestamptz, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grant_day_pass_idempotent(text, uuid, text, timestamptz, integer) TO service_role;
