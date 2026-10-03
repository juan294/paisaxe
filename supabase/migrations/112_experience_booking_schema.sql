-- ============================================================================
-- Migration: 112_experience_booking_schema.sql
-- Purpose: Booking domain for the PayPal hackathon experience booking
--          (docs/plans/2026-10-03-paypal-hackathon-booking.md, Phase 1).
--
-- Tables: merchants, experiences, experience_facts, booking_drafts, quotes,
-- holds, bookings, payments.
--
-- Inventory has exactly one owner at each stage (F04): before confirmation the
-- live hold (unexpired, unreleased, unconsumed); after confirmation the
-- `confirmed` booking, whose hold is marked consumed in the same transaction.
-- A pending_payment booking never counts by itself. See
-- public.experience_availability in migration 113.
--
-- Every status is a CHECK, never free text: a new state is a migration.
--
-- Posture: every table is service-role only (RLS enabled, REVOKE ALL from
-- anon and authenticated, explicit service_role grant and policy), and listed
-- in SENSITIVE_SERVICE_ROLE_TABLES in scripts/check-migrations.ts. All access
-- goes through createAdminClient(); the guest's identity is checked in the
-- server code, never by RLS.
-- ============================================================================

-- Shared updated_at trigger function for the booking tables.
CREATE OR REPLACE FUNCTION public.set_booking_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- merchants
-- ---------------------------------------------------------------------------
CREATE TABLE public.merchants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  timezone text NOT NULL DEFAULT 'Europe/Madrid',
  cancellation_window_hours integer NOT NULL DEFAULT 24
    CHECK (cancellation_window_hours >= 0),
  -- Fixture rows are labelled demo data; reports and the operator view filter on it.
  is_fixture boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- experiences
-- price_cents is the total price for one party (up to max_party), so a quote's
-- total does not depend on the party size. Amounts are integer cents.
-- slot_rule: {"weekdays": [ISO 1 (Mon) .. 7 (Sun)], "start_times": ["HH:MM", ...]}
-- in the merchant's timezone.
-- ---------------------------------------------------------------------------
CREATE TABLE public.experiences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  description text,
  currency text NOT NULL DEFAULT 'EUR' CHECK (currency = 'EUR'),
  price_cents integer NOT NULL CHECK (price_cents > 0),
  deposit_cents integer NOT NULL,
  max_party integer NOT NULL CHECK (max_party BETWEEN 1 AND 12),
  capacity_per_slot integer NOT NULL CHECK (capacity_per_slot > 0),
  slot_rule jsonb NOT NULL,
  duration_minutes integer CHECK (duration_minutes > 0),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT experiences_deposit_check
    CHECK (deposit_cents > 0 AND deposit_cents <= price_cents),
  CONSTRAINT experiences_slot_rule_shape
    CHECK (
      jsonb_typeof(slot_rule -> 'weekdays') = 'array'
      AND jsonb_typeof(slot_rule -> 'start_times') = 'array'
    )
);

CREATE INDEX idx_experiences_merchant_id ON public.experiences(merchant_id);

-- ---------------------------------------------------------------------------
-- experience_facts (F07): provider facts that make constraint matching
-- checkable. value is three-valued; for parametric keys (min_age, languages)
-- 'yes' means the provider stated the parameter, which is held in data
-- ({"min_age": 8}, {"languages": ["es", "en"]}). Only a fact confirmed by the
-- provider can support or rule out a visitor constraint.
-- ---------------------------------------------------------------------------
CREATE TABLE public.experience_facts (
  experience_id uuid NOT NULL REFERENCES public.experiences(id) ON DELETE CASCADE,
  key text NOT NULL CHECK (key IN (
    'step_free', 'min_age', 'languages', 'public_transport', 'pets_allowed', 'equipment_included'
  )),
  value text NOT NULL CHECK (value IN ('yes', 'no', 'unknown')),
  detail text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  confirmed_by_provider boolean NOT NULL DEFAULT false,
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (experience_id, key),
  CONSTRAINT experience_facts_confirmation_check
    CHECK (confirmed_by_provider = false OR confirmed_at IS NOT NULL)
);

-- ---------------------------------------------------------------------------
-- booking_drafts: the conversation's working state, one open draft per user.
-- ---------------------------------------------------------------------------
CREATE TABLE public.booking_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'accepted', 'abandoned')),
  party_size integer CHECK (party_size BETWEEN 1 AND 12),
  slot_date date,
  slot_time time,
  budget_cents integer CHECK (budget_cents >= 0),
  constraints jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_booking_drafts_one_open_per_user
  ON public.booking_drafts(user_id) WHERE status = 'open';

-- ---------------------------------------------------------------------------
-- quotes: versioned offers. Price and deposit are copied from the experience
-- at creation, never taken from input. A quote is open while it is not
-- expired, not superseded and not accepted.
-- ---------------------------------------------------------------------------
CREATE TABLE public.quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id uuid REFERENCES public.booking_drafts(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  experience_id uuid NOT NULL REFERENCES public.experiences(id),
  version integer NOT NULL CHECK (version > 0),
  slot_date date NOT NULL,
  slot_time time NOT NULL,
  party_size integer NOT NULL CHECK (party_size BETWEEN 1 AND 12),
  total_cents integer NOT NULL CHECK (total_cents > 0),
  deposit_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'EUR' CHECK (currency = 'EUR'),
  cancellation_window_hours integer NOT NULL CHECK (cancellation_window_hours >= 0),
  expires_at timestamptz NOT NULL,
  superseded_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quotes_deposit_check CHECK (deposit_cents > 0 AND deposit_cents <= total_cents),
  CONSTRAINT quotes_draft_version_unique UNIQUE (draft_id, version)
);

CREATE INDEX idx_quotes_user_id ON public.quotes(user_id);
CREATE INDEX idx_quotes_experience_id ON public.quotes(experience_id);

-- ---------------------------------------------------------------------------
-- holds: the inventory owner before confirmation. Live means
-- expires_at > now() AND released_at IS NULL AND consumed_at IS NULL.
-- ---------------------------------------------------------------------------
CREATE TABLE public.holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL UNIQUE REFERENCES public.quotes(id),
  experience_id uuid NOT NULL REFERENCES public.experiences(id),
  slot_date date NOT NULL,
  slot_time time NOT NULL,
  party_size integer NOT NULL CHECK (party_size BETWEEN 1 AND 12),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  released_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_holds_experience_slot ON public.holds(experience_id, slot_date);

-- ---------------------------------------------------------------------------
-- bookings: the inventory owner after confirmation (status = 'confirmed').
-- The guest capability link is derived, not stored:
-- HMAC(BOOKING_LINK_SECRET, 'booking:' || id || ':' || link_version);
-- incrementing link_version revokes the old link (F05).
-- ---------------------------------------------------------------------------
CREATE TABLE public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  quote_id uuid NOT NULL UNIQUE REFERENCES public.quotes(id),
  hold_id uuid NOT NULL UNIQUE REFERENCES public.holds(id),
  experience_id uuid NOT NULL REFERENCES public.experiences(id),
  slot_date date NOT NULL,
  slot_time time NOT NULL,
  party_size integer NOT NULL CHECK (party_size BETWEEN 1 AND 12),
  total_cents integer NOT NULL CHECK (total_cents > 0),
  deposit_cents integer NOT NULL CHECK (deposit_cents > 0),
  currency text NOT NULL DEFAULT 'EUR' CHECK (currency = 'EUR'),
  cancellation_window_hours integer NOT NULL CHECK (cancellation_window_hours >= 0),
  status text NOT NULL DEFAULT 'pending_payment' CHECK (status IN (
    'pending_payment', 'confirmed', 'cancel_pending', 'cancelled', 'expired',
    'refund_pending', 'refunded', 'needs_attention'
  )),
  confirmed_at timestamptz,
  cancellation_confirmed_at timestamptz,
  refund_cents integer CHECK (refund_cents >= 0),
  link_version integer NOT NULL DEFAULT 1 CHECK (link_version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bookings_deposit_check CHECK (deposit_cents <= total_cents)
);

CREATE INDEX idx_bookings_experience_slot ON public.bookings(experience_id, slot_date);
CREATE INDEX idx_bookings_user_id ON public.bookings(user_id);

-- ---------------------------------------------------------------------------
-- payments: one row per PayPal order. operation_key is fixed at creation and
-- derives every PayPal-Request-Id, so retries are idempotent at PayPal.
-- capture_pending means the capture outcome is unknown and stays reconcilable;
-- capture_failed is written only on authoritative provider evidence (R2-02).
-- ---------------------------------------------------------------------------
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id),
  provider text NOT NULL DEFAULT 'paypal' CHECK (provider = 'paypal'),
  operation_key uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  order_id text UNIQUE,
  capture_id text UNIQUE,
  refund_id text UNIQUE,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  currency text NOT NULL DEFAULT 'EUR' CHECK (currency = 'EUR'),
  status text NOT NULL DEFAULT 'created' CHECK (status IN (
    'created', 'approved', 'capture_pending', 'captured', 'capture_failed', 'expired',
    'refund_pending', 'refunded', 'refund_failed'
  )),
  reconcile_passes integer NOT NULL DEFAULT 0 CHECK (reconcile_passes >= 0),
  compensation_reason text,
  last_error text,
  captured_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_payments_booking_id ON public.payments(booking_id);
CREATE INDEX idx_payments_open_status ON public.payments(status)
  WHERE status IN ('created', 'approved', 'capture_pending', 'refund_pending');

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
CREATE TRIGGER merchants_updated_at BEFORE UPDATE ON public.merchants
  FOR EACH ROW EXECUTE FUNCTION public.set_booking_updated_at();
CREATE TRIGGER experiences_updated_at BEFORE UPDATE ON public.experiences
  FOR EACH ROW EXECUTE FUNCTION public.set_booking_updated_at();
CREATE TRIGGER experience_facts_updated_at BEFORE UPDATE ON public.experience_facts
  FOR EACH ROW EXECUTE FUNCTION public.set_booking_updated_at();
CREATE TRIGGER booking_drafts_updated_at BEFORE UPDATE ON public.booking_drafts
  FOR EACH ROW EXECUTE FUNCTION public.set_booking_updated_at();
CREATE TRIGGER holds_updated_at BEFORE UPDATE ON public.holds
  FOR EACH ROW EXECUTE FUNCTION public.set_booking_updated_at();
CREATE TRIGGER bookings_updated_at BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.set_booking_updated_at();
CREATE TRIGGER payments_updated_at BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.set_booking_updated_at();

-- ---------------------------------------------------------------------------
-- Posture: service-role only (template: migration 107).
-- ---------------------------------------------------------------------------
ALTER TABLE public.merchants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.merchants FROM anon;
REVOKE ALL ON TABLE public.merchants FROM authenticated;
GRANT ALL ON TABLE public.merchants TO service_role;
CREATE POLICY "Service role can manage merchants"
  ON public.merchants FOR ALL TO service_role
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

ALTER TABLE public.experiences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.experiences FROM anon;
REVOKE ALL ON TABLE public.experiences FROM authenticated;
GRANT ALL ON TABLE public.experiences TO service_role;
CREATE POLICY "Service role can manage experiences"
  ON public.experiences FOR ALL TO service_role
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

ALTER TABLE public.experience_facts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.experience_facts FROM anon;
REVOKE ALL ON TABLE public.experience_facts FROM authenticated;
GRANT ALL ON TABLE public.experience_facts TO service_role;
CREATE POLICY "Service role can manage experience_facts"
  ON public.experience_facts FOR ALL TO service_role
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

ALTER TABLE public.booking_drafts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.booking_drafts FROM anon;
REVOKE ALL ON TABLE public.booking_drafts FROM authenticated;
GRANT ALL ON TABLE public.booking_drafts TO service_role;
CREATE POLICY "Service role can manage booking_drafts"
  ON public.booking_drafts FOR ALL TO service_role
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.quotes FROM anon;
REVOKE ALL ON TABLE public.quotes FROM authenticated;
GRANT ALL ON TABLE public.quotes TO service_role;
CREATE POLICY "Service role can manage quotes"
  ON public.quotes FOR ALL TO service_role
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

ALTER TABLE public.holds ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.holds FROM anon;
REVOKE ALL ON TABLE public.holds FROM authenticated;
GRANT ALL ON TABLE public.holds TO service_role;
CREATE POLICY "Service role can manage holds"
  ON public.holds FOR ALL TO service_role
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.bookings FROM anon;
REVOKE ALL ON TABLE public.bookings FROM authenticated;
GRANT ALL ON TABLE public.bookings TO service_role;
CREATE POLICY "Service role can manage bookings"
  ON public.bookings FOR ALL TO service_role
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.payments FROM anon;
REVOKE ALL ON TABLE public.payments FROM authenticated;
GRANT ALL ON TABLE public.payments TO service_role;
CREATE POLICY "Service role can manage payments"
  ON public.payments FOR ALL TO service_role
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
