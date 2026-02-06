-- Cost Analyst Agent feature flag
-- Daily at 3AM: Analyzes platform costs, usage trends, tier proximity, and spending anomalies

INSERT INTO feature_flags (id, flag_key, enabled, label, description, config, environment)
VALUES
  (gen_random_uuid(), 'cost_analyst_agent_enabled', false, 'Cost Analyst Agent',
   'Daily at 3AM: Analyzes platform costs, usage trends, tier proximity, and spending anomalies',
   '{"schedule": "daily 3AM", "output_file": "docs/agents/cost-analyst-report.md"}',
   'production'),
  (gen_random_uuid(), 'cost_analyst_agent_enabled', false, 'Cost Analyst Agent',
   'Daily at 3AM: Analyzes platform costs, usage trends, tier proximity, and spending anomalies',
   '{"schedule": "daily 3AM", "output_file": "docs/agents/cost-analyst-report.md"}',
   'development')
ON CONFLICT (flag_key, environment) DO NOTHING;
