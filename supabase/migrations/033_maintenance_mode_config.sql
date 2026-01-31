-- Migration: Add default config to maintenance_mode feature flag

UPDATE feature_flags
SET config = jsonb_build_object(
  'title', 'Próximamente',
  'message', '',
  'show_tagline', true
)
WHERE flag_key = 'maintenance_mode';
