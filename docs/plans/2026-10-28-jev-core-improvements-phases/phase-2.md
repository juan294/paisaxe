# Phase 2 — Developer inspector and evaluation runner

Parent: [implementation plan](../2026-10-28-jev-core-improvements.md). Entry: Phase 1 accepted. Build a useful local CLI/report before domain integrations; do not introduce an admin product dashboard.

## Changes and contract

Create `scripts/eval/jev.ts`, `scripts/lib/jev-evaluation.ts`, `scripts/lib/jev-report.ts`, their tests, and `scripts/eval/fixtures/jev/provider-contract.json`. Add `eval:jev` as `tsx --conditions=react-server scripts/eval/jev.ts`, following the existing server-only evaluator launcher (`package.json:29`); extend `docs/operations/jev.md`. Verify this real subprocess path because Vitest's server-only mock hides missing conditions. The integration owner owns package edits and suite registrations throughout later phases.

CLI operations: `--list`; `fixture --suite provider-contract`; `inspect --input <record>`; `live --suite <registered-suite> --max-requests <positive integer> --max-spend-usd <positive decimal>`. Live additionally accepts `--case <case-id>` for a bounded repeat, or `--resume <run-directory>` with optional `--retry-unknown <comma-separated-attempt-ids>` for explicitly selected ambiguous attempts. A resume command must name new/remaining authorized caps; report cumulative prior/reserved/new spend separately. `live` has no default budget and refuses CI/Vercel processes. It reads an already available key without printing it. Invocation flags express operational limits, not permission; the operator must already have the explicit authorization described in the parent plan. No customer transcript importer, database fetch or API upload is introduced.

The first suite is a synthetic provider-contract check: Spanish text “La visita está confirmada para el 30 de octubre.” with independent questions about an explicit confirmation and an explicit cancellation. It validates request/response plumbing only; its report cannot qualify any runtime task. Later phases register their own bounded suite functions; do not build a generic workflow engine.

Versioned record fields: schema version, evidence kind (`fixture`/`live`/`imported`), task, case and split ID, source commit/tree/dirty status, model, question/policy version and digest, state/case-set hashes, exact synthetic request, provider response or error, expected label stored separately from request, baseline result, outcome, latency, nullable usage, cost/reserved upper bound, and completeness. Public/curated summaries contain no raw user data. Reject incompatible imports instead of fabricating missing identity. Baseline and candidate comparisons require identical case IDs and input hashes.

Write append-only run directories under `test-results/jev/<UTC timestamp>-<random suffix>/`: `run.json`, `attempts.jsonl`, `cases.jsonl`, `report.html`. Persist and flush each attempt's request-count increment and spend reservation before dispatch; only then send HTTP. Partial results are checkpointed atomically. Repeated runs never overwrite prior evidence. Resume must match model, questions, inputs and case-set hashes; it copies completed records with provenance and invokes only unresolved cases. An attempt without a durable completion is unknown completion, retains its reservation/count and is not silently resent; retry needs an explicit operator choice and remaining/new authorized cap. Accounting is per HTTP request, including multiple claim requests within one case. Do not label replayed latency as fresh. Default output is ignored by the repository already (`.gitignore:61`).

The static HTML report uses escaped text, native expandable details, no external assets/scripts/network requests. Show per-case state, judgments/distributions, baseline/expected results, failed or missing cases and comparison metrics. A failed case includes a copyable command to repeat that read-only case within a new capped run. HTML/Markdown in source text remains inert. An imported record is displayed as imported, not authenticated provider evidence. The existing corpus gate makes the same authenticity distinction (`scripts/lib/corpus-quality-evidence.ts:38`).

Before each live Jev request reserve the published charge for 65,536 input tokens at the pinned price; this is deliberately conservative against the documented 64k request ceiling. No retries. Release unused reservation only when validated usage is available; retain it on unknown usage or ambiguous provider completion. Stop before a request that cannot fit both caps. A price/model change invalidates this run policy. Additional-provider benchmarks require separate explicit bounds and are not charged against this Jev-only estimate. [Pricing/context](https://docs.typesafe.ai/models)

```text
@ runEvaluation(suite, mode, limits, resume) -> RunRecord
ctx: explicit local fixtures; bounded adapter; local output directory
pre: registered suite; valid identity; live mode has authorization and caps
do:
  1. validate cases, labels, splits and resume identity
  2. write durable budget reservation before each HTTP attempt
  3. lookup fixture or live judgment without sending expected labels
  4. write case outcome and checkpoint atomically
  5. emit escaped report with complete and missing denominators
fail: unavailable or exhausted cap -> partial report and nonzero exit
```

## Acceptance and recovery

Automate `INSPECT-01`–`INSPECT-05` from [oracles](behavioral-oracles.md). Default fixture/list/inspect modes must perform zero network calls; live without caps fails before network. All cases remain in coverage denominators. A mixed successful/failed run must exit nonzero and display `complete:false`; resuming requests only missing cases and does not double-count prior cost. Input/script injection must render as text. A corrupted checkpoint or changed question version rejects resume with an actionable “start a new run” message.

Focused command: `npx vitest run scripts/lib/jev-evaluation.test.ts scripts/lib/jev-report.test.ts scripts/eval/jev.test.ts`; then all parent gates. Check `npm run eval:jev -- --list` and fixture/inspect commands locally, recording that they are zero-spend checks.

Manual acceptance: open the local report and confirm a developer can find disagreement, missing evidence and the next read-only command without knowing internals. This is a visual/readability review, not live model qualification. No private file upload is needed.

After the record schema is frozen, `[batch-eligible]` units are runner/checkpointing (`jev-evaluation*`, CLI) and pure report rendering (`jev-report*`), with separate owners. Integration owner wires them and updates scripts/docs. Stop after Phase 2 acceptance.

## Implementation acceptance

- [x] Inspector, bounded runner, durable reservation/recovery and escaped static reports implemented.
- [x] INSPECT-01 through INSPECT-05 and actual CLI subprocess checks passed.
- [x] Independent review, repairs, simplify and seven local gates passed.

See [implementation notes](../2026-10-28-jev-core-improvements-notes.md#phase-2--inspector-and-runner) for exact identity and retained failures. Qualification is plumbing-only; runtime remains off.
