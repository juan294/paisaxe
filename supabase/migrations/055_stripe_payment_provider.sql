-- Migration: Rename column for Stripe migration
-- Renames lemon_squeezy_order_id to payment_provider_id to be provider-agnostic

-- Rename the column
ALTER TABLE public.voice_purchases
  RENAME COLUMN lemon_squeezy_order_id TO payment_provider_id;

-- Update the comment
COMMENT ON COLUMN public.voice_purchases.payment_provider_id IS
  'Payment provider transaction ID (Stripe Payment Intent ID or Checkout Session ID)';
