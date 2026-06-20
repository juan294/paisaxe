-- Anthropic API usage tracking (#138)
-- Personal Anthropic accounts have no billing/Admin API, so we record per-request
-- token usage from the Messages API response and estimate cost from published
-- per-model pricing. The admin costs dashboard reads aggregates from this table
-- instead of a static $10/mo placeholder.

CREATE TABLE anthropic_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cache_creation_input_tokens INTEGER NOT NULL DEFAULT 0,
  cache_read_input_tokens INTEGER NOT NULL DEFAULT 0,
  -- Estimated cost in USD, computed at insert time from published per-model pricing.
  cost_usd NUMERIC(12, 6) NOT NULL DEFAULT 0,
  -- Coarse label for the call site (e.g. 'chat', 'chat_stream') for future breakdowns.
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Date-range queries for the costs dashboard (per-day + per-period totals).
CREATE INDEX idx_anthropic_usage_created_at ON anthropic_usage(created_at);

-- RLS: only the service role (backend) may read or write usage rows.
-- No user-facing access — the admin dashboard reads via the service-role client.
ALTER TABLE anthropic_usage ENABLE ROW LEVEL SECURITY;

-- No RLS policies = only the service role (using the service key) can access.
