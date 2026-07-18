---
name: "Codebase Health Check"
description: "Unified codebase audit. Triggered by 'run a health check', 'codebase health', 'health monitoring', 'code quality audit', or 'deep dive on code quality'."
---

# Codebase Health Check (Agent Team)

**Trigger:** User says "run a health check", "codebase health", "health monitoring", "code quality audit", or "deep dive on code quality"

This is the **single unified audit** for the entire codebase. It replaces the former standalone "Code Quality Deep-Dive" and "Coverage Report".

Create a team called "health-check" with 4 parallel agents:

### Agents

1. **test-health**
   - Run full test suite, identify any flaky tests (run failing tests 3x to confirm)
   - Report coverage percentages by module (`npm run test:coverage`)
   - Check coverage gaps in recently changed files (`git diff develop..main`)
   - Flag files at 0% coverage that have been modified recently
   - Flag tests that take unusually long (> 5 seconds)

2. **code-quality**
   - Run linter and typecheck (`npm run lint && npm run typecheck`)
   - Run `npx knip` for unused exports, files, and dependencies
   - Find TODO/FIXME/HACK comments
   - Check for `any` types that should be properly typed
   - Identify complexity hotspots: functions > 50 lines, files > 300 lines, nesting > 3 levels
   - Check for duplicated logic and inconsistent patterns across API routes and components
   - Cross-reference: flag files that are both complex AND low-coverage (highest risk)

3. **ci-deploy-health**
   - Check last 5 CI runs for patterns in failures (`gh run list --limit 5`)
   - Verify production health endpoint (`curl /api/health`)
   - Check database size and latency
   - Confirm cron jobs are configured and executing
   - Check for any Vercel deployment errors or warnings

4. **dependency-health**
   - Check for outdated dependencies (`npm outdated`)
   - Identify known vulnerabilities (`npm audit`)
   - Verify lockfile integrity (`npm ci --dry-run`)
   - Flag any dependencies with incompatible licenses (only MIT, Apache-2.0, BSD, ISC allowed)

### Output

Write the unified report to `docs/health-report-[TODAY].md`.

Report structure:
```
# Codebase Health Report
> Generated: [date] | Branch: develop | Commit: [hash]

## Executive Summary
## Test Health
## Code Quality
## CI & Deploy Health
## Dependency Health
## Recommended Actions
```

### Auto-Remediation

- **Critical issues** → automatically create GitHub issues
- **Simple fixes** (unused deps, lint fixes, dead code, minor/patch dep updates) → fix in a single PR titled `chore: automated health fixes [DATE]`
- **Complex issues** → file issues with context — do NOT auto-fix

### Relationship to Other Reports

This health check does NOT replace: QA Report, Security Report, Performance Report, Pre-Launch Report, Cost Analyst Report, or Localization Report (each covers a unique domain).
