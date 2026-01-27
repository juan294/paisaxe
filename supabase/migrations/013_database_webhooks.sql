-- ============================================================================
-- Migration: 013_database_webhooks.sql
-- Purpose: Set up database webhooks via pg_net for automatic cache invalidation
--
-- pg_net is a PostgreSQL extension that allows making HTTP requests directly
-- from the database. We use it to notify the Next.js application when data
-- changes, enabling on-demand cache revalidation without polling.
--
-- PREREQUISITES:
--   1. Enable pg_net in Supabase Dashboard: Database > Extensions > "pg_net"
--   2. Configure app settings (see below)
--
-- CONFIGURATION:
--   Set these via Supabase SQL Editor or Dashboard (Database > Settings):
--
--   ALTER DATABASE postgres SET app.webhook_base_url = 'https://paisaxe.com';
--   ALTER DATABASE postgres SET app.webhook_secret = 'your-secret-here';
--
--   The webhook_base_url should point to your Vercel deployment:
--     - Production: https://paisaxe.com
--     - Preview: https://your-branch.paisaxe.vercel.app
--
--   The webhook_secret must match the WEBHOOK_SECRET env var on Vercel.
--
-- HOW IT WORKS:
--   When a row is updated in the stories or feature_flags tables, a trigger
--   fires and sends an HTTP POST to /api/webhooks/supabase with a JSON payload
--   containing the table name, operation, and changed data. The Next.js API
--   route then revalidates the appropriate cached paths.
-- ============================================================================

-- Enable pg_net extension for outbound HTTP requests from PostgreSQL
-- pg_net is available on all Supabase plans (free tier included)
create extension if not exists pg_net with schema extensions;

-- ============================================================================
-- Webhook trigger function
-- ============================================================================
-- Generic function that sends an HTTP POST to the configured webhook URL.
-- Reused by all webhook triggers — the table name and operation are included
-- in the payload so the receiver can route accordingly.
--
-- Uses current_setting with missing_ok=true so the function won't error if
-- the settings are not yet configured (it will silently skip the HTTP call).
-- ============================================================================
create or replace function public.notify_webhook()
returns trigger
language plpgsql
security definer
as $$
declare
  _base_url text;
  _secret text;
  _payload jsonb;
begin
  -- Read configuration from app settings
  _base_url := current_setting('app.webhook_base_url', true);
  _secret := current_setting('app.webhook_secret', true);

  -- Skip if not configured (prevents errors during development/testing)
  if _base_url is null or _base_url = '' then
    raise notice '[webhook] app.webhook_base_url not configured — skipping';
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
  -- pg_net requests are fire-and-forget: they do not block the transaction
  perform net.http_post(
    url := _base_url || '/api/webhooks/supabase',
    body := _payload::text,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', coalesce(_secret, '')
    )
  );

  return coalesce(new, old);
exception
  when others then
    -- Log the error but do NOT block the original transaction
    raise warning '[webhook] Failed to send webhook: % %', SQLERRM, SQLSTATE;
    return coalesce(new, old);
end;
$$;

-- ============================================================================
-- Webhook triggers
-- ============================================================================

-- Stories table: fires on UPDATE for cache invalidation
-- Covers: content edits, status changes (draft/published), image updates
create trigger stories_webhook_on_update
  after update on public.stories
  for each row
  execute function public.notify_webhook();

-- Feature flags table: fires on UPDATE for real-time flag changes
-- Provides a server-side fallback alongside Supabase Realtime subscriptions
create trigger feature_flags_webhook_on_update
  after update on public.feature_flags
  for each row
  execute function public.notify_webhook();

-- ============================================================================
-- Verify triggers (run manually after migration):
--   SELECT tgname, tgrelid::regclass, tgenabled
--   FROM pg_trigger
--   WHERE tgname LIKE '%webhook%'
--   ORDER BY tgname;
-- ============================================================================
