# Plan: reconcile and remediate the remaining GitHub backlog

Date: 2026-10-07. Status: complete, independently reviewed, ready for owner acceptance. This is a planning artifact; no implementation or publication is authorized by its existence.

## Objective and evidence identity

Cover all **54 currently open issues** from the [accepted reconciliation research](../research/2026-10-07-github-issues-production-reconciliation.md). The research audited 65 issues and closed 11 after verification. This plan assigns every remaining issue exactly once; related phases cross-reference shared work without creating duplicate owners. Completion means each implemented behavior has exact-candidate verification and each operational requirement has observed evidence. A deferred strategic item remains open with an explicit disposition.

Planning baseline: `develop` and `origin/develop` at `fe1843713a49277bc66460e4ae7470025d01e1c6`, worktree `/Users/juan/code/paisaxe`. Research production baseline: main `623d3229314b7bd99169232a90aa75ba47fcfdbf`, v1.8.0, tree `8e0e555342260de5022c4882e26f69a9fa24ba23`, Vercel deployment `dpl_93uumKPWTNc4VGFBGB2843stJ46G`. Re-read live identities at implementation and release; this record is historical evidence, not a deployment receipt for future changes.

Relevant backend files are unchanged between those commits. Develop has brand-token, conversion-surface and layout changes absent from the research's production baseline. Phase 8 preserves those changes rather than rebuilding the old palette. Existing untracked webinar research is unrelated and preserved. Raw evidence remains under `.git/issue-audit-2026-10-07/`; the cited research retains durable findings and closure receipts.

## Decisions and alternatives

The owner explicitly selected the following five policies on 2026-10-07. Alternatives are recorded to explain the trade-offs; implementation still needs its own phase authorization:

1. Voice Pass: revoke after a full refund, retain after a partial refund, suspend on dispute opening, restore the original unexpired pass if the merchant wins. Any-refund revocation is simpler but changes partial-refund treatment; waiting for dispute loss permits access during the dispute. A payment ledger must support out-of-order events under every choice.
2. Legacy bookings: redact personal details 90 days after an eligible terminal transition, preserving replay identifiers and reconciliation links. A 180-day window retains support context longer. Deletion has cascade and replay risks; redaction is the recommended technical direction. Active/orphaned/reconciling records are ineligible.
3. Localization: complete the six advertised locales. Restricting to Spanish/English reduces authoring and QA work but changes the offered product; transparent partial support preserves breadth with a visible limitation.
4. Voice minutes: complete request-rate controls now and defer a new paid-tier minutes cap pending usage/cost evidence and a separately approved product policy. A cap needs tier limits, reset windows, accounting and buyer recovery; request limits do not satisfy that requirement.
5. Client caches: incrementally adopt TanStack Query behind existing hook contracts. An internal shared layer avoids a dependency but retains cache lifecycle ownership; bug-only repair has the smallest immediate scope and leaves consolidation outstanding.

Routine implementation choices are evidence-bound: keep root PPR static; put request-dependent UI behind bounded Suspense; treat session hints only as presentation hints. Use built-in controlled HTTPS transport for image import with original-host TLS verification. Keep existing timeout budgets. Use forward-only SQL migrations with explicit grants. Keep current retrieval embedding model/dimensions. Never weaken coverage or performance targets to make a check pass.

Accepted ADR 0021 retains inline translation draining below measured thresholds ([decision](../decisions/0021-translation-background-worker.md)). Phase 5 measures and follows that rule; it does not silently approve a worker. ADR 0022 deferred indexed-access checking due to repair volume ([decision](../decisions/0022-lib-sub-domain-structure.md)); Phase 11 is its dedicated follow-up, with no broad folder move prerequisite. Static-page provider splitting and a composite story index are also measurement-gated, as their original issues require.

## Phase structure and dependencies

Execute and accept phases sequentially. These are separate reviewable contracts, not one implementation batch. Phases 1–5 establish reliable evidence and the highest-risk request/data/commerce boundaries. Phases 6–11 handle UI and maintainability. Content follows the existing post-submission constraint; operations close only with real control evidence. A phase may accept completed local work while carrying explicitly separate hosted/provider/deployed qualification forward as open issue gates; that is not permission to claim runtime completion. If local work or a required prerequisite is blocked, record it and request an explicit sequence change before skipping the local phase gate.

| Phase | Contract | Issues owned |
| --- | --- | --- |
| 1 | [Reliable verification](2026-10-07-github-issues-remediation-phases/phase-1.md) | #1009, #884, #733, #866 |
| 2 | [Request security and local-only operations](2026-10-07-github-issues-remediation-phases/phase-2.md) | #942, #937, #935, #837, #849, #801, #914 |
| 3 | [Database boundaries and booking retention](2026-10-07-github-issues-remediation-phases/phase-3.md) | #885, #913, #922, #854, #921, #915, #920 |
| 4 | [Stripe entitlement lifecycle and paid voice journey](2026-10-07-github-issues-remediation-phases/phase-4.md) | #923, #932, #797 |
| 5 | [Retrieval, cancellation and measured backend changes](2026-10-07-github-issues-remediation-phases/phase-5.md) | #936, #933, #930, #918, #919, #802 |
| 6 | [Keyboard, hydration and interaction consistency](2026-10-07-github-issues-remediation-phases/phase-6.md) | #939, #917, #772, #721, #929, #928, #909 |
| 7 | [Locale coverage and request-dependent first paint](2026-10-07-github-issues-remediation-phases/phase-7.md) | #910, #911, #773 |
| 8 | [Measured frontend performance and palette consolidation](2026-10-07-github-issues-remediation-phases/phase-8.md) | #941, #926, #820, #938 |
| 9 | [Client cache consolidation](2026-10-07-github-issues-remediation-phases/phase-9.md) | #766 |
| 10 | [Admin, tooling and documentation contracts](2026-10-07-github-issues-remediation-phases/phase-10.md) | #940, #927, #931, #943, #916 |
| 11 | [Checked indexed access](2026-10-07-github-issues-remediation-phases/phase-11.md) | #867 |
| 12 | [Content and image provenance](2026-10-07-github-issues-remediation-phases/phase-12.md) | #986, #987 |
| 13 | [Operational control verification](2026-10-07-github-issues-remediation-phases/phase-13.md) | #947, #840, #839, #838 |

Phase 3 owns the required real-role runner together with the grants and matrix it verifies, avoiding a gate that depends on a later repair. Phase 4 depends on its DB guarantees and refund choice. Phase 5's recovery calls depend on Phase 3's pg_net fixes. Phase 7 depends on the locale choice and Phase 6 keyboard behavior; Phase 8 must measure the resulting tree. Phase 9 follows the accepted TanStack Query choice and preserves Phase 7's provider identity and Phase 4's entitlement invalidation. Phase 11 repairs checked-index errors on the integrated tree, rather than duplicating repairs that earlier phases invalidate. Phase 12 waits for the submission/publication constraint; Phase 13 can prepare local operational artifacts earlier only through an explicitly agreed sequence adjustment.

## Implementation and acceptance contract

Implementation requires its own accepted scope. Use isolated local worktrees/temporary branches from revalidated develop. One integration owner controls shared contracts, migrations and final local integration. Only explicitly marked nonoverlapping units are `[batch-eligible]`; at most three simultaneous implementers, no working-branch push or draft PR. A phase follows implement → independent review → repair → simplify → verify, then stops for acceptance unless continuation was explicitly authorized.

For each behavioral change, capture a meaningful failing oracle before repair. Each phase runs sequential applicable gates on the integrated candidate: `npm run typecheck`, `npm run lint`, `npm run test`, `npm run test:coverage`, `npm run build`, dependency/probe/migration checks and affected local Playwright projects. Use `npm run lint:deps`, `npm run check-required-probes`, `npm run check-migrations`, `npm run check-env` when those contracts apply. Coverage ratchets and existing required checks stay intact. Save command, exit status, test/pass/skip counts, environment identity and exact commit/tree; aggregate failures without letting later success erase them. Do not repeat unchanged valid evidence absent a reason.

Real DB acceptance uses an inventoried, task-owned disposable Supabase stack, reset before SQL acceptance, seeded with synthetic users and representative states. A required suite that skips because Docker/credentials are absent **fails acceptance**. Grant checks and RLS checks need separate positive and negative controls; unknown-table/connection failures are not proof of denied access. Build and E2E use loopback production artifacts, not Vercel Preview.

Provider-facing checks, paid model calls, production migration/retention activation, settings changes, backup/PITR operations, alert messages and publication require their actual separate authorization. Planning never runs them. Before any authorized integration push inspect native workflow/deployment triggers and prevent Preview creation using only a documented non-destructive path. After that single push inspect expected exact-commit runs; failed remote checks are reported and repaired locally, with a new authorization before another remote action. Production release remains a distinct authorized workflow.

## Closure rules

Each phase records issue number, final disposition, changed identity, automated evidence, required runtime evidence and residual limitations. A code issue closes after its stated behavior and integration checks pass at the accepted identity. A production-specific issue closes only after the relevant released behavior is observed. #947, #839 and #838 require control observations; #913 needs fresh-reset parity. Paid-voice E2E separates real local auth/session behavior from live provider execution. #802/#919/#820 and the minutes-cap portion of #937 remain open if deliberately deferred; a documented deferral is not implementation completion.

The original cleanup request authorizes closing confirmed done/invalid findings; it does not authorize claiming future fixes, production actions, or rejecting strategic issues merely because they are old. Re-read issue state before eventual mutations, post concise exact-evidence receipts and verify each resulting state. No issue mutations occur in this planning phase.

## Stuck states and recovery

Every phase specifies an observer, visible result, exit and executable recovery/disclosure oracle. Global barriers include unavailable local DB (developer sees a failed required check and stack-start/reset instructions), missing owner policy (dependent work stays visibly blocked), denied external action (operator gets a concrete reviewable action and prerequisites), and failed hosted checks (exact failed run is reported; local repair precedes a new request). None may silently become green or endlessly poll. Successful retry must be tested where feasible; otherwise the visible recovery instruction is tested.

## Consumer sweep

[Consumer inventory](2026-10-07-github-issues-remediation-phases/consumer-sweep.md) records commands, all matching source/test/fixture/script paths, owning phases and exclusions. Repeat it at implementation HEAD before changing shared return values, stored state, auth wrappers, cache formats or fixtures. New consumers join the owning phase; differing semantics require an explicit exclusion rather than a blind shared replacement.

## Planning validation and handoff

Planning checks: revalidated develop/production identities, read the complete research and controlling rules, refreshed the 54-issue inventory, queried Graphify for structural navigation and confirmed findings in current source, reviewed primary provider contracts where needed, and mechanically checked one-to-one issue coverage. No product tests or builds were executed for these documentation changes; historical production results establish only the research baseline.

Independent backend/security, frontend/architecture and operations/content reviews passed after repairs; see the [durable review record](2026-10-07-github-issues-remediation-phases/review.md). Validation confirmed 54 unique issue owners across 13 phase files, valid document links and source anchors, and 22 reproducible read-only consumer searches. HEAD, origin/develop, origin/main and the live 54-issue inventory remained unchanged at final validation. All five product choices above are resolved; no product-policy question remains open. Next workflow is implementation of Phase 1 only after plan acceptance; it is not started by this document. On resume, read this plan, its phase and research fully, inspect actual branch/status/HEAD/deployed identity, reconcile concurrent edits, and revalidate every reused receipt. Preserve unrelated edits and these artifacts before cleanup.

## Implementation progress, 2026-10-07

Phase 1 is implemented with passing local checks. The literal normal-capacity SSE qualification remains an explicit owner-acceptance limitation because the baseline ran on a heavily loaded host. [Implementation notes](2026-10-07-github-issues-remediation-notes.md) record independent review, fixes, simplify, exact candidate identities, complete local gates, the 40-run SSE matrix, full E2E results and remaining evidence limits. Phase 2 is implemented, independently reviewed and locally qualified on 2026-10-08; unrestricted verification, the favorites ordering repair and normal commit/local integration receipts supersede the earlier permission blockers. See the Phase 2 sections in the implementation notes. No publication, deployment or issue mutation occurred.


### Progress update, 2026-10-09

The owner accepted Phase 3, Phase 4 and Phase 5 local work and explicitly authorized Phase 6. Phase 5’s retrieval/cache cancellation, shared generation timer and three-consumer timeout classifier are implemented and independently reviewed. #919 remains open with measured local index deferral; #802 remains open because representative translation workload is unmeasured. The combined provider qualification retains its accepted ElevenLabs evidence gap. Phase 5 delivery is recorded in the [implementation notes](2026-10-07-github-issues-remediation-notes.md) and its private handoff. Phase 6 is implemented, independently reviewed and locally verified, with owner acceptance pending. Its [implementation record](2026-10-07-github-issues-remediation-phases/phase-6-implementation.md) records passing checks, retained failures, actual native zoom and manual visual evidence; the private handoff holds final delivery identities and cleanup. No Phase 7 or publication authority is inferred.

### Phase 7 authorization and work, 2026-10-09

The owner accepted Phase 6 and authorized Phase 7 local implementation. Locale, story-question and request-presentation changes are implemented and locally verified; owner acceptance remains pending. The [Phase 7 implementation record](2026-10-07-github-issues-remediation-phases/phase-7-implementation.md) preserves scope, independent review and retained failures. Native-language review and production translation coverage remain unmeasured. This update supersedes the earlier absence of Phase 7 authority; it grants no Phase 8, publication or production authority.


### Phase 8 local qualification, 2026-10-10

The owner accepted Phase 7 and authorized Phase 8. The [implementation record](2026-10-07-github-issues-remediation-phases/phase-8-implementation.md) preserves lazy DSN-gated boundaries, restored measured mobile budgets, equivalent palette roles and measured #820 deferral. Full local coverage passes 10,967 cases at unchanged thresholds; mobile medians are 0.89 / 3,738.57 ms / 46.5 ms. Required actual DB passes 1,002 cases while the combined provider gate retains the accepted ElevenLabs RED. Owner acceptance remains pending after normal native hooks, local integration and owned cleanup recorded in the private final handoff. This supersedes the earlier absence of Phase 8 authority; Phase 9 remains unstarted. No publication or issue mutation is inferred.

### Phase 9 authorization and work, 2026-10-10

The owner accepted Phase 8 and authorized Phase 9. All five cache domains now use the selected TanStack Query engine behind stable hook APIs. Independent reviews, simplification and full local runtime qualification are complete: 11,010 coverage cases, 1,002 actual database cases, 1,096 cadence cases and affected browsers pass; the combined provider gate retains the accepted ElevenLabs RED. Native hooks and local delivery are recorded separately in the final private handoff; owner acceptance remains pending. The [implementation record](2026-10-07-github-issues-remediation-phases/phase-9-implementation.md) records identity isolation, persistence, shared reads, optimistic ordering, expiry, repairs and retained failures. This supersedes the earlier absence of Phase 9 authority. Phase 10, publication, issue mutations and provider retries remain outside this authorization.

### Phase 10 authorization and work, 2026-10-11

The owner accepted Phase 9 and authorized Phase 10. Shared admin authorization, all ten panel decompositions, the pure environment parser and runbook/testbed contracts are implemented, independently reviewed and simplified. Complete local runtime qualification passes 11,271 coverage cases, 1,002 actual database cases, 1,096 cadence cases, affected browsers, production artifacts and unchanged performance budgets. The [implementation record](2026-10-07-github-issues-remediation-phases/phase-10-implementation.md) preserves repairs, retained failures and exact qualification. Normal hooks and local delivery require separate receipts in the private final handoff; owner acceptance is pending. This supersedes the earlier absence of Phase 10 authority. Phase 11, publication, issue mutations and provider retries remain unauthorized, and the accepted ElevenLabs evidence gap remains RED.


### Phase 11 local qualification, 2026-10-11

The owner accepted Phase 10 and authorized Phase 11 with “go ahead with phase 11”. Work is isolated on `fix/issues-phase11-indexed` in `/Users/juan/code/paisaxe-issues-phase11`, based on develop `48d7d84eaa8a677c402166085f211f6efb1914f4`. The initial canonical inventory contains 1,303 diagnostics across 242 files. App, scripts, E2E and edge now report zero diagnostics with effective `noUncheckedIndexedAccess=true`; independent source review approved the repairs, including expanded-year ISO date preservation. All 260 final source/config targets have independent review and all three simplify lenses, with zero unresolved findings. Complete local runtime qualification passes all 12 static checks, 11,309 coverage cases, 1,002 actual database cases, 1,096 cadence cases, production artifacts and unchanged performance budgets. General browser QA passes 393 cases with the same 36 baseline exclusions; focused auth/admin/presentation/release/paid-voice stand-in suites pass with zero skips. The [implementation record](2026-10-07-github-issues-remediation-phases/phase-11-implementation.md) preserves exact results and retained failed attempts. Native hooks and local delivery require their actual receipts in the private final handoff; owner acceptance remains pending. This supersedes the earlier absence of Phase 11 authority. Phase 12 remains unauthorized. The accepted ElevenLabs evidence gap remains RED; publication and GitHub issue mutations are separate.
