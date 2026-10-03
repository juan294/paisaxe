-- PayPal hackathon plan, Phase 4 (review finding 2): at most one open
-- payment per booking. Two concurrent create_payment_order calls (the tool
-- and the pay button) could each insert a payment and create a PayPal order,
-- and reconciliation follows only the latest payment, so a capture of the
-- other order could go unnoticed. The loser of the insert continues the
-- winner's row; its PayPal-Request-Id (the operation key) makes PayPal return
-- the same order.
CREATE UNIQUE INDEX IF NOT EXISTS payments_one_open_per_booking
  ON public.payments (booking_id)
  WHERE status IN ('created', 'approved', 'capture_pending');

COMMENT ON INDEX public.payments_one_open_per_booking IS
  'At most one payment per booking awaiting approval or capture (PayPal hackathon plan, Phase 4).';
