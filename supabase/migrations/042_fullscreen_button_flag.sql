-- Migration: Fullscreen Button feature flag
-- Adds toggle for the fullscreen/PWA install button in the toolbar

-- Insert fullscreen button flag for production environment
INSERT INTO feature_flags (id, flag_key, enabled, label, description, config, environment)
VALUES
  (
    gen_random_uuid(),
    'fullscreen_button',
    false,
    'Fullscreen Button',
    'Shows fullscreen button in toolbar (desktop: native fullscreen, iOS/iPad: Add to Home Screen instructions)',
    '{}',
    'production'
  )
ON CONFLICT (flag_key, environment) DO NOTHING;

-- Insert same flag for development environment (enabled for testing)
INSERT INTO feature_flags (id, flag_key, enabled, label, description, config, environment)
VALUES
  (
    gen_random_uuid(),
    'fullscreen_button',
    true,
    'Fullscreen Button',
    'Shows fullscreen button in toolbar (desktop: native fullscreen, iOS/iPad: Add to Home Screen instructions)',
    '{}',
    'development'
  )
ON CONFLICT (flag_key, environment) DO NOTHING;
