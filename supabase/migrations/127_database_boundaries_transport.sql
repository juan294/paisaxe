-- 127: explicit feature-flag privilege/projection contract and real JSONB pg_net transport.
-- Existing canonical config stays private. Only service_role maintains public key approval.
-- This owner view is deliberately a narrow projection; security_invoker would require
-- exposing private config to its callers. security_barrier prevents caller predicates
-- from running before the approved projection. No mutable public config copy exists.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feature_flags TO service_role;
CREATE TABLE public.feature_flag_public_config_keys (
  flag_key text NOT NULL,
  config_key text NOT NULL,
  PRIMARY KEY (flag_key, config_key),
  CHECK (length(flag_key) > 0 AND length(config_key) > 0)
);
ALTER TABLE public.feature_flag_public_config_keys ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.feature_flag_public_config_keys FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feature_flag_public_config_keys TO service_role;
INSERT INTO public.feature_flag_public_config_keys(flag_key, config_key)
VALUES ('maintenance_mode','title'),('maintenance_mode','message'),('maintenance_mode','show_tagline');
CREATE OR REPLACE VIEW public.feature_flags_public WITH (security_barrier=true) AS
SELECT f.id, f.flag_key, f.enabled, f.label, f.description,
  COALESCE((SELECT jsonb_object_agg(k.config_key, f.config -> k.config_key)
    FROM public.feature_flag_public_config_keys k
    WHERE k.flag_key=f.flag_key AND f.config ? k.config_key), '{}'::jsonb) AS config,
  f.environment, f.created_at, f.updated_at
FROM public.feature_flags f;
-- CREATE OR REPLACE preserves direct grants from the existing view, including
-- bootstrap writes. Reset every client role before granting read-only access.
REVOKE ALL ON public.feature_flags_public FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.feature_flags_public TO anon, authenticated, service_role;
COMMENT ON VIEW public.feature_flags_public IS 'Intentional owner projection of canonical config using service-role-approved keys only. Unknown flags and keys expose empty config.';

-- Current application objects are all created by postgres (catalog, baseline126).
-- Repair both default scopes for that actual creator; do not alter unrelated owners.
-- Future private objects require explicit grants, including writes, rather than
-- inheriting client write privileges left by the bootstrap defaults.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;

create or replace function public.notify_webhook()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _base_url text;
  _secret text;
  _payload jsonb;
  _request_id bigint;
begin
  -- Read configuration from config table instead of app settings
  select value into _base_url from public.webhook_config where key = 'base_url';
  select value into _secret from public.webhook_config where key = 'secret';

  -- Skip if not configured (prevents errors during development/testing)
  if _base_url is null or _base_url = '' then
    raise notice '[webhook] webhook_config.base_url not configured — skipping';
    return coalesce(new, old);
  end if;

  -- Build the JSON payload
  _payload := jsonb_build_object(
    'table_name', TG_TABLE_NAME,
    'operation', TG_OP,
    'record', case when TG_OP in ('INSERT', 'UPDATE') then row_to_json(new)::jsonb else null end,
    'old_record', case when TG_OP in ('DELETE', 'UPDATE') then row_to_json(old)::jsonb else null end,
    'timestamp', now()::text
  );

  -- Send the HTTP POST via pg_net (non-blocking / async)
  _request_id := net.http_post(
    url := _base_url || '/api/webhooks/supabase',
    body := _payload,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', coalesce(_secret, '')
    )
  );

  raise notice '[webhook] queued request_id=%; inspect net._http_response, then retry the original update after recovery', _request_id;
  return coalesce(new, old);
exception
  when others then
    -- Log the error but do NOT block the original transaction
    raise warning '[webhook] enqueue failed SQLSTATE=% operation=% table=%; inspect pg_net health and retry the original update after recovery', SQLSTATE, TG_OP, TG_TABLE_NAME;
    return coalesce(new, old);
end;
$$;


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
  _request_id bigint;
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

  -- A transport failure must not roll back the durable job enqueued above.
  BEGIN
  _request_id := net.http_post(
    url := _base_url || '/api/webhooks/translate',
    body := jsonb_build_object('eventKey', _event_key),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', coalesce(_secret, '')
    )
  );

  EXCEPTION WHEN others THEN
    RAISE WARNING '[translation-trigger] transport enqueue failed SQLSTATE=% story=% event_key=%; correct webhook configuration, then run the translation retry sweep', SQLSTATE, new.id, _event_key;
    RETURN new;
  END;

  RAISE NOTICE '[translation-trigger] queued request_id=%; retry event_key=% after receiver recovery', _request_id, _event_key;
  RETURN new;
EXCEPTION
  WHEN others THEN
    RAISE WARNING '[translation-trigger] durable enqueue failed SQLSTATE=% story=% event_key=%; inspect queue health and retry approval after recovery', SQLSTATE, new.id, _event_key;
    RETURN new;
END;
$$;

COMMENT ON FUNCTION public.trigger_translation_webhook() IS
  'Queues a durable translation job on approval and kicks the translate worker endpoint.';

REVOKE ALL ON FUNCTION public.trigger_translation_webhook() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.trigger_translation_webhook() TO service_role;

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
  v_request_id bigint;
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
    BEGIN
      v_request_id := net.http_post(
      url := v_base_url || '/api/webhooks/translate',
      body := jsonb_build_object('eventKey', v_event_key),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-webhook-secret', coalesce(v_secret, '')
      )
    );

    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[translation-retry] queue failed for event_key=% sqlstate=%; retry sweep after receiver recovery', v_event_key, SQLSTATE;
      CONTINUE;
    END;
    RAISE NOTICE '[translation-retry] queued request_id=%; retry event_key=% after receiver recovery', v_request_id, v_event_key;

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

REVOKE ALL ON FUNCTION public.notify_webhook(), public.trigger_translation_webhook(), public.fail_stale_story_translations(timestamptz, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_webhook(), public.trigger_translation_webhook(), public.fail_stale_story_translations(timestamptz, integer) TO service_role;
NOTIFY pgrst, 'reload schema';
