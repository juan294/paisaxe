# PayPal hackathon booking: implementation notes

Plan: [2026-10-03-paypal-hackathon-booking.md](2026-10-03-paypal-hackathon-booking.md)

## Deviations

### Phase 0

1. **PayPal variables registered in `.env.example` in Phase 0.**
   - Plan said: register `PAYPAL_*` in Phase 4.
   - Found: the Phase 0 spike script reads them, and `scripts/check-env.ts` scans `scripts/`.
   - Chose: add them now as commented entries in the existing Stripe section's neighbourhood.
   - Why: `check-env` would fail CI otherwise; Phase 4 needs the same names.
2. **The spike's webhook receiver is a standalone server inside the spike script.**
   - Plan said: a temporary route `POST /api/webhooks/paypal` on the spike branch, not merged.
   - Found: a route in the application would need to be written, run under `next dev`, and removed again before merge.
   - Chose: `scripts/spikes/paypal-cycle.ts` runs its own `node:http` listener on port 8787 behind the tunnel.
   - Why: no application code to create and later remove; the evidence is identical.
3. **The tool-stream spike ran as a standalone process, not under the Next.js dev server.**
   - Plan said: run with `NODE_ENV=development` and with `ANTHROPIC_TRANSPORT=sdk`, and decide whether the curl path is needed.
   - Found: the curl path exists because the SDK hit ECONNRESET under the Turbopack dev server (`src/lib/claude.ts:1-12`, `:58-81`). A standalone `tsx` process does not reproduce Turbopack. Exercising the existing chat route under `next dev` would record usage rows in the production database that `.env.local` points at.
   - Chose: prove SDK streaming tool use standalone now; verify the booking route under `next dev` against local Docker Supabase in Phase 3, which already forces the SDK transport on that route.
   - Why: production data is not modified without authorization; the Turbopack question is only meaningful inside the dev server.
4. **Guard tests for the two release rulings.**
   - Plan said: write the rulings into the checklist.
   - Found: nothing in the repository would fail if a later edit removed them.
   - Chose: also add four assertions to `scripts/release/release-topology.test.ts`; the first three were verified to fail against the previous checklist and CLAUDE.md, and the fourth guards against the old "Previews on `develop` are fine" line returning (review finding P0-03).
   - Why: a later edit cannot silently drop a ruling.
5. **Branch base included one unpushed commit from another session.**
   - Plan said: work from `develop`.
   - Found: local `develop` was one commit ahead of `origin/develop` (`51140e54`, deploy skill frontmatter, by another session).
   - Chose: branch from local `develop`; it ships with this phase's push.
   - Why: rebasing it away would discard the owner's work.
6. **In run 2 the buyer's browser returned before the tab was closed.**
   - Plan said: approve, close the browser before the return, capture from the server.
   - Found: the PayPal redirect reached the return page in under a second, before the owner could close the tab.
   - Chose: keep the run; the script ignores the return in that mode and captured only on the `CHECKOUT.ORDER.APPROVED` webhook, which is the behaviour under test.
   - Why: the evidence is equivalent. A run where no return request is made at all would need the return URL to point nowhere; Phase 4's reconciliation tests cover that case against the mock.
7. **The spike webhook subscribed to all events, and the evidence is split into files per run.**
   - Plan said: subscribe to the five named events; write `paypal-evidence.json`.
   - Found: the purpose of the spike was to discover which events fire and under which names.
   - Chose: subscribe the temporary listener to all events; write `paypal-evidence-return.json`, `paypal-evidence-server-capture.json` and `paypal-followup-evidence.json`.
   - Why: a narrower subscription could have hidden an unexpected event; one file per run keeps each run self-contained. The listener was deleted after the runs; production subscribes to the named events only (Phase 6).
8. **A conclusion was corrected during review.**
   - Plan said: record the exact webhook event names observed for approval, capture and refund.
   - Found: the first evidence write-up said PayPal never generated one capture event. PayPal's event log, recorded afterwards, shows it was generated about 90 seconds late.
   - Chose: record the event log as evidence and re-derive findings 2 to 4 from it.
   - Why: a claim drawn from a query run too early was presented as verified (review finding P0-08).
