# Phase 6: Hardening, probes, publication cleanup, release candidate

**Window:** 2026-10-31 to 11-03 (candidate freeze on Nov 3)
**Revision 2:** access-boundary probe (F10), production webhook provisioning (F11), freeze date reconciled with Phase 8 (F12), ElevenLabs limit and evaluation re-run (F13, F07)
**Worktree:** `../paisaxe-hackathon-phase6` on `chore/hackathon-release-prep` from `develop` (after Phase 5 merged)
**Depends on:** Phase 5 accepted
**Batch-eligible units:** `[cleanup]` (license, notice, workflow guard, `.gitignore`, docs) and `[probes]` (manifest, Playwright specs, E2E journey) share no files.

## Goal

The candidate passes every local gate and the release gates, the repository is ready
to be made public, and judges have English instructions. No production action here.

## Unit [cleanup] (research section 12, decisions R5 and R13)

1. `LICENSE`: MIT text, copyright "2026 Juan Gonzalez", matching `README.md:270-272`.
2. `README.md`: under License, the existing sentence that MIT covers the code only
   (added in #984) stays; add a "Hackathon" section in English: what the booking
   feature is, the fixture merchant and sandbox labels, setup for a fresh clone
   (Docker Supabase, migrations, voucher script, PayPal sandbox env), the change
   summary since baseline `d368b2b3` (link to the ADR), and known limitations.
3. `.github/workflows/claude-review.yml`: add to the job `if:` at `:17-24` an author
   association check for the comment trigger
   (`contains(fromJSON('["OWNER","MEMBER","COLLABORATOR"]'), github.event.comment.author_association)`).
4. `.gitignore`: add `docs/agents/`, `logs/`, `scripts/agents/` (Rule #70 for public
   repositories); `git rm -r --cached docs/agents` (23 tracked files). Keep local copies.
   Check `scripts/*.sh` and the triage skill still write to those paths without failing
   on an untracked folder.
5. `docs/hackathon/testing-instructions.md`: the English text to paste into the Devpost
   private testing field, with placeholders only for the voucher code, the sandbox
   buyer email and password, and the operator link, which the owner fills in at
   submission. Everything else complete.
6. Research doc: commit `docs/research/2026-10-02-paypal-ai-hackathon-proposal-assessment.md`
   as it stands (default), unless the owner asks for the publisher quotation and the
   accepted-risk wording in section 12 to be trimmed first. It was still untracked on
   2026-10-03.

## Unit [probes]

1. `quality/required-probes.yaml`: add
   - `booking-gate-closed`, tier `deployed-readonly`, Playwright project
     `release-required`, selector `@release-required booking-gate-closed`: a
     nonexistent capability returns 404 and `/acceso` renders the code form. This is a
     route check only; a 404 for a nonexistent token does not prove the boundary (F10).
   - `booking-access-boundary`, tier `local-docker`, project `release-required-local`,
     selector `@local-docker booking-access-boundary`: with seeded fixtures, a valid
     capability with no cookies opens its booking; another user's booking id is 404 in
     the chat tool route; a session without a redemption is 404 on the chat route; the
     same requests with `VERCEL_ENV=preview` are 404. Each assertion fails if its gate
     is removed.
   - `booking-roundtrip`, tier `local-docker`, project `release-required-local`,
     selector `@local-docker booking-roundtrip`: voucher → chat (model mocked at the
     route boundary by `ANTHROPIC_TRANSPORT=mock` fixture that replays a recorded tool
     sequence) → accept → PayPal mock server approval → return → confirmed → operator
     view → cancel → refunded. Cleanup oracle deletes the fixture booking rows it created.
2. `e2e/release-required.spec.ts` and a new `e2e/booking-roundtrip.spec.ts`; the
   Playwright webServer env (`playwright.config.ts:196-213`) gains `PAYPAL_API_BASE`
   pointing at the mock server started by a global setup.
3. `scripts/release/required-probes.test.ts` and `analyze-release-run.test.ts` updated
   for the new ids; `npm run check-required-probes` passes.
4. Env: `scripts/check-env.ts` passes with the PayPal vars and `BOOKING_LINK_SECRET` in
   `.env.example`; owner is asked (authorization) to add `PAYPAL_CLIENT_ID`,
   `PAYPAL_CLIENT_SECRET`, `PAYPAL_API_BASE`, `PAYPAL_WEBHOOK_ID` and
   `BOOKING_LINK_SECRET` to the Vercel Production and Preview scopes; the agent sets the
   non-secret `PAYPAL_API_BASE` via `vercel env add` once authorized.
5. **Production webhook listener (F11; owner-authorized, external).** The tunnel
   listener from Phase 0 is not the production one. In the PayPal sandbox app, create
   a webhook for `https://paisaxe.es/api/webhooks/paypal` subscribed to exactly the
   events the Phase 4 handler processes, and put *its* id in `PAYPAL_WEBHOOK_ID` for
   Production. Record the listener URL, the subscribed events and the id's last four
   characters in the phase evidence. Until the release the listener will receive 404s;
   that is expected.
6. **ElevenLabs spending backstop (F13).** The 50-redemption cap limits distinct guest
   identities only: an existing identity renews its 24-hour pass without consuming a
   redemption, and the 10-per-minute session limit bounds session starts, not minutes.
   The workspace limit is therefore the only real stop, and it is an assumption until
   verified. The owner records in the phase evidence: the configured limit; whether it
   **stops** usage or only alerts; whether overage billing can still occur (the overage
   decision was deferred on 2026-08-30); and what a paying voice-pass user experiences
   when the limit is reached. If it does not stop spending, the plan's fallback is to
   issue judge vouchers without the voice pass.

## Hardening checklist

- Rate limits on every new POST route; `limit_reached` and `not_configured` paths
  covered by tests.
- Re-run `npm run eval:booking` on the candidate; the six scenarios must pass before
  any video take (F07).
- Largest friction from the Phase 5b validation fixed or listed under known limitations.
- `npm run knip` clean; no unused exports in `src/lib/booking` or `src/lib/paypal`.
- Lighthouse budgets unaffected (`/booking/[token]` is server-rendered and light).
- Log markers documented in `docs/operations/alerting-runbook.md`: `[PAYPAL_WEBHOOK_INVALID]`,
  `[PAYPAL_CAPTURE_MISMATCH]`, `[CRON_RECONCILE_ATTENTION]`, `[VOUCHER_GRANT_FAILED]`.
- `docs/operations/operations.md` cron table includes `reconcile-bookings`.

## Release candidate

Follow `docs/runbooks/release-checklist.md` sections 1 and 2 as amended in Phase 0:
`npm run what-would-ship`, full suite with `--maxWorkers=4`, typecheck, lint,
`check-migrations`, `check-required-probes`, `check-env`, `npm run prelaunch`, the
mutating probes on local Docker, and the six security gates in
`docs/operations/pre-launch-security-checklist.md`. Record the candidate tree hash.
Freeze the
candidate on Nov 3; anything from Phase 8 not merged by then is left out. Present the
summary and stop.

## Acceptance gate

Automated: everything in the release candidate list green locally; CI green on
`develop` after the single authorized push of the merged phase.

Manual: fresh-clone rehearsal in a temporary directory following the README
instructions, with Docker Supabase, reaching a confirmed fixture booking against the
PayPal mock server. Record the time taken.

Stop for acceptance. Phase 7 is a separate conversation per `CLAUDE.md`.

## Handoff (2026-10-03)

**Status:** units [cleanup] and [probes] and the hardening checklist implemented; independently
reviewed (CHANGES REQUESTED, one major fixed and one recorded as an owner decision; re-review
**APPROVE**), simplified, and verified by the local gate, the release-candidate steps that need no
owner credential, and a fresh-clone rehearsal. Committed on `chore/hackathon-release-prep`
(`38e5a09a`, then this docs commit); **not merged into `develop`, not pushed**.

- **Scope delivered:** MIT `LICENSE`; README "Hackathon" section; `docs/hackathon/testing-instructions.md` (owner fills four placeholders at submission); `claude-review.yml` author-association guard; `docs/agents/` untracked (Rule #70); release probes `booking-gate-closed`, `booking-access-boundary`, `booking-roundtrip` with the local-only `BOOKING_AGENT_REPLAY` model; rate limits on quote accept and the PayPal webhook; the PayPal section of the alerting runbook; the release checklist's local-probe command; evaluation re-run.
- **Identity:** branch `chore/hackathon-release-prep` in `/Users/juan/code/paisaxe-hackathon-phase6`, based on `develop` `0392481d`; the commit carrying this handoff is the candidate (its tree is recorded in the release step after the merge, per the checklist's section 1).
- **Gate evidence (local, on the candidate's code; this commit adds documentation only):**
  - `supabase db reset --local` 0; `typecheck` 0; e2e and scripts typechecks 0; `lint` 0; `knip` 0; `check-env` 0; `check-verification-coverage` 0; `check-migrations` 0 (121 files); `check-required-probes` 0 (14 probes, selection matches); `lint:deps` 0 after the cycle fix (deviation 11).
  - Full suite: 486 files, 9,052 tests passed (also in the pre-commit hook of `38e5a09a`); CI conditions: 8,876 passed, 176 skipped, coverage 98.16 / 95.69 / 97.96 / 98.83 % (thresholds 97 / 95 / 97 / 97); `next build` 0.
  - `npm run what-would-ship`: Phases 0 to 5 and three housekeeping commits since `90befd3c` (Phase 6 joins on merge).
  - `npm run prelaunch`: every step passes; its browser E2E passes 366 tests and stops only at the authenticated QA journey, which refuses to skip without the owner's QA credentials.
  - `release-required-local` (the checklist command, a local QA user): **3 passed** (`favorite-roundtrip`, `booking-access-boundary`, `booking-roundtrip`).
  - `booking-gate-closed` against a local dev server: passed with the flag on (code form) and with it off (real 404); the flag was restored on.
  - Security gates: **1** `gitleaks detect` over 2,883 commits and over the changed files: no leaks; **3** all eight cron routes 401 without the secret; **4** MCP places (GET, POST) and weather 401; **5** Stripe webhook 401 without a signature (and the PayPal webhook 401 unsigned) — 3 to 5 against a local production build of the candidate, not paisaxe.es, which still runs the previous release. **2** (admin as non-admin) and **6** (`prelaunch:live`) need the owner's QA and Stripe test credentials.
  - Evaluation (F07): 6 of 6 with the real model (`docs/hackathon/evaluation/2026-10-03-phase6.json`).
  - **Fresh-clone rehearsal** (acceptance gate): a clone of `38e5a09a` following only the README (install, `supabase start`, `db reset`, the Postman runner, `next dev` with local variables, Newman) reached a confirmed booking and the whole journey (26 requests, 26 assertions, 0 failures) in **79 seconds**, with Docker images and the npm cache already warm.
- **Deviations, review, simplify:** notes file, "Phase 6" (1 to 12), "Phase 6 review dispositions", "Phase 6 simplify pass".
- **Owner actions open for this phase's acceptance:**
  - **Authorization to push `develop`** after the merge (the acceptance gate's "CI green on develop after the single authorized push"); nothing from Phases 1 to 6 is on GitHub yet.
  - Security gates 2 and 6, and the authenticated QA journey of `prelaunch`, with your QA and Stripe test credentials.
  - Vercel environment variables (`PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_API_BASE`, `PAYPAL_WEBHOOK_ID`, `BOOKING_LINK_SECRET`) in Production and Preview; the agent can set the non-secret `PAYPAL_API_BASE` once authorized (F11 item 4).
  - The production webhook listener in the PayPal sandbox app (`https://paisaxe.es/api/webhooks/paypal`, the events the handler processes), its id in `PAYPAL_WEBHOOK_ID`; record the URL, events and the id's last four characters here (F11).
  - The ElevenLabs workspace limit: the configured value, whether it stops usage or only alerts, whether overage billing can still occur, and what a paying voice-pass user sees at the limit (F13); if it does not stop spending, issue judge vouchers without the voice pass.
  - Publication decisions: `docs/agents/` history (purge or accept) and whether to move the ElevenLabs reference documents to a tracked folder before the repository goes public.
- **Owner-item progress (2026-10-06, owner said "go ahead with all pending items"):**
  - **Push of `develop`:** done 2026-10-05 (`9db8d0ca`, Phases 0 to 8); CI, E2E, Security, Knip and Lighthouse green on that commit.
  - **Gate 2: PASS** (2026-10-06 05:01 UTC, paisaxe.es): as the QA user (password grant, Supabase session cookie), `/api/admin/analytics`, `/stories` and `/agent-reports` each returned 403 "Admin access required"; without a cookie, 401. A bearer token is not read by `validateAdminAuth` (it returned 401), so the checklist now gives the cookie method.
  - **Gate 6: not run.** The Stripe CLI holds a test-mode key for the same account (`acct_…PLY7`), and a test price "Paisaxe Day Pass (gate 6 local test)" (199 EUR, `price_1UM83kL06M9hPLY7UPRTKo4V`) exists but is archived. The agent's run was refused by its permission policy (it reactivates a Stripe object and writes a purchase row to production Supabase), so the owner runs it.
  - **PayPal production webhook listener (F11): created** in the sandbox app through the REST API: `https://paisaxe.es/api/webhooks/paypal`, events `CHECKOUT.ORDER.APPROVED`, `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.PENDING`, `PAYMENT.CAPTURE.DENIED`, `PAYMENT.CAPTURE.REFUNDED`, `INVOICING.INVOICE.PAID`, `INVOICING.INVOICE.CANCELLED` (the last two for Phase 8a); id ends `4326`. Deliveries fail until the release ships the route.
  - **Vercel environment variables: set** in Production and Preview: `PAYPAL_API_BASE` (sandbox), `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID` (the listener above), `BOOKING_LINK_SECRET` (generated, a different value per environment). They apply at the next deployment. `vercel env add … preview` loops on `git_branch_required` in non-interactive mode (CLI 50.23.2), so Preview went through the REST API.
  - **ElevenLabs limit (F13):** Creator tier, 44,703 of 100,000 characters used; `can_extend_character_limit` true with up to 250,000 extra characters, so the limit does **not** stop spending. Per this handoff, judge vouchers are issued without the voice pass unless the owner turns usage-based billing off.
  - **Production anonymous sign-in: off** (`/auth/v1/settings` reports `anonymous_users: false`). Enable it at release time, after the booking migrations are applied, not before: anonymous users carry the `authenticated` role, so the current production policies would apply to them.
  - **`docs/agents/` history:** 25 files across 414 commits; gitleaks clean. Content includes the owner's own email and personal subscription costs (cost-analyst and subscription-optimizer reports) and past security reports. Owner decision: purge or accept.
  - **RAG release blocker:** the production vector-index drift recorded on 2026-10-03 is fixed (HNSW `m=16, ef_construction=64`; `match_chunks` sets `hnsw.ef_search`). The query-embedding fix ships with the release; `chat-smoke` is re-checked then.
- **Entry conditions for Phase 7:**
  - Phase 7 runs the read-only probes before it turns the flag on; `booking-gate-closed` follows the deployed flag. A failure within about three minutes of a flag flip is cache lag: re-run before investigating. Never point it at a Preview.
  - Merging this phase into a checkout where `docs/agents/` is tracked deletes those files from its working tree: back the folder up first and restore it afterwards (they then stay as ignored local copies).
  - Run the CI-conditions coverage command before any push.
