-- Migration: Update agent output paths to docs/agents/ subfolder

-- Update coverage agent output path
UPDATE feature_flags
SET config = jsonb_set(config, '{output_file}', '"docs/agents/coverage-report.md"')
WHERE flag_key = 'coverage_agent_enabled';

-- Update security agent output path
UPDATE feature_flags
SET config = jsonb_set(config, '{output_file}', '"docs/agents/security-report.md"')
WHERE flag_key = 'security_agent_enabled';

-- Update docs freshness agent output path
UPDATE feature_flags
SET config = jsonb_set(config, '{output_file}', '"docs/agents/docs-freshness-report.md"')
WHERE flag_key = 'docs_freshness_agent_enabled';

-- Update performance agent output path
UPDATE feature_flags
SET config = jsonb_set(config, '{output_file}', '"docs/agents/performance-report.md"')
WHERE flag_key = 'performance_agent_enabled';
