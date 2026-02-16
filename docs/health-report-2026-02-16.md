# Codebase Health Report

> Generated: 2026-02-16 | Branch: `develop` | Commit: `b9ebac5`

## Executive Summary

**Overall: HEALTHY** — The codebase is in excellent shape. All tests pass, CI is green, production is stable, and code quality is spotless. The only areas for improvement are test coverage gaps in admin components and a handful of minor/patch dependency updates.

| Area | Status | Score |
|------|--------|-------|
| Test Health | PASS | 100% pass rate, 88.3% coverage |
| Code Quality | PASS | Zero lint/type errors, zero dead code |
| CI & Deploy | PASS | All workflows green, production healthy |
| Dependency Health | PASS | No critical vulns, lockfile clean |

---

## Test Health

### Summary
- **Total test files:** 274
- **Total tests:** 4,253
- **Pass rate:** 100%
- **Duration:** 33.54s
- **Overall coverage:** 88.3% statements | 80.2% branches | 85.3% functions | 89.3% lines

### Flaky Tests
None detected. All 274 test files passed on the first run with zero failures.

### Coverage by Module

| Module | Stmts | Branch | Funcs | Lines |
|--------|-------|--------|-------|-------|
| src/lib/ | 98.1% | 89.1% | 98.9% | 98.5% |
| src/hooks/ | 97.7% | 90.5% | 100% | 98.5% |
| src/config/ | 100% | 75.0% | 100% | 100% |
| src/types/ | 100% | 90.4% | 100% | 100% |
| src/components/ui/ | 98.9% | 90.0% | 96.7% | 100% |
| src/components/auth/ | 100% | 91.4% | 100% | 100% |
| src/components/immersive/ | 92.9% | 86.7% | 95.1% | 95.3% |
| src/components/premium/ | 100% | 100% | 100% | 100% |
| **src/components/admin/** | **74.9%** | **72.0%** | **72.8%** | **76.6%** |
| -- marketing-dashboard/ | 54.0% | 50.3% | 55.9% | 56.3% |
| -- story-editor-dialog/ | 79.2% | 68.5% | 42.0% | 80.6% |
| -- agents-dashboard/ | 76.4% | 59.3% | 67.1% | 78.9% |
| src/app/admin/ | 57.6% | 47.8% | 60.0% | 57.3% |

### Coverage Gaps (Recently Changed Files at 0%)

| File | Notes |
|------|-------|
| `src/app/immersive/page.tsx` | Main immersive page |
| `src/components/admin/story-translations-tab.tsx` | Translation management |
| `src/components/admin/tunnel-control-panel.tsx` | Dev tunnel control |
| `src/components/admin/agents-dashboard/terminal-display.tsx` | Terminal UI |
| `src/components/admin/marketing-dashboard/account-config-dialog.tsx` | Account config |
| `src/components/admin/marketing-dashboard/create-draft-dialog.tsx` | Draft creation |
| `src/components/admin/story-editor-dialog/details-tab.tsx` | Story details |
| `src/components/admin/story-editor-dialog/image-editor-context.tsx` | Image editing |
| `src/components/admin/story-editor-dialog/image-tab.tsx` | Image management |

These are mostly UI component splits from recent refactors. They are partially covered indirectly through parent component tests but lack direct unit tests.

---

## Code Quality

### Lint & TypeScript
- **ESLint errors:** 0
- **ESLint warnings:** 0
- **TypeScript errors:** 0

### TODO/FIXME/HACK Comments
None found in source files.

### Dead Code (Knip)
Clean — no unused exports, files, or dependencies.

### `any` Type Usage
- **Count:** 1
- `src/components/immersive/fullscreen-button.tsx:33` — `(navigator as any).standalone` — justified, Safari-only non-standard API with no TypeScript type.

---

## CI & Deploy Health

### CI Runs (develop)

| Date | Workflow | Status |
|------|----------|--------|
| 2026-02-16 | Security Scan | Pass |
| 2026-02-16 | Lighthouse CI | Pass |
| 2026-02-16 | E2E Tests | Pass |
| 2026-02-16 | CI (lint, typecheck, test, build) | Pass |

### CI Runs (main)

| Date | Workflow | Status |
|------|----------|--------|
| 2026-02-16 | Dependabot (github_actions) | Pass |
| 2026-02-16 | Dependabot (npm_and_yarn) | Pass |
| 2026-02-13 | Security Scan | Pass |

### Production Health
- **Health endpoint:** Healthy (status: `healthy`, v1.0.0)
- **Database:** 38.9 MB / 8,192 MB (0.5% usage)
- **Supabase latency:** 524ms (acceptable)
- **Latest deployment:** Ready

### Cron Jobs

| Path | Schedule | Status |
|------|----------|--------|
| `/api/cron/github-traffic-sync` | Every 6 hours | Configured |
| `/api/cron/content-discovery` | Weekly Mon 3am | Configured |
| `/api/cron/subscription-optimizer` | Weekly Mon 4am | Configured |

---

## Dependency Health

### Outdated Dependencies

#### Minor Updates
| Package | Current | Latest |
|---------|---------|--------|
| `posthog-js` | 1.343.2 | 1.347.2 |

#### Patch Updates
| Package | Current | Latest |
|---------|---------|--------|
| `@typescript-eslint/eslint-plugin` | 8.54.0 | 8.55.0 |
| `dotenv` | 17.2.4 | 17.3.1 |
| `jsdom` | 28.0.0 | 28.1.0 |
| `lucide-react` | 0.563.0 | 0.564.0 |
| `tailwind-merge` | 3.4.0 | 3.4.1 |

No major (breaking) updates needed.

### Security Vulnerabilities

| Severity | Count | Details |
|----------|-------|---------|
| Critical | 0 | — |
| High | 0 | — |
| Moderate | 0 | — |
| Low | 2 | `qs` 6.7.0-6.14.1 via `voyageai` — no upstream fix available |

### Lockfile Integrity
Healthy — `npm ci --dry-run` succeeds, lockfile in sync.

### License Compliance
All permissive (MIT, Apache-2.0, BSD, ISC). MPL-2.0 in `@vercel/analytics` and `lightningcss` (weak copyleft, no compliance risk). LGPL-3.0 in `sharp` native binary (dynamic linking, no obligation). No GPL or AGPL.

---

## Recommended Actions

### Priority 1 — Quick Wins (automated)
1. **Update minor/patch dependencies** — `posthog-js`, `lucide-react`, `tailwind-merge`, `dotenv`, `@typescript-eslint/eslint-plugin`, `jsdom`

### Priority 2 — Coverage Improvements (manual)
2. **Add tests for admin marketing-dashboard** — 54% coverage, two dialog components at 0%
3. **Add tests for story-editor-dialog tabs** — 42% function coverage, three sub-tabs at 0%
4. **Add tests for admin page** — 57% coverage, extensive UI logic untested

### Priority 3 — Monitor
5. **Track `voyageai` SDK updates** for `qs` vulnerability fix (issue #18 already open)
6. **Monitor Node.js 24 LTS release** — current Node 23 triggers engine warnings in some packages
