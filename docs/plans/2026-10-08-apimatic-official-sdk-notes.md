# APIMatic official SDK: implementation notes

Plan: [2026-10-08-apimatic-official-sdk.md](2026-10-08-apimatic-official-sdk.md)

## Deviations

### Phase 1

1. **The plugin was installed by the owner, and its skills were read from the plugin cache in the same session.**
   - Plan said: run the deck's install command (Claude Code target), disable the old plugin, restart the session and confirm the `typescript-*` skills come from the new plugin.
   - Found: Claude Code's auto-mode permission check refused the install three times, once after the owner granted it. When the owner ran it, the installer refused the name clash (`'paypal' is already installed from a different source`). With `--force` it installed `paypal@context-plugins-local` 0.1.0 beside the old one rather than replacing it. The session's skill list still showed the old plugin's skills.
   - Chose: the owner ran `CP_TELEMETRY=off npx -y context-plugins install https://github.com/paypaldev/server-sdk-context-plugin-preview --targets claude --yes --force`. Claude disabled the old plugin (`claude plugin disable paypal@context-plugins`; still installed) and read all eight `typescript-*` SKILL.md files and their reference.md files completely from `~/.claude/plugins/cache/context-plugins-local/paypal/0.1.0/skills/typescript/` before writing code.
   - Why: the session cannot restart itself. Reading the installed files gives the same text the skills load. D1 still holds: the old plugin is disabled, not uninstalled.
2. **D3's latency rationale is wrong; the values stay.**
   - Plan said: "The 3 s budget keeps route latency bounded".
   - Found: `maximumRetryWaitTime` bounds only the waits between attempts. `timeout` is per attempt, so one call can take about 46.5 s in the worst case (two slow 5xx answers, then a third attempt that times out), against 15 s before. A timed-out attempt is never retried.
   - Chose: keep D3 and document the worst case in the contract sheet.
   - Why: it needs two slow 5xx answers in a row; a hung PayPal still ends the call after 15 s.
3. **D3 does not retry a 500 on most operations.**
   - Plan said: retry 429, 500, 502, 503 and 504 on GET and POST.
   - Found (independent review, confirmed in `@apimatic/core` `requestBuilder.js:49-52` and the controllers): a status the operation declares with `throwOn` is thrown inside the retry interceptor and, with `retryOnTimeout: false`, never retried. `captureOrder`, `authorizeOrder` and every `PaymentsController` operation declare 500, so only `createOrder` and `getOrder` retry a 500. 502, 503, 504 and 429 are not declared anywhere and are retried.
   - Chose: keep the configuration; the contract sheet and the code comments state the real behaviour, and `client.test.ts` pins it. The finding joins the draft report to APIMatic (D10).
   - Why: the alternative, `retryOnTimeout: true`, re-sends every declared 4xx. A 500 on a capture goes to reconciliation, as before the change.
4. **Two adapter tests added outside `client.test.ts`; none changed.**
   - Plan said: `orders/payments/authorizations/invoices/webhooks` tests unchanged; a change must be justified here.
   - Chose: `authorizations.test.ts` gains one case, "a void answered without a body (204) reads the authorization instead". It covers the new null branch in `voidAuthorization`: the official SDK types `voidPayment`'s result as `PaymentAuthorization | null`. No existing case changed. An earlier edit to `payments.test.ts` was reverted: its 500 is declared and is not retried.
5. **No mock server change.**
   - Plan said: add a request counter and a "fail the next N requests" hook if missing.
   - Found: `requests`/`requestsTo` already record every request, and `injectNext` already queues one-shot answers, so N calls queue N failures.

### Phase 2

1. **Panel copy in Spanish constants, not `operator.ledger.*` keys in six locales.**
   - Plan said: i18n keys in es, ast, en, fr, de, pt; parity test and `npm run generate-locale-coverage`.
   - Found: the operator dashboard has no translation hook. Its copy is Spanish constants by design (`operator-dashboard.tsx`: "Merchant-facing copy is Spanish only: the operator is the Asturian provider").
   - Chose: Spanish constants beside the existing ones (`LEDGER_CHIP`, `LedgerSummary`). No locale files change, so `generate-locale-coverage` has nothing new to cover.
   - Why: keys for one section of a Spanish-only page would be the only translated text on it.
2. **Truncation note reworded.**
   - Plan said: "Mostrando los 500 movimientos más recientes".
   - Found: the search asks for page 1. Nothing in the SDK's documentation says page 1 holds the most recent movements (not verified against PayPal); the mock lists them oldest first.
   - Chose: "PayPal tiene más de 500 movimientos en el periodo: solo se comprobaron los primeros 500."
3. **Matcher refinements.**
   - Plan said: capture found with status S -> matches or refunded; status differs -> mismatch.
   - Chose: a capture PayPal lists as P (not settled) is `pending`, not `mismatch`; a refund listed as S or P counts as `refunded`.
   - Why: a not-yet-settled movement is lag, not disagreement; the warning chip is kept for real disagreement.
4. **`OperatorPayment.capturedAt` and the tests it touched.**
   - Plan said: add the capture time to `OperatorPayment` if the view lacks it.
   - Chose: `payments.captured_at` is selected and mapped. `operator.test.ts`, `operator.postgrest-integration.test.ts` and `operator-dashboard.test.tsx` fixtures gain the field, and one assertion now checks the mapping. No case's intent changed.
5. **The Postman runner issues an operator link.**
   - Plan said: add the search request to the collection and run `postman-local.test.ts`.
   - Found: the request needs an operator capability, and a capability only opens on a server with the same `BOOKING_LINK_SECRET`. The README gave `next dev` a random one.
   - Chose: the runner keeps a local secret in `$TMPDIR/paisaxe-postman/booking-link-secret` (created once, owner-only), issues an operator link for the fixture merchant through `create-operator-link.ts` in a child process, and fills `operatorCapability`. The README's `next dev` reads the same file, and the runner prints the exact `BOOKING_LINK_SECRET` line. A child process, not an import: `links.ts` is server-only, and `e2e/booking-global-setup.ts` imports the runner, so an import broke `typecheck:e2e` (seen in the first Phase 2 gate run). New request "08 Operator ledger".
   - Evidence: a full local Newman run, 27 of 27 requests and assertions passed, including 08.
6. **Route window and the dashboard test's fetch routing.**
   - The route searches 31 days less 5 s, because the adapter widens the window to whole seconds and PayPal refuses more than 31 days.
   - `operator-dashboard.test.tsx` routes `/paypal-ledger` to its own mock, so the existing tests' view and action call sequences are unchanged.
7. **A fully refunded capture (status V) is "refunded" (independent review, major).**
   - Plan said: capture found with status S -> matches or refunded; any other status -> mismatch.
   - Found: the SDK documents V as "A successful transaction was fully reversed and funds were refunded to the original sender" (`TransactionInformation.transactionStatus`), so the plan's rule would show "No coincide con PayPal" after every full refund. Whether the sandbox marks the T0006 entry V is not verified yet (the permission was still pending).
   - Chose: V with the deposit's amount and currency -> `refunded`, with or without a listed refund entry. The mock now lists a fully refunded capture as V, so the tests exercise it.
8. **Smaller choices not in the plan.**
   - `searchTransactions(start: Date, end: Date)`, positional, instead of `({ start, end })`.
   - The summary counts `refunded` as confirmed: "PayPal confirma N de M" counts deposits whose PayPal records agree, refunded or not.
   - The route logs `not_authorized` and `not_configured` with `warn` (setup states) and everything else with `error`; all under `[OPERATOR_LEDGER_FAILED]`.
   - The mock answers 400 `INVALID_DATE_RANGE` for an unreadable or over-31-day window (PayPal's own error name not verified).
   - The Postman runner adds a local `operator_access` row on every start, as it already does a voucher (local database only). The secret file lives beside `--out`; the README's path is the default `--out`.
   - Layout (review): while the first check loads, the summary keeps its height (and a phone's two-line height), the button is shown `aria-disabled`, and each captured deposit keeps an invisible placeholder chip, so nothing moves when the answer arrives. `aria-disabled` rather than `disabled`, so keyboard focus stays on the button. PayPal's refresh time shows a date when it is not from the view's day.
9. **Simplify pass (4 angles).**
   - Applied: the route reads only experiences and bookings (`loadOperatorBookings`, shared with the view through `bookingsOf`) instead of the whole view with its holds and 14 days of availability; `MAX_SEARCH_RANGE_MS` exported from the adapter and the route's window derived from it (less 2 s); `matchLedger` takes a `Date`; the matcher's not-listed branch is one comparison; `LedgerBooking` derived from `OperatorBooking`; one `matches` prop (null while loading) instead of two; a shared pill style for "Incidencia" and the chips; the mock's status table and a hoisted lookup; the runner's label computed once.
   - Skipped: moving `madridDate` into `booking-format.ts` (it broke `typecheck:e2e`, whose tsconfig has no `@/` paths; importing it from `booking/types` would add zod to the operator page bundle, so the page keeps a one-line copy with a comment); an index for the matcher (500 movements at most); narrowing the window to the oldest capture (changes behaviour); an `operatorCapability` helper in `links.ts` (the runner now parses the script's printed link instead).
10. **D9: the sandbox permission is set; PayPal has not applied it yet.**
   - First read-only search (sandbox, last 7 days): token 200 without a reporting scope, then search 403, `name` and `details[0].issue` both `NOT_AUTHORIZED` (debug id `f636297435446`). The mock's 403 now copies that body; it had assumed `PERMISSION_DENIED`.
   - The developer dashboard needed the owner's PayPal login (Claude does not enter passwords). The owner signed in. Claude ticked "Transaction search" on the Sandbox app "Default Application" (client id prefix matches `.env.local`), saved ("Application was saved successfully.", 2026-10-08 06:31 UTC) and never opened the Live tab. Screenshot kept outside the repository (scratchpad `sandbox-check/transaction-search-enabled-2026-10-08.png`), because it shows the owner's name.
   - A search with a new token right after still answered 403 (debug id `f965925a195b0`), the token again without a reporting scope. Retried in Phase 3.

### Phase 3

1. **Sandbox acceptance over HTTP, the owner approving in their own browser.**
   - Plan said: book and pay a deposit on the local app (as on 2026-10-07, through the chat).
   - Found: the first browser attempt hit a real bug (item 2). After the fix, the automation tab's
     requests did not reach the server and the tab froze twice.
   - Chose: the Postman collection for the booking (folders 00 to 04 with the local runner), then
     the payment, capture and cancellation requests. The owner approved the order as the sandbox
     buyer in their own browser, and their return page captured it. Same SDK paths; record in
     `2026-10-08-apimatic-official-sdk-phases/sandbox-acceptance-2026-10-08.md`.
2. **Development CSP and an isolated Supabase stack (bug found and fixed, outside the plan).**
   - Found: `src/lib/proxy/csp.ts` allowed a local Supabase only on port 54321 in development, so a
     browser on an isolated stack (the release checklist's procedure, ports 548xx here) could not
     start a guest session.
   - Chose: in development only, allow the loopback origin (http and ws) of
     `NEXT_PUBLIC_SUPABASE_URL` (through `getSupabaseUrl()`), which replaces the fixed 54321 list
     (simplify, altitude): the browser's Supabase client only ever calls that URL, so a default
     stack is still allowed and an isolated one now is. Tests in `src/lib/security-headers.test.ts`
     cover 127.0.0.1 and localhost on 54321, another port, production, a hosted project, a
     non-loopback host and an unreadable URL. Production CSP is unchanged.
   - Simplify skipped: one shared loopback helper for the proxy, `paypal/env.ts` and `zapier.ts`
     (outside this diff, and those copies disagree on `[::1]`).
3. **The mock now lists Transaction Search in the sandbox's own shapes.**
   - Found (sandbox, 2026-10-08, the 2026-10-07 deposits): a fully refunded capture stays `T0006` /
     `S` (with a `paypal_reference_id` of type `TXN` to another transaction id, not its order), the refund is its own `T1107` / `S` with
     `paypal_reference_id` = the capture, and `last_refreshed_datetime` ends in `Z`. No `V`.
   - Chose: the mock lists that, leaving the capture's own reference out (the adapter does not use it); `transactions.test.ts` expects it.
   - Correction: a first version of this item, the acceptance record and the mock said the capture's reference was its order, of type `ODR`. That came from a listing that did not print the type; the re-listing (scratchpad `sandbox-check/list-2.log`) shows `TXN` and a reference that is not the order. All three were corrected. The matcher keeps its
     V rule (Phase 2 deviation 7), because the SDK documents V, but nothing observed sends it.
     Phase 2 deviation 7's premise ("would show No coincide after every full refund") was therefore
     wrong for the sandbox: the S capture plus the T1107 refund already gave "refunded".
4. **Testing instructions mention the panel's PayPal check before the release.**
   - `docs/hackathon/testing-instructions.md` describes production. The check reaches production
     only with the next release; until then the line describes a feature the live site lacks.
5. **The plan's manual criterion is met in part.**
   - Plan said: one deposit "visible as 'PayPal confirma' in the operator panel once PayPal lists it, then refunded; screenshots for the evidence page".
   - Found: the deposit was refunded two minutes after the capture, before PayPal listed either, so it can only ever show "Pendiente en PayPal" and then "Reembolso en PayPal". "PayPal confirma" against the real sandbox would need a second deposit that is kept (another approval by the owner).
   - Screenshots stay in the scratchpad, not the repository: the PayPal dashboard one shows the owner's name; the panel and confirmation ones are recorded by path in the acceptance record.
6. **The phone-confirmation race test asserted one interleaving; it now asserts the design's guarantee.**
   - Found: the pre-commit suite on Phase 3's tree failed it again, now with the detail: both concurrent settlements returned "confirmed". `settlePhonePayment` sends a payment it reads as `capture_pending` to `resolveAuthorizationCapture`, which reads the order and, when PayPal has not captured yet, captures again with the same PayPal-Request-Id ("a retry reuses the same key, so never a second capture"). So the second settlement reports "unchanged" only if it read the payment before the first one's claim. The official SDK's slower call path made the other order more frequent; the race itself predates this work.
   - Chose: the test asserts one capture at PayPal (`mock.captures.size` 1), one request id on every capture request, the booking confirmed, and one "confirmed" with the other "confirmed" or "unchanged". 5 of 5 runs passed. No production code changed. This resolves the Phase 2 handoff's open "two settlements racing…" finding.
7. **Measured PayPal lag.** The sandbox's `last_refreshed_datetime` trailed the clock by about
   1 h 45 min to 2 h (07:26 UTC -> 05:29:59Z; 07:45 UTC -> 05:59:59Z).

## Handoff

### Phase 1 (2026-10-08)

- Worktree `../paisaxe-apimatic-sdk`, branch `feature/apimatic-sdk`, base `develop` at
  `7d3da0bc` (the plan commit). Phase 1 is one commit on top; its tree hash is in the
  commit's Phase 2 entry below.
- Gates on the final Phase 1 tree, run in order, each exit status kept:
  `npm run typecheck` 0, `npm run lint` 0, `npx knip` 0, `npm run lint:deps` 0,
  `npm run check-licenses` 0, `npx vitest run --maxWorkers=4` 0 (510 files, 9542 tests),
  the booking `*.postgrest-integration` suites plus `scripts/booking/postman-local.test.ts`
  on an isolated local stack 0 (10 files, 197 tests), `npm run build` 0,
  `npm run check-bundle-budget` 0 (39 routes within budget),
  `npx playwright test --project=release-required-local`: **1 failed**, then 1 of 1 and
  3 of 3 passed.
- The failure: the first run's `booking-roundtrip` timed out waiting for the quote card.
  The guest's chat message never rendered, before any PayPal call, on a cold
  `next dev`. The test alone and the whole project then passed twice, including
  capture and refund through the official SDK. Recorded as a cold-start flake in the
  chat step, not caused by this change; no issue filed (external action).
- Isolated stack: `scratchpad/sb` copy of `supabase/`, `project_id = "paisaxe-apimatic"`,
  ports 548xx (`54821` API, `54822` DB), because `paisaxe` and
  `paisaxe-issues-phase2` stacks belong to other sessions. E2E ran with
  `SUPABASE_LOCAL_API_URL`, `SUPABASE_LOCAL_DB_CONTAINER`, `PLAYWRIGHT_PORT=3110`,
  `PLAYWRIGHT_REUSE_SERVER=false`.
- Phase 2 entry: Phase 1 committed on the branch; the Transaction Search controller is
  `TransactionSearchController.searchTransactions` (contract sheet, Operations).

### Phase 2 (2026-10-08)

- Same worktree and branch, on Phase 1's commit `1e4ded3b`. One owner (the parent session) for every
  unit, in this order: shared contract, adapter and mock, matcher, operator data and route, panel,
  Postman, sandbox permission. No parallel implementers: the units share `types.ts` and the mock.
- Capture time: `OperatorPayment.capturedAt` from `payments.captured_at` (a new field, as the plan
  allowed).
- Sandbox permission: set on the Sandbox app at 06:31 UTC (deviation 10). Read-only searches at 06:31, 06:35
  and 06:50 UTC still answered 403 `NOT_AUTHORIZED`. Phase 3 retries.
- Screenshots (outside the repository, scratchpad `shots/`): `operator-ledger-{ok,pending,unavailable}-{390,1280}.png`,
  taken with the API answers mocked in the browser and `next dev` on 3120 without the hosted database.
- Review: an independent reviewer did not approve the first round (1 major: a V capture after a full refund
  would have shown "No coincide con PayPal"; 5 minor; 2 nits), then approved after fixes. Simplify: deviation 9.
- Gates on the final Phase 2 tree, run in order, every exit status kept:
  - `npm run typecheck`: first run **failed** (`typecheck:e2e`: the runner imported `links.ts` and `types.ts`
    imported `booking-format`, neither resolvable from `e2e/tsconfig.json`), fixed (deviation 5), then 0.
  - `npm run lint` 0, `npx knip` 0, `npm run lint:deps` 0, `npm run check-licenses` 0,
    `npm run generate-locale-coverage` 0 (no file changed), `npm run build` 0,
    `npm run check-bundle-budget` 0.
  - `npx vitest run --maxWorkers=4`: 0 (513 files, 9593 tests), then after the runner fix **1 failed**
    (`scripts/lib/qa-journey.test.ts`, "startup timeout has a retained log": the log lacked "booting"; a
    timing test this change does not touch), which passed 3 of 3 alone.
  - Booking `*.postgrest-integration` plus `postman-local.test.ts` on the isolated stack:
    - First run **failed** in `booking.postgrest-integration.test.ts`: the fixture merchant had more than
      one `operator_access` row, left by this session's Newman runs. Fixed: the runner deletes its own
      `postman-local-*` links at start and on stop (`removeRunnerOperatorAccess`, tested), and the leftover
      rows in the isolated stack were deleted.
    - Then **1 failed** in `reconcile.postgrest-integration.test.ts` ("expires lapsed holds…": the
      expired-holds count was 0; other files' reconciliation expires holds too). Passed 31 of 31 alone.
    - Then **1 failed** in `phone-confirmation.postgrest-integration.test.ts` ("two settlements racing…").
      Its output was not captured; it passed 14 of 14 alone, then 200 of 200 in three full runs.
      Cause found in Phase 3 (deviation 6): the test asserted one of two safe interleavings.
  - `npx playwright test --project=release-required-local`: 3 of 3, then after the runner fix
    **1 failed** (`booking-roundtrip`: the quote card never appeared; the server log shows the
    message reached the ordinary chat route, before any PayPal call), then 3 of 3. The same step
    failed once in Phase 1. Cause unknown: an open finding for the owner (cold `next dev`).
  - Newman (local runner, `next dev` on 3006, mock): 27 of 27 requests and assertions, twice (before and
    after the runner fix), including "08 Operator ledger".
- Phase 3 entry: Phase 2 committed on the branch; the sandbox permission retried before the acceptance.
