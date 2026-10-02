# Automation & Quality Agents

> Comprehensive guide to the automation, security, and quality infrastructure for Paisaxe.
> Designed to be replicable by other teams on any Next.js + GitHub + Vercel + Supabase stack.

**Last Updated**: May 3, 2026
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
  +-- e2e.yml ............. Playwright E2E tests (20 spec files)
  +-- e2e-stripe-integration.yml .. Stripe test-mode E2E
  +-- preview-smoke.yml ... Smoke test on Vercel preview deploy
  +-- (gitleaks is a job inside security.yml)
  +-- license-check.yml ... Dependency license compliance
  +-- lighthouse.yml ...... Performance & accessibility audit
  +-- bundle-size.yml ..... JS bundle size tracking
  +-- knip.yml ............ Dead code detection
  +-- claude-review.yml ... AI-powered code review
  +-- security.yml ........ npm audit (also daily cron)

GitHub Actions (Scheduled)
  +-- security.yml ........ Daily 08:00 UTC - gitleaks full history scan
  +-- security.yml ........ Daily 08:00 UTC - npm audit

Local Agents (macOS launchd)
  +-- coverage-agent ...... Daily 02:00 AM - test coverage analysis
  +-- security-agent ...... Weekly Monday 09:00 AM - npm audit + licenses
  +-- documentation-agent  Weekly Sunday 06:00 AM - stale docs detection
  +-- performance-agent ... Weekly Saturday 10:00 AM - Lighthouse + bundles
  +-- qa-agent ............ Weekly Sunday 08:00 AM - LLM response quality
  +-- localization-agent .. Weekly Sunday 07:00 AM - translation coverage
  +-- cost-analyst-agent .. Daily 03:00 AM - API spend monitoring

Vercel Cron (serverless)
  +-- content-discovery ... Weekly Monday 03:00 AM UTC
  +-- fail-stale-translations Daily 06:00 AM UTC
  +-- github-traffic-sync . Daily 01:00 AM UTC
  +-- subscription-optimizer Weekly Monday 04:00 AM UTC

Database (pg_cron)
  +-- vacuum-analyze ...... Weekly - database maintenance
  +-- keep-alive .......... Every 3 days - prevent idle shutdown

External Monitoring
  +-- Upptime ............. Every 5 minutes - site & API health
  +-- Vercel Speed Insights Real User Monitoring (Core Web Vitals)
  +-- Sentry .............. Error tracking (client + server + edge)
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

Seven agents run locally via macOS launchd, controlled via feature flags in the admin panel.

### Agent Overview

| Agent | Script | Schedule | Output | Default |
|-------|--------|----------|--------|---------|
| Coverage | `scripts/coverage-agent.sh` | Daily 2:00 AM | `docs/agents/coverage-report.md` | Enabled |
| Security | `scripts/security-agent.sh` | Mon 9:00 AM | `docs/agents/security-report.md` | Disabled |
| Documentation | `scripts/documentation-agent.sh` | Sun 6:00 AM | `docs/agents/documentation-report.md` | Disabled |
| Performance | `scripts/performance-agent.sh` | Sat 10:00 AM | `docs/agents/performance-report.md` | Disabled |
| QA | `scripts/qa-agent.sh` | Sun 8:00 AM | `docs/agents/qa-report.md` | Disabled |
| Localization | `scripts/localization-agent.sh` | Sun 7:00 AM | `docs/agents/localization-report.md` | Disabled |
| Cost Analyst | `scripts/cost-analyst-agent.sh` | Daily 3:00 AM | `docs/agents/cost-analyst-report.md` | Enabled |

### Feature Flag Control

Agents check feature flags before running. Control them via the **production admin panel** (paisaxe.es/admin → Agents tab) or via the local CLI:

```bash
scripts/agent-ctl.sh status           # Show all flags
scripts/agent-ctl.sh enable <key>     # Enable agent
scripts/agent-ctl.sh disable <key>    # Disable agent
scripts/agent-ctl.sh master on|off    # Master toggle
```

| Flag | Purpose |
|------|---------|
| `automated_agents` | Master kill switch — disables ALL agents |
| `coverage_agent_enabled` | Enable/disable coverage agent |
| `security_agent_enabled` | Enable/disable security agent |
| `documentation_agent_enabled` | Enable/disable documentation agent |
| `performance_agent_enabled` | Enable/disable performance agent |
| `qa_agent_enabled` | Enable/disable QA agent |
| `localization_agent_enabled` | Enable/disable localization agent |
| `cost_analyst_agent_enabled` | Enable/disable cost analyst agent |

**Important**: Local agents fetch flags from the **production** API (`paisaxe.es/api/feature-flags`). Agent config is stored in `scripts/agent-config.json` (gitignored); defaults in `scripts/agent-config.defaults.json`.

**Important**: Local agents fetch flags from the **production** API (`paisaxe.es/api/feature-flags`), not localhost. This allows control even when the dev server isn't running.

### Launchd Plists

Located in `~/Library/LaunchAgents/`:

```
com.paisaxe.coverage-agent.plist
com.paisaxe.security-agent.plist
com.paisaxe.documentation-agent.plist
com.paisaxe.performance-agent.plist
com.paisaxe.qa-agent.plist
com.paisaxe.localization-agent.plist
com.paisaxe.cost-analyst-agent.plist
com.paisaxe.agent.cc-rpi-update.plist   (daily 3:30 AM — cc-rpi blueprint sync)
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

#### Documentation Agent

Runs weekly on Sunday at 6:00 AM. Checks:
- Files modified since CLAUDE.md was updated
- New migrations needing documentation
- Undocumented API routes
- Undocumented feature flags
- Documentation file ages

Output: `docs/agents/documentation-report.md`

#### Performance Agent

Runs weekly on Saturday at 10:00 AM. Analyzes:
- Production build output
- Bundle sizes in `.next/static`
- Lighthouse scores (if CLI installed)
- Core Web Vitals
- Dependency counts

Output: `docs/agents/performance-report.md`

#### QA Agent

Runs weekly on Sunday at 8:00 AM. Automated LLM testing for:
- RAG response quality and source attribution
- Content safety and boundaries
- Hallucination detection
- Budget-conscious sampling (configurable via feature flag config)

Output: `docs/agents/qa-report.md`

#### Localization Agent

Runs weekly on Sunday at 7:00 AM. Ensures:
- 100% translation coverage across all 6 locales (es, en, fr, de, pt, ast)
- Missing UI strings detected and auto-filled (Spanish is source of truth)
- Story translations in sync with source

Output: `docs/agents/localization-report.md`

#### Cost Analyst Agent

Runs daily at 3:00 AM. Queries billing APIs (Anthropic, ElevenLabs, Twilio):
- Spending trends and anomaly detection (>20% spikes)
- Tier proximity warnings
- Cost forecasting at 1x/3x/10x growth

Output: `docs/agents/cost-analyst-report.md`

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
- **Show Tagline** — Toggle "Look. Ask. Discover."

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
| lint-and-typecheck | `npm run typecheck` + `npm run check-verification-coverage` + `npm run lint` + `npm run check-env` + `npm run check-migrations` |
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

**File**: `.github/workflows/security.yml` (job `gitleaks`)

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

Runs `npm audit --omit=dev --audit-level=moderate` on every push/PR and daily at 08:00 UTC.

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
| Performance | 70% |
| Accessibility | 80% |

**Core Web Vitals Budgets**:

| Metric | Maximum (desktop) | Maximum (mobile) |
|--------|-------------------|------------------|
| FCP | 3000ms | 3000ms |
| LCP | 4000ms | 5500ms |
| CLS | 0.25 | 0.25 |
| TBT | 500ms | 500ms |

**Category score minimums**: performance >= 0.7 desktop / >= 0.6 mobile;
accessibility >= 0.8 on both.

The mobile thresholds are looser because Lighthouse's mobile emulation applies 4x
CPU throttling and slow-4G network on top of a deliberately inflated 25-story
fallback fixture. Both were originally copied from the desktop config and neither
held: LCP ran 4064-4551ms against a 4000ms budget, and the performance score runs
0.64-0.70+ against a 0.7 minimum — inside the noise band, so the gate flaked.
Bringing `/immersive` up so both columns can match is tracked in #926.

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

**Endpoints**:
- `GET /api/health/live` — liveness probe; always returns HTTP 200 with `{ "status": "live", "timestamp": "..." }`. Used by Upptime for uptime monitoring.
- `GET /api/health` — diagnostics endpoint; always returns HTTP 200. The JSON body signals health state: `{ "status": "healthy"|"degraded", "timestamp": "...", "sentry": { "status": "configured"|"unconfigured" }, "rate_limit": { "status": "ok"|"degraded", "backend": "upstash"|"memory"|"blocked" }, ... }`. Reports "degraded" if Supabase connection fails, approved stories are unavailable, database usage exceeds 80% of the Pro tier limit, Sentry is missing in production, or the production rate-limit backend is degraded. Used by readiness smoke CI as the diagnostics gate.

**Readiness monitor**: `node scripts/check-health-readiness.mjs <base-url>` parses `/api/health` and fails on non-200 HTTP status or any JSON body where `status !== "healthy"`. The release preview gate does **not** currently pass `--require-sentry` — Sentry configuration is not a hard release gate today. `sentry.status` (see DO-B1) reflects only whether `NEXT_PUBLIC_SENTRY_DSN` is set, not verified delivery, and the Preview environment does not carry that DSN, so hard-gating on it now would fail every release PR. `/api/health/live` must not be used as a readiness gate because it only proves the process can answer requests.

**Sub-endpoint**: `GET /api/health/db` — database connectivity only (used internally by health checks and preview smoke tests).

### Sentry Error Tracking

Sentry is integrated across all three runtimes:

| File | Runtime |
|------|---------|
| `sentry.client.config.ts` | Browser |
| `sentry.server.config.ts` | Node.js (API routes) |
| `sentry.edge.config.ts` | Vercel Edge Runtime |
| `src/instrumentation.ts` | Next.js startup hook |

**PII redaction**: The `beforeSend` hook in `src/lib/logger-sanitize.ts` strips emails, phone numbers, and API keys from error events before they reach Sentry.

**Console guard**: An ESLint rule blocks raw `console.*` calls in API routes — use `import { logger } from "@/lib/logger"` instead.

### Request Correlation IDs

Every request gets a `x-request-id` header generated by `src/lib/proxy/request-id.ts`. The ID propagates through:
- Server logs (included in every structured log line via `src/lib/request-context.ts`)
- Sentry breadcrumbs
- API response headers (for client-side correlation in browser devtools)

Use the correlation ID to trace a single user request across distributed logs.

### Upptime Status Page

**Repo**: https://github.com/juan294/paisaxe-upptime
**Page**: https://juan294.github.io/paisaxe-upptime/

Monitors every 5 minutes:
- `paisaxe.es` — main site
- `paisaxe.es/api/health/live` — API liveness

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
├── code-quality-report.md   # Manual/on-demand — code quality audit findings
├── cost-analyst-report.md   # Manual/on-demand — cost analysis
├── coverage-report.md       # Daily (coverage agent)
├── documentation-report.md  # Weekly Sunday (documentation agent)
├── localization-report.md   # Manual/on-demand — localization audit
├── performance-report.md    # Weekly Saturday (performance agent)
├── pre-launch-report.md     # Manual/on-demand — pre-launch audit
├── qa-report.md             # Manual/on-demand — QA audit
├── security-report.md       # Weekly Monday (security agent)
└── shared-context.md        # Cross-agent intelligence (read/write by all agents)
```

### Feature Flags (System Category)

| Flag Key | Label | Default |
|----------|-------|---------|
| `automated_agents` | Automated Agents (Master) | Enabled |
| `coverage_agent_enabled` | Coverage Agent | Enabled |
| `security_agent_enabled` | Security Agent | Disabled |
| `documentation_agent_enabled` | Documentation Agent | Disabled |
| `performance_agent_enabled` | Performance Agent | Disabled |
| `qa_agent_enabled` | QA Agent | Disabled |
| `localization_agent_enabled` | Localization Agent | Disabled |
| `cost_analyst_agent_enabled` | Cost Analyst Agent | Enabled |
| `subscription_optimizer_enabled` | Subscription Optimizer | Disabled |
| `content_discovery_agent_enabled` | Content Discovery | Disabled |
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
| `scripts/documentation-agent.sh` | Docs freshness agent script |
| `scripts/performance-agent.sh` | Performance agent script |
| `scripts/qa-agent.sh` | QA agent script |
| `scripts/localization-agent.sh` | Localization agent script |
| `scripts/cost-analyst-agent.sh` | Cost analyst agent script |
| `scripts/agent-ctl.sh` | CLI for toggling agent flags |
| `scripts/agent-config.defaults.json` | Default agent flag values |
| `.github/workflows/*.yml` | CI/CD workflows |
| `lighthouserc.json` | Lighthouse thresholds |
| `knip.json` | Dead code detection config |
| `src/app/api/health/route.ts` | Health check endpoint |
| `src/app/api/health/db/route.ts` | DB connectivity sub-check |
| `sentry.client.config.ts` | Sentry browser config |
| `sentry.server.config.ts` | Sentry server config |
| `sentry.edge.config.ts` | Sentry edge config |
| `src/lib/proxy/request-id.ts` | Request correlation ID middleware |
| `src/lib/request-context.ts` | Request context propagation |
| `src/components/admin/agent-config-panel.tsx` | Agent config UI |
| `src/components/admin/maintenance-config-panel.tsx` | Maintenance config UI |

### Launchd Plists

Located in `~/Library/LaunchAgents/`:

| Plist | Agent |
|-------|-------|
| `com.paisaxe.coverage-agent.plist` | Coverage Agent |
| `com.paisaxe.security-agent.plist` | Security Agent |
| `com.paisaxe.documentation-agent.plist` | Documentation Agent |
| `com.paisaxe.performance-agent.plist` | Performance Agent |
| `com.paisaxe.qa-agent.plist` | QA Agent |
| `com.paisaxe.localization-agent.plist` | Localization Agent |
| `com.paisaxe.cost-analyst-agent.plist` | Cost Analyst Agent |
