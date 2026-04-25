-- Migration: 082_translation_lease_10min.sql
-- Part of BE-H3 fix: Translation jobs can be stranded due to permanent claim rows
-- (#400)
--
-- The claim_next_translate_webhook_event function already supports
-- lease-based expiry via the lease_expires_at column (added in 079).
-- This migration updates the default lease duration from 900 s (15 min)
-- to 600 s (10 min) so a crashed handler's claim expires faster, reducing
-- the window during which a story is duplicate-blocked.
--
-- The fail_stale_story_translations cron job (migrations 080/081) remains the
-- authoritative recovery path: it marks expired leases as failed and re-kicks
-- retryable jobs.  This change shortens the default lease as an additional
-- safety net.

CREATE OR REPLACE FUNCTION public.claim_next_translate_webhook_event(
  p_event_key text DEFAULT NULL,
  p_lease_seconds integer DEFAULT 600,
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
  'Claims a bounded batch of pending or expired translation jobs, prioritizing the
   requested event key.  Default lease is 600 s (10 min); crashed handlers release
   faster so re-kick from fail_stale_story_translations is quicker.';

REVOKE ALL ON FUNCTION public.claim_next_translate_webhook_event(text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_next_translate_webhook_event(text, integer, integer) TO service_role;
