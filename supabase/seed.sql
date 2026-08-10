-- Deterministic local-only fixture for the release-required favorite roundtrip.
-- Supabase applies this file only during local database reset/start.
INSERT INTO public.stories (
  id,
  slug,
  title,
  description,
  category,
  display_order,
  is_active,
  curation_status,
  source_type
)
VALUES (
  '00000000-0000-4000-8000-000000000160',
  'release-probe-local-story',
  'Release Probe Local Story',
  'Deterministic local fixture for release verification.',
  'release-verification',
  0,
  true,
  'approved',
  'curated'
)
ON CONFLICT (slug) DO NOTHING;
