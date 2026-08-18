-- BE-B1: Cap translation queue retries and introduce a terminal `dead`
-- status so a poison-pill story (Claude refusal, JSON parse failure,
-- deleted story) cannot retry forever and burn unbounded Anthropic spend.
-- This is the exact failure mode that already took production down
-- (Anthropic credit exhaustion, 2026-07-20).
--
-- Regression risk (see #774): `attempts` increments on CLAIM
-- (claim_next_translate_webhook_event), not on failure, so a job that is
-- merely reclaimed after a lease-expiry timeout (crashed/timed-out
-- handler -- see BE-H2) burns an attempt without ever having actually
-- failed. p_max_attempts defaults to 5, deliberately generous relative to
-- the 3-minute job lease (BE-H6, TRANSLATE_JOB_LEASE_SECONDS) so an
-- occasional lease-timeout reclaim does not prematurely kill a job that
-- would otherwise succeed, while still bounding worst-case per-job
-- Anthropic spend to at most p_max_attempts Claude calls before the job is
-- retired to `dead`. This mirrors the existing
-- claim_retryable_booking_sms_jobs(p_max_attempts) pattern (088/100).

-- claim_next_translate_webhook_event gains a p_max_attempts parameter, so
-- the arity changes -- drop the old 3-arg overload first (established
-- pattern; see 085/100 for complete_booking_sms_job).
DROP FUNCTION IF EXISTS public.claim_next_translate_webhook_event(text, integer, integer);

CREATE OR REPLACE FUNCTION public.claim_next_translate_webhook_event(
  p_event_key text DEFAULT NULL,
  p_lease_seconds integer DEFAULT 600,
  p_batch_size integer DEFAULT 10,
  p_max_attempts integer DEFAULT 5
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
      AND j.attempts < GREATEST(p_max_attempts, 1)
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

COMMENT ON FUNCTION public.claim_next_translate_webhook_event(text, integer, integer, integer) IS
  'Claims a bounded batch of pending or expired translation jobs, prioritizing the
   requested event key. Excludes jobs at or beyond p_max_attempts (default 5) so a
   poison-pill job cannot be reclaimed indefinitely -- see
   fail_stale_story_translations for how such jobs are retired to the terminal
   dead status.';

REVOKE ALL ON FUNCTION public.claim_next_translate_webhook_event(text, integer, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_next_translate_webhook_event(text, integer, integer, integer) TO service_role;

-- fail_stale_story_translations gains a p_max_attempts parameter -- drop
-- the old 1-arg overload first for the same reason as above. The existing
-- 1-arg caller (fail_stale_story_translations_locked, migration 081)
-- keeps working unchanged: p_max_attempts defaults to 5.
DROP FUNCTION IF EXISTS public.fail_stale_story_translations(timestamptz);

CREATE OR REPLACE FUNCTION public.fail_stale_story_translations(
  p_cutoff timestamptz,
  p_max_attempts integer DEFAULT 5
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_now timestamptz := now();
  v_updated_count integer := 0;
  v_dead_count integer := 0;
  v_base_url text;
  v_secret text;
  v_event_key text;
  v_attempts integer;
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

  -- BE-B1: retire jobs that have exhausted the attempts cap to a terminal
  -- `dead` status instead of re-kicking them forever. This runs after the
  -- lease-release UPDATE above so a job whose lease just expired and was
  -- already at the cap is retired on this same sweep rather than being
  -- re-kicked one more time.
  UPDATE public.translate_webhook_events
  SET
    status = 'dead',
    lease_expires_at = NULL,
    updated_at = v_now
  WHERE status IN ('pending', 'failed')
    AND attempts >= GREATEST(p_max_attempts, 1);

  GET DIAGNOSTICS v_dead_count = ROW_COUNT;

  IF v_dead_count > 0 THEN
    RAISE WARNING '[fail_stale_story_translations] retired % translation job(s) to dead status after reaching % attempts', v_dead_count, p_max_attempts;
  END IF;

  SELECT value INTO v_base_url
  FROM public.webhook_config
  WHERE key = 'base_url';

  SELECT value INTO v_secret
  FROM public.webhook_config
  WHERE key = 'secret';

  IF v_base_url IS NULL OR v_base_url = '' THEN
    RETURN v_updated_count;
  END IF;

  -- BE-B1: exponential backoff (previously a flat 5-minute retry) so a
  -- repeatedly-failing job is re-kicked less often as its attempt count
  -- grows, further bounding worst-case request/spend rate. Capped at 60
  -- minutes. Jobs at or beyond the attempts cap are excluded here too
  -- (belt-and-suspenders alongside the dead-status sweep above).
  FOR v_event_key, v_attempts IN
    SELECT event_key, attempts
    FROM public.translate_webhook_events
    WHERE status IN ('pending', 'failed')
      AND COALESCE(next_retry_at, v_now) <= v_now
      AND attempts < GREATEST(p_max_attempts, 1)
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
      next_retry_at = v_now + make_interval(mins => LEAST(2 ^ GREATEST(v_attempts, 1), 60)::int),
      updated_at = v_now
    WHERE event_key = v_event_key;
  END LOOP;

  RETURN v_updated_count;
END;
$$;

COMMENT ON FUNCTION public.fail_stale_story_translations(timestamptz, integer) IS
  'Marks stale metadata.translation_status entries as failed, releases expired translation
   job leases, retires jobs that have reached p_max_attempts (default 5) to a terminal dead
   status, and re-kicks remaining retryable translation work with exponential backoff.';

REVOKE ALL ON FUNCTION public.fail_stale_story_translations(timestamptz, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fail_stale_story_translations(timestamptz, integer) TO service_role;
