-- Migration: Add attribution field to story_suggestions
-- Allows users to specify how they want to be credited (name, social handle, etc.)

alter table public.story_suggestions
  add column if not exists attribution text;

comment on column public.story_suggestions.attribution is 'How the user wants to be credited (e.g., name, social handle). Optional - if null, suggestion is anonymous.';
