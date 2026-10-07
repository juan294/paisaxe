# Phase 0: Decisions on record, sandbox spike, tool-stream spike

**Window:** 2026-10-03 to 10-08
**Worktree:** `../paisaxe-hackathon-phase0` on `chore/hackathon-phase-0` from `develop`
**Depends on:** plan acceptance
**Batch-eligible units:** `[docs]` and `[spike]` share no files and may run in two worktrees; one integration owner merges `[docs]` first.

## Goal

Make the recorded decisions binding in the files that govern work, and prove the two
integration assumptions the rest of the plan rests on: a real PayPal sandbox cycle
including an authenticated webhook, and streaming tool use through the Anthropic SDK
in both development and production configuration.

## Unit [docs]

1. **ADR.** Write `docs/decisions/0024-conversational-experience-booking.md` in the
   format of `docs/decisions/0023-voice-chat-lazy-load-deferred-chunksplit.md`:
   status Accepted, date 2026-10-02, context (hackathon, owner approval), decision
   (paid local experiences via conversation, PayPal deposits, Stripe kept), consequences
   (charter changes, operational scope), and the thirteen owner decisions by number.
2. **Charter.** Edit `docs/project/project-charter.md:67` and `:71` (the "Not a booking
   engine" and "Not a business" bullets) and the related values at `:96` and `:99` so
   they describe the new boundary: discovery first, bookings and deposits for local
   experiences, no ads or listings marketplace. Keep every other principle.
3. **Release checklist.** Amend `docs/runbooks/release-checklist.md`:
   - Section 3: state that the release pull request's Vercel Preview is the standing
     exception to the no-Previews rule (decision R11) and that no other Preview is created.
   - New section 5b, "Production acceptance step (owner-authorized)": after the
     read-only probes, with explicit authorization in the conversation, run one
     voucher-gated sandbox booking against the fixture merchant on the deployed origin,
     writing only fixture rows, and record order, capture and refund ids in the evidence
     manifest under a separate `acceptance` key (decision R12). The required probes
     remain read-only.
   - Section 2: add `npm run check-env` to the gate list.
4. **CLAUDE.md.** Under Production Release, add one line pointing at the Preview
   exception and the acceptance step so sessions do not stop a release over them.
5. **Ops doc.** Fix `docs/operations/operations.md:207`: `fail-stale-bookings` marks rows
   `orphaned`, not failed.

Acceptance for [docs]: `npm run lint` passes (markdown is not linted, so run
`npx markdownlint-cli2 docs/decisions/0024-*.md docs/runbooks/release-checklist.md`
if the tool is present; otherwise a visual read); the ADR cites research decisions 1 to
13 by number; the charter no longer contains "no hotels, flights, or transactions" or
"no monetization".

## Unit [spike]

Nothing from this unit is merged except the evidence file and the two spike scripts
under `scripts/spikes/`, which are excluded from Knip by a comment in `knip.json`
if Knip flags them.

### PayPal sandbox cycle

Owner prerequisites: PayPal developer account, a sandbox REST app (client id and
secret), a sandbox business account and a sandbox personal (buyer) account, and a
webhook subscription for the tunnel URL. Secrets go in `.env.local` only.

```
@ spikePaypalCycle() -> evidence.json
ctx: fetch to PAYPAL_API_BASE (sandbox), tunnel exposing localhost:3000, browser for approval
pre: PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_WEBHOOK_ID set; tunnel running
do:
  1. fetch OAuth token (client credentials); record expiry
  2. create order: intent CAPTURE, 30.00 EUR, custom_id "spike-1", return_url = tunnel + /booking/spike/return, PayPal-Request-Id = uuid
  3. open the approve link in the browser; approve with the sandbox buyer
  4. capture the order with PayPal-Request-Id; assert status COMPLETED; record capture id
  5. subscribe the tunnel listener to CHECKOUT.ORDER.APPROVED and PAYMENT.CAPTURE.COMPLETED/PENDING/DENIED/REFUNDED; receive them on POST /api/webhooks/paypal (temporary route in the spike branch); verify each with verify-webhook-signature; record the exact event names that fire for approval, capture and refund
  6. refund the capture (full) with PayPal-Request-Id; assert status COMPLETED or PENDING; record refund id
  7. repeat step 4 with the same PayPal-Request-Id; assert no second capture (same id returned)
fx: writes scripts/spikes/paypal-evidence.json (ids and statuses only, no secrets)
fail: any non-2xx -> record body and stop
risk: sandbox approval flow differs for guest checkout; record the exact experience_context used
```

Run a second cycle in which the buyer approves and the browser is closed before the
return: capture from the server on receipt of the approval event, with no return page
involved. This proves the recovery design in Phase 4 (finding F02).

Also record: whether `getOrder` on an approved-but-uncaptured order returns
`APPROVED`; the delay from approval to the approval event; how long an approved,
uncaptured order stays capturable; the time from approval to webhook delivery; whether a second
`verify-webhook-signature` call on the same event still returns SUCCESS.

### Anthropic SDK streaming tool use

```
@ spikeToolStream(transport) -> evidence
ctx: @anthropic-ai/sdk 0.128, model CHAT_MODEL (src/lib/models.ts:7)
pre: ANTHROPIC_API_KEY set
do:
  1. define one tool get_quote with a zod schema converted by hand to JSON schema
  2. call client.messages.stream({tools, messages:[ask for a quote]}) and iterate events
  3. collect content_block_start(tool_use), input_json_delta, content_block_stop; read finalMessage().content[...].input
  4. append the assistant turn and a tool_result; stream the continuation; assert text arrives
  5. run with NODE_ENV=development and with ANTHROPIC_TRANSPORT=sdk; note whether the curl path is needed at all for this route
fx: writes scripts/spikes/tool-stream-evidence.json (event sequence, timings)
fail: SDK cannot stream tool events in dev -> record the error; Phase 3 then forces the SDK transport in this route and documents why
```

### AG Studio half day (decision R6)

Clone `https://github.com/paypaldev/hackathon-paypal-ag-grid-boilerplate` outside the
repository. Time-box four hours. Pass conditions, all four required: the boilerplate
runs; a booking table and one custom widget render from a fixture JSON; the Studio
agent answers one booking question from that data; AG Grid confirms in Discord or the
Oct 12 webinar that the event license covers judging through Dec 15. Record yes or no
in `docs/plans/2026-10-03-paypal-hackathon-booking-phases/phase-0-evidence.md`. A no
means Phase 5 builds the native view only.

### Early validation groundwork (Phase 5b backup)

Two small items start now so the backup exists well before the video: the agent
drafts the three-question provider message in Spanish for the owner to send by Oct 9,
and begins the desk survey of ten Asturias activity providers' public websites
(`docs/hackathon/validation/provider-desk-survey.md`). Neither blocks this phase's gate.

### Webinars

Attend Oct 6 (PayPal, 18:00 Madrid) and Oct 7 (APIMatic, 18:00 Madrid). Install the
APIMatic plugin with `npx context-plugins install paypal` in the worktree and note any
form the sponsor requires.

## Acceptance gate

Automated: `npm run test && npm run typecheck && npm run lint` green in the worktree;
`npm run check-migrations` unchanged.

Manual, recorded in `phase-0-evidence.md`:
- Order, capture and refund ids from one sandbox cycle; idempotent re-capture observed.
- The exact webhook event names observed for approval, capture and refund; the Phase 4
  handler list is corrected to match before Phase 4 starts.
- One server-side capture after approval with no browser return.
- One webhook event verified SUCCESS through the tunnel, with the delivery delay.
- Tool-stream event sequence captured on the SDK in development; transport decision.
- AG Studio yes or no with the four conditions.
- Which docs changed, with the ADR number.

Stop here for acceptance. Phase 1 does not start until the owner accepts the evidence.
