-- Migration: Add user_favorites table for favorited stories
-- Supports both anonymous (localStorage) and authenticated (cloud sync) favorites

-- User favorites table for storing authenticated users' favorites
create table if not exists user_favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,  -- References Supabase auth.users
  story_id uuid not null references stories(id) on delete cascade,
  created_at timestamptz default now(),

  -- Ensure unique user-story combination
  constraint unique_user_story unique (user_id, story_id)
);

-- Create indexes for efficient queries
create index if not exists user_favorites_user_idx on user_favorites (user_id);
create index if not exists user_favorites_story_idx on user_favorites (story_id);
create index if not exists user_favorites_created_idx on user_favorites (created_at desc);

-- Enable Row Level Security
alter table user_favorites enable row level security;

-- Users can only view their own favorites (drop and recreate to be idempotent)
drop policy if exists "Users can view own favorites" on user_favorites;
create policy "Users can view own favorites"
  on user_favorites for select
  using (auth.uid() = user_id);

-- Users can insert their own favorites
drop policy if exists "Users can insert own favorites" on user_favorites;
create policy "Users can insert own favorites"
  on user_favorites for insert
  with check (auth.uid() = user_id);

-- Users can delete their own favorites
drop policy if exists "Users can delete own favorites" on user_favorites;
create policy "Users can delete own favorites"
  on user_favorites for delete
  using (auth.uid() = user_id);

-- Function to get favorite count for a story (useful for analytics)
create or replace function get_story_favorite_count(p_story_id uuid)
returns bigint as $$
  select count(*) from user_favorites where story_id = p_story_id;
$$ language sql stable;

-- Function to check if a user has favorited a story
create or replace function is_story_favorited(p_user_id uuid, p_story_id uuid)
returns boolean as $$
  select exists(
    select 1 from user_favorites
    where user_id = p_user_id and story_id = p_story_id
  );
$$ language sql stable security definer;
