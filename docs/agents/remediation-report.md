# Remediation Report
> Generated on 2026-05-03 | Branch: `develop` | 48 findings processed
>
> Pre-launch report: `docs/agents/pre-launch-report.md`

## Summary

- Findings processed: 48 (Wave 1: 35, Wave 2: 10, Wave 3: 3)
- Issues created/reused: 48
- Issues resolved locally: 35 (Wave 1 merged to local `develop`)
- Issues filed only: 3 (Wave 3)
- Wave 2 status: deferred per `/remediate` gate after Wave 1
- CI status: pending remote push/CI

## Wave 1: Before launch (must-fix)

| # | Finding ID | Title | Severity | Tests Added | Branch | Status |
|---|---|---|---|---|---|---|
| 1 | SE-B1 | Default anon/authenticated SELECT grants expose operational tables with SMS PII | launch-blocker | Yes | `remediate/db-security` | Merged locally |
| 2 | DO-H2 | Database migrations are not applied in CI | high | Yes | `remediate/db-security` | Merged locally |
| 3 | SE-M3 | Marketing credential encryption is not enforced | medium | Yes | `remediate/db-security` | Merged locally |
| 4 | SE-H1 | Admin image URL ingestion has SSRF bypass paths | high | Yes | `remediate/admin-image-ssrf` | Merged locally |
| 5 | BE-H1 | Session-scoped advisory locks are used through pooled RPC calls | high | Yes | `remediate/voice-booking` | Merged locally |
| 6 | BE-H2 | SMS outbox has no independent retry worker | high | Yes | `remediate/voice-booking` | Merged locally |
| 7 | QA-H1 | Booking SMS failures have no autonomous retry runner | high | Yes | `remediate/voice-booking` | Merged locally |
| 8 | QA-H2 | Successful booking calls can be orphaned | high | Yes | `remediate/voice-booking` | Merged locally |
| 9 | BE-M1 | Failed ElevenLabs initiation leaves idempotency stuck | medium | Yes | `remediate/voice-booking` | Merged locally |
| 10 | UX-H1 | Nested main landmarks break page structure | high | Yes | `remediate/ux-a11y` | Merged locally |
| 11 | UX-H2 | Collapsed filter popover leaves hidden controls keyboard-reachable | high | Yes | `remediate/ux-a11y` | Merged locally |
| 12 | UX-H3 | Favorites cards hide information/removal behind hover | high | Yes | `remediate/ux-a11y` | Merged locally |
| 13 | UX-H4 | Paid voice funnel drops intent during sign-in | high | Yes | `remediate/ux-a11y` | Merged locally |
| 14 | UX-M2 | Missing focus indicators on public actions | medium | Yes | `remediate/ux-a11y` | Merged locally |
| 15 | UX-M3 | Interactive progress segments inside progressbar | medium | Yes | `remediate/ux-a11y` | Merged locally |
| 16 | UX-M4 | Spanish public copy needs editorial pass | medium | Yes | `remediate/ux-a11y` | Merged locally |
| 17 | UX-M5 | Loading states expose motion-only/textless feedback | medium | Yes | `remediate/ux-a11y` | Merged locally |
| 18 | AR-H1 | Story `source_type` contract is split | high | Yes | `remediate/admin-story-workflow` | Merged locally |
| 19 | FE-H1 | Admin stories pagination loses the active tab | high | Yes | `remediate/admin-story-workflow` | Merged locally |
| 20 | PE-H1 | Public pages do global auth and flag startup work | high | Yes | `remediate/public-startup` | Merged locally |
| 21 | FE-M2 | Global providers still perform deferred side effects | medium | Yes | `remediate/public-startup` | Merged locally |
| 22 | FE-M3 | Query-param reads sit in broad route shells | medium | Yes | `remediate/public-startup` | Merged locally |
| 23 | FE-M4 | Immersive deep-link handling ignores later URL changes | medium | Yes | `remediate/public-startup` | Merged locally |
| 24 | PE-H2 | Chat p99 is gated by unbounded third-party stages | high | Yes | `remediate/chat-reliability` | Merged locally |
| 25 | AR-M2 | Chat behavior duplicated across endpoints | medium | Yes | `remediate/chat-reliability` | Merged locally |
| 26 | SE-M1 | Production rate limiting falls back to memory | medium | Yes | `remediate/chat-reliability` | Merged locally |
| 27 | FE-M1 | Chat analytics use wrong PostHog context | medium | Yes | `remediate/chat-reliability` | Merged locally |
| 28 | DO-H1 | Production error tracking can be silently disabled | high | Yes | `remediate/ops-readiness` | Merged locally |
| 29 | DO-M1 | Health runbooks contradict implementation | medium | Docs/tests | `remediate/ops-readiness` | Merged locally |
| 30 | DO-M2 | Public DB diagnostics endpoint exposes error detail | medium | Yes | `remediate/ops-readiness` | Merged locally |
| 31 | DO-M4 | Branch protection docs conflict | medium | Docs | `remediate/ops-readiness` | Merged locally |
| 32 | PE-M1 | Immersive hydrates and persists full story catalog | medium | Yes | `remediate/immersive-payload` | Merged locally |
| 33 | AR-M1 | Operational scripts excluded from gates | medium | Yes | `remediate/verification-coverage` | Merged locally |
| 34 | QA-M1 | Non-src operational code outside gates | medium | Yes | `remediate/verification-coverage` | Merged locally |
| 35 | QA-M2 | Live integration coverage skips critical happy paths | medium | Config/tests | `remediate/verification-coverage` | Merged locally |

## Wave 2: After launch

| # | Finding ID | Title | Severity | Status |
|---|---|---|---|---|
| 1 | AR-M3 | Supabase access is not typed at the DB boundary | medium | Deferred |
| 2 | FE-M5 | Feature-flagged tools are statically imported | medium | Deferred |
| 3 | BE-M2 | Request validation is inconsistent | medium | Deferred |
| 4 | BE-M3 | Stripe webhook audit insert mismatches table | medium | Deferred |
| 5 | BE-M4 | Story conversion from suggestion is not atomic | medium | Deferred |
| 6 | PE-M2 | Story metadata generation does full-row N+1 work | medium | Deferred |
| 7 | PE-M3 | MCP POST calls bypass GET cache strategy | medium | Deferred |
| 8 | DO-M3 | Request IDs not bound into server log context | medium | Deferred |
| 9 | SE-M2 | MCP POST routes bypass GET validation schemas | medium | Deferred |
| 10 | UX-M1 | Design-system signals are fragmented | medium | Deferred |

## Wave 3: Later / strategic (filed, not fixed)

| # | Finding ID | Title | Severity | Issue | Rationale |
|---|---|---|---|---|---|
| 1 | PE-L1 | UI unused export checks have blind spots | low | #575 | Filed only per Wave 3 rule |
| 2 | SE-L1 | License policy misses weak-copyleft dev exceptions | low | #576 | Filed only per Wave 3 rule |
| 3 | AR-S1 | Route handlers still act as service layer | strategic | #577 | Filed only per Wave 3 rule |

## Final Verification

- [x] Wave 1 merged locally to `develop`
- [x] `npm run check-migrations`
- [x] `npm run check-verification-coverage`
- [x] `npm run test` - 352 files, 6482 tests passed
- [x] `npm run typecheck`
- [x] `npm run lint`
- [x] `npm run build`
- [ ] Remote push completed
- [ ] CI green on remote
- [ ] Wave 2 merged or explicitly deferred
- [x] Wave 3 issues filed in backlog
- [ ] Remediate worktrees and branches removed after push/CI

## Deferred Items

Wave 2 remains deferred until the user explicitly asks to continue with `/remediate wave=2`. Wave 3 is issue-only by workflow design.

## Notes

- No Vercel deploy commands were run.
- No partial branch pushes were performed.
- Local worker commits were merged into `develop`; remote push is intentionally held until final local verification is complete.
- Local shell reports Node `v23.9.0` while the project declares `>=24.0.0`; verification still passed locally.
