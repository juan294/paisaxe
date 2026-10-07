# Phase 11: Checked indexed access

Parent: [backlog plan](../2026-10-07-github-issues-remediation.md). Owned issues: #867. Baseline: develop `fe1843713a49277bc66460e4ae7470025d01e1c6`; revalidate at entry. Status: planned, not implemented. Apply the parent's local-only authority, TDD/review/simplify loop, sequential verification, coverage ratchets and acceptance boundary in full.

## Scope and source evidence

Sources: `tsconfig.json:11` and accepted [ADR 0022](../../decisions/0022-lib-sub-domain-structure.md). Dedicated follow-up to the deferred flag; no broad src/lib moves or unrelated cosmetic cleanup.

## Design and ownership

One integration owner enables noUncheckedIndexedAccess in a temporary diagnostic candidate, inventories every diagnostic with file/line and boundary semantics, then assigns disjoint repairs. Config activation remains single-owner. Inventory effective options for root `tsconfig.json:11`, `scripts/tsconfig.json:2`, `supabase/functions/tsconfig.json:2` and independent `e2e/tsconfig.json:2`. Scripts/edge inherit root; E2E must explicitly enable the flag or inherit an appropriate shared options contract while preserving its environment. Assert effective noUncheckedIndexedAccess=true for every canonical target before counting zero diagnostics. Repair at actual runtime boundaries: empty arrays/results, absent record/cookie segments, out-of-range indexes and partial fixtures get guards/defaults/typed errors that preserve caller behavior. No non-null assertions, broad casts, ts-ignore, relaxed strictness or weakened lint/coverage to erase diagnostics. Path-specific temporary diagnostics are investigative only; final canonical typecheck covers the full app/scripts/E2E/edge scope.

File-disjoint diagnostic repairs may be [batch-eligible] after consumer sweeps identify shared types/functions; one owner handles each shared contract and its tests. No dependent repair may assume another unintegrated unit's output. Verify on the integrated tree after all earlier phases.

## Automated criteria

Record initial diagnostics and final zero diagnostics with canonical flag enabled. Full typecheck/lint/test/coverage/build and affected local DB/E2E gates pass. Empty/partial/out-of-range behavioral fixtures prove graceful error/default behavior and subsequent valid input succeeds. Search changed files for newly added escape hatches and explain any preexisting assertion retained; none may substitute for new safety checks.

## Manual criteria

Independent review confirms guards model intended trust boundaries and do not hide data corruption or change return contracts silently.

## Stuck states and recovery

Developer sees complete remaining diagnostics and ownership until zero; no suppressed success. Visitor/admin malformed/empty input produces the phase-owned visible empty/error/retry state. Shared consumer tests prove corrected data resumes normal behavior. If a discovered contract change invalidates a prior phase, record and revise that contract before proceeding.

## Phase acceptance and handoff

Run the parent's applicable sequential integration gates plus the automated criteria above on the integrated candidate. Record exact identity, commands, pass/fail/skip counts, review/simplify findings and fixes, and each issue's local/runtime disposition. Manual or provider evidence is separate; missing evidence leaves the issue open. Stop after acceptance, preserving the plan and implementation receipts; proceed only with authorized continuation. Consumer ownership and command inventory are in [consumer sweep](consumer-sweep.md).
