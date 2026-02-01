-- Migration: Localization Agent feature flag
-- Adds toggle for the automated localization completeness agent

-- Insert localization agent flag for production environment
INSERT INTO feature_flags (id, flag_key, enabled, label, description, config, environment)
VALUES
  (
    gen_random_uuid(),
    'localization_agent_enabled',
    false,
    'Localization Agent',
    'Weekly Sunday 7AM: Ensures 100% translation coverage across all locales (es, en, fr, de, pt)',
    '{"schedule": "weekly Sunday 7AM", "output_file": "docs/agents/localization-report.md"}',
    'production'
  )
ON CONFLICT (flag_key, environment) DO NOTHING;

-- Insert same flag for development environment
INSERT INTO feature_flags (id, flag_key, enabled, label, description, config, environment)
VALUES
  (
    gen_random_uuid(),
    'localization_agent_enabled',
    false,
    'Localization Agent',
    'Weekly Sunday 7AM: Ensures 100% translation coverage across all locales (es, en, fr, de, pt)',
    '{"schedule": "weekly Sunday 7AM", "output_file": "docs/agents/localization-report.md"}',
    'development'
  )
ON CONFLICT (flag_key, environment) DO NOTHING;
