# APIMatic prize: the official PayPal Server SDK, retries and Transaction Search

**Date:** 2026-10-08
**Issue:** #1013
**Base:** `develop` at `c268b9e8` (pushed; clean apart from the owner's untracked
`docs/research/2026-10-07-paypal-webinar-submission-notes.md`, never touched)
**Worktree:** `../paisaxe-apimatic-sdk` on `feature/apimatic-sdk` from `develop`
**Phases:** [phase-1](2026-10-08-apimatic-official-sdk-phases/phase-1.md) ·
[phase-2](2026-10-08-apimatic-official-sdk-phases/phase-2.md) ·
[phase-3](2026-10-08-apimatic-official-sdk-phases/phase-3.md)
**Parent plan:** `docs/plans/2026-10-03-paypal-hackathon-booking.md` (sponsor target R6;
Phase 4 decision 1 chose the SDK this plan replaces)

## Objective

Make Paisaxe a strong entry for APIMatic's "Best use of APIMatic" prize (top 3 teams:
$1,000 plus six months of APIMatic Business). The sponsor deck (owner's PDF
`PayPal_Hackathon_x_APIMatic_Context_Plugins.pdf`, slide 9) gives two conditions:
"Build your PayPal integration with the Context Plugin" and "Answer the plugin question on
the submission form". Slide 7 names the plugin:
`npx context-plugins install https://github.com/paypaldev/server-sdk-context-plugin-preview`.
Slide 5 sells "the latest PayPal SDKs with built-in auth, retries, rate-limit handling,
and typed errors".

Three outcomes:

1. The PayPal adapter (`src/lib/paypal/`) runs on the official `@paypal/paypal-server-sdk`
   2.5.0, written with that plugin's `typescript-*` skills, with retries and typed errors
   in use.
2. The operator panel calls a third PayPal API from the plugin's set, Transaction Search,
   as a read-only check that PayPal's records agree with each deposit.
3. The submission can prove both: an evidence page with dated commits, the skills used
   and a draft answer for the form's plugin question.

Out of scope: booking, payment and cancellation behaviour (the adapter's public functions
keep their signatures and results); Invoicing and webhook verification (not in the SDK;
they stay on plain `fetch` through the same guard and token cache); Vault and
Subscriptions (owner decision 2026-10-08); production, Vercel and the live PayPal app.
Pushing needs the owner's authorization at the end of Phase 3.

## Baseline (verified 2026-10-08)

| Fact | Evidence |
| --- | --- |
| The adapter uses `pay-pal-server-sdk` 2.29 from `github:context-plugins/paypal-typescript-sdk#c2791106…` (not on npm; `zod` runtime) | `package.json:102`; `pay-pal-server-sdk-plan.md:10` |
| It was written on 2026-10-03 with `paypal@context-plugins` 0.3.3 (author APIMatic, marketplace `context-plugins/plugin-marketplace`, skills for .NET, Python, TypeScript) | `~/.claude/plugins/installed_plugins.json`; parent notes `:569` |
| The deck's plugin is a different package: `paypal` 0.1.0 by "PayPal Server SDKs", 6 languages, pointing at `@paypal/paypal-server-sdk` 2.5.0 | `paypaldev/server-sdk-context-plugin-preview` `plugin.json`, `skills/typescript/typescript-getting-started/SKILL.md` |
| SDK imports exist only in `src/lib/paypal/{client,orders,payments,authorizations}.ts` | `git grep -n "pay-pal-server-sdk"` |
| The contract sheet says "No retries exist in the SDK" | `pay-pal-server-sdk-plan.md:29` |
| Booking code imports only `@/lib/paypal` (index re-exports, our own types) | `src/lib/paypal/index.ts:1-11`, `src/lib/paypal/types.ts:1-6` |
| The adapter's behaviour is pinned by tests through a local mock server: client 15, orders 17, payments 9, authorizations 21 | `src/lib/paypal/*.test.ts`; `src/test/paypal-mock-server.ts:748-790` |
| `@paypal/paypal-server-sdk` 2.5.0: MIT; 49 packages in its tree, all MIT or 0BSD | `npm view`; licence scan of a scratch install |

## Spike results (scratch, 2026-10-08)

A throwaway script (`scratchpad/ppsdk/probe/spike.mjs`, not committed) ran the official
SDK against a loopback server:

- **Routing:** the SDK's base URL is fixed per `Environment`
  (`src/client.ts:142-155` of the SDK). `unstable_httpClientOptions: { adapter: "fetch",
  env: { fetch } }` reaches axios's fetch adapter (axios 1.20 `lib/adapters/fetch.js:96,228`),
  so our own fetch receives every request and can redirect the sandbox origin to the mock.
  VERIFIED: `getOrder` returned 200 with `paypal-debug-id` from the loopback server.
- **Token:** `clientCredentialsAuthCredentials.oAuthTokenProvider` supplied our token;
  the request carried `Bearer TOKEN123`. VERIFIED.
- **Typed errors:** a 422 arrived as `CustomError` (`instanceof ApiError`), with
  `statusCode`, `headers['paypal-debug-id']` and `result.details[0].issue`. VERIFIED.
- **Retry quirk:** with the default `retryOnTimeout: true`, a POST answered 422
  `ORDER_ALREADY_CAPTURED` was sent three times. `@apimatic/core`'s retry interceptor
  (`lib/http/requestBuilder.js:611-660`) treats any thrown error, including the
  `ApiError` that its own error interceptor throws, as a timeout. With
  `retryOnTimeout: false`, a GET 503 was retried once and then succeeded, and the 422 was
  sent once. VERIFIED. Decision D3 follows from this.

## Decisions

| ID | Decision | Why |
| --- | --- | --- |
| D1 | Install the deck's plugin with the deck's exact command (Claude Code user scope) and disable, not uninstall, `paypal@context-plugins` 0.3.3 | Both ship skills named `typescript-getting-started` etc.; one source of truth during the work. Disabling keeps the earlier history reproducible. The plugin loads in new sessions, so Phase 1 starts in a fresh session |
| D2 | `@paypal/paypal-server-sdk` pinned exactly at `2.5.0` (the skill's rule: "Pin the exact version") | Matches the deck's plugin; a caret range would move the surface |
| D3 | Retry policy: `maxNumberOfRetries: 2`, `retryInterval: 0.5`, `backoffFactor: 2`, `maximumRetryWaitTime: 3`, `retryOnTimeout: false`, `httpStatusCodesToRetry: [429, 500, 502, 503, 504]`, `httpMethodsToRetry: ["GET", "POST"]` | POST retries are safe because every SDK POST we send carries a PayPal-Request-Id (asserted by a test). `retryOnTimeout: false` avoids the quirk above; a timeout's outcome stays unknown and goes to the existing reconciliation, as today. The 3 s budget keeps route latency bounded |
| D4 | Every request goes through our guarded fetch: it maps the SDK's fixed sandbox origin to `PAYPAL_API_BASE` (the same origin in sandbox; loopback for tests outside production) and refuses any other origin | Keeps the host guard and every mock-server test. Production stays impossible until a reviewed decision, as today |
| D5 | Our token cache stays the single token source (`oAuthTokenProvider`), shared with webhook verification and Invoicing | Unchanged behaviour: one in-flight request, 60 s refresh margin, drop on 401 |
| D6 | The adapter's public API (`src/lib/paypal/index.ts`) and `PaypalError` fields (`status`, `issue`, `debugId`) do not change | No consumer outside `src/lib/paypal` changes; the consumer sweep confirms it |
| D7 | The contract sheet moves to `paypal-server-sdk-plan.md` (`git mv`, history kept) and is rewritten for the official SDK | It is the evidence the plugin's skills shaped the code |
| D8 | Transaction Search runs automatically after the operator dashboard loads (owner, 2026-10-08): one search over the last 31 days, a chip per booking and a summary line, plus a refresh button. Read-only; it never changes a booking | Visible in the demo without slowing the panel |
| D9 | If the sandbox app answers `NOT_AUTHORIZED`, Claude enables "Transaction search" on the **sandbox** REST app in the PayPal developer dashboard through the browser (owner authorization, 2026-10-08). Never the live app | The API needs that permission |
| D10 | The retry quirk is written up as a draft report to APIMatic in the evidence page; sending it is the owner's call | An outward action |

## Phases

| Phase | Content | Stops for |
| --- | --- | --- |
| [1](2026-10-08-apimatic-official-sdk-phases/phase-1.md) | Plugin swap, dependency swap, adapter rewrite on the official SDK, retries, typed errors, contract sheet | Owner acceptance |
| [2](2026-10-08-apimatic-official-sdk-phases/phase-2.md) | Transaction Search adapter, ledger matching, operator route and panel chips, mock endpoint, Postman request, sandbox permission | Owner acceptance |
| [3](2026-10-08-apimatic-official-sdk-phases/phase-3.md) | Evidence page and form answer, full gates and E2E, sandbox acceptance with the owner, local merge | Owner's go-ahead to push |

## Consumer sweep

The change alters what the adapter's internals call and how failures are produced. The
public functions and `PaypalError` stay the same (D6), so consumers keep compiling; the
tests below prove they keep behaving.

Commands: `git grep -n "pay-pal-server-sdk\|PayPalServerSdk\|ServerEnvironment"`,
`git grep -ln "@/lib/paypal\|lib/paypal/" -- src scripts e2e`,
`git grep -n "vi.mock(\"@/lib/paypal\|paypal-mock-server" -- src e2e scripts`.

| Consumer | How it uses the adapter | Coverage |
| --- | --- | --- |
| `src/lib/paypal/{client,orders,payments,authorizations}.ts` | SDK imports | Phase 1 rewrites them |
| `src/lib/paypal/{invoices,webhooks}.ts` | `createPaypalFetch`, `getAccessToken`, `httpError`, `paypalTransportError`, `paypalTimeoutMs` | Phase 1 keeps these exports; `invoices.test.ts`, `webhooks.test.ts` run unchanged |
| `src/lib/paypal/types.ts`, `index.ts` | Comments name the old package | Phase 1 comment update only |
| `src/lib/booking/{capture,cancel,invoice,reconcile,phone-confirmation,webhook-events}.ts`, `src/app/api/webhooks/paypal/route.ts` | Public adapter functions | Unchanged; their unit tests mock `@/lib/paypal` (no effect) and their `*.postgrest-integration.test.ts` use the mock server through the real adapter (Phase 1 runs them with a local stack) |
| `src/test/paypal-mock-server.ts` (+ its test) | The PayPal stand-in | Phase 1: unchanged wire format, adds a request counter for the retry tests if missing; Phase 2: adds `GET /v1/reporting/transactions` |
| `e2e/booking-global-setup.ts`, `e2e/fixtures/booking-env.ts`, `e2e/booking-roundtrip.spec.ts` | Real adapter against the mock | Phase 1 and 3 run `release-required-local` |
| `scripts/booking/postman-local.ts` (+ test), `docs/hackathon/postman/*` | Real adapter against the mock | Phase 1 runs `postman-local.test.ts`; Phase 2 adds the search request |
| `scripts/eval/booking-eval.ts` | Real adapter against the mock | Phase 3 runs it once |
| `package.json`, `package-lock.json` | Dependency | Phase 1 |
| `pay-pal-server-sdk-plan.md` | Contract sheet | Phase 1 (D7) |
| `src/lib/booking/operator.ts`, `src/app/api/operator/[capability]/*`, `src/app/operator/[capability]/operator-dashboard.tsx` | Operator data and UI | Phase 2 adds a route and UI; existing route unchanged |

Excluded: `docs/plans/2026-10-03-*` keep their historical references to the old package
(they record what was decided then); the parent notes get a pointer to this plan in Phase 3.

## Stuck states and recovery

| State | Who sees it, what they see | How it ends | Test |
| --- | --- | --- | --- |
| PayPal keeps answering 5xx/429 past the retry budget | Traveller: the existing payment error or "confirming" state; operator: unchanged | Existing reconciliation (`src/lib/booking/reconcile.ts`) and webhooks settle the payment; the traveller's page polls | Phase 1: retry exhaustion throws `PaypalError` with the last status; existing reconcile tests unchanged |
| A request times out (not retried, D3) | Same as today | Same as today: reconciliation reads the order | Phase 1: `orders.test.ts` "reports a timeout as a PaypalError with a null status" stays green and asserts one attempt |
| A retried POST was already processed | Nobody: PayPal replays the stored response for the same PayPal-Request-Id | Automatic | Phase 1: mock 503-then-success on capture returns one capture; the mock saw one request id twice |
| The SDK cannot parse a success body | Caller gets `PaypalError` "unreadable body (HTTP n)" | Reconciliation, as today | Phase 1: `client.test.ts` keeps "reports an unreadable success body with the recorded status" |
| Transaction Search not permitted (403 `NOT_AUTHORIZED`), not configured, or timed out | Operator: "La comprobación con PayPal no está disponible ahora" with a "Reintentar" button; the rest of the panel works | Retry button; D9 enables the sandbox permission | Phase 2: route returns `{ state: "unavailable", reason }`; dashboard test shows the message and the retry refetches |
| PayPal has not listed a capture yet (Transaction Search lags up to about 3 hours) | Operator: chip "Pendiente en PayPal" and "Datos de PayPal actualizados a las HH:MM" from `last_refreshed_datetime` | Next load or refresh after PayPal updates | Phase 2: matcher returns `pending` for a capture newer than the refresh time; UI test shows the time |
| More transactions than one page (500) | Operator: "Mostrando los 500 movimientos más recientes" | Disclosure only (the demo merchant has a handful) | Phase 2: matcher/route test with `total_pages > 1` |
| A capture older than the 31-day window | Operator: chip "Fuera del periodo consultado" | Disclosure | Phase 2: matcher test |
| Amount or status disagrees with the booking | Operator: chip "No coincide con PayPal" (warning tone); no state change | Operator investigates in PayPal; read-only by design | Phase 2: matcher test; dashboard test |

## Success criteria

Automated (each phase, on the phase's final tree): `npm run typecheck`, `npm run lint`,
`npx vitest run --maxWorkers=4`, `npx knip`, `npm run lint:deps`, `npm run check-licenses`, `npm run typecheck:e2e`,
`npm run generate-locale-coverage` (Phase 2), the PayPal integration tests with a local
Supabase stack, `npx playwright test --project=release-required-local` (Phases 1 and 3).

Manual (Phase 3, owner): one sandbox deposit approved by the owner, captured through the
new SDK, visible as "PayPal confirma" in the operator panel once PayPal lists it, then
refunded; screenshots for the evidence page.

## Progress

- 2026-10-08: plan written; owner decisions D8, D9 and three phases recorded. Next:
  Phase 1 in a fresh session after the plugin swap.
- 2026-10-08, Phase 1 done (owner asked for all phases without stopping; deviations in
  [the notes](2026-10-08-apimatic-official-sdk-notes.md#phase-1)).
  - Plugin: `paypal@context-plugins-local` 0.1.0 ("PayPal Server SDKs"), installed by
    the owner with the deck's command plus `--targets claude --yes --force`
    (context-plugins CLI 0.12.0) on 2026-10-08 05:35 UTC; source
    `paypaldev/server-sdk-context-plugin-preview@main`, commit
    `6aa057126f0d4709a42e15002aab832a94935d92` (2026-09-25). `paypal@context-plugins`
    0.3.3 (commit `d09ec8bd`) disabled, still installed.
  - SDK: `@paypal/paypal-server-sdk` 2.5.0 exact; source read at tag `2.5.0`, commit
    `790be9be9b694be08157e1cd5d50321c72727a76`.
  - Skills used, by file:
    - `typescript-getting-started`: exact pin in `package.json`; root-only imports with
      the value/type split in `orders.ts`, `payments.ts`, `authorizations.ts` and
      `client.ts`; SDK source read at the pinned tag.
    - `typescript-client-initialization`: one long-lived `Client` per configuration;
      controllers built by us beside it (`client.ts` `sdkFor`).
    - `typescript-authentication`: `clientCredentialsAuthCredentials` with
      `oAuthTokenProvider`; a provider that never rejects (`client.ts` `tokenProvider`).
    - `typescript-calling-endpoints`: Form B option objects, `paypalRequestId`,
      `ApiResponse.result`/`statusCode`/`headers` (`callPaypal` and every operation).
    - `typescript-models`: enum members instead of strings (`CheckoutPaymentIntent`,
      `PaypalExperienceUserAction`, `PaypalWalletContextShippingPreference`); the nullable
      `voidPayment` result (`authorizations.ts`).
    - `typescript-error-handling`: one `ApiError` branch, `result` versus `body`,
      PayPal's wire field names in the payload (`client.ts` `toPaypalError`).
    - `typescript-configuration-resilience`: explicit `timeout` (the default `0` means
      none), the retry configuration with both budget fields set, and routing below the
      SDK (`client.ts` `retryConfig`, `sdkFetch`).
    - `typescript-testing`: the retry interval shortened in tests, every intercepted call
      recorded and selected by path (`client.test.ts`).
  - `callRecords` kept, reduced to the status and debug id of each attempt's response.
    The SDK's "not JSON" error carries no status.
  - Tests (`it` blocks): `client.test.ts` 15 → 28 (retries, the quirk, the declared
    500, request ids on every POST, provider recovery, routing); `authorizations.test.ts`
    19 → 20 (204 void). `orders`, `payments`, `invoices` and `webhooks` test files are
    unchanged. TDD red verified: without the retry configuration 3 tests failed; with
    `retryOnTimeout: true`, 6 failed.
  - Review: an independent reviewer approved after one round. 1 major (500 retries
    documented wrongly) and 4 minor findings, all fixed; 2 nits, one applied, one
    tested. Simplify (4 angles): controllers cached with the client, an SDK-only
    fetch so the shared guard stays strict, unreadable bodies detected from the call
    record instead of SDK message text, duplicate config read and redundant fallbacks
    removed. Skipped: a dummy-token redesign (changes failure reporting and bypasses
    the skill's provider), shared `parseJson` and shared test fixtures (outside this
    diff; the plan keeps those files unchanged).
- 2026-10-08, Phase 2 done: Transaction Search in the adapter (`searchTransactions`), the matcher
  (`src/lib/booking/ledger.ts`), `GET /api/operator/<cap>/paypal-ledger`, the panel's chips, summary
  and buttons, the mock endpoint, the Postman request "08 Operator ledger". The sandbox permission is set
  and not yet applied by PayPal. Ten deviations and the gate record (including three one-off
  failures, two with unknown cause) are in the notes, Phase 2.
