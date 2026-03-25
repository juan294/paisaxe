# Remediation Report
> Generated on 2026-03-24 | Branch: `develop` | 10 issues resolved
>
> Pre-launch report: `docs/agents/pre-launch-report.md` (2026-03-23)

## Summary
- Findings processed: 15 (+ 7 deferred architectural items)
- Issues created: 10 (#207–#216)
- Issues resolved: 10/10
- Tests added: 24+ new tests across 5 new test files
- Files modified: 35+
- CI status: **ALL PASSING** (CI, E2E, Lighthouse, Security Scan)

## Issues Resolved

| # | Issue | Domain | Severity | Tests Added | Status |
|---|-------|--------|----------|-------------|--------|
| #207 | Document 6 missing env vars | infra | Medium | 0 (docs) | Closed |
| #208 | Admin date input focus indicators | a11y | Medium | 5 | Closed |
| #209 | Admin heading hierarchy + focus-visible styles | a11y | Low | 11 | Closed |
| #210 | i18n aria-label in question-prompts | a11y | Low | 1 | Closed |
| #211 | Remove dead ANTHROPIC_ADMIN_API_KEY reference | infra | Low | 2 | Closed |
| #212 | Suppress prerender fetch warnings | perf | Low | 11 | Closed |
| #213 | Add pricing loading skeleton | perf | Low | 0 (UI) | Closed |
| #214 | Footer text sizing (10px → 12px) | a11y | Low | 1 | Closed |
| #215 | Coverage thresholds + browserslist config | infra | Low | 0 (config) | Closed |
| #216 | Main landmark element for skip-link | a11y | Low | 2 | Closed |

## Changes by Domain

### Infrastructure (3 issues)
- **#207**: Added `MCP_API_SECRET`, `POSTHOG_PROJECT_ID`, `POSTHOG_PERSONAL_API_KEY`, `ELEVENLABS_PHONE_NUMBER_ID`, `ELEVENLABS_BOOKING_AGENT_ID`, `ALLOW_AGENT_RUN` to `.env.example` and `CLAUDE.md`
- **#211**: Removed dead `ANTHROPIC_ADMIN_API_KEY` references from `src/lib/costs/anthropic-costs.ts` — functions now return `null`/`[]` stubs with clear documentation
- **#215**: Added coverage thresholds (95/90/95/95%) to `vitest.config.ts` and `browserslist` to `package.json`

### Accessibility (5 issues)
- **#208**: Added `focus-visible:ring-1 focus-visible:ring-white/40` to 10 admin date inputs across 5 analytics panels
- **#209**: Changed 5 admin sub-panel h1 → h2, converted ~15 admin `focus:` patterns to `focus-visible:`, fixed checkout breadcrumb h1 → span
- **#210**: Replaced hardcoded `aria-label="Preguntas sugeridas"` with `t("accessibility.suggested_questions")` — key already existed in all 6 locales
- **#214**: Increased footer text from `text-[10px]` to `text-xs` (12px) for WCAG compliance
- **#216**: Changed `<div id="main-content">` to `<main id="main-content">` for screen reader landmark navigation

### Performance (2 issues)
- **#212**: Added `isBuildPhase()` guard to suppress ~130 prerender fetch warnings during `next build`; runtime warnings preserved
- **#213**: Created `src/app/pricing/loading.tsx` skeleton matching pricing page layout

## Final Verification
- [x] All tests passing (5,586 tests, 302 suites)
- [x] Typecheck clean
- [x] Lint clean
- [x] CI green (all 4 workflows: CI, E2E, Lighthouse, Security Scan)
- [x] All worktrees removed
- [x] All remediate branches deleted
- [x] All 10 issues closed

## Deferred Items
| Finding | Reason |
|---------|--------|
| 8 large files > 500 lines | Architectural — needs dedicated refactoring plan |
| 4 major dep bumps (vercel/analytics v2, speed-insights v2, vitejs/plugin-react v6, knip v6) | Risky — needs dedicated testing per package |
| 46 commits ahead of `main` | User-initiated release process |
| CSP `unsafe-inline` | Documented intentional design (PPR incompatibility) |
| In-memory rate limit fallback | Working as designed with Upstash fallback |
| 119 "use client" components | Needs server-side i18n architecture redesign |
| No centralized API route wrapper | Major refactoring — 449 call sites across 68 files |
