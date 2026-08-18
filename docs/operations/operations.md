# Paisaxe Operations Guide

Detailed documentation for database maintenance, monitoring, webhooks, and automated agents.

## Related runbooks

| Document | Use when |
|---|---|
| `docs/runbooks/release-checklist.md` | Releasing to production — the single procedural authority |
| `docs/operations/rollback.md` | Production is broken. Roll back first, investigate second |
| `docs/operations/alerting-runbook.md` | Responding to a specific alert type |
| `docs/operations/migration-policy.md` | Writing or applying a migration |
| `docs/operations/pre-launch-security-checklist.md` | The 6 manual security gates before a release PR |

## Health Check Endpoints

Two endpoints serve different consumers:

**`GET /api/health/live`** — liveness probe. Always returns HTTP 200 with `{ "status": "live", "timestamp": "..." }`. No Supabase or external checks. Used by Upptime and liveness-only monitors. Safe to call in tight loops.

**`GET /api/health`** — public release diagnostics endpoint. Always returns HTTP 200 with `{ "status": "healthy" | "degraded", "timestamp": "...", "cron_auth": { "status": "ok" | "misconfigured" }, "sentry": { "status": "configured" | "unconfigured" }, "rate_limit": { "status": "ok" | "degraded", "backend": "upstash" | "memory" | "blocked", "reason"?: "upstash_missing" | "upstash_unavailable" } }`. The body status becomes `"degraded"` when Supabase connectivity fails, approved stories are unavailable, database usage reaches the 80% warning threshold, `NEXT_PUBLIC_SENTRY_DSN` is missing in Vercel production, or the rate-limit backend is misconfigured in production. Public diagnostics are intentionally minimized; inspect server logs or private tooling for root cause details.

Readiness monitors must parse the `/api/health` JSON body, not just the HTTP status. The shared CI monitor is `node scripts/check-health-readiness.mjs <base-url>`; it fails unless `/api/health` returns HTTP 200 and `status: "healthy"`. Use `--require-sentry` for release gates that must also prove `sentry.status: "configured"`.

## Pre-Launch Checklist

Run this checklist before every production release. Invoke with: "Run the pre-launch checklist from operations.md"

### 1. Code Quality Gates

Run all quality checks sequentially:

```bash
npm run test           # All tests must pass
npm run typecheck      # No TypeScript errors in app, scripts, E2E, or Edge functions
npm run lint           # No linting errors in src/ or scripts/
npm run prelaunch      # Safe local release gate: verification wiring, env docs, migrations, build, browser E2E
npm run prelaunch:live # Real Stripe/Supabase QA happy path; fails if credentials are missing
```

**Expected results:**
- Local pre-launch gate: runs verification coverage, env docs, migrations, build, and browser E2E without invoking live services
- Tests: All passing (current count in `docs/agents/coverage-report.md` — do not hardcode here)
- TypeScript: Exit code 0, no output
- Lint: Exit code 0, no output
- Verification wiring: reports explicit coverage for non-src TS surfaces and live integration gate
- Pre-launch live gate: real Stripe test-mode checkout passes; missing Stripe/Supabase QA secrets fail this gate instead of skipping
- Build: "Generating static pages" completes successfully

### 2. Health Endpoints

```bash
# Liveness probe — should always return 200
curl -sS https://paisaxe.es/api/health/live -w " %{http_code}\n"

# Diagnostics — always returns 200; inspect JSON status
curl -sS https://paisaxe.es/api/health -o /tmp/paisaxe-health.json -w "%{http_code}\n"
cat /tmp/paisaxe-health.json | jq
```

**Verify:**
- `/api/health/live`: HTTP `200`
- `/api/health`: HTTP `200`, `status`: `"healthy"`, and `sentry.status`: `"configured"`

### 3. Core Endpoints

```bash
# Main pages (307 = maintenance mode redirect, 200 = live)
curl -s https://paisaxe.es/ -o /dev/null -w "%{http_code}"
curl -s https://paisaxe.es/immersive -o /dev/null -w "%{http_code}"

# Chat API (should return streaming response)
curl -s https://paisaxe.es/api/chat/stream -X POST \
  -H "Content-Type: application/json" \
  -d '{"message":"hello"}'

# Feature flags API
curl -s https://paisaxe.es/api/feature-flags | jq '.data | length'
```

### 4. SEO & Discoverability

```bash
# Sitemap lists published stories
curl -s https://paisaxe.es/sitemap.xml | head -50

# robots.txt properly configured
curl -s https://paisaxe.es/robots.txt
```

**Verify sitemap includes:**
- `/` and `/immersive` routes
- Published story URLs (`/immersive?story=...`)

### 5. Git Status

```bash
# Check for unpushed commits on develop
git log main..develop --oneline

# Verify branches are in sync for release
git diff develop main --stat
```

**For release:** `develop` and `main` should be in sync (no diff).

### 6. Feature Flags Review

Check critical flags at https://paisaxe.es/api/feature-flags:

| Flag | Pre-Launch | Post-Launch |
|------|------------|-------------|
| `maintenance_mode` | enabled | **disabled** |
| `ambient_discovery` | enabled | enabled |
| `autoplay_button` | enabled | enabled |
| `story_sharing` | enabled | enabled |

### 7. Go Live

1. Open admin panel: https://paisaxe.es/admin
2. Navigate to Feature Flags → Behavior category
3. **Disable `maintenance_mode`**
4. Verify site is accessible without redirect

### Quick Reference

| Check | Command | Success |
|-------|---------|---------|
| Tests | `npm run test` | All pass |
| Types | `npm run typecheck` | No errors |
| Lint | `npm run lint` | No errors |
| Local release gate | `npm run prelaunch` | Safe local gate passes; live integration remains explicit |
| Verification wiring | `npm run check-verification-coverage` | Explicit coverage check passes |
| Env docs | `npm run check-env` | Required env vars are documented |
| Migrations | `npm run check-migrations` | Migration checks pass |
| Live integration | `npm run prelaunch:live` | Real Stripe happy path passes; no skipped critical path |
| Build | `npm run build` | Completes |
| Browser E2E | `npm run test:e2e` | Desktop, mobile, and QA journey projects pass |
| Health | `curl .../api/health` | HTTP 200, `status: healthy`, and `sentry.status: configured` |
| Site | `curl -w "%{http_code}" .../` | 200 (after launch) |

## Upptime Status Page

- **Repo**: https://github.com/juan294/paisaxe-upptime
- **Status page**: https://juan294.github.io/paisaxe-upptime/
- **Monitors**: `paisaxe.es` and `paisaxe.es/api/health/live` every 5 minutes
- **Machine gate behavior**: `/api/health/live` is liveness-only and always returns HTTP 200. Release gates and preview smoke tests use `/api/health` and must parse `status: "healthy"` plus `sentry.status: "configured"`.
- Opens GitHub Issues automatically on detected downtime
- Reference config kept in `.github/upptime/.upptimerc.yml`

## Vercel Speed Insights

Real User Monitoring (RUM) for Core Web Vitals in production. View data in the Vercel Dashboard under Speed Insights.

## Stories Cache Hit-Rate

`getStoriesServer()` (`src/lib/stories-server.ts`) fetches approved stories via the Supabase REST API wrapped in Next.js's `revalidate: 60` data cache. Because we run in a single Vercel region (`fra1`), the effective cache hit-rate is the main lever for keeping Supabase read load and latency low.

**Telemetry:** every time the function bypasses the data cache and performs a real Supabase fetch, it emits a structured `info` event:

```
[STORIES_CACHE_MISS]  { table: "stories", count: 1 }
```

A request served from the `revalidate` cache does **not** run the fetch, so it emits **no** event. The miss-rate is therefore `count([STORIES_CACHE_MISS]) / total story-page renders`, and the hit-rate is `1 − miss-rate`.

**Log-drain query** (Vercel log drain / aggregator):

```
msg:[STORIES_CACHE_MISS]
```

**How to read it:**
- A miss every ~60 s under steady traffic is expected — that is the revalidate window expiring.
- A burst of misses with no corresponding traffic spike suggests the data cache is being skipped (e.g. `cache: "no-store"` leaking into production, or the revalidate window being bypassed). Investigate the fetch options in `stories-server.ts`.
- Misses paired with `[STORIES_FALLBACK]` or `[TABLE_FALLBACK]` events mean Supabase reads are failing — follow the alerting-runbook "Health Endpoint Degraded" procedure.

## Function Region Verification

Verified on **2026-04-23**:

- Vercel function region: `fra1` (Frankfurt) via `vercel.json`
- Linked Supabase project: `asturias`
- Supabase region: `Central Europe (Zurich)` via `supabase projects list`

Vercel's current public region list does not expose a Zurich function region, so `fra1` is the nearest supported region and replaces the previous `cdg1` setting.

## Database Maintenance (pg_cron)

Automated maintenance jobs run on Supabase via pg_cron:

| Job | Schedule | Migration | Description |
|-----|----------|-----------|-------------|
| `vacuum-analyze-chunks` | Sundays 3:00 AM UTC | 011 | VACUUM ANALYZE on chunks table |
| `analyze-main-tables` | Daily 4:00 AM UTC | 011 | ANALYZE on chunks, images, stories |
| `cleanup-cron-history` | Sundays 5:00 AM UTC | 011 | Delete cron history older than 30 days |
| `keep-alive` | Every 3 days 12:00 PM UTC | 012 | Database activity safeguard |
| `edge-keep-alive` | Every 3 days 12:00 PM UTC | 014 | Call keep-alive Edge Function via pg_net |
| `content-discovery` | Weekly Monday 3:00 AM UTC (`0 3 * * 1`) | Vercel Cron | Discovers new Asturias places via Google Places API |
| `fail-stale-translations` | Every 15 minutes (`*/15 * * * *`) | Vercel Cron | Mark stories stuck in `translating` state as failed |
| `fail-stale-bookings` | Every 5 minutes (`*/5 * * * *`) | Vercel Cron | Mark bookings stuck in a pending/in-progress state as failed |
| `github-traffic-sync` | Every 6 hours (`0 */6 * * *`) | Vercel Cron | Sync GitHub traffic stats to admin dashboard |
| `subscription-optimizer` | Weekly Monday 4:00 AM UTC (`0 4 * * 1`) | Vercel Cron | Analyze service costs and spending |
| `retry-booking-sms` | Every 10 minutes (`*/10 * * * *`) | Vercel Cron | Retry failed booking SMS confirmations (up to 3 attempts per job) |

The Vercel Cron schedules above mirror `vercel.json` exactly — keep both in sync when adding or rescheduling a job.

Verify jobs: `SELECT jobname, schedule, command FROM cron.job ORDER BY jobname;`

## Database Webhooks (pg_net)

Database webhooks fire HTTP requests when rows change, using the `pg_net` extension (migration `013_database_webhooks.sql`). Webhooks call `POST /api/webhooks/supabase` on the Next.js app to trigger cache invalidation.

| Table | Event | Effect |
|-------|-------|--------|
| `stories` | UPDATE | Revalidates `/immersive` and `/sitemap.xml` |
| `feature_flags` | UPDATE | Revalidates `/api/feature-flags` |

Setup: Configure `app.webhook_base_url` and `app.webhook_secret` in Supabase SQL Editor.

Webhook configuration is stored in the `webhook_config` table (Supabase restricts `ALTER DATABASE` commands):
```sql
-- View current config
SELECT * FROM webhook_config;

-- Update webhook URL (use Supabase API with service role key)
UPDATE webhook_config SET value = 'https://paisaxe.es' WHERE key = 'base_url';
```

## Supabase Realtime

Realtime subscriptions provide live updates to browser sessions (200 concurrent connections, 2M messages/month included).

| Subscription | Module | Purpose |
|-------------|--------|---------|
| Feature flags | `src/hooks/use-realtime-feature-flags.ts` | Live flag sync when admin toggles |

Utilities in `src/lib/realtime.ts` provide generic `subscribeToTable()` and specific `subscribeToFeatureFlags()` helpers.

## Supabase Edge Functions

Deno-based Edge Functions in `supabase/functions/` (500K invocations/month included). Scheduled via pg_cron + pg_net.

| Function | Purpose | Schedule |
|----------|---------|----------|
| `keep-alive` | Queries active stories to generate database activity | Every 3 days |

Deploy: `supabase functions deploy keep-alive`

Edge Function settings are configured in the Supabase database:
```sql
ALTER DATABASE postgres SET app.supabase_functions_url = 'https://YOUR_PROJECT_REF.supabase.co/functions/v1';
ALTER DATABASE postgres SET app.service_role_key = 'YOUR_SERVICE_ROLE_KEY';
```

See `supabase/functions/README.md` for full setup instructions.

## Automated Agents

Local agents run via macOS launchd and are controlled by a local config file (`scripts/agent-config.json`). This file is gitignored — defaults are tracked in `scripts/agent-config.defaults.json`. Agents read flags via `jq` at startup — no HTTP/API dependency.

### Local Config Control

Manage via CLI:
```bash
scripts/agent-ctl.sh status              # Show all flags
scripts/agent-ctl.sh enable <key|all>    # Enable agent(s)
scripts/agent-ctl.sh disable <key|all>   # Disable agent(s)
scripts/agent-ctl.sh master on|off       # Master toggle
scripts/agent-ctl.sh reset               # Reset to defaults
```

Or via the admin dashboard (dev-only): **Admin → Agents → Agent Toggles**.

The `master_enabled` flag stops all agents. Individual flags control each agent independently.

### Agent Scripts

| Agent | Script | Schedule | Output |
|-------|--------|----------|--------|
| Coverage | `scripts/coverage-agent.sh` | Daily 2:00 AM | `docs/agents/coverage-report.md` |
| Security | `scripts/security-agent.sh` | Weekly Monday 9:00 AM | `docs/agents/security-report.md` |
| Documentation | `scripts/documentation-agent.sh` | Weekly Sunday 6:00 AM | `docs/agents/documentation-report.md` |
| Performance | `scripts/performance-agent.sh` | Weekly Saturday 10:00 AM | `docs/agents/performance-report.md` |
| QA | `scripts/qa-agent.sh` | Weekly Sunday 8:00 AM | `docs/agents/qa-report.md` |
| Localization | `scripts/localization-agent.sh` | Weekly Sunday 7:00 AM | `docs/agents/localization-report.md` |
| Cost Analyst | `scripts/cost-analyst-agent.sh` | Daily 3:00 AM | `docs/agents/cost-analyst-report.md` |

Shared utilities in `scripts/lib/agent-utils.sh` provide feature flag checking, logging, and startup logic.

### Launchd Plists

Located in `~/Library/LaunchAgents/`:
- `com.paisaxe.coverage-agent.plist`
- `com.paisaxe.security-agent.plist`
- `com.paisaxe.documentation-agent.plist`
- `com.paisaxe.performance-agent.plist`
- `com.paisaxe.qa-agent.plist`
- `com.paisaxe.localization-agent.plist`
- `com.paisaxe.cost-analyst-agent.plist`

Load/unload agents:
```bash
# Load an agent
launchctl load ~/Library/LaunchAgents/com.paisaxe.security-agent.plist

# Unload an agent
launchctl unload ~/Library/LaunchAgents/com.paisaxe.security-agent.plist

# Run immediately (for testing)
launchctl start com.paisaxe.security-agent
```

Unlike cron, launchd runs missed jobs when the Mac wakes from sleep. Logs written to `logs/`.

### Agent Descriptions

- **Coverage Agent**: Runs nightly. Uses Claude CLI to analyze test coverage and write missing tests. Updates `docs/agents/coverage-report.md`.
- **Security Agent**: Runs weekly. Performs `npm audit`, license checking, copyleft detection, and outdated package reports.
- **Documentation Agent**: Runs weekly. Checks for stale docs, new migrations needing documentation, undocumented API routes and feature flags.
- **Performance Agent**: Runs weekly. Analyzes bundle sizes, Lighthouse scores, Core Web Vitals, dependency counts, and disk usage.
- **QA Agent**: Runs weekly. Automated LLM testing for RAG quality, safety, content boundaries, and response quality. Budget-conscious sampling (configurable via `testsPerCategory` in feature flag config). See `docs/testbed.md` for full test catalog.
- **Localization Agent**: Runs weekly. Ensures 100% translation coverage across all 6 locales (es, en, fr, de, pt, ast). Detects missing UI strings and story translations, then auto-fills gaps. Spanish is source of truth.
- **Cost Analyst Agent**: Runs daily. Queries billing APIs (Anthropic, ElevenLabs, Twilio), analyzes spending trends, detects anomalies (>20% spikes, tier proximity), forecasts costs at 1x/3x/10x growth, and writes a structured financial health report.

## CI/CD Workflows

Automated quality checks run on every push and pull request to `develop` and `main`.

### Core CI (`ci.yml`)

| Job | Description |
|-----|-------------|
| **lint-and-typecheck** | Runs `npm run typecheck`, `npm run check-verification-coverage`, `npm run lint`, `npm run check-env`, migration validation (`npm run check-migrations`), and circular-dependency check (`madge --circular`) |
| **test** | Runs `npm run test` |
| **build** | Verifies production build with `npm run build` |

### E2E Tests (`e2e.yml`)

Playwright E2E tests run against a built app on push/PR to `develop` and `main`.

### Stripe E2E Integration (`e2e-stripe-integration.yml`)

Runs the real Stripe test-mode checkout path on nightly schedule, manual dispatch, and PRs touching checkout/webhook/Stripe code. Normal PR behavior still skips when repository secrets are unavailable. Manual dispatch defaults `require_live_gate` to true, which fails the workflow if any required Stripe/Supabase QA secret is missing.

### Preview Smoke Test (`preview-smoke.yml`)

On PRs targeting `main`, waits for the Vercel preview deployment and runs `scripts/check-health-readiness.mjs "$PREVIEW_URL" --require-sentry` against real env vars before hitting the homepage. This is a **required status check** — `Smoke test Vercel preview` must pass before any merge to `main`. It catches runtime failures that dummy-key CI builds cannot detect (e.g. the 2026-03-24 Next.js 16.2.1 incident).

### Quality & Security Workflows

| Workflow | Trigger | Description |
|----------|---------|-------------|
| **Security Audit** (`security.yml`) | Push/PR + daily 08:00 UTC | `npm audit --omit=dev --audit-level=moderate`; also runs `vercel-env-safety` |
| **Gitleaks** (job in `security.yml`) | Push/PR + daily 08:00 UTC | Scans for secrets in git history |
| **License Check** (`license-check.yml`) | PRs only | Blocks copyleft/GPL dependencies |
| **Lighthouse CI** (`lighthouse.yml`) | PRs only | Performance & accessibility auditing |
| **Bundle Size** (`bundle-size.yml`) | PRs only | Reports JS bundle sizes as PR comment |
| **Knip** (`knip.yml`) | PRs only | Dead code & unused dependency detection. Scans `src/**` and `scripts/**` (the `scripts/` tree is declared as `entry` because those files are CLI executables invoked externally via `npx tsx`, launchd `.sh` agents, and docs — not imported by the app, so they must be treated as roots). `supabase/functions/**` is intentionally **out of scope**: they are Deno Edge Functions using Deno-global APIs and `https://` URL imports that knip's Node resolver cannot parse (including them yields false "unresolved import" errors); they are covered by their own Deno tooling instead. |
| **Claude Review** (`claude-review.yml`) | PRs + `@claude` in PR comments | AI-powered code review |

### Dependency Management

**Dependabot** (`.github/dependabot.yml`) opens PRs weekly for npm and GitHub Actions dependencies.

### Fixing CI Failures

1. **Typecheck failures**: Run `npm run typecheck` locally, fix type errors
2. **Lint failures**: Run `npm run lint` locally, fix or run `npm run lint -- --fix`
3. **Test failures**: Run `npm run test` locally, fix failing tests
4. **Build failures**: Run `npm run build` locally, check for build-time errors
5. **E2E failures**: Run `npm run test:e2e` locally, inspect `playwright-report/` for traces
6. **License failures**: Run `npx license-checker --production --failOn "GPL-2.0;GPL-3.0;AGPL-3.0"` to identify problematic deps
7. **Gitleaks failures**: Remove the detected secret from code and rotate the exposed credential

### Notes

- Build jobs use dummy env vars (APIs not called during build)
- Vercel deployment is handled separately via Vercel's GitHub integration
- Database migrations should be validated locally before pushing
- Claude Review requires `ANTHROPIC_API_KEY` as a GitHub repository secret

## Stripe Payments

Voice Pass purchases processed via Stripe, three tiers (see `src/lib/pricing.ts`, the single source of truth for pricing):

| Tier | Price | Duration |
|------|-------|----------|
| Day Pass | €1.99 | 24 hours |
| Weekly Pass | €4.99 | 7 days |
| Monthly Pass | €9.99 | 30 days |

### Setup

1. Create a Stripe account at [stripe.com](https://stripe.com)
2. Create three products in the Stripe Dashboard: "Voice Pass - 24h" at €1.99, "Voice Pass - 7 days" at €4.99, "Voice Pass - 30 days" at €9.99
3. Copy each Price ID (starts with `price_`)
4. Create a webhook endpoint pointing to `/api/webhooks/stripe`
5. Select `checkout.session.completed` event
6. Copy the webhook signing secret (starts with `whsec_`)

### Environment Variables

```
STRIPE_SECRET_KEY=sk_live_...           # Server-side API key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...  # Client-side key
STRIPE_WEBHOOK_SECRET=whsec_...         # Webhook signature verification
STRIPE_DAY_PASS_PRICE_ID=price_...      # Price ID for Day Pass (24h, €1.99)
STRIPE_WEEKLY_PRICE_ID=price_...        # Price ID for Weekly Pass (7 days, €4.99)
STRIPE_MONTHLY_PRICE_ID=price_...       # Price ID for Monthly Pass (30 days, €9.99)
```

### Webhook Testing (Local)

Use the Stripe CLI for local webhook testing:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

### Admin Analytics

Revenue analytics are available in the admin panel under Analytics → Revenue tab, pulling data directly from Stripe's API.

**Caching** — All analytics API routes (`/api/admin/analytics`, `/api/admin/elevenlabs-analytics`, `/api/admin/stripe-analytics`, `/api/admin/costs-analytics`) return `Cache-Control: private, max-age=120, stale-while-revalidate=300`. The client-side `AnalyticsCacheProvider` maintains an in-memory cache with a 2-minute stale time. Cache is invalidated on manual refresh or after CRUD mutations (costs panel).

## Proxy Architecture

Request interception uses `src/proxy.ts` (Next.js 16 replacement for `middleware.ts`). The middleware chain order is: canonical-domain → maintenance → CORS → CSP → CSRF → auth-refresh → request-id. `/story/[slug]` is no longer proxy-rewritten (see FE-H2 / #760) — it is a real App Router page subject to the same chain as any other route.

See [proxy-architecture.md](./proxy-architecture.md) for the full module map.

---

## ElevenLabs Voice Agents

Voice agents for the Paisaxe experience. Configs are tracked in git via the ElevenLabs CLI — see [elevenlabs-agents-as-code.md](./elevenlabs-agents-as-code.md) for the workflow.

Configured in `src/config/elevenlabs-agents.ts`.

### Agents

| Agent | Purpose | Language | Config |
|-------|---------|----------|--------|
| **Pelayo** | Tourism guide for immersive stories | Spanish/English | [Detailed config](./elevenlabs-pelayo-config.md) |
| **Pelayo (Booking)** | Outbound calls to make reservations | Spanish | [Booking config](./pelayo-booking-system-prompt.md) |
| Xander | X/Twitter marketing | English | Marketing prompt |
| Iris | Instagram marketing | English | Marketing prompt |
| Penny | Pinterest marketing | English | Marketing prompt |

### Visitor Voice Access

Controlled by the `visitor_voice_agent` feature flag in admin panel:

1. Enable the feature flag
2. Set the ElevenLabs Agent ID (Pelayo's ID)
3. Whitelist specific user emails
4. Users must sign in with Google OAuth to access voice

### Booking System

Pelayo can make outbound calls to restaurants/hotels to book reservations. Controlled by `booking_system` feature flag.

**Flow:**
1. User asks Pelayo to book a restaurant
2. Pelayo collects details (party size, date, time, name, phone)
3. `make_booking` tool initiates call via ElevenLabs + Twilio
4. Booking agent (Pelayo Booking) speaks with the restaurant
5. Post-call webhook sends SMS confirmation to user

**SMS Confirmation** (requires `sms_booking_confirmation` flag):
- ElevenLabs sends post-call webhook to `/api/webhooks/elevenlabs`
- Webhook analyzes transcript for outcome (confirmed/denied/no_answer)
- SMS sent to customer via Twilio with result

See [elevenlabs-pelayo-config.md](./elevenlabs-pelayo-config.md) for full booking and SMS configuration.

### Setup Script

```bash
# Create all voice agents in ElevenLabs
npx ts-node scripts/setup-elevenlabs-agents.ts
```

Requires `ELEVENLABS_API_KEY` in `.env.local`.

### Console Configuration

For manual ElevenLabs console configuration, see [elevenlabs-pelayo-config.md](./elevenlabs-pelayo-config.md).
