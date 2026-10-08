# Phase 3: evidence, acceptance and merge

**Plan:** [../2026-10-08-apimatic-official-sdk.md](../2026-10-08-apimatic-official-sdk.md)
**Entry:** Phase 2 accepted; same worktree and branch.
**Exit:** local merge into `develop`; the push waits for the owner's go-ahead.

## 1. Evidence page `docs/hackathon/apimatic.md` (English)

- What: the deck's plugin, the exact install command, plugin id/version/commit (Phase 1
  record), the SDK and version.
- How it shaped the code: a table of skill → file → what the skill decided (e.g.
  `typescript-configuration-resilience` → retry policy in `client.ts`;
  `typescript-error-handling` → `ApiError`/`CustomError` mapping;
  `typescript-getting-started` → exact pin and the value/type import split), with commit
  hashes and dates.
- Before/after: 2026-10-03 adapter on the earlier APIMatic plugin and the unpublished SDK
  copy; 2026-10-08 move to the official SDK. Three of the plugin's five APIs in use:
  Orders, Payments, Transaction Search.
- The retry finding: what we observed, the minimal reproduction (as in the plan's spike
  section), the setting we chose and the regression test. Mark it "draft report to
  APIMatic, not sent" (D10).
- Proof links: tests (`src/lib/paypal/*.test.ts`), the Postman collection, the sandbox
  acceptance record from step 3.

## 2. Draft answer for the submission form's plugin question

In `docs/hackathon/apimatic.md`, a short English answer (about 120 words) that names the
plugin, what we built with it, the three APIs, retries and typed errors, and the finding.
The exact form wording is unknown (Devpost returned 403 on 2026-10-07/08); recheck it in
Phase 7 of the parent plan and trim to fit.

Also: README tool list and `docs/hackathon/testing-instructions.md` mention the operator
panel's PayPal check; the parent notes get a pointer to this plan.

## 3. Sandbox acceptance (owner present)

On the local app against the real PayPal sandbox (same procedure as
`docs/plans/2026-10-03-paypal-hackathon-booking-phases/sandbox-acceptance-2026-10-07.md`,
local stack, never the hosted Supabase):

1. Book and pay a deposit; the owner approves as the sandbox buyer; return capture
   through the new SDK; booking confirmed.
2. Operator panel: the booking shows "Pendiente en PayPal" or "PayPal confirma"; recheck
   later until PayPal lists it (record the lag).
3. Cancel inside the window; refund through the new SDK; the panel shows "Reembolso en
   PayPal" once listed.
4. Record order, capture and refund ids, debug ids, and screenshots in
   `docs/plans/2026-10-08-apimatic-official-sdk-phases/sandbox-acceptance-2026-10-08.md`.

## 4. Gates, merge, cleanup

- All automated gates on the final tree, then
  `npx playwright test --project=release-required-local` and
  `CI=true npm run test:e2e:release-artifact`, `npm run eval:booking` once.
- Design sync: only if a shared design-system component changed (the operator panel is not
  in the synced set); otherwise record "not needed".
- Merge `feature/apimatic-sdk` into `develop` locally, remove the worktree and branch,
  re-run the suite on the merged tree if `develop` moved.
- Close #1013 only after the authorized push and green CI.
- Stop: ask the owner for the single push of `develop`.
