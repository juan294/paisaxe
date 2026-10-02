-- ============================================================================
-- Migration: 108_restore_notify_webhook_search_path.sql
-- Purpose: Restore SET search_path = '' on public.notify_webhook() (BE-M2, #783)
--
-- Migration 015_security_advisor_fixes.sql set `notify_webhook()` to
-- `SECURITY DEFINER ... SET search_path = ''` to close a Security Advisor
-- "Function Search Path Mutable" warning.
--
-- Migration 025_webhook_config_table.sql later redefined the SAME function
-- (to read configuration from the new webhook_config table instead of
-- app.* database settings) and, in doing so, silently reverted the
-- search_path back to `public, extensions`. This was the only
-- SECURITY DEFINER function left off `search_path = ''`.
--
-- This migration restores `search_path = ''` while keeping migration 025's
-- config-table-backed logic completely unchanged — no behavioral change,
-- only the SET clause.
--
-- Why this is safe: every reference inside the function body is already
-- schema-qualified or resolves via pg_catalog, which is implicitly searched
-- even when search_path is empty:
--   - public.webhook_config          -- already schema-qualified
--   - net.http_post                  -- already schema-qualified (pg_net)
--   - jsonb_build_object, row_to_json, coalesce, now()  -- pg_catalog builtins
--   - TG_TABLE_NAME, TG_OP, SQLERRM, SQLSTATE           -- plpgsql special vars,
--     not affected by search_path
-- No reference needed to change.
-- ============================================================================

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
-- Verify (run manually after migration):
--   SELECT p.proname, p.prosecdef,
--          pg_get_function_identity_arguments(p.oid) AS args,
--          p.proconfig
--   FROM pg_proc p
--   JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE n.nspname = 'public' AND p.proname = 'notify_webhook';
--   -- proconfig should include: {search_path=}
-- ============================================================================
