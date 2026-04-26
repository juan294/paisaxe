CREATE OR REPLACE FUNCTION public.fail_stale_story_translations(
  p_cutoff timestamptz
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_now timestamptz := now();
  v_updated_count integer := 0;
  v_base_url text;
  v_secret text;
  v_event_key text;
BEGIN
  WITH computed AS (
    SELECT
      s.id,
      jsonb_object_agg(
        status_entry.locale,
        CASE
          WHEN status_entry.value->>'status' = 'translating'
            AND COALESCE(NULLIF(status_entry.value->>'updatedAt', '')::timestamptz, to_timestamp(0)) < p_cutoff
          THEN (
            jsonb_set(
              jsonb_set(status_entry.value, '{status}', '"failed"', true),
              '{updatedAt}',
              to_jsonb(v_now),
              true
            ) || jsonb_build_object('error', 'timeout')
          )
          ELSE status_entry.value
        END
      ) AS next_translation_status,
      bool_or(
        status_entry.value->>'status' = 'translating'
        AND COALESCE(NULLIF(status_entry.value->>'updatedAt', '')::timestamptz, to_timestamp(0)) < p_cutoff
      ) AS has_stale
    FROM public.stories s
    CROSS JOIN LATERAL jsonb_each(
      COALESCE(s.metadata->'translation_status', '{}'::jsonb)
    ) AS status_entry(locale, value)
    GROUP BY s.id
  ),
  updated AS (
    UPDATE public.stories s
    SET metadata = jsonb_set(
      COALESCE(s.metadata, '{}'::jsonb),
      '{translation_status}',
      computed.next_translation_status,
      true
    )
    FROM computed
    WHERE s.id = computed.id
      AND computed.has_stale
    RETURNING s.id
  )
  SELECT count(*) INTO v_updated_count FROM updated;

  UPDATE public.translate_webhook_events
  SET
    status = CASE
      WHEN status = 'processing' THEN 'failed'
      ELSE status
    END,
    lease_expires_at = NULL,
    next_retry_at = v_now,
    last_error = CASE
      WHEN status = 'processing' THEN COALESCE(last_error, 'timeout')
      ELSE last_error
    END,
    updated_at = v_now
  WHERE (
    status = 'processing'
    AND lease_expires_at IS NOT NULL
    AND lease_expires_at < p_cutoff
  )
    OR (
      status IN ('pending', 'failed')
      AND COALESCE(next_retry_at, v_now) <= v_now
    );

  SELECT value INTO v_base_url
  FROM public.webhook_config
  WHERE key = 'base_url';

  SELECT value INTO v_secret
  FROM public.webhook_config
  WHERE key = 'secret';

  IF v_base_url IS NULL OR v_base_url = '' THEN
    RETURN v_updated_count;
  END IF;

  FOR v_event_key IN
    SELECT event_key
    FROM public.translate_webhook_events
    WHERE status IN ('pending', 'failed')
      AND COALESCE(next_retry_at, v_now) <= v_now
    ORDER BY
      CASE WHEN status = 'failed' THEN 0 ELSE 1 END,
      updated_at,
      created_at
    LIMIT 20
  LOOP
    PERFORM net.http_post(
      url := v_base_url || '/api/webhooks/translate',
      body := jsonb_build_object('eventKey', v_event_key)::text,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-webhook-secret', coalesce(v_secret, '')
      )
    );

    UPDATE public.translate_webhook_events
    SET
      next_retry_at = v_now + interval '5 minutes',
      updated_at = v_now
    WHERE event_key = v_event_key;
  END LOOP;

  RETURN v_updated_count;
END;
$$;

COMMENT ON FUNCTION public.fail_stale_story_translations(timestamptz) IS
  'Marks stale metadata.translation_status entries as failed, releases expired translation job leases, and re-kicks retryable translation work.';

REVOKE ALL ON FUNCTION public.fail_stale_story_translations(timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fail_stale_story_translations(timestamptz) TO service_role;
