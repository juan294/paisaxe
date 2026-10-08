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
