# Phase 10: Admin, tooling and documentation contracts

Parent: [backlog plan](../2026-10-07-github-issues-remediation.md). Owned issues: #940, #927, #931, #943, #916. Baseline: develop `fe1843713a49277bc66460e4ae7470025d01e1c6`; revalidate at entry. Status: planned, not implemented. Apply the parent's local-only authority, TDD/review/simplify loop, sequential verification, coverage ratchets and acceptance boundary in full.

## Scope and source evidence

Sources: `src/lib/admin-auth.ts:241`, `src/lib/admin-auth.ts:252`, `src/lib/admin-auth.ts:264`, `scripts/check-env.ts:27`, `scripts/check-env.ts:89`, `scripts/check-secret-inventory.ts:24`, `scripts/lib/is-main.ts:1`, `src/lib/cron-auth.ts:55`, `src/lib/cron-auth.ts:90`, `src/app/api/health/route.docs-consistency.test.ts:76`, `.claude/hooks/verify-edit.sh:60`, `docs/engineering/testbed.md:316`. Research #940 lists all ten panel files despite its nine-file title.

## Work units and design

Admin authorization unit owns all 27 direct-validator routes and tests from the consumer inventory plus scoped ESLint restriction. Migrate to withAdmin first to retain service-role semantics; withAdminRead is appropriate only when RLS supports the intended reads, not merely because method is GET. Preserve envelopes/status, dev guards, CSRF, request logging and async route params. Fresh role validation blocks next mutation after revocation. Restrict direct runtime validator imports in route modules; implementation/tests remain allowed. Compliant routes are regression consumers rather than gratuitous rewrites.

Admin decomposition unit follows existing colocated-module conventions, serial after authorization/cache/color changes in matching files. Cover all ten: create-story-dialog, github-analytics-panel, elevenlabs-analytics-panel, stories-tab-panel, image-editor-dialog, admin-shell, story-card, suggestions-panel, feature-toggles-panel, story-translations-tab. Preserve public import paths; separate pure displays/types/skeletons and stateful hooks only where warranted. Per-panel file-disjoint work may be [batch-eligible] at most three after shared export contracts freeze; admin-shell/stories-tab/story-card composition stays serial. No arbitrary file-size target.

Tooling unit [batch-eligible] owns a pure env-example parser, both CLI consumers/tests and no admin files. Accept content → fresh key Set; no import-time FS/env/console/exit. Preserve active/commented optional/CRLF/empty/whitespace/duplicate syntax; credential filtering stays in inventory consumer and CLI behavior remains. Use existing is-main helper if exporting CLI functions.

Runbook/docs unit [batch-eligible] owns migration/cron command consistency tests and documentation only. Scan operations and runbooks migration basenames against actual files; annotated historical references are explicit. Parse fenced curl examples without executing shell/expanding secrets, then invoke real route/auth verifier with fixture values and method. GET/POST/header swaps must fail negative controls. Unsupported syntax emits doc:line and a supported form. Preserve existing health-shape checks. Replace decorative testbed emoji while preserving every row ID/expected behavior; use text names for UI examples, no whole-file bypass.

## Automated criteria

Admin matrix per affected route: anonymous/nonadmin/auth failure/stale role/valid admin/malformed input, side effects absent on rejection, original envelopes and body contracts. ESLint fixture rejects direct import in runtime route and permits implementation/tests. Each panel public boundary retains loaded/empty/error/loading, form focus, filters, close/reset and save failure recovery.

Env fixtures assert exact key sets including $/equals/comment edge cases and pure import. Real CLI subprocesses in temporary tree verify documented0, missing-key1 and stale inventory1, plus corrected rerun. Doc checker negative controls use invented/wrong migration and swapped verb/header; correct examples pass. Existing Unicode detector returns zero unintended emoji, Markdown cell counts and test IDs stay intact. No implementation-mirroring tests solely for decorative text replacement.

## Manual criteria

Review essential literal UI descriptions and module boundary readability. No external actions.

## Stuck states and recovery

Admin auth errors return promptly with actionable sign-in/permission response, never hang. Failed panel saves preserve editable data and show retry; later save succeeds. Missing env file/key names exact path/key; corrected fixture passes next invocation. Unsupported runbook syntax points to a valid form and corrected example passes. Tests prove these exits/disclosures.

## Phase acceptance and handoff

Run the parent's applicable sequential integration gates plus the automated criteria above on the integrated candidate. Record exact identity, commands, pass/fail/skip counts, review/simplify findings and fixes, and each issue's local/runtime disposition. Manual or provider evidence is separate; missing evidence leaves the issue open. Stop after acceptance, preserving the plan and implementation receipts; proceed only with authorized continuation. Consumer ownership and command inventory are in [consumer sweep](consumer-sweep.md).
