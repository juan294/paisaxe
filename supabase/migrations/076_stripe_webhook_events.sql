-- Migration: 076_stripe_webhook_events
-- Purpose: Create stripe_webhook_events table for idempotent webhook processing.
--          Each Stripe event.id is recorded before processing to prevent
--          duplicate grants caused by Stripe retries or race conditions.

CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   TEXT        UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Allow the service-role (admin client) to insert and select
GRANT SELECT, INSERT ON stripe_webhook_events TO service_role;
