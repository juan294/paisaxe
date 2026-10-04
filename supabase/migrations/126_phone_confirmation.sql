-- ============================================================================
-- Migration: 126_phone_confirmation.sql
-- Purpose: Phone-confirmation stretch (PayPal hackathon plan, Phase 8b,
--          decision R7: authorize, then capture or void).
--
-- A merchant in confirmation_mode 'phone' takes bookings only after saying
-- yes on the phone. For such a merchant the deposit is AUTHORIZED when the
-- buyer approves (never captured on approval), the existing voice-booking
-- path (pending_bookings + the ElevenLabs booking agent) calls the merchant,
-- and the recorded call outcome decides: 'confirmed' captures the
-- authorization, anything else voids it.
--
-- 1. merchants.confirmation_mode ('instant' | 'phone'), default 'instant', so
--    every existing merchant keeps the Phase 4 capture flow unchanged.
-- 2. payments: authorization columns, the link to the confirmation call
--    (phone_call_id -> pending_bookings) and three statuses:
--      authorized    PayPal holds the deposit; nothing captured yet
--      void_pending  a void was claimed; its outcome may be unknown
--      voided        the authorization was voided; no money moved
--    A void and a capture both start with a guarded UPDATE from 'authorized',
--    so only one of them ever reaches PayPal.
-- 3. payments_require_recorded_confirmation: the database refuses the claim
--    that precedes a capture of an authorization (authorized -> capture_pending)
--    unless the linked call's outcome is recorded as 'confirmed' by the
--    ElevenLabs webhook (pending_bookings.status = 'confirmed' and its event in
--    elevenlabs_webhook_events). No capture without a recorded confirmation.
-- 4. payments_one_open_per_booking (migration 121) also covers 'authorized'
--    and 'void_pending', so a second order cannot hide an open authorization.
-- 5. Fixture: a second merchant, 'demo-confirmacion-telefonica' (is_fixture,
--    confirmation_mode 'phone'), with one experience. It is offered by the
--    booking chat only where PHONE_CONFIRMATION_TEST_NUMBER is set
--    (src/lib/booking/availability.ts), so without that variable nothing can
--    book it: no bookable capacity.
--
-- Re-runnable like 116: ADD COLUMN IF NOT EXISTS, constraints and the index
-- dropped and recreated, upserts keyed by slug. Independent of migration 125.
-- No new table: payments and merchants keep their service-role posture
-- (migration 112).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. merchants.confirmation_mode
-- ---------------------------------------------------------------------------
ALTER TABLE public.merchants
  ADD COLUMN IF NOT EXISTS confirmation_mode text NOT NULL DEFAULT 'instant';

ALTER TABLE public.merchants DROP CONSTRAINT IF EXISTS merchants_confirmation_mode_check;
ALTER TABLE public.merchants
  ADD CONSTRAINT merchants_confirmation_mode_check
  CHECK (confirmation_mode IN ('instant', 'phone'));

COMMENT ON COLUMN public.merchants.confirmation_mode IS
  'instant: the deposit is captured on approval (Phase 4). phone: the deposit is authorized on approval and captured only after the merchant confirms by phone (Phase 8b).';

-- ---------------------------------------------------------------------------
-- 2. payments: authorization columns and statuses
-- ---------------------------------------------------------------------------
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS authorization_id text,
  ADD COLUMN IF NOT EXISTS authorized_at timestamptz,
  ADD COLUMN IF NOT EXISTS authorization_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS voided_at timestamptz,
  ADD COLUMN IF NOT EXISTS phone_call_id uuid,
  ADD COLUMN IF NOT EXISTS confirmation_outcome text;

ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_authorization_id_key;
ALTER TABLE public.payments ADD CONSTRAINT payments_authorization_id_key UNIQUE (authorization_id);

ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_phone_call_id_key;
ALTER TABLE public.payments ADD CONSTRAINT payments_phone_call_id_key UNIQUE (phone_call_id);

-- A deleted call row loses the link, never the payment.
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_phone_call_id_fkey;
ALTER TABLE public.payments
  ADD CONSTRAINT payments_phone_call_id_fkey
  FOREIGN KEY (phone_call_id) REFERENCES public.pending_bookings(id) ON DELETE SET NULL;

-- What ended the phone confirmation: the call outcome, or the reason the
-- authorization was voided without one.
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_confirmation_outcome_check;
ALTER TABLE public.payments
  ADD CONSTRAINT payments_confirmation_outcome_check
  CHECK (confirmation_outcome IS NULL OR confirmation_outcome IN (
    'confirmed', 'denied', 'no_answer', 'failed', 'orphaned',
    'not_configured', 'call_failed', 'slot_gone', 'honor_period_elapsed', 'order_mismatch'
  ));

ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_status_check;
ALTER TABLE public.payments
  ADD CONSTRAINT payments_status_check
  CHECK (status IN (
    'created', 'approved', 'capture_pending', 'captured', 'capture_failed', 'expired',
    'refund_pending', 'refunded', 'refund_failed',
    'authorized', 'void_pending', 'voided'
  ));

-- An authorized payment always knows its authorization.
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_authorized_has_id_check;
ALTER TABLE public.payments
  ADD CONSTRAINT payments_authorized_has_id_check
  CHECK (status NOT IN ('authorized', 'void_pending', 'voided') OR authorization_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_payments_authorization_open
  ON public.payments(status)
  WHERE status IN ('authorized', 'void_pending');

-- ---------------------------------------------------------------------------
-- 3. No capture without a recorded confirmation
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.payments_require_recorded_confirmation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.pending_bookings pb
    WHERE pb.id = NEW.phone_call_id
      AND pb.status = 'confirmed'
      AND EXISTS (SELECT 1 FROM public.elevenlabs_webhook_events e WHERE e.booking_id = pb.id)
  ) THEN
    RAISE EXCEPTION 'confirmation_not_recorded'
      USING DETAIL = format('payment %s: authorization capture needs a recorded phone confirmation', NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.payments_require_recorded_confirmation() IS
  'Refuses authorized -> capture_pending (the claim before capturing an authorization) unless the linked call outcome is recorded as confirmed by the ElevenLabs webhook (Phase 8b).';

REVOKE ALL ON FUNCTION public.payments_require_recorded_confirmation() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS payments_require_recorded_confirmation ON public.payments;
CREATE TRIGGER payments_require_recorded_confirmation
  BEFORE UPDATE OF status ON public.payments
  FOR EACH ROW
  WHEN (OLD.status = 'authorized' AND NEW.status = 'capture_pending')
  EXECUTE FUNCTION public.payments_require_recorded_confirmation();

-- ---------------------------------------------------------------------------
-- 4. One open payment per booking, authorizations included (replaces 121's index)
-- ---------------------------------------------------------------------------
DROP INDEX IF EXISTS public.payments_one_open_per_booking;
CREATE UNIQUE INDEX payments_one_open_per_booking
  ON public.payments (booking_id)
  WHERE status IN ('created', 'approved', 'capture_pending', 'authorized', 'void_pending');

COMMENT ON INDEX public.payments_one_open_per_booking IS
  'At most one payment per booking awaiting approval, authorization settlement or capture (Phases 4 and 8b).';

-- ---------------------------------------------------------------------------
-- 5. Fixture: the phone-confirmed merchant
-- ---------------------------------------------------------------------------
INSERT INTO public.merchants (slug, name, timezone, cancellation_window_hours, is_fixture, confirmation_mode)
VALUES ('demo-confirmacion-telefonica', 'Quesería del Puerto (demo, ficticio, confirma por teléfono)',
        'Europe/Madrid', 24, true, 'phone')
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  timezone = EXCLUDED.timezone,
  cancellation_window_hours = EXCLUDED.cancellation_window_hours,
  is_fixture = EXCLUDED.is_fixture,
  confirmation_mode = EXCLUDED.confirmation_mode;

-- capacity_per_slot must be positive (migration 112); it caps requests per
-- slot while a call is in progress. The merchant's yes on the phone is the
-- availability: nothing is confirmed without it.
INSERT INTO public.experiences (
  merchant_id, slug, title, description, price_cents, deposit_cents, max_party,
  capacity_per_slot, slot_rule, duration_minutes
)
SELECT m.id, 'visita-queseria-telefono', 'Visita a una quesería artesana',
       'Visita guiada con cata en una quesería de montaña. El productor confirma cada reserva por teléfono. Experiencia de demostración (ficticia).',
       16000, 4000, 6, 6,
       '{"weekdays": [1, 2, 3, 4, 5, 6, 7], "start_times": ["11:00", "17:00"]}'::jsonb, 90
FROM public.merchants m
WHERE m.slug = 'demo-confirmacion-telefonica'
ON CONFLICT (slug) DO UPDATE SET
  merchant_id = EXCLUDED.merchant_id,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  deposit_cents = EXCLUDED.deposit_cents,
  max_party = EXCLUDED.max_party,
  capacity_per_slot = EXCLUDED.capacity_per_slot,
  slot_rule = EXCLUDED.slot_rule,
  duration_minutes = EXCLUDED.duration_minutes,
  active = true;
