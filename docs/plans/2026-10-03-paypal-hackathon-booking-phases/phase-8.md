# Phase 8: Extensions, only if the core is green and time remains

**Window:** 2026-10-27 to 11-02, ending at the Phase 6 candidate freeze on Nov 3; otherwise cancelled
**Depends on:** Phases 1 to 5 accepted. "Core green" here means those pre-release gates; the production evidence in Phase 7 is not a precondition (F12)
**Order (decision R9):** 8a invoice the balance; 8b phone-confirmation stretch; 8c Zapier
**Batch-eligible:** 8a, 8b and 8c are independent; at most one implementer each, one integration owner.

## 8a: Invoice the remaining balance through PayPal

- Adapter: `invoices.ts` with `createInvoice` and `sendInvoice` (PayPal Invoicing v2),
  recipient = the payer email from the capture, amount = `balance_cents`, due the
  slot date.
- Tool `send_balance_invoice({bookingId})`: confirmed booking only; idempotent by
  `bookings.invoice_id`; card with the invoice link.
- Booking page shows the invoice status. The invoice-paid event also fires for partial
  and pending payments, so `balance_paid` is set only after reading the invoice and
  verifying that its outstanding balance is zero and the payment is settled.
- Tests: adapter against the mock server; tool ownership and idempotency; webhook event.

## 8b: Phone-confirmation stretch (decision R7 authorize/capture/void)

- Adapter: `authorizeOrder`, `captureAuthorization`, `voidAuthorization` (Phase 0
  documented the endpoints; 29-day authorization, 3-day honor period).
- A second fixture merchant flagged `confirmation_mode = 'phone'` with no bookable
  capacity: acceptance authorizes the deposit instead of capturing, then calls the
  existing voice-booking path (`src/app/api/mcp/make-booking/route.ts`) against a test
  phone the owner controls; the ElevenLabs webhook outcome `confirmed` captures the
  authorization, `denied` or `no_answer` voids it. The existing `booking_system` flag
  and daily cap apply.
- Tests: state machine for authorized → captured/voided; webhook outcome mapping;
  no capture without a recorded confirmation.
- Demo only against the test phone, recorded for the video segment at 2:15.

## 8c: Zapier

- After `confirmed` and after `refunded`, POST to a Zapier MCP or webhook URL
  (`ZAPIER_BOOKING_HOOK_URL`, registered in `.env.example`) with the booking reference
  as the stable id; failures are logged `[ZAPIER_SYNC_FAILED]` and never change booking
  state.
- Tests: payload shape; failure does not affect the booking.

## Acceptance gate

Each extension has its own automated tests green and one manual sandbox run recorded.
Any extension not complete by the Phase 6 freeze is left out of the candidate; its
branch stays local.
