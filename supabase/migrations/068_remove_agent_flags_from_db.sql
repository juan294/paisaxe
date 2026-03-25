-- Remove agent feature flags from the database.
-- These flags are now managed locally via scripts/agent-config.json
-- and are no longer needed in Supabase.

DELETE FROM feature_flags WHERE flag_key IN (
  'automated_agents',
  'coverage_agent_enabled',
  'security_agent_enabled',
  'documentation_agent_enabled',
  'performance_agent_enabled',
  'qa_agent_enabled',
  'localization_agent_enabled',
  'cost_analyst_agent_enabled',
  'subscription_optimizer_enabled',
  'content_discovery_agent_enabled'
);
