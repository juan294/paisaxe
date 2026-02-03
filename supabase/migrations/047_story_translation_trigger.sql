-- ============================================================================
-- Migration: 047_story_translation_trigger.sql
-- Purpose: Auto-trigger story translation when a story is approved
--
-- When a story's curation_status changes to 'approved' and it doesn't have
-- translations yet, this trigger calls the translation webhook to generate
-- translations in all 5 supported locales (en, fr, de, pt, ast).
--
-- This enables "approve once, translate automatically" workflow for admins.
--
-- PREREQUISITES:
--   1. pg_net extension must be enabled (done in 013_database_webhooks.sql)
--   2. webhook_config table must have base_url and secret configured
--   3. /api/webhooks/translate endpoint must be deployed
-- ============================================================================

-- ============================================================================
-- Translation webhook trigger function
-- ============================================================================
-- Fires when a story is approved and has no existing translations.
-- Sends an async HTTP POST to /api/webhooks/translate with the story ID.
-- ============================================================================
create or replace function public.trigger_translation_webhook()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _base_url text;
  _secret text;
  _payload jsonb;
  _has_translations boolean;
begin
  -- Read configuration from app settings
  _base_url := current_setting('app.webhook_base_url', true);
  _secret := current_setting('app.webhook_secret', true);

  -- Skip if not configured
  if _base_url is null or _base_url = '' then
    raise notice '[translation-trigger] app.webhook_base_url not configured — skipping';
    return new;
  end if;

  -- Check if story already has translations
  _has_translations := (
    new.metadata IS NOT NULL AND
    new.metadata->'translations' IS NOT NULL AND
    jsonb_typeof(new.metadata->'translations') = 'object' AND
    (new.metadata->'translations')::jsonb != '{}'::jsonb
  );

  -- Only trigger if no existing translations
  if _has_translations then
    raise notice '[translation-trigger] Story % already has translations — skipping', new.id;
    return new;
  end if;

  -- Build the JSON payload
  _payload := jsonb_build_object(
    'storyId', new.id,
    'forceRetranslate', false
  );

  -- Send the HTTP POST via pg_net (non-blocking / async)
  perform extensions.net.http_post(
    url := _base_url || '/api/webhooks/translate',
    body := _payload::text,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', coalesce(_secret, '')
    )
  );

  raise notice '[translation-trigger] Triggered translation for story %', new.id;

  return new;
exception
  when others then
    -- Log the error but do NOT block the original transaction
    raise warning '[translation-trigger] Failed to trigger translation for story %: % %', new.id, SQLERRM, SQLSTATE;
    return new;
end;
$$;

-- ============================================================================
-- Translation trigger
-- ============================================================================
-- Fires AFTER UPDATE when curation_status changes to 'approved'
-- The WHEN clause filters at the trigger level for efficiency
-- ============================================================================
create trigger stories_translation_on_approval
  after update on public.stories
  for each row
  when (
    new.curation_status = 'approved'
    and old.curation_status is distinct from 'approved'
  )
  execute function public.trigger_translation_webhook();

-- ============================================================================
-- Grant execute permission to authenticated users (needed for trigger)
-- ============================================================================
grant execute on function public.trigger_translation_webhook() to service_role;

-- ============================================================================
-- Verification queries (run manually after migration):
--
-- Check trigger exists:
--   SELECT tgname, tgrelid::regclass, tgenabled
--   FROM pg_trigger
--   WHERE tgname = 'stories_translation_on_approval';
--
-- Test trigger (approve a story without translations):
--   UPDATE stories SET curation_status = 'approved' WHERE id = 'your-story-id';
--
-- Check pg_net job queue:
--   SELECT * FROM net._http_response ORDER BY created DESC LIMIT 10;
-- ============================================================================
