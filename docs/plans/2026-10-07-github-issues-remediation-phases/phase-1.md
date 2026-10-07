# Phase 1: Reliable verification

Parent: [backlog plan](../2026-10-07-github-issues-remediation.md). Owned issues: #1009, #884, #733, #866. Baseline: develop `fe1843713a49277bc66460e4ae7470025d01e1c6`; revalidate at entry. Status: implemented with passing local checks; normal-capacity SSE qualification remains an explicit owner-acceptance limitation. See [implementation receipts](../2026-10-07-github-issues-remediation-notes.md). Apply the parent's local-only authority, TDD/review/simplify loop, sequential verification, coverage ratchets and acceptance boundary in full.

## Scope and source evidence

Make required local verification execute honestly before relying on it for later repairs. Existing integration suites already exist; the defect is optional execution and incomplete coverage, not their total absence. Sources: `src/test/local-supabase.ts:76`, `vitest.config.ts:33`, `quality/required-probes.yaml:13`, `scripts/qa-agent.sh:651`, `scripts/qa-agent.sh:710`, `scripts/lib/playwright-report.ts:24`, `e2e/sse-abort.spec.ts:61`, `src/components/immersive/author-typewriter.tsx:1`. Research findings #884/#866 supply the coverage/outlier baseline; remeasure the current tree before changing tests.

## Work units

- Journey results (#733): reuse JSON reporting and `assertTestsExecuted`; represent disabled/startup_failed/invalid_report/tests_failed/passed explicitly and disclose flaky retries. Wire state into metrics, TOTAL_FAILURES, report prompt, issue classification, final exit and cleanup. Preserve bounded redacted build/server diagnostics after cleanup. Probe the actual configured journey server and candidate identity; the QA server on 3006 is not automatically Playwright's server on 3100.
- SSE readiness (#1009): use explicit privacy-consent and input-ready state, observe the first streaming request, reload and observe cancellation, release held routes in finally, prove no late first-response text appears and the next request completes. No global timeout increase or retry-based mask.
- Responsive coverage (#884): retain the already-covered useMediaQuery behavior; test typewriter start/stop, reduced motion, rapid changes and unmount through real hook behavior with controllable matchMedia events. Replace the global always-false/no-op fixture only where the dependency contract needs it; sweep fixture callers before changing defaults.
- Test-size investigation (#866): inventory the largest outliers, sampled boundary value and production-bug relevance. Consolidate only demonstrated redundant setup/assertions with equivalent mutation/boundary evidence. A test/source ratio alone is not a defect. Record an evidence-backed disposition if no actionable redundancy is found; no deletion quota.

The journey, SSE and responsive units can be [batch-eligible] only after naming disjoint test/helper file ownership. Shared test configuration has one owner; no two units edit consent/global setup concurrently.

## Behavioral oracle and automated criteria

```text
@ collectJourneyRun(command, report, identity) -> result
ctx: loopback server, subprocess, JSON reporter
pre: expected candidate and target are recorded
do:
  1. validate server readiness and identity
  2. run command and retain redacted diagnostics
  3. parse actual non-skipped execution and exit
  4. emit explicit status and next action
br: absent report or zero execution -> unverified failure
fail: startup timeout -> startup_failed with retained log path
```

Fixture matrix: build error, startup timeout, wrong artifact, missing/malformed report, all-skipped exit 0, zero tests with nonzero exit, real assertion failure, disclosed retry pass, disabled and genuine pass. Each failure has a corrected-run or visible-action test. No fixture sends GitHub messages or SMS. A full local production journey runs after repair with actual auth fixtures.

For #1009 run retries=0 on desktop/mobile: 10 repetitions each at normal capacity and 10 each with controlled CPU/network delay (40 total), then the normal full E2E gate once. Preserve traces for any failure; isolated success does not prove full-suite reliability. These repetitions are a diagnostic budget, not a permanent CI multiplication.

## Manual and external criteria

None for these local verification repairs. Provider and hosted contract qualification belongs to Phase 3.

## Stuck states and recovery

Journey startup/report failures show the log path and correct server/artifact action, not 0/0 success. SSE teardown always releases held requests; readiness failures name the missing state and retain a trace. Disabled checks remain visibly unverified. Tests cover these disclosures and subsequent successful execution.

## Phase acceptance and handoff

Run the parent's applicable sequential integration gates plus the automated criteria above on the integrated candidate. Record exact identity, commands, pass/fail/skip counts, review/simplify findings and fixes, and each issue's local/runtime disposition. Manual or provider evidence is separate; missing evidence leaves the issue open. Stop after acceptance, preserving the plan and implementation receipts; proceed only with authorized continuation. Consumer ownership and command inventory are in [consumer sweep](consumer-sweep.md).
