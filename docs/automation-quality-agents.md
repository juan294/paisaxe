# Phase 8: Automation & Quality Agents

> Comprehensive guide to the automation, security, and quality infrastructure added to Paisaxe.
> Designed to be replicable by other teams on any Next.js + GitHub + Vercel + Supabase stack.

**Date**: January 27, 2026
**Scope**: 11 tools across security, CI/CD, performance, monitoring, and code quality

---

## Table of Contents

1. [Overview](#overview)
2. [Security & Supply Chain](#security--supply-chain)
3. [Performance & Accessibility](#performance--accessibility)
4. [Code Quality](#code-quality)
5. [Monitoring & Observability](#monitoring--observability)
6. [Database Maintenance](#database-maintenance)
7. [Deployment](#deployment)
8. [Configuration Reference](#configuration-reference)
9. [Replication Guide](#replication-guide)

---

## Overview

### What We Built

A fully automated quality and security pipeline that runs with zero human intervention. Every push, every PR, and every night, automated agents verify that the codebase stays secure, performant, and clean.

### Architecture

```
Push/PR to GitHub
  |
  +-- ci.yml .............. Lint, Typecheck, Tests, Build
  +-- e2e.yml ............. Playwright E2E tests
  +-- gitleaks.yml ........ Secret scanning
  +-- license-check.yml ... Dependency license compliance
  +-- lighthouse.yml ...... Performance & accessibility audit
  +-- bundle-size.yml ..... JS bundle size tracking
  +-- knip.yml ............ Dead code detection
  +-- claude-review.yml ... AI-powered code review
  +-- security.yml ........ npm audit (also weekly cron)

Scheduled (Cron)
  +-- gitleaks.yml ........ Daily 04:00 UTC - full history scan
  +-- security.yml ........ Weekly Monday 08:00 UTC - npm audit
  +-- coverage-agent.sh ... Nightly 02:00 CET - coverage analysis (local)
  +-- pg_cron ............. Database VACUUM/ANALYZE (Supabase)

External Monitoring
  +-- Upptime ............. Every 5 minutes - site & API health
  +-- Vercel Speed Insights Real User Monitoring (Core Web Vitals)
```

### Cost

All free. Every tool uses either:
- GitHub Actions (free for public repos, generous free tier for private)
- Open-source tools (Gitleaks, Knip, Lighthouse, license-checker)
- Free tiers of paid services (Vercel, Supabase, Upptime via GitHub Pages)
- Services already paid for (Anthropic API for Claude reviews)

---

## Security & Supply Chain

### 1. Dependabot (Automated Dependency Updates)

**File**: `.github/dependabot.yml`

Dependabot opens PRs weekly when dependencies have newer versions. It groups related updates to reduce PR noise.

**What it monitors**:
- npm production dependencies
- npm dev and type dependencies
- GitHub Actions versions

**Configuration highlights**:
- Weekly schedule (Mondays)
- Max 10 open PRs at a time
- Two groups: `production` and `dev-and-types`
- Targets the `develop` branch

**How to handle Dependabot PRs**:
1. Review the changelog linked in the PR
2. CI runs automatically (including license check)
3. Merge if all checks pass
4. If a breaking change, fix locally then push to the Dependabot branch

### 2. Gitleaks (Secret Scanning)

**File**: `.github/workflows/gitleaks.yml`

Scans the entire git history for accidentally committed secrets (API keys, passwords, tokens, private keys).

**Triggers**:
- Every push to `develop` or `main`
- Every PR targeting `develop` or `main`
- Daily at 04:00 UTC (cron) to catch secrets in any branch

**What it detects**:
- API keys (AWS, GCP, Anthropic, Stripe, etc.)
- Private keys (RSA, SSH, PGP)
- Database connection strings
- OAuth tokens and secrets
- Generic high-entropy strings that look like secrets

**If it fires**:
1. Remove the secret from the code
2. Rotate the exposed credential immediately (it's in git history forever)
3. Add the file to `.gitignore` if appropriate
4. Consider using `git filter-branch` or BFG Repo-Cleaner to purge from history

### 3. License Compliance Check

**File**: `.github/workflows/license-check.yml`

Blocks merging of PRs that introduce dependencies with copyleft or restrictive licenses.

**Blocked licenses**: GPL-2.0, GPL-3.0, AGPL-1.0, AGPL-3.0, EUPL-1.1, EUPL-1.2, SSPL-1.0, BSL-1.1, CPAL-1.0, OSL-3.0, CPOL-1.02

**Allowed licenses**: MIT, Apache-2.0, BSD (all variants), ISC, 0BSD, Unlicense, CC0

**How it works**: Uses `license-checker` to scan all production dependencies and fails if any match the blocked list.

**Local check**:
```bash
npx license-checker --production --failOn "GPL-2.0;GPL-3.0;AGPL-3.0"
```

### 4. Security Audit (Pre-existing)

**File**: `.github/workflows/security.yml`

Runs `npm audit --audit-level=critical` on every push/PR and weekly on Mondays. Catches known vulnerabilities in dependencies.

---

## Performance & Accessibility

### 5. Lighthouse CI

**Files**: `.github/workflows/lighthouse.yml` + `lighthouserc.json`

Runs Google Lighthouse on every PR to catch performance and accessibility regressions before they reach production.

**How it works**:
1. Builds the app with `npm run build`
2. Starts the production server with `npm run start`
3. Runs 3 Lighthouse audits against `http://localhost:3000/immersive`
4. Compares results against configured thresholds
5. Uploads results as build artifacts (14-day retention)

**Thresholds** (defined in `lighthouserc.json`):

| Category | Error Threshold | Warn Threshold |
|----------|----------------|----------------|
| Performance | < 60% | - |
| Accessibility | < 80% | - |
| Best Practices | - | < 80% |
| SEO | - | < 80% |

**Core Web Vitals budgets**:

| Metric | Max Value |
|--------|-----------|
| First Contentful Paint (FCP) | 3000ms |
| Largest Contentful Paint (LCP) | 4000ms |
| Cumulative Layout Shift (CLS) | 0.25 |
| Total Blocking Time (TBT) | 500ms |

**Configuration**: Desktop preset with 3 runs for stable median scores. Adjust thresholds in `lighthouserc.json` as the site improves.

### 6. Bundle Size Analysis

**File**: `.github/workflows/bundle-size.yml`

Reports JavaScript bundle sizes on every PR as a comment, making size regressions visible before merge.

**What it reports**:
- `.next/static/` size (client-side JS, CSS)
- `.next/server/` size (server components)
- Total size
- Top 20 largest JS bundles by file

**How it works**:
1. Builds the app with `npm run build`
2. Measures directory sizes with `du`
3. Lists the 20 largest `.js` files in `.next/`
4. Posts (or updates) a PR comment with the report
5. Also writes to GitHub Step Summary

**No hard limits** — this is informational. Watch for unexpected jumps between PRs.

### 7. Vercel Speed Insights (Real User Monitoring)

**Integration**: `@vercel/speed-insights/next` in `src/app/layout.tsx`

Collects real Core Web Vitals data from production users. Unlike Lighthouse (synthetic, lab data), Speed Insights shows how real visitors experience the site.

**Metrics tracked**: LCP, FID, CLS, FCP, TTFB

**Setup**: Code integration is done. Enable in Vercel Dashboard > Project > Speed Insights.

---

## Code Quality

### 8. Knip (Dead Code Detection)

**Files**: `.github/workflows/knip.yml` + `knip.json`

Detects unused exports, unused dependencies, and unreferenced files. Runs on every PR in report mode (informational, does not block merges).

**What it finds**:
- Unused exported functions, types, and variables
- Unused `dependencies` and `devDependencies` in package.json
- Files not imported by anything
- Unused configuration entries

**Configuration** (`knip.json`):
- Entry points follow Next.js App Router conventions (page, layout, route, loading, error, etc.)
- Vitest plugin picks up test files
- Path aliases configured (`@/*` maps to `./src/*`)
- Test files are excluded from dead code analysis

**Local check**:
```bash
npx knip                    # Full report
npx knip --dependencies     # Only unused dependencies
```

### 9. Claude Code Review (AI PR Reviews)

**File**: `.github/workflows/claude-review.yml`

Automated AI code review on every PR using Claude. Also responds to `@claude` mentions in PR comments for on-demand analysis.

**How it works**:
- Triggered on PR open/sync and `@claude` mentions in PR comments
- Skips Dependabot and Renovate PRs (automated dependency updates)
- Uses `anthropics/claude-code-action@v1` with `claude-sonnet-4-20250514`
- Posts review comments directly on the PR

**Requirements**: `ANTHROPIC_API_KEY` must be set as a GitHub repository secret.

**What it reviews**:
- Code correctness and potential bugs
- Security concerns
- Performance implications
- Style and best practices
- Test coverage gaps

---

## Monitoring & Observability

### 10. Health Check Endpoint

**File**: `src/app/api/health/route.ts` (9 tests in `route.test.ts`)

A dedicated endpoint for uptime monitoring that reports application and service health.

**Endpoint**: `GET /api/health`

**Response format**:
```json
{
  "status": "healthy",
  "timestamp": "2026-01-27T10:00:00.000Z",
  "version": "1.0.0",
  "uptime": 3600,
  "services": {
    "supabase": {
      "status": "connected",
      "latency": 45
    }
  }
}
```

**Design decisions**:
- Always returns HTTP 200 (so monitoring tools don't get confused by error codes)
- Reports "healthy" or "degraded" in the response body
- Measures Supabase latency by querying the `chunks` table
- Sets `Cache-Control: no-store, max-age=0` to prevent caching
- Handles Supabase connection failures gracefully (reports degraded, doesn't crash)

### 11. Upptime Status Page

**Repo**: https://github.com/juan294/paisaxe-upptime
**Status page**: https://juan294.github.io/paisaxe-upptime/

A separate GitHub repository that monitors site availability using GitHub Actions and displays results on a GitHub Pages status page.

**Monitors**:
- `paisaxe.com` — main site (every 5 minutes)
- `paisaxe.com/api/health` — API health endpoint (every 5 minutes)

**Features**:
- Automatic GitHub Issues when downtime is detected
- Response time graphs
- Historical uptime percentage
- Public status page for transparency

**Architecture**: Upptime runs entirely on GitHub infrastructure — Actions for monitoring, Issues for incidents, Pages for the status site. No external services needed.

---

## Database Maintenance

### pg_cron (Automated Maintenance)

**Migration**: `supabase/migrations/011_pg_cron_maintenance.sql`

Scheduled database maintenance jobs running on Supabase via the pg_cron extension.

**Prerequisites**: pg_cron must be enabled in Supabase Dashboard (Database > Extensions).

**Scheduled jobs**:

| Job | Schedule | SQL | Purpose |
|-----|----------|-----|---------|
| `vacuum-analyze-chunks` | Sundays 3:00 AM UTC | `VACUUM ANALYZE public.chunks` | Reclaim dead tuples and update planner stats for the vector embeddings table |
| `analyze-main-tables` | Daily 4:00 AM UTC | `ANALYZE public.chunks; ANALYZE public.images; ANALYZE public.stories` | Keep query planner statistics fresh |
| `cleanup-cron-history` | Sundays 5:00 AM UTC | `DELETE FROM cron.job_run_details WHERE end_time < now() - interval '30 days'` | Prevent cron history from growing unbounded |
| `vacuum-analyze-analytics` | Sundays 3:30 AM UTC | `VACUUM ANALYZE public.analytics_events` | Maintain insert/query performance on analytics |

**Why this matters**: PostgreSQL's autovacuum handles basic maintenance, but for tables with vector embeddings (1024 dimensions), explicit VACUUM ANALYZE ensures the query planner has accurate statistics for similarity searches. Without it, vector search performance degrades over time.

**Verification**:
```sql
SELECT jobname, schedule, command FROM cron.job ORDER BY jobname;
SELECT * FROM cron.job_run_details ORDER BY end_time DESC LIMIT 10;
```

---

## Deployment

### Vercel Setup

**Project**: `thecreativetoken/paisaxe`

**Configuration**:
- Framework: Next.js (auto-detected)
- Production branch: `main`
- Preview branches: all others (including `develop`)
- Node.js: 24.x

**Domains**:
- `paisaxe.com` + `www.paisaxe.com`
- `paisaxe.es` + `www.paisaxe.es` (pending domain registration)

**Environment variables**: All 9 variables configured for production and preview environments. Sensitive keys (API keys, secrets) are marked as sensitive in Vercel.

**Git integration**: Connected to `juan294/paisaxe` on GitHub. Pushes to `main` trigger production deployments. Pushes to any other branch create preview deployments with unique URLs.

---

## Configuration Reference

### Files Added in Phase 8

| File | Purpose |
|------|---------|
| `.github/dependabot.yml` | Dependabot v2 configuration |
| `.github/workflows/gitleaks.yml` | Secret scanning workflow |
| `.github/workflows/license-check.yml` | License compliance workflow |
| `.github/workflows/lighthouse.yml` | Lighthouse CI workflow |
| `.github/workflows/bundle-size.yml` | Bundle size reporting workflow |
| `.github/workflows/knip.yml` | Dead code detection workflow |
| `.github/workflows/claude-review.yml` | AI code review workflow |
| `.github/upptime/.upptimerc.yml` | Upptime reference config |
| `lighthouserc.json` | Lighthouse CI thresholds and settings |
| `knip.json` | Knip dead code detection config |
| `src/app/api/health/route.ts` | Health check API endpoint |
| `src/app/api/health/route.test.ts` | Health check tests (9 tests) |
| `supabase/migrations/011_pg_cron_maintenance.sql` | pg_cron maintenance jobs |

### Files Modified in Phase 8

| File | Change |
|------|--------|
| `src/app/layout.tsx` | Added `<SpeedInsights />` component |
| `package.json` | Added `@vercel/speed-insights` and `knip` |
| `CLAUDE.md` | Added CI/CD, deployment, monitoring, guardrails sections |

### GitHub Secrets Required

| Secret | Used By |
|--------|---------|
| `ANTHROPIC_API_KEY` | `claude-review.yml` |
| `GITHUB_TOKEN` | `gitleaks.yml` (auto-provided) |

### Vercel Environment Variables

All set for `production` and `preview`:
- `ANTHROPIC_API_KEY`
- `VOYAGE_API_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_KEY`
- `ADMIN_SECRET_KEY`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `NEXT_PUBLIC_SITE_URL`

---

## Replication Guide

To replicate this setup in another Next.js + GitHub + Vercel + Supabase project:

### Step 1: Copy Workflow Files

Copy these files into your `.github/` directory:
- `dependabot.yml`
- `workflows/gitleaks.yml`
- `workflows/license-check.yml`
- `workflows/lighthouse.yml`
- `workflows/bundle-size.yml`
- `workflows/knip.yml`
- `workflows/claude-review.yml`

### Step 2: Copy Config Files

Copy to your project root:
- `lighthouserc.json` — update the URL to match your app's main page
- `knip.json` — update entry points to match your framework conventions

### Step 3: Install Dependencies

```bash
npm install @vercel/speed-insights    # production dependency
npm install -D knip                    # dev dependency
```

### Step 4: Add Health Check Endpoint

Create `src/app/api/health/route.ts` with a GET handler that:
- Returns JSON with status, timestamp, version, uptime
- Checks connectivity to your database
- Always returns HTTP 200 (reports status in the body)
- Sets `Cache-Control: no-store`

### Step 5: Add Speed Insights

In your root layout, add:
```tsx
import { SpeedInsights } from "@vercel/speed-insights/next";
// Inside the layout JSX:
<SpeedInsights />
```

### Step 6: Set Up Upptime

1. Create a new repo from https://github.com/upptime/upptime
2. Replace `.upptimerc.yml` with your site's URLs
3. Set Actions permissions to read/write (Settings > Actions > General)
4. Enable GitHub Pages (Settings > Pages > Source: GitHub Actions)

### Step 7: Set Up pg_cron (Supabase)

1. Enable pg_cron in Supabase Dashboard (Database > Extensions)
2. Run your migration SQL to schedule maintenance jobs
3. Adjust schedules and tables to match your schema

### Step 8: Configure Secrets

- GitHub: Add `ANTHROPIC_API_KEY` as a repository secret
- Vercel: Add all environment variables for production and preview

### Step 9: Link Vercel

```bash
vercel login
vercel link
vercel git connect <your-github-repo-url>
```

### Step 10: Verify

- Push a commit and verify all workflows run
- Open a PR and check for Lighthouse, bundle size, knip, and Claude review comments
- Check your Upptime status page
- Verify pg_cron jobs: `SELECT * FROM cron.job;`
