# Jev core improvements implementation notes

## Scope and identity

The owner authorized all six implementation phases without intermediate stops, followed by local integration into `develop`, one push of the completed integration branch, and removal of this task's worktree and branch. This supersedes the plan's historical planning-only authorization statement. It does not authorize paid inference, runtime activation, production publication, provider settings or credentials.

Base: `26c624adce298a98d15ef123b902a4a13d2134bb` (`develop`). Implementation branch: `feature/jev-core-improvements`. Worktree: `/Users/juan/code/paisaxe-jev-core-improvements`. The two initial research reports and nine approved plan files were copied byte-for-byte from the original checkout; their originals remain preserved until integration.

## Deviations

Runtime qualification remains a separate, unmeasured acceptance layer; deterministic code acceptance cannot enable either task.

D1 — Database test placement. Plan said: add unit/PostgREST checks plus required local Playwright scenarios in phases 3 and 6. Found: the existing skip census pins both every gated group's case count and its source bytes (`scripts/ci-cadence-gated-skips.test.mjs:93`), and its producer is protected (`scripts/ci-cadence-gated-skips.test.mjs:108`). New skip groups or edits to those suites require Sutura coordination. Chose: keep those pinned suites and controls unchanged; exercise new intake/matching database and concurrent-quota oracles in the required local Playwright suite against the same disposable owned PostgREST stack, alongside new ordinary unit/HTTP-boundary tests and the unchanged complete contract tier. Why: this preserves all database behavior requirements without an unrelated protected-control/routing change. Read-only Sutura orientation confirmed its coordination contract; no Sutura files or hosted settings were changed. This is a test-runner placement adjustment, not a reduced oracle or a new product decision.

## Phase evidence

Phase acceptance records will identify source inputs, TDD evidence, independent review, simplify findings, sequential local gates and recovery coverage. Raw logs stay under ignored `test-results/jev/` and are preserved outside the removed worktree before cleanup.

### Phase 1 — adapter

Implementation owner: `/root/phase1`; independent plan-compliance reviewer: `/root`. Assigned only the Phase 1 adapter/configuration/tests, exact SDK dependency and configuration/operations documentation; no commit, publication or live inference permitted. Focused implementation terminated after HTTP-fixture tests passed. Parent review approved the repaired source before final gates.

TDD: `test-results/jev/phase-1/red.log` records the missing adapter import before implementation. Earlier focused failures remain in `green.log` and `green-4.log`; they exposed a noncooperating custom-fetch deadline gap and a polluted Next boundary fixture. `green-5.log` passes all 28 tests, including the real Next client/server compiler boundary. `typecheck-2.log` and `lint-focused.log` pass focused checks.

Findings: P1-01 impossible `never` answer cast resolved with the SDK's generic answer type; P1-02 SDK timeout alone did not bound a custom fetch, resolved with a total abort race; P1-03 the boundary fixture failed before reaching the intended oracle, resolved with actual JSX fixture sources and the compiler's `server-only` import trace. No unresolved review findings remain. Noul and Choice cover all approved consumers; unused Score support was removed.

Codex simplify ran three separate reuse, quality and efficiency passes over the Phase 1 changed scope. The answer-cast correction and removal of unused Score support address quality/reuse; no additional abstraction, cache or parallel work was warranted. No post-review source changes were made. Provider fixtures remain deterministic transport evidence, not model qualification. SDK 0.7.0's MIT license and Node >=22 declaration were verified; the app runs Node 24.22.1.

All seven final gates passed (exit 0) for source digest `414db1ac9747c3b25e1e41705ab877c7a5c624d73b3162575aa24db53b4e3bc4`, based on `26c624adce298a98d15ef123b902a4a13d2134bb`. The digest covers tracked and task-owned untracked non-document source/configuration bytes, excluding generated/ignored files. Gate logs and exit records are in `test-results/jev/phase-1/gates.json`. Runtime tasks remain default-off; quality, latency and savings are unmeasured.

Phase 1 accepted locally. Full coverage: 575 passed test files, 23 skipped; 10,931 passed cases, 1,047 skipped while the local database endpoint was deliberately unavailable. Coverage: statements 97.88%, branches 95.16%, functions 97.79%, lines 98.69%; unchanged thresholds. Build, full typechecks, lint, environment, secret inventory and production license checks all passed. Database contracts were not claimed by this phase. Next: Phase 2 inspector/runner, authorized by the owner's all-phases continuation.

### Phase 2 — inspector and runner

- [x] TDD, independent review/repair, simplify and all seven sequential local gates passed. Source digest: `0059026e0c9b19b9ccf2d9c2e48ea5e97cbb8f8c772e7d5f438b3c30a28ea2f6`, based on `53a44972642effa4ae1e1c28dc35e53c25a73619`. Implementation owner `/root/phase1`; independent reviewer `/root`. Assigned scope was only the CLI, runner, renderer, tests/fixture, package script and operations documentation, plus the approved narrow reuse of adapter response validation.

TDD logs: `test-results/jev/phase-2/red.log`, retained initial failures in `green.log`, final `green-4.log` passes 61 adapter/runner/CLI/report checks. `typecheck-3.log` and `lint-focused.log` pass focused checks. `gates.json` records every final command/exit, all zero. Full coverage: statements 97.88%, branches 95.16%, functions 97.79%, lines 98.69%; thresholds unchanged. The full suite's database skips remain disclosed separately from required contract execution. Real npm list/fixture commands passed with no spend; actual subprocess fixture/inspect and executable fixture-resume checks also passed.

Review findings P2-01–P2-05 resolved: POSIX shell quoting for recovery commands; separate request and aggregate usage limits; raw response validation reused before settlement plus recomputed ledger/budget/completeness consistency; real SIGKILL recovery preserving the durable reservation; and mode-correct executable recovery commands. A narrow shared `validateJevResponse` export avoids duplicate protocol validation. That refactor invalidated Phase 1's old source identity; Phase 2 adapter regressions and the complete gate cover the new combined source. No unresolved findings remain.

Simplify: reuse pass approved shared validation; quality pass checked strict record schemas, immutable run/provenance and safe recovery; efficiency pass found no justified additional abstraction or cache. Browser inspection of imported/synthetic-unavailable reports confirmed readable failure/denominator/retry information and zero outbound requests; screenshots are retained under the phase directory. Later command-copy repairs are covered by executable tests. Fixture/imported/replayed evidence is explicitly distinguished from live model evidence. All runtime tasks remain off; no live inference or qualification occurred.

Phase 2 accepted locally. Next: Phase 3 bounded booking intake, with independently authored frozen reference cases and D1 database-test placement.
