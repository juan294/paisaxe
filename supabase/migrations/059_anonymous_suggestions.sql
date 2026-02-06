-- Migration: Allow anonymous story suggestions
-- Users no longer need to log in to submit suggestions.
-- The attribution field serves as the identity for anonymous submissions.

-- Make user_id nullable so anonymous users can submit suggestions
alter table public.story_suggestions
  alter column user_id drop not null;

-- Drop the existing user-scoped policies (they require auth.uid() match)
drop policy if exists "Users can view own suggestions" on story_suggestions;
drop policy if exists "Users can insert own suggestions" on story_suggestions;

-- Authenticated users can still view their own suggestions
create policy "Authenticated users can view own suggestions"
  on story_suggestions for select
  using (auth.uid() = user_id);

-- Authenticated users can insert with their user_id
create policy "Authenticated users can insert own suggestions"
  on story_suggestions for insert
  with check (auth.uid() = user_id);

-- Anonymous users can insert suggestions with null user_id
-- Uses the anon role (Supabase public/anon key)
create policy "Anonymous users can insert suggestions"
  on story_suggestions for insert
  to anon
  with check (user_id is null);

-- Update feature flag description
update public.feature_flags
  set description = 'Allow visitors to suggest places for new stories'
  where flag_key = 'user_story_suggestions';
