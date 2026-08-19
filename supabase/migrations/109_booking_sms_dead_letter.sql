-- Migration 109: SMS retry exhaustion becomes an observable dead-letter (BE-M11, #792)
--
-- claim_retryable_booking_sms_jobs (088/100) already stops reclaiming a job
-- once its attempts reach p_max_attempts -- the WHERE clause filters on
-- `j.attempts < GREATEST(p_max_attempts, 1)`. But fail_booking_sms_job (079)
-- always sets status = 'failed' regardless of attempts, so a permanently
-- exhausted job is left in a 'failed' row that is indistinguishable from one
-- that will be retried on the next cron run -- the only way to tell them
-- apart today is comparing `attempts` against a constant that lives in
-- application code (SMS_RETRY_MAX_ATTEMPTS in
-- src/app/api/cron/retry-booking-sms/route.ts). Nothing counts or alerts on
-- this, so a broken Twilio config looks identical to an idle queue and a
-- visitor never learns their confirmation SMS failed.
--
-- This migration:
--   1. Replaces fail_booking_sms_job to accept an optional p_max_attempts.
--      When supplied and the job's current attempts have reached it, the job
--      is marked with a new terminal status, 'dead', instead of the
--      retryable 'failed' -- distinct from 'pending'/'processing'/'failed'
--      and never matched by claim_retryable_booking_sms_jobs's candidate
--      filter (which only selects 'pending' or 'failed').
--   2. Adds count_dead_letter_booking_sms_jobs() so the dead-letter count is
--      queryable for health/alerting, following this codebase's existing
--      "surface failure counts, don't just log them" convention (see
--      docs/operations/alerting-runbook.md).
--
-- Regression risk called out in #792: the webhook path
-- (claim_booking_sms_job / process_elevenlabs_event_idempotent, 079/100) has
-- different attempt semantics than the cron path
-- (claim_retryable_booking_sms_jobs, 088/100) and must NOT be misclassified.
-- src/app/api/webhooks/elevenlabs/route.ts calls fail_booking_sms_job with
-- only p_event_key and p_error (no p_max_attempts) -- with the new parameter
-- defaulting to NULL, that call keeps setting status = 'failed'
-- unconditionally, exactly as before. Only the cron route (which owns the
-- attempt cap) opts into dead-lettering by passing p_max_attempts.

DROP FUNCTION IF EXISTS public.fail_booking_sms_job(text, text);

CREATE OR REPLACE FUNCTION public.fail_booking_sms_job(
  p_event_key text,
  p_error text,
  p_max_attempts integer DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_attempts integer;
BEGIN
  SELECT attempts INTO v_attempts
  FROM public.booking_sms_jobs
  WHERE event_key = p_event_key
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  UPDATE public.booking_sms_jobs
  SET
    status = CASE
      WHEN p_max_attempts IS NOT NULL AND v_attempts >= p_max_attempts THEN 'dead'
      ELSE 'failed'
    END,
    lease_expires_at = NULL,
    last_error = p_error,
    updated_at = now()
  WHERE event_key = p_event_key;

  RETURN true;
END;
$$;

COMMENT ON FUNCTION public.fail_booking_sms_job(text, text, integer) IS
  'Marks a durable booking SMS job as retryable (failed), or as a terminal dead-letter (status = dead) when p_max_attempts is supplied and the job''s attempts have reached it -- see BE-M11 (#792).';

REVOKE ALL ON FUNCTION public.fail_booking_sms_job(text, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fail_booking_sms_job(text, text, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.count_dead_letter_booking_sms_jobs()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT count(*)::integer
  FROM public.booking_sms_jobs
  WHERE status = 'dead';
$$;

COMMENT ON FUNCTION public.count_dead_letter_booking_sms_jobs() IS
  'Counts booking SMS jobs permanently exhausted (status = dead) so a broken delivery pipeline is observable instead of silent -- see BE-M11 (#792).';

REVOKE ALL ON FUNCTION public.count_dead_letter_booking_sms_jobs() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.count_dead_letter_booking_sms_jobs() TO service_role;
