# Phase 5 — Supplied-evidence claim checker

Parent: [implementation plan](../2026-10-28-jev-core-improvements.md). Entry: Phase 4 accepted. Developer-only inspection; no user-facing retrieval or streaming change.

## Changes and contract

Create `src/lib/jev/evidence.ts`, `src/types/jev-evidence.ts` and tests; add `scripts/eval/jev-evidence.ts` and fixtures; extend the inspector's registered suite and renderer. Existing retrieval caching, citations and corpus acceptance stay unchanged (`src/lib/retrieve-chat-context.ts:22`, `scripts/lib/corpus-quality-evidence.ts:66`). Recorded answer text/title/URL alone is insufficient evidence (`scripts/lib/corpus-quality-evidence.ts:27`); do not silently fetch those URLs or treat them as passage bodies.

Accept an explicit snapshot: query; answer; reviewer-provided claim units with exact answer spans and nonempty `citedPassageIds`; passage bodies with unique IDs, source citations and content hashes; corpus version/hash; generator identity and capture time. Expected labels are kept out of model state. Validate claim spans, cited-ID associations, unique IDs and hashes before inference. Missing passage bodies/identity/citation association produce `unavailable` and an exact missing-field message. This checks only supplied claims; it does not promise complete claim extraction or whole-answer verification.

For each claim, code checks any declared quotation is an exact substring of one of its cited passages; a mismatch is `unavailable: quotation_mismatch` before HTTP and requests correction of the supplied quotation. Independent Noul questions test support and contradiction using only that claim's `citedPassageIds`, not unrelated passages elsewhere in the snapshot. Result is `supported`, `contradicted`, `not_established`, or `unavailable`. Positive support with negative contradiction is supported; positive contradiction with negative support is contradicted; both confidently negative is not-established; conflicting or intermediate judgments are unavailable with reason `ambiguous_evidence`. Validate selected evidence IDs are members of that claim's cited subset. If an unrelated cited passage A lacks support and uncited passage B supports the claim, the citation-support result cannot pass; this phase does not additionally search for uncited support. Time-sensitive claims about present availability cannot be supported by undated general descriptions. Request state clearly distinguishes evidence text from instructions, but adversarial tests determine semantic reliability.

Every result states `coverage: provided_claims_only`, the supplied/checked/unavailable claim counts, model/question identity and passage hashes. Never label the whole answer “verified”. Never create or update owner acceptance receipts, corpus release status or retrieval caches. A failed provider call is unavailable, not not-established; previous failure evidence is retained when a later run succeeds.

```text
@ checkEvidence(snapshot) -> ClaimReport
ctx: explicit answer spans and passage bodies; typed adapter
pre: valid immutable snapshot; expected labels excluded from state
do:
  1. validate spans, passage IDs, hashes and quotation equality
  2. lookup independent support and contradiction per bounded claim
  3. validate selected evidence IDs and judgment consistency
  4. compute labels with explicit unavailable reasons
  5. emit provided-claims coverage and provenance
fail: missing or ambiguous evidence -> unavailable with repair instructions
```

## Acceptance and recovery

Implement `EVIDENCE-01`–`EVIDENCE-06` in [oracles](behavioral-oracles.md). Cases cover missing passage bodies, duplicate IDs, wrong hashes, unknown selected IDs, exact quote mismatch, wrong-property claims, stale availability, contradiction, supported paraphrase, mixed judgments and instruction-like source text. Tests prove no corpus receipt/cache/write path is invoked. Supplying the missing body/correct hash in a new snapshot must resolve structural unavailability; successful re-evaluation creates linked new evidence without rewriting the old record.

Focused command: `npx vitest run src/lib/jev/evidence.test.ts scripts/eval/jev-evidence.test.ts scripts/tests/corpus-quality-evidence.test.ts scripts/lib/jev-report.test.ts`; run all parent gates. Preserve the existing frozen 40-query corpus and its validator unchanged. Add at least 20 held-out claim cases, independently authored after tuning examples and balanced across supported, contradicted and not-established. Report semantic abstention in the denominator for recall/F1; provider/incomplete cases additionally make the run partial. The parent's zero false support, >=90% support recall and >=90% macro F1 criteria apply only to this supplied-claims task.

Human review checks that a developer can distinguish missing passages, semantic disagreement and unsupported claims in the report. Repair instructions are specific: supply the named body/hash, correct the supplied claim span, or start a capped retry after a transport failure. A conflicting passage pair remains visibly ambiguous until the operator changes the explicit evidence set; a retry alone cannot be advertised as resolving it.

After the snapshot/result schema is frozen, `[batch-eligible]` units are the pure checker/tests and independently authored evaluation cases/rubric. Integration owner owns runner/report integration. Stop after acceptance. An inline answer checker or automatic corpus approval remains outside this plan.

## Implementation acceptance

- [x] EVIDENCE-01–EVIDENCE-06 implemented, independently reviewed and accepted locally. All seven refreshed gates, 30-case fixture CLI and static report review passed; existing corpus contracts are unchanged and live quality remains unmeasured. See the [phase evidence and findings](../2026-10-28-jev-core-improvements-notes.md#phase-5--accepted-locally).
