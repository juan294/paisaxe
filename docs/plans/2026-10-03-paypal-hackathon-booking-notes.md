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

### Phase 2

1. **Redemption is one atomic RPC (`redeem_voucher`, migration 118).**
   - Plan said: in the route, look up the voucher, serve an existing redemption, else check `redemptions_count < max_redemptions`, insert, increment the count, then call `grant_voucher_voice_pass_idempotent`.
   - Found: done as separate statements, two new guests can both pass the count check, and a failed grant after the insert leaves a redemption without a pass (the plan's own test wants "RPC failure → 500 and no counter change").
   - Chose: one SECURITY DEFINER function that locks the voucher row, serves an existing redemption even at the cap, counts redemptions under the lock (no `redemptions_count` column), inserts, and grants the pass in the same transaction. A failed grant rolls the redemption back.
   - Why: the cap and the rollback are guarantees only inside one transaction. Integration tests cover the race, the cap, the rollback and the returning user.
2. **The voice pass and voucher expiry are judged on a clock the server passes in (`p_now`).**
   - Plan said: date-advanced tests at 2026-12-01, 12-14 and 12-17.
   - Found: the database clock cannot be moved, and `grant_voucher_voice_pass_idempotent` compared against `now()`.
   - Chose: migration 118 adds `p_now` (default `now()`) to the grant function, and `redeem_voucher` takes `p_now` from the route (`new Date()`).
   - Why: the date-advanced integration test exercises the production code path, not a mock.
3. **`consume_voucher_counter` returns `{allowed, remaining}`.**
   - Plan said: `consume(...) -> {allowed, remaining}`; migration 114 returned `consumed | limit_reached`.
   - Chose: migration 118 redefines the function (Phase 1 was closed, so not an edit to 114, as phase-2.md asks).
4. **Vouchers can be revoked (`vouchers.revoked_at`); a revoked code reports `invalid`.**
   - Plan said: `--replace <label>` "deactivates a voucher".
   - Why: a deactivation state is needed; reporting a revoked code as `invalid` reveals nothing about a leaked code.
5. **`/acceso` is gated in `proxy.ts`, and the page is static.**
   - Plan said: `/acceso` returns 404 when the flag is off or on a Preview (`requireBookingSurface`).
   - Found: under PPR (`cacheComponents`) a `notFound()` in the page arrives after the shell has been sent with 200. Observed on a local production build: flag off → HTTP 200 with the not-found fallback streamed. A page-level `connection()` also triggered Next's blocking-route error in development.
   - Chose: `src/lib/proxy/booking-surface.ts` rewrites `/acceso` and `/access` to an unmatched path while the surface is closed (a real 404 with the standard not-found page) and redirects `/access` to `/acceso` with 307. The flag and Preview rule moved to `src/lib/booking/surface.ts` so the proxy imports no auth or admin client. Verified on a local production build: flag off → 404 for both paths; flag on → 200 and 307.
   - Why: the contract is a 404. Phase 4's capability pages face the same PPR limit (Phase 4 entry conditions in the Phase 2 handoff, `phase-2.md`).
6. **`src/types/voice-access.ts` is unchanged.**
   - Plan said: add `voucher_pass` to the purchase-type union there.
   - Found: `VoiceAccessResponse.purchaseType` is already `string | null`; no union exists. Readers grant access on expiry alone, and `GET /api/voice-access` returned `voucher_pass` for an anonymous guest in the integration test.
7. **`create-voucher.ts` has no `--voice-hours`, and targets local by default.**
   - Plan said: `--voice-hours 24` (or `--no-voice`).
   - Chose: the pass is fixed at 24 hours (`VOICE_PASS_HOURS`); `--no-voice` is supported. `--target production` requires `--yes-production` and reads `.env.local`.
   - Why: a per-voucher duration would need a column for a value the plan fixes at 24 hours; the default target avoids an accidental production write.
8. **Codes are 32 random bytes as 52 base32 characters (A to Z, 2 to 7).**
   - Why: the plan asks for 32-byte random codes within the 8 to 64 character input limit; base32 survives the uppercase normalization.
9. **The manual browser check could not complete the success path locally.**
   - Plan said: a fresh browser redeems a voucher created by the script; a second browser and a Google user redeem too.
   - Found: the CSP's `connect-src` allows only `https://*.supabase.co`, so a browser on localhost cannot reach the local stack at `http://127.0.0.1:54321` (verified: `securitypolicyviolation` on `connect-src`). Local Google OAuth is not configured.
   - Chose: the success path was verified over HTTP against a local production build using the browser's exact calls: real anonymous sign-ins, the `__csrf` cookie and header, and the Bearer token. Two anonymous guests and one email/password (non-anonymous) user redeemed one script-created code. `/api/voice-access` reported `voucher_pass` for each, and a fourth identity at a cap of 3 got `exhausted`. In Chrome, the failure path was verified: the `anonFailed` message and `[VOUCHER_ANON_SIGNIN_FAILED]` in the console.
   - Why: the CSP is intentional (plan P1: no CSP change). **Phase 4 entry condition:** the local `booking-roundtrip` E2E needs Playwright's test-only `bypassCSP` on its local project.
10. **Production anonymous sign-in was not changed.** No owner authorization was given in the implementing conversation. Production anonymous sign-ins remain off (unchanged; not read). **Phase 7 cannot proceed until the owner authorizes enabling it.** Local `supabase/config.toml` has it on.
11. **`next dev` rewrites `AGENTS.md`.** Next 16.3 appends a "nextjs-agent-rules" block to `AGENTS.md` whenever `next dev` runs. It was restored to HEAD and not committed; whether to keep that block is the owner's decision.
12. **Smaller departures.**
    - `booking.access.*` has more keys than the plan's list (`intro`, `codeLabel`, `submitting`, `contactHint`, `rateLimited`, `failed`).
    - Refusals get one message per reason (invalid, expired, exhausted) plus a contact hint, instead of the stuck-state table's single "Este acceso no es válido o ha caducado".
    - No retry on `23503`: the profile trigger is synchronous, and the anonymous-guest integration test passes without it.
    - The planned `acceso/page.test.tsx` cases (`anonFailed`, `invalid`) live in `voucher-form.test.tsx`, because the page is now static.

### Phase 2 review dispositions

Independent review of 2026-10-03 (fresh context; it ran 593 related tests, with the voucher integration suite live). No blocker or major findings.

| # | Finding | Disposition |
| --- | --- | --- |
| 1 | A submit before hydration could send the code as `GET /acceso?code=…` (history, logs, PostHog) | **Fixed:** `method="post"`, no `name` on the input; test |
| 2 | Submitting while auth loads could replace a Google session with a guest one | **Fixed:** submit disabled while auth is loading; test |
| 3 | `--replace` on a capped voucher locks out returning users; revoke then insert was not atomic | **Fixed:** the new code is inserted first, then the label's other active codes are revoked (never the new one). The script documents `--replace` for leaked codes only; a capped voucher gets a new label without `--replace`; test |
| 4 | The closed `/acceso` 404 lacked the CSP header | **Fixed:** the proxy sets the CSP on that response; test |
| 5 | The redeem race test did not force the interleaving | **Fixed:** the voucher row lock is held in a separate session until both callers queue. Mutation check: without `FOR UPDATE` in `redeem_voucher`, both redeem (`['ok','ok']`) and the test fails |
| 6 | No test of the proxy wiring | **Fixed:** two cases in `src/proxy.test.ts` |
| 7 | The CSP blocks every local browser flow | **Recorded:** deviation 9; Phase 4 entry condition (`bypassCSP` for the local Playwright project) |
| 8 | No consumer sweep for anonymous users (`authenticated` role, nothing checks `is_anonymous`): `checkout/embedded` could sell a Stripe pass to a throwaway identity; `favorites`, `suggestions` | **Phase 7 entry condition:** before production anonymous sign-ins are enabled, sweep the routes that treat a user as an identity and decide per route (at least checkout should require a non-anonymous user) |
| 9 | Some tests could not fail (`metering.test.ts` echo, hook 404, trivial page test) | **Fixed in part:** the hook 404 case now returns an `active:true` body that must be ignored. The metering unit test stays as a contract test; its behaviour is proven by the live concurrency test. The page test is trivial by design now that the gate is in the proxy |
| 10 | The revoked filter was asserted on the fake only | **Fixed:** the live test asserts `findActiveRedemption` does not serve the revoked voucher |
| 11 | `role="alert"` inside `aria-live`; a 401 maps to `failed`; the access 404 lacked `no-store` | **Fixed:** single live region; `no-store` on the 404 with a test. The 401 mapping is kept: the form always sends a fresh token, so a 401 there is an unexpected failure |
| 12 | The script imports `src/test/local-supabase` for the local keys | **Kept:** those are the CLI's public demo keys, defined once; duplicating them in `scripts/` would let the two drift |

### Phase 2 simplify pass

Four cleanup reviews (reuse, simplification, efficiency, altitude) after the review fixes.

- **Applied:**
  - The live-test row-lock helpers (`lockRow`, `releaseRowLock`, `waitForBackendCount`) moved to `src/test/local-supabase-locks.ts`, shared by both booking integration suites. `localServiceClient` and `sqlList` moved to `src/test/local-supabase.ts`.
  - The voucher form keeps one state value instead of three flags; the guest sign-in returns early when no client exists.
  - `useBookingAccess` derives `active` from `limits` and re-checks only when the user id changes, not on every token refresh (the auth provider emits a new user object per auth event). Its unused `refresh` is removed.
  - `vouchers.ts` has one `toLimits` mapping; `hashVoucherCode` hashes the canonical code as given.
  - `create-voucher.ts` parses arguments with `node:util` `parseArgs`.
- **Skipped:**
  - **A general route-rule table in the proxy (altitude).** Phase 4 decides the shape when `/booking/*` and `/operator/*` arrive; see the entry condition in `phase-2.md`.
  - **One shared SQL predicate for "active voucher" (altitude).** It is defined in `redeem_voucher` and in `findActiveRedemption`; `consume_voucher_counter` relies on callers passing the gate first. Low risk at this scale.
  - **Dropping `redemptionId` from the redeem result (simplification).** The live tests read it.
  - **Running the flag and `getUser` in parallel in the gate (efficiency).** It would spend an Auth call while the surface is closed.

### Phase 3

1. **The tool loop's total cap is 85 s, not 110 s.**
   - Plan said: idle 30 s, total cap 110 s, route `maxDuration` 120 s.
   - Found: rate limit (3 s), embedding (12 s) and search (5 s) run before the loop, so 110 s would overrun the 120 s function limit.
   - Chose: `BOOKING_CHAT_TOTAL_CAP_MS = 85_000`; idle 30 s, reset on every event, tool events included. The client abort stays at 120 s.
2. **The agent instantiates the Anthropic SDK itself; tool JSON schemas are derived with `z.toJSONSchema`.**
   - Plan said: forced SDK transport; hand-written JSON schemas matching the zod ones.
   - Found: `src/lib/claude.ts` messages are `{role, content: string}` and both transports yield text only, so they cannot carry `tool_use` or `tool_result`.
   - Chose: `src/lib/booking/agent.ts` calls `messages.stream` with tools (injected client for tests). zod 4's `toJSONSchema` produces the schemas, so they cannot drift from the validation.
3. **The booking rules sit in the cached system block.**
   - Plan said: cached persona block plus an unmarked block holding the booking instructions, the draft, the bookings and the retrieved context.
   - Chose: persona and `buildBookingInstructions()` (both stable) form the cached block. Today's date, draft, bookings, the accept event and guide context form the unmarked block (`.claude/rules/prompt-caching.md`: stable content cached, volatile content after it). The cache rule's builder table gains the `booking_chat` row.
4. **Retrieval is optional and non-fatal.** Guide context goes in the unmarked system block. A retrieval failure only drops it (`[BOOKING_CHAT_RETRIEVAL_SKIPPED]`), and the event turn does no retrieval. `buildContextText` is exported from `src/lib/claude.ts` for reuse.
5. **History validation.**
   - Plan said: "sanitized like `agentChatRequestSchema`".
   - Found: that schema does not sanitize.
   - Chose: at most 10 items of at most 2,000 characters, each passed through `chat-safety` `sanitizeInput`. The injection check covers the message and every user item in the history. The client truncates items to 2,000 characters.
6. **The post-accept turn has an empty message.** The schema allows an empty message only with an `event`; the model receives "He aceptado la oferta." as the visitor's words, and the verified event line goes in the state block.
7. **The discovery hook needed a fix.**
   - Plan said: existing consumers ignore the new SSE events (`use-stream-chat.ts:236-239`).
   - Found: once `parseSseEvent` accepts `tool` and `card`, the hook's final unconditional `else` would have turned them into an error message.
   - Chose: `else if (event.type === "error")`, with a regression test. The discovery route and its 42 tests are untouched.
8. **`VoiceChat` runs both chat hooks and uses one** (rules of hooks), with the booking hook whenever `useBookingAccess().active`. `?booking=1` opens the chat in booking mode even without a `story` parameter (the deep-link effect returned early without one). `ChatHeader` gains `tryVoiceLabel` for "Voz (descubrimiento)".
9. **One response's tool calls run sequentially.** This closes the Phase 1 simplify entry condition: two `get_quote` calls on one draft never race, so no `create_quote` RPC is needed.
10. **The booking link has a placeholder, and capability Referrer-Policy moved forward from Phase 4.**
    - `GET /booking/<capability>` returns the booking JSON (404 for an invalid capability or on a Preview), as phase-3.md allows.
    - Found on the dev server: `next.config.ts`'s site-wide `Referrer-Policy` overrides a route's header. Added `/booking/:path*` and `/operator/:path*` entries with `no-referrer` after the site-wide one, tested through `nextConfig.headers()`. Verified on `next dev`: `no-referrer`, `private, no-store`, `noindex`.
    - **Phase 4:** replace the placeholder route with the page (a `route.ts` and a `page.tsx` cannot share the segment).
11. **`BOOKING_LINK_SECRET` is registered in `.env.example` now** (planned for Phase 6), because the evaluation script sets it and `check-env` scans scripts.
12. **The post-accept instruction says payment is not yet available.**
    - Found on the dev server: the model told the visitor the payment link was in the card, but no payment link exists before Phase 4.
    - Chose: the state line says the payment is not available yet and forbids mentioning a payment link (with a test). **Phase 4 replaces that sentence when `create_payment_order` exists.**
13. **`scripts/tsconfig.json` includes `src/instrumentation.ts`,** which declares the console global that `src/lib/logger.ts` reads; the evaluation script pulls the logger into the scripts typecheck.
14. **The accept route spends a booking attempt before `accept_quote`,** so an idempotent retry of the same accept also spends one (limit 10). Accepted.
15. **The model evaluation runs the agent loop in-process,** not through the HTTP route: the route is covered by the dev-server run below, and in-process runs give exact tool and database outcomes. It reads only `ANTHROPIC_API_KEY` from the main checkout's `.env.local`; every database call goes to local Docker.

16. **Payment card after accept is deferred to Phase 4.**
    - Plan said: `use-booking-chat.test.ts`: "accepting a quote triggers the event turn and yields a payment card".
    - Chose: the event turn is tested (no typed text, `quote_accepted` sent, assistant answers). The payment card needs Phase 4's `create_payment_order` and is asserted there.

### Phase 3 review dispositions

Independent review of 2026-10-03 (fresh context; it ran 35 files and 748 tests, with the live suites up). No blocker findings.

| # | Finding | Disposition |
| --- | --- | --- |
| 1 | (major, observability) A client disconnect was logged as `[BOOKING_CHAT_FAILED]`: the SDK's abort error is not named `AbortError`, and `send` or `close` could throw on a cancelled stream | **Fixed:** the stream ends exactly once through `send`/`end` guards. The client-abort branch tests `turnAbort.signal.aborted`. A timeout reports and closes immediately instead of waiting for the model stream to notice the abort. New route tests cover the client abort, the idle limit and the total cap; the client-abort test was red before the fix |
| 2 | An ignored event with an empty message still spent a turn and called the model with no user message | **Fixed:** the event is verified before metering; an ignored event with no text returns `done` without spending a turn; test |
| 3 | Text of consecutive iterations ran together | **Fixed:** a later iteration's first text delta starts with a paragraph break; test |
| 4 | The injection check skipped assistant history items | **Fixed:** every history item is checked; test |
| 5 | Concurrent turns: a second turn, an accept or a re-quote could start mid-stream | **Fixed:** the hook runs one turn at a time (a second turn or accept mid-stream is ignored; test), and the cards disable accept and re-quote while a turn streams; test |
| 6 | The persona's `[[VOICE_UPSELL…]]` rule was inherited and the markers would not be stripped | **Fixed:** the booking rules override it explicitly; test. None appeared in the six evaluated runs |
| 7 | The manual dev-server evidence was not recorded | **Fixed:** see "Phase 3 manual evidence" below |
| 8 | a11y: status line mounted only with text; focus lost after accept; lapsed message not announced | **Fixed in part:** the status region stays mounted, and the lapsed message is in a polite live region. Focus after the accept card swap is left to Phase 5's UI pass |
| 9 | The booking link left the chat | **Fixed:** opens in a new tab with `noopener noreferrer`; test |
| 10 | Unused fields (`QuoteCard.accepted`, `ToolContext.redemptionId`, `locale`), Spanish-only cap message | **Fixed in part:** `locale` now reaches the state block ("Idioma de la interfaz del visitante"; test). `accepted` and `redemptionId` are kept because phase-3.md specifies them (the card field and the tool context). The cap message stays Spanish (the plan's text; the model answers in the visitor's language otherwise) |
| 11 | No cache breakpoint on messages | **Deferred:** an optional cost improvement; revisit if usage shows long multi-iteration turns |
| 12 | `booking-eval.ts` hard-codes `~/code/paisaxe/.env.local` | **Kept:** a local owner tool; the path is the main checkout's documented location |

### Phase 3 manual evidence (2026-10-03)

- **Model evaluation:** `npm run eval:booking` on local Docker, before the post-accept and review fixes: **6/6 passed**, recorded in `docs/hackathon/evaluation/2026-10-03.json`.
  - Scenario 1 needed one clarification and no invented prices. Latencies: 7.7 to 26 s per scenario.
  - The transcripts of scenarios 2, 4 and 6 were read to confirm the outcome classes (honest no-match; "no ha confirmado" for the 4x4 route; price kept and `get_booking_status` checked before refusing to confirm).
  - Later changes (paragraph break, override line, locale line, post-accept line) do not change the evaluated outcome classes. A re-run on the Phase 6 candidate is already planned.
- **Dev-server transport check (plan, Phase 0 deviation 3).**
  - Setup: `next dev` (Turbopack) on port 3006, run from the worktree, which has no `.env.local`. Only the local Supabase variables, a local link secret and `ANTHROPIC_API_KEY` were passed.
  - Over HTTP: an anonymous guest, voucher redemption (200), the representative request, then "A las 10:00", then the quote accepted through the route, then the `quote_accepted` turn.
  - All turns streamed tool calls through the SDK (`update_booking_draft`, `search_experiences`, `get_quote`, `get_booking_status`). **ECONNRESET: 0**, and no curl fallback.
  - Booking `RS-78EC78`, `pending_payment`, deposit 30 / balance 90. The `/booking/<capability>` link returned 200 with the booking JSON; a tampered token returned 404. Headers on the real response: `Referrer-Policy: no-referrer`, `Cache-Control: private, no-store`, `X-Robots-Tag: noindex`.
  - Usage rows: 41 `booking_chat` rows in local Docker's `anthropic_usage` from the evaluation and dev runs (local query); nothing pointed at the production database.
  - Retrieval was skipped (no Voyage key passed), as designed.

### Phase 3 simplify pass

- **Applied:**
  - Capability headers have one home: `next.config.ts` entries for `/booking/:path*` and `/operator/:path*` set `Referrer-Policy: no-referrer` and `X-Robots-Tag: noindex` for pages and handlers alike (tested through `nextConfig.headers()`). Cache-Control stays per route.
  - A tripwire test fails if `create_payment_order` is registered while the post-accept line still says payment is unavailable. Another checks that every tool the booking rules name is registered.
  - The route has one `stop(code)` and no separate timeout flag. The agent's yield-tracking callback is replaced by a wrapper.
  - The accept route reuses the tools' `bookingCard`. The tool registry is private.
  - The booking hook batches text tokens per animation frame, like `useStreamChat` (PE-M4); test.
  - Each tool logs `[BOOKING_TOOL_TIMING]`.
  - The evaluation script uses `madridDate` and no duplicate cleanup.
- **Skipped:**
  - **Shared SSE response helpers:** the discovery route stays untouched by design.
  - **Holding quote state on the card instead of a `quoteStates` map:** medium churn for no behaviour change.
  - **One `sendMessage` signature across both hooks:** a small wrapper in `VoiceChat` is clearer.
  - **Removing the payment and cancellation card types:** Phases 4 and 5 need them; they are types and small views.
  - **Merging the two `next.config` entries into one pattern:** the explicit pair reads better.
  - **A cache breakpoint on messages:** deferred (review 11).
  - **Skipping retrieval for booking-only messages:** the plan keeps optional retrieval. Revisit with the timing logs.
  - **Unifying the two booking-mode predicates in `VoiceChat`:** the plan defines the booking hook by voucher access and voice suppression by the `?booking=1` entry; kept as specified.
  - **The search tool's availability RPC count:** `[BOOKING_TOOL_TIMING]` now records it. Decide on a range RPC in Phase 6 from the timing logs of the evaluation re-run.

### Phase 4

1. **The adapter wraps the pinned PayPal plugin SDK (owner decision, 2026-10-03).**
   - Plan said: decide between `@paypal/paypal-server-sdk` and plain `fetch`.
   - Chose: `pay-pal-server-sdk` 2.29 from `github:context-plugins/paypal-typescript-sdk`, pinned to commit `c27911067cf7e19e88eaca5bcd114dc182572656` (MIT; runtime dependency `zod` only). It covers orders, captures and refunds with `payPalRequestId`; webhook signature verification stays plain `fetch` (the SDK has no notifications surface) and shares the adapter's token cache.
   - The APIMatic skill requires a contract sheet before adapter code: `pay-pal-server-sdk-plan.md` at the repository root (hosts, client, operations, error arms, assumptions).
2. **The adapter's host guard compares the full origin and allows loopback outside production.**
   - Plan said: exact hostname `api-m.sandbox.paypal.com`.
   - Chose: https on exactly that host with the default port; `http://127.0.0.1` or `http://localhost` only when `NODE_ENV !== "production"`, for the mock server (`src/test/paypal-mock-server.ts`). Paths, credentials and other ports are rejected.
3. **Migration 119 adds `payments.approve_url`.** The plan reuses "the stored approve_url" on a second `create_payment_order`, but migration 115 had no column for it.
4. **`BookingErrorCode` gains `hold_expired`, `invalid_state` and `payment_unavailable`** (the plan's HoldExpired / NotConfigured branches). A PayPal error message is logged, never returned to the model.
5. **The booking page is a static shell that loads through the capability API.**
   - Plan said: a server component that verifies the capability and calls `notFound()` for an invalid one.
   - Found: under PPR a page-level `notFound()` arrives after the shell's 200 (Phase 2 finding).
   - Chose: `page.tsx` renders `BookingStatus`, which fetches `GET /api/booking/bookings/<capability>`. The route answers a real 404 for an unknown capability or on a Preview, and the page shows the not-found state. Polling uses the same route. The return page is a static shell too. Neither HTML response contains booking data, so the per-route Cache-Control the plan asked for lives on the API routes (`private, no-store`); `Referrer-Policy` and `X-Robots-Tag` come from the Phase 3 `next.config` entries, which already cover `/return` (tested).
6. **Capability headers come from `next.config.ts`, not `proxy.ts`** (Phase 3 deviation 10), so the plan's proxy step was not needed.
7. **The capability routes share one per-IP limit** (30 a minute, `booking-capability:<ip>`), checked before any database read. Polling every 5 s uses 12.
8. **The capture route requires the order id to be the booking's latest payment's** and answers 409 `mismatch` otherwise, without capturing and without flagging the booking (a stale or foreign return URL is not evidence about this payment).
9. **The payment card carries `expiresAt`** (the hold's expiry), shown as "Paga antes de las HH:MM" (new key `booking.cards.payBefore`); the quote's "Oferta válida hasta" key stays for quotes. The money and clock formatters moved to `src/lib/booking-format.ts` for the cards and the page.
10. **The Phase 3 tripwire is replaced by the Phase 4 contract.** The post-accept state now directs the model to `create_payment_order` and the pay button; the test asserts the tool is registered, the state names it and the old sentence is gone. `buildBookingInstructions()` gains one rule for the tool.
11. **Telemetry redaction (F05) matches the capability shape, not the route prefix.**
    - Plan said: map `/booking/<anything>` to `/booking/[redacted]`.
    - Found: a prefix match also mangled `/api/booking/chat/stream`.
    - Chose: `redactCapabilityPath` replaces `<uuid>.<token of 20+ base64url chars>` wherever it appears, drops its query (PayPal's `token` and `PayerID`), keeps any suffix such as `/return`, and is applied to the PostHog page view and `before_send`, the Sentry event and transaction paths and breadcrumbs (`beforeSendTransaction` added to the server, edge and client configs), and the Vercel Analytics and Speed Insights `beforeSend`.
12. **Phase 1 entry condition R1 is closed by migration 120.** `reacquire_hold`'s lapsed branch gives the booking's own places back when its hold was still live at transaction start (availability reads `now()`). The test reproduces the race deterministically in one transaction (hold expires 50 ms after `now()`, `pg_sleep(0.1)`): it returned `f` before the migration and `t` after.

13. **Webhook event names are the plan's.** Phase 0 confirmed `CHECKOUT.ORDER.APPROVED`, `PAYMENT.CAPTURE.COMPLETED` and `PAYMENT.CAPTURE.REFUNDED`; `PAYMENT.CAPTURE.PENDING` and `PAYMENT.CAPTURE.DENIED` are handled as documented but were not observed in the sandbox.
14. **Webhook route details beyond the plan.** A request missing any `paypal-transmission-*` header gets 401 without calling PayPal (the e2e server has no PayPal credentials, so verification would otherwise answer 500). A verified event with no id or type gets 400. Events are also matched by `payments.capture_id` before falling back to `getCapture`.
15. **Forward-only rules, made explicit.** A `PAYMENT.CAPTURE.COMPLETED` event is accepted on an `expired` payment (money moved, R2-01). `PAYMENT.CAPTURE.REFUNDED` is accepted from any status but `refunded`; the booking becomes `refunded` unless the reason is `duplicate_capture` (that booking stays confirmed by its other payment). `CHECKOUT.ORDER.APPROVED` on an expired or failed payment is out of order and never captures.
16. **Reconciliation step 7 is implemented now,** because migration 112 already has `cancel_pending`, `cancellation_confirmed_at` and `refund_cents`; it refunds `refund_cents` with the payment's key. Step 6 refunds the full amount for compensations and `refund_cents` otherwise. No migration was needed for `reconcile_passes`.
17. **"PayPal unreachable" in the cron** means not configured, or a `PaypalError` with no HTTP status or a 5xx: the run stops, states stay, the route answers 500 with `[CRON_FAILURE]`, and it does not count as an inconclusive capture pass. Other per-item errors are counted and also give 500. `reconcileBookings` takes an optional `bookingIds` scope used only by the live tests.
18. **Three capture-path defects found while integrating the webhook unit, fixed test-first** (each test failed before the fix; mutations M5 and M6 restored them):
    - A late buyer approval of an `expired` payment re-acquired the free slot and captured while every payment write was a no-op; confirmation then raised `payment_not_found`, leaving money taken on an expired booking. Only `created`, `approved` and `capture_pending` payments are captured now; a late approval answers `slot_gone` (nothing charged).
    - The COMPLETED-order branch confirmed regardless of the capture's own status. All capture results go through one `settleCapture`: COMPLETED is recorded over any non-refund status (an `expired` or `capture_failed` payment included, R2-01) and finalized; DECLINED or FAILED is `capture_failed`; anything else (PENDING) stays `capture_pending` for reconciliation.
    - A mismatched COMPLETED order was written `captured` and then `refund_pending`; a crash between the two would have let reconciliation confirm it. `compensateCapturedPayment` now writes the capture id, `refund_pending` and the reason in one UPDATE (test asserts no `captured` write ever happens on that path). **Correction (review finding 3):** this first fix covered `capture.ts` only; the webhook's `PAYMENT.CAPTURE.COMPLETED` mismatch path kept the two writes until the review dispositions below.
19. **The booking pages render per request (`export const instant = false`).**
    - Found at the gate: `next build` failed prerendering `/booking/[capability]` because the root `Providers` (`src/app/providers.tsx`) reads `usePathname()` outside a Suspense boundary, which a dynamic segment with unknown params cannot prerender (`blocking-prerender-client-hook`).
    - Chose: the build's own "block" option on the two booking pages, leaving the shared `Providers` untouched. A capability page has nothing to cache; the shell carries no booking data either way. Tested (`page.test.tsx`), and the build lists both pages.

### Phase 4 review dispositions

Independent reviewer (fresh context): CHANGES REQUESTED, with two majors reproduced against the live stack. Each fix below has a regression test that failed first and a mutation that the test catches (M7 to M10).

| # | Severity | Finding | Disposition |
|---|----------|---------|-------------|
| 1 | major | `capture_pending` payment, order still `APPROVED`, hold lapsed, slot taken: the payment write was a no-op but the booking was expired (`slot_gone`), so it never counted as inconclusive, and a later run could capture and confirm an "expired" booking | **Fixed.** A capture may be in flight, so APPROVED is not proof it did not happen: that case returns `pending` (inconclusive, counted, flagged at three passes) and changes nothing. For `created`/`approved`, the booking is expired only if the payment's guarded update actually changed a row (`updatePayment` now returns that). Test M7 |
| 2 | major | A second order hides a completed capture: `ensurePaymentOrder` created a new payment and order while the latest was `capture_pending`/`captured`, and concurrent tool + button calls could create two | **Fixed.** `payment_in_progress` refuses a new order while a payment is `capture_pending` or `captured` (409 on the button route; the tool tells the model not to ask for payment again). Migration 121: a partial unique index allows one payment per booking in `created`/`approved`/`capture_pending`; the losing concurrent insert continues the winner's row, and its operation key makes PayPal return the same order. Tests M8, M10 |
| 3 | minor | The webhook mismatch path still wrote `captured` before compensating | **Fixed.** The mismatch goes straight to the single-write `compensateCapturedPayment`; test records every payments UPDATE and asserts none sets `captured` |
| 4 | minor | Unmatched inbox events (for example, another environment's events on a shared sandbox app) fill the drain's batch of 50 for ever | **Fixed.** The drain skips rows whose `last_error` starts with `[PAYPAL_WEBHOOK_UNMATCHED]` (shared `UNMATCHED_TAG`); they stay in the inbox for audit. Payments exist before their orders, so an unmatched event cannot become matchable. Test with 60 unmatched rows plus one replayable event, M9 |
| 5 | nit | `returnFailed` promised a retry that does not exist (a declined capture flags the booking) | **Fixed** in all six locales: "PayPal ha rechazado el pago y no se ha cobrado nada. Lo estamos revisando." |
| 6a | nit | Migration 120 was applied with psql, not recorded by the migration runner | **Resolved at the gate:** `supabase db reset` applies 112 to 121 through the runner (see the gate evidence) |
| 6b | nit (INFERRED risk) | The SDK is a git dependency (`prepare: tshy`); an install from a clean clone in CI or Vercel is unproven | **Verified:** `npm ci` from the candidate `package.json` and lockfile, with an empty cache and `GIT_SSH_COMMAND=false`, exits 0 and builds the SDK's `dist` (npm falls back to https for the `git+ssh` lockfile URL) |

Re-review (same reviewer, after the fixes): **APPROVE**. It re-ran its scratch repros of findings 1 and 2 (now `pending` then flagged at three passes, never expired; one order, reconciliation confirms on the first run), confirmed that no path moves a closed payment back to an open status (so the unique index blocks nothing legitimate), and checked the drain filter keeps rows with a NULL `last_error`. Two nits:

| # | Severity | Finding | Disposition |
|---|----------|---------|-------------|
| R1 | nit | A stale booking page that gets 409 `payment_in_progress` showed "No se pudo abrir el pago" instead of switching to "Confirmando el pago…" | **Fixed:** the page re-fetches the booking on `payment_in_progress` (and `invalid_state`) and shows its real state with no error; test |
| R2 | nit | An unmatched event is now replayed only by PayPal's redelivery, not by the drain | **Accepted:** reconciliation steps 3 to 5 query every open payment through `getOrder`, so no payment depends on an unmatched event; only a refund we did not initiate could rely on redelivery alone |

### Phase 4 simplify pass

Four read-only reviewers (reuse, simplification, efficiency, altitude). Two efficiency findings were defects, fixed test-first:

- **Sentry transactions were dropped.** `sanitizeSentryTransaction` deep-walked the whole event, including `sdkProcessingMetadata`, whose scopes reach the client's cyclic timer list: `RangeError: Maximum call stack size exceeded` (reproduced; the test failed the same way). Now `sdkProcessingMetadata` passes through by reference.
- **PostHog timestamps became `{}`.** The deep walk rebuilt the event's `timestamp` Date as a plain object. `redactCapabilityPathsDeep` now walks only plain objects and arrays, returns any other object (Date, SDK instances) unchanged, has a cycle guard, and skips strings without a dot.

Applied (semantics unchanged unless stated):

- `src/lib/booking/payment-state.ts` is the one home for `guardedUpdate`, the status sets (`CAPTURABLE`, `COMPENSATING`, `RECORDABLE`, `BOOKING_REFUNDED_FROM`), `flagNeedsAttention`, `markBookingRefunded` and `holdIsLive`; `capture.ts`, `webhook-events.ts` and `reconcile.ts` import them instead of three private copies.
- **One intended semantic alignment:** the webhook's capture-evidence list lacked `capture_failed`, so a `PAYMENT.CAPTURE.COMPLETED` after a decline was "out of order" on the webhook but recorded by the capture path. Both now use `RECORDABLE` (deviation 18's documented rule); test (failed under the old list).
- `loadState` reads the booking with its hold and experience title in one query, in parallel with the payment. `ensurePaymentOrder` takes no title (the tool and the pay route no longer look it up), and `captureApprovedOrder` takes the return page's expected order id and answers `mismatch` itself, so the capture route no longer loads the booking view (3 queries) first; test.
- The webhook route and verifier share `TRANSMISSION_HEADERS` (now in `src/lib/paypal/types.ts`); verification uses the adapter's timeout; `getCapture` reuses `normalizeCapture`; `isUuid` replaces a local regex.
- Migration 122: a partial index on `bookings(status, updated_at)` for the statuses the cron filters every 5 minutes.
- Dead `expired` entry in the booking page's message map, an orphaned doc comment and the mock server's stale "used by E2E" header removed.

Skipped:

- **Shared live-test fixtures for the capture and reconcile integration tests** (about 70 similar lines): the two files use separate id prefixes and seed differently; worth doing if a third live booking test appears.
- **Capability headers on API routes from `next.config`:** whether Next keeps a config Cache-Control on route handlers is untested; the per-route constant is small.
- **An `unmatched_at` column instead of the `last_error` prefix:** `UNMATCHED_TAG` is the only writer of that prefix, so a migration buys little now.
- **Folding the test-only timeout into the PayPal config and dropping the `bookingIds` scope:** both serve tests on a shared database; leaving them.
- **Deep redaction of Sentry error events:** they keep the explicit field list (request URL, transaction, breadcrumbs).
- **Fewer queries per status poll and per reconcile item:** 4 and about 4 queries; revisit with timing data.
- **A shared error-message helper and JSON-parse helper:** no existing helper to reuse; the ternary is a codebase-wide idiom.

### Phase 5

1. **The confirmation is one SQL function (migration 123).**
   - Plan said: the confirm endpoint recomputes, compares, then does one UPDATE.
   - Chose: `confirm_cancellation` does all three under the booking's row lock, so two concurrent clicks cannot both pass the comparison. `cancellation_terms` is the read-only computation both the preview and the confirm use, in the merchant's time zone like `experience_availability`. Both take an optional `p_now` used only by the cutoff tests (the `redeem_voucher` pattern); the application never passes it.
2. **A cancellation with no refund goes straight to `cancelled`,** never `cancel_pending`: reconciliation step 7 retries only bookings with a refund due, so a zero-refund `cancel_pending` would never settle. The payment stays `captured` (plan step 6).
3. **One refund path for the endpoint and the cron.** `requestCancellationRefund` (`src/lib/booking/cancel.ts`) requests the refund with the payment's key and moves payment and booking to `refund_pending`; reconciliation step 7 now calls it instead of its own copy. `applyRefundStatus` moved from `reconcile.ts` into `payment-state.ts` (it returns what changed, so the cron keeps its counters) and also settles a refund PayPal completes at once.
4. **The cancellation card carries the booking's capability** for its confirm button (cards only; the tool result has no link, tested). `CancellationCard` was redefined from the Phase 3 placeholder (`policy` text replaced by the terms, which the UI words from `booking.cancel.*`); the unused `booking.cards.refund` key was removed from the six locales.
5. **One confirm component for both surfaces.** `src/components/booking/cancellation-confirm.tsx` sends the refund it shows, replaces the terms on `terms_changed` and needs a second click (R2-05), and reports a 502 as "recorded, refund retried automatically". The chat card and the booking page both render it.
6. **The booking page loads the preview on demand** ("Quiero cancelar"), so viewing a booking never computes terms the visitor did not ask for. A `cancel_pending` or `refund_pending` booking shows "Reembolso en curso" (with the PayPal refund id once known) and polls with the payment cadence until it settles; `needs_attention` with a `refund_failed` payment shows "No se pudo completar el reembolso; lo estamos revisando".
7. **Analytics exclusion: no helper counts `voice_purchases` rows.** The readers are `voice-session` and `voice-access` (the visitor's own active pass, which a voucher pass is meant to grant) and the health probe (reachability only); `stripe-analytics/route.ts` has no Supabase reference. Nothing to exclude, so no test was added (grep evidence in the gate notes).
8. **Operator view: static shell plus a capability API, as the booking page.**
   - Plan said: server component with `notFound()` on a bad or expired capability.
   - Chose: `src/app/operator/[capability]/page.tsx` (`instant = false`, Suspense) renders a client dashboard that loads `GET /api/operator/<capability>`; that route answers a real 404 for a bad, unknown or expired link (Phase 4 deviations 5 and 19). Operator routes are also hidden on a Preview, like the visitor's.
9. **Operator details.** The exception flag also covers a payment in `refund_failed`. The "demo" label shows when `merchants.is_fixture` is true. Tiles: upcoming = confirmed bookings from today; deposits collected = bookings whose latest payment is `captured`; balance due = balances of upcoming confirmed bookings. Re-issue is a compare-and-set on `link_version` (no migration); the API returns the new path and the page shows the full link once, after a confirmation. Logs carry hold or booking ids only (tested).
10. **`create-operator-link.ts` reads `.env.local` only for `--target production`** (it holds production credentials and the production link secret); a local run takes `BOOKING_LINK_SECRET` from its own environment, as `create-voucher.ts` does. The first version loaded `.env.local` for both targets; caught when integrating the unit and fixed before any production use. It runs with `npx tsx --conditions=react-server` because `links.ts` is server-only.
11. **Postman: Newman instead of the Postman CLI, run locally against a PayPal stand-in.**
    - The Postman CLI is not installed; `npx --yes newman@6` (Postman's open-source runner, Apache-2.0) runs the same collection with no global install.
    - `scripts/booking/postman-local.ts` is a loopback-only runner: it starts the PayPal mock (with control routes to seed the run's quotes and approve an order, standing in for the sandbox buyer), enables the flag and issues a voucher on local Docker, and writes the filled environment outside the repository. `next dev` runs with local variables only (the README lists them; the service key variable is `SUPABASE_SERVICE_KEY`, as `src/lib/env.ts` reads). The mock gained additive `port` and `idSalt` options (a restarted mock had reissued an order id already in `payments`).
    - Run of 2026-10-03: 26 requests, 26 assertions, 0 failures (`docs/hackathon/postman/run-2026-10-03-local.md`). Judges use the same collection with the real sandbox approval step (README).
12. **Two defects found by the Postman run, fixed test-first:**
    - `POST …/cancel` on a booking outside the cancellation flow (unpaid, expired, flagged) answered 200 "unchanged", which the confirm component shows as "Reserva cancelada". Now only `cancel_pending`, `refund_pending`, `refunded` and `cancelled` are idempotent replies; anything else is 409 `invalid_state` (unit, live and route tests).
    - The capability API routes (`/api/booking/bookings/…`, `/api/operator/…`) answered the site-wide `Referrer-Policy: strict-origin-when-cross-origin`: the route's own `no-referrer` loses to `next.config.ts`, the Phase 3 finding for pages. Both prefixes now have `next.config` entries (tested); other API routes keep the site-wide policy.
13. **CI coverage restored for Phases 4 and 5** (see the Phase 4 handoff correction). Unit tests over `src/test/booking-supabase-fake.ts` (extended additively: more builder methods, chainable `rpc`) now cover `capture.ts`, `cancel.ts`, `payment-state.ts`, `reconcile.ts`, `webhook-events.ts`, the PayPal webhook route, `operator.ts` and `view.ts` at 100% statements and branches each, mirroring the live tests' oracles; mutations in each file were caught. The live tests remain the proof of the database behaviour. Measured under CI conditions (`SUPABASE_LOCAL_API_URL=http://127.0.0.1:1`, so the live tests skip): before 94.89 / 91.86 / 95.28 / 95.89 %, after 98.20 / 95.81 / 97.97 / 98.85 % (statements / branches / functions / lines; thresholds 97 / 95 / 97 / 97); 8,829 tests passed, 171 skipped.
14. **5b materials** (`docs/hackathon/validation/script.md`, `observation-sheet.md`): the task, the observer's words, the stop rules and the three questions as the plan gives them. The scoring answers come from the fixture migration (coastal walk 120 € with a 30 € deposit, canoe 15 €, 4x4 50 €, 24 h window). The sandbox buyer's password stays in 1Password.

### Phase 5 review dispositions

Independent reviewer (fresh context): CHANGES REQUESTED, no blocker or major. While fixing finding 1, a test exposed a money defect beyond the review; it is listed first.

| # | Severity | Finding | Disposition |
|---|----------|---------|-------------|
| R0 | major (found while fixing 1) | Reconciliation step 5 finalized any `captured` payment of an unfinalized booking. For a booking with a confirmed cancellation that later became `needs_attention` (a refused refund, or the reviewer's finding 8), `finalizeCaptured` found the hold consumed and compensated: a full refund, even for a zero-refund cancellation | **Fixed.** Step 5 selects only bookings with no `cancellation_confirmed_at`; a refused cancellation refund moves the payment to `refund_failed`, so it is not `captured` either. Live test reproduced the refund (failed before the fix); mutation of the filter is caught by the unit and live tests |
| 1 | minor | A definitive PayPal refusal (4xx) of a cancellation refund was reported "retried automatically" and retried every 5 minutes for ever | **Fixed.** 400, 403, 404 and 422 are final: the payment becomes `refund_failed`, the booking `needs_attention` ("No se pudo completar el reembolso; lo estamos revisando" on the page and in the chat card), `[PAYPAL_REFUND_REFUSED]` logged, nothing retries. Timeouts, 401, 408, 409, 429 and 5xx stay retryable. **Known limitation:** Phase 4's compensation refunds (step 6) still retry a definitive refusal; the booking is already `needs_attention` and visible to the operator |
| 2 | minor | The F01 oracle lacked the "wait beyond ten minutes (clock advanced)" step | **Fixed:** live test previews, advances the clock 11 minutes (`vi.setSystemTime`), runs reconciliation, and asserts the booking and payment rows are byte-identical, availability unchanged and no refund |
| 3 | minor | The Postman evidence predates the final tree | **Re-run on the final tree at the gate** (see the gate evidence); the run summary is updated |
| 4 | minor | After the cancellation was recorded, a later database error answered 500 "No se pudo cancelar" | **Fixed:** everything after `confirm_cancellation` records the cancellation answers `refund_unavailable` (502, "registrada… lo reintentaremos") or the real status; tests for the payment load, a database error, a non-Error rejection and the reload |
| 5 | minor | `create-operator-link.ts` claimed a new row revokes the old link | **Fixed** (docstring): rows are independent; a leaked link is revoked by expiring its row |
| 6 | nit | Orphaned doc comment in `reconcile.ts` | **Fixed** |
| 7 | nit | Gaps in the Phase 5 deviation numbering | **Fixed:** renumbered 1 to 14 |
| 8 | nit (INFERRED) | A cancellation plus a duplicate-capture compensation whose refund fails would stop the cancellation's retries | **Covered by R0** (the compensation can no longer refund the cancelled payment); the cancellation refund itself is then left to the operator, who sees the `needs_attention` booking. Accepted |

Second pass (same reviewer):

| # | Severity | Finding | Disposition |
|---|----------|---------|-------------|
| R2-1 | minor | The R0 filter protected reconciliation step 5 only; the return page, both capture webhooks and the other steps reach `finalizeCaptured` too | **Fixed at the database (migration 124):** `consume_hold_and_confirm` and `reacquire_hold` raise `invalid_state` for a booking with `cancellation_confirmed_at`, which the capture code treats as "compensating" with no refund call. A live test through `captureApprovedOrder` (return page) reproduced the full compensation refund of a zero-refund cancellation before the migration (VERIFIED) and passes after; removing the guards is caught. Step 5's filter stays as a cheaper first line |
| R2-2 | minor | Every 422 counted as a definitive refusal, but PayPal documents `PREVIOUS_REQUEST_IN_PROGRESS` (422) as "wait and retry" (developer.paypal.com/api/rest/responses, checked 2026-10-03) | **Fixed:** that issue stays retryable (unit test); other 400/403/404/422 are final |
| R2-3 | nit | A repeated click on a stale chat card after a refused refund said "Esta reserva ya no se puede cancelar" | **Fixed:** `confirm_cancellation`'s "unchanged" reply says whether a cancellation was confirmed; such a booking reports its status (`needs_attention`, shown as the refused refund) instead of `invalid_state` (live test) |
| R2-4 | nit (INFERRED) | A crash between the payment's `refund_failed` and the booking flag leaves `cancel_pending`, shown as "Reembolso en curso" | **Fixed:** the booking page shows the refused refund whenever the payment is `refund_failed`, whatever the booking row says (test) |

Final pass: **APPROVE.** The reviewer diffed migration 124's bodies against 113, 120 and 123 (identical but for the guards), checked the grants, found no legitimate caller of the two RPCs for a cancelled booking, and ran the live suites (124 tests) and the unit suites (922). One accepted nit: `finalizeCaptured` still compensates on a `reacquire_hold` `invalid_state`, reachable only if a cancellation were confirmed between two RPCs of one capture, which needs the booking confirmed and cancelled in that window.

### Phase 5 simplify pass

Two read-only reviewers (reuse and simplification; efficiency and altitude). Applied, semantics unchanged unless stated:

- **One capability guard.** `guardCapability(request, bucket, verify)` in `view.ts` holds the per-IP limit before any read, the Preview rule and the 404; `guardCapabilityRoute` and `guardOperatorRoute` are thin wrappers (they had been line-for-line copies). `bookingForCapability` became redundant and was removed.
- **One production gate for the seed scripts.** `scripts/booking/target.ts` (`parseTarget`, `endOfMadridDay`, `serviceClientFor`) is used by `create-voucher.ts` and `create-operator-link.ts`; the `--yes-production` check and the production-only `.env.local` read live in one place.
- **`confirm_cancellation` defined once:** the `cancellation_confirmed` field moved into migration 123 (never applied outside local Docker) and migration 124 now only changes the two capture RPCs.
- **Reconciliation step 7 counts a refund only when one was requested** (a refusal or a lost race returns null); test. `reconcile.ts`'s local wrapper is `countRefundStatus`, no longer an alias of `applyRefundStatus`.
- `CancellationCard` extends `CancellationTerms`; the operator view reuses `BookingPaymentView` and `toPaymentView`; the unused `CancellationTerms` re-export is gone; the Postman runner's slot dates use `addDays(madridDate())` (Madrid calendar, test updated); `next.config.ts` builds the four capability entries from `CAPABILITY_PATH_PREFIXES`, and its comment and the booking page's no longer claim things the code does not do.

Skipped:

- **A range availability RPC for the operator view** (14 calls per active experience, run in parallel): fine at demo scale; revisit with Phase 6 timing, together with Phase 3's search-tool note.
- **Fewer round trips in the cancel path and the operator view's two waves:** one or two queries each; not worth the complexity now.
- **One helper for the three `refundCapture` call sites:** their amount sources and error handling differ (compensation, follow-up, cancellation); the shared part is two lines.
- **Shared test mocks** (operator route tests, the guarded-write result constants in five unit-test files): test-only duplication; worth doing if more route tests appear.
- **The operator dashboard's own status labels:** merchant-facing wording, deliberately different from the visitor's for `needs_attention` and `expired`.
- **Test-only exports and a shared cancellation-message helper:** low value.

### Phase 6

1. **The research document was already committed** (Phase 0, `985f570d`); cleanup item 6 needed nothing.
2. **`docs/agents/` untracked as the plan says, with two choices the plan did not anticipate.**
   - The folder also held reference documents, not only agent reports: `elevenlabs-modernization-handoff.md` (which `CLAUDE.md` tells agents to read), `elevenlabs-parameter-tuning-guide.md`, `paisaxe-voice-agent-test-plan.md`, `shared-context.md`, `google-ai-pro-analysis.md` and two JSON test registries. Chose the plan's default (untrack the whole folder), so new reports stay local. **Correction (Phase 6 review finding 2):** untracking does not unpublish: all 23 files remain in git history (413 commits touch the path), including the security, pre-launch and cost reports. A pattern scan found no secrets (only ElevenLabs test ids), but making the repository public exposes that history unless it is purged; that is an owner decision before `gh repo edit --visibility public`. They stay as local copies, so the `CLAUDE.md` reference still works in the owner's checkout; a public clone does not have them. Moving any of them to a tracked folder is an owner decision at publication.
   - `scripts/agents/cc-rpi-update.sh` stays tracked although `scripts/agents/` is now ignored: `scripts/tests/cc-rpi-update-fallback.test.sh` copies it from the repository.
   - Merging this phase into a checkout where those files are tracked deletes them from its working tree; the merge step backs them up and restores them as ignored local copies.
3. **Writers to the newly ignored paths** (checked): the agent scripts create their folders (`mkdir -p`); `scripts/create-paisaxe-tests.py` did not, and now does. Two follow-ups outside this phase's files: the triage skill's private-repository step runs `git add … docs/agents/ logs/ scripts/agents/`, which git refuses for ignored paths (already true for `logs/` before this phase), and `scripts/commit-reports.sh` becomes a no-op; both belong to the owner's publication decision.
4. **`npm run eval:booking` takes `ANTHROPIC_API_KEY` from the environment first**, then the owner's `.env.local`, so a fresh clone can run it (README updated).
5. **Evaluation re-run on the candidate (F07): 6 of 6** with the real model (`docs/hackathon/evaluation/2026-10-03-phase6.json`; the Phase 3 file is unchanged). Scenario 1 needed one clarification.
6. **Alerting runbook:** a "PayPal Booking Deposits" section documents the four markers the plan names and the other money-relevant markers from Phases 4 and 5 (`[PAYPAL_CAPTURE_DENIED]`, `[PAYPAL_COMPENSATING]`, `[PAYPAL_REFUND_FAILED]`, `[PAYPAL_REFUND_REFUSED]`, `[BOOKING_CANCEL_REFUND_FAILED]`, the webhook markers), with fields checked against the code, and read-only diagnosis queries.
7. **The scripted booking model is `BOOKING_AGENT_REPLAY`, not `ANTHROPIC_TRANSPORT=mock`.**
   - Plan said: an `ANTHROPIC_TRANSPORT=mock` fixture replaying a recorded tool sequence.
   - Found: that variable only switches the discovery chat between SDK and curl; the booking agent instantiates its own SDK client.
   - Chose: `src/lib/booking/replay-model.ts` replays `e2e/fixtures/booking-agent-replay/<name>.json` (scenarios matched on the visitor's words; tool calls run through the real tool executor, so rows, cards and capability links are real). It throws when `NODE_ENV=production` or `VERCEL`/`VERCEL_ENV` is set, so the chat fails closed with `ai_unavailable` (unit-tested; also seen on a local Preview build). `.env.example` documents it as E2E-only.
8. **Probe details.** Selectors carry `@release-required @local-docker <id>` (the manifest validator requires the first tag). `booking-access-boundary` has its own spec file. "Another user's booking id is 404 in the chat tool route" is asserted as the tool's `not_found` result inside the 200 SSE stream: no HTTP route takes a raw booking id. The Preview assertions use a second local server (a production build with `VERCEL_ENV=preview`). `release-required-local` now runs `next dev`, because the mock's loopback base and the replay are refused in production; `bypassCSP` is scoped to that project. The mock completes refunds at once, so the round trip ends `refunded` without a webhook step. Each boundary gate was proven by mutation, run by the unit's implementer against local Docker with every file restored from a backup afterwards: removing the token check in `links.ts` let a wrong token through (200, not 404); requiring a session in `view.ts` made the cookie-less capability 404; removing `.eq("user_id")` in `getBookingForUser` let the chat tool return the other user's booking; removing the redemption check in `gate.ts` turned the 404 into a 500; removing the Preview rule in `surface.ts` (Preview rebuilt) opened access, chat and `/acceso` (200); removing it in the capability guard opened the capability on Preview (200). The independent reviewer found the assertions not vacuous by reading (soft expectations still fail the test, a liveness check precedes the Preview assertions, cleanup asserts zero rows) but did not re-run the mutations.
9. **Rate limits added where the audit found none** (hardening checklist): quote accept, 20 a minute per user, before the attempt allowance; PayPal webhook, 120 a minute per IP, before the verification call PayPal is asked to make (header-less requests are still refused first). Tested.
10. **`release-checklist.md` section 2** now gives the full local-probe command (anon and service keys, a local QA user) and the warning not to run another dev server or build in the same checkout during the run.
11. **A circular import caught by the gate's `lint:deps`:** `replay-model.ts` imported the `BookingModelClient` type from `agent.ts`, which loads the replay. The type (with its stream shape) moved to `src/lib/booking/model-client.ts`, imported by both; types only, so behaviour is unchanged (agent, replay and route tests re-run; the final gate re-runs the suite and the build).
12. **Two Phase 1 live tests were timing-dependent once later phases added live test files running in parallel**, and the pre-commit hook's full runs hit both: `expire_holds`'s returned count can be 0 when reconciliation in another file expires the same lapsed hold first (the test now asserts the rows, the real oracle); and the migration-116 idempotence snapshot counted every merchant and experience in the database, which other files create and delete (it is now scoped to the fixture merchant).

### Phase 6 review dispositions

Independent reviewer (fresh context): CHANGES REQUESTED, two majors (one an owner decision); the code itself sound. Checks the reviewer ran: `check-required-probes`, the release-script and new route tests, the three typechecks, eslint, knip, `check-env`, `check-verification-coverage`, and the `release-required` project selection (only the read-only spec; no `@local-docker` probe selectable).

| # | Severity | Finding | Disposition |
|---|----------|---------|-------------|
| 1 | major | `booking-gate-closed` required `/acceso` to render, but Phase 7 runs the read-only probes before it turns the flag on, so the analyzer would block the release | **Fixed:** the probe reads the deployed `experience_booking` flag from the public `/api/feature-flags` endpoint and asserts the gate accordingly (on: the code form; off: a real 404); the unknown-capability 404 holds in both states. Manifest title and notes updated; `check-required-probes` passes. Run locally in both flag states at the gate |
| 2 | major (owner) | Untracking `docs/agents/` does not remove it from history | **Owner decision before publication** (purge or accept); deviation 2 corrected |
| 3 | minor | No recorded evidence of the boundary mutations | **Recorded** in deviation 8 (from the implementer's run) |
| 4 | minor | A failed second or third user creation leaked the earlier local auth users | **Fixed:** each user is recorded for cleanup as soon as it exists |
| 5 | minor | A public clone lacks `docs/agents/`, which `CLAUDE.md:223`, `docs/operations/operations.md` and two ElevenLabs test scripts reference | **Owner decision at publication** (deviation 2): move the reference documents to a tracked folder or accept the broken references; nothing in CI or the tests depends on them |
| 6 | minor | The webhook limit fails closed in production when Upstash is unreachable | **Accepted and documented** in the runbook: PayPal redelivers and reconciliation queries PayPal, so nothing is lost |
| 7 | nit | `npm run eval:booking` would silently use the replay if `BOOKING_AGENT_REPLAY` were set | **Fixed:** the evaluation refuses to start with it set |
| 8 | nit | The README said the browser flow cannot run locally at all | **Fixed:** it now names the `booking-roundtrip` probe |

Re-review: **APPROVE.** The reviewer confirmed `/api/feature-flags` and the proxy read the same rows with the same environment, so a disagreement fails the probe in either direction. Caveats for Phase 7: for up to about three minutes after the flag flips (the endpoint's CDN cache and the server-side flag cache), the two can disagree and the probe fails loudly; re-run it before investigating. Never point the probe at a Preview, where the flags can read "on" while the Preview rule closes the surface.

### Phase 6 simplify pass

Two read-only reviewers. Applied (behaviour unchanged): the two booking specs share `NOTHING_LEFT` and `randomSlotDate()` (Madrid calendar, through the runner's `slotDateAfter`) from `e2e/fixtures/booking-local.ts`, and the cleanup oracle's eight counts run in parallel; the round trip no longer looks the guest up twice; the replay model compiles each scenario's pattern once at parse time, hoists the whole-placeholder regex, resolves a missing value in one place and inlines its usage object; the analyzer test derives its evidence from the one filtered manifest.

Skipped:

- **The second (production) build on every `release-required-local` run** for the Preview-isolation assertions: a second `next dev` with `VERCEL_ENV=preview` and its own `distDir` would be cheaper but is unproven on Next 16 with two dev servers; correctness of the release gate first. Revisit if the run time hurts.
- **Selecting the servers from `--project` in argv** rather than an explicit variable: misuse fails loudly, and the checklist command is exact.
- **One helper for the feature-flag upsert** (psql in the runner, supabase-js in the specs): different contexts.
- **The typed SSE parser** (`parseSseEvent`): it drops malformed cards silently, which would weaken the "no booking card" assertion; the permissive parser stays.
- **The `[n]` array-index branch of the replay placeholders**: documented in the header; kept.
- **A shared 429 helper for the two new rate limits**: they follow the inline pattern of about ten routes; a cross-route cleanup, not this phase.

### Phase 8a

1. **Invoicing v2 is plain `fetch`, not the SDK.**
   - Plan said: `invoices.ts` with `createInvoice` and `sendInvoice` (PayPal Invoicing v2).
   - Found: the pinned SDK commit has no invoicing resource.
   - Chose: `src/lib/paypal/invoices.ts` (`createInvoice`, `sendInvoice`, `getInvoice`) calls the REST API through the adapter's `createPaypalFetch`, `getAccessToken` and timeout, like `webhooks.ts`; recorded in `pay-pal-server-sdk-plan.md`. Idempotency: PayPal-Request-Id `invoice:<booking id>` (create) and `invoice-send:<booking id>` (send). `createInvoice` asks for `return=representation` and reads the invoice when PayPal answers with only its self link. `getInvoice` was added because the settled-balance check reads the invoice.
2. **Recipient: the payer email of the captured order, read at PayPal, never stored.** `getOrder` now normalizes `payer.email_address` (else `payment_source.paypal.email_address`) as an optional `payerEmail`. The invoice reads the booking's `captured` payment's order. A missing email is `invalid_state`, logged `[PAYPAL_INVOICE_NO_PAYER]`.
3. **Webhook event `INVOICING.INVOICE.PAID`** (PayPal's documented invoicing event, quoted in item 11; not observed in a sandbox run). It is dispatched before payment resolution in `processPaypalEvent`; the invoice id is read from the stored payload (`resource.invoice.id`, else `resource.id`), so a replay needs only the inbox row and no inbox migration. Unknown invoice: `PaypalWebhookUnmatched` (drain filter). New outcome `unsettled` (marked processed).
4. **Settled means:** PayPal invoice `PAID`, `due_amount` 0, `payments.paid_amount` = invoice `amount` = the booking's balance, currency EUR. `PAYMENT_PENDING` and `PARTIALLY_PAID` set `invoice_status` to `payment_pending` / `partially_paid` only. `MARKED_AS_PAID` (recorded by the merchant, not paid through PayPal) is not settled. A `PAID` invoice failing a check logs `[PAYPAL_INVOICE_MISMATCH]` and writes nothing.
5. **Migration 125 adds `bookings.invoice_id` (unique), `invoice_status` (`draft|sent|payment_pending|partially_paid|paid`), `invoice_url` and `balance_paid_at`**, with CHECKs that the id and status exist together and that `balance_paid_at` is set exactly when the status is `paid`. Applied to local Docker with `psql` (twice, re-runnable), not through the migration runner.
6. **The tool also re-reads an existing invoice** (`send_balance_invoice` on a booking that has one): never a second invoice or send, but the answer reflects a payment made since, which also covers a pending payment that settles without a second event. A PayPal failure on that re-read keeps the stored status (`[PAYPAL_INVOICE_REFRESH_FAILED]`).
7. **Smaller choices.** A slot date already past (Madrid calendar) is refused before creating an invoice. The booking page shows the invoice whenever one exists, whatever the booking status. The payer link is offered while something is due (`sent`, `partially_paid`). One booking rule line names the tool in `buildBookingInstructions()` (cached block; static).
8. **Cancellation closes the invoice (follow-up).** When `confirm_cancellation` records a cancellation (`cancelled` or `cancel_pending`), `confirmCancellation` calls `closeInvoiceAfterCancellationSafely` after the deposit refund, in a `finally`, so a PayPal error can neither block nor fail the cancellation (`[PAYPAL_INVOICE_CANCEL_FAILED]`). An open invoice (`sent`, `payment_pending`) is cancelled at PayPal and recorded `cancelled` (migration 125's CHECK gains `cancelled`); a `draft` is recorded `cancelled` without a PayPal call (it was never sent). A failed cancel re-reads the invoice: already `CANCELLED`/`AUTO_CANCELLED` counts as done; `PAID` meanwhile is recorded paid. Reconciliation step 9 retries every booking with `cancellation_confirmed_at` whose invoice is still `draft`/`sent`/`payment_pending`.
9. **A balance already paid is never refunded automatically (known limitation).** The plan's refund policy covers the deposit only. When a cancelled booking's balance is `paid` (or `partially_paid`), the invoice is left alone and, once the cancellation is complete (booking `cancelled` or `refunded`), the booking is flagged `needs_attention` and `[BOOKING_BALANCE_PAID_ON_CANCEL]` is logged; while its refund is still pending, reconciliation step 9 flags it after the refund completes. The operator refunds the balance by hand; the visitor's page then shows the review message.
10. **`INVOICING.INVOICE.CANCELLED`** marks an open (`draft`/`sent`/`payment_pending`) invoice `cancelled` and nothing else; a redelivery is recorded again; a paid or partially paid invoice is left as it is (`out_of_order`).
11. **Documentation checked (2026-10-04), quoted verbatim.** Sources: the Invoicing v2 OpenAPI file published at `developer.paypal.com/docs/api/invoicing/v2/schema.json` (version 2.12.0; the page itself renders only summaries) and `developer.paypal.com/api/rest/webhooks/event-names/`.
    - Cancel: path `/v2/invoicing/invoices/{invoice_id}/cancel`, operationId `invoices.cancel`, "Cancels a sent invoice, by ID, and, optionally, sends a notification about the cancellation to the payer, merchant, and CC: emails."; request body schema `notification`, `"required": true`; properties `send_to_invoicer` ("Indicates whether to send a copy of the email to the merchant.", default false) and `send_to_recipient` ("Indicates whether to send a copy of the email to the recipient.", default true); success `204`. We send `{send_to_invoicer: false, send_to_recipient: true}`.
    - Send: "A successful request returns the HTTP `200 OK` when the invoice issue date is current date." (body `link_description`) and `202`: "The server has accepted the request and will execute it at a later time."
    - Create: "A JSON response body that shows invoice details is returned if you set <code>prefer=return=representation</code>."
    - Payment term: "The payment due date for the invoice. Value is either but not both <code>term_type</code> or <code>due_date</code>." **This corrected a defect:** the first version sent both; `createInvoice` now sends `payment_term: {due_date}` only.
    - `due_amount`: "The due amount, which is the balance amount outstanding after payments."; `payments.paid_amount`: "The aggregated payment amounts against this invoice."; `metadata.recipient_view_url`: "The URL for the invoice payer view hosted on paypal.com."
    - Statuses include `PAID` ("The payer has paid for the invoice."), `PARTIALLY_PAID`, `PAYMENT_PENDING` ("The invoicer is yet to receive the payment for the invoice. It is under pending review."), `MARKED_AS_PAID` ("The invoice is marked as paid by the invoicer."), `CANCELLED`, `AUTO_CANCELLED`.
    - Events: "`INVOICING.INVOICE.PAID` | An invoice is paid, partially paid, or payment is made and is pending." and "`INVOICING.INVOICE.CANCELLED` | A merchant or customer cancels an invoice."
    - **Unverified:** the webhook `resource` shape of both events (the event-names page has no payload sample); the code reads `resource.invoice.id`, else `resource.id`. **Not documented:** `PayPal-Request-Id` on create, send and cancel (the spec lists it only for conditional rules), so it is sent on create and send as best effort, not relied on: the guarantee is `bookings.invoice_id` set once plus re-reading the invoice. Residual: if a create answer is lost and PayPal ignores the header, an unsent orphan draft can remain (never visible to the payer).
12. **Not done here:** subscribing the production webhook to `INVOICING.INVOICE.PAID` and `INVOICING.INVOICE.CANCELLED` (PayPal dashboard, owner); the manual sandbox run the acceptance gate requires.

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
