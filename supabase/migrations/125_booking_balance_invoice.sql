-- ============================================================================
-- Migration: 125_booking_balance_invoice.sql
-- Purpose: The balance invoice of a confirmed booking (PayPal hackathon plan,
--          Phase 8a): the remaining balance (total - deposit) is invoiced
--          through PayPal Invoicing v2, due on the slot date.
--
--   invoice_id       PayPal's invoice id (INV2-...). Set once, by a guarded
--                    UPDATE ... WHERE invoice_id IS NULL, so a booking has at
--                    most one balance invoice (send_balance_invoice is
--                    idempotent by it).
--   invoice_status   Our view of it: draft (created, not yet sent), sent,
--                    payment_pending (PayPal has a payment it has not
--                    settled), partially_paid, paid, cancelled (cancelled at
--                    PayPal because the visitor cancelled the booking, or by
--                    the merchant: INVOICING.INVOICE.CANCELLED).
--   invoice_url      The recipient's payer-view link once sent. A PayPal
--                    checkout page for the payer, not a credential; it reaches
--                    the chat card and the capability page only, never the
--                    model (F05).
--   balance_paid_at  Set only after reading the invoice from PayPal and
--                    verifying it PAID with nothing outstanding and the whole
--                    balance paid: the invoice-paid webhook also fires for
--                    partial and pending payments.
--
-- The payer's email is not stored: it is read from the captured order at
-- PayPal when the invoice is created.
--
-- Posture: public.bookings stays service-role only (migration 112); new
-- columns inherit its grants and RLS. Re-runnable.
-- ============================================================================

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS invoice_id text,
  ADD COLUMN IF NOT EXISTS invoice_status text,
  ADD COLUMN IF NOT EXISTS invoice_url text,
  ADD COLUMN IF NOT EXISTS balance_paid_at timestamptz;

ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_invoice_id_key;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_invoice_id_key UNIQUE (invoice_id);

ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_invoice_status_check;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_invoice_status_check CHECK (
  invoice_status IN ('draft', 'sent', 'payment_pending', 'partially_paid', 'paid', 'cancelled')
);

-- An invoice id and its status exist together.
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_invoice_pair_check;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_invoice_pair_check CHECK (
  (invoice_id IS NULL) = (invoice_status IS NULL)
);

-- The balance is paid exactly when the invoice is.
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_balance_paid_check;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_balance_paid_check CHECK (
  (balance_paid_at IS NOT NULL) = (invoice_status IS NOT DISTINCT FROM 'paid')
);

COMMENT ON COLUMN public.bookings.invoice_id IS
  'PayPal Invoicing v2 id of the balance invoice; at most one per booking.';
COMMENT ON COLUMN public.bookings.invoice_status IS
  'draft | sent | payment_pending | partially_paid | paid | cancelled (our reading of the PayPal invoice).';
COMMENT ON COLUMN public.bookings.invoice_url IS
  'Payer-view link of the sent balance invoice (cards and the capability page only).';
COMMENT ON COLUMN public.bookings.balance_paid_at IS
  'Set only after PayPal reports the invoice PAID with nothing due and the whole balance paid.';
