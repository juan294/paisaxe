# Phase 8: Measured frontend performance and palette consolidation

Parent: [backlog plan](../2026-10-07-github-issues-remediation.md). Owned issues: #941, #926, #820, #938. Baseline: develop `fe1843713a49277bc66460e4ae7470025d01e1c6`; revalidate at entry. Status: planned, not implemented. Apply the parent's local-only authority, TDD/review/simplify loop, sequential verification, coverage ratchets and acceptance boundary in full.

## Scope and source evidence

Sources: `src/lib/sentry-client-init.ts:30`, `src/app/error.tsx:5`, `src/app/global-error.tsx:4`, `src/app/admin/error.tsx:4`, `src/app/favorites/error.tsx:5`, `src/app/immersive/error.tsx:5`, `lighthouserc.mobile.json:21`, `lighthouserc.mobile.json:41`, `src/components/immersive/story-viewer.tsx:287`, `src/components/immersive/story-viewer.tsx:336`, `src/app/immersive/immersive-page-content.tsx:135`, `src/app/base.css:5`, `tailwind.config.ts:47`. Develop already implements brand-token use; the old zero-use premise is obsolete.

## Design and work units

Lazy-boundary unit [batch-eligible] reuses loadSentryIfConfigured in all five client boundaries. Preserve safe capture, reset and logging; loader/capture rejection must not recurse or block recovery. Server webhook/canary/instrumentation SDK imports are explicitly excluded. No live Sentry event during local tests.

One performance/layout owner captures current exact-candidate assets and mobile trace before choosing optimizations. #926 acceptance remains performance >=0.7, median mobile LCP <=4000ms and TBT <500ms using existing realistic fixture/throttling and three-run median, plus existing desktop budgets. Investigate adjacent hidden priority images competing with initial image, hydration/RSC payload and startup work; implement only trace-supported changes. On the final candidate restore all required mobile enforcement: performance minScore 0.7, LCP max 4000ms and TBT as an error, with a strict numeric TBT <500ms aggregate assertion to avoid inclusive max500 accepting the boundary. Remove temporary notes after measured success. Config/gate negative fixtures prove score <0.7, LCP >4000 or TBT >=500 fails the required result. Do not disable auth, reduce fixture realism, widen thresholds, downgrade TBT severity or rely on warnings.

#820: remeasure compressed static route JS against historical 233KB on comparable build inputs. Only when growth is established, or the owner separately accepts the structural change, introduce lighter informational segment layouts under the same root. Avoid different-root full navigation, conditional auth-provider removal and PPR regressions. Otherwise record measured deferral and keep the issue open; an old byte count does not justify a provider rewrite.

Palette unit starts after shared CSS/token role table is frozen; use one owner while touching viewer/pricing/admin consumers. Retain base.css semantic roles and established paisaxe.green scale. Inventory raw literals and map them to documented semantic/brand roles surface by surface, preserving rendered pixels/contrast. No visual rebrand or light/dark inversion is authorized. Shared palette work and consumer changes are serial; do not overlap module decomposition.

## Automated criteria

Boundary tests: no DSN means no load, configured loader captures once, import/capture rejection leaves reset usable, unmounted reporting does not update state. Production asset analysis proves eager client SDK exclusion under no DSN; mocked configured integration preserves capture.

Store all Lighthouse runs, exact tree, LCP element, assets, settings and three-run median. Targets above pass, desktop remains green, initial image not double fetched, next-story/paid action still responsive and no flash. Conditional provider split proves reduced static bytes, stable auth/flags/analytics on cross-route navigation and unchanged root PPR.

Token-role mapping plus existing brand/globals tests and focused visual snapshots prove intended equivalent colors, accessible focus/contrast and no accidental unthemed admin/checkout surface. Re-run raw literal sweep and classify remaining semantic exceptions explicitly.

## Manual and external criteria

Visual-only mobile/desktop review for theme, image transitions and text contrast. Authorized hosted Lighthouse and post-release runtime evidence remain separate from local production-build results.

## Stuck states and recovery

Reporting SDK failure cannot prevent error reset; test reset after rejected import. Performance target failure retains reports and issue open with measured bottleneck, rather than a weaker budget. Missing baseline blocks only #820's structural change. Image/preload failure uses existing fallback and navigation recovery; theme substitution never removes visible focus.

## Phase acceptance and handoff

Run the parent's applicable sequential integration gates plus the automated criteria above on the integrated candidate. Record exact identity, commands, pass/fail/skip counts, review/simplify findings and fixes, and each issue's local/runtime disposition. Manual or provider evidence is separate; missing evidence leaves the issue open. Stop after acceptance, preserving the plan and implementation receipts; proceed only with authorized continuation. Consumer ownership and command inventory are in [consumer sweep](consumer-sweep.md).
