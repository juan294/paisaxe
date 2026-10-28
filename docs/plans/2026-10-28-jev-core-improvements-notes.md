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

### Phase 3 — verification in progress

Implementation owners were `/root/phase1` (application, evaluator and internal server) and `/root/booking_fixtures` (independent reference/judgment fixtures and E2E driver), with disjoint files. Independent reviewer `/root/phase3_review` approved plan compliance and three simplify lenses after repairs. No paid inference or activation occurred.

The seven ordinary gates all passed on source digest `1c1fb15956d518ee4eac0de067e4d6077c30f6fa52b69f6dc43a9c5830e15cfa`, based on `d8561789`: 582 test files passed, 23 skipped; 11,032 cases passed, 1,047 known database-environment skips. Coverage: statements 97.88%, branches 95.18%, functions 97.82%, lines 98.69%. Migrations passed. The required native contract receipt passed all 1,046 cases in 23 suites on task `paisaxe-contracts-1d1a4ddb05bc`, source digest `91b5534acb178c5f85975d93555ab352912ac241226f7346532793977da1f4f0` (the contract runner's distinct source-input algorithm). That receipt and full native reports are archived under ignored `docs/agents/jev-core-evidence/phase-3-native-contracts/`.

Confirmed review findings and dispositions:

| ID | Disposition |
| --- | --- |
| P3-01 | Resolved: malformed signed/decimal party suffixes and truncated `somos` prefixes reject in code; RED regressions precede repair. |
| P3-02 | Resolved: all 160 frozen cases carry explicit invariant rubrics; removing only those additions reproduces the original corpus hash. |
| P3-03 | Resolved: scenario cost uses accounting deltas, not cumulative totals. |
| P3-04 | Resolved: comparison checks outcome, clarification limits and price/payment/provider-fact invariants. |
| P3-05 | Resolved: explicit per-conversation locale preserves the existing English scenario, Spanish remains default. |
| P3-06 | Resolved: route-driver clarification count/time-to-quote derive from observed turns. |
| P3-07 | Resolved in reviewed source: empty/all-rejected options have changed-criteria ordinary-quote recovery, with exact catalog restoration. Actual route execution is pending below. |
| P3-08 | Resolved: legacy report awaits budget settlement and records `complete`, accounting and matching pass/exit disposition (`scripts/lib/booking-eval-harness.ts:733`). |
| P3-09 | Resolved: actual generator test aborts after its first buffered event and proves no further events or Claude request. |
| P3-S1 | Resolved: simplify removed the unused model-client binding and duplicate cap parsing; reuse/efficiency passes required no new abstraction. |
| P3-10 | Resolved: the first complete synthetic run exposed eight mismatches. Seven were incorrect canned semantic judgments; independent hash-bound judgment fixtures repair those responses only. A generic supported-number alternatives guard handles the code ambiguity. Reference labels/state/questions/thresholds were not fitted or weakened. The repaired CLI run passed all 160 cases. |
| P3-11 | Resolved: actual E2E typecheck uses stable Next/Node declarations and modern libraries, strictness retained; verified without generated `next-env.d.ts`. Local operator-link child explicitly sets `NODE_ENV=test`. |
| P3-12 | Resolved in reviewed driver: raw active catalog has four rows because migration 126 adds a phone merchant. The test now uses the exact service offerability predicate, retains raw/excluded rows, and pins all three eligible canonical offers (`src/lib/booking/availability.ts:94`, `src/lib/booking/availability.ts:102`). Unknown eligible rows still fail. |

Frozen reference corpus SHA-256 is `ea5e5df7e26656a3900fe863ffb8c9ca1435a64d4b423e7cf905c51e3d9b9a40`; independent semantic fixture SHA-256 is `2c0a090b376e182c4961e43074165f8aa35e21784dcb46cdfc22e712a6ebf661`. They are deterministic transport/rubric evidence, not live qualification. The eight observed first-run failures were h069, h074, h090, h101, h102, h103, h116 and h120.

#### Operational evidence limitation and recovery

The parent's first Playwright invocation used its default `test-results` output root, whose startup cleanup removed earlier `test-results/jev/` raw logs and fixture records. Those original raw files are **UNAVAILABLE**; historical command exits/metrics remain directly observed in the session tools and the already committed Phase 1/2 notes. The Phase 3 ordinary gate exits and surviving native V8 coverage JSON were explicitly archived as observed evidence, not fabricated replacement raw logs. The first eight-case fixture failure remains a documented observation; its original raw record did not survive cleanup. Future Playwright runs use an explicit isolated output path under ignored `docs/agents/jev-core-evidence/`.

The parent's temporary runner also forced `NODE_ENV=development` into the preview build. An isolated dummy-credential build reproduced the resulting `useContext` startup error; application gates had passed under their correct build environment. Removing that operational override allowed tests to start. The first actual test execution passed the complete browser booking round trip, while intake stopped before scenarios on the invalid raw catalog-count assumption (P3-12). The repaired driver alone is being rerun. No application or contract source changed, so the passed ordinary gates, same-stack native receipt and unchanged round-trip result remain valid; the changed E2E driver receives fresh strict typecheck and execution.

The task stack was recovered only after checking its immutable recorded containers, daemon, nonce-owned internal network, volume consumers, schema digest, live transport and anon/service positive controls. No shared stack was reset. Earlier lifecycle wrapper failure remains recorded; it does not overwrite the actual passed native contract receipt. Runtime and live quality remain disabled/unmeasured.

#### Phase 3 final acceptance

- [x] Independent review and all simplify repairs approved; final seven gates, migrations, native contracts and canonical local E2E passed.

P3-13 resolved the observed local evaluation-host 500: an eager fixture dependency initialized Next request storage before the Node baseline. A pure HTTP fixture builder removes that dependency; the actual host/driver entry initializes the official Next baseline first. Fresh-process import-order RED/GREEN tests and private error diagnostics cover the fix. No application route behavior or public mode/environment override was introduced. The diagnostic replay's child exit 0/90 arms was explicitly separated from acceptance; its wrapper exit 1 was intentional and was never called a gate pass.

Fresh final source digest: `d4ee4c555c1a846865c41199b3d0249f07b04c889cce1a8535937fba329c919d` (base `d8561789`). All seven commands exited 0; logs and the complete gate receipt survive under `test-results/jev/phase-3-refresh/`. Coverage: 583 passed files, 23 known skipped files; 11,034 passed cases, 1,047 known skipped cases; statements 97.89%, branches 95.19%, functions 97.85%, lines 98.69%. Thresholds were unchanged. Migrations passed again. The final CLI fixture run passed all 160 cases and is archived in `docs/agents/jev-core-evidence/phase3-final-cli/`.

After the script/bootstrap change, the complete native tier was refreshed: 1,046/1,046 cases in 23 suites, zero skips/failures, clean final schema and source guard. Its current-source digest is `5c34e3253b517094e27e668d7f9df3bad6af427222944050000c573445591a47`; exact receipt/native reports are under `docs/agents/jev-core-evidence/e2e-2026-10-28T19-50-27-100Z/native-contracts/`. The canonical `release-required-local` intake test then passed with retries disabled and one worker: all 90/90 complete scenario arms plus failure, cancellation, empty/all-rejected and ordinary-follow-up recovery. The saved driver report is `test-results/jev/phase-3/e2e-jev-intake-2370a28c/report.json`; all eight cleanup table counts are zero. The unchanged browser booking round trip had independently passed on the same application inputs; its existing dummy-key Voyage retrieval fallback is workflow-regression evidence, not provider/readiness/performance proof.

The guarded lifecycle disposed of task stack `paisaxe-contracts-1d1a4ddb05bc`, including its owned network/volumes; disposal receipt is archived with the canonical E2E result. No shared stack or unrelated failed task was removed. Phase 3 is accepted locally. Phase 4 entry is authorized by the owner's all-phases instruction; runtime activation and paid/live qualification remain separate and unmeasured.
