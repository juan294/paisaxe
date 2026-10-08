# GitHub issue reconciliation against production, 2026-10-07

## Question and authorized scope

Which open Paisaxe GitHub issues are already completed or invalid when compared with production today? The owner authorized research and closure of confirmed completed or invalid issues. This report covers all 65 issues open at the initial inventory and their complete bodies and comments. It does not implement product changes or authorize deployment, database changes, provider changes, CI reruns, publication or a push.

## Baseline and direct answer

- Repository: `juan294/paisaxe` (private), `/Users/juan/code/paisaxe`.
- Research branch: `develop`, commit `fe1843713a49277bc66460e4ae7470025d01e1c6`. Research source comparisons use the production commit below, not the later integration tree.
- Live production: v1.8.0, commit `623d3229314b7bd99169232a90aa75ba47fcfdbf`, tree `8e0e555342260de5022c4882e26f69a9fa24ba23`.
- Vercel production deployment: `dpl_93uumKPWTNc4VGFBGB2843stJ46G`, READY; the `paisaxe.es` alias resolves to `paisaxe-mpj1n62g9-thecreativetoken.vercel.app`.
- GitHub production deployment: [6905184366](https://api.github.com/repos/juan294/paisaxe/deployments/6905184366), successful status observed on 2026-10-07.
- Authenticated live `/api/health` at 13:38:12 UTC returned this exact commit, healthy readiness, cron authentication OK, Sentry configured and Upstash OK. Build tree was `unknown`; the tree was derived from the verified commit using Git. `/api/health/db` separately returned HTTP 200 and tablesAccessible=true.
- Supabase: production `asturias`, project `axoishtlumlswzhegseq`; schema introspection ran inside `BEGIN READ ONLY` at 13:41:31 UTC. Migrations through 126 are installed. Environment-specific flag read confirms `experience_booking=false` and `visitor_voice_agent=true` in production.
- Report refreshed: `2026-10-07T13:52:54+00:00`.

Nine issues are completed fixes or recovered historical incidents, one is a corrected QA validator false positive, and one duplicates the still-open mobile performance issue. Fifty issues have confirmed remaining work. Four require additional operational evidence before closure. The findings do not support the premise that most of this backlog is already done.

Executed closures: **11 of 11**. GitHub read-back receipts below identify each result.

## Evidence and decision rules

Graphify Local supplied structural navigation, followed by pinned source reads with `git show 623d3229:path`. Every issue received an independent bounded read-only research assignment; the parent reviewed the closure candidates and cross-checked the live baseline. No issue was treated as complete because of its age, a title, a merged PR alone, a relaxed threshold or the presence of code without the required operational evidence. A duplicate is closed only with its canonical issue retained. A recovered incident closure describes recovery, not a permanent root-cause fix.

Existing hosted results for the production commit: [CI](https://github.com/juan294/paisaxe/actions/runs/37593203490), [E2E](https://github.com/juan294/paisaxe/actions/runs/37593203389), [Coverage](https://github.com/juan294/paisaxe/actions/runs/37593203228), [Security Scan](https://github.com/juan294/paisaxe/actions/runs/37593203887), and [Lighthouse](https://github.com/juan294/paisaxe/actions/runs/37593203339) succeeded. CI reports 482 passing files, 15 skipped files, 9,200 passing tests and 204 skipped tests. E2E reports 367 passed, with both desktop and mobile story-slug tests and all four journeys cited in #974 passing. Skipped database integration tests are explicitly material to #885. These are existing hosted results; this research did not run new tests or trigger workflows. A Dependabot Updates run on the same SHA failed; that separate result was not presented as a passing product validation gate.

Production database observations confirm `service_role` has DML privileges on `feature_flags`; `notify_webhook()` still uses `body := _payload::text`; the active/approved stories composite index is absent; no terminal-booking retention job appears in the cron inventory; and `feature_flags_public` still exposes `ELSE config`. These schema observations concern production, while #913 also requires fresh local-stack parity.

Historical local QA logs are labeled below. The post-release voice receipt in `docs/release/evidence/8e0e555342260de5022c4882e26f69a9fa24ba23.yaml` is on the integration branch after release, not in the production tree. It records a successful production voice preflight but does not establish canary alert delivery. The local `docs/agents/qa-report.md` is a historical October 1 report, not a deployed artifact. No new live model generation, payment, user-data mutation, backup restore, rejected-credential drill or Sentry alert delivery test was performed.

## Complete issue inventory and disposition

Source links below are pinned to the verified production commit unless explicitly labeled historical/post-release. “Keep open” means the issue still has unmet scope; partial fixes are recorded rather than discarded.

### [#1009](https://github.com/juan294/paisaxe/issues/1009) QA: e2e sse-abort (mobile) flaky under host load

**Keep open. Retained.** New load-dependent flake remains actionable: exact deployed CI passes do not disprove the separately observed high-load failure, and no later fix is present.

- [e2e/sse-abort.spec.ts:15](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/e2e/sse-abort.spec.ts#L15): The reported test remains in deployed source, including 1-second optional privacy-button visibility waits at lines 61-64.
- local evidence `.git/issue-audit-2026-10-07/e2e.log:2740`: Exact deployed-commit CI mobile test passes in 2.6s; this normal-load pass does not disprove the reported load-sensitive failure.

### [#987](https://github.com/juan294/paisaxe/issues/987) Content: replace the remaining story images extracted from the guides

**Keep open. Retained.** Replacement acceptance is not met. Seven deployed image mappings still explicitly name PDF sources and local guide-derived images; production-wide provenance is not established.

- [content/story-image-mappings.json:7](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/content/story-image-mappings.json#L7): lagos-covadonga mapping is still source=pdf; additional PDF mappings at lines 28,35,42,63,84,98.
- [scripts/seed-database.ts:90](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/scripts/seed-database.ts#L90): Seed stories continue carrying guide PDF provenance. No replacement completion evidence found.

### [#986](https://github.com/juan294/paisaxe/issues/986) Content: re-author the knowledge base so no guide text is reproduced

**Keep open. Retained.** The deployed pipeline still extracts guide wording and seeds processed chunks. No re-authored corpus, overlap acceptance check, or authorized production reseed receipt was found.

- [scripts/process-pdfs.ts:61](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/scripts/process-pdfs.ts#L61): PDF sections are converted directly into content chunks.
- [scripts/seed-database.ts:71](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/scripts/seed-database.ts#L71): Seed input remains content/processed/chunks.json; source_pdf inserted at line 549.
- [src/lib/claude.ts:594](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/lib/claude.ts#L594): Chat still injects chunk.content verbatim under Fuente N context. Production corpus contents were not independently downloaded by this subtask.

### [#978](https://github.com/juan294/paisaxe/issues/978) [QA] Test Suite Failure Summary (91% pass rate)

**Invalid: corrected false positive. Closed and read back.** Reported LLM failure was a validator false positive: the logged refusal correctly declined personal advice. The deployed Oct2 validator fix and regression fixture correct the issue, and the fixture suite passes on the deployed commit.

- historical local `logs/qa-agent-2026-10-01.log:57`: Analysis identifies Personal advice as refusal wording misclassified as advice.
- [src/tests/qa/llm-quality-validators.ts:19](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/tests/qa/llm-quality-validators.ts#L19): Directive relationship advice is rejected while refusals and Asturias redirects pass.
- [src/tests/qa-boundary-validators.test.ts:8](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/tests/qa-boundary-validators.test.ts#L8): Regression test reproduces the Oct1 refusal that mentions relationship; negative directive-advice cases also covered.
- local evidence `.git/issue-audit-2026-10-07/ci-merge.log:1430`: Exact deployed commit: qa-boundary-validators.test.ts all 12 tests pass.

GitHub receipt: state `CLOSED`, reason `NOT_PLANNED`, closed at `2026-10-07T13:51:01Z`.

### [#974](https://github.com/juan294/paisaxe/issues/974) [QA] Journey Test Failure: Browser Journey Tests

**Completed. Closed and read back.** The historical local worker-contention incident is superseded: deployed config caps local journey workers, and all specifically reported journeys pass on the deployed commit.

- [playwright.config.ts:175](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/playwright.config.ts#L175): qa-journey project caps local workers at 3 and documents the September 24 resource-contention failure.
- historical local `logs/qa-agent-2026-09-24.log:51`: Contemporaneous analysis says four distinct failed journeys passed on serial rerun.
- local evidence `.git/issue-audit-2026-10-07/e2e.log:2767`: Exact commit journeys 1 and 2 pass; lines 2771-2772 show journeys 5 and 6 pass (2.4-3.6 seconds).

GitHub receipt: state `CLOSED`, reason `COMPLETED`, closed at `2026-10-07T13:51:13Z`.

### [#951](https://github.com/juan294/paisaxe/issues/951) chore: investigate test breakage from Aug 2026 minor/patch dependency batch

**Completed. Closed and read back.** The reverted August batch and its three failing test files are superseded by newer deployed dependency updates. Sentry is now 10.75.3 and every formerly failing test file passes in exact-commit CI.

- [package-lock.json:4875](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/package-lock.json#L4875): Deployed @sentry/core is 10.75.3; @sentry/nextjs at line 4899 is 10.75.3, beyond the problematic 10.72.0 batch.
- local evidence `.git/issue-audit-2026-10-07/ci-merge.log:1302`: global-error.bundle.test.tsx: 1 passed.
- local evidence `.git/issue-audit-2026-10-07/ci-merge.log:1377`: instrumentation.test.ts: 13 passed.
- local evidence `.git/issue-audit-2026-10-07/ci-merge.log:2593`: github-analytics-panel.test.tsx: 24 passed.

GitHub receipt: state `CLOSED`, reason `COMPLETED`, closed at `2026-10-07T13:51:20Z`.

### [#950](https://github.com/juan294/paisaxe/issues/950) [QA] Test Suite Failure Summary (0% pass rate)

**Completed. Closed and read back.** The all-tests-403 incident was a local production-server origin misconfiguration, corrected by the deployed harness. A subsequent real QA run reached and passed 12/12 tests, and deployed-commit CORS regression tests pass.

- [scripts/qa-agent.sh:217](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/scripts/qa-agent.sh#L217): Exports PLAYWRIGHT_TEST_ORIGIN before starting next start; lines 541-557 probe origin and classify configuration failures.
- [src/lib/proxy/cors.ts:25](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/lib/proxy/cors.ts#L25): Honors test origin for a local production build only when VERCEL_ENV is unset.
- [src/lib/proxy/cors.test.ts:46](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/lib/proxy/cors.test.ts#L46): Regression covers production NODE_ENV with no Vercel environment.
- historical local `logs/qa-agent-2026-09-03.log:24`: Subsequent QA run recorded 12 passed, 0 failed.
- local evidence `.git/issue-audit-2026-10-07/ci-merge.log:2851`: Deployed-commit CORS suite: 17 tests pass.

GitHub receipt: state `CLOSED`, reason `COMPLETED`, closed at `2026-10-07T13:51:34Z`.

### [#949](https://github.com/juan294/paisaxe/issues/949) [agents] qa-agent.sh Phase 1 aborts silently on non-matching test-count grep

**Completed. Closed and read back.** Both requested fixes are present in deployed source: nonmatching grep pipelines cannot silently abort, and ERR trap reports failing line and exit status.

- [scripts/qa-agent.sh:33](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/scripts/qa-agent.sh#L33): ERR trap logs FATAL command-failed line and status before exit.
- [scripts/qa-agent.sh:579](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/scripts/qa-agent.sh#L579): Both test-count grep pipelines end with || true; lines 581-582 default missing counts to zero.

GitHub receipt: state `CLOSED`, reason `COMPLETED`, closed at `2026-10-07T13:51:45Z`.

### [#947](https://github.com/juan294/paisaxe/issues/947) Add ElevenLabs voice-agent reliability controls

**Keep open: evidence incomplete. Retained.** Software controls are deployed and release voice preflight proves credential binding, but scheduled canary check-in and rejection-alert delivery have no confirmed operational receipt. Keep open for the remaining operational acceptance.

- [src/lib/elevenlabs-credentials.ts:29](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/lib/elevenlabs-credentials.ts#L29): Safe SHA-256 fingerprint binding enforced before provider I/O.
- [src/lib/elevenlabs-signed-session.ts:89](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/lib/elevenlabs-signed-session.ts#L89): Failure logging emits classified safe metadata.
- [src/app/api/health/voice/route.ts:27](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/app/api/health/voice/route.ts#L27): Authorized deep health requires HEALTH_PROBE_SECRET.
- [vercel.json:7](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/vercel.json#L7): Read-only signed-URL canary scheduled every 15 minutes.
- [docs/runbooks/elevenlabs-credential-rotation.md:32](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/docs/runbooks/elevenlabs-credential-rotation.md#L32): Custom LLM marked not applicable, safe rotation documented.
- [docs/operations/pending-setup.md:24](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/docs/operations/pending-setup.md#L24): Canary check-in and credential-rejection alert delivery still documented as pending; this was not independently proven.
- [docs/release/evidence/8e0e555342260de5022c4882e26f69a9fa24ba23.yaml:52](https://github.com/juan294/paisaxe/blob/fe1843713a49277bc66460e4ae7470025d01e1c6/docs/release/evidence/8e0e555342260de5022c4882e26f69a9fa24ba23.yaml#L52) (post-release integration receipt): Post-release receipt on integration branch reports deployed voice preflight passing Oct7, provider ok, fingerprint binding true and five agents. This receipt is not deployed source.

### [#943](https://github.com/juan294/paisaxe/issues/943) [docs] testbed.md violates the no-emoji documentation policy (37 instances)

**Keep open. Retained.** Documentation still contains emoji and has no per-file opt-out; deployed edit hook still enforces the cited policy.

- [docs/engineering/testbed.md:5](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/docs/engineering/testbed.md#L5): Instructions and section headings retain emoji; no contract:allow-emoji marker.
- [.claude/hooks/verify-edit.sh:62](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/.claude/hooks/verify-edit.sh#L62): Emoji documentation check remains enabled absent explicit per-file opt-out.

### [#942](https://github.com/juan294/paisaxe/issues/942) [remediate] BE-L6-follow-up: weather/route.ts has the same public-cache-on-authenticated-response bug as #799

**Keep open. Retained.** Both weather handlers still use public cache directives after MCP authentication.

- [src/app/api/mcp/weather/route.ts:286](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/app/api/mcp/weather/route.ts#L286): GET Cache-Control remains public, max-age=300.
- [src/app/api/mcp/weather/route.ts:346](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/app/api/mcp/weather/route.ts#L346): POST Cache-Control remains public, max-age=300.
- [src/app/api/mcp/places/route.ts:444](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/app/api/mcp/places/route.ts#L444): Sibling places route already uses private cache as issue describes.

### [#941](https://github.com/juan294/paisaxe/issues/941) PE-L4 follow-up: Sentry client SDK still ships eagerly via error boundaries

**Keep open. Retained.** All five error-boundary components still statically import the Sentry SDK, so the requested lazy-import change is not implemented.

- [src/app/error.tsx:5](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/app/error.tsx#L5): Static @sentry/nextjs import; captureException at line 18.
- [src/app/global-error.tsx:4](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/app/global-error.tsx#L4): Static SDK import remains in root replacement boundary.
- [src/app/admin/error.tsx:4](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/app/admin/error.tsx#L4): Static SDK import remains.
- [src/app/favorites/error.tsx:5](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/app/favorites/error.tsx#L5): Static SDK import remains.
- [src/app/immersive/error.tsx:5](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/app/immersive/error.tsx#L5): Static SDK import remains. Exact gzipped bundle size was not remeasured.

### [#940](https://github.com/juan294/paisaxe/issues/940) Admin: decompose remaining 9 single-file analytics/config panels into the colocated-module convention

**Keep open. Retained.** The listed admin components remain single-file .tsx implementations, not decomposed colocated modules. Issue title says nine but body lists ten; that counting error does not invalidate the work.

- [src/components/admin/create-story-dialog.tsx:73](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/components/admin/create-story-dialog.tsx#L73): Single-file exported component remains.
- [src/components/admin/github-analytics-panel.tsx:22](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/components/admin/github-analytics-panel.tsx#L22): Single-file exported panel remains.
- [src/components/admin/elevenlabs-analytics-panel.tsx:15](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/components/admin/elevenlabs-analytics-panel.tsx#L15): Single-file panel remains.
- [src/components/admin/stories-tab-panel.tsx:73](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/components/admin/stories-tab-panel.tsx#L73): Single-file panel remains.
- [src/components/admin/image-editor-dialog.tsx:44](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/components/admin/image-editor-dialog.tsx#L44): Single-file dialog remains.
- [src/components/admin/admin-shell.tsx:98](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/components/admin/admin-shell.tsx#L98): Single-file shell remains.
- [src/components/admin/story-card.tsx:50](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/components/admin/story-card.tsx#L50): Single-file component remains.
- [src/components/admin/suggestions-panel.tsx:62](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/components/admin/suggestions-panel.tsx#L62): Single-file panel remains.
- [src/components/admin/feature-toggles-panel.tsx:97](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/components/admin/feature-toggles-panel.tsx#L97): Single-file panel remains.
- [src/components/admin/story-translations-tab.tsx:55](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/components/admin/story-translations-tab.tsx#L55): Single-file component remains.

### [#939](https://github.com/juan294/paisaxe/issues/939) UX: hover-reveal without focus-within pairing in story-card and related-stories

**Keep open. Retained.** Admin story-card still hides interactive controls with hover-only opacity utilities and lacks focus-within counterparts. Related-stories public component only changes an already-visible image brightness, so that part is overstated, but admin acceptance remains unmet.

- [src/components/admin/story-card.tsx:123](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/components/admin/story-card.tsx#L123): Selection control is opacity-0 unless group-hover; equivalent unfixed patterns at lines 132,178,203.
- [src/components/immersive/related-stories.tsx:78](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/components/immersive/related-stories.tsx#L78): Image has opacity-60 at rest, opacity-80 on hover; button has visible focus ring at line 68.

### [#938](https://github.com/juan294/paisaxe/issues/938) [UX] Consolidate the three parallel color systems (design tokens, ad hoc Tailwind, admin hex literals)

**Keep open. Retained.** Semantic CSS tokens, direct visitor utility colors, and admin raw hex colors still coexist. No consolidation decision or implementation was found.

- [src/app/globals.css:5](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/app/globals.css#L5): Root and dark semantic color token systems remain.
- [tailwind.config.ts:46](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/tailwind.config.ts#L46): Separate paisaxe brand tokens remain.
- [src/components/immersive/related-stories.tsx:66](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/components/immersive/related-stories.tsx#L66): Visitor component uses raw black/white utilities.
- [src/components/admin/story-card.tsx:104](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/components/admin/story-card.tsx#L104): Admin component uses raw hex colors.

### [#937](https://github.com/juan294/paisaxe/issues/937) [remediate] BE-S2 follow-up: shared rate-limit route helper + remaining unprotected public routes

**Keep open. Retained.** The strategic follow-up remains incomplete. Weather, places and suggestions still use raw IP buckets without IPv6 normalization, sufficient to keep the multi-part issue open.

- [src/app/api/mcp/weather/route.ts:256](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/app/api/mcp/weather/route.ts#L256): getClientIp feeds caller bucket; POST repeats at line 315.
- [src/app/api/mcp/places/route.ts:404](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/app/api/mcp/places/route.ts#L404): Raw IP feeds caller bucket; POST repeats at line 473.
- [src/app/api/suggestions/route.ts:93](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/app/api/suggestions/route.ts#L93): Suggestion identifier interpolates raw ip. No completed shared-default/exemption/voice-minutes acceptance found.

### [#936](https://github.com/juan294/paisaxe/issues/936) [remediate] Chat route pays for embedding round-trip before checking the search-result cache (#810 follow-up)

**Keep open. Retained.** Chat still generates embedding before calling search, and the result-cache lookup still happens inside search. The reported extra embedding-cache round trip remains.

- [src/app/api/chat/stream/route.ts:198](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/app/api/chat/stream/route.ts#L198): generateEmbedding runs before search at lines 203-205.
- [src/lib/search.ts:95](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/lib/search.ts#L95): Full result cache queried only inside search, after embedding exists.

### [#935](https://github.com/juan294/paisaxe/issues/935) Backend: getSupabaseClient() called without request in 4 more routes (same bug as #793)

**Keep open. Retained.** Day-pass route was removed, but embedded checkout and both suggestions callsites still omit request; helper signature remains optional. Full issue acceptance not met.

- [src/app/api/checkout/embedded/route.ts:65](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/app/api/checkout/embedded/route.ts#L65): getSupabaseClient() remains without request.
- [src/app/api/suggestions/route.ts:28](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/app/api/suggestions/route.ts#L28): GET call omits request; POST at line 51 also omits request.
- [src/lib/supabase-auth.ts:10](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/lib/supabase-auth.ts#L10): Request parameter remains optional and bearer headers only forwarded when provided.

### [#933](https://github.com/juan294/paisaxe/issues/933) Backend: search/rerank stage timeout does not cancel the in-flight Voyage rerank call

**Keep open. Retained.** Search-stage timing still does not pass an abort controller; search uses Promise.race fallback and rerank sends no abort signal.

- [src/app/api/chat/stream/route.ts:203](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/app/api/chat/stream/route.ts#L203): Search stage receives no AbortController.
- [src/lib/search.ts:159](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/lib/search.ts#L159): Promise.race resolves timeout without cancelling rerank promise.
- [src/lib/rerank.ts:19](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/lib/rerank.ts#L19): rerankChunks has no signal parameter; Voyage rerank at line 29 receives no request options.

### [#932](https://github.com/juan294/paisaxe/issues/932) Voice: real authenticated E2E coverage for the Pelayo 'access granted' flow

**Keep open. Retained.** No real-auth voice-session issuance browser spec exists. Stripe integration now verifies a paid voice dialog becomes ready, but never toggles voice mode or asserts POST /api/voice-session and signed URL, so full acceptance remains unmet.

- [e2e/voice-agents.spec.ts:31](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/e2e/voice-agents.spec.ts#L31): Explicitly documents access-granted and signed-URL issuance as untested.
- [playwright.config.ts:196](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/playwright.config.ts#L196): auth-integration project selects only favorites-real.spec.ts.
- [e2e/stripe-real-checkout.spec.ts:333](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/e2e/stripe-real-checkout.spec.ts#L333): Existing paid journey asserts talk button and absent upsell, then ends without signed-session issuance assertion.

### [#931](https://github.com/juan294/paisaxe/issues/931) [Infra]: check-secret-inventory.ts duplicates check-env.ts's .env.example parsing logic

**Keep open. Retained.** Environment-example parsers remain duplicated and check-env still executes at top level.

- [scripts/check-env.ts:27](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/scripts/check-env.ts#L27): Local getEnvExampleKeys parses env example.
- [scripts/check-env.ts:89](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/scripts/check-env.ts#L89): Top-level invocation remains unguarded.
- [scripts/check-secret-inventory.ts:24](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/scripts/check-secret-inventory.ts#L24): Independent active/commented env parser remains; docstring says mirrors check-env.

### [#930](https://github.com/juan294/paisaxe/issues/930) [Backend]: Extract shared isTimeoutError helper (3-way duplicate across admin routes + elevenlabs-call-service)

**Keep open. Retained.** All three sites still contain their own AbortError/TimeoutError name classification; no shared helper is imported.

- [src/lib/services/elevenlabs-call-service.ts:187](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/lib/services/elevenlabs-call-service.ts#L187): Local errorName and isTimeout predicate remain.
- [src/app/api/admin/costs-analytics/route.ts:383](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/app/api/admin/costs-analytics/route.ts#L383): Same local classification remains.
- [src/app/api/admin/elevenlabs-analytics/route.ts:290](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/app/api/admin/elevenlabs-analytics/route.ts#L290): Same local classification remains.

### [#929](https://github.com/juan294/paisaxe/issues/929) [Frontend]: Extract shared toast/timed-message hook (3rd inline copy in favorites undo)

**Keep open. Retained.** The requested shared timed-message primitive is absent. Sharing moved to useShareStory, but bookmark, share and favorites still own independent timer/state logic.

- [src/hooks/use-share-story.ts:28](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/hooks/use-share-story.ts#L28): Independent toast state/timer and showToast at lines 34-38.
- [src/components/immersive/bookmark-button.tsx:31](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/components/immersive/bookmark-button.tsx#L31): Independent timerRef and toast reset remain.
- [src/app/favorites/page.tsx:33](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/app/favorites/page.tsx#L33): Undo state/timer plus cleanup remain inline through line 63.

### [#928](https://github.com/juan294/paisaxe/issues/928) [Frontend]: Extract shared useRovingTabIndex hook (pricing tier selector duplicates story-progress-bar)

**Keep open. Retained.** Both consumers still implement roving tabindex independently; no shared useRovingTabIndex extraction has shipped.

- [src/app/pricing/page.tsx:65](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/app/pricing/page.tsx#L65): handleTierKeyDown is still inline.
- [src/components/immersive/story-progress-bar.tsx:45](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/components/immersive/story-progress-bar.tsx#L45): Independent ArrowLeft/Right/Home/End handler with paged index window remains.

### [#927](https://github.com/juan294/paisaxe/issues/927) Architecture: lint rule to enforce withAdmin/withAdminRead across admin routes

**Keep open. Retained.** Admin routes still import validateAdminAuth directly and ESLint does not enforce the requested withAdmin/withAdminRead wrapper rule.

- [src/app/api/admin/feature-flags/[key]/route.ts:2](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/app/api/admin/feature-flags/%5Bkey%5D/route.ts#L2): Direct validateAdminAuth import; manual early return at lines 14-17.
- [src/app/api/admin/agents-summary/route.ts:187](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/app/api/admin/agents-summary/route.ts#L187): Manual validateAdminAuth call remains.
- [eslint.config.mjs:8](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/eslint.config.mjs#L8): Complete configuration has generic rules and console restriction, no admin-wrapper import prohibition.

### [#926](https://github.com/juan294/paisaxe/issues/926) Perf: /immersive mobile LCP is 4.1-4.6s, above the 4s target

**Keep open. Retained.** The explicit completion contract remains unmet: production source still uses mobile performance 0.6, LCP 5500ms and TBT warn/500ms. A successful calibrated Lighthouse gate cannot establish restoration to 0.7/4000ms or TBT below 500ms.

- [lighthouserc.mobile.json:21](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/lighthouserc.mobile.json#L21): Mobile minimum performance remains 0.6.
- [lighthouserc.mobile.json:41](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/lighthouserc.mobile.json#L41): Mobile LCP threshold remains 5500ms.
- [lighthouserc.mobile.json:47](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/lighthouserc.mobile.json#L47): TBT remains warn at 500ms.

### [#925](https://github.com/juan294/paisaxe/issues/925) [Infra]: update-visual-baselines.yml can't push — repo-level Workflow permissions locked to read-only

**Completed. Closed and read back.** The reported baseline-workflow push failure was subsequently resolved: hosted run 32337173896 successfully committed and pushed baseline commit 0395dcd to develop. Production commit Visual Regression also passes in run 37593203389. The current repository default is read-only, so that setting itself is not evidence the issue persists.

- [.github/workflows/update-visual-baselines.yml:16](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/.github/workflows/update-visual-baselines.yml#L16): Workflow grants contents: write; final commit step pushes regenerated baselines.
- [external evidence](https://github.com/juan294/paisaxe/actions/runs/32337173896): Read full successful log: 2026-08-20T06:01:25Z commit 0395dcd, 06:01:27Z 86890fc..0395dcd develop -> develop.
- [external evidence](https://github.com/juan294/paisaxe/actions/runs/37593203389/job/112699410012): Visual Regression succeeded for exact deployed head 623d3229314b7bd99169232a90aa75ba47fcfdbf.

GitHub receipt: state `CLOSED`, reason `COMPLETED`, closed at `2026-10-07T13:51:57Z`.

### [#924](https://github.com/juan294/paisaxe/issues/924) [Immersive]: Mobile LCP exceeds 4s budget on /immersive (4551ms measured)

**Duplicate. Closed and read back.** Same immersive mobile LCP defect as #926. Keep #926 because it preserves the subsequent stopgap history and full performance/LCP/TBT completion contract. Closing this duplicate does not claim mobile performance fixed.

- [lighthouserc.mobile.json:41](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/lighthouserc.mobile.json#L41): LCP stopgap still 5500ms, so completion is not established.
- [external evidence](https://github.com/juan294/paisaxe/issues/926): Same /immersive mobile LCP issue plus performance-score and TBT acceptance criteria in owner follow-up.

GitHub receipt: state `CLOSED`, reason `DUPLICATE`, closed at `2026-10-07T13:52:05Z`.

### [#923](https://github.com/juan294/paisaxe/issues/923) [remediate] BE-M5/SE-M2 follow-up: revoke voice_purchases access on charge.refunded / charge.dispute.created

**Keep open. Retained.** Production Stripe webhook only processes granting checkout events. Refund/dispute events still return received without revoking voice access; outstanding policy/schema/idempotency work is not completed.

- [src/app/api/webhooks/stripe/route.ts:19](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/app/api/webhooks/stripe/route.ts#L19): GRANTING_EVENT_TYPES includes only completed and async_payment_succeeded.
- [src/app/api/webhooks/stripe/route.ts:106](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/app/api/webhooks/stripe/route.ts#L106): All other event types return received:true before any database action.

### [#922](https://github.com/juan294/paisaxe/issues/922) Infra: notify_webhook() silently fails on every call — net.http_post body type mismatch

**Keep open. Retained.** Both deployed migration source and live production function still pass body := _payload::text. The observed mismatch was not repaired. Failure is swallowed as a WARNING and the originating transaction proceeds.

- [supabase/migrations/108_restore_notify_webhook_search_path.sql:63](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/supabase/migrations/108_restore_notify_webhook_search_path.sql#L63): Latest function body still casts jsonb payload to text.
- [supabase/migrations/108_restore_notify_webhook_search_path.sql:74](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/supabase/migrations/108_restore_notify_webhook_search_path.sql#L74): Exception handler emits warning and returns trigger row.
- local evidence `.git/issue-audit-2026-10-07/database-readonly.json:1`: Read-only asturias production SQL at 2026-10-07T13:41:31Z returns notify_webhook definition with the same text cast.

### [#921](https://github.com/juan294/paisaxe/issues/921) Backend: pending_bookings has no retention/purge job for terminal bookings

**Keep open. Retained.** No pending_bookings terminal-row retention/purge has shipped. Live production cron inventory has maintenance/marketing/traffic jobs but no retention job; the app stale-booking cron changes status only.

- [src/app/api/cron/fail-stale-bookings/route.ts:31](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/app/api/cron/fail-stale-bookings/route.ts#L31): Only invokes fail_stale_initiating_bookings RPC, no delete/archive.
- [supabase/migrations/011_pg_cron_maintenance.sql:44](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/supabase/migrations/011_pg_cron_maintenance.sql#L44): Cleanup concerns cron.job_run_details, not pending_bookings.
- local evidence `.git/issue-audit-2026-10-07/database-readonly.json:1`: Production cron.job inventory read 2026-10-07T13:41:31Z contains no booking retention/purge task.

### [#920](https://github.com/juan294/paisaxe/issues/920) Docs: Supabase rules/skill still recommend the ALTER DEFAULT PRIVILEGES anti-pattern fixed by SE-H3

**Keep open. Retained.** The installed canonical Supabase rule now rejects blanket public defaults, but both Claude and Codex Supabase skill bodies still label the unsafe ALTER DEFAULT PRIVILEGES grant as the Right pattern. Full docs correction remains undone.

- [.claude/skills/supabase/SKILL.md:44](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/.claude/skills/supabase/SKILL.md#L44): Default Privileges section still recommends blanket anon/authenticated SELECT defaults.
- [.agents/skills/supabase/SKILL.md:41](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/.agents/skills/supabase/SKILL.md#L41): Codex copy retains same unsafe recommendation.
- [.rpi/rules/supabase.md:16](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/.rpi/rules/supabase.md#L16): Rule correctly says do not add anon SELECT to all future tables; does not remove conflicting skill text.

### [#919](https://github.com/juan294/paisaxe/issues/919) Stories: composite (is_active, curation_status) index for public read

**Keep open. Retained.** Requested active/approved composite partial index does not exist in deployed migrations or live production index inventory; individual active and curation indexes remain.

- [supabase/migrations/003_stories_table.sql:27](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/supabase/migrations/003_stories_table.sql#L27): Existing stories_active_idx only indexes is_active.
- [supabase/migrations/004_admin_curation.sql:8](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/supabase/migrations/004_admin_curation.sql#L8): Separate curation_status index.
- local evidence `.git/issue-audit-2026-10-07/database-readonly.json:1`: Read-only live stories indexes confirm no active/approved composite partial index.

### [#918](https://github.com/juan294/paisaxe/issues/918) Chat: generalize the SSE stream's idle-timer + total-cap-timer pair into a shared primitive

**Keep open. Retained.** Chat SSE idle timeout and total-duration cap remain inline separate timers; requested reusable bounded-generation primitive not extracted.

- [src/app/api/chat/stream/route.ts:259](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/app/api/chat/stream/route.ts#L259): Inline idleTimer/reset lifecycle.
- [src/app/api/chat/stream/route.ts:280](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/app/api/chat/stream/route.ts#L280): Separate totalCapTimer and clearing paths at 339,413,424.

### [#917](https://github.com/juan294/paisaxe/issues/917) [Chat] use-story-keyboard-nav effect depends on unstable callback identities (FE-H3 sibling)

**Keep open. Retained.** Story keyboard navigation effect still depends on all three callback identities. Latest-ref/stable-event extraction requested by the issue has not shipped.

- [src/hooks/use-story-keyboard-nav.ts:63](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/hooks/use-story-keyboard-nav.ts#L63): Effect dependency array remains [chatOpen,onNext,onPrev,onToggleInfo].

### [#916](https://github.com/juan294/paisaxe/issues/916) Ops: generalize docs-vs-code drift check to cron-auth header and migration filenames

**Keep open. Retained.** Existing generalized drift guard validates /api/health jq references only. No runbook cron-header/verb or migration-file-existence cross-check found in deployed tests/scripts.

- [src/app/api/health/route.docs-consistency.test.ts:76](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/app/api/health/route.docs-consistency.test.ts#L76): Scans docs for /api/health jq expressions only.
- [src/lib/cron-auth.ts:57](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/lib/cron-auth.ts#L57): Actual Vercel cron Authorization contract.
- [src/lib/cron-auth.ts:92](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/lib/cron-auth.ts#L92): Actual pg_cron x-webhook-secret contract; unit tests validate auth itself, not docs consistency.

### [#915](https://github.com/juan294/paisaxe/issues/915) Backend: feature_flags_public view still defaults new flag config to public

**Keep open. Retained.** Live production feature_flags_public still masks one known flag using a denylist and ELSE config. A public-config allowlist/separate public column has not shipped.

- [supabase/migrations/101_restrict_feature_flags_config_anon.sql:57](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/supabase/migrations/101_restrict_feature_flags_config_anon.sql#L57): CASE visitor_voice_agent then key subtraction ELSE config remains.
- local evidence `.git/issue-audit-2026-10-07/database-readonly.json:1`: Read-only production view definition confirms same ELSE config branch on 2026-10-07.

### [#914](https://github.com/juan294/paisaxe/issues/914) chore: remove now-dead rate-limit degradation flag after DO-H2 live health probe

**Keep open. Retained.** The dead degradation-state API and tests remain; live Redis health improvement did not complete this cleanup.

- [src/lib/rate-limit.ts:166](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/lib/rate-limit.ts#L166): _rateLimitDegraded plus isRateLimitDegraded/getRateLimitBackendStatus remain at 172/176.
- [src/lib/rate-limit.test.ts:617](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/lib/rate-limit.test.ts#L617): Dedicated isRateLimitDegraded tests remain.

### [#913](https://github.com/juan294/paisaxe/issues/913) Infra: local Supabase Docker stack — service_role lacks table grants on feature_flags

**Keep open: evidence incomplete. Retained.** Production service_role currently has SELECT/INSERT/UPDATE/DELETE on feature_flags, so hosted permissions are healthy. The issue specifically reports fresh local bootstrap parity; no explicit service_role DML grant was found in deployed migrations and no fresh local reset was authorized/run for this research. Keep open because production success does not disprove the local-stack defect.

- [src/app/api/admin/feature-flags/[key]/route.ts:55](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/app/api/admin/feature-flags/%5Bkey%5D/route.ts#L55): Admin update uses createAdminClient service role.
- [supabase/migrations/101_restrict_feature_flags_config_anon.sql:39](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/supabase/migrations/101_restrict_feature_flags_config_anon.sql#L39): Grant work adjusts anon/authenticated column access, no explicit service_role repair.
- local evidence `.git/issue-audit-2026-10-07/database-readonly.json:1`: Live hosted feature_flag_grants show service_role full DML at 2026-10-07T13:41:31Z; does not establish fresh local grants.

### [#911](https://github.com/juan294/paisaxe/issues/911) i18n: shared string-interpolation helper for {placeholder} templates

**Keep open. Retained.** Shared interpolation helper has not shipped. Pricing, voice/chat and story progress/viewer still manually replace placeholder strings.

- [src/app/pricing/page.tsx:92](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/app/pricing/page.tsx#L92): Manual duration replacement; further sites at 228/287.
- [src/components/immersive/voice-chat.tsx:329](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/components/immersive/voice-chat.tsx#L329): Manual hours/time replacements.
- [src/components/immersive/story-progress-bar.tsx:114](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/components/immersive/story-progress-bar.tsx#L114): Manual current/total chains.

### [#910](https://github.com/juan294/paisaxe/issues/910) [remediate] UX-S1 The multilingual promise is architecturally half-built

**Keep open. Retained.** Partially addressed: static pages now use i18n and StoryTranslation supports question_prompts. Strategic multilingual scope is not fully completed: Spanish-first client locale detection, Spanish content fallback and separate asturianu_touches path remain; no explicit comprehensive localization/scope decision found.

- [src/app/about/page.tsx:8](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/app/about/page.tsx#L8): About uses t(), as do privacy/terms.
- [src/types/immersive.ts:61](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/types/immersive.ts#L61): StoryTranslation now includes optional localized question_prompts.
- [src/lib/i18n/provider.tsx:57](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/lib/i18n/provider.tsx#L57): Starts Spanish on SSR; browser locale resolved after hydration.
- [src/lib/localize-story.ts:36](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/lib/localize-story.ts#L36): Missing content falls back to Spanish.
- [src/components/immersive/story-viewer.tsx:238](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/components/immersive/story-viewer.tsx#L238): Independent asturianu_touches feature flag remains.

### [#909](https://github.com/juan294/paisaxe/issues/909) [remediate] UX-L4 Component reuse is thin: raw `<button>` outnumbers `<Button>` 42:15, and `SiteFooter` and `ui/card` are dead

**Keep open. Retained.** Partially addressed: listed buttons now have focus rings and ui/card has a real operator-dashboard consumer. SiteFooter still has no production consumer and pricing/checkout/favorites contain no legal-link mounting, so full requested outcome remains unfinished.

- [src/app/pricing/page.tsx:250](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/app/pricing/page.tsx#L250): Primary purchase button now has focus-visible ring.
- [src/app/favorites/page.tsx:392](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/app/favorites/page.tsx#L392): Favorite remove button now has focus-visible ring.
- [src/app/operator/[capability]/operator-dashboard.tsx:7](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/app/operator/%5Bcapability%5D/operator-dashboard.tsx#L7): Card is now imported by a production component, so deletion claim is obsolete.
- [src/components/site-footer.tsx:6](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/components/site-footer.tsx#L6): SiteFooter exists, source search finds only tests as consumers; legal-link hrefs at 18/24.

### [#885](https://github.com/juan294/paisaxe/issues/885) [remediate] QA-S1 The verification strategy has depth everywhere except at the boundaries that actually fail

**Keep open. Retained.** A real PostgREST integration tier now exists locally, but it is still not exercised per-merge by CI. Exact production commit CI log reports the local Supabase stack unreachable and skips booking/reconcile/Stripe/maintenance integration suites. Release-only local-Supabase smoke is a separate gate.

- [src/lib/booking/booking.postgrest-integration.test.ts:39](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/lib/booking/booking.postgrest-integration.test.ts#L39): Real integration suite checks local DB reachability and self-skips.
- [.github/workflows/ci.yml:315](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/.github/workflows/ci.yml#L315): Per-merge coverage installs dependencies then runs Vitest without starting Supabase.
- [external evidence](https://github.com/juan294/paisaxe/actions/runs/37593203490): Exact-head log explicitly says skipping live verification; 50 booking,31 reconcile,4 Stripe and other integration tests skipped.
- [.github/workflows/preview-smoke.yml:73](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/.github/workflows/preview-smoke.yml#L73): Local Supabase started only in release artifact smoke workflow, not per-merge integration tier.

### [#884](https://github.com/juan294/paisaxe/issues/884) [remediate] QA-L5 Isolated low-coverage islands in visitor-facing responsive and animation code

**Keep open. Retained.** Partially addressed: useMediaQuery now measures 100% branches, with controllable listener tests. Exact production coverage still measures AuthorTypewriter 62.16% branches and the shared matchMedia mock is still non-controllable, so the responsive/animation coverage issue remains.

- [src/hooks/use-media-query.test.ts:6](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/hooks/use-media-query.test.ts#L6): Controllable local MediaQueryList mock and _fire change tests.
- [src/test/setup.ts:105](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/test/setup.ts#L105): Global matchMedia mock still hardcodes false and no-op listeners.
- local evidence `.git/issue-audit-2026-10-07/coverage-prod-2.log:3594`: Exact production Coverage run 37593203228 AuthorTypewriter 62.16% branches.
- local evidence `.git/issue-audit-2026-10-07/coverage-prod-2.log:3666`: Same run useMediaQuery 100% branches.

### [#867](https://github.com/juan294/paisaxe/issues/867) [remediate] AR-S2 `noUncheckedIndexedAccess` is off, so array and record indexing is unsoundly typed

**Keep open. Retained.** Production tsconfig still enables strict without noUncheckedIndexedAccess; the requested incremental compiler-flag work is not present.

- [tsconfig.json:11](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/tsconfig.json#L11): strict true; the complete compilerOptions object has no noUncheckedIndexedAccess and no extends.

### [#866](https://github.com/juan294/paisaxe/issues/866) [remediate] AR-S1 The test suite is 2.4× the size of the source it covers, concentrated in a few very large files

**Keep open. Retained.** The large composition-layer test files still exist, and no investigation measuring redundant assertions was found. Their size alone neither proves redundancy nor makes this tracking issue invalid.

- [src/proxy.test.ts:1](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/proxy.test.ts#L1): Production snapshot has 1820 lines against src/proxy.ts 108 lines.
- [src/app/api/mcp/make-booking/route.test.ts:1](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/app/api/mcp/make-booking/route.test.ts#L1): Production snapshot has 3030 lines. These observations do not establish the original repository-wide 2.35 ratio is still exact.

### [#854](https://github.com/juan294/paisaxe/issues/854) [remediate] SE-S1 Data-layer authorization has no automated regression coverage

**Keep open. Retained.** Partially addressed: genuine local role/RLS tests now cover stories, feature flags, match_chunks, definer RPC privileges and Stripe audit denial. The issue asks for each sensitive table with positive controls and production policy parity; no negative role-access suites for admin_audit_log, elevenlabs_webhook_events or translate_webhook_events were found. Live policy inventory does not substitute for this missing automated regression coverage.

- [src/lib/stories-rls.postgrest-rls.test.ts:61](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/lib/stories-rls.postgrest-rls.test.ts#L61): Positive approved-story anon control and negative unapproved/inactive controls.
- [src/lib/definer-function-privileges.postgrest-rls.test.ts:35](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/lib/definer-function-privileges.postgrest-rls.test.ts#L35): All SECURITY DEFINER execute privileges checked against local Supabase; skipped without reachable stack.
- [supabase/migrations/090_fix_rls_operational_tables.sql:22](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/supabase/migrations/090_fix_rls_operational_tables.sql#L22): Sensitive operational table scope includes elevenlabs_webhook_events and translate_webhook_events.
- local evidence `.git/issue-audit-2026-10-07/database-readonly.json:1`: Parent retrieved live production policies and applied migrations on 2026-10-07; no mutating role-denial tests performed.

### [#849](https://github.com/juan294/paisaxe/issues/849) [remediate] SE-L1 SSRF guard on remote image import is resolve-then-fetch (DNS rebinding window)

**Keep open. Retained.** Remote import still validates DNS addresses separately before fetching the hostname; no pinned-IP connection or lookup hook appears.

- [src/app/api/admin/stories/[id]/image/route.ts:116](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/app/api/admin/stories/%5Bid%5D/image/route.ts#L116): lookup(hostname,{all:true,verbatim:true}) validates current addresses.
- [src/app/api/admin/stories/[id]/image/route.ts:325](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/app/api/admin/stories/%5Bid%5D/image/route.ts#L325): fetch(imageUrl) resolves independently; redirect manual and 8s timeout do not bind it to validated addresses.

### [#840](https://github.com/juan294/paisaxe/issues/840) [remediate] DO-S3 The single-operator risk acceptance has no instrumented re-evaluation trigger

**Keep open. Retained.** Runbook still names qualitative review triggers without a review date or measured off-hours trigger. No associated review instrumentation was found.

- [docs/operations/alerting-runbook.md:16](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/docs/operations/alerting-runbook.md#L16): Single operator, no paging is accepted explicitly.
- [docs/operations/alerting-runbook.md:30](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/docs/operations/alerting-runbook.md#L30): Qualitative trigger only: traffic, sensitive data, second operator or recurring off-hours incidents.

### [#839](https://github.com/juan294/paisaxe/issues/839) [remediate] DO-S2 The backup and restore path has never been rehearsed

**Keep open: evidence incomplete. Retained.** No backup-restore rehearsal receipt was found in the production repository. Local fresh-clone/booking release rehearsals concern application installation, not a PITR/snapshot restore. A provider-side rehearsal cannot be ruled out from source, so closure is not confirmed.

- [docs/operations/database-backup.md:36](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/docs/operations/database-backup.md#L36): PITR restore instructions remain procedural.
- [docs/operations/database-backup.md:47](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/docs/operations/database-backup.md#L47): 10-20 minutes remains a generic expected duration rather than a measured rehearsal record.
- [docs/plans/2026-10-03-paypal-hackathon-booking-phases/phase-6.md:137](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/docs/plans/2026-10-03-paypal-hackathon-booking-phases/phase-6.md#L137): Fresh-clone installation/Postman booking rehearsal is not database recovery evidence.

### [#838](https://github.com/juan294/paisaxe/issues/838) [remediate] DO-S1 The audit-remediation loop closes findings on artefacts delivered, not on controls verified operational

**Keep open: evidence incomplete. Retained.** Several cited controls have changed, but this strategic process issue requires observed operational evidence rather than code existence. Production instructions now emphasize exact evidence; the production runbook/logging docs still explicitly distinguish configured from observed delivery. No complete evidence resolving all four cited control instances was established in this assignment.

- [docs/operations/logging.md:105](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/docs/operations/logging.md#L105): Log drain status explicitly UNVERIFIED with observed-delivery requirement.
- [docs/operations/alerting-runbook.md:36](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/docs/operations/alerting-runbook.md#L36): Sentry delivery explicitly unverified; DSN presence alone is not proof.
- [AGENTS.md:118](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/AGENTS.md#L118): Push accountability and RPI evidence gates now require exact results; these contracts do not prove provider delivery.

### [#837](https://github.com/juan294/paisaxe/issues/837) [remediate] DO-L2 Presence checks and value reads disagree on trimming for the same variable

**Keep open. Retained.** The reported trim mismatch persists in deployed MCP routes.

- [src/app/api/mcp/places/route.ts:183](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/app/api/mcp/places/route.ts#L183): Provider value read trims GOOGLE_PLACES_API_KEY.
- [src/app/api/mcp/places/route.ts:427](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/app/api/mcp/places/route.ts#L427): Presence guard reads raw GOOGLE_PLACES_API_KEY.
- [src/app/api/mcp/weather/route.ts:104](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/app/api/mcp/weather/route.ts#L104): Provider read trims OPENWEATHERMAP_API_KEY.
- [src/app/api/mcp/weather/route.ts:275](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/app/api/mcp/weather/route.ts#L275): Presence guard uses raw env value.
- [src/app/api/mcp/make-booking/route.ts:235](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/app/api/mcp/make-booking/route.ts#L235): Raw ElevenLabs env presence checks remain.

### [#820](https://github.com/juan294/paisaxe/issues/820) [remediate] PE-S1 233KB gzip of JavaScript on pages that are pure static content

**Keep open. Retained.** The root client-provider stack still wraps static routes. The original exact 233KB/14-chunk measurement was not re-established, but the tracked architectural baseline remains.

- [src/app/layout.tsx:157](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/app/layout.tsx#L157): Root wraps children in Providers.
- [src/app/providers.tsx:64](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/app/providers.tsx#L64): PostHog, Language, FeatureFlags and Auth providers remain in the shared tree; static routes defer network auth instead of removing the stack.

### [#802](https://github.com/juan294/paisaxe/issues/802) [remediate] BE-S1 The translation queue's worker is the enqueuer, invoked synchronously over HTTP

**Keep open. Retained.** Webhook still combines enqueue, leased claim and awaited translation processing before responding; approve-all still awaits bounded webhook fan-out.

- [src/app/api/webhooks/translate/route.ts:233](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/app/api/webhooks/translate/route.ts#L233): enqueue_translate_webhook_event in POST handler.
- [src/app/api/webhooks/translate/route.ts:256](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/app/api/webhooks/translate/route.ts#L256): Same request claims batch.
- [src/app/api/webhooks/translate/route.ts:313](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/app/api/webhooks/translate/route.ts#L313): Await processClaimedJob in response path.
- [src/app/api/admin/stories/approve-all/route.ts:129](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/app/api/admin/stories/approve-all/route.ts#L129): await runWithConcurrencyLimit of webhook HTTP pings before response.

### [#801](https://github.com/juan294/paisaxe/issues/801) [remediate] BE-L8 Dev-only `child_process` routes ship in the production bundle behind runtime env checks

**Keep open. Retained.** Both dev routes still statically import child_process and use different runtime gates; build-time exclusion or unified stricter gate is not present.

- [src/app/api/admin/agents/run/route.ts:3](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/app/api/admin/agents/run/route.ts#L3): Static spawn import; VERCEL_ENV gate at104.
- [src/app/api/admin/tunnel/route.ts:2](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/app/api/admin/tunnel/route.ts#L2): Static exec/spawn import; NODE_ENV production gate at29.

### [#797](https://github.com/juan294/paisaxe/issues/797) [remediate] BE-L4 `grant_day_pass_idempotent`'s atomicity "invariant" is a no-op sub-block

**Keep open. Retained.** Latest definition of the grant RPC remains migration099 with the redundant exception-rethrow sub-block and claimed atomicity comment.

- [supabase/migrations/099_grant_day_pass_purchase_type.sql:101](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/supabase/migrations/099_grant_day_pass_purchase_type.sql#L101): Comment attributes rollback invariant to explicit sub-block.
- [supabase/migrations/099_grant_day_pass_purchase_type.sql:105](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/supabase/migrations/099_grant_day_pass_purchase_type.sql#L105): BEGIN INSERT ... EXCEPTION WHEN OTHERS THEN RAISE END remains. No later migration redefines this function in production source.

### [#773](https://github.com/juan294/paisaxe/issues/773) [remediate] FE-S1 Auth and locale are resolved entirely client-side, which is the root cause behind several findings

**Keep open. Retained.** Locale and auth bootstrap still resolve after hydration. Fixes to individual revenue-route behavior did not implement the tracked server/proxy resolution architecture.

- [src/app/layout.tsx:122](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/app/layout.tsx#L122): Explicitly states locale resolved client-side to preserve static PPR shell.
- [src/lib/i18n/provider.tsx:57](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/lib/i18n/provider.tsx#L57): es initial locale, actual resolveLocale in useEffect.
- [src/components/auth/auth-provider.tsx:40](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/components/auth/auth-provider.tsx#L40): Auth bootstrap happens in useEffect, calls getSession/getUser at73 and76.
- [src/app/providers.tsx:27](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/app/providers.tsx#L27): STATIC_PATHS skip list remains.

### [#772](https://github.com/juan294/paisaxe/issues/772) [remediate] FE-L3 `useStoryKeyboardNav` registers the same handler twice and re-registers on every navigation

**Keep open. Retained.** WeakSet, document capture plus window listener and callback-dependent effect are all still present.

- [src/hooks/use-story-keyboard-nav.ts:26](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/hooks/use-story-keyboard-nav.ts#L26): WeakSet duplicate-event suppression.
- [src/hooks/use-story-keyboard-nav.ts:57](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/hooks/use-story-keyboard-nav.ts#L57): Registers both document capture and window listeners.
- [src/hooks/use-story-keyboard-nav.ts:63](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/hooks/use-story-keyboard-nav.ts#L63): Effect depends on each callback.

### [#766](https://github.com/juan294/paisaxe/issues/766) [remediate] FE-M4 Five bespoke client-side data/cache layers, several with disabled dependency linting

**Keep open. Retained.** Independent custom cache/fetch implementations remain; no TanStack Query or equivalent shared cache library is in production dependencies. Several individual problems have been repaired, but consolidation is not implemented.

- [src/hooks/use-stories.ts:62](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/hooks/use-stories.ts#L62): Singleton cache; render-time server seed at159-160.
- [src/hooks/use-feature-flags.ts:25](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/hooks/use-feature-flags.ts#L25): Separate module-level TTL/inflight cache.
- [src/components/admin/analytics-cache-context.tsx:32](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/components/admin/analytics-cache-context.tsx#L32): Separate provider maps and fetch orchestration; dependency-lint suppressions at148 and174.
- [src/hooks/use-favorites.ts:24](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/hooks/use-favorites.ts#L24): Independent localStorage/cloud sync.
- [src/hooks/use-voice-access.ts:43](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/hooks/use-voice-access.ts#L43): Independent voice-access fetching.

### [#733](https://github.com/juan294/paisaxe/issues/733) QA journeys: webServer 240s timeout reports as 0 passed / 0 failed instead of a startup failure

**Keep open. Retained.** The harness still parses journey pass/fail counts without mapping nonzero startup exit/zero tests to a distinct startup failure. Reuse of an existing server is supported, but the reporting defect remains.

- [playwright.config.ts:68](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/playwright.config.ts#L68): Build-and-start remains default non-CI command; reuseExistingServer at79 and 240000ms timeout at84.
- [scripts/qa-agent.sh:651](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/scripts/qa-agent.sh#L651): Captures JOURNEY_EXIT_CODE but parses pass/fail separately at655-656.
- [scripts/qa-agent.sh:663](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/scripts/qa-agent.sh#L663): Metrics render passed and failed counts without a startup-failure distinction.

### [#732](https://github.com/juan294/paisaxe/issues/732) QA: chat fetch has no per-request timeout, making the 30s test budget unsurvivable

**Completed. Closed and read back.** The requested attempt timeout and 60s per-test budgets are implemented; weak bare-city validator alternative was also removed.

- [src/tests/qa/llm-quality.test.ts:31](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/tests/qa/llm-quality.test.ts#L31): QUALITY_TEST_TIMEOUT_MS=60000 used by all four test categories.
- [src/tests/qa/llm-quality.test.ts:97](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/tests/qa/llm-quality.test.ts#L97): Chat POST sets signal AbortSignal.timeout(20000).
- [src/tests/qa/llm-quality.test.ts:371](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/tests/qa/llm-quality.test.ts#L371): Place-name validator excludes city-only match.

GitHub receipt: state `CLOSED`, reason `COMPLETED`, closed at `2026-10-07T13:52:12Z`.

### [#731](https://github.com/juan294/paisaxe/issues/731) QA harness: test-count parser reports 0 tests on ANSI-colored vitest output

**Completed. Closed and read back.** All requested parser defenses are present: NO_COLOR, defensive ANSI stripping, anchored Tests summary parse and explicit failed-run/zero-count parse-failure classification. Subsequent actual QA run records nonzero counts.

- [scripts/qa-agent.sh:560](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/scripts/qa-agent.sh#L560): NO_COLOR=1 npm run test:qa.
- [scripts/qa-agent.sh:568](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/scripts/qa-agent.sh#L568): ANSI escapes stripped before anchored parsing at579-580.
- [scripts/qa-agent.sh:591](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/scripts/qa-agent.sh#L591): Nonzero test exit and zero count marks PARSE_FAILURE, rendered distinctly at615.
- historical local `logs/qa-agent-2026-10-01.log:26`: Actual subsequent run parsed 11 passed and1 failed,91% rather than zero.

GitHub receipt: state `CLOSED`, reason `COMPLETED`, closed at `2026-10-07T13:52:18Z`.

### [#730](https://github.com/juan294/paisaxe/issues/730) [QA] Journey Test Failure: Integration Health Check Failures

**Completed. Closed and read back.** The historical health incidents are recovered. July owner comment records warm restart and healthy production; September17 actual exact provider request replay returned HTTP200 four times; latest October1 report records four immediate healthy production health re-probes. Current Oct7 verified production health is also healthy. No durable root-cause fix or provider-wide guarantee is asserted.

- historical local `docs/agents/qa-report.md:24`: Oct1 production health re-probed four times between06:03:48Z and06:04:02Z, all healthy; original degraded component unknown.
- historical local `logs/qa-agent-2026-09-17.log:54`: Exact Anthropic request replay four times returned HTTP200 under1s.
- local evidence `.git/issue-audit-2026-10-07/health-authenticated.json:1`: Oct7 13:38:12Z production healthy with cron_auth ok, sentry configured, upstash ok, build.commit623d3229.
- [src/app/api/health/route.ts:461](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/app/api/health/route.ts#L461): Current readiness status reflects real components and returns degraded when any required component fails.

GitHub receipt: state `CLOSED`, reason `COMPLETED`, closed at `2026-10-07T13:52:26Z`.

### [#722](https://github.com/juan294/paisaxe/issues/722) E2E: /story/[slug] page has zero E2E coverage — only page without a load/render test

**Completed. Closed and read back.** The reported zero-E2E-coverage gap is resolved by story-slug.spec.ts navigating the share URL and asserting immersive redirect/title rendering on desktop and mobile. Suggested OG metadata and nonexistent-slug extra cases are not implemented in this spec; do not claim those assertions exist.

- [e2e/story-slug.spec.ts:9](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/e2e/story-slug.spec.ts#L9): Test visits /story/lagos-covadonga and asserts resulting immersive URL and visible story-title.
- local evidence `.git/issue-audit-2026-10-07/e2e.log:2537`: Exact production commit E2E run37593203389 desktop story-slug test passed.
- local evidence `.git/issue-audit-2026-10-07/e2e.log:2753`: Exact production commit mobile story-slug test passed.

GitHub receipt: state `CLOSED`, reason `COMPLETED`, closed at `2026-10-07T13:52:34Z`.

### [#721](https://github.com/juan294/paisaxe/issues/721) Immersive: PPR pre-hydration window lets nav-button clicks silently no-op before React attaches handlers

**Keep open. Retained.** Navigation buttons still render active click affordances with onClick handlers and no hydration-ready gate. The QA journey still retries click/assert through toPass; no single-click pre-hydration recovery contract is established.

- [src/components/immersive/story-toolbar.tsx:25](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/components/immersive/story-toolbar.tsx#L25): Previous button has onClick with no disabled/hydration state.
- [src/components/immersive/story-toolbar.tsx:38](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/src/components/immersive/story-toolbar.tsx#L38): Next button same behavior.
- [e2e/qa-journey.spec.ts:29](https://github.com/juan294/paisaxe/blob/623d3229314b7bd99169232a90aa75ba47fcfdbf/e2e/qa-journey.spec.ts#L29): Journey helper still wraps interactions in toPass timeout15000.

## Remaining uncertainty and durable handoff

The four unresolved evidence cases are #947 (observed canary check-in and credential-rejection alert delivery), #913 (fresh local-reset privilege parity, although production grants are correct), #839 (backup/PITR restore rehearsal), and #838 (full operational-control verification). All remain open. Absence of a repository receipt does not prove a provider-side activity never happened. No user decision or permission was requested to leave an unconfirmed item open.

The research question is answered for all 65 inventoried issues. No implementation phase was started. Research output is this file on develop; raw inventories, pinned-source extracts, hosted logs, live read-only responses and mutation read-backs remain local under `.git/issue-audit-2026-10-07/`. The source graph is a navigation aid and was not modified. Prior memory supplied historical orientation only; current production identity, relevant source, hosted results and database facts were revalidated.

Unrelated workspace state was preserved: `docs/research/2026-10-07-paypal-webinar-submission-notes.md` was already untracked, and a concurrent process added a generated Next.js guide block to AGENTS.md during research. Neither is part of this task. No commit, push, deployment, provider configuration change, database write or CI rerun occurred.

On resume, re-read the issue state, deployed identity and any changed source or provider evidence before reusing a disposition. Future implementation requires its own approved scope and workflow gates. This task ends at the research and explicitly authorized issue-cleanup boundary.

Final GitHub inventory: **54 open issues**, compared with 65 at the initial snapshot. Every closure above was read back from GitHub.
