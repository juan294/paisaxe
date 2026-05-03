-- Voice booking durability follow-up.
--
-- 087 is already used in the db-security remediation worktree, so this branch
-- uses 088 to avoid an integration-time migration-number conflict.

CREATE TABLE IF NOT EXISTS public.cron_job_locks (
  lock_key text PRIMARY KEY,
  lock_token uuid NOT NULL,
  lease_expires_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cron_job_locks_lease_expires_at
  ON public.cron_job_locks (lease_expires_at);

ALTER TABLE public.cron_job_locks ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.try_acquire_cron_job_lock(
  p_lock_key text,
  p_lease_seconds integer DEFAULT 900
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_token uuid := gen_random_uuid();
  v_acquired uuid;
BEGIN
  INSERT INTO public.cron_job_locks (
    lock_key,
    lock_token,
    lease_expires_at,
    updated_at
  )
  VALUES (
    p_lock_key,
    v_token,
    now() + make_interval(secs => GREATEST(p_lease_seconds, 1)),
    now()
  )
  ON CONFLICT (lock_key) DO UPDATE
  SET
    lock_token = EXCLUDED.lock_token,
    lease_expires_at = EXCLUDED.lease_expires_at,
    updated_at = now()
  WHERE public.cron_job_locks.lease_expires_at <= now()
  RETURNING lock_token INTO v_acquired;

  RETURN v_acquired;
END;
$$;

COMMENT ON FUNCTION public.try_acquire_cron_job_lock(text, integer) IS
  'Acquires a durable cron job lease by token. Replaces unsafe session-scoped advisory locks across pooled RPC calls.';

REVOKE ALL ON FUNCTION public.try_acquire_cron_job_lock(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.try_acquire_cron_job_lock(text, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.release_cron_job_lock(
  p_lock_key text,
  p_lock_token uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.cron_job_locks
  WHERE lock_key = p_lock_key
    AND lock_token = p_lock_token;

  RETURN FOUND;
END;
$$;

COMMENT ON FUNCTION public.release_cron_job_lock(text, uuid) IS
  'Releases a durable cron job lease only when the caller still owns the token.';

REVOKE ALL ON FUNCTION public.release_cron_job_lock(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.release_cron_job_lock(text, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.claim_retryable_booking_sms_jobs(
  p_limit integer DEFAULT 10,
  p_lease_seconds integer DEFAULT 900,
  p_max_attempts integer DEFAULT 3
) RETURNS TABLE (
  booking_id uuid,
  event_key text,
  to_phone text,
  message text,
  attempts integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT j.id
    FROM public.booking_sms_jobs j
    WHERE (
        j.status IN ('pending', 'failed')
        OR (
          j.status = 'processing'
          AND j.lease_expires_at IS NOT NULL
          AND j.lease_expires_at <= now()
        )
      )
      AND j.attempts < GREATEST(p_max_attempts, 1)
    ORDER BY j.updated_at, j.created_at
    LIMIT GREATEST(p_limit, 1)
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.booking_sms_jobs j
  SET
    status = 'processing',
    attempts = j.attempts + 1,
    lease_expires_at = now() + make_interval(secs => GREATEST(p_lease_seconds, 1)),
    updated_at = now()
  FROM candidates
  WHERE j.id = candidates.id
  RETURNING j.booking_id, j.event_key, j.to_phone, j.message, j.attempts;
END;
$$;

COMMENT ON FUNCTION public.claim_retryable_booking_sms_jobs(integer, integer, integer) IS
  'Claims retryable booking SMS jobs for autonomous cron retries, bounded by p_max_attempts and protected by row locks.';

REVOKE ALL ON FUNCTION public.claim_retryable_booking_sms_jobs(integer, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_retryable_booking_sms_jobs(integer, integer, integer) TO service_role;
