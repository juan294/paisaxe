# Automation & Quality Agents

> Comprehensive guide to the automation, security, and quality infrastructure for Paisaxe.
> Designed to be replicable by other teams on any Next.js + GitHub + Vercel + Supabase stack.

**Last Updated**: January 31, 2026
**Scope**: CI/CD workflows, local agents, security measures, monitoring, and admin controls

---

## Table of Contents

1. [Overview](#overview)
2. [Local Automated Agents](#local-automated-agents)
3. [Admin Panel Controls](#admin-panel-controls)
4. [CI/CD Workflows](#cicd-workflows)
5. [Security & Supply Chain](#security--supply-chain)
6. [Performance & Accessibility](#performance--accessibility)
7. [Code Quality](#code-quality)
8. [Monitoring & Observability](#monitoring--observability)
9. [Database Maintenance](#database-maintenance)
10. [Configuration Reference](#configuration-reference)

---

## Overview

### Architecture

```
GitHub Actions (Push/PR)
  +-- ci.yml .............. Lint, Typecheck, Tests, Build
  +-- e2e.yml ............. Playwright E2E tests
  +-- gitleaks.yml ........ Secret scanning
  +-- license-check.yml ... Dependency license compliance
  +-- lighthouse.yml ...... Performance & accessibility audit
  +-- bundle-size.yml ..... JS bundle size tracking
  +-- knip.yml ............ Dead code detection
  +-- claude-review.yml ... AI-powered code review
  +-- security.yml ........ npm audit (also weekly cron)

GitHub Actions (Scheduled)
  +-- gitleaks.yml ........ Daily 04:00 UTC - full history scan
  +-- security.yml ........ Weekly Monday 08:00 UTC - npm audit

Local Agents (macOS launchd)
  +-- coverage-agent ...... Daily 02:00 AM - test coverage analysis
  +-- security-agent ...... Weekly Monday 09:00 AM - npm audit + licenses
  +-- docs-freshness-agent  Weekly Sunday 06:00 AM - stale docs detection
  +-- performance-agent ... Weekly Saturday 10:00 AM - Lighthouse + bundles

Database (pg_cron)
  +-- vacuum-analyze ...... Weekly - database maintenance
  +-- keep-alive .......... Every 3 days - prevent idle shutdown

External Monitoring
  +-- Upptime ............. Every 5 minutes - site & API health
  +-- Vercel Speed Insights Real User Monitoring (Core Web Vitals)
```

### Cost

All free or included in existing services:
- GitHub Actions (free for public repos, generous free tier for private)
- Open-source tools (Gitleaks, Knip, Lighthouse, license-checker)
- Free tiers (Vercel, Supabase, Upptime via GitHub Pages)
- Local agents run on your Mac (no cloud cost)
- Anthropic API (for Claude reviews and coverage agent)

---

## Local Automated Agents

Four agents run locally via macOS launchd, controlled via feature flags in the admin panel.

### Agent Overview

| Agent | Script | Schedule | Output | Default |
|-------|--------|----------|--------|---------|
| Coverage | `scripts/coverage-agent.sh` | Daily 2:00 AM | `docs/agents/coverage-report.md` | Enabled |
| Security | `scripts/security-agent.sh` | Mon 9:00 AM | `docs/agents/security-report.md` | Disabled |
| Docs Freshness | `scripts/docs-freshness-agent.sh` | Sun 6:00 AM | `docs/agents/docs-freshness-report.md` | Disabled |
| Performance | `scripts/performance-agent.sh` | Sat 10:00 AM | `docs/agents/performance-report.md` | Disabled |

### Feature Flag Control

Agents check feature flags before running. Control them via the **production admin panel** (paisaxe.es/admin → Toggles → System category).

| Flag | Purpose |
|------|---------|
| `automated_agents` | Master kill switch — disables ALL agents |
| `coverage_agent_enabled` | Enable/disable coverage agent |
| `security_agent_enabled` | Enable/disable security agent |
| `docs_freshness_agent_enabled` | Enable/disable docs freshness agent |
| `performance_agent_enabled` | Enable/disable performance agent |

**Important**: Local agents fetch flags from the **production** API (`paisaxe.es/api/feature-flags`), not localhost. This allows control even when the dev server isn't running.

### Launchd Plists

Located in `~/Library/LaunchAgents/`:

```
com.paisaxe.coverage-agent.plist
com.paisaxe.security-agent.plist
com.paisaxe.docs-freshness-agent.plist
com.paisaxe.performance-agent.plist
```

**Manage agents**:
```bash
# Load an agent (enable scheduling)
launchctl load ~/Library/LaunchAgents/com.paisaxe.coverage-agent.plist

# Unload an agent (disable scheduling)
launchctl unload ~/Library/LaunchAgents/com.paisaxe.coverage-agent.plist

# Run immediately (for testing)
launchctl start com.paisaxe.coverage-agent

# List loaded agents
launchctl list | grep paisaxe
```

Unlike cron, launchd runs missed jobs when the Mac wakes from sleep.

### Shared Utilities

`scripts/lib/agent-utils.sh` provides:
- `check_feature_flag "flag_key"` — Check if a flag is enabled
- `check_agent_enabled "agent_flag"` — Check master + individual flag
- `get_agent_prompt "agent_flag"` — Fetch prompt from config
- Logging functions: `log_info`, `log_success`, `log_warn`, `log_error`
- `write_report_header "Title" "output.md"` — Standard report header

### Agent Details

#### Coverage Agent

Runs nightly at 2:00 AM. Uses Claude CLI to:
1. Run test coverage analysis
2. Identify files below 100% coverage
3. Write missing tests
4. Update `docs/agents/coverage-report.md`

**Prompt**: Configurable via admin panel. Default focuses on pragmatic test coverage.

#### Security Agent

Runs weekly on Monday at 9:00 AM. Performs:
- `npm audit` — vulnerability scanning
- `license-checker` — license summary
- Copyleft detection (GPL, AGPL, LGPL)
- Outdated package report

Output: `docs/agents/security-report.md`

#### Docs Freshness Agent

Runs weekly on Sunday at 6:00 AM. Checks:
- Files modified since CLAUDE.md was updated
- New migrations needing documentation
- Undocumented API routes
- Undocumented feature flags
- Documentation file ages

Output: `docs/agents/docs-freshness-report.md`

#### Performance Agent

Runs weekly on Saturday at 10:00 AM. Analyzes:
- Production build output
- Bundle sizes in `.next/static`
- Lighthouse scores (if CLI installed)
- Core Web Vitals
- Dependency counts

Output: `docs/agents/performance-report.md`

---

## Admin Panel Controls

### Agent Configuration

Each agent has a **Configure** button in the admin panel (Toggles → System category) that allows:

1. **Editing the prompt** — Change agent behavior without code changes
2. **Viewing schedule** — See when the agent runs
3. **Viewing output file** — See where reports are written
4. **Reset to default** — Restore the original prompt

Changes take effect on the next agent run.

### Maintenance Mode

The `maintenance_mode` flag also has a Configure button to customize:
- **Title** — Main message (default: "Próximamente")
- **Message** — Optional additional text
- **Show Tagline** — Toggle "Look. Ask. Explore."

Preview shows exactly how the coming-soon page will look.

### Voice Agent

The `visitor_voice_agent` flag has configuration for:
- ElevenLabs Agent ID
- Whitelisted emails for access

---

## CI/CD Workflows

### Core CI (`ci.yml`)

Runs on every push and PR to `develop` or `main`.

| Job | Description |
|-----|-------------|
| lint-and-typecheck | `npm run typecheck` + `npm run lint` |
| test | `npm run test` (Vitest) |
| build | `npm run build` (production build) |

All jobs must pass before merging.

### E2E Tests (`e2e.yml`)

Playwright E2E tests run against a built app on push/PR to `develop` and `main`.

### PR Workflows (Informational)

These run on PRs but don't block merges:

| Workflow | Purpose |
|----------|---------|
| `lighthouse.yml` | Performance & accessibility scores |
| `bundle-size.yml` | JS bundle size report as PR comment |
| `knip.yml` | Dead code detection report |
| `claude-review.yml` | AI-powered code review |

---

## Security & Supply Chain

### Gitleaks (Secret Scanning)

**File**: `.github/workflows/gitleaks.yml`

**Triggers**:
- Every push to `develop` or `main`
- Every PR targeting `develop` or `main`
- Daily at 04:00 UTC (cron)

**Detects**: API keys, private keys, database strings, OAuth tokens, high-entropy secrets.

**If it fires**:
1. Remove the secret from code
2. **Rotate the credential immediately** (it's in git history)
3. Consider purging from history with BFG Repo-Cleaner

### License Compliance

**File**: `.github/workflows/license-check.yml`

**Blocked licenses**: GPL-2.0, GPL-3.0, AGPL-1.0, AGPL-3.0, EUPL, SSPL, BSL, CPAL, OSL, CPOL

**Allowed licenses**: MIT, Apache-2.0, BSD (all variants), ISC, 0BSD, Unlicense, CC0

**Local check**:
```bash
npx license-checker --production --failOn "GPL-2.0;GPL-3.0;AGPL-3.0"
```

### Security Audit

**File**: `.github/workflows/security.yml`

Runs `npm audit --audit-level=critical` on every push/PR and weekly on Mondays.

### Dependabot

**File**: `.github/dependabot.yml`

Opens PRs weekly for:
- npm production dependencies
- npm dev/type dependencies
- GitHub Actions versions

---

## Performance & Accessibility

### Lighthouse CI

**Files**: `.github/workflows/lighthouse.yml` + `lighthouserc.json`

Runs on every PR against `http://localhost:3000/immersive`.

**Thresholds**:

| Category | Minimum |
|----------|---------|
| Performance | 60% |
| Accessibility | 80% |

**Core Web Vitals Budgets**:

| Metric | Maximum |
|--------|---------|
| FCP | 3000ms |
| LCP | 4000ms |
| CLS | 0.25 |
| TBT | 500ms |

### Bundle Size

**File**: `.github/workflows/bundle-size.yml`

Posts PR comment with:
- `.next/static/` size
- `.next/server/` size
- Top 20 largest JS bundles

### Vercel Speed Insights

Real User Monitoring for Core Web Vitals in production. View in Vercel Dashboard.

---

## Code Quality

### Knip (Dead Code)

**Files**: `.github/workflows/knip.yml` + `knip.json`

Detects:
- Unused exports
- Unused dependencies
- Unreferenced files

**Local check**:
```bash
npx knip
```

### Claude Code Review

**File**: `.github/workflows/claude-review.yml`

AI code review on every PR. Also responds to `@claude` mentions.

**Requires**: `ANTHROPIC_API_KEY` GitHub secret.

---

## Monitoring & Observability

### Health Check Endpoint

**Endpoint**: `GET /api/health`

Returns:
```json
{
  "status": "healthy",
  "timestamp": "2026-01-31T10:00:00.000Z",
  "version": "1.0.0",
  "uptime": 3600,
  "services": {
    "supabase": { "status": "connected", "latency": 45 }
  },
  "database": { "size_mb": 150, "usage_percent": 1.8 }
}
```

Always returns HTTP 200. Reports "degraded" in body if issues detected.

### Upptime Status Page

**Repo**: https://github.com/juan294/paisaxe-upptime
**Page**: https://juan294.github.io/paisaxe-upptime/

Monitors every 5 minutes:
- `paisaxe.es` — main site
- `paisaxe.es/api/health` — API health

Auto-creates GitHub Issues on downtime.

---

## Database Maintenance

### pg_cron Jobs

| Job | Schedule | Purpose |
|-----|----------|---------|
| `vacuum-analyze-chunks` | Sundays 3:00 AM UTC | Reclaim dead tuples, update stats |
| `analyze-main-tables` | Daily 4:00 AM UTC | Keep query planner fresh |
| `cleanup-cron-history` | Sundays 5:00 AM UTC | Delete old cron logs |
| `keep-alive` | Every 3 days | Prevent idle database shutdown |
| `edge-keep-alive` | Every 3 days | Call keep-alive Edge Function |

**Verify jobs**:
```sql
SELECT jobname, schedule, command FROM cron.job ORDER BY jobname;
```

### Database Webhooks

Webhooks fire on row changes to invalidate caches:

| Table | Event | Effect |
|-------|-------|--------|
| `stories` | UPDATE | Revalidates `/immersive`, `/sitemap.xml` |
| `feature_flags` | UPDATE | Revalidates `/api/feature-flags` |

---

## Configuration Reference

### Agent Output Files

All agent reports go to `docs/agents/`:

```
docs/agents/
├── coverage-report.md
├── security-report.md
├── docs-freshness-report.md
└── performance-report.md
```

### Feature Flags (System Category)

| Flag Key | Label | Default |
|----------|-------|---------|
| `automated_agents` | Automated Agents (Master) | Enabled |
| `coverage_agent_enabled` | Coverage Agent | Enabled |
| `security_agent_enabled` | Security Agent | Disabled |
| `docs_freshness_agent_enabled` | Docs Freshness Agent | Disabled |
| `performance_agent_enabled` | Performance Agent | Disabled |
| `maintenance_mode` | Maintenance Mode | Disabled |

### GitHub Secrets

| Secret | Used By |
|--------|---------|
| `ANTHROPIC_API_KEY` | `claude-review.yml`, coverage agent |
| `GITHUB_TOKEN` | All workflows (auto-provided) |

### Key Files

| File | Purpose |
|------|---------|
| `scripts/lib/agent-utils.sh` | Shared agent utilities |
| `scripts/coverage-agent.sh` | Coverage agent script |
| `scripts/security-agent.sh` | Security agent script |
| `scripts/docs-freshness-agent.sh` | Docs freshness agent script |
| `scripts/performance-agent.sh` | Performance agent script |
| `.github/workflows/*.yml` | CI/CD workflows |
| `lighthouserc.json` | Lighthouse thresholds |
| `knip.json` | Dead code detection config |
| `src/app/api/health/route.ts` | Health check endpoint |
| `src/components/admin/agent-config-panel.tsx` | Agent config UI |
| `src/components/admin/maintenance-config-panel.tsx` | Maintenance config UI |

### Launchd Plists

Located in `~/Library/LaunchAgents/`:

| Plist | Agent |
|-------|-------|
| `com.paisaxe.coverage-agent.plist` | Coverage Agent |
| `com.paisaxe.security-agent.plist` | Security Agent |
| `com.paisaxe.docs-freshness-agent.plist` | Docs Freshness Agent |
| `com.paisaxe.performance-agent.plist` | Performance Agent |
