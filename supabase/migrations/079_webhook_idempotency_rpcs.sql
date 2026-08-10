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

ALTER TABLE public.translate_webhook_events
  ADD COLUMN IF NOT EXISTS locales text[],
  ADD COLUMN IF NOT EXISTS force_retranslate boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lease_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS next_retry_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_translate_webhook_events_status_retry
  ON public.translate_webhook_events (status, next_retry_at, created_at);

CREATE TABLE IF NOT EXISTS public.booking_sms_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key text UNIQUE NOT NULL,
  booking_id uuid NOT NULL REFERENCES public.pending_bookings(id) ON DELETE CASCADE,
  to_phone text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  lease_expires_at timestamptz,
  last_error text,
  provider_sid text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_booking_sms_jobs_status
  ON public.booking_sms_jobs (status, created_at);

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

CREATE OR REPLACE FUNCTION public.enqueue_booking_sms_job(
  p_event_key text,
  p_booking_id uuid,
  p_to_phone text,
  p_message text
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_status text;
BEGIN
  INSERT INTO public.booking_sms_jobs (
    event_key,
    booking_id,
    to_phone,
    message,
    status,
    lease_expires_at,
    last_error,
    updated_at
  )
  VALUES (
    p_event_key,
    p_booking_id,
    p_to_phone,
    p_message,
    'pending',
    NULL,
    NULL,
    now()
  )
  ON CONFLICT (event_key) DO UPDATE
  SET
    booking_id = EXCLUDED.booking_id,
    to_phone = EXCLUDED.to_phone,
    message = EXCLUDED.message,
    status = CASE
      WHEN public.booking_sms_jobs.status = 'sent' THEN 'sent'
      ELSE 'pending'
    END,
    lease_expires_at = CASE
      WHEN public.booking_sms_jobs.status = 'sent' THEN public.booking_sms_jobs.lease_expires_at
      ELSE NULL
    END,
    last_error = CASE
      WHEN public.booking_sms_jobs.status = 'sent' THEN NULL
      ELSE public.booking_sms_jobs.last_error
    END,
    updated_at = now()
  RETURNING status INTO v_status;

  IF v_status = 'sent' THEN
    RETURN 'sent';
  END IF;

  RETURN 'queued';
END;
$$;

COMMENT ON FUNCTION public.enqueue_booking_sms_job(text, uuid, text, text) IS
  'Enqueues or refreshes a durable SMS delivery job for an ElevenLabs webhook event.';

REVOKE ALL ON FUNCTION public.enqueue_booking_sms_job(text, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_booking_sms_job(text, uuid, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.claim_booking_sms_job(
  p_event_key text,
  p_lease_seconds integer DEFAULT 900
) RETURNS TABLE (
  booking_id uuid,
  event_key text,
  to_phone text,
  message text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  WITH candidate AS (
    SELECT j.id
    FROM public.booking_sms_jobs j
    WHERE j.event_key = p_event_key
      AND (
        j.status = 'pending'
        OR j.status = 'failed'
        OR (
          j.status = 'processing'
          AND j.lease_expires_at IS NOT NULL
          AND j.lease_expires_at <= now()
        )
      )
    ORDER BY j.created_at
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.booking_sms_jobs j
  SET
    status = 'processing',
    attempts = j.attempts + 1,
    lease_expires_at = now() + make_interval(secs => GREATEST(p_lease_seconds, 1)),
    updated_at = now()
  FROM candidate
  WHERE j.id = candidate.id
  RETURNING j.booking_id, j.event_key, j.to_phone, j.message;
END;
$$;

COMMENT ON FUNCTION public.claim_booking_sms_job(text, integer) IS
  'Claims a pending or retryable SMS delivery job with a time-bound lease.';

REVOKE ALL ON FUNCTION public.claim_booking_sms_job(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_booking_sms_job(text, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.complete_booking_sms_job(
  p_event_key text,
  p_provider_sid text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.booking_sms_jobs
  SET
    status = 'sent',
    provider_sid = p_provider_sid,
    sent_at = now(),
    lease_expires_at = NULL,
    last_error = NULL,
    updated_at = now()
  WHERE event_key = p_event_key;

  RETURN FOUND;
END;
$$;

COMMENT ON FUNCTION public.complete_booking_sms_job(text, text) IS
  'Marks a durable booking SMS job as sent.';

REVOKE ALL ON FUNCTION public.complete_booking_sms_job(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_booking_sms_job(text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.fail_booking_sms_job(
  p_event_key text,
  p_error text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.booking_sms_jobs
  SET
    status = 'failed',
    lease_expires_at = NULL,
    last_error = p_error,
    updated_at = now()
  WHERE event_key = p_event_key;

  RETURN FOUND;
END;
$$;

COMMENT ON FUNCTION public.fail_booking_sms_job(text, text) IS
  'Marks a durable booking SMS job as failed so the webhook can retry it later.';

REVOKE ALL ON FUNCTION public.fail_booking_sms_job(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fail_booking_sms_job(text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.enqueue_translate_webhook_event(
  p_event_key text,
  p_story_id uuid,
  p_locales text[] DEFAULT NULL,
  p_force_retranslate boolean DEFAULT false
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_status text;
BEGIN
  INSERT INTO public.translate_webhook_events (
    event_key,
    story_id,
    locales,
    force_retranslate,
    status,
    lease_expires_at,
    next_retry_at,
    last_error,
    completed_at,
    updated_at
  )
  VALUES (
    p_event_key,
    p_story_id,
    p_locales,
    COALESCE(p_force_retranslate, false),
    'pending',
    NULL,
    now(),
    NULL,
    NULL,
    now()
  )
  ON CONFLICT (event_key) DO UPDATE
  SET
    story_id = EXCLUDED.story_id,
    locales = EXCLUDED.locales,
    force_retranslate = EXCLUDED.force_retranslate,
    status = CASE
      WHEN public.translate_webhook_events.status = 'completed' THEN 'completed'
      ELSE 'pending'
    END,
    lease_expires_at = CASE
      WHEN public.translate_webhook_events.status = 'completed' THEN public.translate_webhook_events.lease_expires_at
      ELSE NULL
    END,
    next_retry_at = CASE
      WHEN public.translate_webhook_events.status = 'completed' THEN public.translate_webhook_events.next_retry_at
      ELSE now()
    END,
    last_error = CASE
      WHEN public.translate_webhook_events.status = 'completed' THEN public.translate_webhook_events.last_error
      ELSE NULL
    END,
    completed_at = CASE
      WHEN public.translate_webhook_events.status = 'completed' THEN public.translate_webhook_events.completed_at
      ELSE NULL
    END,
    updated_at = now()
  RETURNING status INTO v_status;

  IF v_status = 'completed' THEN
    RETURN 'duplicate';
  END IF;

  RETURN 'queued';
END;
$$;

COMMENT ON FUNCTION public.enqueue_translate_webhook_event(text, uuid, text[], boolean) IS
  'Enqueues or refreshes a durable translation job for a story approval event.';

REVOKE ALL ON FUNCTION public.enqueue_translate_webhook_event(text, uuid, text[], boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_translate_webhook_event(text, uuid, text[], boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.claim_next_translate_webhook_event(
  p_event_key text DEFAULT NULL,
  p_lease_seconds integer DEFAULT 900,
  p_batch_size integer DEFAULT 10
) RETURNS TABLE (
  event_key text,
  story_id uuid,
  locales text[],
  force_retranslate boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  WITH candidate AS (
    SELECT j.id
    FROM public.translate_webhook_events j
    WHERE (
      j.status = 'pending'
      OR j.status = 'failed'
      OR (
        j.status = 'processing'
        AND j.lease_expires_at IS NOT NULL
        AND j.lease_expires_at <= now()
      )
    )
      AND COALESCE(j.next_retry_at, now()) <= now()
    ORDER BY
      CASE
        WHEN p_event_key IS NOT NULL AND j.event_key = p_event_key THEN 0
        ELSE 1
      END,
      j.created_at
    LIMIT GREATEST(p_batch_size, 1)
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.translate_webhook_events j
  SET
    status = 'processing',
    attempts = j.attempts + 1,
    lease_expires_at = now() + make_interval(secs => GREATEST(p_lease_seconds, 1)),
    updated_at = now()
  FROM candidate
  WHERE j.id = candidate.id
  RETURNING j.event_key, j.story_id, j.locales, j.force_retranslate;
END;
$$;

COMMENT ON FUNCTION public.claim_next_translate_webhook_event(text, integer, integer) IS
  'Claims a bounded batch of pending or expired translation jobs, prioritizing the requested event key.';

REVOKE ALL ON FUNCTION public.claim_next_translate_webhook_event(text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_next_translate_webhook_event(text, integer, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.complete_translate_webhook_event(
  p_event_key text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.translate_webhook_events
  SET
    status = 'completed',
    lease_expires_at = NULL,
    next_retry_at = now(),
    last_error = NULL,
    completed_at = now(),
    updated_at = now()
  WHERE event_key = p_event_key;

  RETURN FOUND;
END;
$$;

COMMENT ON FUNCTION public.complete_translate_webhook_event(text) IS
  'Marks a durable translation job as completed.';

REVOKE ALL ON FUNCTION public.complete_translate_webhook_event(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_translate_webhook_event(text) TO service_role;

CREATE OR REPLACE FUNCTION public.fail_translate_webhook_event(
  p_event_key text,
  p_error text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.translate_webhook_events
  SET
    status = 'failed',
    lease_expires_at = NULL,
    next_retry_at = now() + interval '5 minutes',
    last_error = p_error,
    updated_at = now()
  WHERE event_key = p_event_key;

  RETURN FOUND;
END;
$$;

COMMENT ON FUNCTION public.fail_translate_webhook_event(text, text) IS
  'Marks a durable translation job as failed while keeping it retryable.';

REVOKE ALL ON FUNCTION public.fail_translate_webhook_event(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fail_translate_webhook_event(text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.process_translate_event_idempotent(
  p_event_key text,
  p_story_id uuid
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN public.enqueue_translate_webhook_event(
    p_event_key,
    p_story_id,
    NULL,
    false
  );
END;
$$;

COMMENT ON FUNCTION public.process_translate_event_idempotent(text, uuid) IS
  'Compatibility wrapper that now enqueues a durable translation job instead of writing a permanent claim row.';

REVOKE ALL ON FUNCTION public.process_translate_event_idempotent(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_translate_event_idempotent(text, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.trigger_translation_webhook()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _base_url text;
  _secret text;
  _event_key text;
  _has_translations boolean;
BEGIN
  _event_key := new.id::text || ':default:all';

  _has_translations := (
    new.metadata IS NOT NULL AND
    new.metadata->'translations' IS NOT NULL AND
    jsonb_typeof(new.metadata->'translations') = 'object' AND
    (new.metadata->'translations')::jsonb != '{}'::jsonb
  );

  IF _has_translations THEN
    RAISE NOTICE '[translation-trigger] Story % already has translations — skipping', new.id;
    RETURN new;
  END IF;

  PERFORM public.enqueue_translate_webhook_event(
    _event_key,
    new.id,
    NULL,
    false
  );

  SELECT value INTO _base_url
  FROM public.webhook_config
  WHERE key = 'base_url';

  SELECT value INTO _secret
  FROM public.webhook_config
  WHERE key = 'secret';

  IF _base_url IS NULL OR _base_url = '' THEN
    RAISE NOTICE '[translation-trigger] queued translation for story %, but webhook_config.base_url is not configured', new.id;
    RETURN new;
  END IF;

  PERFORM net.http_post(
    url := _base_url || '/api/webhooks/translate',
    body := jsonb_build_object('eventKey', _event_key)::text,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', coalesce(_secret, '')
    )
  );

  RAISE NOTICE '[translation-trigger] queued translation worker for story %', new.id;
  RETURN new;
EXCEPTION
  WHEN others THEN
    RAISE WARNING '[translation-trigger] Failed to queue translation for story %: % %', new.id, SQLERRM, SQLSTATE;
    RETURN new;
END;
$$;

COMMENT ON FUNCTION public.trigger_translation_webhook() IS
  'Queues a durable translation job on approval and kicks the translate worker endpoint.';

REVOKE ALL ON FUNCTION public.trigger_translation_webhook() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.trigger_translation_webhook() TO service_role;
