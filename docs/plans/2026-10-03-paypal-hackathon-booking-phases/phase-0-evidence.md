# Phase 0 evidence

Recorded 2026-10-03. Worktree `../paisaxe-hackathon-phase0`, branch `chore/hackathon-phase-0`,
base `51140e54`. Raw evidence: `scripts/spikes/*.json` (ids and statuses only, no secrets).
The follow-up record `scripts/spikes/paypal-followup-evidence.json` was read from PayPal's API
at 14:15 UTC, after both runs, by `scripts/spikes/paypal-followup.ts`; it backs the capture
counts, the token lifetime and the event creation times below (review findings P0-07 to P0-09).

**Correction (2026-10-03, during review).** An earlier version of this file said PayPal never
generated `PAYMENT.CAPTURE.COMPLETED` for the run 2 capture. That was wrong: PayPal's event
log shows it was generated at 14:08:33.669 UTC, about 90 seconds after the capture and after
the refund event, and it was not delivered before the script stopped listening. The earlier
check had queried the event log too soon. The findings below are re-derived from the
recorded event log.

## Unit [docs]

| Item | Result | Where |
| --- | --- | --- |
| ADR | Written: ADR-0024, all 13 owner decisions by number, P1 to P5 | `docs/decisions/0024-conversational-experience-booking.md` |
| Charter | "Not a booking engine", "Not a business", values 1 and 4 rewritten to the new boundary; the strings "no hotels, flights, or transactions" and "no monetization" are gone | `docs/project/project-charter.md:67`, `:71`, `:96`, `:99` |
| Release checklist | Preview exception in section 3; new section 5b, owner-authorized production acceptance step; probes stay read-only | `docs/runbooks/release-checklist.md` |
| CLAUDE.md | One paragraph pointing at both rulings | `CLAUDE.md`, Release Process |
| Ops doc | `fail-stale-bookings` marks rows `orphaned` | `docs/operations/operations.md:207` |
| Guard tests | Three assertions, verified to fail against the pre-change files and pass after | `scripts/release/release-topology.test.ts` |

## Unit [spike]: Anthropic SDK streaming tool use

Evidence: `scripts/spikes/tool-stream-evidence.json`. Model `claude-sonnet-5` (`CHAT_MODEL`).

| Observation | Value |
| --- | --- |
| Event sequence, iteration 1 | `message_start`, `content_block_start(tool_use)`, 7 × `input_json_delta`, `content_block_stop`, `message_delta(tool_use)`, `message_stop` |
| Tool input | Parsed and validated with zod; valid |
| Iteration 2 | `content_block_start(text)`, 14 × `text_delta`, `end_turn` |
| Final answer | "Total 120 €, depósito 30 €, resto 90 €", taken from the tool result only |
| Thinking blocks | No thinking configured, matching the chat route (`src/lib/claude.ts:127-134`); none returned |
| Latency | 2.9 s for both iterations |
| Transport decision | SDK works standalone. The Turbopack question is moved to Phase 3 (deviation 3 in the notes) |

## Unit [spike]: PayPal sandbox cycle

Sandbox app "Default Application", Spanish business (seller) and personal (buyer) test
accounts, created 2026-10-03 15:46 with the owner's developer access. Webhook listener on a
temporary Cloudflare tunnel, subscribed to all events for discovery.

### Run 1: buyer approves and returns (`paypal-evidence-return.json`)

| Step | Result |
| --- | --- |
| Create order | `36415640D9739262C`, `PAYER_ACTION_REQUIRED`, 30.00 EUR |
| `getOrder` after approval, before capture | `APPROVED` |
| Capture (`PayPal-Request-Id = capture:<key>`) | HTTP 201, order `COMPLETED`, capture `35T447784Y573942U` `COMPLETED` |
| Capture again, same request id | HTTP 201, same capture id |
| Capture again, **new** request id | HTTP 201, no error body. The order has exactly one capture: `captureCount: 1` in `paypal-followup-evidence.json` |
| Refund (full) | HTTP 201, refund `2CJ83531DN903580J` `COMPLETED`; `getCapture` then `REFUNDED`; `getRefund` `COMPLETED` |
| Webhooks received, all `verification_status = SUCCESS` | `CHECKOUT.ORDER.APPROVED`, `PAYMENT.CAPTURE.REFUNDED`, `PAYMENT.CAPTURE.COMPLETED`, in that arrival order (+381.3 s, +382.1 s, +383.1 s) |
| Event creation times (PayPal event log) | capture completed 14:03:29.018, refunded 14:03:32.542, order approved 14:03:33.006 |

### Run 2: capture from the server on the approval webhook (`paypal-evidence-server-capture.json`)

| Step | Result |
| --- | --- |
| Create order | `5E496120FM196690K` |
| Buyer approval | The browser redirect reached the return page before the tab could be closed (+86.9 s). The script ignores the return in this mode and waits only for the webhook, so the capture below was still driven by the webhook alone. The tab was not actually closed before the return (deviation 6 in the notes) |
| `CHECKOUT.ORDER.APPROVED` webhook | Arrived +100.1 s, about 13 s after approval, verified `SUCCESS` |
| Capture triggered by the webhook | `getOrder` `APPROVED`, capture `55C1718857335004P` `COMPLETED` |
| Same-id and new-id re-capture | Same capture id; no second capture |
| Refund | `9C560786T0139705C` `COMPLETED` |
| Webhooks received within the run (until +197.7 s) | `CHECKOUT.ORDER.APPROVED` (+100.1 s), `PAYMENT.CAPTURE.REFUNDED` (+123.2 s), both `SUCCESS` |
| Event creation times (PayPal event log) | order approved 14:07:02.449, refunded 14:07:13.484, **capture completed 14:08:33.669**, about 90 s after the capture and 80 s after the refund event; not delivered before the script stopped |

### Findings that bind Phase 4

1. **Event names confirmed:** `CHECKOUT.ORDER.APPROVED`, `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.REFUNDED`. `PAYMENT.CAPTURE.PENDING` and `PAYMENT.CAPTURE.DENIED` did not occur in these runs and stay unverified.
2. **Notifications can be late by a minute or more.** In run 2, PayPal generated `PAYMENT.CAPTURE.COMPLETED` about 90 seconds after the capture, after the later refund event. A design that waits for that notification to confirm a booking would leave the visitor waiting. The capture API response and reconciliation through `getOrder` must be authoritative; the webhook is an accelerator and a backstop. This confirms the plan's design (main plan, Payments; findings F02, R2-02). These two runs do not show whether an event can be lost entirely.
3. **Out-of-order delivery and creation are real.** In run 1 the refund event arrived before the capture event; in run 2 the capture event was created after the refund event. Forward-only transitions are required (plan, Phase 4, `processPaypalEvent`).
4. **The approval event can come after the capture.** In run 1 PayPal created the approval event at 14:03:33.006, four seconds after the capture-completed event (14:03:29.018). The shared capture function must treat an already `COMPLETED` order as success, which the Phase 4 design requires.
5. **Recovery without the return page works.** The approval webhook alone carried the order to a completed capture in run 2.
6. **A capture with a new request id on a completed order returns HTTP 201, not `ORDER_ALREADY_CAPTURED`.** The adapter must handle both responses; neither creates a second capture.
7. **Approval-to-event delay** was about 13 to 16 seconds in the sandbox, measured from the return page as a proxy for the approval click (run 1: 16.2 s, run 2: 13.2 s).
8. **Access-token lifetime** is 32,400 seconds (9 hours) at issue; PayPal returns the same token while it is valid (31,811 s remaining at the follow-up read).

Not measured:

- How long an approved, uncaptured order stays capturable. Neither run left an order approved
  and uncaptured long enough. Phase 4's reconciliation tests cover it against the mock; a
  deliberate long-wait sandbox run is optional.
- Whether calling `verify-webhook-signature` a second time on the same event still returns
  `SUCCESS` (phase-0.md asked). The script did not keep the transmission headers. Phase 4 does
  not depend on it: the inbox stores the verified payload and the verification result at
  receipt, and replay processes the stored row without re-verifying (finding R2-04).
- Whether PayPal can drop an event entirely. Both runs' events were eventually generated.

## Early validation groundwork

| Item | Result |
| --- | --- |
| Provider message (Tier B) | Drafted in Spanish, WhatsApp and email versions: `docs/hackathon/validation/provider-message.md`. Owner sends by Oct 9 |
| Desk survey (Tier C) | Ten Asturias providers' public websites, every claim with its URL: `docs/hackathon/validation/provider-desk-survey.md` |

Desk survey counts, out of ten:

| Measure | Count |
| --- | --- |
| Online booking engine present (one is an external page linked from the site) | 7 |
| Online payment visible on the page | 3 |
| Deposit option shown | 1 |
| Real-time availability claimed by the provider | 1 |
| Physical accessibility information published | 0 |
| Cancellation policy published | 4 |
| Booking only by phone, WhatsApp, email or form | 3 |

## Not done in Phase 0, owner items

| Item | Status |
| --- | --- |
| AG Studio half-day trial (decision 6) | Not started; needs the owner's trial sign-up. Default if not done by Phase 5: native operator view |
| APIMatic plugin (`npx context-plugins install paypal`) | Not installed; it writes into every local AI assistant's configuration, so it waits for the owner's go-ahead |
| PayPal webinar Oct 6 18:00 Madrid; APIMatic webinar Oct 7 18:00 Madrid | Owner |

## Automated gate (phase-0.md acceptance)

| Check | Result | Candidate |
| --- | --- | --- |
| `npm run typecheck` (app, scripts, e2e, edge) | exit 0 | working tree after the review fixes, before the quality pass |
| `npm run lint` | exit 0 | same |
| `npm run check-migrations` | exit 0, 108 files | same |
| `npm run check-verification-coverage` | exit 0 | same |
| `npm run check-required-probes` | exit 0 | same |
| `npm run lint:scripts`, `typecheck:scripts`, `check-env` | exit 0 | final tree, after the quality pass (it changed only scripts, the guard test, `.env.example` and plan text) |
| `scripts/release/release-topology.test.ts` | 12 passed | final tree |
| Full suite, lint and Knip (pre-commit hook) | recorded in the handoff below | the final Phase 0 commit |

## Review dispositions

Independent plan-compliance review: APPROVE WITH FIXES, 20 findings (P0-01 to P0-20).
All fixed in this phase. P0-04 is fixed in `CLAUDE.md` as a project override rather than in
`.rpi/rules/deployment-safety.md`, `.claude/rules/deployment-safety.md` or `AGENTS.md`, which
are installed by the cc-rpi tooling and would be overwritten on the next install.

Quality pass (reuse, simplification, efficiency, altitude): applied the stronger CLAUDE.md
Preview guard and a single read of `CLAUDE.md` in the guard tests, a looser checklist
assertion, the `.env.example` comment that could be read as production permission, the
follow-up script's response checks, and two Phase 4 carry-forwards (exact sandbox-host check
in `src/lib/paypal/env.ts`; delete the spike PayPal scripts when the adapter lands). Skipped
as polish on throwaway, already-run spikes: a shared PayPal helper for the two spike scripts,
a response type alias, parallel reads, and token-cache simplification.

## Cleanup

The tunnel was stopped and its sandbox webhook deleted through the API after the runs. Phase 4
creates a new listener for its own tunnel; production gets its own listener in Phase 6.

## Handoff

- **Objective and scope:** Phase 0 of the plan, as amended by the review fixes above.
- **Identity:** worktree `/Users/juan/code/paisaxe-hackathon-phase0`, branch
  `chore/hackathon-phase-0`, base `51140e54` (local `develop`, one commit ahead of
  `origin/develop` at `bb225b2f`; that commit is another session's deploy-skill fix).
  Not merged, not pushed.
- **Completed:** both units, the early validation groundwork, the independent review and
  its fixes, the quality pass, and the automated gate above.
- **Not completed, owner items:** AG Studio half-day trial; APIMatic plugin install (awaits the
  owner's go-ahead because it writes into local AI assistant configuration); webinars on
  Oct 6 and Oct 7 at 18:00 Madrid; sending the provider message by Oct 9.
- **External state left behind:** sandbox app "Default Application" and two sandbox accounts;
  no webhooks; two fully refunded sandbox orders. Local `.env.local` holds the sandbox
  client id and secret, set by the owner; the Phase 0 webhook id is commented out.
- **Next phase entry conditions:** owner accepts Phase 0; this branch is merged into
  `develop` and pushed with green CI; Phase 1 starts in its own conversation from
  `develop`, re-checking the next free migration number.
