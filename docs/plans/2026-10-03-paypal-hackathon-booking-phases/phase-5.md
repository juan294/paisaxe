# Phase 5: Cancellation, operator view, Postman collection, and validation (5b)

**Window:** 2026-10-26 to 10-31; validation 5b on 10-28 to 11-02
**Worktree:** `../paisaxe-hackathon-phase5` on `feature/booking-after-payment` from `develop` (after Phase 4 merged)
**Depends on:** Phase 4 accepted (it owns the refund primitive and the reconciliation retry branch)
**Batch-eligible units:** `[cancel]` (tool, routes, booking page section), `[operator]` (operator pages and API, seed script), `[postman]` (collection files). No file overlap; `[cancel]` merges first because `[operator]` renders its states.
**Revision 3:** confirmation carries the terms the visitor saw and is refused if they changed (R2-05).
**Revision 2:** cancellation preview is read-only and only the confirm endpoint authorizes (F01); refund failure outcomes; validation restored as unit 5b (F08).

## Goal

What happens after payment is truthful and visible: a visitor can see what a
cancellation would refund without committing to it, cancel and get the policy's refund
exactly once, the merchant can see and operate bookings, a judge can reproduce the API
journey from a Postman collection, and real people have tried the flow.

## Unit [cancel]

### Preview: read-only (F01)

```
@ preview_cancellation({bookingId}) -> cancellation card        (model tool)
@ GET /api/booking/bookings/[capability]/cancellation-preview   (booking page)
ctx: DB(service) read only
pre: tool: booking owned by the user; page: valid capability; booking confirmed
do:
  1. refundCents = deposit if now < slot_start - cancellation_window_hours else 0
  2. return card {refundCents, policySentence, slotStart, termsValidUntil (the cutoff instant if a refund is due), confirmAvailable: true}
fx: none. No status change, no column written, no inventory change
risk: the card may be stale; the confirm endpoint recomputes
```

### Authorization: the confirm endpoint only

```
@ POST /api/booking/bookings/[capability]/cancel {expectedRefundCents} -> {status} | 409 {preview}
ctx: DB(service), paypal.refundCapture; CSRF via proxy; capability verified
pre: booking confirmed, or cancel_pending/refund_pending/refunded/cancelled (idempotent replies)
do:
  1. if not confirmed -> return current status, no PayPal call
  2. recompute refundCents from the policy at this instant
  3. **if refundCents != expectedRefundCents -> 409 terms_changed with the fresh preview; write nothing** (R2-05)
  4. one UPDATE: status cancel_pending, cancellation_confirmed_at = now(), refund_cents = the server's value
  5. if refundCents > 0: refundCapture(capture_id, refundCents, operation_key) -> payment refund_pending, refund_id; booking refund_pending
  6. else: booking cancelled; payment stays captured
  7. return status (inventory returns because availability counts only confirmed bookings and live holds)
fail: PayPal error at 5 -> booking stays cancel_pending with cancellation_confirmed_at set; 502 with a retry message; Phase 4 reconciliation retries with the same operation key
risk: expectedRefundCents is an expectation to verify, never authority: the refund is always the server's computation. Nothing but this endpoint sets cancellation_confirmed_at
```

- The chat card's confirm button and the booking page's confirm button both call this
  endpoint with the capability. The model has no tool that reaches it.
- Booking page: cancellation section showing the preview, a confirm button with the
  amount in its label ("Cancelar y recibir 30,00 €"). On `terms_changed` the page and
  the chat card replace the preview with the new terms ("Las condiciones han cambiado:
  ahora el reembolso es 0,00 €") and require a second, explicit confirmation of those
  terms. States `refund_pending`
  ("Reembolso en curso", refund id), `refunded`, `refund_failed` ("No se pudo completar
  el reembolso; lo estamos revisando").
- Translations `booking.cancel.*` in six locale files.

## Unit [operator]

- `scripts/booking/create-operator-link.ts`: inserts `operator_access` for a merchant
  slug and prints the derived `/operator/<id>.<token>` link (Phase 1 `links.ts`).
  Production use is owner-authorized.
- `src/app/operator/[capability]/page.tsx` (server component, service client,
  `notFound()` on bad or expired capability): header with the merchant name and the
  "demo" label; table of bookings from today onward and the last 7 days: reference,
  slot, party, status, deposit, balance due, payment ids, exceptions
  (`needs_attention`, `refund_pending`, `refund_failed`); summary tiles (upcoming,
  deposits collected, balance due, exceptions). shadcn `card`, `button`, `stat-card`
  as in the admin panels; no admin layout and nothing under `/admin`.
- Actions: `POST /api/operator/[capability]/holds/[holdId]/release` (release a live
  hold) and `POST /api/operator/[capability]/bookings/[bookingId]/reissue-link`
  (increments `link_version` and shows the new visitor link once). Both CSRF-protected
  and logged without the capability.
- Daily capacity view: for the next 14 days, per start time, availability from the RPC.
- **AG Studio was skipped by the owner on 2026-10-03; build the native view only.** The
  following bullet is kept for the record and does not apply. If Phase 0 recorded an AG
  Studio "yes": replace the table with the Studio grid plus
  one custom widget (booking timeline) and the Studio agent reading the same server
  payload; license key in `AG_STUDIO_LICENSE_KEY`, registered in `.env.example`, never
  committed. Otherwise skip this bullet.

## Unit [postman]

- `docs/hackathon/postman/paisaxe-booking.postman_collection.json` and
  `paisaxe-booking.postman_environment.template.json` (empty values): voucher
  redemption, booking status by capability, quote acceptance, capture, cancellation
  preview and confirm; assertions for 404 without access, 409 on a stale quote, 401 on
  an unsigned webhook, and a redelivered processed webhook → 200 with no change.
  `docs/hackathon/postman/README.md` explains the interactive PayPal approval step and
  the anonymous session cookie.
- Run it once with the Postman CLI against local Docker; store the run summary (no
  secrets) in the phase evidence.

## Unit 5b: Validation with people (F08)

Owner decision of 2026-10-03: the "middle" scope. Five testers are the core. The
provider conversation happens only if one comes easily, and a backup that needs no
provider is prepared regardless. **Nothing here involves real money, real bookings or
anyone signing up:** testers use the fictitious merchant and a PayPal sandbox buyer
account, and a provider is only asked questions.

Owner-led; the agent prepares and summarizes. Contact with testers and providers is the
owner's action.

1. **Materials** (agent, by Oct 28): `docs/hackathon/validation/script.md` with one task
   ("reserva una actividad para cuatro personas el sábado con un presupuesto de 120 € y
   una persona que necesita un recorrido sin escalones") and no hints; an observation
   sheet; three comprehension questions asked afterwards: how much did you pay now, how
   much is still due and when, what happens if you cancel tomorrow. Sandbox buyer
   credentials on a card to hand over.
2. **Five testers** (owner recruits; friends and family are fine; about ten minutes
   each; on the owner's laptop with local Docker and the real sandbox, or the Phase 4b
   build over the tunnel): each attempts the task unassisted. Record per person:
   completed or not, time to a confirmed booking, the step where they hesitated or
   abandoned, answers to the three questions.
3. **Provider evidence, in three tiers.** Tier A is the goal; B and C are the backup
   and are prepared whether or not A happens.

   | Tier | What | Who | When |
   | --- | --- | --- | --- |
   | A | One 20-minute conversation with someone who runs activities: how do you take bookings today, would this save you work, what would stop you using it. They commit to nothing | Owner | Any time up to Nov 3 |
   | B | The same three questions as a short written message to three to five providers, by email or WhatsApp; any reply counts | Agent drafts in Spanish in week 1; owner sends | Sent by Oct 9 so replies have four weeks |
   | C | **Desk evidence, no contact needed:** the agent surveys the public websites of ten Asturias activity providers and records, for each, how a visitor books (phone, WhatsApp, email form, online calendar), whether a deposit can be paid online, and whether accessibility information is published. Results in `docs/hackathon/validation/provider-desk-survey.md` with the URL and date for each | Agent | Phase 0 or 1, in the background |

   **Backup rule:** if no Tier A conversation has happened by the Nov 3 freeze, the
   submission uses Tier C, plus any Tier B replies. The pitch then says exactly what it
   has: "N of 10 providers surveyed offer no online booking or deposit" as an
   observation of public websites, and that no provider has been interviewed yet. It
   does not imply endorsement or adoption.
4. **Act on it:** fix the single largest friction the testers hit before the Nov 3
   freeze; record anything not fixed as a known limitation.
5. **Write-up** (agent): `docs/hackathon/validation/results.md` with counts, verbatim
   quotes the participants agree to share, which provider tier was reached, and the
   limits: five people, at most one provider, no comparator. No improvement percentage
   and no claim of broad demand.

Acceptance for 5b: the results file exists with the tester rows (or states exactly how
many were reached and why); the desk survey exists with ten providers; the provider
tier actually reached is named; the largest friction has a commit or a known-limitation
entry.

## Tests (write first)

- `cancel.test.ts`: **R2-05 oracle:** preview just before the cutoff shows EUR 30;
  the click arrives just after it with `expectedRefundCents = 3000` → 409
  `terms_changed`, booking still `confirmed`, no refund, no inventory change; a second
  confirm with `expectedRefundCents = 0` cancels with no PayPal call. A client sending
  a higher expectation than the policy allows gets 409, never that refund.
  **Preview writes nothing**; preview, wait beyond ten minutes
  (clock advanced), run reconciliation → no refund, booking still `confirmed`,
  availability unchanged (F01 oracle); confirm → one refund; confirm again → no second
  call; reconciliation retries a failed refund only when `cancellation_confirmed_at` is
  set; refund amount recomputed at confirm time; zero-refund path makes no PayPal call.
- `tools.test.ts`: `preview_cancellation` rejects foreign bookings and returns the card;
  no tool exists that confirms.
- `operator/[capability]/page.test.tsx`: bad capability 404; only the merchant's
  bookings appear; exceptions highlighted; re-issue invalidates the old visitor link.
- `operator/.../release/route.test.ts`: expired or consumed hold → 409.
- Integration: a cancelled booking returns its places to the same slot.
- Analytics exclusion: `stripe-analytics/route.test.ts` unchanged proves it reads only
  Stripe; search for any helper that counts `voice_purchases` rows and, if one exists,
  add a test that `voucher_pass` rows are excluded; if none exists, record that.

## Acceptance gate

Automated: full gates; Postman run green locally.

Manual, on local Docker: preview a cancellation and leave it; twenty minutes later
nothing has changed. Confirm it inside the window; the sandbox shows the refund; the
booking page shows `refund_pending` then `refunded`; the operator link shows the same;
a second confirm does nothing. Record ids. Unit 5b accepted separately when its
results file is in.

Stop for acceptance.

## Handoff (2026-10-03)

**Status:** units [cancel], [operator] and [postman] implemented; unit 5b materials prepared.
Independently reviewed (CHANGES REQUESTED, all minor, plus one money defect found while fixing;
second pass CHANGES REQUESTED, minor; final pass **APPROVE**), simplified, and verified by the full
local gate including CI-conditions coverage and a Postman run on the final tree. Committed on the
feature branch; **not merged into `develop`, not pushed**. The manual acceptance and the 5b
sessions are the owner's.

- **Scope delivered:**
  - Cancellation: migration 123 (`cancellation_terms`, `confirm_cancellation`), `src/lib/booking/cancel.ts`, the read-only `preview_cancellation` tool, `GET …/cancellation-preview` and `POST …/cancel` (R2-05 `terms_changed`, idempotent replies, 409 `invalid_state` outside the flow, 502 `refund_unavailable`), one confirm component for the chat card and the booking page, refund states on the page, `booking.cancel.*` in six locales.
  - Money safety beyond the plan: migration 124 (a confirmed cancellation is never re-confirmed by any capture path), reconciliation step 5 never finalizes it, definitive PayPal refusals end `refund_failed` + `needs_attention` (a `PREVIOUS_REQUEST_IN_PROGRESS` 422 stays retryable).
  - Operator: `/operator/<capability>` (static shell + `GET /api/operator/<capability>`), hold release and link re-issue, 14-day capacity, `scripts/booking/create-operator-link.ts`.
  - Postman: collection, empty environment template, README, loopback-only runner `scripts/booking/postman-local.ts`, run summary.
  - 5b: `docs/hackathon/validation/script.md` and `observation-sheet.md` (the desk survey and the provider message existed already).
  - CI coverage restored for the Phase 4 and 5 booking modules (unit tests over the Supabase fake); capability API paths get `no-referrer` from `next.config.ts`.
- **Identity:** branch `feature/booking-after-payment` in `/Users/juan/code/paisaxe-hackathon-phase5`, based on `develop` `7e43a9e8`; the commit carrying this handoff is the candidate.
- **Gate evidence (local, this candidate's inputs):** `supabase db reset --local` 0 (`schema_migrations` max 124); `typecheck` 0, `lint` 0, `knip` 0, `check-env` 0, `check-verification-coverage` 0, `check-migrations` 0 (121 files), `lint:deps` 0; full suite with the live stack: 485 files, 9,021 tests passed; CI conditions (`SUPABASE_LOCAL_API_URL=http://127.0.0.1:1`): 8,845 passed, 176 skipped, coverage 98.20 / 95.81 / 97.97 / 98.85 % against 97 / 95 / 97 / 97 (branches has 0.81 points of headroom); `next build` 0; Newman on the final tree: 26 requests, 26 assertions, 0 failures; live headers checked with curl. Playwright not run.
- **Deviations, reviews, simplify:** notes file, "Phase 5" (1 to 14), "Phase 5 review dispositions" (R0, 1 to 8; second pass R2-1 to R2-4; final APPROVE), "Phase 5 simplify pass". The Phase 4 handoff carries a correction about its coverage gate.
- **Known limitations:** Phase 4 compensation refunds (reconciliation step 6) still retry a definitive PayPal refusal; the operator view makes 14 availability calls per active experience.
- **Open for this phase's acceptance (owner):**
  - Manual, on local Docker with the real sandbox: preview a cancellation and leave it; twenty minutes later nothing has changed; confirm it inside the window; the sandbox shows the refund; the booking page shows `refund_pending` then `refunded`; the operator link shows the same; a second confirm does nothing. Record the ids here.
  - 5b: five tester sessions (`script.md`), the provider tier reached, `results.md`; send the Tier B message (`provider-message.md`) if not yet sent (planned by Oct 9).
- **Entry conditions for Phase 6:**
  - Production still untouched: anonymous sign-in, `PAYPAL_*` and `BOOKING_LINK_SECRET` in Vercel, the PayPal webhook subscription, the reconcile cron and any production operator link need owner authorization at release.
  - Run the CI-conditions coverage command before any push (memory and Phase 4 correction); keep branch headroom in mind when adding untested branches.
  - The local `booking-roundtrip` E2E still needs Playwright `bypassCSP` (Phase 2 deviation 9).
