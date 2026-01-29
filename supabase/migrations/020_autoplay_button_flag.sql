-- Add autoplay button feature flag
-- Controls visibility of the play/pause button in the story viewer

insert into public.feature_flags (id, flag_key, enabled, label, description, config, created_at, updated_at)
values (
  gen_random_uuid(),
  'autoplay_button',
  false,
  'Autoplay Button',
  'Show the play/pause button for auto-advancing stories',
  '{}'::jsonb,
  now(),
  now()
)
on conflict (flag_key) do nothing;
