# Phase 1: the official SDK under the adapter

**Plan:** [../2026-10-08-apimatic-official-sdk.md](../2026-10-08-apimatic-official-sdk.md)
**Entry:** `develop` at or after `c268b9e8` with this plan committed; a fresh Claude Code
session (the new plugin loads only in new sessions).
**Exit:** owner acceptance. No push.

## Steps

### 1. Plugin swap (D1)

- Run the deck's command exactly:
  `npx context-plugins install https://github.com/paypaldev/server-sdk-context-plugin-preview`
  (Claude Code target, user scope; answer "no" to telemetry if asked). Record the CLI
  version, the installed plugin id, version and commit from
  `~/.claude/plugins/installed_plugins.json`.
- Disable `paypal@context-plugins` 0.3.3 (`claude plugin disable`, or `enabledPlugins`
  in user settings). Do not uninstall.
- Restart the session; confirm the `typescript-*` skills listed come from the new plugin.
- Record all of this in the plan's Progress section (it is evidence for Phase 3).

### 2. Worktree and dependency (D2)

- `git worktree add -b feature/apimatic-sdk ../paisaxe-apimatic-sdk develop`, `npm ci`.
- Load `typescript-getting-started` first (the skill says so), then
  `typescript-client-initialization`, `typescript-authentication`,
  `typescript-calling-endpoints`, `typescript-models`, `typescript-error-handling`,
  `typescript-configuration-resilience`, `typescript-testing` as each step needs them.
  Keep a list of which skill informed which file, for the evidence page.
- `npm uninstall pay-pal-server-sdk && npm install --save-exact @paypal/paypal-server-sdk@2.5.0`;
  `npm ls @paypal/paypal-server-sdk` shows 2.5.0.
- Clone the SDK source read-only outside the repo at tag `2.5.0` (the skill's rule) and
  read signatures from it, not from memory.

### 3. Contract sheet (D7)

`git mv pay-pal-server-sdk-plan.md paypal-server-sdk-plan.md` and rewrite it for the
official SDK before any adapter code: package and pin, hosts and the guarded fetch,
`Client` configuration (timeout, `oAuthTokenProvider`, retry config D3, fetch adapter),
the operation table (controller, method, request fields incl. `paypalRequestId` and
`prefer`, error arms by status), the retry quirk and why `retryOnTimeout` is off,
assumptions. Keep the old "Operations" rows' semantics.

### 4. Client (`src/lib/paypal/client.ts`)

```
@ getPaypalClient() -> Client
ctx: getPaypalConfig(), token cache, @paypal/paypal-server-sdk
pre: config valid (else PaypalNotConfigured, unchanged)
do:
  1. lookup cached client by configKey (rebuild on change, unchanged)
  2. build Client{environment Sandbox, timeout, clientCredentialsAuthCredentials{id, secret, oAuthTokenProvider -> cachedToken}}
  3. set httpClientOptions.retryConfig = D3
  4. set unstable_httpClientOptions = {adapter "fetch", env.fetch: createPaypalFetch(config.baseUrl)}
  5. cache client
risk: the token provider must return `expiry` (unix seconds, bigint) so the SDK does not cache past our 60 s margin
```

```
@ createPaypalFetch(baseUrl) -> fetch
pre: baseUrl already allowed by env.ts
do:
  1. parse request URL (string or Request)
  2. validate origin is the SDK sandbox origin or baseUrl; else throw PaypalNotConfigured (request never sent)
  3. rewrite origin to baseUrl (identity on the real sandbox)
  4. call fetch with init (signal kept); drop cached token on 401 (non-token path)
br: plain-fetch callers (invoices, webhooks) pass baseUrl URLs and keep working
```

```
@ callPaypal(operation, run) -> {value, status, debugId}
do:
  1. run(client) -> ApiResponse<T>
  2. return {value: result, status: statusCode, debugId: headers["paypal-debug-id"]}
fail: ApiError (incl. CustomError) -> PaypalError{status: statusCode, issue: result.details[0].issue ?? parsed body, debugId: result.debug_id ?? header}
fail: response validation error -> PaypalError "unreadable body (HTTP n)" with status
fail: AbortError/TimeoutError/fetch TypeError -> PaypalError transport, status null
```

- Keep the exports `createPaypalFetch`, `getAccessToken`, `httpError`,
  `paypalTransportError`, `paypalTimeoutMs`, `resetPaypalClientForTests`.
  `resetPaypalClientForTests` gains `retryInterval` so tests do not wait 0.5 s.
- `callRecords` (AsyncLocalStorage) goes away if `ApiResponse`/`ApiError` give status and
  debug id in every case, including the validation error. If the validation error lacks
  the status, keep a minimal record in the fetch wrapper. Decide from the SDK source in
  step 2 and record which in the contract sheet.

### 5. Operations

`orders.ts`, `payments.ts`, `authorizations.ts`: `new OrdersController(client)` /
`new PaymentsController(client)`; `paypalRequestId` (the official casing); enums as value
imports, models as `import type` (the getting-started skill's barrel rule). Normalizers
keep their outputs. `types.ts` and `index.ts`: comments name the new package.

### 6. Tests (TDD order)

Write these first, against the mock server, and watch them fail on the old SDK where the
old one has no retries:

- `client.test.ts`:
  - GET 503 then 200: one retry, success, status 200.
  - POST capture 503 then 201: retried with the same `PayPal-Request-Id`; one capture
    created.
  - 422 `ORDER_ALREADY_CAPTURED` on POST is sent exactly once (the quirk's regression
    test).
  - 400 and 401 are never retried.
  - Retry exhaustion (503 three times) throws `PaypalError` with status 503.
  - Timeout is not retried (one attempt).
  - Every SDK POST in `orders/payments/authorizations` sends a `PayPal-Request-Id`
    (iterate the operations against the mock and assert the header).
  - The SDK's request to the fixed sandbox origin reaches the loopback mock; a request to
    any other origin is refused unsent (existing test, adapted).
- Replace the cases that assert old SDK internals (`PayPalServerSdkError` kinds) with
  equivalents on the new client; keep every case's intent (status, issue, debug id,
  unreadable body, connection failure).
- `orders.test.ts`, `payments.test.ts`, `authorizations.test.ts`, `invoices.test.ts`,
  `webhooks.test.ts`: unchanged and green. A change to any of them must be justified in
  the Progress notes (the behaviour contract is theirs).
- Mock server: add a per-path request log/counter and a "fail the next N requests with
  status S" hook if missing; it keeps PayPal's wire format.

## Verification

- `npm run typecheck`, `npm run typecheck:e2e`, `npm run lint`, `npx knip`,
  `npm run lint:deps`, `npm run check-licenses`, `npx vitest run --maxWorkers=4`.
- Local Supabase on a separate stack (release checklist's isolated-stack procedure if
  another session holds 543xx): `src/lib/booking/*.postgrest-integration.test.ts` and
  `scripts/booking/postman-local.test.ts`.
- `npx playwright test --project=release-required-local` (booking round trip through the
  mock).
- `npm run build` and `npm run check-bundle-budget` (the SDK is server-only; client
  bundles must not change).
- `git grep -n "pay-pal-server-sdk"` returns only historical plan files.

## Handoff to record

Plugin id/version/commit; skills used per file; whether `callRecords` survived; test
counts before/after; tree and commit tested; anything that deviated.
