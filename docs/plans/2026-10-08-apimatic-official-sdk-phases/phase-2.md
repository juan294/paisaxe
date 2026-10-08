# Phase 2: Transaction Search in the operator panel

**Plan:** [../2026-10-08-apimatic-official-sdk.md](../2026-10-08-apimatic-official-sdk.md)
**Entry:** Phase 1 accepted; same worktree and branch.
**Exit:** owner acceptance. No push.

The operator sees, for each booking with a deposit, whether PayPal's own records agree.
Read-only (D8): nothing here writes to the database or calls a mutating PayPal operation.

## Shared contract first (blocks the units below)

`src/lib/paypal/types.ts` gains:

```ts
export interface PaypalLedgerEntry {
  transactionId: string;
  /** The capture a refund refers to (paypal_reference_id), or null. */
  referenceId: string | null;
  eventCode: string | null;      // e.g. T0006 capture, T1107 refund
  status: string | null;         // S, P, V, D, F
  amountCents: number | null;    // signed: refunds are negative
  currency: string | null;
  customId: string | null;       // our booking id (custom_field)
}
export interface PaypalLedger {
  entries: PaypalLedgerEntry[];
  refreshedAt: string | null;    // last_refreshed_datetime
  truncated: boolean;            // total_pages > 1
}
```

`src/types/operator-ledger.ts` (shared by route and UI):

```ts
export type LedgerMatch = "matches" | "refunded" | "pending" | "mismatch" | "outside_window" | "not_applicable";
export type OperatorLedgerResponse =
  | { state: "ok"; refreshedAt: string | null; truncated: boolean; windowStart: string;
      bookings: Record<string, LedgerMatch> }            // keyed by booking id
  | { state: "unavailable"; reason: "not_authorized" | "not_configured" | "error" };
```

## Units

### [adapter + mock] `[batch-eligible]`

- `src/lib/paypal/transactions.ts`: `searchTransactions({ start, end })`.

```
@ searchTransactions(start, end) -> PaypalLedger
ctx: TransactionSearchController via callPaypal
pre: end - start <= 31 days (PayPal's limit)
do:
  1. call searchTransactions{startDate, endDate, fields "transaction_info", pageSize 500, page 1}
  2. map transaction_info -> PaypalLedgerEntry (valueToCents, signed)
  3. compute truncated = totalPages > 1
fail: 403 NOT_AUTHORIZED -> PaypalError{status 403, issue} (route maps to not_authorized)
```

  Export from `index.ts`. Tests through the mock: mapping, signed refund amount,
  truncation, 403, retries apply (GET).
- Mock server: `GET /v1/reporting/transactions` built from its stored captures and
  refunds (capture `T0006`, refund `T1107` with `paypal_reference_id` = capture id,
  `custom_field` = the order's `custom_id`), honouring `start_date`/`end_date`,
  `page_size`; hooks to simulate lag (hide entries newer than a cut-off and report it as
  `last_refreshed_datetime`) and to answer 403 `NOT_AUTHORIZED`.
- Postman: add "Transaction search (operator ledger)" to
  `docs/hackathon/postman/paisaxe-booking.postman_collection.json`; run
  `scripts/booking/postman-local.test.ts`.

### [matcher + route] (after the contract)

- `src/lib/booking/ledger.ts`, pure:

```
@ matchLedger(bookings, ledger, windowStart) -> Record<bookingId, LedgerMatch>
do:
  1. skip bookings without payment.captureId -> not_applicable
  2. find capture entry by transactionId == captureId
  3. find refund entries with referenceId == captureId
br: capture found, amount == depositCents, currency matches, status S -> matches (refund found -> refunded)
br: capture found but amount/currency/status differ -> mismatch
br: not found and booking newer than refreshedAt or no refreshedAt -> pending
br: not found and captured before windowStart -> outside_window; else -> pending
```

  The booking's capture time: use the payment row's `created_at`/`captured_at` if the
  operator view exposes one; otherwise add it to `OperatorPayment` (additive field, the
  existing route's consumers ignore it). Decide by reading `loadOperatorView` at
  `src/lib/booking/operator.ts:124`.
- `src/app/api/operator/[capability]/paypal-ledger/route.ts`: `GET`, `guardOperatorRoute`
  (same capability, rate limit and 404s as the dashboard route), loads the merchant's
  bookings (reuse `loadOperatorView` or a narrower query), window = now − 31 days to now,
  `searchTransactions`, `matchLedger`; `CAPABILITY_HEADERS`; maps `PaypalNotConfigured`
  → `not_configured`, 403 → `not_authorized`, anything else → `error` (status 200 with
  `state: "unavailable"`, logged `[OPERATOR_LEDGER_FAILED]`). Fixture merchants are fine:
  the sandbox app is the demo merchant's.
- Tests: matcher table test for every branch; route test with the mock (ok, 403,
  not configured, 404 capability).

### [panel UI + i18n] `[batch-eligible]` (after the contract)

- `operator-dashboard.tsx`: after the view loads, fetch `/api/operator/<cap>/paypal-ledger`;
  a chip per booking row in the payment column (`matches` "PayPal confirma",
  `refunded` "Reembolso en PayPal", `pending` "Pendiente en PayPal", `mismatch`
  "No coincide con PayPal" in the warning tone, `outside_window` "Fuera del periodo
  consultado"; nothing for `not_applicable`); a summary line above the table
  ("PayPal confirma N de M depósitos · datos de PayPal de las HH:MM", plus the truncation
  note when set); a "Comprobar de nuevo" button; the unavailable message with
  "Reintentar". Loading state is quiet (no layout jump). Chips use the existing
  neutral/attention chip styles from the polish pass; colours meet the contrast rules
  in `.design-sync/conventions.md`.
- i18n: keys under `operator.ledger.*` in es, ast, en, fr, de, pt; parity test and
  `npm run generate-locale-coverage`.
- Tests: dashboard test for ok (chips and summary), pending with time, unavailable plus
  retry refetch, truncated note; keyboard reachability of the buttons.

### [sandbox permission] (D9, owner-authorized)

1. With the sandbox credentials from `.env.local`, call the search once locally (a
   small script under `scratchpad`, never committed) for the last 7 days.
2. If PayPal answers 403 `NOT_AUTHORIZED`: in Chrome, open the PayPal developer
   dashboard, **Sandbox** tab, the Paisaxe sandbox REST app, tick "Transaction search",
   save. Screenshot for the evidence page. Never touch the Live tab.
3. Call again (a new token is needed: PayPal scopes are fixed at token issue). Record the
   result. A 200 with no entries is fine (lag).
4. If the browser path fails after two attempts, stop and tell the owner the exact
   setting and where it is.

## Verification

All automated gates from the plan's success criteria, plus
`npm run generate-locale-coverage`. Screenshots of the panel at 390 and 1280 px with
the mock in `ok`, `pending` and `unavailable` states (mocked API, never the hosted
Supabase; see the local dev server memory).

## Handoff to record

Units' owners and merge order; whether the capture time needed a new field; sandbox
permission outcome (and screenshot path); tree and commit tested.
