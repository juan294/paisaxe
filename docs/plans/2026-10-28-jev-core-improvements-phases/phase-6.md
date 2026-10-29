# Phase 6 — Explicit experience preference matching

Parent: [implementation plan](../2026-10-28-jev-core-improvements.md). Entry: Phase 5 accepted. Runtime remains off until the matching qualification passes and activation is authorized.

## Product interaction

Add an expandable “Buscar a mi medida” panel in the existing Spanish booking text view (`src/components/immersive/voice-chat.tsx:373`). Keep the conversation visible. Opening the panel performs a cheap authenticated capability check; typing, mounting, swiping and capability checks never call Jev or consume allowance. Only an explicit search submission does so. Do not add a voice action, general developer API, profile storage or inferred persistent preference.

The form accepts one short free-text style preference (1–240 characters) plus explicit optional structured date, party size, budget and the existing supported constraints. Dates/party/budget are parsed and validated in code against the same Madrid horizon and numeric conventions used in Phase 3. Explain that accessibility, language, pets, transport and age requirements must use the corresponding controls; style text is not a source of verified hard constraints. Show “Cada búsqueda usa un turno de tu acceso; si vuelves a buscar, se usa otro turno.” before submission. A submitted request may use that turn even if subsequently cancelled or unavailable; disclose this beside cancel/retry actions. No automatic retries or refunds.

Return at most three suggestions. Preserve verified price, availability, suitability, rejected reasons and unknown constraint notices. Mark soft fit as an estimate based on the catalog description; show only fixed wording or exact catalog excerpts, not generated factual explanations or confidence percentages. “Usar en el chat” prefills the existing composer with the exact experience title and structured criteria and focuses it; it does not submit, create a draft, quote, hold or reservation. This deliberately preserves the current booking confirmation flow.

## Files, route and cancellation contract

Create `src/types/experience-match.ts`, `src/lib/booking/match-experiences.ts` with unit/PostgREST tests, `src/app/api/booking/match/route.ts` and tests, `src/hooks/use-experience-match.ts` and tests, and `src/components/immersive/experience-match-panel.tsx` and tests. Update voice-chat wiring/tests and locale dictionaries at `src/lib/i18n/{es,en,ast,fr,de,pt}.ts`; regenerate locale coverage with the existing `generate-locale-coverage` command. Non-Spanish locales remain runtime-ineligible despite translation-key parity. Extend local booking access/roundtrip E2E and add matching evaluation fixtures/suite.

`GET /api/booking/match?locale=es` reuses `requireBookingAccess`, then returns only `{ available: boolean }`; it never reveals which secret/configuration is absent. Disabled matching displays “Puedes seguir buscando en el chat.” No quota cost. Gate failures keep the existing concealed 404 contract (`src/lib/booking/gate.ts:33`). Cache-Control is private/no-store. `POST` repeats access/configuration/locale validation, applies the existing booking-chat per-user 20/min rate-limit bucket, validates the strict input schema and injection checks, then consumes one atomic `chat_turns` unit (`src/lib/booking/metering.ts:12`). Reusing the same bucket prevents alternating chat/matching to double the request allowance. Existing CSRF middleware still applies (`src/proxy.ts:66`). Invalid, off, non-es and denied requests cannot consume allowance or call Jev. No request asks the model to decide access or validity.

Add a fresh `createAbortableAdminClient(signal)` export and its tests in `src/lib/supabase-admin.ts:27`; preserve both existing factories unchanged. Supabase supports a custom global fetch (`node_modules/@supabase/supabase-js/src/lib/types.ts:250` at the planning baseline). The new helper combines its request signal with each fetch's signal, validates existing server credentials, and is used only by this endpoint's metering/catalog operations. Never place a request-bound signal on the shared singleton. The existing access gate runs unchanged; after it returns, recheck cancellation and apply a 10-second total deadline to the new metering/catalog/matching stage, with Jev capped to the smaller of its remaining budget and 1,200 ms. Do not claim a new end-to-end deadline for the unchanged authentication gate.

Cancellation aborts in-flight HTTP in this new stage, stops additional calls and prevents stale rendering. Aborting the quota RPC does not prove that its database transaction did not commit: never retry it automatically or assert a refund. The UI says a submitted search may have used a turn; a later explicit search is a new charged request. Deadline/provider failure after successful catalog retrieval returns the deterministic shortlist; catalog failure returns unavailable. The hook cancels superseded requests and uses request identity to ignore late responses.

## Search and ranking contract

Call the existing `searchExperiences` with the abortable client and explicit hard criteria (`src/lib/booking/availability.ts:87`). Its provider-fact decisions remain authoritative (`src/lib/booking/facts.ts:51`). It currently searches the active catalog and can query seven days of slots per eligible experience. The cap below bounds semantic input only; it does not claim to reduce catalog database work. Optimizing the availability query is a separate future change, not a hidden part of this phase.

Select at most ten non-rejected candidates from deterministic order. Send only IDs, titles, bounded descriptions and relevant confirmed facts; exclude user IDs, capability tokens, payment data and conversation history. Ask one independent Noul per candidate: whether its supplied description supports the visitor's expressed style preference. Do not ask whether it satisfies booking constraints. Within each existing suitability partition, confidently positive matches sort by descending judgment, then original order; all uncertain/negative candidates keep original relative order after positives. Rejected entries never become suggestions; unknown constraints never become confirmed. If no confident positives, use deterministic ordering and explain that no clear style match was established. Empty style is invalid, so there is no inference without a stated preference.

The new response is a separate discriminated contract: `matched` with suggestions and `examinedCount/truncated`; `degraded` with the same deterministic suggestions and a safe reason; `no_results` with authoritative rejection/alternative information; or `unavailable` with retry/chat guidance. Preserve all available hard-fact notices in each nonempty result. HTTP 400 is editable input error; 404 is the concealed access failure; 429 carries rate-limit or allowance guidance and retry timing when available. Disabled/config missing is capability unavailable and POST 404. No changes to `OfferCard`, `ChatStreamEvent`, search result schemas or existing caches.

```text
@ matchExperiences(request) -> MatchResponse
ctx: existing access and quota; abortable catalog; typed adapter
pre: explicit Spanish submit; configured task; validated structured criteria
do:
  1. validate access, rate limit, configuration and request
  2. write one atomic allowance consumption
  3. lookup authoritative catalog and bounded candidate projection
  4. lookup independent soft-fit judgments under remaining deadline
  5. compute stable order within suitability partitions
  6. emit suggestions with unknowns, quota and recovery disclosure
fail: semantic failure -> deterministic result; catalog failure -> unavailable
```

## Acceptance, recovery and independent units

Implement `MATCH-01`–`MATCH-09` in [oracles](behavioral-oracles.md). Test actual server parsing, schema, access/metering, provider HTTP and deterministic search. Use local PostgREST to prove atomic quota under concurrent submits and unchanged provider-fact verdicts. Include abort during metering, catalog and inference; assert at most one consumption attempt, no automatic retry, no additional network work after cancellation, and no stale result displayed. No write to booking drafts/profiles/quotes/holds is allowed from matching; database quota bookkeeping is expected.

Focused tests cover the new service, route, hook and panel plus `src/lib/supabase-admin.test.ts`, `src/components/immersive/voice-chat.test.tsx` and locale completeness. Run `npx playwright test --project=release-required-local e2e/booking-access-boundary.spec.ts e2e/booking-roundtrip.spec.ts` using local fixture transport and `@local-docker` cases, then all parent gates and local database contract checks. Keep the current factory/singleton tests passing. No new schema or release workflow is required.

Recovery must be visible: invalid input highlights the field; disabled feature points to normal chat; expired access links to the existing access flow; exhausted allowance displays the limit; rate limit displays its retry time; empty/rejected results invite criteria changes; uncertain facts remain labelled; Jev failure still displays catalog options; catalog failure offers explicit retry/chat; cancellation exits loading and preserves editable inputs. Retry is a fresh, explicitly charged request. A restored configuration, replenished access, changed criteria or later successful request must recover without page reload or a sticky error cache. Capability is rechecked on panel reopen and explicit retry.

Human review checks Spanish clarity, mobile layout, keyboard/focus behavior and screen-reader status announcements. Run the parent's 40-case blind matching comparison only under separately authorized live limits; a deterministic transport test cannot qualify real ranking quality. After the response schema and UI copy are frozen, `[batch-eligible]` units are server service/route/tests and hook/panel/tests, with disjoint file ownership. Integration owner owns admin-helper changes, voice-chat/i18n wiring, suite registration and E2E. Stop after Phase 6 acceptance; enabling runtime remains a separately authorized settings action.

## Implementation acceptance

- [x] MATCH-01–09, independent source/fixture/mobile review, repair and three simplify passes completed.
- [x] All seven local gates, unchanged coverage thresholds, Knip, migration and cadence contracts passed.
- [x] Fresh native contracts: 1,046/1,046 in 23 suites, no failures/skips.
- [x] All four required local browser tests passed with retries disabled; matching API/browser and all 90 intake scenario arms completed, owned rows cleaned and task stack disposed.

See [implementation notes](../2026-10-28-jev-core-improvements-notes.md) for exact source identities, findings, retained failed attempts and archive mapping. Deterministic acceptance does not qualify or activate runtime; blind live preference/latency remain unmeasured.
