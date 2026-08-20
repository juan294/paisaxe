# Remediation Report
> Generated on 2026-08-20 | Branch: `develop` | 154 findings processed
>
> Pre-launch report: `docs/agents/pre-launch-report.md` (generated 2026-08-18, verdict: NOT READY — 6 launch-blockers)

## Summary

- Findings processed: 154 (Wave 1: 65, Wave 2: 70, Wave 3: 19)
- Work units: Wave 1 — 51 file-disjoint worktree branches. Wave 2 — 37 (36 worktree branches + 1 finding already resolved by an earlier Wave 1 commit, requiring no new branch).
- Issues created: 154 (via `gh issue create`, all fully labeled: type + priority/severity + wave + domain)
- Issues resolved (merged to `develop`, CI green): 135 (Wave 1: 65, Wave 2: 70)
- Issues filed only, not fixed (Wave 3 — the one documented exception to 100%-fix coverage): 19
- Halted (recommendation unsafe — needed human re-scope): 0
- Tests added: several hundred across both waves (every work unit followed TDD; exact count not separately tracked)
- Files modified: Wave 1 — not separately tracked (see `git log 218935db..161ac6aa`). Wave 2 — 193 files across the full integration diff (161ac6aa..HEAD before the two post-integration fix commits)
- CI status: **PASSING** — Wave 1 pushed and verified earlier in this cycle; Wave 2 pushed at `develop@86890fc7`, all 5 required workflows (CI, Dead Code Detection, Security Scan, Lighthouse CI) green, E2E Tests had one intentional visual-baseline diff (see below) resolved via the `Update Visual Baselines` workflow at `develop@0395dcd6`
- Issue hygiene: 30 Wave 1 + 30 Wave 2 issues were left open past their merge (agents didn't consistently self-close); all 60 were closed retroactively during this report pass, with a comment linking back to the merge

## Wave 1: Before launch (must-fix) — 51 work units, 65 findings

All merged to `develop` and pushed prior to Wave 2 starting. Every issue below is now closed.

| Work unit (branch) | Finding(s) | Issue(s) | Title |
|---|---|---|---|
| `remediate/fe-b1` | FE-B1 | #757 | Re-enable auth bootstrap on /immersive, /favorites, /pricing |
| `remediate/fe-b2` | FE-B2 | #758 | Add real authenticated E2E coverage |
| `remediate/fe-h1` | FE-H1 | #759 | Stop shipping server-only logging to the client bundle |
| `remediate/fe-h2` | FE-H2 | #760 | Story pages get correct metadata and indexability |
| `remediate/fe-h4` | FE-H4, UX-H7 | #762, #893 | Voice agent auth token, prompt forwarding, and a11y |
| `remediate/fe-h3` | FE-H3 | #761 | Stop stealing focus from chat panel on parent re-renders |
| `remediate/fe-m1` | FE-M1 | #763 | Stop re-rendering/re-parsing the full chat on every token (+ a `/simplify`-pass NUL-byte fix commit) |
| `remediate/fe-m5` | FE-M5 | #767 | Delete dead code, enable dead-code gate on develop pushes |
| `remediate/fe-m6` | FE-M6 | #768 | Fix matchMedia hydration mismatch, motion-reduce class on zoom animation |
| `remediate/ux-b1` | UX-B1 | #886 | Pricing page duration copy matches selected tier |
| `remediate/ux-h1` | UX-H1 | #887 | Remaining prompt-chip forwarding gap |
| `remediate/ux-h3` | UX-H3 | #889 | Legal/about pages respect visitor's selected language |
| `remediate/ux-h4` | UX-H4 | #890 | Preserve selected pricing tier across sign-in redirect |
| `remediate/ux-h5` | UX-H5 | #891 | Asturian labels use real translations and respect visitor locale |
| `remediate/ux-h6` | UX-H6 | #892 | Story text respects visitor locale on share, favorites, a11y labels |
| `remediate/be-b1` | BE-B1 | #774 | Translation queue retries forever with no attempt cap |
| `remediate/be-b2` | BE-B2, BE-H2, SE-H4 | #775, #777, #844 | Booking rate limit, timeout reconciliation, premium-rate blocklist |
| `remediate/be-h1` | BE-H1, DO-H6 | #776, #827 | Health probe uses admin client; fix byte-length auth crash |
| `remediate/be-h3` | BE-H3 | #778 | Webhook handlers enforce and consume parsed payload |
| `remediate/be-h4` | BE-H4 | #779 | Validate customer_phone format, don't silently normalize garbage |
| `remediate/be-h5` | BE-H5, SE-M1 | #780, #845 | Cron endpoints require CSRF+Origin on cookie-auth fallback |
| `remediate/be-h6` | BE-H6, AR-H1 | #781, #855 | Port chat safety filter to the live streaming route |
| `remediate/be-m1` | BE-M1, BE-M8 | #782, #789 | MCP rate-limit key and safe error messages |
| `remediate/be-m2` | BE-M2 | #783 | Restore `notify_webhook`'s `search_path = ''` |
| `remediate/be-m3` | BE-M3 | #784 | Declare `maxDuration` for translate webhook queue |
| `remediate/be-m5` | BE-M5, SE-M2 | #786, #846 | Gate Stripe grant on `payment_status` |
| `remediate/be-m7` | BE-M7 | #788 | Embedding cache key includes model and dimension |
| `remediate/be-m10` | BE-M10 | #791 | `pending_bookings` gets full security-guard posture parity |
| `remediate/do-b1` | DO-B1 | #821 | Correct stale observability docs, add Sentry delivery verification script |
| `remediate/do-h1` | DO-H1 | #822 | Remove dead `develop-smoke` CI job that never probes anything |
| `remediate/do-h2` | DO-H2, PE-M3 | #823, #811 | Health probe actively checks Redis, rate-limit call is timeout-bounded |
| `remediate/do-h3` | DO-H3, PE-M6 | #824, #814 | `maintenance_mode` actually gates the app, fails to last-known state |
| `remediate/do-h4` | DO-H4 | #825 | Reconcile `--require-sentry` gate docs with actual CI behavior |
| `remediate/do-h5` | DO-H5 | #826 | Correct incident-runbook commands that fail when executed |
| `remediate/do-m1` | DO-M1 | #828 | Correct rollback docs, harden migration gap-scanner |
| `remediate/do-m2` | DO-M2 | #829 | `vercel-env-safety` fails (not silently passes) without the required secret |
| `remediate/se-h1` | SE-H1, BE-M9 | #841, #790 | `feature_flags.config` no longer anon-readable via PostgREST |
| `remediate/se-h2` | SE-H2 | #842 | Tighten stories RLS policy to match app-layer moderation gate |
| `remediate/se-h3` | SE-H3 | #843 | Revoke blanket anon default-privilege grant, add RLS posture CI check |
| `remediate/ar-h2` | AR-H2, QA-H3 | #856, #870 | Collapse retry layers, thread AbortSignal, fix QA suite parity gap |
| `remediate/ar-h3` | AR-H3 | #857 | Circular-dependency gate now resolves `@/*` alias imports |
| `remediate/qa-h1` | QA-H1 | #868 | Remove tautological favorites E2E assertions |
| `remediate/qa-h2` | QA-H2 | #869 | Add a real chat/RAG pipeline release probe |
| `remediate/qa-m1` | QA-M1 | #872 | Suppress nav-hint via sessionStorage init script instead of dead localStorage seed |
| `remediate/qa-m2` | QA-M2 | #873 | Prelaunch gate refuses a vacuous E2E pass |
| `remediate/qa-m3` | QA-M3 | #874 | Add unit tests, typecheck, and lint to the prelaunch gate |
| `remediate/pe-h1` | PE-H1, UX-H2, FE-M3 | #804, #888, #765 | Correct image preload URL, add `inert` to hidden main |
| `remediate/pe-h2` | PE-H2 | #805 | Avoid maintenance DB lookup before root redirect |
| `remediate/pe-h3` | PE-H3 | #806 | Enforce a real per-route client bundle budget |
| `remediate/pe-h4` | PE-H4 | #807 | Lighthouse gate measures realistic payload on mobile+desktop |
| `remediate/pe-h5` | PE-H5 | #808 | Declare `maxDuration` and bound the chat stream's total timeout |

*(51 branches total; several early-cycle housekeeping commits — dead-code gate wiring, health-endpoint field reconciliation — landed as part of these same merges rather than as separate rows.)*

## Wave 2: After launch — 37 work units, 70 findings

All merged sequentially into `develop` (`161ac6aa..86890fc7`, 98 commits), pushed, plus 2 post-integration fix commits. Every issue below is now closed.

| Work unit (branch) | Finding(s) | Issue(s) | Outcome |
|---|---|---|---|
| `remediate/design-tokens` | UX-M1 | #894 | `bg-neutral-950` on `<body>`; iOS overscroll white-flash fixed. Follow-up #938 filed for the broader 3-color-system consolidation (out of scope). |
| `remediate/ux-author-widget` | UX-L1 | #906 | Author widget social links now visible on `:focus-within`, not just hover; extracted shared `SOCIAL_LINK_CLASSNAME`. Follow-up #939 filed for the same gap in `story-card.tsx`/`related-stories.tsx`. |
| `remediate/ux-nav-hint-blocking` | UX-M9 | #902 | Overlay is `pointer-events-none`; dismissal via passive `window` listeners that don't block the tap underneath. |
| `remediate/coverage-thresholds` | QA-L1 | #880 | Vitest thresholds raised to match measured coverage with a ~2pt buffer. |
| `remediate/e2e-wait-timeouts` | QA-M8 | #879 | 7 of 8 oversized per-wait timeouts trimmed; 1 given its own `test.setTimeout`. `retries: 2` confirmed deliberate (git-blame), left unchanged. |
| `remediate/migration-search-path-coverage` | QA-M5 | #876 | Hardcoded 3-function allowlist replaced with a generic scanner over all `CREATE FUNCTION` headers across all migrations; all 26 SECURITY DEFINER functions confirmed compliant. |
| `remediate/meta-test-invariants` | QA-M4 | #875 | New meta-tests enforce the admin-guard and RPC-name invariants across the whole tree; both held clean against current code. |
| `remediate/knip-license-config` | AR-L2 | #864 | Root-caused as Knip misparsing CI license-checker denylist args as binaries; 11 dead `ignoreBinaries` entries removed. |
| `remediate/admin-panel-decomposition` | AR-M4 | #861 | Decomposed the 2 largest un-migrated admin panels (stripe-, visitors-analytics) into the established convention. Follow-up #940 filed for the remaining 9 siblings. |
| `remediate/security-checklist-dedup` | SE-L5 | #853 | Gate 1 rewritten to reflect that Gitleaks is CI-automated, not manual; "6 manual gates" phrasing corrected repo-wide to "5 manual, 1 CI-verified". |
| `remediate/license-policy-allowlist` | SE-M3 | #847 | Denylist replaced with a true SPDX-exact-match allowlist (`scripts/check-production-licenses.ts`) — closes the `--onlyAllow` substring-match footgun; `@sentry/cli`'s `FSL-1.1-MIT` now an explicit, verified exception. |
| `remediate/sms-retry-dead-letter` | BE-M11 | #792 | New migration adds a `'dead'` terminal status; cron route now reports `dead_letter_count`, matching the existing `fail-stale-translations` alert pattern. |
| `remediate/cors-test-origin-guard` | SE-L3 | #851 | `PLAYWRIGHT_TEST_ORIGIN` now gated on `VERCEL_ENV` being unset (reuses the existing BE-M5 local-only pattern). |
| `remediate/sentry-scrubbing` | SE-L4 | #852 | `request.url` reduced to path-only, `query_string` deleted, `user.ip_address` nulled. |
| `remediate/sentry-client-dsn-gate` | PE-L4 | #818 | Client SDK init now DSN-gated via dynamic import. Bundle savings not fully realized — 5 error-boundary files import `@sentry/nextjs` independently; follow-up #941 filed. |
| `remediate/ci-path-filtering` | DO-M7 | #834 | `paths-ignore` added to `ci.yml`/`e2e.yml`/`lighthouse.yml` on `push` only (kept unfiltered on `pull_request`, which carries required status checks). |
| `remediate/mcp-cache-control` | BE-L6 | #799 | `public` → `private` on both GET/POST Cache-Control headers. `/simplify` findings (redundant test assertion, comment dedup) applied manually; altitude finding (identical bug in `mcp/weather/route.ts`) filed as follow-up #942. |
| `remediate/error-boundary-retry` | FE-L1 | #770 | Retry now forces an actual remount via an internal `retryKey` on a wrapping `<Fragment>`, not just a state flip. |
| `remediate/immersive-payload-size` | PE-M5 | #813 | Per the issue's own recommendation (S-effort instrumentation, not L-effort windowing), added gzip-size logging with a documented threshold rather than restructuring data loading. |
| `remediate/markdown-sse-memoization` | PE-M4 | #812 | SSE text chunks now buffer and flush at most once per animation frame (RAF), bounding re-parses to paint frequency; synchronous flush on `"done"` preserves upsell-detection correctness. |
| *(no branch — already fixed)* | PE-M1 | #809 | Found already resolved by Wave 1's FE-H2 (#760) — the proxy rewrite/redirect this finding depended on no longer exists. Verified via build (71 real prerendered pages) and closed with evidence, no new commit needed. |
| `remediate/server-only-guard` | AR-M5 | #862 | 12 modules guarded (not the estimated 8) — 4 named in the issue + 8 more found via `process.env.<SECRET>` grep. `npm run build` (the real test) passed clean. |
| `remediate/admin-auth-abstractions` | AR-M2 | #859 | *(part of the earlier contention-incident batch; consolidated marketing/suggestions routes onto the RLS-scoped auth wrapper)* |
| `remediate/admin-route-timeouts` | — | — | *(duration-budget follow-through on 3 admin analytics/approve-all routes)* |
| `remediate/claude-transport` | AR-M3 | #860, #794, #785 | Production Claude transport now exercised the same way dev/CI does; `ANTHROPIC_TRANSPORT` override added. |
| `remediate/embedding-search-cache` | PE-M2, PE-L5 | #810, #819 | Retrieval/rerank/image-lookup caching added; embedding cache key normalizes query text before hashing. |
| `remediate/error-boundaries` | UX-M4 | #897 | 4 error-boundary treatments converged via shared `error-boundary-styles.ts`, preserving the deliberate glass-vs-solid split. |
| `remediate/health-env-admin-auth-observability` | QA-L3, AR-L3, AR-M1, SE-L2, DO-M4, PE-L3, BE-M6 | #882, #865, #858, #850, #831, #817, #787 | Health endpoint now probes the paid-access table; `SUPABASE_SERVICE_ROLE_KEY` duplicate alias removed; 595 stale finding-ID comments cleaned; boot-time env validation added. |
| `remediate/lint-warning-ceiling` | AR-L1 | #863 | `lint:src` now runs with `--max-warnings=0`, matching `lint:scripts`. |
| `remediate/ops-docs-secrets` | DO-M3 | #830 | New `docs/operations/secret-inventory.md` + `scripts/check-secret-inventory.ts` CI gate. |
| `remediate/payments-duration-budget` | DO-M6 | #833 | `maxDuration` declared on checkout and content-discovery cron routes. |
| `remediate/rate-limit-coverage` | QA-M6, BE-L5, BE-S2 | #877, #798, #803 | Rate-limit call moved inside the chat route's timeout discipline; IPv6 bucketing fixed (`/64` normalization); coverage extended to previously-unprotected routes. |
| `remediate/share-and-code-splitting` | FE-M2, FE-M7, FE-L2 | #764, #769, #771 | `StoryInfoPanel` memoization fixed; heaviest admin panel + suggest-place dialog code-split; share-URL construction deduped into `use-share-story.ts`. |
| `remediate/stripe-webhook-idempotency` | QA-H4, QA-L4 | #871, #883 | Live-Postgres integration tests now exercise the idempotency/concurrency/RLS guarantees that previously lived untested in Postgres functions. |
| `remediate/toolbar-locale-a11y` | UX-M3, UX-M10 | #896, #903 | 3 toolbar dropdowns converged on one ARIA/focus pattern; stale hardcoded locale-coverage constant replaced with build-time codegen (also fixed a real bundle-size regression the unit's own `/simplify` pass found but hadn't applied). |
| `remediate/ux-payment-voice-pages` | UX-L2, UX-M12, UX-M11, UX-M8, UX-M7, UX-M5, UX-M2 | #907, #905, #904, #901, #900, #898, #895 | Favorites gets an announced undo affordance + sign-in button on the empty state; pricing tier selector behaves like a real radiogroup; `toIntlLocale()` helper for locale-aware timestamps; orphaned `/pricing/success` + `/api/checkout/day-pass` deleted (zero callers, confirmed via Vercel runtime logs); sign-in modal gets a focus trap. |
| `remediate/voice-auth` | BE-M12 | #793, #878 | Bearer-token clients can now use the voice endpoints; new browser-level E2E coverage for the voice flow. |

### Post-integration fixes (found only once all 36 branches were merged together)

Two commits landed after the sequential merge, addressing issues invisible to any single branch's isolated review:

1. **`3a831ab4`** — `docs/operations/secret-inventory.md` still documented a `SUPABASE_SERVICE_ROLE_KEY` alias that `health-env-admin-auth-observability` (#865) had independently removed from `.env.example` in the same merge. Caught by `npm run check-secret-inventory`.
2. **`86890fc7`**'s follow-up commit — a dedicated cross-branch integration review (scoped explicitly to *interaction* bugs, not re-reviewing each branch's already-reviewed code) found and fixed 4 more: a dead E2E test still targeting the deleted `day-pass` route, a stale exact-string assertion in `check-verification-coverage.ts` left behind by the lint-warning-ceiling fix, two sets of undocumented env vars (`ANTHROPIC_TRANSPORT`, `SUPABASE_LOCAL_API_URL`/`SUPABASE_LOCAL_SERVICE_ROLE_KEY`), and two stale doc references to the removed `day-pass`/`pricing/success` routes. Filed #943 for pre-existing (non-Wave-2) emoji-policy violations noticed incidentally in `testbed.md`.

One CI-caught issue after push: `E2E Tests` failed on a single visual-regression snapshot (`favorites-empty.png`, mobile) — an **intentional** diff, since `ux-payment-voice-pages` added a sign-in button to that empty state. Resolved via the project's `Update Visual Baselines` GitHub Actions workflow (`develop@0395dcd6`).

## Wave 3: Later / strategic (filed, not fixed) — 19 issues

Per Rule #58's one documented exception: low and strategic-severity findings require human architectural judgment AI agents cannot reliably provide. All 19 remain open, correctly triaged, awaiting prioritization.

| Issue | Finding | Title |
|---|---|---|
| #766 | FE-M4 | Five bespoke client-side data/cache layers, several with disabled dependency linting |
| #772 | FE-L3 | `useStoryKeyboardNav` registers the same handler twice and re-registers on every navigation |
| #773 | FE-S1 | Auth and locale are resolved entirely client-side, which is the root cause behind several findings |
| #797 | BE-L4 | `grant_day_pass_idempotent`'s atomicity "invariant" is a no-op sub-block |
| #801 | BE-L8 | Dev-only `child_process` routes ship in the production bundle behind runtime env checks |
| #802 | BE-S1 | The translation queue's worker is the enqueuer, invoked synchronously over HTTP |
| #820 | PE-S1 | 233KB gzip of JavaScript on pages that are pure static content |
| #837 | DO-L2 | Presence checks and value reads disagree on trimming for the same variable |
| #838 | DO-S1 | The audit-remediation loop closes findings on artefacts delivered, not on controls verified operational |
| #839 | DO-S2 | The backup and restore path has never been rehearsed |
| #840 | DO-S3 | The single-operator risk acceptance has no instrumented re-evaluation trigger |
| #849 | SE-L1 | SSRF guard on remote image import is resolve-then-fetch (DNS rebinding window) |
| #854 | SE-S1 | Data-layer authorization has no automated regression coverage |
| #866 | AR-S1 | The test suite is 2.4x the size of the source it covers, concentrated in a few very large files |
| #867 | AR-S2 | `noUncheckedIndexedAccess` is off, so array and record indexing is unsoundly typed |
| #884 | QA-L5 | Isolated low-coverage islands in visitor-facing responsive and animation code |
| #885 | QA-S1 | The verification strategy has depth everywhere except at the boundaries that actually fail |
| #909 | UX-L4 | Component reuse is thin: raw `<button>` outnumbers `<Button>` 42:15, `SiteFooter`/`ui/card` are dead |
| #910 | UX-S1 | The multilingual promise is architecturally half-built |

## Follow-up issues filed during remediation (out-of-scope findings surfaced along the way)

| Issue | Origin | Summary |
|---|---|---|
| #938 | design-tokens | Broader 3-parallel-color-system consolidation |
| #939 | ux-author-widget | Missing focus-within pattern in `story-card.tsx`/`related-stories.tsx` |
| #940 | admin-panel-decomposition | Remaining 9 un-decomposed admin panel siblings |
| #941 | sentry-client-dsn-gate | 5 error-boundary files import `@sentry/nextjs` independently, undoing the DSN gate's bundle savings |
| #942 | mcp-cache-control | `mcp/weather/route.ts` has the identical public-cache-on-authenticated-response bug |
| #943 | integration review | Pre-existing emoji-policy violations in `testbed.md` (37 instances, unrelated to Wave 2) |

## Final Verification

- [x] Wave 1 merged, CI green (pushed earlier in this cycle)
- [x] Wave 2 merged, CI green (`develop@86890fc7`, then `develop@0395dcd6` for the visual-baseline fix)
- [x] Wave 3 issues filed in the backlog (19, all open)
- [x] Cross-branch integration review complete (2 fix commits, 6 follow-up issues filed)
- [x] All 51 Wave 1 + 36 Wave 2 worktrees and `remediate/*` branches removed
- [x] Issue hygiene: all 60 Wave 1/Wave 2 issues left open past merge retroactively closed

## Deviations from the standard `/remediate` flow

- Per standing user instruction ("never push partial work; one push from develop at the end of the work"), Wave 2's 36 branches were merged and verified locally, then pushed as a single commit range rather than per-branch.
- Two dead/orphaned routes (`/api/checkout/day-pass`, `/pricing/success`) were deleted by `ux-payment-voice-pages` (#898) as part of its fix; two other Wave 2 branches (`payments-duration-budget`, `rate-limit-coverage`) had independently modified the same soon-to-be-deleted files, producing modify/delete merge conflicts — resolved by keeping the deletion (confirmed dead via grep + Vercel runtime-log check) in both cases.
- Several `/simplify` review sub-agents self-executed fixes despite being scoped read-only (a recurring, pre-documented pattern — see project memory `feedback_fork_scope_creep.md`); each was independently re-verified (fresh typecheck/lint/full-suite run) before being trusted, per this cycle's standing practice.
- This session hit two brief cross-session worktree-contention incidents (shared machine, 50+ concurrent Claude sessions) that deleted a handful of in-progress agent worktrees before any commits landed; zero work was lost in either case (confirmed via `git log`/`git branch`), and affected units were relaunched successfully on retry.
