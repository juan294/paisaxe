# Phase 3 — Bounded booking intake

Parent: [implementation plan](../2026-10-28-jev-core-improvements.md). Entry: Phase 2 accepted. Runtime stays off until the parent's live qualification passes and activation is authorized.

## Changes and behavioral contract

Create `src/lib/booking/intake-candidates.ts`, `intake-questions.ts`, `intake.ts` and tests; integrate in `src/lib/booking/agent.ts` after its deterministic accepted-booking branch and before the model loop (`src/lib/booking/agent.ts:196`, `src/lib/booking/agent.ts:204`). Extend agent/route tests. Add `scripts/eval/jev-booking-intake.ts` and its synthetic fixtures. Extract reusable conversation/scenario helpers from the currently top-level live runner (`scripts/eval/booking-eval.ts:39`, `scripts/eval/booking-eval.ts:77`) into new side-effect-free `scripts/lib/booking-eval-harness.ts`; importing it must not load keys, start mocks, seed a database or make a call. Keep those actions in explicit CLI entry functions. Add explicit baseline/deterministic/Jev modes, locale `es` (the current call omits it), first-card timing and full-turn/quote metrics. Preserve `BookingTurnInput`, tool schemas, draft schema and SSE/card contracts.

Eligibility is deliberately narrow: task enabled; locale exactly `es`; no replay; no accepted booking; no prior user/assistant messages; no existing bookings; and an empty draft with all optional criteria unset and constraints `{}`. An existing draft's identity/timestamps are not semantic criteria. Named experiences, booking changes, quotes, payment/cancellation, mixed intentions, preferences, time-of-day requirements, unsupported hard constraints and contradictions use the existing agent. `BOOKING_AGENT_REPLAY` bypasses Jev so the current replay remains reproducible (`src/lib/booking/replay-model.ts:11`).

Code enumerates exact-span candidates with IDs and character offsets: party numbers 1–12 in a recognized `personas`/`somos` phrase, explicit inclusive euro caps (`hasta`/`como máximo`) converted to integer cents, valid ISO dates and `hoy`/`mañana` resolved using the existing Madrid date helpers. The horizon is today through 90 days inclusive. Ambiguous weekdays, invalid dates, two incompatible candidates, exclusive/ambiguous budget wording, missing required date/party, or unsupported number formats fall back. Budget is optional only when a separate presence judgment is confidently negative. Candidate values come from code, never generated text. An inexpensive literal comparator over those same candidates runs in the evaluator; Jev must add useful interpretation over it.

Support only three hard-constraint booleans in this fast path: `step_free`, `public_transport`, `pets`. Enumerate recognized exact spans for each (for example “sin escaleras”, “transporte público”, “con perro”) and independently ask whether that constraint is required. Positive requires both a supported span and Noul >=0.90; confidently negative omits it; uncertain/contradictory requirements fall back. Age, language and other hard requirements always fall back. Provider facts still determine whether any requested constraint is supported or unknown.

Ask independent Noul questions for discovery intent, presence of each field, unsupported requirements and contradiction. A single valid candidate is selected deterministically only after all independent presence/intent/contradiction gates pass; no nonexistent runner-up margin is required. For two or more candidates, use Choice only over existing IDs with the shared probability/margin rule. Validate selected spans against original input. A positive selection cannot override a failed gate. Use one bounded provider request; no generated explanation or tool arguments beyond validated selections are accepted.

On acceptance, invoke existing `executeBookingTool` once with `search_experiences`; its Zod validation and deterministic provider-fact checks remain authoritative (`src/lib/booking/tools.ts:95`, `src/lib/booking/tools.ts:379`). The route already retrieves guide context, creates/loads a draft and consumes allowance (`src/app/api/booking/chat/stream/route.ts:136`, `src/app/api/booking/chat/stream/route.ts:143`). The search tool can also obtain the draft (`src/lib/booking/tools.ts:121`); this phase adds no interpretation-driven draft mutation. Preserve guide context ordering for the fallback.

Buffer the search outcome before emitting normal tool/card/text events. Until successful completion, emit no partial fast-path events. On uncertain interpretation, provider failure or read-only search failure, run the existing Claude path once, unless cancelled. Recheck cancellation before tool execution and before every emission; no further call after cancellation. Existing in-flight tool cancellation limitations are disclosed below. Do not replay any mutating tool.

Use bounded fixed Spanish wording, with exact catalog names: invite the visitor to name an experience and a time and say that a reservation is not yet made. The cards omit slots (`src/components/immersive/voice-chat/booking-cards.tsx:52`), so do not suggest that a displayed card has confirmed a particular time. Distinguish no options from all-rejected options, retain rejection/unknown notices, and offer to change criteria. Do not say “choose the first” because card content is not full conversation history. The next ordinary turn contains the original visitor message and assistant text (`src/hooks/use-booking-chat.ts:77`).

```text
@ tryBookingIntake(turn, signal) -> handled | fallback | aborted
ctx: typed adapter; existing search tool; unchanged event writer
pre: pristine Spanish discovery turn; runtime task enabled
do:
  1. parse exact candidates and deterministic exclusions
  2. lookup presence, intent and candidate judgments
  3. validate thresholds, IDs and original spans
  4. lookup authoritative offers through one search tool call
  5. emit buffered normal events and fixed recovery text
br: uncertain or read failure -> ordinary agent once
fail: cancellation -> no further calls or events
```

## Automated acceptance

Implement `INTAKE-01`–`INTAKE-08` in [oracles](behavioral-oracles.md). Tests exercise real owned parsing, adapter and tools, mocking provider HTTP/clock only and using local PostgREST for database effects. A valid case must perform one Jev request and one search, zero Claude requests and zero new interpretation-driven draft/quote/payment mutations. The ordinary route still consumes exactly one allowance and retains its existing draft initialization. Every excluded case must retain normal behavior; uncertainty must cause at most one fallback, with no early fast-path events. Follow-up selection by exact name must still reach the ordinary quote flow.

Focused tests: `npx vitest run src/lib/booking/intake-candidates.test.ts src/lib/booking/intake.test.ts src/lib/booking/agent.test.ts src/app/api/booking/chat/stream/route.test.ts`. Run existing `src/lib/booking/tools.postgrest-integration.test.ts` and `src/lib/booking/booking.postgrest-integration.test.ts` through the repository's local contract setup. Run `npx playwright test --project=release-required-local e2e/booking-roundtrip.spec.ts` with the documented local fixture environment, then the parent's complete sequential gates and contract checks. Fixture HTTP is injected server-side by test setup; do not add a public or production environment override for a fake provider endpoint.

Freeze the 40/120 corpus and 30 paired complete scenarios specified in the parent. Compare current Claude, deterministic-only interpretation, and Jev using identical inputs and catalogs. Run complete scenario comparisons through the local booking route; the extracted harness supplies scenario setup and outcome checks. Record route request-to-first-card and request-to-quote, with common retrieval prework and fixture identity disclosed, rather than presenting agent-only timing as application latency. Retrieval can use the same frozen transport responses in all arms; such runs are controlled local comparisons, not production latency proof. Additional live retrieval would need its own authorization/cap. Include time-to-quote and clarification counts, not just a fast first response. The HTTP boundary wrapper reserves/counts every Claude request against separate explicit request/spend caps before sending, including model/tool-loop retries; reserve the pinned model's published context-ceiling input charge plus requested maximum output charge, retain unknown usage and stop the scenario as partial on cap exhaustion. Importing or fixture-running the harness never starts a paid comparison. Live performance remains unmeasured until a separately authorized run completes.

## Stuck states, manual acceptance and units

Disabled/unsupported/ambiguous input automatically reaches existing chat clarification; tests prove the conversation continues. Provider/search failure also returns to ordinary chat once; a later eligible request can succeed. Cancellation exits loading and drops stale results; this phase guarantees no new work or output after cancellation, but does not claim to cancel HTTP already started by the existing search tool. Phase 6's fresh abortable database client is limited to its new endpoint. No-options/all-rejected displays explicit criteria-edit guidance, with a successful subsequent ordinary chat turn. Test each disclosure and recovery, not just the branch result.

Human review checks Spanish wording and whether unknown constraints remain visible. No paid call or payment is needed. After candidate/question contracts are frozen, `[batch-eligible]` units are domain parser/tests and independently authored evaluation fixtures/rubric (different files, no dependency on parser output). The integration owner owns agent wiring, evaluator registration and cross-layer tests. Stop after acceptance.

## Implementation acceptance

- [x] INTAKE-01 through INTAKE-08 implemented, independently reviewed and verified.
- [x] Frozen 40 tuning/120 held-out cases and 30 complete scenarios independently authored/reviewed.
- [x] Simplify, seven ordinary gates, migrations, 1,046 native contracts and canonical local route/browser checks passed.

See [implementation notes](../2026-10-28-jev-core-improvements-notes.md#phase-3-final-acceptance) for exact identities, all repairs, retained failures and the explicit early raw-log availability limitation. Runtime stays off; fixture timing is not live model qualification.
