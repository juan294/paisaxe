-- Migration: Automated agents feature flags
-- Adds toggles for local automated agents (coverage, security, docs, performance)

-- Insert automated agents flags for production environment
INSERT INTO feature_flags (id, flag_key, enabled, label, description, config, environment)
VALUES
  -- Master toggle (kill switch for all agents)
  (
    gen_random_uuid(),
    'automated_agents',
    true,
    'Automated Agents (Master)',
    'Kill switch for all local automated agents. When disabled, no agents will run.',
    '{}',
    'production'
  ),
  -- Coverage Agent
  (
    gen_random_uuid(),
    'coverage_agent_enabled',
    true,
    'Coverage Agent',
    'Daily at 2AM: Analyzes test coverage and writes missing tests',
    '{"schedule": "daily 2AM"}',
    'production'
  ),
  -- Security Agent
  (
    gen_random_uuid(),
    'security_agent_enabled',
    false,
    'Security Agent',
    'Weekly Monday 9AM: Runs npm audit and license checks',
    '{"schedule": "weekly Monday 9AM"}',
    'production'
  ),
  -- Docs Freshness Agent
  (
    gen_random_uuid(),
    'docs_freshness_agent_enabled',
    false,
    'Docs Freshness Agent',
    'Weekly Sunday 6AM: Checks for stale documentation',
    '{"schedule": "weekly Sunday 6AM"}',
    'production'
  ),
  -- Performance Agent
  (
    gen_random_uuid(),
    'performance_agent_enabled',
    false,
    'Performance Agent',
    'Weekly Saturday 10AM: Runs Lighthouse and bundle size analysis',
    '{"schedule": "weekly Saturday 10AM"}',
    'production'
  )
ON CONFLICT (flag_key, environment) DO NOTHING;

-- Insert same flags for development environment (all disabled by default)
INSERT INTO feature_flags (id, flag_key, enabled, label, description, config, environment)
VALUES
  (
    gen_random_uuid(),
    'automated_agents',
    true,
    'Automated Agents (Master)',
    'Kill switch for all local automated agents. When disabled, no agents will run.',
    '{}',
    'development'
  ),
  (
    gen_random_uuid(),
    'coverage_agent_enabled',
    true,
    'Coverage Agent',
    'Daily at 2AM: Analyzes test coverage and writes missing tests',
    '{"schedule": "daily 2AM"}',
    'development'
  ),
  (
    gen_random_uuid(),
    'security_agent_enabled',
    false,
    'Security Agent',
    'Weekly Monday 9AM: Runs npm audit and license checks',
    '{"schedule": "weekly Monday 9AM"}',
    'development'
  ),
  (
    gen_random_uuid(),
    'docs_freshness_agent_enabled',
    false,
    'Docs Freshness Agent',
    'Weekly Sunday 6AM: Checks for stale documentation',
    '{"schedule": "weekly Sunday 6AM"}',
    'development'
  ),
  (
    gen_random_uuid(),
    'performance_agent_enabled',
    false,
    'Performance Agent',
    'Weekly Saturday 10AM: Runs Lighthouse and bundle size analysis',
    '{"schedule": "weekly Saturday 10AM"}',
    'development'
  )
ON CONFLICT (flag_key, environment) DO NOTHING;

-- Add comment for documentation
COMMENT ON TABLE feature_flags IS
  'Feature flags with environment-aware settings. Includes automated agent controls in System category.';
