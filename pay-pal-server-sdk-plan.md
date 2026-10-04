# pay-pal-server-sdk integration plan (contract sheet)

Contract sheet required by the APIMatic `typescript-integrate-paypal` skill before
adapter code is written. Scope: the Paisaxe booking deposit (PayPal hackathon plan,
Phase 4, `docs/plans/2026-10-03-paypal-hackathon-booking-phases/phase-4.md`).
Owner decision 2026-10-03: use the plugin SDK, pinned.

## Package

- `pay-pal-server-sdk` 2.29 from `github:context-plugins/paypal-typescript-sdk`,
  pinned to commit `c27911067cf7e19e88eaca5bcd114dc182572656` (MIT; only runtime
  dependency `zod`). Imports from the package root only.
- The model type `Error` is imported as `PayPalApiError`.

## Hosts

| Deployment | Host | How |
| --- | --- | --- |
| All environments | `https://api-m.sandbox.paypal.com` | `serverEnvironment: ServerEnvironment.Sandbox`; `PAYPAL_API_BASE` must have exactly this hostname (`src/lib/paypal/env.ts`) until a reviewed production decision |
| Tests | local mock server (`src/test/paypal-mock-server.ts`) | `serverOptions: { default: { sandbox: { baseUrl } } }`; loopback hosts accepted only outside production |

## Client

One `PayPalServerSdkClient` per process (`src/lib/paypal/client.ts`): `timeout` 15 s,
`oauth2: { clientId, clientSecret }` plus `oauth2Strategy.getToken` backed by our
token cache, which the webhook verification call (plain `fetch`, no SDK surface)
shares. The custom `fetch` forwards `init` (signal included), rejects any hostname
other than the configured one, and records the HTTP status of each response so a
`SchemaError` on an undeclared error body still reports its status. No retries
exist in the SDK; `payPalRequestId` is the only idempotency.

## Operations

| Operation | Request type | Fields we set | Default to override | Error arms (status) |
| --- | --- | --- | --- | --- |
| `orders.createOrder` | `Orders.CreateOrderRequest` | `payPalRequestId` (operation key), `prefer: "return=representation"`, `body.intent: CAPTURE`, `body.purchaseUnits[0] = {amount {currencyCode EUR, value "30.00"}, customId: booking id, description}`, `body.paymentSource.paypal.experienceContext = {returnUrl, cancelUrl, userAction PAY_NOW, shippingPreference NO_SHIPPING}` | `prefer` is `return=minimal` | 400, 401, 422, 4xx/5xx |
| `orders.getOrder` | `{ id }` | `id` | none | 401, 404, 4xx/5xx |
| `orders.captureOrder` | `Orders.CaptureOrderRequest` | `id`, `payPalRequestId: "capture:" + key`, `prefer: "return=representation"`, `body: {}` | `prefer` is `return=minimal` | 400, 401, 403, 404, 422 (`ORDER_ALREADY_CAPTURED`, `ORDER_NOT_APPROVED`), 500, 4xx/5xx |
| `payments.getCapturedPayment` | `{ captureId }` | `captureId` | none | 401, 403, 404, 500 (empty decoder), 4xx/5xx |
| `payments.refundCapturedPayment` | `Payments.RefundCapturedPaymentRequest` | `captureId`, `payPalRequestId: "refund:" + key`, `prefer: "return=representation"`, `body.amount` | `prefer` is `return=minimal` | 400, 401, 403, 404, 409, 422, 500 (empty decoder), 4xx/5xx |
| `payments.getRefund` | `{ refundId }` | `refundId` | none | as getCapturedPayment |

Rules:
- Awaiting an operation resolves to the model on 2xx and rejects with the
  operation's `ResponseError` subclass otherwise. Error-arm tags come from the body
  schema, not the status, so the adapter keys on `err.status` and reads
  `payload.body.details[0].issue` and `debugId`.
- Every response field is optional and enums are open. The adapter asserts on the
  fields it relies on (`id`, `status`, `links`, `purchaseUnits[0].amount`,
  `customId`, `payments.captures[0]`), and a missing one is an adapter error.
- Optional members we do not use are omitted, never set to `undefined`.
- A malformed 2xx body raises `SchemaError`; the adapter reports it as
  `PaypalError` with the status recorded by the `fetch` wrapper.
- The approval link is `links[rel = "payer-action" | "approve"]`.

## REQUIRED READING

- MUST load `typescript-getting-started`, `typescript-client-initialization`,
  `typescript-authentication`, `typescript-calling-endpoints`, `typescript-models`,
  `typescript-error-handling`, `typescript-configuration-resilience` and
  `typescript-testing` (plugin `paypal@context-plugins` 0.3.3) before changing the
  adapter or its fakes.

## Assumptions and blockers

- `payer-action` is the approval rel when `payment_source.paypal` is used (Phase 0
  evidence used it); `approve` is accepted too.
- `ORDER_ALREADY_CAPTURED` and `ORDER_NOT_APPROVED` arrive as 422 with
  `details[0].issue`.
- A re-capture with a new request id can return 201 with the existing capture
  (Phase 0 finding 6): parsed normally, never treated as a second capture.
- Webhook verification is outside the SDK (no notifications surface).
- Invoicing v2 (Phase 8a: create, send, get and cancel invoice) is outside the SDK
  too (the pinned commit has no invoicing resource): plain `fetch` in
  `src/lib/paypal/invoices.ts` through `createPaypalFetch` and `getAccessToken`,
  like `webhooks.ts`. PayPal-Request-Id `invoice:` / `invoice-send:` + the
  booking id is sent on create and send as best effort: the published spec does
  not list that header for them (or for cancel). Cancel is
  `POST /v2/invoicing/invoices/{id}/cancel` with a `notification` body, 204. `getOrder` now also normalizes `payer.email_address` (else
  `payment_source.paypal.email_address`) as `payerEmail`, the invoice recipient.
- Blocker for production: the sandbox-only host guard stays until a reviewed
  production decision.
