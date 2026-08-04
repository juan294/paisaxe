-- ============================================================================
-- Migration: 091_revoke_internal_function_access.sql
-- Purpose: Revoke EXECUTE on internal SECURITY DEFINER functions from
--          anon and authenticated roles.
--
-- Background: PostgreSQL grants EXECUTE to PUBLIC by default when functions
-- are created. Prior migrations (078, 079, 083, 084) included REVOKE FROM PUBLIC
-- statements but those also failed to apply (same root cause as migration 087).
-- These functions are internal queue managers, webhook handlers, and cron jobs
-- that must only be callable by service_role (Edge Functions and pg_cron).
-- ============================================================================

-- Internal SMS queue functions
REVOKE ALL ON FUNCTION public.claim_booking_sms_job(p_event_key text, p_lease_seconds integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_booking_sms_job(p_event_key text, p_lease_seconds integer) TO service_role;

-- Some environments recorded migration 085 without applying its replacement
-- of the two-argument overload. Revoke/grant every live overload by identity so
-- this security migration is safe in both schema states.
DO $$
DECLARE
  v_function text;
BEGIN
  FOR v_function IN
    SELECT format(
      '%I.%I(%s)',
      n.nspname,
      p.proname,
      pg_get_function_identity_arguments(p.oid)
    )
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'complete_booking_sms_job'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', v_function);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', v_function);
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.fail_booking_sms_job(p_event_key text, p_error text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fail_booking_sms_job(p_event_key text, p_error text) TO service_role;

REVOKE ALL ON FUNCTION public.enqueue_booking_sms_job(p_event_key text, p_booking_id uuid, p_to_phone text, p_message text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_booking_sms_job(p_event_key text, p_booking_id uuid, p_to_phone text, p_message text) TO service_role;

-- Internal translation queue functions
REVOKE ALL ON FUNCTION public.claim_next_translate_webhook_event(p_event_key text, p_lease_seconds integer, p_batch_size integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_next_translate_webhook_event(p_event_key text, p_lease_seconds integer, p_batch_size integer) TO service_role;

REVOKE ALL ON FUNCTION public.complete_translate_webhook_event(p_event_key text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_translate_webhook_event(p_event_key text) TO service_role;

REVOKE ALL ON FUNCTION public.fail_translate_webhook_event(p_event_key text, p_error text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fail_translate_webhook_event(p_event_key text, p_error text) TO service_role;

REVOKE ALL ON FUNCTION public.enqueue_translate_webhook_event(p_event_key text, p_story_id uuid, p_locales text[], p_force_retranslate boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_translate_webhook_event(p_event_key text, p_story_id uuid, p_locales text[], p_force_retranslate boolean) TO service_role;

-- Translation cron maintenance
REVOKE ALL ON FUNCTION public.fail_stale_story_translations(p_cutoff timestamp with time zone) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fail_stale_story_translations(p_cutoff timestamp with time zone) TO service_role;

REVOKE ALL ON FUNCTION public.fail_stale_story_translations_locked(p_cutoff timestamp with time zone) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fail_stale_story_translations_locked(p_cutoff timestamp with time zone) TO service_role;

-- Webhook idempotency processors
REVOKE ALL ON FUNCTION public.process_elevenlabs_event_idempotent(p_event_key text, p_booking_id uuid, p_outcome text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_elevenlabs_event_idempotent(p_event_key text, p_booking_id uuid, p_outcome text) TO service_role;

REVOKE ALL ON FUNCTION public.process_translate_event_idempotent(p_event_key text, p_story_id uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_translate_event_idempotent(p_event_key text, p_story_id uuid) TO service_role;

-- Payment function: Stripe webhook handler only
REVOKE ALL ON FUNCTION public.grant_day_pass_idempotent(p_event_id text, p_user_id uuid, p_payment_provider_id text, p_expires_at timestamp with time zone, p_amount_paid integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grant_day_pass_idempotent(p_event_id text, p_user_id uuid, p_payment_provider_id text, p_expires_at timestamp with time zone, p_amount_paid integer) TO service_role;

-- Trigger functions (not meant to be called directly via REST)
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

REVOKE ALL ON FUNCTION public.notify_webhook() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_webhook() TO service_role;

REVOKE ALL ON FUNCTION public.trigger_translation_webhook() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.trigger_translation_webhook() TO service_role;

-- Admin-only utility: DB health monitoring and QA cleanup
REVOKE ALL ON FUNCTION public.get_database_size() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_database_size() TO service_role;

REVOKE ALL ON FUNCTION public.cleanup_qa_test_user(test_email text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_qa_test_user(test_email text) TO service_role;

-- User helper: only used server-side, not called from frontend
REVOKE ALL ON FUNCTION public.is_story_favorited(p_user_id uuid, p_story_id uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_story_favorited(p_user_id uuid, p_story_id uuid) TO service_role;
