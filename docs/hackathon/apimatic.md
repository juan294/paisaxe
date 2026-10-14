# Paisaxe and the APIMatic Context Plugin

How Paisaxe's PayPal integration was rebuilt on the official PayPal Server SDK with the
PayPal Context Plugin from the hackathon's APIMatic session, what the plugin's skills
decided in the code, and one runtime finding for APIMatic. Plan, notes and reviews:
[`docs/plans/2026-10-08-apimatic-official-sdk.md`](../plans/2026-10-08-apimatic-official-sdk.md)
and its [notes](../plans/2026-10-08-apimatic-official-sdk-notes.md) (issue #1013).

## What we used

| | |
| --- | --- |
| Plugin | `paypal` 0.1.0 by "PayPal Server SDKs" (`paypal@context-plugins-local` in Claude Code), source `github.com/paypaldev/server-sdk-context-plugin-preview` at commit `6aa05712` |
| Install command (as in the session's deck) | `npx context-plugins install https://github.com/paypaldev/server-sdk-context-plugin-preview` (context-plugins CLI 0.12.0; we added `--targets claude --yes --force`, because an earlier plugin also named `paypal` was installed) |
| Skills used | the eight `typescript-*` skills, read completely (from the installed plugin) before the code was written |
| SDK | `@paypal/paypal-server-sdk` **2.5.0**, pinned exactly; source read at tag `2.5.0` (commit `790be9be`) |
| Contract sheet | [`paypal-server-sdk-plan.md`](../../paypal-server-sdk-plan.md): every operation, field, error arm and setting, read from the SDK source before code |
| Code | [`src/lib/paypal/`](../../src/lib/paypal/) (adapter), [`src/lib/booking/ledger.ts`](../../src/lib/booking/ledger.ts), [`src/app/api/operator/[capability]/paypal-ledger/route.ts`](../../src/app/api/operator/[capability]/paypal-ledger/route.ts), the operator panel |

## Three PayPal APIs through the SDK

- **Orders** (`OrdersController`): create, read, capture and authorize the booking deposit.
- **Payments** (`PaymentsController`): read captures, refund, capture and void authorizations.
- **Transaction Search** (`TransactionSearchController`): new. The operator panel checks each
  deposit against PayPal's own records, read-only: "PayPal confirma", "Reembolso en PayPal",
  "Pendiente en PayPal" (PayPal lists a movement up to three hours later, its documented maximum;
  about two hours in our sandbox), "No coincide con PayPal", with PayPal's refresh time.

Webhook verification and Invoicing are not in the SDK; they stay on `fetch` through the same host
guard and token cache.

## How the skills shaped the code

| Skill | Where | What it decided |
| --- | --- | --- |
| `typescript-getting-started` | `package.json`, every adapter file | Exact pin `2.5.0`; imports from the package root with enums as values and models as `import type` (the barrel rule); every signature read from the SDK source at the pinned tag, not from memory |
| `typescript-client-initialization` | `client.ts` (`sdkFor`) | One long-lived `Client` per configuration; controllers built by us beside it, not reached from the client |
| `typescript-authentication` | `client.ts` (`tokenProvider`) | Credentials through `clientCredentialsAuthCredentials.oAuthTokenProvider`, backed by our own token cache. The skill's warning that a provider which rejects disables the client for the process led to a provider that never rejects (it returns an expired token, so the SDK asks again next call), pinned by a test |
| `typescript-calling-endpoints` | every operation | One options object per call, `paypalRequestId` on every POST, values from `ApiResponse.result`, status and debug id from `statusCode` and `headers` |
| `typescript-models` | `orders.ts`, `authorizations.ts`, `transactions.ts` | Enum members (`CheckoutPaymentIntent`, `PaypalExperienceUserAction`, `PaypalWalletContextShippingPreference`), the nullable `voidPayment` result, date fields as unchecked strings (RFC 3339 with seconds, as the controller documents) |
| `typescript-error-handling` | `client.ts` (`toPaypalError`) | One `ApiError` branch for `CustomError`, `SearchError` and plain `ApiError`; `result` when the SDK parsed it, otherwise the raw `body`; PayPal's wire field names (`debug_id`, `details[0].issue`) |
| `typescript-configuration-resilience` | `client.ts` (`retryConfig`, `sdkFetch`) | The SDK's default `timeout` is `0` (no limit), so we set 15 s. Its default retry configuration retries nothing, so we set both budget fields. Routing below the SDK, because there is no base-URL option |
| `typescript-testing` | `client.test.ts`, `transactions.test.ts` | The retry interval shortened in tests; every intercepted request recorded and selected by path; a stubbed 5xx for the retry tests. We kept our stateful mock server rather than a stub adapter, which the skill allows |

## Before and after

| | 2026-10-03 | 2026-10-08 |
| --- | --- | --- |
| Plugin | `paypal@context-plugins` 0.3.3 (marketplace `context-plugins/plugin-marketplace`) | `paypal` 0.1.0 from the session's deck (the earlier one disabled, not uninstalled) |
| SDK | `pay-pal-server-sdk` 2.29, an unpublished build from `github:context-plugins/paypal-typescript-sdk` | `@paypal/paypal-server-sdk` 2.5.0 from npm |
| Retries | none ("No retries exist in the SDK") | 429, 502, 503 and 504 (and undeclared 500s) on GET and POST, at most 2 retries with at most 3 s of waiting between them; every POST carries a PayPal-Request-Id, so a retried capture or refund runs once |
| APIs | Orders, Payments | Orders, Payments, **Transaction Search** |
| Commits | `7e43a9e8` (adapter, 2026-10-03) | `1e4ded3b` (official SDK, retries; all the skill table's rows except Transaction Search), `75bf1cea` (Transaction Search), both 2026-10-08 |

The adapter's public functions and its error type did not change, so no booking code changed. The
adapter tests (`src/lib/paypal/*.test.ts`) pinned the behaviour across the move.

## A finding for APIMatic (draft report, not sent)

**Summary.** In `@apimatic/core` 0.10.30 (the runtime of `@paypal/paypal-server-sdk` 2.5.0), the
retry interceptor treats the `ApiError` thrown for a declared HTTP status as a timeout.

**Where.** `lib/http/requestBuilder.js`: interceptors are composed outermost-first as response
validator, authentication, retry, error handling (lines 49-52). The retry interceptor
(`_addRetryInterceptor`) catches whatever the inner chain throws, stores it as `timeoutError` and
asks `getRetryWaitTime(..., timeoutError)` whether to retry. The error-handling interceptor below it
throws for every status declared with `req.throwOn(...)`.

**Effects.**

1. With the default `retryOnTimeout: true`, any declared status is retried as if it had timed out,
   including 4xx. A `captureOrder` answered 422 `ORDER_ALREADY_CAPTURED` was sent three times.
2. With `retryOnTimeout: false`, a declared status is never retried, even when listed in
   `httpStatusCodesToRetry`. `captureOrder`, `authorizeOrder` and every `PaymentsController`
   operation declare 500, so their 500 is sent once. Undeclared statuses (502, 503, 504, 429, and
   500 on `createOrder` and `getOrder`) are retried by status, because the `defaultToError` arm is
   applied later, by the response validator.

**Minimal reproduction.** A client with `retryConfig: { maxNumberOfRetries: 2, retryInterval: 0.01,
maximumRetryWaitTime: 3, httpStatusCodesToRetry: [500, 503], httpMethodsToRetry: ["POST"] }`, calling
`captureOrder` against a local server that answers `POST /v2/checkout/orders/{id}/capture`:

| Answer | `retryOnTimeout: true` (the default) | `retryOnTimeout: false` |
| --- | --- | --- |
| 422 with a PayPal error body (declared) | 3 requests | 1 request |
| 500 (declared by `captureOrder`) | retried, as a "timeout" | 1 request, though 500 is listed |
| 503 (not declared) | 3 requests | 3 requests |

Observed: the 422 row (both columns; our spike, and the regression test with each setting), the 500
row (the regression test, and the same test with `retryOnTimeout: true`, where the capture was
retried and succeeded), and 503 with `retryOnTimeout: false` (the retry tests). The 503 cell with
`true` follows from the same code path and was not run separately.

**What we chose.** `retryOnTimeout: false`, documented in the contract sheet, with two regression
tests in [`src/lib/paypal/client.test.ts`](../../src/lib/paypal/client.test.ts): "sends a 422 on
POST exactly once" and "retries a 500 only where the operation does not declare it". A timed-out
or unretried capture goes to the booking's existing reconciliation, as before.

**Suggested fix.** Distinguish a response that maps to a declared error from a transport failure in
the retry interceptor: retry declared statuses by `httpStatusCodesToRetry`, and apply
`retryOnTimeout` only to failures without a response.

## Proof

- Tests: [`src/lib/paypal/client.test.ts`](../../src/lib/paypal/client.test.ts) (retries, the quirk,
  token provider, routing, error mapping), [`transactions.test.ts`](../../src/lib/paypal/transactions.test.ts),
  [`src/lib/booking/ledger.test.ts`](../../src/lib/booking/ledger.test.ts), the ledger route and
  panel tests. The local mock server (`src/test/paypal-mock-server.ts`) answers Transaction Search
  in the sandbox's shapes (without a capture's own reference, which the adapter does not use).
- Postman: [`docs/hackathon/postman/`](postman/README.md), request "08 Operator ledger (PayPal
  Transaction Search)". A local Newman run passed 27 of 27.
- Sandbox acceptance, 2026-10-08: [record](../plans/2026-10-08-apimatic-official-sdk-phases/sandbox-acceptance-2026-10-08.md).
  An order, capture and refund through the official SDK, and the operator panel's Transaction
  Search against the real sandbox.

## Draft answer for the submission form's plugin question

> We rebuilt Paisaxe's PayPal integration with the PayPal Context Plugin
> (`paypaldev/server-sdk-context-plugin-preview`, installed with the session's command) and
> the official `@paypal/paypal-server-sdk` 2.5.0. Before any code, its eight `typescript-*` skills
> shaped a contract sheet: the exact pin, a token provider that never rejects, an explicit
> timeout (the default is none), retries with idempotent PayPal-Request-Ids, and typed `ApiError`s
> mapped to PayPal's status, issue and debug id. Three PayPal APIs now run through the SDK:
> Orders and Payments for deposits and refunds, and Transaction Search, new, so operators see
> whether PayPal's own records confirm each deposit. Testing retries, we found that the APIMatic
> runtime counts a declared error as a timeout (a 422 sent three times).
> We chose a safe setting, pinned it with tests and drafted a report for APIMatic.

(127 words. The form's exact wording was not available on 2026-10-08; trim to fit.)
