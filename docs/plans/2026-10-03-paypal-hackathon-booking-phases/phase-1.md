# Phase 1: Booking domain

**Window:** 2026-10-09 to 10-14
**Worktree:** `../paisaxe-hackathon-phase1` on `feature/booking-domain` from `develop`
**Depends on:** Phase 0 accepted
**Batch-eligible units:** `[schema]` first; `[service]` after `[schema]` is merged locally (file overlap on types).
**Revision 3:** `accept_quote` rechecks inside the lock (R2-03); the inbox stores the verified payload and normalized identifiers (R2-04); `payments.compensation_reason`.
**Revision 2:** one inventory owner and atomic acceptance (F04), provider facts (F07), webhook inbox columns (F03), derived capabilities instead of stored token hashes (F05), `expired` and `refund_failed` states.

## Goal

The authoritative data model and the server-side booking service with its invariants,
tested against local Docker Supabase. No HTTP routes yet.

## Unit [schema]: migrations 112 onward

Re-check the next free number with `ls supabase/migrations | tail -1` before writing
(another worktree may add one). Every table gets the service-role trio
(`supabase/migrations/107_pending_bookings_rls_posture.sql:21-29` is the template),
every SECURITY DEFINER function has `SET search_path = ''`, and the new tables are
added to `SENSITIVE_SERVICE_ROLE_TABLES` in `scripts/check-migrations.ts:55-63`.

| File | Contents |
| --- | --- |
| `112_experience_booking_schema.sql` | `merchants`, `experiences`, `experience_facts`, `booking_drafts`, `quotes`, `holds`, `bookings`, `payments`; CHECK constraints for statuses; `updated_at` triggers (pattern `053:44-58`); indexes on `(experience_id, slot_date)` for holds and bookings; unique `payments.order_id`; unique `holds.quote_id`; unique `bookings.quote_id` |
| `113_booking_rpcs.sql` | `experience_availability(p_experience_id uuid, p_date date)`, `accept_quote(p_quote_id uuid, p_user_id uuid)`, `reacquire_hold(p_booking_id uuid)`, `consume_hold_and_confirm(p_booking_id uuid, p_capture_id text)`, `expire_holds()`, all SECURITY DEFINER, EXECUTE to service_role only (pattern `099:130-131`, `110`) |
| `114_vouchers.sql` | `vouchers`, `voucher_redemptions`, widen `voice_purchases_purchase_type_check` to include `voucher_pass` (pattern `099:36-44`), `grant_voucher_voice_pass_idempotent(p_redemption_id uuid, p_until timestamptz)`, `consume_voucher_counter(p_redemption_id uuid, p_counter text)` |
| `115_paypal_webhook_events.sql` | Inbox `paypal_webhook_events(event_id text unique, event_type, payload jsonb, order_id text, capture_id text, refund_id text, custom_id text, verification text, received_at, processed_at, attempts int default 0, last_error text)`: the verified payload and the normalized identifiers are stored so an event can be replayed after the request has ended (R2-04); indexes on `order_id` and on `processed_at is null`; `upsert_paypal_event(p_event_id, p_event_type, p_payload, p_order_id, p_capture_id, p_refund_id, p_custom_id, p_verification) returns text` (one of `new`, `pending`, `processed`); `mark_paypal_event_processed(p_event_id)`; `mark_paypal_event_failed(p_event_id, p_error)` |
| `116_operator_access_and_fixture.sql` | `operator_access(id, merchant_id, label, link_version, expires_at)`; idempotent upsert of the fixture merchant and its three experiences with their facts (below) |
| `117_feature_flag_experience_booking.sql` | insert `experience_booking` for development (true) and production (false), pattern `052:5-12` |

### Status contracts

- `bookings.status`: `pending_payment | confirmed | cancel_pending | cancelled | expired | refund_pending | refunded | needs_attention`.
  Columns `cancellation_confirmed_at timestamptz`, `refund_cents int`, `link_version int default 1`.
- `payments.status`: `created | approved | capture_pending | captured | capture_failed | expired | refund_pending | refunded | refund_failed`.
  Columns `operation_key uuid unique`, `reconcile_passes int default 0`, `compensation_reason text`.
  `capture_pending` means the outcome is unknown and stays reconcilable; `capture_failed` is written only on authoritative provider evidence (R2-02).
- Never free text (contrast `pending_bookings`, `supabase/migrations/106_booking_orphaned_reconciliation.sql:21-23`); a new state is a migration.

### Fixture (migration 116)

Merchant `demo-rutas-del-sella`, `is_fixture = true`, name "Rutas del Sella (demo,
ficticio)", timezone Europe/Madrid, cancellation window 24 h. All experiences: capacity
12 per slot, every weekday, start times 10:00 and 16:00, EUR.

| Experience | Price / deposit | Max party | `step_free` | Other facts |
| --- | --- | --- | --- | --- |
| Paseo por la senda costera | 120 / 30 | 6 | `yes`, confirmed by provider | `public_transport` yes; `languages` es, en; `min_age` 0 |
| Descenso en canoa | 60 / 15 | 4 | `no`, confirmed by provider (embarcadero con escalones) | `equipment_included` yes; `min_age` 8 |
| Ruta de miradores en 4x4 | 200 / 50 | 6 | `unknown`, not confirmed | `public_transport` no; `pets_allowed` unknown |

The three `step_free` values exist so the representative request (research section 2)
has a suitable option, a rejected option and an honestly unknown one.

### RPC contracts

```
@ experience_availability(p_experience_id, p_date) -> table(start_time, available)
ctx: Postgres, SECURITY DEFINER, search_path ''
do:
  1. for each start time in the experience's slot rule on that weekday
  2. confirmed = sum(party_size) of bookings status confirmed for (experience, date, time)
  3. held = sum(party_size) of holds with expires_at > now(), released_at null, consumed_at null
  4. available = capacity_per_slot - confirmed - held
risk: a pending_payment booking is represented only by its hold; never add it separately (F04)
```

```
@ accept_quote(p_quote_id, p_user_id) -> booking row
ctx: Postgres tx, SECURITY DEFINER, search_path ''
pre: quote belongs to p_user_id
do:
  1. fast path: if a booking already exists for the quote -> RETURN it
  2. SELECT experience FOR UPDATE (serializes acceptance per experience)
  3. **recheck inside the lock:** if a booking now exists for the quote -> RETURN it (the concurrent first request committed while this one waited; R2-03)
  4. validate quote not expired, not superseded
  5. compute availability for the slot; if party_size > available -> RAISE 'no_capacity'
  6. INSERT hold (expires_at = now() + 15 min); INSERT booking pending_payment with reference "RS-" + 6 chars; SET quote.accepted_at; SET draft status accepted
  7. RETURN booking
fail: expired or superseded -> RAISE 'quote_expired'; foreign quote -> RAISE 'not_found'; unique_violation on holds/bookings.quote_id (belt and braces) -> RETURN the committed booking
fx: one hold + one booking per quote, enforced by unique(quote_id) on both
risk: the fast path alone is not idempotency; step 3 is
```

```
@ reacquire_hold(p_booking_id) -> boolean
ctx: used only by the capture path when the buyer approved and the hold then expired
do:
  1. lock experience; 2. recompute availability for the booking's slot
  3. if party_size <= available -> extend the hold's expires_at by 10 min, RETURN true
  4. else RETURN false
```

```
@ consume_hold_and_confirm(p_booking_id, p_capture_id) -> text
do:
  1. if booking already confirmed with the same capture -> RETURN 'already_confirmed'
  2. require hold live (not released, not consumed, not expired)
  3. SET hold.consumed_at; booking.status = confirmed, confirmed_at; payment.status = captured, capture_id
  4. RETURN 'confirmed'
fail: hold not live -> RAISE 'hold_not_live' (caller re-acquires or compensates)
```

`upsert_paypal_event` inserts with `processed_at` null and returns `'new'`; on conflict
returns `'processed'` when `processed_at` is set, else increments `attempts` and returns
`'pending'` (F03).

## Unit [service]: `src/lib/booking/`

Files: `types.ts`, `availability.ts`, `facts.ts`, `quotes.ts`, `bookings.ts`,
`drafts.ts`, `links.ts`, `fixtures.ts` (constants shared with tests), each with a
`.test.ts`, plus `booking.postgrest-integration.test.ts` using
`src/test/local-supabase.ts:23-88`. All functions take a service client
(`createAdminClient()`) and the acting `userId`.

```
@ createQuote(userId, draftId, experienceId, slotDate, slotTime, partySize) -> Quote
ctx: DB(service), experiences, booking_drafts
pre: draft belongs to user; experience active; partySize <= max_party
do:
  1. read price and deposit from the experience (never from input)
  2. supersede any open quote on the draft (superseded_at)
  3. insert quote version = max+1, expires_at = now + 20 min, cancellation_terms from merchant
  4. return quote with balance = total - deposit
fail: draft not owned -> NotOwned; experience inactive -> NotFound
```

`acceptQuote(userId, quoteId)` calls the `accept_quote` RPC and maps its errors to
`NoCapacity`, `QuoteExpired`, `NotFound`; it returns the booking and the capability link.

`links.ts` (F05):

```
@ bookingLink(booking) -> "/booking/" + id + "." + token
ctx: BOOKING_LINK_SECRET (>= 32 bytes, getEnv), node:crypto
do:
  1. token = base64url(HMAC-SHA256(secret, "booking:" + id + ":" + link_version))
  2. return path
@ verifyBookingCapability(capability) -> Booking | null
do:
  1. split at the first "." into id and token; reject malformed
  2. load booking by id; recompute expected token from its link_version
  3. safeEqual(expected, token) (src/lib/safe-equal.ts:23-32) -> booking, else null
risk: never log the capability; operatorLink/verifyOperatorCapability use purpose "operator:"
```

`facts.ts`: `evaluateConstraints(experience, constraints) -> {key, verdict: "supported" |
"unsupported" | "unknown", detail, confirmedByProvider}[]`, mapping visitor constraints
(`step_free`, `public_transport`, `pets`, `min_age`, `language`) onto `experience_facts`.

`drafts.ts`: `getOrCreateOpenDraft(userId)`, `updateDraft(userId, patch)` (zod patch:
partySize 1..12, date within the next 90 days, time, budgetCents, constraints from the
closed key list), `abandonStaleDrafts()`.

`availability.ts`: `listAvailability(experienceId, fromDate, days)`;
`searchExperiences({partySize, date, budgetCents, constraints})` returning every
experience with its slots **and its constraint verdicts**, so unsuitable options are
returned as rejected with a reason rather than silently dropped.

## Tests (TDD: write first)

Unit (mocked client): quote math, superseding, link derivation and verification
(rebuild from id; wrong token; bumped `link_version` invalidates), draft validation,
constraint evaluation for all three verdicts.

Integration on local Docker (skip when unreachable, like
`src/app/api/webhooks/stripe/route.postgrest-integration.test.ts:42-46`):
- last-slot race: capacity 4, two different quotes for 4, `accept_quote` in
  `Promise.all`, exactly one succeeds;
- two simultaneous accepts of the **same** quote **both succeed and return the same
  booking**, with one hold; the test forces the interleaving where both pass the fast
  path before either holds the lock (R2-03);
- inventory accounting (F04): after accepting a party of four, availability drops by
  exactly four; after the hold expires (clock advanced) it returns in full with no cron
  run; after confirmation it stays at minus four; after cancellation it returns;
- expired quote cannot be accepted; `reacquire_hold` succeeds while capacity remains
  and fails when another booking took it;
- `consume_hold_and_confirm` twice returns `already_confirmed`;
- anon and authenticated cannot select any booking table or execute any booking RPC;
- fixture seed is idempotent on `supabase db reset` run twice and yields the three
  `step_free` values;
- `grant_voucher_voice_pass_idempotent` inserts one `voice_purchases` row with
  `purchase_type = 'voucher_pass'`; a second call for the same redemption inside the
  pass window returns `duplicate`;
- `upsert_paypal_event` returns `new`, then `pending`, then `processed` after
  `mark_paypal_event_processed`; the stored row contains the payload and the
  normalized order, capture and custom ids.

## Acceptance gate

Automated: `npm run check-migrations`, `npm run test -- --maxWorkers=4`,
`npm run typecheck`, `npm run lint`; integration tests green against
`npx supabase start` + `npx supabase db reset`.

Manual: none.

Stop for acceptance. Do not merge into `develop` until accepted; keep the worktree.
