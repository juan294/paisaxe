# Remediation Report
> Generated on 2026-06-13 | Branch: `develop` | 35 findings processed
>
> Pre-launch report: `docs/agents/pre-launch-report.md`

## Summary

- Findings processed: 35 (Wave 1: 24, Wave 2: 10, Wave 3: 1)
- Issues created: 35 (#600-#634)
- Issues resolved locally: 24 Wave 1 findings merged into `develop`
- Issues filed only: 11 (Wave 2: 10, Wave 3: 1)
- Files modified in Wave 1: 59
- CI status: pending push

## Wave 1: Before launch (must-fix)

| # | Finding ID | Title | Severity | Issue | Status |
|---|------------|-------|----------|-------|--------|
| 1 | FE-H1 | Global shell ships large first-load JavaScript to every route | high | #600 | Merged locally |
| 2 | FE-H2 | Voice mute controls only change UI state, not microphone state | high | #601 | Merged locally |
| 3 | FE-M1 | Favorite optimistic updates persist after failed HTTP responses | medium | #602 | Merged locally |
| 4 | FE-M2 | Admin tab routing trusts arbitrary query values | medium | #603 | Merged locally |
| 5 | BE-B1 | Migration 091/092 reference a dropped RPC signature | launch-blocker | #604 | Merged locally |
| 6 | BE-H1 | Booking idempotency blocks legitimate retries | high | #605 | Merged locally |
| 7 | BE-M1 | Stripe webhook audit insert does not match table schema | medium | #606 | Merged locally |
| 8 | BE-M2 | MCP POST tools bypass shared query schemas | medium | #607 | Merged locally |
| 9 | BE-M3 | Translation writes can lose concurrent metadata updates | medium | #608 | Merged locally |
| 10 | BE-M4 | Remote image fetch has SSRF/resource-boundary gaps | medium | #609 | Merged locally |
| 11 | BE-M5 | Security-definer translation functions keep public in search_path | medium | #610 | Merged locally |
| 12 | PE-H1 | Public immersive rendering waits on an uncapped feature-flag fetch | high | #611 | Merged locally |
| 13 | PE-M1 | Root client providers ship Supabase auth code to every route | medium | #612 | Merged locally |
| 14 | PE-M2 | Legacy `/api/chat` lacks streaming chat stage timeouts | medium | #613 | Merged locally |
| 15 | PE-L1 | `build:analyze` does not produce bundle analyzer output | low | #616 | Merged locally |
| 16 | DO-H1 | Main branch approval protection is not enforced | high | #617 | Fixed live |
| 17 | DO-H2 | Dependency health degradation is not clearly automated as an alert | high | #618 | Merged locally |
| 18 | SE-M1 | Admin remote image fetch has SSRF TOCTOU and unbounded body-read risk | medium | #621 | Merged locally |
| 19 | SE-M2 | MCP POST routes bypass bounded schemas | medium | #622 | Merged locally |
| 20 | QA-H1 | Booking can return success after an outbound call with no provider correlation ID | high | #628 | Merged locally |
| 21 | QA-M1 | Local pre-launch gate does not exercise all release-critical checks | medium | #629 | Merged locally |
| 22 | QA-M2 | API smoke coverage accepts degraded health | medium | #630 | Merged locally |
| 23 | UX-H1 | Hidden story info panel remains interactive and focusable | high | #632 | Merged locally |
| 24 | UX-M1 | Pricing page Suspense fallback can render a blank conversion path | medium | #633 | Merged locally |

## Wave 2: After launch

| # | Finding ID | Title | Severity | Issue | Status |
|---|------------|-------|----------|-------|--------|
| 1 | PE-M3 | MCP POST endpoints bypass GET cache strategy | medium | #614 | Filed, not fixed in Wave 1 |
| 2 | PE-M4 | Story navigation does not prefetch adjacent images | medium | #615 | Filed, not fixed in Wave 1 |
| 3 | DO-M1 | Request IDs are not consistently bound into application logs | medium | #619 | Filed, not fixed in Wave 1 |
| 4 | DO-L1 | Operations cron documentation has schedule drift | low | #620 | Filed, not fixed in Wave 1 |
| 5 | SE-L1 | Weak-copyleft dependency exceptions are incomplete | low | #623 | Filed, not fixed in Wave 1 |
| 6 | AR-M1 | Dead-code detection does not cover all executable surfaces | medium | #624 | Filed, not fixed in Wave 1 |
| 7 | AR-M2 | Operational route handlers carry service-layer responsibilities | medium | #625 | Filed, not fixed in Wave 1 |
| 8 | AR-M3 | Admin authorization wrapper usage is inconsistent | medium | #626 | Filed, not fixed in Wave 1 |
| 9 | QA-M3 | Chat SSE has no idle/global timeout while Claude streams | medium | #631 | Filed, not fixed in Wave 1 |
| 10 | UX-M2 | Story panel click-to-hide makes text reading fragile | medium | #634 | Filed, not fixed in Wave 1 |

## Wave 3: Later / strategic (filed, not fixed)

| # | Finding ID | Title | Severity | Issue | Rationale |
|---|------------|-------|----------|-------|-----------|
| 1 | AR-S1 | Core retrieval SDK is materially behind latest | strategic | #627 | Strategic provider upgrade; filed for explicit later scheduling. |

## Final Verification

- [x] Wave 1 merged locally into `develop`
- [x] Branch protection remediated live for `main` (`required_approving_review_count = 1`)
- [x] `npm run check-migrations`
- [x] `npm run check-verification-coverage`
- [x] `npm run typecheck`
- [x] `npm run lint`
- [x] `npm run test` (360 files, 6647 tests)
- [x] `npm run build`
- [x] `/simplify` integrated pass completed with no code changes needed
- [ ] Wave 1 pushed and CI green
- [ ] Wave 2 merged, CI green
- [x] Wave 3 issue filed in backlog
- [ ] Worktrees and remediation branches removed

## Deferred Items

Wave 2 and Wave 3 remain deferred until Wave 1 is pushed and CI is green. The next remediation command should resume with Wave 2.
