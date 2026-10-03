-- ============================================================================
-- Migration: 119_payment_approve_url.sql
-- Purpose: Keep the PayPal approval link with the order (PayPal hackathon plan,
--          Phase 4). create_payment_order and the booking page's "Pagar con
--          PayPal" button reuse a still-open order instead of creating a second
--          one, so they need its approval URL. It is a PayPal checkout URL for
--          the buyer, not a credential; the table stays service-role only.
-- ============================================================================

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS approve_url text;

COMMENT ON COLUMN public.payments.approve_url IS
  'PayPal payer-action link of the order while it awaits buyer approval.';
