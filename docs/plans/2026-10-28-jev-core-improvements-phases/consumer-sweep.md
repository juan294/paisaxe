# Consumer sweep

Parent: [implementation plan](../2026-10-28-jev-core-improvements.md). Searches ran on `develop` at `26c624adce298a98d15ef123b902a4a13d2134bb` on 2026-10-28, after Graphify navigation. Each entry lists the first matching source line; duplicate files across searches expose different contracts. This is the complete result for the recorded searches, not a claim that all transitive application dependencies change.

## Intake callers

Command:

```sh
rg -n 'streamBookingTurn|BookingTurnInput|executeBookingTool|bookingToolDefinitions|draftPatchSchema|getOrCreateOpenDraft' src scripts e2e --glob '*.{ts,tsx,mjs,json,sql}'
```

Disposition for every file below: Phase 3: agent/route/evaluator integration; other listed callers and tests retain their existing contract and run as regressions.

- `scripts/eval/booking-eval.ts:51`
- `src/app/api/booking/chat/stream/route.test.ts:24`
- `src/app/api/booking/chat/stream/route.ts:125`
- `src/lib/booking/agent.test.ts:11`
- `src/lib/booking/agent.ts:44`
- `src/lib/booking/booking.postgrest-integration.test.ts:35`
- `src/lib/booking/drafts.test.ts:3`
- `src/lib/booking/drafts.ts:36`
- `src/lib/booking/invoice.postgrest-integration.test.ts:27`
- `src/lib/booking/replay-model.test.ts:9`
- `src/lib/booking/tools.postgrest-integration.test.ts:21`
- `src/lib/booking/tools.test.ts:9`
- `src/lib/booking/tools.ts:25`

## Draft, replay and SSE writers/readers

Command:

```sh
rg -n 'booking_drafts|BOOKING_AGENT_REPLAY|BookingChatRequest|ChatStreamEvent' src scripts e2e supabase --glob '*.{ts,tsx,mjs,json,sql}'
```

Disposition for every file below: Phase 3: preserve shapes, replay behavior and original history. Quote/payment/database writers are explicitly excluded from modification; their contract tests remain required.

- `e2e/booking-roundtrip.spec.ts:33`
- `e2e/fixtures/booking-env.ts:41`
- `e2e/fixtures/booking-local.ts:147`
- `scripts/check-migrations.ts:69`
- `scripts/eval/booking-eval.ts:61`
- `src/app/api/booking/chat/stream/route.ts:28`
- `src/hooks/use-booking-chat.ts:13`
- `src/lib/booking/agent.ts:42`
- `src/lib/booking/booking.postgrest-integration.test.ts:62`
- `src/lib/booking/cancel.postgrest-integration.test.ts:53`
- `src/lib/booking/capture.postgrest-integration.test.ts:53`
- `src/lib/booking/drafts.test.ts:26`
- `src/lib/booking/drafts.ts:71`
- `src/lib/booking/invoice.postgrest-integration.test.ts:53`
- `src/lib/booking/phone-confirmation.postgrest-integration.test.ts:75`
- `src/lib/booking/quotes.test.ts:46`
- `src/lib/booking/quotes.ts:52`
- `src/lib/booking/reconcile.postgrest-integration.test.ts:79`
- `src/lib/booking/replay-model.test.ts:76`
- `src/lib/booking/replay-model.ts:7`
- `src/lib/booking/retention.postgrest-integration.test.ts:173`
- `src/lib/booking/tools.postgrest-integration.test.ts:37`
- `src/lib/database-boundaries.postgrest-rls.test.ts:13`
- `src/lib/retrieve-chat-context.test.ts:67`
- `src/test/database-boundary-fixtures.ts:18`
- `src/types/booking-chat.ts:6`
- `src/types/sse.ts:33`
- `supabase/migrations/112_experience_booking_schema.sql:6`
- `supabase/migrations/113_booking_rpcs.sql:170`

## Call outcomes and consequential dependents

Command:

```sh
rg -n 'analyzeOutcome|BookingOutcome|extractTranscriptText|process_elevenlabs_event_idempotent|pending_bookings|post_call_transcription' src scripts e2e supabase --glob '*.{ts,tsx,mjs,json,sql}'
```

Disposition for every file below: Phase 4: baseline classifier is read only by the new offline comparison. All listed production callers, data writers, fixtures and migrations are excluded from changes because the advisory cannot affect settlement, SMS or bookings; existing tests remain regression evidence.

- `e2e/webhooks.spec.ts:40`
- `scripts/check-migrations.test.ts:71`
- `scripts/check-migrations.ts:62`
- `src/app/api/cron/fail-stale-bookings/route.ts:12`
- `src/app/api/cron/retry-booking-sms/route.test.ts:63`
- `src/app/api/mcp/make-booking/route.test.ts:1260`
- `src/app/api/mcp/make-booking/route.ts:55`
- `src/app/api/webhooks/elevenlabs/route.phone-confirmation.test.ts:5`
- `src/app/api/webhooks/elevenlabs/route.test.ts:127`
- `src/app/api/webhooks/elevenlabs/route.ts:8`
- `src/lib/booking/legacy-request-key.postgrest-integration.test.ts:3`
- `src/lib/booking/phone-config.test.ts:83`
- `src/lib/booking/phone-config.ts:17`
- `src/lib/booking/phone-confirmation.postgrest-integration.test.ts:8`
- `src/lib/booking/phone-confirmation.test.ts:129`
- `src/lib/booking/phone-confirmation.ts:11`
- `src/lib/booking/retention.postgrest-integration.test.ts:26`
- `src/lib/database-boundaries.postgrest-rls.test.ts:13`
- `src/lib/services/booking-service.ts:9`
- `src/lib/services/elevenlabs-call-service.test.ts:142`
- `src/lib/services/elevenlabs-call-service.ts:31`
- `src/lib/services/elevenlabs-webhook-service.test.ts:13`
- `src/lib/services/elevenlabs-webhook-service.ts:14`
- `src/test/database-boundary-fixtures.ts:22`
- `src/test/database-rpc-fixtures.ts:34`
- `supabase/migrations/053_pending_bookings.sql:1`
- `supabase/migrations/073_cleanup_unused_indexes.sql:12`
- `supabase/migrations/079_webhook_idempotency_rpcs.sql:4`
- `supabase/migrations/083_sms_outbox_atomic_enqueue.sql:3`
- `supabase/migrations/085_atomic_outcome_message_and_stale_booking_cleanup.sql:4`
- `supabase/migrations/091_revoke_internal_function_access.sql:69`
- `supabase/migrations/092_revoke_internal_function_access_fix.sql:46`
- `supabase/migrations/100_reconcile_recorded_voice_durability.sql:11`
- `supabase/migrations/106_booking_orphaned_reconciliation.sql:12`
- `supabase/migrations/107_pending_bookings_rls_posture.sql:2`
- `supabase/migrations/109_booking_sms_dead_letter.sql:28`
- `supabase/migrations/126_phone_confirmation.sql:9`
- `supabase/migrations/128_booking_retention.sql:4`
- `supabase/migrations/131_legacy_request_key_retention_hold.sql:4`

## Catalog constraints and search

Command:

```sh
rg -n 'searchExperiences|listAvailability|evaluateConstraints|ConstraintVerdict|visitorConstraintsSchema' src scripts e2e --glob '*.{ts,tsx,mjs,json,sql}'
```

Disposition for every file below: Phases 3/6: new callers reuse the current search/fact contracts. All listed implementations and existing callers keep their return types and authority; relevant unit/PostgREST tests verify unchanged behavior.

- `src/lib/booking/availability.test.ts:4`
- `src/lib/booking/availability.ts:6`
- `src/lib/booking/booking.postgrest-integration.test.ts:34`
- `src/lib/booking/drafts.ts:8`
- `src/lib/booking/facts.test.ts:3`
- `src/lib/booking/facts.ts:13`
- `src/lib/booking/operator.test.ts:9`
- `src/lib/booking/operator.ts:13`
- `src/lib/booking/quotes.ts:10`
- `src/lib/booking/tools.test.ts:6`
- `src/lib/booking/tools.ts:21`

## Offer-card consumers

Command:

```sh
rg -n 'OfferCard|kind: "offer"|kind: .offer.|bookingCardSchema|offerCardSchema' src scripts e2e --glob '*.{ts,tsx,mjs,json,sql}'
```

Disposition for every file below: Phase 3 emits the existing card schema and tests its UI/history path. Phase 6 uses its own response contract and panel; every listed existing card consumer is explicitly unchanged.

- `src/app/api/booking/chat/stream/route.test.ts:88`
- `src/components/immersive/voice-chat/booking-cards.test.tsx:95`
- `src/components/immersive/voice-chat/booking-cards.tsx:18`
- `src/hooks/use-booking-chat.test.ts:75`
- `src/hooks/use-stream-chat.test.ts:1181`
- `src/lib/booking/agent.test.ts:93`
- `src/lib/booking/tools.test.ts:227`
- `src/lib/booking/tools.ts:158`
- `src/types/booking-cards.ts:12`
- `src/types/sse.test.ts:84`

## Retrieval, cache and evidence consumers

Command:

```sh
rg -n 'retrieveChatContext|SearchResultCache|buildContextText|extractSourcesFromChunks|validateQualityEvidence' src scripts e2e --glob '*.{ts,tsx,mjs,json,sql}'
```

Disposition for every file below: Phase 5: all listed callers, caches and corpus receipt writers remain unchanged. The new checker consumes explicit snapshots only; no adapter silently promotes the old title/URL-only record into passage evidence.

- `scripts/corpus.ts:9`
- `scripts/lib/corpus-quality-evidence.ts:41`
- `scripts/tests/corpus-quality-evidence.test.ts:3`
- `src/app/api/booking/chat/stream/route.ts:296`
- `src/app/api/chat/stream/route.test.ts:13`
- `src/app/api/chat/stream/route.ts:171`
- `src/lib/claude.test.ts:25`
- `src/lib/claude.ts:594`
- `src/lib/corpus-citation.test.ts:18`
- `src/lib/embedding-cache.test.ts:359`
- `src/lib/embedding-cache.ts:38`
- `src/lib/retrieve-chat-context.test.ts:152`
- `src/lib/retrieve-chat-context.ts:3`
- `src/lib/search.test.ts:36`
- `src/lib/search.ts:6`

## New contract ownership

Planned files do not exist yet, so their paths below denote phase ownership rather than current source references.

| Contract | Writers/callers/readers | Coverage |
| --- | --- | --- |
| DecisionResult and question identity | Phase 1 adapter; Phase 2 evaluator; Phase 3 intake; Phase 4 advisor; Phase 5 evidence checker; Phase 6 matcher | ADAPTER/INSPECT plus every domain oracle; invalid responses remain unavailable |
| RunRecord/checkpoints | Phase 2 runner is the only writer; static report and resume are readers; phases 3–6 register explicit suites | INSPECT-01–05; imports never become authenticated provider evidence |
| AdvisoryResult | Phase 4 offline module/CLI and inspector only | CALL-01–06; no production import or settlement conversion |
| ClaimReport | Phase 5 checker/CLI and inspector only; each snapshot claim carries validated citedPassageIds | EVIDENCE-01–06; only cited-subset support, provided-claims coverage and no corpus receipt |
| MatchResponse | Phase 6 route/service writes; hook/panel/evaluator reads; fixture HTTP and E2E setup produce the same response variants | MATCH-01–09; all failure/degraded shapes included |
| Fresh abortable admin client | Phase 6 matching route only; transport-boundary tests | Existing createAdminClient/getAdminClient signatures, configuration and singleton behavior remain unchanged; no request-bound signal reaches their existing consumers |

The fresh factory is additive to `src/lib/supabase-admin.ts:27`; its existing factory tests at `src/lib/supabase-admin.test.ts:26` stay in the phase gate. It does not alter a stored format or existing caller return contract. `e2e/fixtures/booking-agent-replay/e2e.json:1` is additionally retained as a replay writer even though the key-name searches above do not find it; new Jev transport fixtures are separate and must not invalidate replay. No migration, materialized cache format or provider webhook fixture is rewritten to adopt Jev.

On implementation resume, repeat these searches against actual source. Add newly discovered consumers to the relevant phase before altering any shared contract. An accidental expansion into shared return/storage changes requires an explicit recorded plan adjustment and a new complete caller/writer sweep.

