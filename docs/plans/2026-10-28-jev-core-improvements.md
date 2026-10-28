# Jev core improvements: implementation plan

Date: 2026-10-28. Repository/workspace: `/Users/juan/code/paisaxe`. Integration branch and baseline: `develop`, `26c624adce298a98d15ef123b902a4a13d2134bb`. Status: **implementation in progress; phases 1–4 accepted locally**. See [implementation notes](2026-10-28-jev-core-improvements-notes.md).

## Objective and accepted scope

Implement the five improvements selected by the owner: developer decision inspection, bounded booking intake, advisory telephone-outcome analysis, evidence checking and explicit preference matching. The owner selected “Core five improvements” during planning. Automatic payment-settlement classification, public developer APIs, broad chat routing, editorial automation, persistent personalization and experimental vision are excluded.

Inputs are the accepted [research](../research/2026-10-28-jev-capabilities-and-paisaxe.md) and [assessment](../research/2026-10-28-jev-opportunities-assessment.md). Both were read completely and their source baseline revalidated: HEAD is unchanged. The only initial dirty files were those two untracked reports; preserve them. Current Graphify generation `2026-10-28t16-56-13-986z-130035` supplied navigation; current source confirmed decisions. No live model call or application test ran while writing this plan.

## Design decision and alternatives

| Option | Trade-off | Decision |
| --- | --- | --- |
| Add Jev before every existing model call | Easy insertion, but adds latency and a provider dependency without removing work | Rejected |
| Replace the booking agent or retrieval stack | Large semantic/authority change; current caches, tools and reranker already exist | Rejected |
| Add narrow typed modules and an offline inspector; enable two bounded runtime tasks only after comparison | Smaller changes, explicit fallbacks, measurable benefit; initially covers fewer requests | Selected |
| Use only improved deterministic code | Lowest operational cost; may be sufficient for some cases | Mandatory comparator in evaluations, retained if Jev does not win |

The selected architecture is additive. Existing `BookingTurnInput`, booking tool schemas, `BookingOutcome`, `OfferCard`, SSE events, retrieval result/cache formats and corpus acceptance receipts keep their semantics. A new matching response belongs only to its new route/hook/panel. The advisor and evidence checker operate on explicit local snapshots, not live webhooks or streamed visitor output.

Source anchors: current tool loop `src/lib/booking/agent.ts:138`; deterministic post-acceptance branch `src/lib/booking/agent.ts:196`; validated tools `src/lib/booking/tools.ts:379`; role-flattening classifier `src/lib/services/elevenlabs-webhook-service.ts:161`; cached retrieval `src/lib/retrieve-chat-context.ts:22`; evidence receipt requirements `scripts/lib/corpus-quality-evidence.ts:66`; provider fact authority `src/lib/booking/facts.ts:51`.

## Fixed implementation decisions

1. Pin `@typesafe-ai/sdk` to `0.7.0` and model to `jev-1.14.0`. Recheck availability/types before installation; a changed version requires updated evaluation identity, not an automatic alias substitution. The versioned SDK is MIT/Node >=22; the application declares Node >=24 (`package.json:5`). [SDK source](https://github.com/typesafe-ai/typesafe-sdk-js/blob/v0.7.0/package.json), [Models](https://docs.typesafe.ai/models).
2. Keep the client server-only. `TYPESAFE_API_KEY` is optional at startup; no key creation or provisioning is part of local implementation. `JEV_ENABLED_TASKS` is an empty-by-default allowlist containing only `booking_intake` and `experience_match`. Unknown entries fail configuration validation and disable Jev, with an operator-visible error. Missing key disables the two tasks without breaking the existing app. No model override or browser API key is introduced.
3. Runtime starts with exact locale `es`. Other locales use the existing path; there is no implicit translation or English-quality assumption. Advisory fixtures can exercise other languages, but this plan does not activate them for visitors.
4. Interactive inference has a 1,200 ms total deadline, zero SDK retries and caller cancellation. Offline inference has a 10-second deadline and zero retries. Errors are typed `unavailable`, never semantic false. One batch contains at most ten matching candidates or the bounded questions for one interpretation/claim; no long-context or image opt-in.
5. Initial classification policy uses Noul >=0.90 for positive assertions, <=0.10 for negative assertions; middle values abstain. With two or more candidates, required Choice selection needs top probability >=0.90 and margin over runner-up >=0.20. A singleton is selected deterministically only after the independent presence/intent/contradiction gates pass. These are fixed conservative pilot settings, not claimed calibration. A change produces a new question/policy version and re-runs qualification; failure leaves runtime disabled.
6. Runtime logs contain task/version/model, request ID, latency, outcome/reason, nullable token usage and cost estimate when available. No raw visitor state, transcripts, credentials, capability URLs or debug bodies. Offline synthetic cases retain exact input/response and hashes under the existing ignored `test-results/jev/` directory (`.gitignore:61`). Do not extend Anthropic-specific accounting with mislabeled Jev costs (`src/lib/costs/anthropic-usage.ts:73`).
7. No new database schema is required. New matching requests reuse booking access and the atomic `chat_turns` allowance (`src/lib/booking/gate.ts:33`, `src/lib/booking/metering.ts:12`). The panel discloses this before submission. “Read-only matching” excludes booking/profile writes, not quota/rate-limit bookkeeping.
8. No cross-user matching/result cache. Preserve current retrieval caching. Snapshot and question identity belong in offline reports, not a new distributed cache or background processing system.
9. J2 accelerates only pristine first-turn Spanish availability discovery, using `search_experiences` and existing offer cards. It adds no interpretation-driven draft/quote/payment writes. The route already creates/loads a draft and consumes allowance (`src/app/api/booking/chat/stream/route.ts:136`, `src/app/api/booking/chat/stream/route.ts:145`).
10. J3 is disconnected from webhook/SMS/payment writers. J4 checks supplied claim units against supplied passage bodies and reports `provided_claims_only`; neither creates corpus approval receipts. J5 ranks soft fit within deterministic suitability partitions and cannot change provider-fact verdicts, prices or availability.

## Phase sequence

Each phase stops for acceptance. The present request authorizes this plan, not implementation, live spend or continued execution across implementation phases.

| Phase | Deliverable | Dependency |
| --- | --- | --- |
| [1](2026-10-28-jev-core-improvements-phases/phase-1.md) | Server adapter, typed failure/usage contracts, configuration and deterministic transport tests | None |
| [2](2026-10-28-jev-core-improvements-phases/phase-2.md) | Working CLI inspector, static report, fixture/live separation and bounded evaluation runner | 1 |
| [3](2026-10-28-jev-core-improvements-phases/phase-3.md) | First-turn booking discovery fast path and baseline comparison | 2 |
| [4](2026-10-28-jev-core-improvements-phases/phase-4.md) | Offline role-aware call-outcome advisory comparison | 3 accepted |
| [5](2026-10-28-jev-core-improvements-phases/phase-5.md) | Offline passage/claim evidence checker with explicit coverage | 4 accepted |
| [6](2026-10-28-jev-core-improvements-phases/phase-6.md) | Explicit preference-matching form and bounded authenticated endpoint | 5 accepted |

[Behavioral oracles](2026-10-28-jev-core-improvements-phases/behavioral-oracles.md) specify concrete cases. [Consumer sweep](2026-10-28-jev-core-improvements-phases/consumer-sweep.md) records callers, writers, fixtures and exclusions. Phase file lists are implementation ownership boundaries, not files already changed.

## Verification and acceptance

Implementation follows TDD -> independent review -> repair -> simplify -> verify. Use isolated worktrees from the current `develop`; one integration owner preserves existing dirty documents, integrates completed work locally, and owns final gates. Working branches remain local. The approved scope creates no issues, PRs, provider settings, remote variables, pushes, Preview deployments or production activation.

Run focused tests while implementing, then these local gates sequentially after each phase: `npm run typecheck`, `npm run lint`, `npm run test:coverage` (executes the full ordinary Vitest suite with existing thresholds), `npm run build`, `npm run check-env`, `npm run check-secret-inventory`, and `npm run check-licenses`. Do not run an identical full `npm test` again after an unchanged full coverage pass. Coverage thresholds/configuration are not weakened (`vitest.config.ts:42`). Record every command, exit and exact source identity; aggregate failures rather than letting a later pass erase them.

Phases 3 and 6 also run the named local PostgREST and Playwright tests in their files against a disposable task-owned stack. Apply the repository's local-stack setup/contract runner; no shared database reset. Run `npm run check-migrations` and `npm run test:contracts` for those phases to preserve database/tool contracts even though no migration is planned. E2E uses a local fixture HTTP transport for Jev and the existing booking replay where specified; it is deterministic integration evidence, not live model qualification. No paid voice, production probes, live QA or hosted rerun is implied. Full release preflight remains the existing separately authorized release workflow.

### Live evaluation acceptance, separate from deterministic code acceptance

| Task | Frozen evaluation and adoption requirement |
| --- | --- |
| Booking intake | Separate 40-case tuning set and 120-case held-out set: 60 eligible and 60 must-fallback. At least 80% of eligible cases use the fast path, zero incorrect fast-path criteria or forbidden actions, all must-fallback cases fall back. At least 30 paired complete booking scenarios: >=20% lower median time to first useful offer and provider cost; p95 time to quote <=105% of baseline, no worse outcome/clarification count. |
| Call advisory | 40 tuning + 120 held-out synthetic cases with explicit speaker roles; report false acceptance, missed acceptance, abstention and baseline disagreement. Zero false acceptance and >=80% correct non-uncertain labels on fully evidenced truth-labelled cases are required to mark the advisor qualified for developer assistance; this never qualifies settlement. Report sample limits. |
| Evidence checker | Preserve the existing 40-query corpus contract; add at least 20 separately authored held-out claim cases with supplied passages. Zero contradicted/not-established claims marked supported; >=90% recall on supported claims and >=90% macro F1 over truth-labelled cases; all missing-input/provider failures stay visibly unavailable. |
| Experience matching | 40 independent Spanish preference/shortlist cases with blind reviewer preference. Preserve hard-fact invariants in 100% of cases. Jev ordering preferred in >=60% of all cases, counting ties as non-wins. Added p95 semantic latency <=1,200 ms and no automatic calls on mount/typing/swipe. |

These are product acceptance targets chosen for this plan, not measured results or universal accuracy guarantees. Freeze labels and splits before tuning; keep expected labels out of request state. Record confidence intervals/sample counts and worst cases. An incomplete run is `PARTIAL` or `UNAVAILABLE`, never a pass. A failed target retains the existing path and default-off setting; implementation is not represented as a demonstrated improvement. Revised scope/thresholds require an explicit recorded plan amendment rather than silently lowering acceptance.

All paid live requests require a later authorization naming data scope and spend/request caps. The initial allowed data design is synthetic or explicitly approved authored snippets, not customer transcripts. The runner requires an explicit maximum request count and dollar cap, durably records a conservative full-context input charge/count before each no-retry Jev HTTP attempt, and stops before exceeding the cap. Nullable usage or a crash without durable completion retains the reservation and is labelled unmeasured; unknown-completion attempts are never automatically resent. A comparison that also calls Claude requires its separate cap; otherwise it uses supplied exact baseline evidence and cannot claim fresh paired latency. Account terms/quotas remain unverified. This is an execution prerequisite with a defined disabled outcome, not an unresolved design choice.

## Stuck states and recovery

Every phase supplies recovery/disclosure tests, not just denial tests. Cross-cutting behavior is:

| State | Who sees it and how it ends | Required proof |
| --- | --- | --- |
| Task disabled/key absent/config invalid | Existing visitor path remains usable; inspector prints exact configuration reason and action, without key values | Zero outbound call; next valid configured request succeeds without sticky error cache |
| Timeout/rate limit/bad provider response | Runtime falls back to existing booking or deterministic matching; inspector records case-level unavailable | Exactly one bounded call, no fabricated truth label; later successful request recovers |
| Client abort | Client exits loading; request signal prevents late output or additional Jev/tool work | Abort at preflight/inference/database stages; no stale result; Phase 3 discloses existing in-flight tool limits while Phase 6 aborts its new database HTTP |
| Insufficient data/uncertainty | Existing chat clarifies, matching displays unknowns, inspector shows missing evidence | Explicit input edit/ordinary-chat/re-evaluation path succeeds |
| Budget exhausted/interrupted run | Operator sees completed/missing/unknown-completion attempts, `complete:false`, nonzero exit and a resume command | Resume retains reservations and exact completed identity; unknown-completion retry needs explicit selection and remaining/new authorized cap |
| Quality target fails | Report names failed cases/metric; runtime remains off | No generated approval/enablement; report retains the failing result after later runs |
| Access/allowance expires | Matching shows existing access/limit flow; existing booking capability pages remain reachable | Stale client cannot bypass server gate; replenished valid access recovers |

## Independent units and handoff

Only units explicitly marked `[batch-eligible]` in phase files may be delegated in parallel, after their input contract is fixed. Use at most two implementers for this scope, one owner per file set; the integration owner alone edits shared runner registrations, package files and integration tests. Phase execution and acceptance remain sequential. No batch unit may publish a branch or PR.

No material design question remains. The chosen restrictions resolve unknown provider quality through explicit fallback/non-activation, and unknown account terms through a future live-data authorization step. Three bounded independent planning reviews covered the main plan and all eight companion files: provider/runner contracts; booking/advisory behavior; and evidence/matching/consumer recovery. Their findings and dispositions are recorded below. On resume, recheck HEAD, worktree status, the accepted artifacts and provider version availability. Next authorized workflow would be Phase 1 implementation after plan acceptance; local integration does not authorize live experimentation or publication.

### Planning review and durable handoff

| Finding | Disposition |
| --- | --- |
| PLAN-01: server-only CLI import would fail under plain tsx | Resolved: React server condition in the launcher and real subprocess smoke checks |
| PLAN-02: ambient SDK endpoint/logging could bypass intended metadata policy | Resolved: explicit fixed API origin and SDK logging off, with hostile-environment oracle |
| PLAN-03: crash between dispatch and checkpoint could lose spend | Resolved: flushed per-HTTP attempt reservations/counts before dispatch; unknown completion never silently retried |
| PLAN-04: singleton candidate has no runner-up | Resolved: deterministic singleton selection behind independent semantic gates |
| PLAN-05: supported hard constraints lacked extraction semantics | Resolved: three exact-span boolean constraints, independent required judgments, other requirements fall back |
| PLAN-06: existing booking evaluator is live on import and omits locale/route timing | Resolved: side-effect-free harness extraction, explicit es/modes, bounded HTTP comparison and separately labelled timing |
| PLAN-07: advisor baseline import transitively includes SMS formatters | Resolved: permit existing pure comparator/formatter import; forbid mutation entrypoints and prove zero non-Jev transport |
| PLAN-08: incorrect existing card/contract/corpus-test paths | Resolved: source-confirmed paths and a full cited-path/link check |
| PLAN-09: “less than 40” incorrectly expected an inclusive 40-euro cap | Resolved: inclusive fixture wording; exclusive wording falls back |
| PLAN-10: claim support was not bound to its cited passage subset | Resolved: per-claim citedPassageIds, subset-only judgments and wrong-citation oracle |

All findings are resolved in the saved specification; none is deferred as an implementation decision. Documentation verification passed for all nine plan files: relative links, cited local path existence/line bounds, pseudocode block/step limits, absence of unresolved markers and whitespace. `git diff --check` also passed for tracked changes; the explicit file checks cover these new untracked documents. These are documentation checks, not application or live-model test evidence. No implementation, credential/provider change, live inference, push or publication occurred. Base/current source commit remains `26c624adce298a98d15ef123b902a4a13d2134bb` on `develop`; workspace remains `/Users/juan/code/paisaxe`. Only the two research reports and this nine-file plan are untracked. Preserve them on handoff. Phase 1 entry requires the owner's next implementation instruction, an isolated local worktree and revalidated source/version identity. Quality, latency and cost gains remain unmeasured.
