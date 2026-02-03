-- QA Agent Enhanced Configuration
-- Adds new config options for journey tests and GitHub issue filing

-- Update the qa_agent_enabled feature flag config with new options
UPDATE public.feature_flags
SET config = jsonb_set(
  jsonb_set(
    COALESCE(config, '{}'::jsonb),
    '{enableJourneyTests}',
    'true'::jsonb
  ),
  '{enableGithubIssues}',
  'true'::jsonb
)
WHERE flag_key = 'qa_agent_enabled';

-- Add comment documenting the new config options
COMMENT ON TABLE public.feature_flags IS
  'Feature flags for runtime configuration. The qa_agent_enabled flag supports:
   - testsPerCategory: Number of LLM tests per category (default: 3)
   - enableJourneyTests: Run Playwright browser journey tests (default: true)
   - enableGithubIssues: Auto-file GitHub issues on failures (default: true)
   - prompt: Claude analysis prompt for generating QA reports';
