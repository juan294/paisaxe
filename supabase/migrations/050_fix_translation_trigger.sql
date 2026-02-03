-- ============================================================================
-- Migration: 050_fix_translation_trigger.sql
-- Purpose: Fix translation trigger to use webhook_config table instead of
--          app.* settings (which can't be set on Supabase managed platform)
--
-- Issues fixed:
-- 1. Uses webhook_config table instead of app.webhook_base_url/app.webhook_secret
-- 2. Uses correct net.http_post signature (without extensions. prefix)
-- ============================================================================

-- ============================================================================
-- Updated translation webhook trigger function
-- ============================================================================
create or replace function public.trigger_translation_webhook()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  _base_url text;
  _secret text;
  _payload jsonb;
  _has_translations boolean;
begin
  -- Read configuration from webhook_config table (not app.* settings)
  select value into _base_url from public.webhook_config where key = 'base_url';
  select value into _secret from public.webhook_config where key = 'secret';

  -- Skip if not configured
  if _base_url is null or _base_url = '' then
    raise notice '[translation-trigger] webhook_config.base_url not configured — skipping';
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
  perform net.http_post(
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
-- Verification:
-- The trigger stories_translation_on_approval already exists from migration 047
-- and references this function, so it will use the updated version automatically.
--
-- Test by approving a story:
--   UPDATE stories SET curation_status = 'approved'
--   WHERE id = 'your-story-id' AND curation_status != 'approved';
-- ============================================================================
