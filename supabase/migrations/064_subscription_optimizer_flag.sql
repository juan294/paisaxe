-- Add feature flag for the Subscription Optimizer agent
INSERT INTO feature_flags (flag_key, enabled, label, description, config, environment)
VALUES (
  'subscription_optimizer_enabled', true,
  'Subscription Optimizer',
  'Analyzes service subscriptions and recommends cost optimizations. Runs weekly.',
  '{}', 'production'
) ON CONFLICT (flag_key, environment) DO NOTHING;
