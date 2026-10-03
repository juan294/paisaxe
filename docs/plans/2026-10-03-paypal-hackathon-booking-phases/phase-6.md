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
