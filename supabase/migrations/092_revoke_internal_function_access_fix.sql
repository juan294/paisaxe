-- ============================================================================
-- Migration: 092_revoke_internal_function_access_fix.sql
-- Purpose: Correct migration 091 — REVOKE FROM PUBLIC does not remove explicit
--          per-role grants. Must REVOKE FROM anon and FROM authenticated directly.
-- ============================================================================

-- Internal SMS queue functions
REVOKE EXECUTE ON FUNCTION public.claim_booking_sms_job(p_event_key text, p_lease_seconds integer) FROM anon, authenticated;
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
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION %s FROM anon, authenticated',
      v_function
    );
  END LOOP;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.fail_booking_sms_job(p_event_key text, p_error text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_booking_sms_job(p_event_key text, p_booking_id uuid, p_to_phone text, p_message text) FROM anon, authenticated;

-- Internal translation queue functions
REVOKE EXECUTE ON FUNCTION public.claim_next_translate_webhook_event(p_event_key text, p_lease_seconds integer, p_batch_size integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.complete_translate_webhook_event(p_event_key text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fail_translate_webhook_event(p_event_key text, p_error text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_translate_webhook_event(p_event_key text, p_story_id uuid, p_locales text[], p_force_retranslate boolean) FROM anon, authenticated;

-- Translation cron maintenance
REVOKE EXECUTE ON FUNCTION public.fail_stale_story_translations(p_cutoff timestamp with time zone) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fail_stale_story_translations_locked(p_cutoff timestamp with time zone) FROM anon, authenticated;

-- Webhook idempotency processors
REVOKE EXECUTE ON FUNCTION public.process_elevenlabs_event_idempotent(p_event_key text, p_booking_id uuid, p_outcome text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.process_translate_event_idempotent(p_event_key text, p_story_id uuid) FROM anon, authenticated;

-- Payment function: Stripe webhook handler only
REVOKE EXECUTE ON FUNCTION public.grant_day_pass_idempotent(p_event_id text, p_user_id uuid, p_payment_provider_id text, p_expires_at timestamp with time zone, p_amount_paid integer) FROM anon, authenticated;

-- Trigger functions
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_webhook() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trigger_translation_webhook() FROM anon, authenticated;

-- Admin utilities
REVOKE EXECUTE ON FUNCTION public.get_database_size() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_qa_test_user(test_email text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_story_favorited(p_user_id uuid, p_story_id uuid) FROM anon, authenticated;
