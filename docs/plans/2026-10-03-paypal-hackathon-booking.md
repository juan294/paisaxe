# Paisaxe PayPal AI Hackathon: Conversational Experience Booking Implementation Plan

**Date:** 2026-10-03
**Status:** Planned, revision 3 (incorporates the independent plan review of 2026-10-03: findings F01 to F13 in revision 2, and the follow-up corrections R2-01 to R2-05 in revision 3), awaiting acceptance
**Research:** [2026-10-02-paypal-ai-hackathon-proposal-assessment.md](../research/2026-10-02-paypal-ai-hackathon-proposal-assessment.md) (revision 3, owner decisions 1 to 13)
**Baseline:** `develop` at `bb225b2f` when written; `51140e54` at revision 2 (the only tracked change since is the deploy skill). The research baseline `28c3aea7` is `d368b2b3` after the history rewrite
**Review:** [2026-10-03-paypal-booking-plan-review-assessment.md](../research/2026-10-03-paypal-booking-plan-review-assessment.md); every finding was verified and is dispositioned in "Review findings and dispositions" below
**Phase files:** `2026-10-03-paypal-hackathon-booking-phases/phase-0.md` through `phase-8.md`
**Deadline:** 2026-11-12 12:00 Pacific / **21:00 Madrid** (submission); internal target 2026-11-11. Judging 2026-12-01 to 2026-12-15 08:00 Pacific. Revision 1 said 23:00 Madrid; that was wrong (F09)

## Objective

Extend Paisaxe so that a visitor can discover a local experience, agree its details
through the text chat, hold a real slot, pay a deposit through PayPal sandbox, and
manage the booking afterwards, with the AI driving the PayPal operations as tools
behind server validation. Ship it on the existing live site behind a voucher gate,
make the repository public, and submit to the PayPal AI Hackathon.

## Decisions carried into this plan

These are settled in the research document (section 1, decisions 1 to 13) and the
planning review of 2026-10-03. They are not reopened here.

| # | Decision | Where it binds |
| --- | --- | --- |
| R1 | Direction approved; charter restriction superseded | Phase 0 writes the ADR and reconciles the charter |
| R2 | Lean operation; the video is the primary judging artifact | Every phase: smallest option that satisfies the rules |
| R3 | No separate demo stack; voucher access on the live site | Phases 2, 6, 7 |
| R4 | Guest booking by signed link; seeded demo operator | Phases 1, 4, 5 |
| R5 | Existing repository made public after light cleanup; PDFs already purged (#984, #985) | Phase 6 |
| R6 | APIMatic + Postman; native operator view; AG Studio only on a successful half-day trial; Bryntum dropped | Phases 0, 5 |
| R7 | Capture then refund in the core; authorize/capture/void only in the stretch | Phases 4, 8 |
| R8 | The agent drives PayPal through tools behind server validation | Phases 3, 4 |
| R9 | Extensions in order: invoice balance, phone-confirmation stretch, Zapier | Phase 8 |
| R10 | Video opens on the transaction | Phase 7 |
| R11 | The release pull request's Preview is the standing exception | Phase 0 writes it into the checklist |
| R12 | Production verification is a separate owner-authorized acceptance step | Phase 0 writes it; Phase 7 runs it |
| R13 | Content published with existing attribution; rights risk accepted | Phase 6 does nothing further |
| P1 | Buyer approval by PayPal redirect, no PayPal JavaScript SDK, no CSP change | Phase 4 |
| P2 | Voucher identity through Supabase anonymous sign-in | Phase 2 |
| P3 | Operator access by a seeded capability link, no new role | Phase 5 |
| P4 | Booking state lives in the database and is injected each turn | Phases 1, 3 |
| P5 | Own PayPal tool definitions over the REST API | Phases 3, 4 |

## Scope boundaries

- One fictitious, clearly labelled merchant, EUR, one party per booking, deposit now
  and balance due later. No multi-merchant onboarding, commissions, split payouts,
  multiple currencies, or full-balance capture (research section 5).
- The discovery chat route `/api/chat/stream` and its 42 tests stay as they are. The
  booking conversation is a new route that reuses the same helpers.
- No change to Stripe, voice-pass pricing, or the ElevenLabs agents except that a
  voucher can grant a voice pass through a new audited RPC.
- No Vercel Preview is created except the release pull request's (R11).
- No production deployment, `main` pull request, Vercel environment change, Supabase
  project setting change, repository visibility change, or submission happens
  without the explicit authorization that `CLAUDE.md` requires. Phase files mark each.
- Sponsor integrations beyond APIMatic (development tool) and Postman (collection)
  are out unless the Phase 0 AG Studio trial passes its four conditions.
- Knowledge-base re-authoring (#986) and image replacement (#987) are not in this plan.

## Verified baseline facts the design depends on

| Fact | Evidence |
| --- | --- |
| The text chat is single-turn: one user message per request, no history | `src/lib/claude.ts:647`; `src/app/api/chat/stream/route.ts:305-312` |
| The SSE union has three event types and the client ignores unknown ones | `src/types/sse.ts:3-19`; `src/hooks/use-stream-chat.ts:236-239` |
| No tool handling exists in production code | grep of `src` for `tool_use`, `tool_choice`, `tools:` matches only tests |
| Both model transports yield only text deltas; curl is used outside production | `src/lib/claude.ts:71-81`, `141-149`, `269-272` |
| Stream safeguards assume one text stream: idle 30 s, cap 90 s, client abort 60 s, leak filter | `src/lib/chat-stream-timeouts.ts:3-23`; `src/app/api/chat/stream/route.ts:250-283`; `src/hooks/use-stream-chat.ts:130` |
| A per-message structured UI slot exists (upsell card pattern) | `src/components/immersive/voice-chat/chat-message-list.tsx:73-79` |
| Google OAuth is the only sign-in; no anonymous or OTP sign-in in code | `src/components/auth/auth-provider.tsx:148`; grep |
| Voice access requires a Supabase user; purchases FK to `user_profiles` | `src/app/api/voice-session/route.ts:26-28`; `supabase/migrations/040_voice_purchases.sql:5-12` |
| New users get a profile row by trigger with role `user` | `supabase/migrations/018_user_profiles_rbac.sql:35-52` |
| Role is a binary CHECK and compared literally | `018:9`; `src/lib/admin-auth.ts:138,184`; `src/hooks/use-admin-role.ts:49` |
| New tables start with no anon/authenticated access; service-role trio enforced | `supabase/migrations/103`; `scripts/check-migrations.ts:55-63, 165-217` |
| Every SECURITY DEFINER function needs `SET search_path = ''` | `scripts/check-migrations.ts:395-437` |
| Stripe webhook pattern: raw body, signature, one idempotent RPC, 5xx only when retry helps | `src/app/api/webhooks/stripe/route.ts:80-213`; `supabase/migrations/099:56-131` |
| Routes under `/api/webhooks/`, `/api/mcp/`, `/api/cron/` are CSRF-exempt | `src/lib/csrf.ts:60-65` |
| Cron routes: `verifyVercelCron` for GET, `verifyWebhookSecret` or admin fallback for POST, lease lock helper | `src/lib/cron-auth.ts:55-114`; `src/lib/cron-job-lock.ts:23` |
| Rate limiter signature and fail-closed behaviour in production | `src/lib/rate-limit.ts:34-38, 335-370` |
| Revenue analytics read Stripe only, never database tables | `src/app/api/admin/stripe-analytics/route.ts:116-235` |
| Env registration: a new `process.env.X` must appear in `.env.example`; `getEnv` reads are not scanned | `scripts/check-env.ts:66-115` |
| Release probes manifest and Playwright projects | `quality/required-probes.yaml:9-166`; `playwright.config.ts:80-182` |
| Local Docker Supabase helpers for integration tests | `src/test/local-supabase.ts:23-88` |
| Translations: six locale files, parity test | `src/lib/i18n/types.ts:1`; `src/lib/i18n/translations.test.ts:67-89` |
| Latest migration is 111; next is 112 | `ls supabase/migrations` on 2026-10-03 |
| `main` requires `Smoke test Vercel preview`; checklist probes are read-only | GitHub API 2026-10-03; `docs/runbooks/release-checklist.md:123` |

## Selected design

### Access and identity

1. **Voucher** (`vouchers` table, code stored as SHA-256 hash). Redemption at
   `POST /api/booking/voucher/redeem`: if no Supabase user is present, the client first
   calls `supabase.auth.signInAnonymously()`; the server then validates the code,
   checks expiry and `max_redemptions`, upserts `voucher_redemptions(voucher_id, user_id)`,
   grants a voice pass through `grant_voucher_voice_pass_idempotent` (writes
   `voice_purchases` with `purchase_type = 'voucher_pass'`, `amount_paid = 0`,
   `payment_provider_id = 'voucher:<redemption id>'`, audited in `voucher_redemptions`,
   never in `stripe_webhook_events`), and sets the booking gate for that user.
2. **Gate.** Starting a booking (the booking chat, quote acceptance and payment-order
   creation) requires the `experience_booking` flag on and an active redemption for
   `auth.uid()`; without both those routes return 404, so the surface is invisible to
   ordinary visitors. Managing an existing booking (status, capture on return,
   cancellation) requires only its capability link. Item 7 is the authoritative table,
   including the explicit Preview rule.
3. **Metering** per redemption: `chat_turns` (default 60), `tool_iterations_per_turn`
   (6, hard-coded), `booking_attempts` (default 10). Counters live on
   `voucher_redemptions`; exceeding any limit returns a typed SSE error with a visible
   message. The existing limiter also applies per user id. **Voice minutes are not
   metered (F13).** The research promised a voice-minute bound; this plan withdraws that
   claim. The voice pass granted by a voucher lasts 24 hours and is renewed by redeeming
   again. `max_redemptions` (50) limits distinct guest identities only: an existing
   identity renews without consuming a redemption, and the 10-per-minute limit on
   `/api/voice-session` bounds session starts, not minutes. The only real stop is the
   ElevenLabs workspace limit, which is an assumption until Phase 6 verifies whether it
   stops spending or merely alerts, whether overage is still possible, and what paying
   users experience when it is hit. If it is not a hard stop, judge vouchers are issued
   without the voice pass. No per-voucher or worst-case voice cost is asserted.
4. **Guest booking link (F05).** The capability is derived, not stored:
   `token = base64url(HMAC-SHA256(BOOKING_LINK_SECRET, "booking:" + id + ":" + link_version))`
   and the link is `/booking/<id>.<token>`. The server can therefore rebuild the link
   whenever it needs it (PayPal return URL, re-issue through chat, operator view) and
   revoke it by incrementing `bookings.link_version`. Verification recomputes the HMAC
   and compares with `safeEqual` (`src/lib/safe-equal.ts:23-32`). The link is issued at
   quote acceptance, before payment (research section 4, step 4). Tokens never enter
   model-visible text: tools return them only inside cards, which go to the browser and
   not into the `tool_result` the model sees.
5. **Operator link.** Same scheme over `operator_access(id, merchant_id, label,
   link_version, expires_at)`: `/operator/<id>.<token>` with the purpose string
   `"operator:"`. One seeded row for the fixture merchant.
6. **Capability URLs and telemetry (F05).** Verified: the PostHog tracker sends the
   full path and query (`src/components/posthog-provider.tsx:30-37`), Sentry keeps the
   path (`src/lib/sentry-before-send.ts:35`), and Vercel Analytics is mounted in the root
   layout (`src/app/layout.tsx:163`). Phase 4 adds one `redactCapabilityPath(pathname)`
   helper that maps `/booking/…` and `/operator/…` to `/booking/[redacted]` and
   `/operator/[redacted]`, applies it in all three places, and sets
   `Referrer-Policy: no-referrer`, `Cache-Control: private, no-store` and
   `X-Robots-Tag: noindex` on those routes. Tests prove the raw token reaches none of
   the three. Platform request logs still contain the path; they are private to the
   owner's Vercel account and that residual is accepted.
7. **Who may call what (F10).**

   | Surface | Requires | After voucher expiry or flag off |
   | --- | --- | --- |
   | `/acceso`, voucher redemption | flag on | 404 when flag off |
   | Booking chat, quote acceptance, payment-order creation, booking list tool | flag on + active redemption for `auth.uid()` | 404 |
   | Booking page, status polling, capture on return, cancellation preview and confirm | booking capability (`<id>.<token>`) only | **Keeps working** for existing bookings, so a paying visitor can always see, pay or cancel |
   | Operator page and hold release | operator capability only | Keeps working until `expires_at` |
   | PayPal webhook, reconciliation cron | PayPal signature; cron secret | Unaffected |

   **Preview isolation is explicit:** every route in the first three rows returns 404
   when `VERCEL_ENV === "preview"`, because flags and data on a Preview are production's
   (`src/lib/environment.ts:21-42`). `VERCEL_ENV` is already a registered platform
   variable (`scripts/check-env.ts:18`).

### Booking domain (migrations 112 to 117)

Tables: `merchants`, `experiences` (price, deposit, capacity per slot, slot rule
`{weekdays, start_times}`), `booking_drafts` (one open draft per user), `quotes`
(versioned, `expires_at`), `holds` (`expires_at`, `consumed_at`, `released_at`),
`bookings` (status CHECK: `pending_payment | confirmed | cancel_pending | cancelled |
expired | refund_pending | refunded | needs_attention`; `cancellation_confirmed_at`;
`link_version`), `payments` (provider `paypal`, `order_id` unique, `capture_id`,
`refund_id`, status CHECK: `created | approved | capture_pending | captured |
capture_failed | expired | refund_pending | refunded | refund_failed`),
`paypal_webhook_events` (inbox: `event_id` unique, `received_at`, `processed_at`,
`attempts`, `last_error`), `experience_facts` (provider facts, see below), `vouchers`,
`voucher_redemptions`, `operator_access`. All operational tables use the service-role
trio and are added to `SENSITIVE_SERVICE_ROLE_TABLES` in `scripts/check-migrations.ts`.

**Inventory has exactly one owner at each stage (F04).** Before confirmation the
owner is the live hold (unexpired, unreleased, unconsumed). After confirmation it is
the `confirmed` booking, and the hold is marked consumed in the same transaction.
`experience_availability(experience_id, date)` returns, per start time,
`capacity − Σ party of confirmed bookings − Σ party of live holds`. A `pending_payment`
booking is never counted by itself; a booking whose hold expired stops consuming
capacity at that instant, without waiting for the cron. Fixture slots are computed, so
they never go stale.

**Quote acceptance is one atomic, idempotent RPC (F04).** `accept_quote(p_quote_id,
p_user_id)` locks the experience row, checks availability, inserts the hold and the
booking, stamps `quotes.accepted_at` and closes the draft in one transaction. `holds`
and `bookings` each have a unique `quote_id`. The function looks for an existing
booking before taking the lock and **again after acquiring it** (R2-03), so a retry
after a lost response, or two simultaneous accepts that both pass the first check,
return the same booking instead of one of them failing.

**Provider facts make the constraint matching checkable (F07).**
`experience_facts(experience_id, key, value, detail, confirmed_by_provider,
confirmed_at)` with `value` in `yes | no | unknown` and keys `step_free`, `min_age`,
`languages`, `public_transport`, `pets_allowed`, `equipment_included`. The fixture has
three experiences chosen to exercise all three values for `step_free`. Tools evaluate
each visitor constraint as supported, unsupported or unknown and carry the evidence
into the offer; the agent may not claim suitability for an unknown.

### Conversation and tools

A new route `POST /api/booking/chat/stream` reuses the discovery helpers (CSRF via
proxy, rate limit, zod validation, injection check, embeddings/search for descriptive
context) and adds: a `history` field (last 10 messages, each ≤ 2,000 chars, same shape
as `agentChatRequestSchema`), the user's open draft and bookings injected into the
unmarked system block (prompt-cache rule), and a streaming tool loop over the SDK
transport only. New SSE events: `{type:"tool", name, status}` and
`{type:"card", card}`; `parseSseEvent` learns both; the discovery client keeps ignoring
them.

Model-callable tools (all inputs validated with zod, all ownership checked by
`auth.uid()`):

| Tool | Effect |
| --- | --- |
| `search_experiences` | Reads catalog + availability for the draft's date/party |
| `update_booking_draft` | Writes party size, date, budget, constraints |
| `get_quote` | Creates a new quote version for experience + slot + party; returns the quote card |
| `create_payment_order` | Only for a booking in `pending_payment` whose quote was accepted by button; creates the PayPal order; returns the payment card with the approval link |
| `get_booking_status` | Reads the user's booking by id |
| `preview_cancellation` | **Read-only (F01).** Computes the refund per policy and returns the cancellation card; changes no state |

Not model-callable, by design: quote acceptance (button → `POST /api/booking/quotes/[id]/accept`),
payment capture (server-side, see Payments), cancellation confirmation (button →
`POST /api/booking/bookings/[capability]/cancel`). Natural-language interest never
spends money and never cancels (research section 6). Only the confirmation endpoint
records a cancellation authorization.

**What happens after the accept button (F06).** The client immediately sends the next
chat turn with a structured field `event: {type: "quote_accepted", bookingId}` instead
of free text. The server verifies the event against the database, tells the model in
the unmarked system block that the visitor has accepted, and the model calls
`create_payment_order`. The visitor never has to invent an instruction. If that turn
fails, the booking card's own "Pagar con PayPal" button calls
`POST /api/booking/bookings/[capability]/payment`, which runs the same server function.

**Entry opens the text booking chat (F06).** Verified: active voice access makes
`VoiceChat` switch to voice mode automatically (`src/components/immersive/voice-chat.tsx:139-146`),
and the immersive page handles only the `story` and `voice` parameters
(`src/app/immersive/immersive-page-content.tsx:149-156`). The booking tools are
text-only. Phase 3 therefore adds a `booking=1` deep link that opens the chat in text
booking mode, and suppresses the automatic switch to voice while booking mode is
active. Voice stays reachable through the existing toggle, labelled as discovery.

Tool loop budget: at most 6 iterations per turn, 8 s per tool execution, total cap
110 s (route `maxDuration` is already 120 s), client abort 120 s on this route only.
The leak filter runs on assistant text only. Each model iteration records usage under a new `booking_chat` member of the closed `UsageSource` type (`src/lib/costs/anthropic-usage.ts:27`).

### Payments

`src/lib/paypal/` wraps the REST API with `fetch`: OAuth client-credentials token
(cached until expiry), `createOrder` (intent CAPTURE, `PayPal-Request-Id` = payment
operation key, `experience_context.return_url` = `/booking/<token>/return`,
`user_action = PAY_NOW`), `getOrder`, `captureOrder` (`PayPal-Request-Id` =
`capture:<operation key>`), `refundCapture`, `verifyWebhookSignature`
(`/v1/notifications/verify-webhook-signature` with `PAYPAL_WEBHOOK_ID`). Base URL from
`PAYPAL_API_BASE` so tests can point it at a local mock. Amounts are integer cents
internally and formatted as `"30.00"` at the boundary.

**One capture path, three callers (F02).** `captureApprovedOrder(bookingId, source)`
is the only code that captures. It loads booking, payment and quote, calls `getOrder`,
and validates amount, currency and `custom_id` against the accepted quote. It is
called by:

1. the return page (`POST /api/booking/payments/capture`), the normal path;
2. the webhook, on `CHECKOUT.ORDER.APPROVED`, which arrives even if the browser closes;
3. reconciliation, for payments in `created | approved | capture_pending`.

So a buyer who approves and closes the browser is still confirmed, by the webhook
within seconds or by reconciliation within five minutes.

**Whether money has moved decides the branch (R2-01).**

- Order `APPROVED`, not yet captured: the hold must be live, or capacity is re-acquired
  for the same slot. If it cannot be, nothing is captured, payment and booking become
  `expired`, and the unpaid order lapses at PayPal. That statement is true only here.
- Order `COMPLETED`, by this call or discovered later: the capture id is persisted
  first, then `finalizeCaptured` confirms the booking. If the slot can no longer be
  fulfilled, `compensateCapturedPayment` records the refund intent durably
  (`refund_pending`, booking `needs_attention`) and refunds with a fixed operation key,
  so retries produce exactly one refund. A captured payment is never marked `expired`.
  This is why Phase 4 owns the refund primitive (F12).

**An unknown outcome stays unknown until PayPal says otherwise (R2-02).**
`capture_pending` means the result of a capture call is not known. Only authoritative
provider evidence ends it: `COMPLETED` leads to finalization, a voided order or a
declined capture leads to `capture_failed`. After three inconclusive reconciliation
passes the booking is escalated to `needs_attention` and the page says so, but the
payment **stays `capture_pending` and keeps being reconciled on every run**, so a late
success is still confirmed or compensated.

**Webhook inbox, so a failed event stays retryable (F03).** `POST /api/webhooks/paypal`
reads the raw body, verifies the signature through the API, and upserts the event into
`paypal_webhook_events` with `processed_at` null, storing the verified payload and the
normalized order, capture, refund and custom ids so the event can be replayed from the
inbox alone after the request has ended (R2-04). It then processes the event and sets
`processed_at` only on success. A redelivery of an event whose `processed_at` is null
is processed again; only an event already processed is acknowledged as a duplicate.
Every transition is idempotent by state, so reprocessing is safe. Processing failure
returns 500 so PayPal retries, and reconciliation also drains unprocessed events older
than two minutes. Handled events, with names confirmed in the Phase 0 spike:
`CHECKOUT.ORDER.APPROVED`, `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.DENIED`,
`PAYMENT.CAPTURE.PENDING`, `PAYMENT.CAPTURE.REFUNDED`. Unknown events are recorded,
marked processed and acknowledged. Verification failure returns 401.

Reconciliation `GET /api/cron/reconcile-bookings` every 5 minutes with the lease lock:
expire holds and abandon stale drafts; drain unprocessed webhook events; for payments
`created | approved` → `getOrder`, capture through the shared path when `APPROVED`,
mark `expired` when the hold lapsed with no approval; for `capture_pending` → the
bounded resolution above; for `captured` with booking `needs_attention` → finalize or
refund; for `refund_pending` → check the refund and move to `refunded` or
`refund_failed`; for confirmed cancellations whose refund call failed → retry with the
same operation key. It runs without the visitor, the conversation or the AI. It
captures only orders the buyer approved, through the same validation as the return page.

The booking page polls every 5 seconds for two minutes, then every 30 seconds for
fifteen minutes, and always offers a manual refresh, so its pending state outlasts a
cron interval.

### After payment

Cancellation has two separate steps (F01). **Preview:** the tool or the booking page
computes the refund (full inside `cancellation_window_hours`, none after) and shows
it; nothing is written. **Authorization:** the confirm request carries the refund the
visitor was shown; the server recomputes at that instant and, if the terms differ,
refuses with the new preview and requires a fresh confirmation (R2-05). The displayed
amount is an expectation to verify, never authority. Only then does the confirm record
`cancellation_confirmed_at`, sets `cancel_pending`, calls `refundCapture` with
`PayPal-Request-Id = refund:<operation key>` and sets `refund_pending`; the webhook or
reconciliation moves it to `refunded`, or to `refund_failed` with the booking in
`needs_attention`. Reconciliation retries a refund only where
`cancellation_confirmed_at` is set. A second confirm is a no-op by state.

Operator view: `/operator/<token>` lists today's and upcoming bookings for the
fixture merchant with deposit, balance, status and exceptions, plus a release-hold
action. Native React page, shadcn primitives, no AG Studio unless Phase 0 says yes.

### Publication and release

Phase 6 performs the light cleanup from research section 12 (license file, content
notice, review-workflow author check, untrack `docs/agents`), registers env vars, adds
the deployed-readonly probe `booking-gate-closed` (a small route check, not proof of
the access boundary) and the local-docker probes `booking-roundtrip` and
`booking-access-boundary`, and prepares the release candidate. Phase 7 is the single
production release under the checklist as amended in Phase 0, followed by the
owner-authorized production acceptance step, the video, the visibility change and the
submission.

## Phase overview

| Phase | Window | Deliverable | Batch-eligible units |
| --- | --- | --- | --- |
| 0 | Oct 3 to 8 | ADR, charter, checklist rulings; PayPal sandbox spike with real webhook via tunnel and confirmed event names; SDK tool-event spike; AG Studio half day | docs unit, spike unit |
| 1 | Oct 9 to 14 | Migrations 112 onward, provider facts, atomic `accept_quote`, availability with one inventory owner, fixture seed, integration tests | schema unit, then service unit |
| 2 | Oct 13 to 16 | Anonymous sign-in, voucher redemption, 24-hour voice pass RPC, access contract, metering, Preview isolation | — |
| 3 | Oct 15 to 22 | Booking chat route, tool loop, tools with constraint evaluation, SSE events, cards, booking entry in text mode, post-accept turn, model evaluation set | server unit, client unit |
| 4 | Oct 20 to 27 | PayPal adapter incl. refund primitive, order tool, shared capture path, booking page, capability links and telemetry redaction, webhook inbox, reconciliation cron | adapter unit, webhook-cron unit |
| 4b | Oct 27 to 28 | **End-to-end rehearsal and video draft** on local Docker with the real sandbox | — |
| 5 | Oct 26 to 31 | Cancellation preview and confirmation UI, operator view, Postman collection | cancel unit, operator unit, postman unit |
| 5b | Oct 28 to Nov 2 (provider message sent by Oct 9; desk survey in Phase 0 or 1) | **Validation (F08), middle scope:** five testers on the demo with sandbox money; a provider conversation if one comes easily; a written message to a few providers and a desk survey of ten provider websites as the backup; fix the largest friction | desk survey unit |
| 6 | Oct 31 to Nov 3 | Hardening, probes, publication cleanup, env registration, production webhook provisioning, release candidate freeze on Nov 3 | cleanup unit, probes unit |
| 7 | Nov 4 to 11 | Release, production acceptance step, video, visibility change, submission by Nov 11 (hard deadline Nov 12 21:00 Madrid) | — |
| 8 | Oct 27 to Nov 2, if time | Invoice the balance, phone-confirmation stretch, Zapier | each independent |

**Dependencies, stated honestly (F12).**

- Phases 2 and 3 can be *prepared* in parallel worktrees after Phase 1, but they are
  not independent: Phase 3's route imports Phase 2's gate and metering, and both add
  keys to the six locale files. Phase 2 merges first; Phase 3 rebases onto it and is
  accepted only after integrated verification. The integration owner owns the locale
  files during that rebase.
- Phase 4 owns the refund primitive (`refundCapture` plus compensation in
  reconciliation) because recovery needs it. Phase 5 owns only the visitor-facing
  cancellation flow.
- Phase 8 may start once Phases 1 to 5 are accepted; "core green" means those
  pre-release gates, not the production evidence that only Phase 7 can produce. Anything
  not finished by the Nov 3 freeze is left out.
- Phase execution and acceptance remain sequential: each phase stops for acceptance.

## Success criteria

### Automated

- `npm run test`, `npm run typecheck`, `npm run lint`, `npm run check-migrations`,
  `npm run check-required-probes`, `npm run check-env` all pass on the candidate.
- Booking service integration tests on local Docker (`src/lib/booking/*.postgrest-integration.test.ts`):
  last-slot race (two concurrent accepts, one succeeds); two simultaneous accepts of the
  *same* quote both succeed and return one booking, with the interleaving forced past
  the fast path (R2-03); a party of four consumes exactly four places from
  accept through expiry, confirmation and cancellation (F04); stale quote rejected;
  expired hold frees capacity immediately; anon cannot read or call any booking table or RPC.
- Payment tests with a mock PayPal server (`src/lib/paypal/*.test.ts`, route tests):
  capture validates amount/currency/custom id/hold; duplicate capture requests are
  idempotent; webhook rejects bad signatures and duplicates; out-of-order refund event
  cannot regress a refunded payment; reconciliation finalizes a captured-but-unconfirmed
  booking without a second capture; a capture that completed but whose response was
  lost, with the slot since taken, is refunded exactly once by reconciliation alone and
  is never marked `expired` (R2-01); an order that completes after three inconclusive
  passes is still resolved (R2-02); a failed webhook is replayed from the inbox row
  alone (R2-04); buyer approves and never returns → webhook or
  reconciliation captures and confirms (F02); a webhook whose processing fails is
  processed on redelivery with one final effect (F03); a cancellation preview left
  untouched for more than ten minutes causes no refund and frees no inventory, and a
  confirmed one refunds exactly once under retries (F01); a confirm whose expected
  refund no longer matches is refused with the new terms and writes nothing (R2-05).
- Chat tests: tool loop stops at 6 iterations; tool input failing zod yields a
  tool error and a text explanation, never a thrown route error; model-supplied amounts
  are ignored (tools take ids only); history and draft state appear in the unmarked
  system block; the discovery route's 42 tests unchanged.
- Access boundary tests with valid fixtures (F10), each failing if its gate is removed:
  valid booking capability without cookies works; a foreign user's booking id is 404 in
  the chat tools; missing or expired voucher is 404 on voucher-gated routes while the
  booking page still works; every gated route is 404 when `VERCEL_ENV=preview`; a
  returning user is served their existing redemption even when the voucher is at its cap.
- Capability and telemetry tests (F05): the link can be rebuilt from the booking id;
  incrementing `link_version` invalidates the old link; the raw token never appears in
  the PostHog `$current_url`, the Sentry event URL, the Vercel Analytics payload, or
  any `tool_result` sent to the model.
- Constraint tests (F07): `step_free` required → the `no` experience is excluded with
  the reason, the `unknown` one is offered only with an explicit not-confirmed notice.
- Date-advanced continuity tests (F13): with the clock moved to 2026-12-01 and
  2026-12-14, the fixture still offers bookable slots and the voucher still redeems.
- E2E `booking-roundtrip` (`@local-docker`), desktop and mobile viewport: fresh voucher
  session → lands in the text booking chat although voice access is granted (F06) →
  quote → accept → the approval link appears without a further typed instruction →
  PayPal mock approval → return → confirmed → operator view shows it → cancel → refunded;
  includes a reload mid-flow.
- Deployed probe `booking-gate-closed` (`@release-required`): a nonexistent capability
  returns 404 on the deployed origin. This is a route check only; the access boundary
  is proven by the local tests above.
- `src/lib/security-headers.test.ts` unchanged (no CSP change, P1).

### Model evaluation (recorded, not CI)

`npm run eval:booking` runs the real model against the local stack on six scenarios and
records outcome class, clarification turns and latency in
`docs/hackathon/evaluation/`: the representative request; an impossible budget; an
unavailable slot (taken between quote and accept); unknown accessibility; a changed
party size mid-conversation; an attempt to override the price or to cancel or pay by
assertion. Pass, defined before any video take: 6 of 6 reach the correct outcome class,
no price that did not come from a tool, at most two clarification turns in the
representative request. Run at the end of Phase 3 and again on the Phase 6 candidate.

### Manual

- One real PayPal sandbox approval, capture and refund observed in the sandbox
  dashboard and in `payments`, recorded with order, capture and refund ids (Phase 0
  spike, Phase 4 end, Phase 7 production step).
- One real webhook delivered through the tunnel and verified (Phase 0) and one on
  production (Phase 7).
- A returning judge in a fresh browser can redeem the same voucher, book, pay and
  cancel (Phase 7 rehearsal on production). "Weeks later" is covered by the
  date-advanced tests, a voucher replacement procedure, and availability checks on
  Nov 30 and Dec 8 (Phase 7).
- Validation (Phase 5b, middle scope): five testers attempt the journey unassisted on
  the demo, with the fictitious merchant and sandbox money; completion, time to a
  confirmed offer, abandoned steps and comprehension of deposit, balance and
  cancellation are recorded with their limits. Provider evidence is whichever tier is
  reached: a conversation, written replies, or the desk survey of ten public provider
  websites, which is prepared regardless as the backup. No improvement percentage is
  claimed without a comparator, and no endorsement is implied.
- The operator link opens only the fixture merchant's data and nothing under `/admin`.
- The demo video shows the real production build with labelled fixtures.

## Stuck states and recovery

| State | Who sees what | How it ends | Test proving it |
| --- | --- | --- | --- |
| Voucher invalid, expired or at cap | Visitor sees "Este acceso no es válido o ha caducado" with the contact line | Visitor asks for a new code; the server message names the reason | `voucher/redeem/route.test.ts` cases invalid/expired/cap |
| Anonymous sign-in disabled in Supabase | Redeem shows "No se pudo iniciar la sesión de invitado" and the log marks `[VOUCHER_ANON_SIGNIN_FAILED]` | Owner enables the project setting (Phase 2 owner action); the message tells the visitor to retry later | Unit test with the mocked auth error; Phase 2 manual check |
| Chat turn or booking attempt limit reached | Typed SSE error `limit_reached` rendered as a banner naming the limit | The banner says the voucher's allowance is used; a new voucher resets it | `booking/chat/stream/route.test.ts` limit case |
| Tool loop hits 6 iterations | Assistant text: "No he podido completar este paso; prueba a concretar fecha y personas" plus the last card | Next turn starts a fresh loop | `agent.test.ts` iteration cap case |
| Tool input invalid or tool throws | Tool event `status:"error"`, assistant explains, conversation continues | Visitor rephrases; nothing persisted | `tools.test.ts` invalid input case |
| Quote expired before acceptance | Accept returns 409 `quote_expired`; card shows "Esta oferta ha caducado" with a button to request a new one | Button sends "quiero una oferta nueva"; `get_quote` creates version n+1 | `quotes/[id]/accept/route.test.ts` |
| Hold expired before approval | Booking page shows "La reserva caducó sin pago" and a link back to chat | No money moved; reconciliation marks payment and booking `expired` | `capture.test.ts`; `reconcile.test.ts` |
| Buyer approved, then the hold expired | Booking page shows "Confirmando el pago…" | Shared capture path re-acquires capacity and confirms; if the slot is gone nothing is captured and the page says so with a re-quote link | `capture.test.ts` re-acquire cases |
| Buyer approved and closed the browser | Nothing on screen; the booking link shows the state on reopening | Webhook `CHECKOUT.ORDER.APPROVED` or reconciliation captures and confirms | `webhooks/paypal/route.test.ts`; `reconcile.test.ts` approved case |
| Buyer abandons PayPal | Payment stays `created`; booking page shows "Pago pendiente" with the approval link again | Hold expiry frees the slot at once; reconciliation marks `expired` | `reconcile.test.ts` abandoned case |
| Capture call times out | Payment `capture_pending`, booking page shows "Confirmando el pago…" and keeps polling for 17 minutes with a manual refresh | Reconciliation ends it on provider evidence. After three inconclusive passes the page shows "Seguimos verificando tu pago; no se te cobrará dos veces" and the booking is `needs_attention`, but reconciliation continues and a late success is confirmed or refunded | `reconcile.test.ts` late-completion-after-pass-three case |
| Payment captured but the slot is gone | Booking page shows "Pago recibido; no pudimos reservar la plaza y te devolvemos el importe" | Compensating refund with a fixed key; reconciliation follows it to `refunded` | `capture.test.ts` captured-then-slot-gone case |
| Cancellation terms changed between preview and click | The card shows the new terms and asks again | Nothing is cancelled until the visitor confirms the new terms | `cancel.test.ts` cutoff case |
| Capture succeeded, finalize failed | Payment `captured`, booking `needs_attention`; page shows "Pago recibido, confirmando la reserva" | Reconciliation finalizes; if the hold is gone it issues the refund and shows "Reembolso en curso" | `reconcile.test.ts` needs_attention cases |
| Webhook signature verification fails | 401; PayPal retries; `[PAYPAL_WEBHOOK_INVALID]` logged | Reconciliation covers state without webhooks; owner checks `PAYPAL_WEBHOOK_ID` | `webhooks/paypal/route.test.ts` |
| Webhook recorded but processing failed | 500 to PayPal; event row has `processed_at` null and `last_error` | Redelivery reprocesses it; reconciliation drains it after two minutes | `webhooks/paypal/route.test.ts` fail-then-redeliver case |
| Cancellation previewed, never confirmed | Card stays on screen; booking remains `confirmed` | Nothing happens, by design; the card can be reopened any time | `cancel.test.ts` preview-then-wait case |
| Refund failed at PayPal | Booking page shows "No se pudo completar el reembolso; lo estamos revisando" | Payment `refund_failed`, booking `needs_attention`, `[CRON_RECONCILE_ATTENTION]`; the operator view lists it | `reconcile.test.ts` refund_failed case |
| PayPal credentials missing | Payment tool returns `not_configured`; assistant says payment is unavailable right now | Owner sets env; `check-env` lists the names | `paypal/client.test.ts` missing env case |
| Refund pending for long | Booking page shows "Reembolso en curso" with the PayPal refund id | Reconciliation checks refund status; the page states that PayPal can take days | `reconcile.test.ts` refund_pending case |
| Visitor lost the booking link | The chat `get_booking_status` tool returns a card with the rebuilt link while the anonymous session lasts | The link is derived from the booking id, so it can always be rebuilt; with the session lost too, the operator view can re-issue it | `links.test.ts` rebuild case; `tools.test.ts` |
| Judge opens the site and lands in voice mode | Would hide the booking tools | Booking mode suppresses the automatic switch; the E2E asserts the text booking chat is shown | `booking-roundtrip` E2E; `voice-chat.test.tsx` |
| Voucher at its redemption cap | New visitors see `exhausted`; a returning user is still served | Owner issues a replacement voucher with `create-voucher.ts` (procedure in the testing instructions) | `voucher/redeem/route.test.ts` cap-with-existing case |
| Operator link invalid or expired | 404 page with no data | Owner seeds a new row (Phase 5 script) | `operator/[token]/page.test.tsx` |
| Feature flag off in production | New bookings impossible: `/acceso`, the chat and quote routes return 404 and the entry is hidden. Existing bookings stay reachable and cancellable through their capability links | Admin toggles `experience_booking` in the Features tab | gate tests, including the capability-still-works case |
| AI unavailable mid-flow | SSE error `ai_unavailable`; booking page still works without the chat | Visitor uses the booking page links; reconciliation does not need the AI | route test with the mocked SDK failure |
| Fixture capacity exhausted on a date | `search_experiences` returns other dates; the card says the date is full | Capacity rules give daily capacity 12 and holds expire in 15 minutes | `availability.test.ts` |

## Consumer sweep

Searches run on 2026-10-03 at `bb225b2f`.

| Shared thing changed | Search | Consumers | Disposition |
| --- | --- | --- | --- |
| `SseEvent` union gains `tool` and `card` | `grep -rln -e types/sse -e parseSseEvent -e encodeSseEvent src e2e` | `src/app/api/chat/stream/route.ts`, `src/hooks/use-sse-stream.ts`, `src/hooks/use-stream-chat.ts` (+test), `src/tests/qa/llm-quality-helpers.ts`, `src/types/sse.test.ts` | Phase 3 extends the union and `parseSseEvent`; existing consumers ignore unknown types (verified) and keep passing; `sse.test.ts` gains cases; QA helper unchanged because it only throws on `error` |
| `FeatureFlagKey` union gains `experience_booking` | `grep -rln -e FeatureFlagKey -e types/feature-flags src` | 21 files, admin panels and hooks | Phase 2 adds the key; `feature-toggles-panel` renders it automatically; no other consumer enumerates keys (verified in the grep list) |
| `voice_purchases.purchase_type` CHECK gains `voucher_pass` | `grep -rln -e purchase_type -e purchaseType src supabase/migrations e2e scripts` | checkout route (+test), voice-access route (+test), Stripe webhook (+tests), pricing page, `use-voice-access`, `stripe.ts`, `types/voice-access.ts`, migrations 040/078/084/095/099 | Phase 2 widens the CHECK and the TS union in `types/voice-access.ts`; readers treat unknown types as access-granting already (expiry-only check at `src/app/api/voice-access/route.ts:28-49`); Stripe paths unchanged |
| `vercel.json` crons gain `reconcile-bookings` | `grep -rln 'vercel.json' src scripts e2e` | `src/config/vercel-config.test.ts`, `scripts/verification-config.test.ts`, `docs/operations/operations.md:195-213` | Phase 4 adds the cron, updates the ops table (also fixing the stale "failed" wording for `fail-stale-bookings`) |
| `quality/required-probes.yaml` gains two probes | `grep -rln 'required-probes' scripts e2e src quality .github` | `scripts/release/required-probes.ts` (+test), `analyze-release-run.ts` (+test), `e2e/release-required.spec.ts`, `scripts/verification-config.test.ts` | Phase 6 adds probes and Playwright specs together; `check-required-probes` cross-checks |
| `SENSITIVE_SERVICE_ROLE_TABLES` gains the booking tables | `scripts/check-migrations.ts:55-63` | the checker only | Phase 1 |
| Translations gain the booking namespace | `src/lib/i18n/{es,en,fr,de,pt,ast}.ts`, `translations.test.ts` | parity test | Phases 2 to 5 add keys to all six files; `npm run generate-locale-coverage` after |
| `.env.example` gains PayPal vars | `scripts/check-env.ts` | the checker | Phase 4 |
| `docs/runbooks/release-checklist.md` | the single procedural authority | Phase 7 | Phase 0 amends sections 2, 3 and 5 |
| `UsageSource` closed union gains `booking_chat` | `grep -rn UsageSource src` | `src/lib/costs/anthropic-usage.ts:27` and every `recordUsage` caller | Phase 3 adds the member; reports grouping by source pick it up |
| PostHog page-view URL, Sentry URL normalization, Vercel Analytics payload | `grep -rn -e '\$current_url' -e normalizeUrlToPath -e VercelAnalytics src` | `src/components/posthog-provider.tsx:30-37`, `src/lib/sentry-before-send.ts:35`, `src/components/analytics`, `src/app/layout.tsx:163` | Phase 4 applies `redactCapabilityPath` in all three with tests |
| Voice mode auto-selection | `grep -rn willUseVoiceMode src` | `src/components/immersive/voice-chat.tsx:139-146` | Phase 3 gates it on booking mode |
| Immersive deep links | `grep -rn 'searchParams.get' src/app/immersive` | `src/app/immersive/immersive-page-content.tsx:149-156` | Phase 3 adds `booking` |
| Fixture writers | `supabase/migrations/116_fixture_merchant_seed.sql`, `supabase/seed.sql`, E2E fixtures | local Docker reset, E2E | Phase 1 seeds through the migration (idempotent upsert by slug) so production and local get the same fixture; `seed.sql` untouched |

## Owner actions and authorization points

| Action | Phase | Who executes |
| --- | --- | --- |
| PayPal developer account, sandbox app, sandbox merchant and buyer accounts | 0 | Owner signs in; agent may operate the dashboard in the browser |
| Sandbox client id/secret and webhook id as secrets | 0 (local), 6 (Vercel) | Owner supplies secret values; agent sets non-secret vars via CLI after authorization |
| Enable anonymous sign-ins on the Supabase project | 2 | Agent through the management API after authorization in that conversation; owner fallback in the dashboard |
| AG Studio trial sign-up | 0 | Owner authorizes; agent in the browser |
| Recruit five testers (friends and family are fine); send the short provider message; speak to one provider if it comes easily | 5b (message by Oct 9) | Owner; the agent prepares the script, the observation sheet, the Spanish message, the desk survey and the summary |
| Confirm the ElevenLabs workspace usage limit | 6 | Owner in the ElevenLabs dashboard; recorded in the phase evidence |
| Create the production PayPal webhook listener for `https://paisaxe.es/api/webhooks/paypal` and set its id (F11) | 6 | Owner signs in; agent may operate the dashboard; the id is set as `PAYPAL_WEBHOOK_ID` in Vercel Production before the release |
| Production release (`gh pr create`, `gh pr merge --merge`) | 7 | Agent, only after "go ahead" and "merge it" in that conversation |
| Production acceptance step (one sandbox booking on paisaxe.es) | 7 | Agent, after explicit authorization, fixture rows only |
| Repository visibility change | 7 | Agent through `gh repo edit --visibility public` after authorization |
| Video upload, Devpost submission | 7 | Agent in the browser where the owner is signed in |

## Risks and mitigations

- **SDK tool streaming in development.** The curl transport ignores tool events. Phase 0
  proves `messages.stream` with tools on the SDK in development; if the Turbopack issue
  that motivated curl recurs, the booking route forces the SDK transport and the spike
  records the workaround.
- **Anonymous users and abuse.** Anyone can create an anonymous session once enabled,
  but nothing is granted without a voucher, and all booking routes 404 without a
  redemption. Supabase rate-limits anonymous sign-ins per IP.
- **PayPal sandbox latency.** Approval and capture can take seconds; the client abort
  on the booking route is 120 s and the return page polls rather than waits.
- **Fixture rows in production.** `merchants.is_fixture = true` on every fixture row;
  the operator view and future reports filter on it; Stripe analytics never see them.
- **Migration numbering collisions.** Another worktree (`feat/ci-cadence`) is active; the
  implementer re-checks the next number before each migration.
- **Timeline.** The deadline is two hours earlier than revision 1 assumed and the
  internal target is Nov 11. Phases 2 and 3 overlap in preparation only. If Phase 4
  slips past Oct 29, Phase 5 drops the operator release-hold action and Phase 8 is
  cancelled. Validation (5b) is not cut: it is the only evidence for the impact criterion.
- **A demo that looks like conversational checkout.** With 3,269 registrants, the core
  must show why AI matters. The video therefore includes one rejected unsuitable
  option and one honestly reported unknown, both produced by the tools and both
  covered by the evaluation set.

## Review findings and dispositions

From `docs/research/2026-10-03-paypal-booking-plan-review-assessment.md`. Each finding
was re-verified against the plan text, the source and the official pages on 2026-10-03.

| ID | Finding | Disposition | Where |
| --- | --- | --- | --- |
| F01 | Cancellation preview could trigger a refund | **Resolved.** Preview is read-only; only the confirm endpoint authorizes; cron retries only authorized cancellations | Design: After payment; Phase 5 |
| F02 | No component captured after approval without return | **Resolved (completed in revision 3 by R2-01 and R2-02).** One shared capture path called by return page, approval webhook and reconciliation; bounded `capture_pending`; longer page polling | Design: Payments; Phase 4 |
| F03 | Webhook dedup could drop a failed event | **Resolved (completed in revision 3 by R2-04).** Inbox with `processed_at`; unprocessed events are retried | Design: Payments; Phases 1, 4 |
| F04 | Inventory counted twice; acceptance not atomic | **Resolved (completed in revision 3 by R2-03).** One inventory owner per stage; atomic idempotent `accept_quote` | Design: Booking domain; Phase 1 |
| F05 | Capability links could not be rebuilt; tokens leak to telemetry | **Resolved.** HMAC-derived capabilities with `link_version`; redaction in PostHog, Sentry and Vercel Analytics; headers; tests. Platform request logs accepted | Design: Access items 4 to 6; Phase 4 |
| F06 | Voucher entry opens voice; no trigger after acceptance | **Resolved.** `booking=1` text entry, voice auto-switch suppressed, structured post-accept turn with a button fallback | Design: Conversation; Phase 3 |
| F07 | No data or evaluation contract for constraints | **Resolved.** `experience_facts`, three-valued evaluation, deterministic tests, six-scenario model evaluation | Design: Booking domain; Phases 1, 3 |
| F08 | Validation dropped from the phases | **Resolved.** Phase 5b restored with measures and limits | Phase 5 file, unit 5b |
| F09 | Deadline two hours wrong; judging start wrong | **Resolved.** 21:00 Madrid; judging Dec 1 to 15; research doc corrected | Header; Phase 7; research doc |
| F10 | Gate contract inconsistent; Preview claim unenforced; probe weak | **Resolved.** Access table; explicit `VERCEL_ENV` rule; positive and negative local tests; probe described as a route check | Design: Access item 7; Phases 2, 6 |
| F11 | Production webhook provisioning missing | **Resolved.** Owner-authorized step before release | Owner actions; Phase 6 |
| F12 | Phase dependency and ownership conflicts | **Resolved.** Dependencies restated; refund primitive in Phase 4; freeze Nov 3; rehearsal 4b | Phase overview |
| F13 | Voice minutes unbounded; judge continuity untested | **Partly resolved, partly withdrawn.** Voice-minute bound withdrawn and stated; 24-hour renewable pass; date-advanced tests; replacement procedure; checks on Nov 30 and Dec 8; existing redemption served before the cap | Design: Access item 3; Phases 2, 7 |
| R2-01 | A completed capture could be marked expired without a refund | **Resolved.** The captured branch is separated before the capacity decision; durable compensating refund with a fixed key | Design: Payments; Phase 4 |
| R2-02 | Three inconclusive checks declared a payment failed | **Resolved.** Attention threshold only; `capture_pending` stays reconcilable; `capture_failed` needs provider evidence | Design: Payments; Phases 1, 4 |
| R2-03 | Same-quote concurrent accepts could fail | **Resolved.** Recheck inside the lock, plus the unique-violation fallback | Design: Booking domain; Phase 1 |
| R2-04 | Inbox lacked the data to replay an event | **Resolved.** Verified payload and normalized ids stored; `getCapture` read; replay oracle | Design: Payments; Phases 1, 4 |
| R2-05 | Cancellation could execute on worse terms than displayed | **Resolved.** Expected refund sent, compared, refused on mismatch with renewed confirmation | Design: After payment; Phase 5 |
| — | Revision 2 wording leftovers (gate summary, flag-off row, Phase 3 header) and the voice backstop clarification | **Resolved.** Summaries aligned with the access table; the backstop is recorded as an assumption to verify, with a no-voice voucher fallback | Access items 2, 3; Phases 2, 3, 6 |
| — | Smaller corrections: `voided_local` absent from CHECK; fast path skipped validation; refund failure outcomes; invoice settled-balance check; `booking_chat` usage source | **Resolved** as `expired` status, the shared capture path, `refund_failed`, Phase 8a wording, and the `UsageSource` change | Phases 1, 3, 4, 8 |

## Handoff

- **Objective and scope:** as stated above; no implementation has started.
- **Identity:** plan written at `develop` `bb225b2f`, revised at `51140e54`, in `/Users/juan/code/paisaxe`. Revision 1 is preserved in the session scratchpad only; this file is the plan of record.
  Research doc untracked at the time of writing. Other worktree: `../paisaxe-ci-cadence`
  (owner's, untouched).
- **Evidence limits:** facts come from the three read-only investigations of
  2026-10-03 (chat, auth, payments) and direct reads; tests were not run; PayPal and
  Supabase management API behaviours are from documentation and are confirmed in
  Phases 0 and 2.
- **Decisions:** R1 to R13 from the research doc; P1 to P5 from the planning review; F01 to F13 and R2-01 to R2-05 dispositions above. One research commitment is withdrawn, not met: the voice-minute bound (F13).
- **Next action:** owner acceptance of this plan; then Phase 0 in its own conversation,
  in a worktree, stopping at its gate.
