-- Migration: Rename docs_freshness_agent_enabled to documentation_agent_enabled
-- Establishes uniform naming convention for agents

-- Update the feature flag key for both environments
UPDATE feature_flags
SET
  flag_key = 'documentation_agent_enabled',
  label = 'Documentation Agent',
  updated_at = now()
WHERE flag_key = 'docs_freshness_agent_enabled';

-- Update any config references (the prompt text may reference the old name)
UPDATE feature_flags
SET
  config = jsonb_set(
    config,
    '{output_file}',
    '"docs/agents/documentation-report.md"'
  )
WHERE flag_key = 'documentation_agent_enabled'
  AND config ? 'output_file';
