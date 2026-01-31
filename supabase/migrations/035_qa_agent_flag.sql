-- Migration: QA Agent feature flag
-- Adds toggle for the automated QA testing agent

-- Insert QA agent flag for production environment
INSERT INTO feature_flags (id, flag_key, enabled, label, description, config, environment)
VALUES
  (
    gen_random_uuid(),
    'qa_agent_enabled',
    false,
    'QA Agent',
    'Weekly Sunday 8AM: Automated LLM testing for RAG quality, safety, and response quality',
    '{"schedule": "weekly Sunday 8AM", "testsPerCategory": 3}',
    'production'
  )
ON CONFLICT (flag_key, environment) DO NOTHING;

-- Insert same flag for development environment
INSERT INTO feature_flags (id, flag_key, enabled, label, description, config, environment)
VALUES
  (
    gen_random_uuid(),
    'qa_agent_enabled',
    false,
    'QA Agent',
    'Weekly Sunday 8AM: Automated LLM testing for RAG quality, safety, and response quality',
    '{"schedule": "weekly Sunday 8AM", "testsPerCategory": 3}',
    'development'
  )
ON CONFLICT (flag_key, environment) DO NOTHING;
