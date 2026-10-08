# @paypal/paypal-server-sdk integration plan (contract sheet)

The contract sheet the plugin's skills ask for before adapter code is written. It
replaces the 2026-10-03 sheet for `pay-pal-server-sdk` (the earlier plugin's
unpublished SDK copy; `git log --follow` on this file shows it). Scope: the Paisaxe
booking deposit and the operator ledger check (plans
`docs/plans/2026-10-03-paypal-hackathon-booking.md` and
`docs/plans/2026-10-08-apimatic-official-sdk.md`, issue #1013).

Every fact below was read from the SDK source at tag `2.5.0`
(`github.com/paypal/PayPal-TypeScript-Server-SDK`, commit `790be9be`) or from the
installed runtime packages, not from memory. File references are to that tree.

## Plugin

- `paypal@context-plugins-local` 0.1.0, author "PayPal Server SDKs", installed on
  2026-10-08 with the sponsor deck's command
  `npx context-plugins install https://github.com/paypaldev/server-sdk-context-plugin-preview`
  (context-plugins CLI 0.12.0; source commit `6aa05712`, 2026-09-25).
- The earlier `paypal@context-plugins` 0.3.3 (commit `d09ec8bd`) is disabled, not
  uninstalled.

## Package

- `@paypal/paypal-server-sdk` pinned exactly at `2.5.0` (`typescript-getting-started`:
  "Pin the exact version"). MIT. Runtime: `@apimatic/core` 0.10.30,
  `@apimatic/axios-client-adapter` 0.3.21 (axios 1.20), `@apimatic/oauth-adapters` 0.4.18.
- Imports from the package root only. Enums are value imports, models `import type`
  (`src/index.ts` emits `export type` for plain models and `export` for enums;
  `typescript-getting-started`, barrel rule).
- Controllers are constructed by us, not reached from the client
  (`typescript-client-initialization`): `new OrdersController(client)`,
  `new PaymentsController(client)` (and `new TransactionSearchController(client)` in
  Phase 2), once per client, beside it in the adapter's cache; `callPaypal` hands
  them to each call site. Every operation takes one options object
  (Form B, `typescript-calling-endpoints`) and returns `ApiResponse<T>`.

## Hosts

| Deployment | Host | How |
| --- | --- | --- |
| All environments | `https://api-m.sandbox.paypal.com` | `environment: Environment.Sandbox` (`src/client.ts` `getBaseUri`). `PAYPAL_API_BASE` must have exactly this hostname (`src/lib/paypal/env.ts`) until a reviewed production decision |
| Tests, Postman runner, E2E | local mock server (`src/test/paypal-mock-server.ts`) | the SDK's fetch (`sdkFetch`) rewrites the sandbox origin to `PAYPAL_API_BASE` (loopback accepted outside production) before the guarded fetch |

The SDK has no base-URL option (`typescript-configuration-resilience`, "Base URL /
environment"). The skill's preferred routes are a proxy/DNS entry or a request
interceptor; we route one layer lower, through axios's own fetch adapter with our
`fetch` (`unstable_httpClientOptions: { adapter: "fetch", env: { fetch: sdkFetch } }`),
because that is also where the host guard belongs: the last point before the network, for
every request the SDK sends. It is not a replacement adapter, so the SDK's retry,
timeout and error mapping still apply (verified by the retry tests). The skill's
warning about the token request going to the real host does not apply: the SDK
never requests a token (see "Client").

## Client (`src/lib/paypal/client.ts`)

One `Client` per configuration (rebuilt when `PAYPAL_API_BASE` or the credentials
change, and after a 401):

| Field | Value | Why |
| --- | --- | --- |
| `environment` | `Environment.Sandbox` | the only host we allow |
| `timeout` | 15 000 ms | `DEFAULT_CONFIGURATION.timeout` is `0`, which axios treats as no limit (`typescript-configuration-resilience`) |
| `clientCredentialsAuthCredentials` | `{ oAuthClientId, oAuthClientSecret, oAuthTokenProvider }` | property name read off `src/configuration.ts` (`typescript-authentication`) |
| `httpClientOptions.retryConfig` | D3, below | `DEFAULT_RETRY_CONFIG` has `maxNumberOfRetries: 0` and `maximumRetryWaitTime: 0`: nothing is retried unless both are set |
| `unstable_httpClientOptions` | `{ adapter: "fetch", env: { fetch: sdkFetch(baseUrl) } }` | guarded routing (Hosts); `sdkFetch` wraps the strict `createPaypalFetch` shared with webhooks and Invoicing |

### Token

`oAuthTokenProvider` returns our cached token (`getAccessToken`, shared with webhook
verification and Invoicing): one in-flight request, refreshed 60 s before
`expires_in`, dropped on a 401. It returns `expiry` in unix seconds (bigint) equal to
our refresh time, so the SDK asks again exactly when our cache would.

`typescript-authentication` warns that a provider that rejects disables the client
for the rest of the process (`@apimatic/oauth-adapters` caches the rejected promise
as `lastOAuthToken`). So:

1. `callPaypal` obtains the token before it calls the SDK; a token failure is thrown
   there as a `PaypalError` with the token endpoint's status.
2. The provider itself never rejects: on failure it returns an expired token
   (`expiry: 0n`), which the SDK rejects for that call ("OAuth token is expired")
   and asks for again on the next one.
3. A 401 from PayPal drops our token and the client, so the next call starts with a
   fresh token and a fresh `lastOAuthToken`.

### Retries (decision D3)

```ts
retryConfig: {
  maxNumberOfRetries: 2, retryInterval: 0.5, backoffFactor: 2, maximumRetryWaitTime: 3,
  retryOnTimeout: false,
  httpStatusCodesToRetry: [429, 500, 502, 503, 504],
  httpMethodsToRetry: ["GET", "POST"],
}
```

- POST is retried because every POST we send through the SDK carries a
  `PayPal-Request-Id` (asserted by `client.test.ts`); PayPal replays the stored
  response for a repeated id, so a retried capture or refund never runs twice.
- `retryOnTimeout: false` because of the quirk below. A timeout's outcome is unknown
  and goes to the existing reconciliation (`src/lib/booking/reconcile.ts`), as before.
- What is actually retried: 429, 502, 503 and 504 everywhere (no operation we call
  declares them), and 500 only on `createOrder` and `getOrder`. `captureOrder`,
  `authorizeOrder` and every `PaymentsController` operation declare
  `throwOn(500, ...)`, so their 500 is sent once and the outcome goes to
  reconciliation, as before (quirk below; pinned by `client.test.ts`, "retries a 500
  only where the operation does not declare it").
- Latency: the 3 s budget bounds the waits between attempts, not the call. `timeout`
  is per attempt, so the worst case is two slow 5xx answers and a third attempt that
  times out: 3 × 15 s + 1.5 s of waits, about 46.5 s (before: 15 s). A timed-out
  attempt is never retried, so a hung PayPal still ends the call after 15 s. No
  booking route sets `maxDuration`; the Vercel default for these functions is not
  verified here.

### The retry quirk (draft report to APIMatic, not sent; D10)

`@apimatic/core` 0.10.30 builds each request's interceptors in this order: response
validator, authentication, retry, error handling (`lib/http/requestBuilder.js:49-52`,
outermost first). The retry interceptor (`_addRetryInterceptor`) stores any error
thrown below it as `timeoutError` and asks `getRetryWaitTime(..., timeoutError)`
whether to retry. The error-handling interceptor below it throws the `ApiError` for
every status the operation declares with `throwOn`, so two things follow:

1. With the default `retryOnTimeout: true`, a declared status counts as a timeout and
   is retried whatever it is: a POST answered 422 `ORDER_ALREADY_CAPTURED` was sent
   three times in our spike.
2. With `retryOnTimeout: false`, a declared status is never retried, even when it is
   in `httpStatusCodesToRetry`: a 500 on `captureOrder` or `getCapturedPayment` is
   sent once. Undeclared statuses reach the retry interceptor as responses and are
   retried by status (the `defaultToError` arm is applied later, by the response
   validator).

Regression tests: `client.test.ts`, "sends a 422 on POST exactly once" and "retries
a 500 only where the operation does not declare it".

### Errors (`typescript-error-handling`)

Orders operations map every non-2xx to `CustomError` (`req.throwOn(...)` and
`req.defaultToError(CustomError)` in `src/controllers/ordersController.ts`); Payments
operations do the same except their declared 500, which is a plain `ApiError`
(`paymentsController.ts`, e.g. `:420-423`); Transaction Search maps to `SearchError`.
All extend `ApiError`, so `callPaypal` catches `ApiError` once:

| Thrown | `PaypalError` |
| --- | --- |
| `ApiError` (incl. `CustomError`, `SearchError`) | `status: statusCode`, `issue: details[0].issue` (the payload keeps PayPal's wire names), `debugId: debug_id ?? headers["paypal-debug-id"]`, read from `result` when the SDK parsed it (a subclass on a declared arm; parsed JSON without a schema) and otherwise from `body` parsed here (the `defaultToError` arm and plain `ApiError` leave `result` undefined). A non-JSON body yields no issue |
| `ResponseValidationError` (2xx body fails the schema) or plain `Error` "Could not parse body as JSON" (2xx body is not JSON) | "unreadable body (HTTP n)" with the status and debug id from the call record below |
| our `PaypalNotConfigured` (host guard), wrapped by axios as `cause` | passed through unchanged |
| plain `Error` "OAuth token is expired" / "Client is not authorized" (our provider could not get a token inside the call) | "could not obtain a token", status null |
| axios timeout (`ECONNABORTED`/`ETIMEDOUT`), `AbortError` | "timed out", status null |
| anything else (connection refused, DNS) | "connection error", status null |

`callRecords` survives in a reduced form: `sdkFetch` clears the record before each
attempt and records the status and debug id of its response, because the "Could not
parse body as JSON" error carries no status. Any non-`ApiError` failure with a
recorded status is reported as an unreadable body (this covers
`ResponseValidationError` too, without matching SDK message text); a failure without
one (timeout, connection error, token refusal) learned nothing from PayPal.
`ApiResponse` and `ApiError` carry their own status and headers.

## Operations

| Operation | Fields we set | Error arms (status, from the controller) |
| --- | --- | --- |
| `OrdersController.createOrder` | `paypalRequestId` (operation key), `prefer: "return=representation"`, `body.intent` (`CheckoutPaymentIntent`), `body.purchaseUnits[0] = {amount {currencyCode, value}, customId: booking id, description}`, `body.paymentSource.paypal.experienceContext = {returnUrl, cancelUrl, userAction PaypalExperienceUserAction.PayNow, shippingPreference PaypalWalletContextShippingPreference.NoShipping}` | 400, 401, 422, default (all `CustomError`) |
| `OrdersController.getOrder` | `id` | 401, 404, default |
| `OrdersController.captureOrder` | `id`, `paypalRequestId: "capture:" + key`, `prefer`, `body: {}` | 400, 401, 403, 404, 422 (`ORDER_ALREADY_CAPTURED`, `ORDER_NOT_APPROVED`), 500, default |
| `OrdersController.authorizeOrder` | `id`, `paypalRequestId: "authorize:" + key`, `prefer`, `body: {}`; returns `OrderAuthorizeResponse` | 400, 401, 403, 404, 422 (`ORDER_ALREADY_AUTHORIZED`, `ORDER_NOT_APPROVED`), 500, default |
| `PaymentsController.getCapturedPayment` | `captureId` | 401, 403, 404, 500, default |
| `PaymentsController.refundCapturedPayment` | `captureId`, `paypalRequestId: "refund:" + key`, `prefer`, `body.amount` | 400, 401, 403, 404, 409, 422, 500, default |
| `PaymentsController.getRefund` | `refundId` | 401, 403, 404, 500, default |
| `PaymentsController.captureAuthorizedPayment` | `authorizationId`, `paypalRequestId: "capture-authorization:" + key`, `prefer`, `body: {amount, finalCapture: true}` | 400, 401, 403, 404, 409, 422, 500, default |
| `PaymentsController.voidPayment` | `authorizationId`, `paypalRequestId: "void:" + key`, `prefer`; returns `PaymentAuthorization \| null` (null: the adapter reads the authorization) | 401, 403, 404, 409, 422, 500, default |
| `PaymentsController.getAuthorizedPayment` | `authorizationId` | 401, 403, 404, 500, default |
| `TransactionSearchController.searchTransactions` (Phase 2) | `startDate`, `endDate` (RFC 3339 with seconds, at most 31 days apart), `fields: "transaction_info"`, `pageSize: 500`, `page: 1` | default `SearchError`: 403 with `name` and `details[0].issue` both `NOT_AUTHORIZED` when the app lacks the Transaction Search permission (observed in the sandbox on 2026-10-08, debug id `f636297435446`) |

Rules:
- The parameter is `paypalRequestId` (lower-case "pal"); the old SDK's
  `payPalRequestId` does not exist here.
- Every response field is optional. The adapter asserts on the fields it relies on
  (`id`, `status`, `links`, `purchaseUnits[0].amount`, `customId`,
  `payments.captures[0]`), and a missing one is an adapter error.
- Optional members we do not use are omitted, never set to `undefined`.
- Date/time fields are plain strings; the SDK neither converts nor checks them
  (`typescript-models`).
- The approval link is `links[rel = "payer-action" | "approve"]`.

## Outside the SDK

- Webhook verification (`/v1/notifications/verify-webhook-signature`) and Invoicing
  v2 are not in the SDK: plain `fetch` in `src/lib/paypal/webhooks.ts` and
  `invoices.ts` through `createPaypalFetch` and `getAccessToken`, as before.
- Invoicing request-id and issue-name assumptions are unchanged from the 2026-10-03
  sheet (see its history).

## REQUIRED READING

Load before changing the adapter or its fakes (plugin `paypal@context-plugins-local`
0.1.0): `typescript-getting-started`, `typescript-client-initialization`,
`typescript-authentication`, `typescript-calling-endpoints`, `typescript-models`,
`typescript-error-handling`, `typescript-configuration-resilience`,
`typescript-testing`.

## Testing (`typescript-testing`)

The skill's seam is a stub axios adapter in `unstable_httpClientOptions`. We keep the
existing local mock server instead (the skill allows stubbing at the HTTP layer):
it speaks PayPal's wire format, keeps state across calls and replays
`PayPal-Request-Id`, which the retry and idempotency tests need. Tests shorten the
retry interval through `resetPaypalClientForTests({ retryInterval })`, as the skill
advises for a stubbed 5xx.

## Assumptions and blockers

- `payer-action` is the approval rel when `payment_source.paypal` is used; `approve`
  is accepted too.
- A re-capture with a new request id can return 201 with the existing capture
  (Phase 0 finding 6): parsed normally, never treated as a second capture.
- The authorization 422 issue names are from PayPal's documentation as understood,
  not observed in the sandbox; booking code resolves every 422 by reading the
  authorization or the order, except the idempotent re-authorize and re-void
  shortcuts.
- Blocker for production: the sandbox-only host guard stays until a reviewed
  production decision.
