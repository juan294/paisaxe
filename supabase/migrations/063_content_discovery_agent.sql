-- Content Discovery Agent
-- Refs #41
--
-- 1. Update source_type check constraint to include 'agent_discovered'
-- 2. Add feature flag for content discovery agent
-- 3. Add partial index for agent-discovered stories

-- Drop the inline check constraint on source_type and recreate with new value
-- The constraint was created inline in migration 028, so it has an auto-generated name.
-- PostgreSQL names inline column constraints as: {table}_{column}_check
alter table public.stories
  drop constraint if exists stories_source_type_check;

-- Also try the unnamed pattern used by some PG versions
do $$
begin
  -- Find and drop any CHECK constraint on source_type
  perform 1
  from information_schema.constraint_column_usage
  where table_name = 'stories'
    and column_name = 'source_type'
    and constraint_name != 'stories_source_type_check';
exception when others then
  null;
end $$;

alter table public.stories
  add constraint stories_source_type_check
  check (source_type in ('curated', 'user_submitted', 'agent_discovered'));

-- Feature flag for content discovery agent (disabled by default in both environments)
insert into public.feature_flags (flag_key, enabled, label, description, environment)
values
  ('content_discovery_agent_enabled', false, 'Content Discovery Agent',
   'Scheduled agent that discovers new Asturias places via Google Places API and creates pending story drafts for admin review.',
   'development'),
  ('content_discovery_agent_enabled', false, 'Content Discovery Agent',
   'Scheduled agent that discovers new Asturias places via Google Places API and creates pending story drafts for admin review.',
   'production')
on conflict (flag_key, environment) do nothing;

-- Partial index for efficiently querying agent-discovered stories
create index if not exists stories_agent_discovered_idx
  on public.stories (source_type)
  where source_type = 'agent_discovered';
