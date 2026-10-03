# Phase 4: PayPal deposit, shared capture path, booking page, webhook inbox, reconciliation

**Window:** 2026-10-20 to 10-27, then rehearsal 4b on 10-27 to 10-28
**Worktree:** `../paisaxe-hackathon-phase4` on `feature/paypal-deposit` from `develop` (after Phases 2 and 3 merged)
**Depends on:** Phases 1 to 3 accepted; Phase 0 PayPal evidence, including the confirmed webhook event names
**Batch-eligible units:** `[adapter]` (`src/lib/paypal/*`) and `[webhook-cron]` (webhook route, cron route) share no files; `[flow]` (tool, capture function, pages, telemetry redaction) depends on `[adapter]`.
**Revision 3:** already-captured orders are compensated, never expired (R2-01); an uncertain capture stays reconcilable (R2-02); the inbox is replayable from its own contents (R2-04).
**Revision 2:** one capture path with three callers (F02), webhook inbox (F03), capability links and telemetry redaction (F05), refund primitive owned here (F12), `expired` instead of an undeclared local-void state.

## Goal

The agent creates the PayPal sandbox order as a tool call, the buyer approves on
PayPal, and the server captures and confirms whether or not the browser returns. The
visitor sees the booking through the capability link, and every uncertain outcome is
resolved by the webhook or by reconciliation with nobody present.

## Env registration

Add to `.env.example` (so `scripts/check-env.ts:27-48` accepts them) and read through
`getEnv` with one literal `process.env` reference each in `src/lib/paypal/env.ts` and
`src/lib/booking/links.ts`: `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_API_BASE`
(`https://api-m.sandbox.paypal.com`), `PAYPAL_WEBHOOK_ID`, `BOOKING_LINK_SECRET`.
Secrets are owner-supplied. The PayPal names are already registered (Phase 0); this phase
adds `BOOKING_LINK_SECRET`.

`src/lib/paypal/env.ts` rejects any `PAYPAL_API_BASE` whose hostname is not exactly
`api-m.sandbox.paypal.com` until a reviewed production decision changes it (the Phase 0
spikes use the same exact-hostname check). Test: a base URL such as
`https://api-m.paypal.com` or `https://sandbox.evil.example` raises `NotConfigured`.

When the adapter lands, delete `scripts/spikes/paypal-cycle.ts` and
`scripts/spikes/paypal-followup.ts` and keep only their evidence JSON: Knip treats every
file under `scripts/` as an entry point, so a stale second PayPal client would never be
reported as dead code.

## Unit [adapter]: `src/lib/paypal/`

**First decision of this unit (owner installed the APIMatic plugin on 2026-10-03):** load the
plugin's `typescript-getting-started` and `typescript-integrate-paypal` skills and decide
whether the adapter wraps the official `@paypal/paypal-server-sdk` or keeps plain `fetch`.
Criteria: the SDK must support `PayPal-Request-Id` on create, capture and refund; the
webhook verification call; a configurable base URL for the mock server; and the
exact-hostname sandbox guard. Check its license against
`docs/project/license-exceptions.md` (MIT, Apache-2.0, BSD or ISC only). Prefer the SDK
if it meets all of these: it is the integration the APIMatic plugin documents, which is
what that sponsor prize asks for. Record the choice and the reason in the notes file.

`client.ts` (token cache), `orders.ts`, `refunds.ts`, `webhooks.ts`, `types.ts`,
`env.ts`, each with tests against a local mock server (`src/test/paypal-mock-server.ts`,
a small `node:http` server that records requests and serves canned responses; also
used by E2E).

```
@ createOrder(booking, quote, operationKey) -> {orderId, approveUrl}
ctx: fetch PAYPAL_API_BASE/v2/checkout/orders, token
pre: booking pending_payment; quote accepted; hold live
do:
  1. amount = formatCents(quote.deposit_cents) "30.00", currency EUR
  2. body: intent CAPTURE, purchase_units[{amount, custom_id: booking.id, description: experience title + " (demo)"}], payment_source.paypal.experience_context {return_url: SITE + bookingLink(booking) + "/return", cancel_url: SITE + bookingLink(booking) + "?cancelled=1", user_action PAY_NOW, shipping_preference NO_SHIPPING}
  3. headers: PayPal-Request-Id = operationKey
  4. parse id and links[rel=payer-action|approve].href
fail: non-2xx -> PaypalError{status, debugId, body} (log body, never secrets); missing env -> NotConfigured
risk: the return URL is rebuilt from the booking id (F05), so it is identical on every retry
```

```
@ captureOrder(orderId, operationKey) -> {captureId, status, amount, currency, customId}
ctx: POST /v2/checkout/orders/{id}/capture with PayPal-Request-Id = "capture:" + operationKey
do:
  1. post; 2. parse purchase_units[0].payments.captures[0]; 3. return normalized
fail: 422 ORDER_ALREADY_CAPTURED -> getOrder and return its capture; 422 ORDER_NOT_APPROVED -> NotApproved
br: HTTP 201 on an order that was already captured (observed in Phase 0 with a new request id) -> parse normally and return the existing capture id; never treat it as a second capture
```

`getOrder(orderId)`; `getCapture(captureId)` (authoritative capture status, amount and its related order id); `refundCapture(captureId, amountCents, operationKey)` with
`PayPal-Request-Id = "refund:" + operationKey`; `getRefund(refundId)`;
`verifyWebhookSignature(headers, rawBody) -> "SUCCESS" | "FAILURE"`.

## Unit [flow]

### The single capture function (F02)

```
@ captureApprovedOrder(bookingId, source: "return" | "webhook" | "reconcile") -> Outcome
ctx: DB(service), paypal.getOrder, paypal.captureOrder, reacquire_hold, consume_hold_and_confirm, compensateCapturedPayment
pre: payment row exists with order_id
do:
  1. load booking, payment, quote, hold; if booking confirmed -> return confirmed (idempotent)
  2. order = getOrder(order_id); CREATED/PAYER_ACTION_REQUIRED -> return awaiting_approval
  3. validate amount == quote.deposit_cents, currency EUR, custom_id == booking.id (on APPROVED and on COMPLETED)
  4. if order COMPLETED -> persist capture_id, payment captured -> go to finalizeCaptured (money has moved; this branch never expires anything)
  5. order APPROVED: if hold not live -> reacquire_hold(booking); false -> payment + booking expired, return slot_gone. Nothing was captured, so this is truthful
  6. set capture_pending; captureOrder(order_id, operation_key); COMPLETED -> persist capture_id, payment captured -> finalizeCaptured
br: step 6 timeout or non-definitive reply -> stay capture_pending, return pending (the outcome is unknown, see reconciliation)
fail: validation mismatch on an uncaptured order -> log [PAYPAL_CAPTURE_MISMATCH] at error, booking needs_attention, never capture; mismatch on a COMPLETED order -> compensateCapturedPayment
risk: all three callers go through this; no other code calls captureOrder
```

```
@ finalizeCaptured(booking, payment) -> confirmed | compensating
ctx: consume_hold_and_confirm, reacquire_hold, compensateCapturedPayment
pre: payment.status captured with capture_id persisted (R2-01)
do:
  1. consume_hold_and_confirm(booking, capture_id) -> confirmed
  2. on hold_not_live -> reacquire_hold(booking); true -> retry step 1 once
  3. still not fulfillable (slot taken) -> compensateCapturedPayment(booking, payment, "slot_gone")
```

```
@ compensateCapturedPayment(booking, payment, reason) -> compensating
ctx: paypal.refundCapture with PayPal-Request-Id = "refund:" + operation_key (same key on every retry)
do:
  1. one UPDATE: payment refund_pending, compensation_reason; booking needs_attention
  2. refundCapture(capture_id, full amount); store refund_id
  3. reconciliation step 6 follows the refund to refunded or refund_failed
fail: PayPal error at 2 -> state from step 1 stands; reconciliation retries with the same key, so at most one refund
risk: durable intent is written before the call, so a crash cannot leave a captured payment looking unpaid
```

### Tool `create_payment_order` and its button twin

```
@ create_payment_order({bookingId}) -> payment card
ctx: DB(service), paypal.createOrder
pre: booking owned by user; status pending_payment; quote.accepted_at set; hold live
do:
  1. load or create the payments row (status created, operation_key uuid) — one per booking
  2. if order_id exists and status in (created, approved) -> reuse the stored approve_url
  3. else createOrder; store order_id and approve_url
  4. return card {approveUrl, amount, currency, expiresAt = hold.expires_at}; tool_result text for the model contains only {"payment": "order_created", "reference": booking.reference}
br: hold expired -> HoldExpired (card says to re-quote); not configured -> NotConfigured
```

`POST /api/booking/bookings/[capability]/payment` runs the same function for the
booking page's "Pagar con PayPal" button (F06 fallback), authorized by the capability.

### Pages

- `src/app/booking/[capability]/page.tsx` (server component): `verifyBookingCapability`
  (Phase 1), renders reference, experience, slot, party, deposit, balance, cancellation
  terms, status and the right action: pay; "Confirmando el pago…" with polling of
  `GET /api/booking/bookings/[capability]` every 5 s for 2 minutes, then every 30 s for
  15 minutes, plus a manual "Actualizar" button; confirmed receipt with order and
  capture ids; expired with a link back to the chat; cancellation (Phase 5). Invalid
  capability → `notFound()`.
- `src/app/booking/[capability]/return/page.tsx`: reads PayPal's `token` query (order
  id); POSTs `/api/booking/payments/capture` with `csrfHeaders()`; shows the outcome and
  links to the booking page. `?cancelled=1` shows the pending state.
- `POST /api/booking/payments/capture {capability, orderId}`: verifies the capability,
  requires `payment.order_id === orderId`, calls `captureApprovedOrder(…, "return")`,
  maps outcomes to 200 confirmed, 202 pending, 409 slot_gone or mismatch.

### Capability URLs and telemetry (F05)

- `src/lib/redact-capability-path.ts`: `redactCapabilityPath(pathname)` maps
  `/booking/<anything>` → `/booking/[redacted]` and `/operator/<anything>` →
  `/operator/[redacted]`, preserving the `/return` suffix.
- `src/components/posthog-provider.tsx:30-37`: build `$current_url` from the redacted
  path and drop the query on those routes.
- `src/lib/sentry-before-send.ts:35` (`normalizeUrlToPath`): apply the redaction.
- `src/components/analytics` (`VercelAnalytics`, mounted at `src/app/layout.tsx:163`):
  pass a `beforeSend` that rewrites `event.url` with the redaction.
- `src/proxy.ts`: for `/booking/` and `/operator/` responses set
  `Referrer-Policy: no-referrer`, `Cache-Control: private, no-store`,
  `X-Robots-Tag: noindex`.
- Logger: no route logs the capability; log the booking id only.

## Unit [webhook-cron]

### `POST /api/webhooks/paypal` (CSRF-exempt by prefix, `src/lib/csrf.ts:60-65`)

```
@ paypalWebhook(request) -> 200|401|500
ctx: raw body, verifyWebhookSignature, upsert_paypal_event, processPaypalEvent, DB(service)
do:
  1. raw = await request.text(); verify -> FAILURE -> 401, log [PAYPAL_WEBHOOK_INVALID]
  2. state = upsert_paypal_event(id, type, verified payload, normalized order_id / capture_id / refund_id / custom_id); 'processed' -> 200
  3. processPaypalEvent(event) ('new' and 'pending' are both processed)
  4. mark_paypal_event_processed(id) -> 200
fail: step 3 throws -> mark_paypal_event_failed(id, error), 500 so PayPal redelivers (F03)
```

```
@ processPaypalEvent(inboxRow)          (reads only the durable inbox row plus provider reads; R2-04)
pre: resolve the payment by normalized order_id; else by custom_id -> booking -> payment; else getCapture(capture_id).related order id; unresolvable -> throw (stays unprocessed, [PAYPAL_WEBHOOK_UNMATCHED])
do:
  1. CHECKOUT.ORDER.APPROVED -> payment by order id -> status approved (forward only) -> captureApprovedOrder(booking, "webhook")
  2. PAYMENT.CAPTURE.COMPLETED -> persist capture_id on the payment (this event may be the first evidence of a capture whose response was lost) -> finalizeCaptured (confirms, or compensates when the slot is gone)
  3. PAYMENT.CAPTURE.PENDING -> capture_pending (forward only)
  4. PAYMENT.CAPTURE.DENIED -> capture_failed; booking needs_attention
  5. PAYMENT.CAPTURE.REFUNDED -> refunded; booking refunded (never back to captured)
  6. other types -> no-op
br: transition not allowed by current state -> log [PAYPAL_WEBHOOK_OUT_OF_ORDER], no change, still processed
```

Use the event names exactly as confirmed in the Phase 0 evidence; if the spike found a
different name for any of them, the spike's names win and this list is updated first.

### `GET|POST /api/cron/reconcile-bookings` every 5 minutes

Auth pattern from `src/app/api/cron/fail-stale-bookings/route.ts:68-95`; lease via
`src/lib/cron-job-lock.ts:23`; add to `vercel.json` crons and to the table in
`docs/operations/operations.md:195-213`.

```
@ reconcileBookings() -> summary
ctx: DB(service), captureApprovedOrder, paypal.getRefund, paypal.refundCapture, expire_holds
do:
  1. expire_holds(); abandon drafts idle > 24 h
  2. drain paypal_webhook_events with processed_at null and received_at < now - 2 min through processPaypalEvent
  3. payments created|approved -> captureApprovedOrder(…, "reconcile"): confirms approved orders; awaiting_approval with a dead hold -> payment and booking expired
  4. payments capture_pending -> captureApprovedOrder; increment reconcile_passes. Only authoritative provider evidence ends the state: order COMPLETED -> finalizeCaptured; order VOIDED or capture DECLINED/DENIED -> capture_failed. At 3 inconclusive passes -> booking needs_attention and [CRON_RECONCILE_ATTENTION], **payment stays capture_pending and keeps being reconciled every run** (R2-02)
  5. payments captured with booking not confirmed -> finalizeCaptured (confirms or compensates)
  6. payments refund_pending: no refund_id yet -> retry refundCapture with the same key; else getRefund: COMPLETED -> refunded (booking refunded); FAILED/CANCELLED -> refund_failed, booking needs_attention
  7. bookings cancel_pending with cancellation_confirmed_at set and no refund_id -> retry refundCapture with the same operation key (Phase 5 creates these)
  8. log [CRON_SUCCESS] with counts; [CRON_RECONCILE_ATTENTION] at error for any needs_attention older than 15 min
fail: PayPal unreachable -> leave states, [CRON_FAILURE], exit 500
risk: captures only buyer-approved orders, only through the shared validated path
```

## Tests (write first)

- Adapter tests with the mock server: token caching and refresh; order body and
  `PayPal-Request-Id`; return URL equals `bookingLink + "/return"`; capture
  normalization; `ORDER_ALREADY_CAPTURED`; a 201 re-capture response that returns the
  existing capture id (Phase 0 finding 6); refund and `getRefund`; signature
  verification; missing env → `NotConfigured`.
- `capture.test.ts` (the shared function): approved → confirmed; awaiting approval →
  no capture; mismatch of amount, currency or `custom_id` on an uncaptured order never
  calls capture; hold expired and re-acquired → confirmed; **uncaptured** order with
  the slot gone → `expired`, no capture; timeout → `capture_pending`; second call after
  confirmation is a no-op.
- **R2-01 oracle:** PayPal captured successfully, the response was lost, the hold
  expired, another booking took the slot; reconciliation alone (no webhook, no return)
  finds the order `COMPLETED`, persists the capture, and refunds exactly once across
  repeated runs; the payment is never `expired` and the booking is never shown unpaid.
- **R2-02 oracle:** with webhook delivery disabled, three inconclusive passes leave the
  payment `capture_pending` and the booking `needs_attention`; the order completes
  after pass three; the next run confirms the booking (or compensates if the slot is
  gone). A declined capture is the only route to `capture_failed`.
- `payments/capture/route.test.ts`: bad capability 404; order id not the booking's 409;
  outcome mapping.
- `webhooks/paypal/route.test.ts`: 401 on failed verification; **processing throws →
  500 and the event stays unprocessed → redelivery processes it once** (F03);
  **R2-04 oracle:** receive a capture event for a payment that has no `capture_id`
  yet, fail processing, end the request, then replay from the inbox row alone through
  the cron drain and reach the correct final state;
  processed event → 200 without reprocessing; `CHECKOUT.ORDER.APPROVED` with no browser
  return ends confirmed (F02); refund-then-completed out of order does not regress.
- `reconcile.test.ts`: each numbered branch; the approved-and-abandoned-browser case;
  the attention threshold on `capture_pending` that does not stop reconciliation; inbox drain; the lease prevents overlap; never
  captures an order that is not `APPROVED`.
- Telemetry (F05): `redact-capability-path.test.ts`; `posthog-provider.test.tsx`
  asserts `$current_url` has no token on `/booking/…`; `sentry-before-send.test.ts`
  asserts the redacted path; analytics `beforeSend` test; `security-headers.test.ts`
  gains the three headers for those routes.
- `tools.test.ts`: the `tool_result` text for `create_payment_order` contains neither
  the approve URL's token nor the capability.
- `booking/[capability]/page.test.tsx`: each state renders; polling cadence switches
  at two minutes; invalid capability 404.
- Integration on local Docker: two concurrent `captureApprovedOrder` calls for one
  order produce one capture and one confirmation.
- `e2e/webhooks.spec.ts`: add the unsigned PayPal webhook → 401 case (pattern `:26-65`).

## Acceptance gate

Automated: full gates; mock-server tests; `vercel.json` test updated.

Manual, on local Docker with the tunnel and real sandbox credentials, ids recorded in
the phase evidence:
1. voucher → chat → quote → accept → agent creates the order → approve → return → confirmed;
2. approve as the sandbox buyer and **close the browser before returning**: the booking
   is confirmed by the approval webhook; repeat with the webhook subscription disabled
   and trigger the cron: confirmed by reconciliation;
3. abandon at PayPal: after the hold expires the booking page shows the expired state;
4. the PostHog debug view shows `/booking/[redacted]` for the booking page.

## 4b: End-to-end rehearsal and video draft (Oct 27 to 28)

On local Docker with the real sandbox, record a rough cut of the research section 9
script, including one rejected unsuitable option and one honestly reported unknown
(Phase 3 tools). The purpose is to find usability and narrative problems while the
build can still change. Output: the draft file kept outside the repository, and a
short list of problems in the phase evidence, each assigned to Phase 5, 5b or 6.

Stop for acceptance.

## Handoff (2026-10-03)

**Status:** implemented, independently reviewed (CHANGES REQUESTED with two money-safety
majors; fixed test-first; re-review APPROVE), simplified (two telemetry defects found and
fixed) and verified by the full local gate. Committed on the feature branch; **not merged into
`develop`, not pushed** (awaiting the owner's acceptance). Manual sandbox acceptance and 4b are
open (owner credentials, tunnel and buyer approval).

- **Scope delivered:**
  - Adapter `src/lib/paypal/` over the pinned plugin SDK (contract sheet
    `pay-pal-server-sdk-plan.md`), sandbox-only origin guard, shared token cache, webhook
    signature verification, local mock server `src/test/paypal-mock-server.ts`; Phase 0 spikes
    deleted.
  - Flow: `src/lib/booking/capture.ts` (the single capture path), `payment-state.ts` (shared
    guarded transitions and status sets), `webhook-events.ts`, `reconcile.ts`, `view.ts`.
  - Tool `create_payment_order` (card-only approval link), the post-accept instruction, the
    payment card with the hold's expiry.
  - Routes: `GET /api/booking/bookings/<capability>`, `POST …/payment`,
    `POST /api/booking/payments/capture`, `POST /api/webhooks/paypal`,
    `GET|POST /api/cron/reconcile-bookings` (every 5 minutes in `vercel.json`).
  - Pages: `/booking/<capability>` (pay, confirming with 5 s then 30 s polling, receipt,
    expired, attention, refunding, refunded, cancelled) and `/booking/<capability>/return`.
  - Telemetry redaction (F05) in PostHog, Sentry (events and transactions) and Vercel
    Analytics / Speed Insights.
  - Migrations 119 (`payments.approve_url`), 120 (R1 `reacquire_hold`), 121 (one open payment
    per booking), 122 (bookings status index). `booking.page.*` and `booking.cards.payBefore` in
    six locales.
- **Identity:** branch `feature/paypal-deposit` in `/Users/juan/code/paisaxe-hackathon-phase4`,
  based on `develop` `05d00641`; the commit carrying this handoff is the candidate.
- **Gate evidence (local, this candidate's inputs):** `supabase db reset --local` applied 112 to
  122 through the runner (`schema_migrations` max 122; both new indexes present; R1 body in
  `reacquire_hold`); `typecheck` 0, `lint` 0, `knip` 0, `check-env` 0,
  `check-verification-coverage` 0, `check-migrations` 0 (119 files); full suite
  `vitest run --maxWorkers=4`: 467 files, 8,613 tests passed, live-DB tests running against the
  reset stack; `next build` 0 after deviation 19 (the booking page tests re-run: 36 passed;
  typecheck, lint and knip re-run clean). Playwright was not run (the unsigned-webhook 401 case
  was added to `e2e/webhooks.spec.ts`).
- **Deviations, review, simplify:** notes file, "Phase 4" (deviations 1 to 19), "Phase 4 review
  dispositions" (findings 1 to 6, R1, R2), "Phase 4 simplify pass".
- **Open for this phase's acceptance (owner):**
  - Manual acceptance 1 to 4 on local Docker with real sandbox credentials and a tunnel for
    the webhook; record the order, capture and event ids here.
  - 4b rehearsal and rough cut (Oct 27 to 28).
- **Entry conditions for Phase 5:**
  - Cancellation reuses `payment-state.ts` (`guardedUpdate`, `flagNeedsAttention`,
    `markBookingRefunded`) and reconciliation step 7, which already refunds `cancel_pending`
    bookings with `cancellation_confirmed_at` and `refund_cents` using the payment's key.
  - The booking page's cancelled state exists; Phase 5 adds the cancel action and the
    `preview_cancellation` tool.
  - The local `booking-roundtrip` E2E still needs Playwright `bypassCSP` (Phase 2 deviation 9).
  - Production stays untouched: anonymous sign-in, `PAYPAL_*` and `BOOKING_LINK_SECRET` in
    Vercel, the PayPal webhook subscription and the cron need owner authorization at release.
