-- ============================================================================
-- Migration: 115_paypal_webhook_events.sql
-- Purpose: Inbox for PayPal webhook events (plan F03, R2-04).
--
-- An event is recorded with processed_at NULL before it is processed, and
-- marked processed only on success, so a redelivery of an event that failed
-- is processed again instead of being dropped as a duplicate. The verified
-- payload and the normalized order, capture, refund and custom ids are stored
-- so reconciliation can replay an event from this row alone after the
-- request has ended.
--
--   upsert_paypal_event(...)         'new' | 'pending' | 'processed'
--   mark_paypal_event_processed(id)
--   mark_paypal_event_failed(id, error)
--
-- attempts counts deliveries that reached processing: 1 on insert, +1 on each
-- redelivery of an unprocessed event.
-- ============================================================================

CREATE TABLE public.paypal_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL UNIQUE,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  order_id text,
  capture_id text,
  refund_id text,
  custom_id text,
  verification text,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error text
);

CREATE INDEX idx_paypal_webhook_events_order_id ON public.paypal_webhook_events(order_id);
CREATE INDEX idx_paypal_webhook_events_unprocessed
  ON public.paypal_webhook_events(received_at) WHERE processed_at IS NULL;

ALTER TABLE public.paypal_webhook_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.paypal_webhook_events FROM anon;
REVOKE ALL ON TABLE public.paypal_webhook_events FROM authenticated;
GRANT ALL ON TABLE public.paypal_webhook_events TO service_role;
CREATE POLICY "Service role can manage paypal_webhook_events"
  ON public.paypal_webhook_events FOR ALL TO service_role
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION public.upsert_paypal_event(
  p_event_id text,
  p_event_type text,
  p_payload jsonb,
  p_order_id text,
  p_capture_id text,
  p_refund_id text,
  p_custom_id text,
  p_verification text
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_inserted uuid;
  v_processed_at timestamptz;
BEGIN
  INSERT INTO public.paypal_webhook_events (
    event_id, event_type, payload, order_id, capture_id, refund_id, custom_id,
    verification, attempts
  ) VALUES (
    p_event_id, p_event_type, p_payload, p_order_id, p_capture_id, p_refund_id,
    p_custom_id, p_verification, 1
  )
  ON CONFLICT (event_id) DO NOTHING
  RETURNING id INTO v_inserted;

  IF v_inserted IS NOT NULL THEN
    RETURN 'new';
  END IF;

  SELECT processed_at INTO v_processed_at
  FROM public.paypal_webhook_events
  WHERE event_id = p_event_id
  FOR UPDATE;

  IF v_processed_at IS NOT NULL THEN
    RETURN 'processed';
  END IF;

  UPDATE public.paypal_webhook_events
  SET attempts = attempts + 1
  WHERE event_id = p_event_id;

  RETURN 'pending';
END;
$$;

COMMENT ON FUNCTION public.upsert_paypal_event(text, text, jsonb, text, text, text, text, text) IS
  'Records a verified PayPal webhook event in the inbox. Returns new (first delivery), pending (redelivery of an unprocessed event; attempts incremented) or processed (already handled; acknowledge as duplicate).';

CREATE OR REPLACE FUNCTION public.mark_paypal_event_processed(
  p_event_id text
) RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.paypal_webhook_events
  SET processed_at = coalesce(processed_at, now())
  WHERE event_id = p_event_id;
$$;

CREATE OR REPLACE FUNCTION public.mark_paypal_event_failed(
  p_event_id text,
  p_error text
) RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.paypal_webhook_events
  SET last_error = left(p_error, 2000)
  WHERE event_id = p_event_id
    AND processed_at IS NULL;
$$;

REVOKE ALL ON FUNCTION public.upsert_paypal_event(text, text, jsonb, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_paypal_event(text, text, jsonb, text, text, text, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.mark_paypal_event_processed(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_paypal_event_processed(text) TO service_role;

REVOKE ALL ON FUNCTION public.mark_paypal_event_failed(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_paypal_event_failed(text, text) TO service_role;
