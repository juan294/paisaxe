-- Analytics events table for A/B testing and feature usage tracking
create table if not exists analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  feature_flag text,
  session_id text,
  metadata jsonb default '{}'::jsonb,
  user_agent text,
  ip_hash text,
  created_at timestamptz default now()
);

-- Indexes for efficient querying
create index idx_analytics_event_name on analytics_events (event_name);
create index idx_analytics_feature_flag on analytics_events (feature_flag);
create index idx_analytics_session_id on analytics_events (session_id);
create index idx_analytics_created_at on analytics_events (created_at);
create index idx_analytics_feature_created on analytics_events (feature_flag, created_at);

-- RLS: public can insert only (no public read)
alter table analytics_events enable row level security;

create policy "Public can insert analytics events"
  on analytics_events for insert
  to anon, authenticated
  with check (true);

create policy "Service role can read analytics events"
  on analytics_events for select
  to service_role
  using (true);
