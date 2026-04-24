-- Create pending_bookings table for SMS booking confirmation flow
-- This table tracks booking requests from ElevenLabs booking agent calls
-- and is used by the webhook handler to send SMS confirmations.

CREATE TABLE pending_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key TEXT NOT NULL,         -- Caller-supplied claim key before placing the call
  conversation_id TEXT,                  -- From ElevenLabs call initiation
  venue_name TEXT NOT NULL,
  venue_phone TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,          -- Where to send SMS (E.164 format)
  party_size INTEGER NOT NULL,
  booking_date TEXT NOT NULL,
  booking_time TEXT NOT NULL,
  special_requests TEXT,
  status TEXT NOT NULL DEFAULT 'initiating', -- initiating, pending, confirmed, denied, no_answer, failed
  outcome_message TEXT,                   -- What we told the customer via SMS
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique claim key for request idempotency
CREATE UNIQUE INDEX idx_pending_bookings_idempotency_key ON pending_bookings(idempotency_key);

-- Unique webhook lookup key once ElevenLabs returns a conversation id
CREATE UNIQUE INDEX idx_pending_bookings_conversation_id
  ON pending_bookings(conversation_id)
  WHERE conversation_id IS NOT NULL;

-- Index for status-based queries (e.g., finding stale pending bookings)
CREATE INDEX idx_pending_bookings_status ON pending_bookings(status);

-- Index for customer lookups (future: booking history page)
CREATE INDEX idx_pending_bookings_customer_phone ON pending_bookings(customer_phone);

-- RLS: Only service role can access (webhook + backend)
-- No user-facing access needed initially
ALTER TABLE pending_bookings ENABLE ROW LEVEL SECURITY;

-- No RLS policies = only service role (using service key) can access

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION public.update_pending_bookings_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER pending_bookings_updated_at
  BEFORE UPDATE ON pending_bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_pending_bookings_updated_at();
