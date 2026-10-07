# Local sandbox acceptance session, 2026-10-07 (local Docker, real PayPal sandbox, tunnel paisaxe.tunnelfor.me -> :3006)

## Phase 4 step 1: voucher -> chat -> quote -> accept -> order -> approve -> return -> confirmed
- Booking RS-8295A6 (coastal walk, 2026-10-08 10:00, 4 people, total 12000, deposit 3000): confirmed via the return page.
- Order 5TF88469UP513370Y, capture 33951424KE135990V, captured_at 05:18:25 UTC; approved by the owner as the sandbox buyer.
- Webhooks: CHECKOUT.ORDER.APPROVED (WH-1TM34143AK747380J-7V073927VR207022W) processed 05:19:39 after the tunnel was restored (PayPal retry); PAYMENT.CAPTURE.COMPLETED (WH-17T92716BY341094Y-75B3282211198833P) resent to the tunnel webhook only, processed 05:20:03. Booking unchanged (idempotent late events).
- Zapier booking.confirmed for RS-8295A6: [ZAPIER_SYNC_FAILED] reason=network (the session's local receiver had exited); booking state unaffected, as designed. Delivery to be shown on the next transition.
- Session finding: processes launched with nohup from a script were reaped when its shell ended (tunnel, receiver); rerun as managed background processes.

## Phase 8a: balance invoice
- "Send me the invoice for the balance" -> send_balance_invoice: invoice INV2-GWYA-X2FN-C46G-WQEW, 9000 cents, due 2026-10-08, recipient = deposit payer (sandbox buyer), item "Resto de la reserva RS-8295A6 (demo)".
- Paid by the owner as the sandbox buyer on sandbox.paypal.com (05:23).
- INVOICING.INVOICE.PAID received and processed 05:23:40 via the tunnel; [PAYPAL_INVOICE_PAID]; bookings.invoice_status = paid, balance_paid_at 05:23:40 (set after re-reading the invoice, per design).

## Phase 5: cancellation and refund (booking RS-D1CCBA, 2026-10-09 10:00, 2 people)
- Booking: quote 1e995bb2-f8e0-4b9c-9e9a-241fa8cbe866; order 933308702B8605337, captured 05:29:20 (return path); CHECKOUT.ORDER.APPROVED 05:29:24 and PAYMENT.CAPTURE.COMPLETED 05:29:30 processed.
- Owner previewed (GET cancellation-preview 200) and confirmed inside the window (POST cancel 200): cancellation_confirmed_at 05:33:26; refund 1A933929X53403514 (3000); PAYMENT.CAPTURE.REFUNDED processed 05:33:47; booking and payment `refunded`; page shows "We have refunded the deposit on PayPal."
- Second confirm (same request, 05:34): 200 {"status":"refunded","refundCents":3000}; same refund id; no new Zapier event.
- The 20-minute preview check runs on RS-8295A6 instead (owner confirmed RS-D1CCBA right away): baseline 05:34:26, preview 200 refundCents 3000.

## Phase 8c: Zapier (local receiver standing in for the Zapier URL)
- booking.confirmed RS-D1CCBA 05:29:20 and booking.refunded RS-D1CCBA 05:33:27 delivered; payload: id (reference), event, slotDate, slotTime, partySize, totalCents, depositCents, balanceCents, currency, experienceTitle. No booking id, user, email, capability or PayPal ids.
- Failure path seen live: booking.confirmed RS-8295A6 -> [ZAPIER_SYNC_FAILED] reason=network while the receiver was down; booking unaffected.

## Findings filed during the session
- #1000 dev CSP blocked local Supabase (fixed f7fade33); #1001 empty story image (10/107 prod stories); #1002 off-catalog suggestions, Spanish reply, "confirmada en espera de pago"; #1003 post-accept re-quote and live accept buttons (RS-293518 left pending).

## Phase 4 step 2a: approve and never return (closed browser) -> confirmed by the approval webhook
- Fresh chat (new incognito redemption of the same voucher): post-accept turn produced the payment card correctly (contrast #1003 in the long conversation).
- Booking RS-30FC16 (coastal walk, 2026-10-10 10:00, 1 person); order 7G221718DL7252255 approved by the owner on a phone (return to localhost impossible; 0 return requests in the server log).
- CHECKOUT.ORDER.APPROVED received 05:49:05 -> captured 05:49:08 by the webhook path; PAYMENT.CAPTURE.COMPLETED 05:49:28 processed; booking confirmed; Zapier booking.confirmed RS-30FC16 delivered 05:49:08.
- RS-293518 (left pending by #1003) was paid by the owner on the desktop at 05:37:11 (return path), so it no longer serves as the abandoned case.

## Phase 5: a preview left alone changes nothing
- RS-8295A6: cancellation-preview requested 05:34:26 (refundCents 3000), never confirmed. Reconciliation run 05:55:11 (200, all counters 0). Booking/payment row identical to the baseline: confirmed, no cancellation, captured, no refund, updated_at 05:23:40.667292.

## Phase 4 step 2b: approve and never return, webhook unreachable -> confirmed by reconciliation
- Booking RS-5161F2 (coastal walk, 2026-10-11 10:00, 1 person); tunnel stopped (paisaxe.tunnelfor.me 530) before the owner approved order 2R79305268490020V on a phone.
- 05:58:27: PayPal order APPROVED; app booking pending_payment, payment created, 0 return requests, no webhook received.
- 05:58:30 reconciliation (GET /api/cron/reconcile-bookings with CRON_SECRET): 200, confirmed=1; capture 9X122762LE478644U at 05:58:32; booking confirmed.
- Tunnel restored afterwards so PayPal's queued deliveries arrive (expected to change nothing).
- The accept turn for RS-5161F2 showed #1003 (third form) and a truncated reply (#1004).
- After the tunnel came back, PayPal's queued deliveries for order 2R79305268490020V arrived: PAYMENT.CAPTURE.COMPLETED 05:59:22 and CHECKOUT.ORDER.APPROVED 06:00:57, both processed; RS-5161F2 unchanged (confirmed, capture 9X122762LE478644U).

## Phase 4 step 3: abandoned payment -> expired
- Booking RS-2CEA16 (coastal walk, 2026-10-12 10:00, 1 person), accepted 06:00:35; PayPal order created, never approved.
- 06:16:11 before reconciliation: pending_payment / payment created. Reconciliation 200, expired=1. After: booking expired, payment expired; booking API reports {"status":"expired","outcome":"expired"}; a payment start after expiry is refused 409 invalid_state.
- Place released: hold c26b1495… expires_at 06:15:35 (not consumed, not released); live holds are defined as expires_at > now() AND released_at IS NULL AND consumed_at IS NULL (migration 112:160; capacity check 113:64), so it no longer counts.

## Not covered in this session
- Phase 4 step 4 (PostHog debug view shows /booking/[redacted]): PostHog is not configured on the local stack; check in the production acceptance step (Phase 7).
- Phase 8b (phone confirmation): the ElevenLabs post-call webhook targets paisaxe.es, so it runs in production after the release.
