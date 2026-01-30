-- ============================================================================
-- Migration: 025_webhook_config_table.sql
-- Purpose: Replace app.* database settings with a config table
--
-- Supabase restricts ALTER DATABASE SET app.* commands, so we use a config
-- table instead. This is more portable and doesn't require superuser privileges.
-- ============================================================================

-- Create a simple config table for webhook settings
create table if not exists public.webhook_config (
  key text primary key,
  value text not null,
  updated_at timestamptz default now()
);

-- Insert the webhook configuration
insert into public.webhook_config (key, value) values
  ('base_url', 'https://paisaxe.es'),
  ('secret', '')  -- Will be updated with actual secret
on conflict (key) do update set
  value = excluded.value,
  updated_at = now();

-- Grant read access to the postgres role (for the trigger function)
grant select on public.webhook_config to postgres;

-- RLS: Only allow service role to modify
alter table public.webhook_config enable row level security;

create policy "Service role can manage webhook config"
  on public.webhook_config
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Authenticated can read webhook config"
  on public.webhook_config
  for select
  using (true);

-- ============================================================================
-- Update the webhook trigger function to use the config table
-- ============================================================================
create or replace function public.notify_webhook()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
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
-- Verify configuration:
--   SELECT * FROM public.webhook_config;
-- ============================================================================
