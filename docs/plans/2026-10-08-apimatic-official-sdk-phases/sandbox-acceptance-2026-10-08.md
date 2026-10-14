# Sandbox acceptance, 2026-10-08 (local stack, real PayPal sandbox, official SDK)

Phase 3, step 3 of [the plan](../2026-10-08-apimatic-official-sdk.md). Tree under test: Phase 2's
commit `75bf1cea`, plus the dev-only CSP fix and the mock alignment of this phase (no adapter change).

## Setup

- `next dev` on `localhost:3006`, against an isolated local Supabase stack (`paisaxe-apimatic`, API on
  `127.0.0.1:54821`), never the hosted database. PayPal: the real **sandbox** app ("Default
  Application", the credentials in `.env.local`), base `https://api-m.sandbox.paypal.com`.
- The booking was driven over HTTP with the Postman collection (folders 00 to 04, then the payment,
  capture and cancellation requests), and the local runner for the voucher and quotes. Browser
  automation of the chat was attempted first: the first attempt hit a real bug (fixed, see below),
  and the next ones failed in the automation tab (requests not reaching the server, the tab frozen),
  so the HTTP path was used. The owner approved the payment in their own browser.
- Found and fixed on the way: the development CSP allowed a local Supabase only on port 54321, so an
  isolated stack on other ports (the release checklist's procedure) could not start a guest session
  in a browser ("Could not start a guest session"). `src/lib/proxy/csp.ts` now also allows the
  loopback origin of `NEXT_PUBLIC_SUPABASE_URL` in development; production is unchanged (tested).

## Transaction Search permission (decision D9)

- 06:31 UTC: "Transaction search" ticked and saved on the Sandbox app (owner logged in, Claude
  clicked; never the Live tab).
- 06:30:51 (just before the save completed), 06:35 and 06:50 UTC: read-only searches 403 `NOT_AUTHORIZED` (the token had no
  reporting scope).
- 07:26 UTC: the token carries the reporting scope; search 200, 11 movements in 7 days,
  `last_refreshed_datetime` 05:29:59Z. PayPal applied the permission within about an hour.
- What the sandbox lists for a refunded deposit (2026-10-07 data): the capture stays `T0006` /
  `S`; the refund is a separate `T1107` / `S`, negative, with `paypal_reference_id` = the capture
  (type `TXN`). A capture also carries a `paypal_reference_id` of type `TXN` to another transaction
  id (not its order: order `5TF88469UP513370Y` -> capture `33951424KE135990V` -> reference
  `3FG12949Y7874561S`). No `V` was seen. The mock lists the refund shape; it leaves the capture's
  reference out.

## Deposit, capture and refund through the official SDK

| Step | When (UTC) | Result |
| --- | --- | --- |
| Quote accepted, booking created | 07:39:55 | RS-14A4A0, coastal walk, 2026-11-01 10:00, 2 people, deposit 30.00 EUR |
| Start payment (`OrdersController.createOrder`) | 07:40:09 | order `307205718C856411H`, approval link on `www.sandbox.paypal.com` |
| Owner approves as the sandbox buyer, return page captures (`OrdersController.captureOrder`) | 07:44:25 | capture `0LG07388CG934261Y`; booking `confirmed`, payment `captured`; return page "Payment received! Your booking is confirmed." |
| Operator ledger (`TransactionSearchController.searchTransactions`) | 07:45:36 | `state: ok`, `refreshedAt` 05:59:59Z, RS-14A4A0 `pending` (PayPal not yet listing it) |
| Cancellation preview, then confirm (`PaymentsController.refundCapturedPayment`) | 07:46:42 | refund `9TF10743AW072532B`, 30.00 EUR; booking and payment `refunded` |

PayPal debug ids are not recorded: the adapter returns them only with a failure (`PaypalError.debugId`)
and on the call's result, which the booking code does not log or store on success, and the
`payments` row has no column for them. The order, capture and refund ids above identify every
movement in PayPal.

## Operator panel

- 07:46 UTC: "PayPal confirma 0 de 4 depósitos · datos de PayPal de las 07:59" (Madrid time of
  05:59:59Z). RS-14A4A0 shows "Pendiente en PayPal". The other three rows are bookings from this
  session's Newman runs against the mock: their capture ids exist only in the mock, so PayPal never
  lists them and they stay pending (as the plan's matcher specifies).

## Pending

- The panel showing "Reembolso en PayPal" for RS-14A4A0. The refund itself completed at once
  (PayPal answered it COMPLETED; booking and payment `refunded` at 07:46:42). What lags is
  Transaction Search, PayPal's reporting feed: it publishes in 30-minute blocks about two hours
  behind (at 08:48 UTC it reached 06:59:59Z), so the 07:44-07:46 movements appear with the block
  ending 07:59:59Z, around 09:50 UTC. Not waited for; the merge went ahead (owner, 2026-10-08).

Screenshots stay outside the repository (scratchpad `acceptance/`): the owner's confirmation page
(`booking-confirmed-RS-14A4A0.png`) and the panel (`panel-pending-1280.png`).
