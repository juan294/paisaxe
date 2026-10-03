-- PayPal hackathon plan, Phase 4 (simplify pass): the reconcile-bookings cron
-- runs every 5 minutes and filters bookings by status (needs_attention older
-- than 15 minutes, cancel_pending refunds, pending_payment captures). Those
-- sets stay small while confirmed, expired and refunded bookings grow without
-- bound, so a partial index keeps each run from scanning the whole table.
CREATE INDEX IF NOT EXISTS idx_bookings_unsettled_status
  ON public.bookings (status, updated_at)
  WHERE status IN ('pending_payment', 'needs_attention', 'cancel_pending');
