-- Migration: Add maintenance_mode feature flag
-- When enabled, redirects all visitor traffic to /coming-soon page
-- Admin, API, and auth routes bypass this check

INSERT INTO public.feature_flags (id, flag_key, enabled, label, description, config)
VALUES (
  gen_random_uuid(),
  'maintenance_mode',
  false,
  'Maintenance Mode',
  'Show "Coming Soon" page to visitors. Admin panel and API routes remain accessible.',
  '{}'::jsonb
)
ON CONFLICT (flag_key) DO NOTHING;
