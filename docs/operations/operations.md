# Paisaxe Operations Guide

Detailed documentation for database maintenance, monitoring, webhooks, and automated agents.

## Health Check Endpoint

`GET /api/health` — returns service status, uptime, Supabase connectivity with latency, and database storage usage (size in MB, percentage of 8 GB Pro tier limit). Reports "degraded" if Supabase connection fails or database usage exceeds 80%. Always returns HTTP 200. Used by Upptime for uptime monitoring.

## Pre-Launch Checklist

Run this checklist before every production release. Invoke with: "Run the pre-launch checklist from operations.md"

### 1. Code Quality Gates

Run all quality checks in parallel:

```bash
npm run test           # All tests must pass
npm run typecheck      # No TypeScript errors
npm run lint           # No linting errors
npm run build          # Production build succeeds
```

**Expected results:**
- Tests: All passing (currently ~2000 tests)
- TypeScript: Exit code 0, no output
- Lint: Exit code 0, no output
- Build: "Generating static pages" completes successfully

### 2. Health Endpoint

```bash
curl -s https://paisaxe.es/api/health | jq
```

**Verify:**
- `status`: "healthy"
- `services.supabase.status`: "connected"
- `services.supabase.latency_ms`: < 1000ms
- `services.database.usage_percent`: < 80%

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
| Build | `npm run build` | Completes |
| Health | `curl .../api/health` | status: healthy |
| Site | `curl -w "%{http_code}" .../` | 200 (after launch) |

## Upptime Status Page

- **Repo**: https://github.com/juan294/paisaxe-upptime
- **Status page**: https://juan294.github.io/paisaxe-upptime/
- **Monitors**: `paisaxe.es` and `paisaxe.es/api/health` every 5 minutes
- Opens GitHub Issues automatically on detected downtime
- Reference config kept in `.github/upptime/.upptimerc.yml`

## Vercel Speed Insights

Real User Monitoring (RUM) for Core Web Vitals in production. View data in the Vercel Dashboard under Speed Insights.

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
- **Localization Agent**: Runs weekly. Ensures 100% translation coverage across all 5 locales (es, en, fr, de, pt). Detects missing UI strings and story translations, then auto-fills gaps. Spanish is source of truth.
- **Cost Analyst Agent**: Runs daily. Queries billing APIs (Anthropic, ElevenLabs, Twilio), analyzes spending trends, detects anomalies (>20% spikes, tier proximity), forecasts costs at 1x/3x/10x growth, and writes a structured financial health report.

## CI/CD Workflows

Automated quality checks run on every push and pull request to `develop` and `main`.

### Core CI (`ci.yml`)

| Job | Description |
|-----|-------------|
| **lint-and-typecheck** | Runs `npm run typecheck` and `npm run lint` |
| **test** | Runs `npm run test` |
| **build** | Verifies production build with `npm run build` |

### E2E Tests (`e2e.yml`)

Playwright E2E tests run against a built app on push/PR to `develop` and `main`.

### Quality & Security Workflows

| Workflow | Trigger | Description |
|----------|---------|-------------|
| **Security Audit** (`security.yml`) | Push/PR + weekly Monday 08:00 UTC | `npm audit --audit-level=critical` |
| **Gitleaks** (`gitleaks.yml`) | Push/PR + daily 04:00 UTC | Scans for secrets in git history |
| **License Check** (`license-check.yml`) | PRs only | Blocks copyleft/GPL dependencies |
| **Lighthouse CI** (`lighthouse.yml`) | PRs only | Performance & accessibility auditing |
| **Bundle Size** (`bundle-size.yml`) | PRs only | Reports JS bundle sizes as PR comment |
| **Knip** (`knip.yml`) | PRs only | Dead code & unused dependency detection |
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

Voice Pass purchases (24h voice access for €1.99) processed via Stripe.

### Setup

1. Create a Stripe account at [stripe.com](https://stripe.com)
2. Create a product "Voice Pass - 24h" at €1.99 in the Stripe Dashboard
3. Copy the Price ID (starts with `price_`)
4. Create a webhook endpoint pointing to `/api/webhooks/stripe`
5. Select `checkout.session.completed` event
6. Copy the webhook signing secret (starts with `whsec_`)

### Environment Variables

```
STRIPE_SECRET_KEY=sk_live_...           # Server-side API key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...  # Client-side key
STRIPE_WEBHOOK_SECRET=whsec_...         # Webhook signature verification
STRIPE_DAY_PASS_PRICE_ID=price_...      # Price ID for Day Pass
```

### Webhook Testing (Local)

Use the Stripe CLI for local webhook testing:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

### Admin Analytics

Revenue analytics are available in the admin panel under Analytics → Revenue tab, pulling data directly from Stripe's API.

**Caching** — All analytics API routes (`/api/admin/analytics`, `/api/admin/elevenlabs-analytics`, `/api/admin/stripe-analytics`, `/api/admin/costs-analytics`) return `Cache-Control: private, max-age=120, stale-while-revalidate=300`. The client-side `AnalyticsCacheProvider` maintains an in-memory cache with a 2-minute stale time. Cache is invalidated on manual refresh or after CRUD mutations (costs panel).

## ElevenLabs Voice Agents

Voice agents for the Paisaxe experience, configured in `src/config/elevenlabs-agents.ts`.

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
