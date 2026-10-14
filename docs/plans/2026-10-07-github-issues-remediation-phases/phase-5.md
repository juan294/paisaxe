# Phase 5: Retrieval, cancellation and measured backend changes

Parent: [backlog plan](../2026-10-07-github-issues-remediation.md). Owned issues: #936, #933, #930, #918, #919, #802. Baseline: develop `fe1843713a49277bc66460e4ae7470025d01e1c6`; revalidate at entry. Status: implemented and independently reviewed locally on 2026-10-09; owner acceptance pending. Final check and delivery identities are recorded in the [implementation notes](../2026-10-07-github-issues-remediation-notes.md) and private Phase 5 handoff. The carried combined provider gate remains red because ElevenLabs fixture qualification is unverified; #919 and #802 remain open with the dispositions below. Apply the parent's local-only authority, TDD/review/simplify loop, sequential verification, coverage ratchets and acceptance boundary in full.

## Scope and source evidence

Sources: `src/lib/search.ts:1`, `src/lib/rerank.ts:1`, `src/app/api/chat/stream/route.ts:259`, `src/app/api/booking/chat/stream/route.ts:182`, `src/app/api/booking/chat/stream/route.ts:283`, `src/lib/chat-stream-timeouts.ts:13`, `src/lib/chat-stream-timeouts.ts:23`, `src/lib/chat-stream-timeouts.ts:29`, `src/app/api/admin/costs-analytics/route.ts:383`, `src/app/api/admin/elevenlabs-analytics/route.ts:290`, `src/lib/services/elevenlabs-call-service.ts:187`. Accepted [ADR 0021](../../decisions/0021-translation-background-worker.md) governs translation-worker timing.

## Design and ownership

One retrieval owner handles search/cache/rerank/timers and both chat routes, including fixtures. Add a narrow retrieveChatContext orchestration that checks complete result cache before embedding; keep serialization/model/dimension identity and stage timing intact. Thread parent cancellation and bounded child signals through embeddings, PostgREST/image queries and Voyage. Installed SDK abortSignal and PostgREST abortSignal support are used; do not invent a noncancellable Promise.race fix. Rerank's 2.5-second child timeout returns uncached vector-order fallback; parent/client abort stops the whole pipeline and forbids late SSE/cache writes.

Extract a bounded generation timer with reset/dispose, typed reason and exactly-once callback. Adopt general AND booking timer pairs, preserving 30-second idle and 90/85-second caps; resetting idle never resets the cap. Dispose timers/listeners on every completion/error/cancel path. Preserve general search_unavailable and booking optional-context degradation.

Timeout-classifier unit [batch-eligible] owns one pure helper and the three analytics/call-service consumers, with no shared chat files. Recognize AbortError/TimeoutError from unknown/DOMException-shaped values while preserving booking ambiguity/orphan reconciliation; unrelated Stripe RPC_TIMEOUT semantics stay distinct.

#919: benchmark the actual active+approved stories predicate on current and realistic growth fixtures with EXPLAIN ANALYZE BUFFERS. Add a composite partial index only if measured workload benefit justifies it; preserve RLS and existing indexes. Otherwise record measured deferral and leave the issue open.

#802: collect queue age/backlog, complete-translation p95, batch wall time and approval burst measurements. ADR triggers: >50 pending for >1 hour, p95 >10 minutes, batch >45 seconds regularly, routine >20 approvals/5 minutes, or >5 non-Spanish locales. Below triggers, retain inline drain and record deferral. If triggered, a revised phase contract reuses the existing durable queue/lease/attempt limits with an independently executing Supabase worker, enqueue+202 and visible admin progress/retry. This conditional extension needs architecture acceptance and separate provider/schedule authority before execution; a scheduled Vercel HTTP drain does not prove independence from HTTP limits. Inngest is excluded absent a new vendor decision. Phase 3 repairs pg_net wakeups before their recovery is trusted.

```text
@ retrieveChatContext(query, limit, signal) -> context
ctx: result cache, embedding, PostgREST and Voyage
pre: validated query; live parent signal
do:
  1. lookup complete successful cached context
  2. compute embedding only for a miss
  3. compute bounded search and cancellable rerank
  4. cache only complete non-degraded success
br: rerank timeout -> uncached vector fallback; parent abort -> cancel
fail: transport failure -> existing bounded route error or disclosed degradation
```

## Automated criteria

Use real orchestration/cache with network-boundary fakes: hit makes zero upstream calls; miss exactly one pipeline; expired/corrupt cache recovers; rerank timeout observes actual cancellation; outer abort cancels children, no late writes. Fake-clock timer tests cover idle reset, hard-cap trickle, racing timeouts, exactly-once error and disposal; next turn succeeds. Both chat route integration tests retain their separate contracts. Classifier fixtures preserve initiating/orphan recovery.

Index candidate preserves anonymous active+approved results and provides measured before/after plan/buffer evidence. Translation measurement parser/tests distinguish missing evidence from below-threshold; conditional worker, if separately accepted, must test crash/lease reclaim, capped attempts, duplicate enqueue, progress, exhausted retry and corrected recovery across manual/admin/webhook callers.

## Manual and external criteria

Read-only production metrics may corroborate workload; no production index/worker/schedule is created here. Queue measurements need a representative window, not one empty snapshot. Absent evidence leaves strategic issues open with precise next collection action.

## Stuck states and recovery

Chat shows existing retry/text path on search failure or timeout; a fresh turn succeeds after recovery. Booking can proceed with disclosed optional context loss. Cache errors do not become permanent negative cache entries. Translation queued/failed work is visible to admin with retry; exhausted work cannot disappear. Missing benchmark/metrics blocks only the conditional architectural change and names the measurement needed. Test each successful retry or disclosure.

## Phase acceptance and handoff

Run the parent's applicable sequential integration gates plus the automated criteria above on the integrated candidate. Record exact identity, commands, pass/fail/skip counts, review/simplify findings and fixes, and each issue's local/runtime disposition. Manual or provider evidence is separate; missing evidence leaves the issue open. Stop after acceptance, preserving the plan and implementation receipts; proceed only with authorized continuation. Consumer ownership and command inventory are in [consumer sweep](consumer-sweep.md).


## Local implementation disposition, 2026-10-09

The owner accepted Phase 4 and explicitly authorized Phase 5. Work started from develop `3b1bc049a8ae20775f7fe438f7cd9df569b7c3cc` in isolated branch `fix/issues-phase5-retrieval`. Frozen tracked/nonignored input digest: `abc31996a79d3567c717c76d5723de84ba1ed3f64ff457781f4a4ed7efb3192b`. The final commit/tree, native-hook results, local integration and exact-owned cleanup belong to `logs/issues-phase5-2026-10-09/phase5-handoff.json`; no later step is inferred from this precommit document.

| Issue | Local disposition | Remaining boundary |
| --- | --- | --- |
| #936 | Complete result-cache lookup precedes embedding, with corruption/TTL recovery and zero-upstream cache-hit controls. | Release/observed runtime and eventual issue closure remain separate. |
| #933 | Parent and child cancellation reach actual SDK/PostgREST transports; bounded rerank timeout yields uncached vector fallback. | HTTP-boundary fakes are synthetic; no new live provider evidence is claimed. |
| #930 | Pure exact-name helper adopted by all three consumers; initiating/orphan recovery and Stripe semantics preserved. | Release and eventual issue closure remain separate. |
| #918 | Shared reset/dispose generation timer preserves idle/total budgets in both routes with exactly-once expiry and fresh-turn recovery. | Release and eventual issue closure remain separate. |
| #919 | Measured local deferral: candidate index was never selected in 224 plans and supplied no buffer/result benefit. No migration added. | Issue stays open; local synthetic growth is not production workload proof. |
| #802 | Strategic deferral: representative workload evidence is unmeasured; semantic parser and concrete collection runbook are implemented. Inline execution retained. | Issue stays open; collection scope and any triggered worker architecture/provider/schedule need separate decisions. |

Full ordinary/coverage, required database component, type/lint/Knip, native cadence, builds and browser outcomes are retained separately with exact identities and failed attempts. The combined provider command's exit 1 is not relabeled green. See the [measurement runbook](../../operations/backend-measurements.md) for both strategic next actions and the implementation notes for verification/deviation details. Phase 6 is not started by this artifact.
