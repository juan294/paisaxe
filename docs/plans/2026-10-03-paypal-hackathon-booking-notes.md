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

### Phase 1

1. **A price is the total for one party, not a price per person.**
   - Plan said: experiences carry "price / deposit" (120 / 30, 60 / 15, 200 / 50) and a quote returns `balance = total - deposit`.
   - Found: the plan does not say whether the price is per person. The research's illustrative fixture is "a four-person experience costs EUR 120, with EUR 30 paid now", and the representative request has a budget of 120 EUR for four people.
   - Chose: `experiences.price_cents` is the total for one party of up to `max_party`; a quote copies it unchanged.
   - Why: only this reading gives the representative request a suitable option within budget.
2. **`experience_facts` has a `data jsonb` column.**
   - Plan said: columns `(experience_id, key, value, detail, confirmed_by_provider, confirmed_at)` with `value` in `yes | no | unknown`.
   - Found: `min_age` and `languages` need a parameter (8 years; es, en) that a three-valued `value` cannot hold, and `detail` is the human-readable evidence shown in the offer.
   - Chose: `data` holds the parameter (`{"min_age": 8}`, `{"languages": ["es", "en"]}`); `value = 'yes'` means the provider stated it.
   - Why: constraint evaluation stays deterministic without parsing prose.
3. **Voucher voice-pass renewal updates the same row; the RPC can return `not_included`.**
   - Plan said: `grant_voucher_voice_pass_idempotent` writes `voice_purchases` with `payment_provider_id = 'voucher:<redemption id>'`; a second call inside the window returns `duplicate`; the pass is renewed by redeeming again.
   - Found: `voice_purchases.payment_provider_id` is `UNIQUE NOT NULL` (migrations 040, 055), so a renewal cannot insert a second row with that id. The design also allows vouchers without the voice pass (F13 fallback).
   - Chose: renewal after expiry updates `expires_at` on the same row and returns `granted`; `vouchers.grants_voice_pass = false` makes the RPC return `not_included`.
   - Why: keeps the specified provider id and makes the no-voice fallback enforceable in the database.
4. **The fixture migration (116) is re-runnable, and its idempotency test replays the file.**
   - Plan said: the fixture seed is idempotent on `supabase db reset` run twice.
   - Found: two resets rebuild from scratch, so they cannot show that the seed itself is idempotent.
   - Chose: 116's DDL uses `IF NOT EXISTS` and `DROP … IF EXISTS`; the integration test replays the whole file against the seeded database and compares ids and counts. Two consecutive resets were also run.
   - Why: production applies 116 once to a database that already has data; the replay is the meaningful check.
5. **`createQuote` also checks that the slot exists and has room.**
   - Plan said: read the price, supersede open quotes, insert version n+1.
   - Found: without a check, a quote could be offered for a start time outside the slot rule or for a full slot, and fail only at acceptance.
   - Chose: `createQuote` reads `experience_availability` for the date; an unknown start time is `invalid_input` and a full slot is `no_capacity`. `accept_quote` remains the authority under the lock.
   - Why: the visitor is not shown an offer that cannot be accepted at that moment.
6. **`bookings.ts` holds user-scoped reads only.**
   - Plan said: `bookings.ts` with a test, no function list.
   - Chose: `getBookingForUser` and `listBookingsForUser`, which the Phase 3 tools and per-turn state need. Capture, confirmation and expiry wrappers are left to Phase 4, which owns those paths.
   - Why: no speculative code ahead of its caller.
7. **`expire_holds()` expires only bookings with no live PayPal payment.**
   - Plan said: `expire_holds()` in migration 113, without a contract; reconciliation "expire holds and abandon stale drafts".
   - Found: holds stop counting the instant they lapse (availability is time-based), so the function's only job is the booking status. A booking with a `created`, `approved` or `capture_pending` payment may have been approved at PayPal and must not be expired without asking PayPal.
   - Chose: it marks `pending_payment` bookings `expired` when the hold is no longer live and no payment is outside `expired | capture_failed`; it returns the count.
   - Why: R2-01 (a captured payment is never marked expired). **Phase 4 entry condition:** reconciliation must mark abandoned `created` payments `expired` after `getOrder`; otherwise those bookings are never expired.
8. **A slot that has already started reports 0 places.**
   - Plan said: `available = capacity - confirmed - held`.
   - Chose: `experience_availability` returns 0 once `slot_date + start_time` in the merchant's timezone has passed, and never a negative number.
   - Why: a quote or acceptance for a started slot is otherwise possible within the quote's 20 minutes.
9. **The capture-path RPCs are stricter than the contract (independent review findings 1 and 2).**
   - Plan said: `consume_hold_and_confirm` requires a live hold; `reacquire_hold` re-takes capacity.
   - Found: as first written, a booking under compensation (`refund_pending` payment, `needs_attention` booking) could be re-confirmed once capacity freed up. Liveness was also judged with the transaction-start `now()` and without the experience lock, so a hold expiring at that instant could be both confirmed and re-sold.
   - Chose: both functions lock the experience first (same order as `accept_quote`), judge liveness with `clock_timestamp()` after the lock, and raise `invalid_state` for a terminal booking or one with a `refund_*` payment or a `compensation_reason`. `consume_hold_and_confirm` accepts `pending_payment`, `needs_attention` or `expired` bookings, claims a payment by capture id only in `created | approved | capture_pending | captured`, and refuses a null capture id. `accept_quote` re-reads the quote under its row lock and requires a non-null owner.
   - Why: F04 and the success criterion that a refunded payment cannot regress. Each case has an integration test that fails against the earlier SQL.

### Phase 1 review dispositions

Independent review of 2026-10-03 (fresh context, read-only). Every finding:

| # | Finding | Disposition |
| --- | --- | --- |
| 1 | Compensating booking could be re-confirmed | **Fixed** (deviation 9); integration test, RED before the fix |
| 2 | Hold expiring at the instant of confirmation could be sold twice | **Fixed** (deviation 9); integration test that forces the interleaving, killed by the pre-fix function |
| 3 | `accept_quote` validated a quote snapshot read before the lock | **Fixed:** re-read `FOR UPDATE` after the experience lock, expiry against `clock_timestamp()`. A second quote on a just-accepted draft remains possible and is equivalent to a second booking request, which the booking-attempt metering (Phase 2) bounds |
| 4 | `createQuote` not atomic; version collision returned a generic error | **Fixed in part:** one retry on `23505`. Residual accepted: if the insert fails after superseding, the draft has no open quote until the visitor asks again |
| 5 | Null capture id accepted | **Fixed:** raises `invalid_input`; test |
| 6 | Phase 1 deviations not recorded | **Fixed:** deviations 1 to 9 above |
| 7 | Two integration assertions weaker than claimed | **Fixed:** anon refusals assert HTTP 401 with code `42501` (observed on the local stack); the foreign-draft case asserts `not_owned` |
| 8 | Empty draft patch sent `update({})` | **Fixed:** returns the draft unchanged; test |
| 9 | Orphaned quote acceptable with a null user | **Fixed:** ownership requires `user_id = p_user_id`; test |
| 10a | Availability could be negative | **Fixed:** clamped at 0 |
| 10b | `bookings` lacked the deposit ≤ total CHECK | **Fixed** |
| 10c | Booking reference collision re-raises a generic error | **Accepted risk:** 6 hex characters as the plan specifies (about 1 in 16.7 million per booking at demo volume); the unique constraint prevents a duplicate |
| 10d | Non-UUID quote id reached the RPC | **Fixed:** `acceptQuote` returns `not_found` without calling the database; test |
| R1 (re-review) | `reacquire_hold`'s lapsed branch reads availability with transaction-start `now()`, so a booking whose own hold expires while it waits for the lock still counts that hold and may get `false` with places free | **Deferred to Phase 4 (entry condition):** errs on the safe side (no overbooking), but in the captured case it would cause an unnecessary refund. Phase 4 adds the booking's own party back when its hold has `expires_at > now()` and tests it with the capture path that first calls `reacquire_hold` |

Re-review verdict: **APPROVE** (all ten findings resolved; 134/134 booking tests run by the reviewer against local Docker).

### Phase 1 simplify pass

Four cleanup reviews (reuse, simplification, efficiency, altitude) after the approval.

- **Applied:**
  - Shared input schemas in `types.ts`: zod's `z.iso.date()` (so `createQuote` now rejects impossible dates such as 2026-02-30, as `updateDraft` already did), the `HH:MM` pattern, party size, one UUID check, the `23505` constant and `parseOrThrow`.
  - `madridDate` and `addDays` moved into `types.ts`.
  - `createQuote` reads the draft and the experience together, and the version read and supersede together. Error precedence is unchanged.
  - `searchExperiences` makes a single window call; `.find` replaces `filter()[0]`; `findOpenDraft` helper.
  - File-local types un-exported.
  - Tests: shared row builders, the fake trimmed to the methods in use, `startLocker`, `acceptedBookingId`, `confirm`, `vi.waitFor`, and a Madrid-based `futureDate`. The finding-2 mutation check was re-run after this refactor and still fails against the pre-fix function.
- **Skipped, with where they go:**
  - **`create_quote` as one locked RPC (altitude).** It would remove the 23505 retry and the residual from review finding 4, and enforce `max_party` and price in the database. Skipped because it is new SQL after the review approval. **Phase 3 entry condition:** if the tool loop can run `get_quote` calls for one draft concurrently, Phase 3 either executes a turn's tool calls sequentially or adds this RPC.
  - **A range availability RPC (efficiency).** A search without a date is 7 RPCs per offerable experience (21 for the fixture). Skipped as new SQL; Phase 3 measures the search tool's latency and adds `experience_availability_range` if it matters.
  - **A shared RPC error mapper:** speculative until Phase 4 calls the capture-path RPCs.
  - **A SQL helper for the compensation guard:** would need its own grants for about six lines saved.
  - **A plain `ADD CONSTRAINT` instead of `NOT VALID` plus `VALIDATE`:** kept to mirror migration 099.
  - **`updateDraft` update-first:** saves one round trip; marginal.
  - **Shared quote and booking field mapping:** optional.

## Owner decisions after Phase 0

Recorded 2026-10-03, when the owner accepted Phase 0.

1. **AG Studio: skipped.** The operator view is the plain native view in Phase 5. The
   conditional AG Studio bullet in `phase-5.md` no longer applies, and there is no AG Grid
   sponsor-prize entry. APIMatic remains the sponsor prize target.
2. **APIMatic PayPal context plugin: installed** with `npx context-plugins@0.12.0 install
   paypal --targets claude` (telemetry off), Claude Code user scope, plugin `paypal@context-plugins`
   version 0.3.3. It contains only skills (TypeScript, Python, .NET) for the
   APIMatic-generated PayPal Server SDK; no hooks, no MCP servers. It loads in new Claude Code
   sessions. Phase 4 decides whether `src/lib/paypal` uses that SDK (`@paypal/paypal-server-sdk`)
   or plain `fetch` (see `phase-4.md`, Unit [adapter]).
