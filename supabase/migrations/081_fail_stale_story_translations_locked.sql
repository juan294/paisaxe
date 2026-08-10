-- Wrap fail_stale_story_translations with a transaction-scoped advisory
-- lock so concurrent cron invocations serialize correctly even when the
-- PostgREST pool (Supavisor, transaction mode) hands consecutive RPC
-- calls to different Postgres backends.
--
-- pg_try_advisory_xact_lock is released automatically when the
-- transaction ends, eliminating the lock-leak failure mode of the
-- session-scoped pg_try_advisory_lock / pg_advisory_unlock pair.

CREATE OR REPLACE FUNCTION public.fail_stale_story_translations_locked(
  p_cutoff timestamptz
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count integer;
BEGIN
  IF NOT pg_catalog.pg_try_advisory_xact_lock(1006) THEN
    RETURN -1;
  END IF;

  SELECT public.fail_stale_story_translations(p_cutoff) INTO v_count;
  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.fail_stale_story_translations_locked(timestamptz) IS
  'Wraps fail_stale_story_translations with a transaction-scoped advisory lock to serialize concurrent cron runs across pooled Postgres connections. Returns -1 when the lock is already held.';

REVOKE ALL ON FUNCTION public.fail_stale_story_translations_locked(timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fail_stale_story_translations_locked(timestamptz) TO service_role;
