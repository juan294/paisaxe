-- Migration: Story Suggestions feature
-- Allows logged-in visitors to suggest places for new stories

-- Story suggestions table
create table if not exists story_suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  place_name text not null,
  comment text,
  location text check (location in ('eastern', 'central', 'western')),
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'converted', 'rejected')),
  admin_notes text,
  converted_story_id uuid references public.stories(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Create indexes for common queries
create index if not exists story_suggestions_user_idx on story_suggestions (user_id);
create index if not exists story_suggestions_status_idx on story_suggestions (status);
create index if not exists story_suggestions_created_idx on story_suggestions (created_at desc);

-- Auto-update updated_at on modification
create or replace function update_story_suggestions_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger story_suggestions_updated_at
  before update on story_suggestions
  for each row
  execute function update_story_suggestions_updated_at();

-- Enable Row Level Security
alter table story_suggestions enable row level security;

-- Users can view their own suggestions
drop policy if exists "Users can view own suggestions" on story_suggestions;
create policy "Users can view own suggestions"
  on story_suggestions for select
  using (auth.uid() = user_id);

-- Users can insert their own suggestions
drop policy if exists "Users can insert own suggestions" on story_suggestions;
create policy "Users can insert own suggestions"
  on story_suggestions for insert
  with check (auth.uid() = user_id);

-- Service role can manage all suggestions (for admin operations)
drop policy if exists "Service role can manage suggestions" on story_suggestions;
create policy "Service role can manage suggestions"
  on story_suggestions for all
  to service_role
  using (true)
  with check (true);

-- Add source_type and suggestion_id columns to stories table
alter table public.stories
  add column if not exists source_type text default 'curated' check (source_type in ('curated', 'user_submitted'));

alter table public.stories
  add column if not exists suggestion_id uuid references public.story_suggestions(id) on delete set null;

-- Create index for source_type queries
create index if not exists stories_source_type_idx on public.stories (source_type);

-- Add the feature flag for user story suggestions
insert into public.feature_flags (flag_key, enabled, label, description) values
  ('user_story_suggestions', false, 'User Story Suggestions', 'Allow logged-in visitors to suggest places for new stories')
on conflict (flag_key) do nothing;
