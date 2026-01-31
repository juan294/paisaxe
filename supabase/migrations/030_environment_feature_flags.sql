-- Migration: Environment-aware feature flags
-- Each environment (development, production) has its own set of flags

-- Add environment column (non-nullable after we populate existing rows)
ALTER TABLE feature_flags
ADD COLUMN IF NOT EXISTS environment text;

-- Set existing rows to 'production' (they were created for production use)
UPDATE feature_flags
SET environment = 'production'
WHERE environment IS NULL;

-- Make environment non-nullable now that all rows have a value
ALTER TABLE feature_flags
ALTER COLUMN environment SET NOT NULL;

-- Add default for new rows
ALTER TABLE feature_flags
ALTER COLUMN environment SET DEFAULT 'production';

-- Drop the existing unique constraint on flag_key
ALTER TABLE feature_flags
DROP CONSTRAINT IF EXISTS feature_flags_flag_key_key;

-- Add new unique constraint on (flag_key, environment)
-- This allows the same flag_key to exist for different environments
ALTER TABLE feature_flags
ADD CONSTRAINT feature_flags_flag_key_environment_key UNIQUE (flag_key, environment);

-- Create development versions of all flags (initially matching production state)
INSERT INTO feature_flags (id, flag_key, enabled, label, description, config, environment)
SELECT
  gen_random_uuid() as id,
  flag_key,
  enabled,
  label,
  description,
  config,
  'development' as environment
FROM feature_flags
WHERE environment = 'production'
ON CONFLICT (flag_key, environment) DO NOTHING;

-- Add index for faster environment-based lookups
CREATE INDEX IF NOT EXISTS idx_feature_flags_environment
ON feature_flags (environment);

-- Add check constraint to limit valid environments
ALTER TABLE feature_flags
ADD CONSTRAINT feature_flags_environment_check
CHECK (environment IN ('development', 'production'));

-- Comment for documentation
COMMENT ON COLUMN feature_flags.environment IS
  'Environment scope for this flag: development (localhost) or production (live site)';
