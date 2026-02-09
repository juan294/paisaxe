-- Add development environment row for the Subscription Optimizer agent flag.
-- Migration 064 only created the production row.
INSERT INTO feature_flags (flag_key, enabled, label, description, config, environment)
VALUES (
  'subscription_optimizer_enabled', true,
  'Subscription Optimizer',
  'Analyzes service subscriptions and recommends cost optimizations. Runs weekly.',
  '{}', 'development'
) ON CONFLICT (flag_key, environment) DO NOTHING;
