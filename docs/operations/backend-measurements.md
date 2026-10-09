# Retrieval and backend measurement gates

Phase 5 of the [backlog plan](../plans/2026-10-07-github-issues-remediation-phases/phase-5.md) preserves the current translation architecture and story indexes while measuring their proposed replacements. Neither a passing parser nor a synthetic benchmark establishes production workload.

## Story index, issue #919

On 2026-10-09, the task-owned PostgreSQL 17.11 stack compared the proposed `(is_active, curation_status) WHERE is_active = true AND curation_status = 'approved'` index against existing indexes. Queries used the actual anonymous role and RLS, full `PUBLIC_STORY_SELECT` projection, active/approved predicate and ascending `display_order` from `src/lib/stories-data.ts:53` and `src/lib/stories-server.ts:108`. The all-story, category, location and duration queries each ran seven times before and after index creation. The first execution was excluded as warmup; the remaining six use the conventional median.

| Fixture | Total rows | Public rows | All-story median before / after | Shared hit blocks before / after |
| --- | ---: | ---: | ---: | ---: |
| Retained fallback catalog | 25 | 25 | 0.018 / 0.020 ms | 2 / 2 |
| 10 times catalog, mostly approved | 250 | 189 | 0.090 / 0.0885 ms | 13 / 13 |
| 100 times catalog, mostly approved | 2,500 | 1,800 | 0.4615 / 0.4805 ms | 168 / 168 |
| 100 times catalog, selective approval | 2,500 | 450 | 0.2065 / 0.2085 ms | 51 / 51 |

Across all 224 `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` plans, PostgreSQL never selected the candidate index. All 16 query/scenario comparisons returned identical public-result fingerprints and hit/read buffer counts. No measured workload benefit justifies a migration. The temporary fixtures and index were rolled back, and the initial row count and complete schema digest were verified afterward. Existing indexes and policies were preserved. **#919 remains open with a measured local deferral.**

The 25-row fixture is retained source content, not a production inventory. Growth repeats that content with explicit moderation/activity distributions and empty metadata; it is a sensitivity check, not a forecast. Measurements are warm, single-client, local ARM PostgreSQL executions with baseline first. They do not measure production data, cold I/O, concurrency, network transfer, write cost or slug lookups. Small timing differences do not establish a speedup or regression. Revisit with a named representative production workload and actual row/payload/selectivity distributions before proposing an index.

Private reproducible evidence is retained under `logs/issues-phase5-2026-10-09/`: `story-index-benchmark.mjs`, `.sql`, `.raw` and `.json`. The command-length failure and the original upper-median summary remain separate historical receipts; `story-index-summary-correction.json` records recomputation from unchanged raw plans.

## Translation worker, issue #802

The current workload signals are **unmeasured**. Available queue timestamps, story metadata and configuration cannot reconstruct a complete representative approval-to-all-locales cohort, queue-depth history, batch durations or approval-transition history. The source config has five non-Spanish locales (`src/lib/translation-locales.ts:4`); this does not attest deployed configuration. **#802 remains open pending collection.** Keeping the current drain while collecting evidence is not a finding that traffic is below the [ADR 0021](../decisions/0021-translation-background-worker.md) triggers.

`scripts/lib/translation-worker-measurement.ts:48` assesses externally reviewed aggregates. It does not collect telemetry, authenticate provenance or verify the analyst's completeness declaration. Run it locally with a reviewed JSON input on standard input:

```sh
node node_modules/tsx/dist/cli.mjs scripts/lib/translation-worker-measurement.ts < reviewed-translation-measurements.json
```

Input requires `source: "production"`, a chronological ISO UTC `window.start`/`window.end`, `window.representative: true`, a nonempty `window.rationale` and a `metrics` object. Each supplied metric needs a finite nonnegative `value`, positive integer `sampleCount`, `complete: true`, a nonempty retained `evidence` reference and the exact definition below. Count values must be integers. Missing or invalid evidence remains `unmeasured`; it never becomes zero.

| Metric | Required definition | ADR trigger |
| --- | --- | --- |
| `sustainedQueueSeconds` | `longest_continuous_depth_above_50_seconds` | More than 3,600 seconds continuously above 50 pending jobs |
| `fullTranslationP95Seconds` | `approval_to_all_required_locales_p95_seconds` | More than 600 seconds |
| `batchWallSeconds` | `three_job_batch_wall_seconds` | More than 45 seconds and `regular: true` |
| `approvalsPerFiveMinutes` | `max_distinct_approved_stories_per_rolling_300_seconds` | More than 20 and `routine: true` |
| `nonSpanishLocaleCount` | `configured_non_spanish_locale_count` | More than five |

`regular` and `routine` are reviewed frequency interpretations whose denominator and rationale must be retained in the supporting evidence. Their absence is unmeasured. An isolated slow batch or approval burst does not meet the corresponding sustained trigger. Equality does not exceed a strict threshold. One qualified trigger yields `architecture_review_required` even if other signals are missing. Five qualified non-triggering signals yield `retain_inline`; otherwise the decision is `collect_evidence`. A successful CLI exit means classification completed, not that measurements qualified or a worker is authorized.

### Next collection action

First define a representative seven-day window covering normal and bulk approvals. Separately scope read-only export of retained production function/access logs and approval/audit records, with deployed revision, raw export hashes, query filters, clock bounds, retention gaps and coverage of all approval writers. Do not create new approval/model traffic to fill historical gaps.

Collect queue snapshots at a documented cadence, such as 60 seconds, over the same representative prospective window. Record status counts and oldest original enqueue age separately. An old pending job does not establish continuous depth above 50; gaps in observations must break or invalidate an asserted sustained interval. Persistent collection or a deployed schedule needs its own scope.

Bind real approval transitions to story/source revisions and first completion across every required locale. Retain incomplete, failed and right-censored members; queue enqueue-to-job-completion timestamps and mutable `last_translated_at` are not approval-to-full-translation latency. Record actual three-job invocation start/end and outcomes, including failures/timeouts. Derive rolling 300-second bursts from distinct actual approval transitions across all writers, not requested bulk IDs or deduplicated queue rows. Attest deployed locale configuration separately. If retained records cannot supply these observations, record the missing instrumentation rather than inventing a favorable aggregate.

Any worker extension still requires architecture acceptance and separate provider/schedule authority. Reuse of the durable queue, leases and attempt limits does not itself authorize a new worker or vendor.
