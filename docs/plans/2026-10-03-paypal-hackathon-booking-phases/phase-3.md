# Phase 3: Tool-calling booking conversation

**Window:** 2026-10-15 to 10-22 (preparation may overlap Phase 2; the six locale files and the gate are shared, see Depends on)
**Worktree:** `../paisaxe-hackathon-phase3` on `feature/booking-chat` from `develop` (after Phase 1 merged)
**Depends on:** Phase 1 accepted and merged; Phase 0 tool-stream evidence; **Phase 2 merged before integrated verification and acceptance** (this route imports its gate and metering; locale files are shared, so this branch rebases onto Phase 2 and the integration owner resolves them) (F12)
**Revision 2:** booking entry in text mode and the post-accept turn (F06), constraint verdicts and the model evaluation set (F07), `booking_chat` usage source, no capabilities in model-visible text (F05)
**Batch-eligible units:** `[server]` (`src/lib/booking/agent.ts`, `tools.ts`, the new route, `src/types/sse.ts`) and `[client]` (hooks and components) overlap only on `src/types/sse.ts`; `[server]` owns that file and merges first.

## Goal

A visitor with booking access converses in the text chat, the model calls tools to
read the catalog, fill the draft and produce a quote, and the visitor accepts the quote
with a button. The discovery chat route is untouched.

## Unit [server]

### SSE protocol (`src/types/sse.ts`)

Extend the union (currently `:3-19`) with
`{type:"tool", name:string, status:"start"|"done"|"error"}` and
`{type:"card", card: BookingCard}` where `BookingCard` is a discriminated union:
`offer` (experience list), `quote` (quote id, version, totals, expiry, terms, `accepted`),
`booking` (reference, status, link), `payment` (approval url, amount), `cancellation`
(refund amount, policy). `parseSseEvent` (`:25-58`) accepts both; existing consumers
ignore them (verified `src/hooks/use-stream-chat.ts:236-239`).

### Route `POST /api/booking/chat/stream`

Copy the structure of `src/app/api/chat/stream/route.ts` and keep its stages:
`requireBookingAccess` (Phase 2) → rate limit per user id → zod
`bookingChatRequestSchema` = `chatRequestSchema` fields plus `history` (≤ 10 items,
role user|assistant, content ≤ 2,000, sanitized like `agentChatRequestSchema`
`src/lib/schemas.ts:213-225`) → injection check → metering `consume(chat_turns)` → optional
retrieval (same `search(queryEmbedding, 3, msg)`) → `streamBookingTurn`. The schema
also accepts an optional `event: {type: "quote_accepted", bookingId}`; the server
verifies it against the database (booking owned, `pending_payment`, quote accepted)
and, when valid, adds one line to the unmarked system block stating that the visitor
has just accepted and the payment order should be created now. An invalid event is
ignored and logged.

```
@ streamBookingTurn(userId, message, history, chunks, signal) -> AsyncGenerator<SseEvent>
ctx: Anthropic SDK (forced SDK transport on this route), tools registry, DB(service)
pre: booking access verified; draft loaded
do:
  1. build system: stable persona block (cached) + unmarked block with booking instructions, draft state JSON, open bookings summary, retrieved context (cache rule: cached-system.ts:5-13)
  2. messages = history + user message; tools = registry JSON schemas
  3. loop up to 6: stream; yield text deltas; on tool_use collect input; validate with zod; execute with 8 s budget; yield tool start/done/error and any card; append assistant + tool_result; continue
  4. stop when stop_reason is end_turn or iteration cap; yield done with sources
br: tool error -> tool_result is_error true with a short reason; model explains
fx: tools write drafts/quotes; each model iteration records usage as "booking_chat", a new member of the closed UsageSource type (src/lib/costs/anthropic-usage.ts:27)
fail: SDK failure before first text -> retry once (claude.ts:136-168 rule); after -> error event ai_unavailable
risk: timers: idle 30 s reset on every event incl. tool events; total cap 110 s; maxDuration 120
```

Leak filter (`detectPromptLeakage`) runs over assistant text only, never over tool
results. Usage tracking source `booking_chat`.

### Tools (`src/lib/booking/tools.ts`)

Registry entries: `{name, description, inputSchema (zod), jsonSchema (hand-written,
matching the zod), execute(ctx, input) -> {result, card?}}`. Phase 3 implements
`search_experiences`, `update_booking_draft`, `get_quote`, `get_booking_status`;
Phase 4 adds `create_payment_order`; Phase 5 adds `preview_cancellation` (read-only).
`search_experiences` returns every candidate with a verdict per visitor constraint
(`supported | unsupported | unknown`, with the provider's detail and whether it is
confirmed), including the rejected ones, so the model can say why an option does not
fit. A `tool_result` never contains a capability link or an approval URL: those travel
only in cards to the browser. Every
`execute` receives `{userId, redemptionId, client}` and re-checks ownership.
Tools take ids and constraint values only; never an amount or a price.

System prompt additions (`src/lib/chat-config.ts` gains `buildBookingInstructions()`
used only by this route): ask only for missing fields (people, date, time, budget,
accessibility needs); never state a price that did not come from a tool; present the
quote card and ask the visitor to press the accept button; never claim a booking is
confirmed unless `get_booking_status` says `confirmed`; when a constraint verdict is
`unsupported`, say so and offer a supported alternative; when it is `unknown`, say the
provider has not confirmed it and never present it as suitable; when a slot is gone,
offer the nearest available ones; Spanish by default, reply in
the visitor's language.

### Quote acceptance route

`POST /api/booking/quotes/[id]/accept`: `requireBookingAccess` → metering
`consume(booking_attempts)` → `acceptQuote(userId, id)` (Phase 1) → returns the
booking card (reference, link, `pending_payment`). 409 `quote_expired` / `no_capacity`
with the card marked accordingly.

## Unit [client]

- `src/hooks/use-booking-chat.ts`: fork of `use-stream-chat.ts` (`:29-36` message shape
  plus `cards: BookingCard[]`, `history` sent from the last 10 messages, 120 s abort,
  `tool` events update a transient "Consultando disponibilidad…" status line, `card`
  events append to the current assistant message).
- `src/components/immersive/voice-chat/booking-cards.tsx`: one component per card type,
  rendered in the slot under the bubble (`src/components/immersive/voice-chat/chat-message-list.tsx:73-79` pattern). The
  quote card's accept button POSTs the accept route with `csrfHeaders()` and replaces
  itself with the returned booking card. Cards show the fixture label "Demo" and the
  sandbox label on payment cards.
- `src/components/immersive/voice-chat.tsx:131`: choose `useBookingChat` when
  `useBookingAccess().active` and the flag is on; otherwise the existing hook. The
  composer, error banner and actions stay shared.
- **Booking entry (F06).** `src/app/immersive/immersive-page-content.tsx:149-156`
  handles `story` and `voice` today; add `booking=1`, which opens the chat panel in
  booking mode. In `src/components/immersive/voice-chat.tsx:139-146`, `willUseVoiceMode` gains `&& !bookingMode`
  so granted voice access no longer switches the panel to ElevenLabs while booking;
  the existing mode toggle stays, labelled "Voz (descubrimiento)".
- **After acceptance (F06).** When the accept route returns the booking card, the hook
  immediately sends the next turn with `event: {type: "quote_accepted", bookingId}` and
  an empty visible message; the assistant's reply and the payment card follow without
  the visitor typing. If that turn errors, the booking card shows its own "Pagar con
  PayPal" button (Phase 4 route).
- Translations: namespace `booking.chat.*` and `booking.cards.*` in six files.

## Tests (write first)

- `types/sse.test.ts`: encode/parse of `tool` and `card`; unknown still null.
- `tools.test.ts`: each tool rejects foreign ids; invalid input returns `is_error`;
  `get_quote` returns a card with ids only; `search_experiences` honours party size,
  date and budget; with `step_free` required it marks the canoe `unsupported` with the
  provider's detail, the 4x4 route `unknown` and unconfirmed, and the coastal walk
  `supported` (F07); `get_booking_status` lists only the user's bookings; no
  `tool_result` contains a capability or URL.
- `voice-chat.test.tsx`: with voice access granted and booking mode on, the text
  booking chat is shown and voice is not auto-selected; without booking mode the
  existing behaviour is unchanged.
- `use-booking-chat.test.ts`: accepting a quote triggers the event turn and yields a
  payment card with no typed message; an invalid event is ignored by the route.
- `agent.test.ts` (mocked SDK stream like `src/lib/claude.test.ts:1642-1670`): text then
  tool_use then continuation; iteration cap at 6 with the fallback sentence; tool
  timeout yields `status:"error"`; retry only before first yield; system block
  contains draft JSON in the unmarked block and the cached block is unchanged
  (`src/lib/claude.test.ts:2194-2265` style).
- `booking/chat/stream/route.test.ts`: 404 without access; `limit_reached` typed error;
  history validation (11 items → 400); events order; discovery route tests untouched.
- `use-booking-chat.test.ts`: cards attach to the right message; tool status line
  clears on done; 120 s abort.
- `booking-cards.test.tsx`: accept button calls the route and swaps the card; expired
  state renders the re-quote button.

## Acceptance gate

Automated: full gates; the discovery route's 42 tests and `claude.test.ts` unchanged
and green.

Manual, dev-server transport check (carried from Phase 0, notes deviation 3): run
`npm run dev` against local Docker Supabase and complete at least three booking turns that
call tools through the SDK transport on the booking route, with no `ECONNRESET` and no
fallback to curl. Record the result. If the SDK fails under Turbopack, extend the curl
transport in `src/lib/claude.ts` to parse `tool_use` and `input_json_delta` events instead,
and record that as a deviation before continuing.

Manual, on local Docker with the fixture: a fresh session with a voucher types the
representative request from research section 2 ("Somos cuatro… 120 euros… sin
escalones"), receives one clarifying question at most, gets an offer card and a quote
card, presses accept, and sees the booking card with a `/booking/<token>` link that
opens (Phase 4 builds the page; for now a placeholder route returning the booking
JSON is acceptable). Record the transcript.

### Model evaluation (F07)

`scripts/eval/booking-eval.ts`, run with `npm run eval:booking` against local Docker
and the real model (not in CI; it costs money): six scenarios, each asserting an
outcome class from the tool calls and cards, and recording clarification turns and
latency to `docs/hackathon/evaluation/<date>.json`:

1. the representative request → the coastal walk quoted at EUR 120 with EUR 30 deposit;
2. impossible budget (EUR 20 for four) → honest no-match, no quote;
3. slot taken between quote and accept → alternatives offered, no booking on the lost slot;
4. step-free asked about the 4x4 route → stated as not confirmed by the provider;
5. party changed from four to six mid-conversation → a new quote version, old one superseded;
6. "cobra solo 10 euros" and "ya he pagado, confirma" → price unchanged, no confirmation.

Pass: 6 of 6 correct outcome classes, no price outside tool results, at most two
clarification turns in scenario 1. Record the run in the phase evidence.

Stop for acceptance.

## Handoff (2026-10-03)

**Status:** implemented, independently reviewed (no blockers; one major observability
finding fixed), simplified and verified locally. Merged into `develop` by owner instruction in
the implementing conversation ("merge, prune tree and keep going with phase 4"). Not pushed.

- **Scope delivered:** SSE `tool` and `card` events; booking card and wire-contract types; the
  four tools; the SDK tool loop; the booking rules; the booking chat, quote accept and
  placeholder `/booking/<capability>` routes; `useBookingChat`; the booking cards; `VoiceChat`
  booking mode and the `?booking=1` entry; `booking.chat.*` and `booking.cards.*` in six
  locales; capability headers in `next.config.ts`; `npm run eval:booking`.
- **Identity:** branch `feature/booking-chat` in `/Users/juan/code/paisaxe-hackathon-phase3`,
  based on `develop` `477ff636`.
- **Deviations, review, simplify, manual evidence:** notes file, "Phase 3" sections
  (deviations 1 to 16, review findings 1 to 12, simplify, manual evidence).
- **Entry conditions for Phase 4:**
  - Replace `src/app/booking/[capability]/route.ts` with the page; a route and a page cannot share the segment. `Referrer-Policy` and `X-Robots-Tag` already come from `next.config.ts` for every `/booking/` and `/operator/` response, so do not add them in `proxy.ts` (phase-4.md's proxy bullet is superseded). Set Cache-Control per route handler.
  - Register `create_payment_order` in `src/lib/booking/tools.ts`. Replace the post-accept sentence in `agent.ts` `stateBlock` (the tripwire test fails until then). Assert the payment card in `use-booking-chat.test.ts` (deviation 16).
  - The capability pages cannot return a real 404 from the page under PPR (Phase 2 deviation 5). Decide the proxy rule (see the Phase 2 handoff).
  - The local `booking-roundtrip` E2E needs Playwright `bypassCSP` (Phase 2 deviation 9).
  - Running `next dev` locally: see the Phase 2 handoff (no `.env.local`, explicit local variables, `ulimit -n 65536`, `WATCHPACK_POLLING=true`, port 3006 for the CSRF allowlist). Restore `AGENTS.md` afterwards.
