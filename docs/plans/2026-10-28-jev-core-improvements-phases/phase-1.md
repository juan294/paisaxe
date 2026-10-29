# Phase 1 — Typed Jev adapter and failure contract

Parent: [implementation plan](../2026-10-28-jev-core-improvements.md). Baseline: `26c624adce298a98d15ef123b902a4a13d2134bb`; revalidate before work. No product route calls Jev in this phase.

## Changes and ownership

Create `src/lib/jev/contracts.ts`, `config.ts`, `client.ts` and their tests. Update `package.json`/lockfile with exact SDK `0.7.0`; document `TYPESAFE_API_KEY` and empty `JEV_ENABLED_TASKS` in `.env.example` and `docs/operations/secret-inventory.md`. Add `docs/operations/jev.md` with modes, deadlines, logs, failure recovery and later evaluation commands. Do not provision credentials or alter the database/Anthropic usage tables.

Use `getEnv` for trim/lazy reads (`src/lib/env.ts:35`). Guard secret-consuming modules with `server-only`, not the shared contract types. Inject the SDK's HTTP fetch for provider-boundary tests; do not mock owned domain functions. Explicitly set `baseURL: "https://api.typesafe.ai"` and `logLevel: "off"`, so ambient `TYPESAFE_BASE_URL`/`TYPESAFE_LOG_LEVEL` cannot redirect requests or log bodies. Use existing structured logger with an allowlisted metadata projection (`src/lib/logger.ts:67`). The versioned SDK reference confirms per-attempt timeout plus default retries, so explicitly set retry count zero and propagate a total-deadline AbortSignal. [Request options](https://docs.typesafe.ai/sdk/javascript/api/interfaces/RequestOptions)

Define a small generic envelope: `answered` carries validated answers, exact returned model, question version, elapsed milliseconds and nullable usage; `unavailable` carries reason `disabled | not_configured | invalid_config | deadline | aborted | rate_limited | provider_error | invalid_response`. Domain abstention is separate from transport failure. A returned model different from the pinned version is invalid response. Validate exact expected answer keys, selected IDs, finite [0,1] probabilities and distribution totals within 0.001; reject extras that could be mistaken for a requested answer. Never expose raw SDK exception headers/bodies.

Runtime tasks allowlist has two legal values only. CLI live invocation passes an explicit evaluation context after its own preflight; it cannot turn on runtime tasks. Text payloads are bounded to 32 KiB UTF-8 and task-defined candidate/claim limits; truncate nothing silently. Empty/malformed state is rejected before HTTP. Interactive total deadline 1,200 ms; evaluation 10,000 ms. No automatic retries, global error cache, queue or circuit-breaker framework.

```text
@ askJev(questionSet, state, context, signal) -> DecisionResult
ctx: server-only SDK; fixed model; HTTP fetch; logger
pre: state/question bounds valid; context authorizes this task
do:
  1. validate configuration and allowed task
  2. compute child deadline bounded by caller cancellation
  3. lookup typed answers through one provider request
  4. validate model, keys, IDs, probabilities and usage
  5. emit metadata-only completion record
fail: error -> typed unavailable; abort -> no subsequent work
```

## Behavioral oracles and automated acceptance

Implement `ADAPTER-01`–`ADAPTER-05` in [behavioral oracles](behavioral-oracles.md). HTTP fixtures exercise the actual SDK: missing key/off -> zero requests; timeout/abort -> at most one; 429/529 -> unavailable without SDK retry; malformed/extra/missing fields -> invalid response; successful request immediately after a failure -> answered. Verify null usage is not zero cost. Feed secret-like strings in state and error bodies and assert logs omit them. Build must reject client imports of the server module.

Run focused `npx vitest run src/lib/jev` during TDD. Finish all parent local gates, including environment/secret-inventory/license checks. Do not add an exclusion to coverage or a hosted workflow. Ordinary tests must not use the developer's real key even if it exists in the environment.

## Stuck states and recovery

Missing key/invalid config: operator receives the exact variable name and a link to `docs/operations/jev.md`, never the value. Runtime tasks remain unavailable; the app is unaffected. Test a subsequent corrected configuration request succeeds. Timeout/429/malformed data: no semantic result; next explicit request may succeed without restart. Test both failure and recovery. Abort: listener/timer cleanup completes and no late log claims success. Oversized input: show byte limit and ask the caller to reduce the explicit state; test reduced input is accepted.

## Manual acceptance and independent units

Human review checks that logs/configuration instructions reveal no secrets and the SDK license matches the repository policy. No live provider check is required for this deterministic phase, and fixture transport is labelled as such.

Keep this phase with one implementation owner: contracts, client and configuration are tightly coupled. Stop after reviewed local integration and report exact test identity. Runtime and production settings remain off.

## Implementation acceptance

- [x] Adapter, configuration, SDK pin and operations documentation implemented.
- [x] ADAPTER-01 through ADAPTER-05 deterministic fixtures and recovery passed.
- [x] Independent review, repairs, three-lens simplify and seven local gates passed.

Exact identity, failures retained, test counts and next-phase handoff are recorded in [implementation notes](../2026-10-28-jev-core-improvements-notes.md#phase-1--adapter). Live qualification remains unmeasured and runtime remains off.
