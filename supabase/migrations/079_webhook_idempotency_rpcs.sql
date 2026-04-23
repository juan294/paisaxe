CREATE TABLE IF NOT EXISTS public.elevenlabs_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key text UNIQUE NOT NULL,
  booking_id uuid NOT NULL REFERENCES public.pending_bookings(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.translate_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key text UNIQUE NOT NULL,
  story_id uuid NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.process_elevenlabs_event_idempotent(
  p_event_key text,
  p_booking_id uuid,
  p_outcome text
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_inserted uuid;
  v_booking_id uuid;
BEGIN
  INSERT INTO public.elevenlabs_webhook_events (event_key, booking_id)
  VALUES (p_event_key, p_booking_id)
  ON CONFLICT (event_key) DO NOTHING
  RETURNING id INTO v_inserted;

  IF v_inserted IS NULL THEN
    RETURN 'duplicate';
  END IF;

  UPDATE public.pending_bookings
  SET status = p_outcome
  WHERE id = p_booking_id
  RETURNING id INTO v_booking_id;

  IF v_booking_id IS NULL THEN
    DELETE FROM public.elevenlabs_webhook_events
    WHERE id = v_inserted;
    RETURN 'booking_missing';
  END IF;

  RETURN 'processed';
END;
$$;

COMMENT ON FUNCTION public.process_elevenlabs_event_idempotent(text, uuid, text) IS
  'Claims an ElevenLabs webhook event once and atomically persists the booking outcome.';

REVOKE ALL ON FUNCTION public.process_elevenlabs_event_idempotent(text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_elevenlabs_event_idempotent(text, uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.process_translate_event_idempotent(
  p_event_key text,
  p_story_id uuid
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_inserted uuid;
BEGIN
  INSERT INTO public.translate_webhook_events (event_key, story_id)
  VALUES (p_event_key, p_story_id)
  ON CONFLICT (event_key) DO NOTHING
  RETURNING id INTO v_inserted;

  IF v_inserted IS NULL THEN
    RETURN 'duplicate';
  END IF;

  RETURN 'processed';
END;
$$;

COMMENT ON FUNCTION public.process_translate_event_idempotent(text, uuid) IS
  'Claims a translate webhook event once before external translation side effects begin.';

REVOKE ALL ON FUNCTION public.process_translate_event_idempotent(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_translate_event_idempotent(text, uuid) TO service_role;
