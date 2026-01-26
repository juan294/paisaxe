-- Feature flags table for A/B testing and gradual feature rollout
create table if not exists feature_flags (
  id uuid primary key default gen_random_uuid(),
  flag_key text unique not null,
  enabled boolean not null default false,
  label text not null,
  description text,
  config jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Auto-update updated_at on modification
create or replace function update_feature_flags_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger feature_flags_updated_at
  before update on feature_flags
  for each row
  execute function update_feature_flags_updated_at();

-- RLS: public can read, only service-role can write
alter table feature_flags enable row level security;

create policy "Public can read feature flags"
  on feature_flags for select
  to anon, authenticated
  using (true);

create policy "Service role can manage feature flags"
  on feature_flags for all
  to service_role
  using (true)
  with check (true);

-- Seed all 10 feature flags (disabled by default)
insert into feature_flags (flag_key, enabled, label, description) values
  ('contextual_prompts', false, 'Contextual Question Prompts', 'Show story-specific question chips near the chat button'),
  ('related_stories', false, 'Related Stories', 'Display related stories carousel when story info is visible'),
  ('randomized_order', false, 'Randomized Story Order', 'Shuffle story order with a session-stable seed'),
  ('surprise_me', false, 'Surprise Me Button', 'Add a button that jumps to a random unviewed story'),
  ('story_sharing', false, 'Story Sharing', 'Enable share button with Web Share API and OG meta tags'),
  ('seasonal_surfacing', false, 'Seasonal Story Surfacing', 'Boost stories tagged for the current month'),
  ('mood_discovery', false, 'Mood-Based Discovery', 'Show mood selection overlay on first visit'),
  ('asturianu_touches', false, 'Asturianu Language Touches', 'Add Asturianu vocabulary to UI labels and AI responses'),
  ('ambient_discovery', false, 'Ambient Discovery Mode', 'Slower auto-play with cinematic zoom effect'),
  ('story_freshness', false, 'Story Freshness Badges', 'Show "Nuevo" badge on stories added within 14 days')
on conflict (flag_key) do nothing;
