# Paisaxe

**Look. Ask. Explore.**

An immersive tourism experience for Asturias, Spain. Visitors explore the region through full-screen visual stories and can ask questions via voice or text to learn more about each location.

**Domains**: paisaxe.com, paisaxe.es

---

## Project Charter: The Soul of Paisaxe

This charter is the north star for all design and implementation decisions.

### Origin Story

Paisaxe was born from a personal need. After moving to Asturias, the founder was overwhelmed by the sheer beauty and depth of the region - mountains, sea, food, culture, activities. There's so much to discover, but no easy way to discover it.

Beautiful tourism content exists - carefully crafted PDF guides with stunning photography and detailed descriptions - but it's buried at the bottom of websites. Static. Boring. You can't interact with it. You can't ask questions. You can't adapt it to your needs.

Paisaxe brings that content to life. **You see a beautiful image. You talk to it. You discover more.**

### The Core Experience

**See it. Ask it. Go.**

1. Visitor lands on the site
2. A carousel of stunning images moves slowly - landscapes, dishes, villages, activities
3. Something catches their eye - they feel inspired, curious, excited
4. They tap and ask: *"Where is this? Can I bring my kids? How do I get there?"*
5. Paisaxe answers - knowledgeable, friendly, helpful
6. They save it for later or share it with someone

That's it. One thing, done exceptionally well.

### Who Is Paisaxe For?

Anyone who wants to discover Asturias.

- Tourists researching Spain who stumble upon this hidden region
- Travelers who've heard of Asturias and want to know what to do
- Families, solo travelers, couples, young and old
- Anyone with a device who sees a beautiful image and wants to know more

It's aspirational: *"This place is so beautiful, I want to go there. This food looks amazing, I want to eat there."*

### The Emotional Journey

When someone uses Paisaxe, they should feel:

- **Inspired** by stunning visuals
- **Curious** to learn more
- **Excited** to explore and discover
- **Hopeful** and adventurous

Like standing at a mountain viewpoint - the vast beauty of Asturias spread before you, inviting you to explore.

### The Voice of Paisaxe

When users talk to Paisaxe, it responds as:

- A **knowledgeable guide** - but never stuffy or lecturing
- **Friendly and warm** - like a local showing you their favorite spots
- **Human** - uses "I", feels personal, not robotic
- **Inclusive** - asks how to address the visitor, respects everyone

**The voice avoids:**
- Corporate or formal language
- Tourist clichés ("hidden gem", "off the beaten path")
- Salesy or promotional tone
- Information overload - answers are focused and helpful

### What Paisaxe Is NOT

- **Not a booking engine** - no hotels, flights, or transactions
- **Not a comparison site** - no "top 10 hotels" lists
- **Not cluttered** - no ads, no noise, no typical tourism board feel
- **Not overwhelming** - not 500 things to do, just beautiful discovery
- **Not a business** - no monetization, no commercial agenda

### Design Principles

| Principle | Meaning |
|-----------|---------|
| **Mountain viewpoint** | The visual metaphor - arrive, take in the beauty, then choose where to explore |
| **Images first** | Photography is the hero, not text or UI chrome |
| **Conversation is the interface** | Talking (voice or text) is how you discover, not clicking through menus |
| **Simplicity** | One thing done well beats ten things done poorly |
| **Respect the source** | Always attribute images and information to original creators |

### Success Looks Like

A year from now, if Paisaxe is working:

- People planning an Asturias trip come here first
- It gets shared because it's stunning and delightful
- It's featured for being innovative in how you browse and discover
- Local places ask to be included
- Other regions want something similar for their area
- Others copy the style - because we created something fresh

### Core Values

1. **Discovery over commerce** - help people find beauty, not sell them things
2. **Simplicity over features** - resist the urge to add more
3. **Respect over extraction** - honor the original content creators
4. **Personal over corporate** - this is a labor of love, not a business

### Tagline

**"Look. Ask. Explore."**

*Other candidates considered: "Talk to the landscape", "See it. Ask it. Go.", "Where beauty answers back", "The view that talks back"*

---

## Project Overview

- **Purpose**: Informative tourism site (no bookings)
- **Content Source**: 37 PDFs in `content/pdfs/` with curated tourism info
- **Interface**: Immersive visual stories with swipe navigation + voice/text chat
- **Languages**: UI in Spanish; chat responds in visitor's language

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS + shadcn/ui |
| Database | Supabase (PostgreSQL + pgvector) |
| AI Chat | Claude API (Anthropic) |
| Embeddings | Voyage AI (voyage-3) |
| Reranking | Voyage AI (rerank-2.5) |
| Voice Agents | ElevenLabs Conversational AI |
| Testing | Vitest + React Testing Library + Playwright |
| Deployment | Vercel |

## Git Workflow

**IMPORTANT: Always work on `develop` branch. Only merge to `main` for production releases.**

```bash
# Branch structure
main      # Production releases only
develop   # Active development (DEFAULT)
```

### Workflow Rules

1. **All development happens on `develop`**
2. **Never commit directly to `main`**
3. **Merge `develop` → `main` only when releasing to production**
4. **Always run tests before committing**

### Commit Process

```bash
# Before committing
npm run test           # Run all tests
npm run typecheck      # Check types
npm run lint           # Check linting

# Commit with descriptive message
git add <files>
git commit -m "feat: description"
```

### Release Process

```bash
git checkout main
git merge develop
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin main --tags
git checkout develop
```

## CI/CD (GitHub Actions)

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
| **Knip** (`knip.yml`) | PRs only | Dead code & unused dependency detection (report mode) |
| **Claude Review** (`claude-review.yml`) | PRs + `@claude` in PR comments | AI-powered code review via Claude |

### Dependency Management

**Dependabot** (`.github/dependabot.yml`) opens PRs weekly for:
- npm production dependencies
- npm dev/type dependencies
- GitHub Actions versions

Review and merge Dependabot PRs regularly. License Check runs automatically on these PRs.

### Required Checks

All core CI jobs must pass before merging:
- Lint & Typecheck
- Test
- Build
- E2E (Playwright)

Quality workflows (Lighthouse, Bundle Size, Knip) are informational and do not block merges, but should be reviewed on every PR.

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

## Test-Driven Development (TDD)

**NO feature ships without a test written first. No exceptions.**

This is non-negotiable. Every new feature, bug fix, or change begins with a failing test. Write the test, watch it fail, then write the code to make it pass. This isn't bureaucracy - it's how we maintain quality while moving fast.

### TDD Workflow

1. **Red**: Write a failing test FIRST - before any implementation code
2. **Green**: Write the minimal code to make the test pass
3. **Refactor**: Clean up while keeping tests green

If you're about to write a feature and haven't written a test yet - STOP. Write the test first.

### Test Commands

```bash
# Unit & Component tests (Vitest)
npm run test           # Run all tests
npm run test:watch     # Watch mode for development
npm run test:coverage  # Generate coverage report
npm run test:ui        # Open Vitest UI

# E2E tests (Playwright)
npm run test:e2e       # Run all E2E tests (headless)
npm run test:e2e:ui    # Open Playwright UI mode
npm run test:e2e:headed # Run with visible browser
npm run test:e2e:debug # Debug mode with inspector
```

### Test File Conventions

- **Unit/Component tests**: `*.test.ts` or `*.test.tsx`, located next to source files
- **E2E tests**: `*.spec.ts` in the `e2e/` directory
- E2E mock data lives in `e2e/fixtures/mock-data.ts`
- E2E has its own `e2e/tsconfig.json` (excluded from the app build)

### What to Test

- **Components**: Rendering, user interactions, state changes
- **API routes**: Request/response handling, error cases
- **Lib functions**: Embeddings, search, data transformations
- **Integration**: Chat flow end-to-end

## Project Structure

```
paisaxe/
├── e2e/                        # Playwright E2E tests
│   ├── fixtures/               # Mock data for E2E
│   └── *.spec.ts               # Test files
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── page.tsx            # Redirects to /immersive
│   │   ├── layout.tsx          # Root layout (includes SpeedInsights)
│   │   ├── immersive/          # Immersive stories page
│   │   └── api/
│   │       ├── chat/           # Chat endpoint
│   │       ├── health/         # Health check endpoint (uptime monitoring)
│   │       ├── admin/
│   │       │   └── elevenlabs-analytics/  # Voice agent metrics API
│   │       └── webhooks/
│   │           └── supabase/   # Database webhook receiver (cache invalidation)
│   ├── components/
│   │   ├── ui/                 # shadcn/ui components
│   │   ├── admin/              # Admin panel components
│   │   │   └── elevenlabs-analytics-panel.tsx  # Voice agent metrics
│   │   └── immersive/          # Story viewer & voice chat
│   │       └── voice-chat-elevenlabs.tsx  # ElevenLabs voice UI
│   ├── config/
│   │   └── elevenlabs-agents.ts  # Voice agent IDs configuration
│   ├── hooks/
│   │   ├── use-admin-role.ts              # Client-side admin role check (RBAC)
│   │   ├── use-realtime-feature-flags.ts  # Live feature flag sync via Realtime
│   │   ├── use-realtime-stories.ts        # Live story update notifications
│   │   └── use-visitor-voice-access.ts    # Voice agent feature flag check
│   ├── lib/
│   │   ├── supabase.ts         # Supabase client
│   │   ├── supabase-browser.ts # Browser Supabase client (SSR)
│   │   ├── realtime.ts         # Supabase Realtime subscription utilities
│   │   ├── claude.ts           # Claude API wrapper
│   │   ├── embeddings.ts       # Voyage AI embeddings
│   │   ├── search.ts           # Vector search logic
│   │   ├── rerank.ts           # Voyage AI reranker (rerank-2.5)
│   │   └── stories-data.ts     # Story content data
│   └── types/
│       ├── index.ts            # Core TypeScript types
│       ├── immersive.ts        # Immersive mode types
│       └── elevenlabs-analytics.ts  # Voice agent analytics types
├── content/
│   └── pdfs/                   # Source PDF files
├── scripts/
│   ├── coverage-agent.sh       # Nightly coverage analysis (launchd)
│   ├── process-pdfs.ts         # PDF text extraction
│   └── seed-database.ts        # Generate embeddings and populate DB
├── supabase/
│   ├── functions/              # Supabase Edge Functions (Deno)
│   │   ├── keep-alive/         # Prevents free-tier auto-pause
│   │   └── cleanup-analytics/  # Deletes old analytics events
│   └── migrations/             # Database schema (including pg_cron)
├── .github/
│   ├── workflows/              # 9 CI/CD workflows (see CI/CD section)
│   ├── dependabot.yml          # Automated dependency updates
│   └── upptime/                # Reference config for status page
├── knip.json                   # Dead code detection config
├── lighthouserc.json           # Lighthouse CI thresholds
├── vitest.config.ts            # Unit test configuration
└── playwright.config.ts        # E2E test configuration
```

## Key Commands

```bash
# Development
npm run dev              # Start development server
npm run build            # Production build
npm run typecheck        # Run TypeScript checks
npm run lint             # Run ESLint

# Unit & Component Testing (Vitest)
npm run test             # Run all tests
npm run test:watch       # Watch mode
npm run test:coverage    # Coverage report

# E2E Testing (Playwright)
npm run test:e2e         # Run E2E tests (headless)
npm run test:e2e:headed  # Run with visible browser
npm run test:e2e:ui      # Playwright UI mode

# Data Pipeline
npm run process-pdfs     # Extract content from PDFs
npm run seed-db          # Generate embeddings and populate database
npm run seed-db:clear    # Clear and re-seed database
```

## Environment Variables

Required in `.env.local`:
```
# AI Services
ANTHROPIC_API_KEY=       # Claude API key
VOYAGE_API_KEY=          # Voyage AI key for embeddings
ELEVENLABS_API_KEY=      # ElevenLabs voice agents (optional)

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=    # Service role key (for seeding)

# Google OAuth (used by Supabase Auth)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Database Webhooks
WEBHOOK_SECRET=          # Secret for validating Supabase webhook calls

# Site URL (use production URL on Vercel, localhost in dev)
NEXT_PUBLIC_SITE_URL=
```

These variables are configured in three places:
- **`.env.local`** — local development
- **Vercel** — production & preview deployments (all vars set)
- **GitHub Secrets** — only `ANTHROPIC_API_KEY` (for Claude PR reviews)

Additionally, the following settings are configured in the Supabase database via SQL:
```sql
ALTER DATABASE postgres SET app.webhook_base_url = 'https://paisaxe.com';
ALTER DATABASE postgres SET app.webhook_secret = 'your-webhook-secret';
ALTER DATABASE postgres SET app.supabase_functions_url = 'https://YOUR_PROJECT_REF.supabase.co/functions/v1';
ALTER DATABASE postgres SET app.service_role_key = 'YOUR_SERVICE_ROLE_KEY';
```

## Architecture Decisions

### Embeddings (Voyage AI)
- Model: `voyage-3` (512 dimensions via Matryoshka)
- Contextualized embeddings: chunks from the same PDF are embedded with sibling awareness
- Query embeddings: same model (`voyage-3`) with `outputDimension: 512`
- Batch processing: 128 texts per request, exponential backoff on 429
- Cost: ~$0.00018 per 1000 tokens (contextualized)

### Reranking (Voyage AI)
- Model: `rerank-2.5` (200M free tokens/month)
- Two-stage retrieval: fetch 10 vector candidates, rerank to top 3
- Graceful fallback: returns original order on rerank failure

### Vector Search
- Store in Supabase pgvector with 512 dimensions
- Hybrid search: vector similarity + keyword matching for place names
- Match threshold: 0.7 similarity

### Chat Flow
1. User sends query
2. Generate embedding via Voyage AI (`voyage-3`, 512 dims)
3. Find top-10 candidate chunks via vector search
4. Rerank candidates to top-3 via Voyage AI `rerank-2.5`
5. Pass reranked chunks as context to Claude
6. Claude generates response with references
7. Render response with linked images

### Response Rendering
- Support markdown in responses
- Display related images from PDFs inline
- Show source attribution (which guide, which section)

### Voice Agents (ElevenLabs)
ElevenLabs Conversational AI powers interactive voice guides for immersive storytelling:
- **Pelayo** - Default visitor guide for story exploration
- WebSocket-based real-time voice streaming
- Automatic speech recognition + text-to-speech
- Conversation transcript displayed alongside voice UI
- Gated by `visitor_voice_agent` feature flag (toggle in admin panel)
- Agent IDs configured in `src/config/elevenlabs-agents.ts`
- Admin analytics dashboard shows conversation metrics, agent usage, and active calls

## Code Style

- Use ES modules (import/export)
- Prefer named exports over default exports
- Use `async/await` over `.then()` chains
- Components: PascalCase, files: kebab-case
- API routes return typed responses with proper error handling

## Database Schema

```sql
-- chunks table for PDF content (512 dims for voyage-3 Matryoshka)
create table chunks (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  embedding vector(512),
  source_pdf text not null,
  page_number int,
  section_title text,
  image_refs text[],
  metadata jsonb,
  created_at timestamptz default now()
);

-- images table for extracted PDF images
create table images (
  id uuid primary key default gen_random_uuid(),
  path text not null,
  caption text,
  source_pdf text not null,
  page_number int,
  tags text[],
  created_at timestamptz default now()
);

-- user_profiles table for RBAC (admin panel access)
create table user_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique not null references auth.users(id) on delete cascade,
  email text,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### Admin Authentication

Admin access uses Supabase Auth (Google OAuth) + role-based access control via `user_profiles`:
- Admins sign in with Google (same as regular users)
- Server-side: `validateAdminAuth()` reads session cookies, checks `user_profiles.role = 'admin'`
- Client-side: `useAdminRole()` hook queries the user's role via RLS
- API routes use cookie-based auth (no bearer tokens); cookies sent automatically by browser fetch

## Deployment (Vercel)

- **Project**: `thecreativetoken/paisaxe` on Vercel
- **Git integration**: Connected to `juan294/paisaxe` on GitHub
- **Production branch**: `main` (pushes trigger production deploys)
- **Preview branches**: All other branches get preview deployments
- **Domains**: `paisaxe.com`, `paisaxe.es` (+ www variants)
- **Speed Insights**: `@vercel/speed-insights` integrated in root layout for Real User Monitoring

## Monitoring & Observability

### Health Check Endpoint

`GET /api/health` — returns service status, uptime, Supabase connectivity with latency, and database storage usage (size in MB, percentage of 500 MB free-tier limit). Reports "degraded" if Supabase connection fails or database usage exceeds 80%. Always returns HTTP 200. Used by Upptime for uptime monitoring.

### Upptime Status Page

- **Repo**: https://github.com/juan294/paisaxe-upptime
- **Status page**: https://juan294.github.io/paisaxe-upptime/
- **Monitors**: `paisaxe.com` and `paisaxe.com/api/health` every 5 minutes
- Opens GitHub Issues automatically on detected downtime
- Reference config kept in `.github/upptime/.upptimerc.yml`

### Vercel Speed Insights

Real User Monitoring (RUM) for Core Web Vitals in production. View data in the Vercel Dashboard under Speed Insights.

## Database Maintenance (pg_cron)

Automated maintenance jobs run on Supabase via pg_cron:

| Job | Schedule | Migration | Description |
|-----|----------|-----------|-------------|
| `vacuum-analyze-chunks` | Sundays 3:00 AM UTC | 011 | VACUUM ANALYZE on chunks table |
| `analyze-main-tables` | Daily 4:00 AM UTC | 011 | ANALYZE on chunks, images, stories |
| `cleanup-cron-history` | Sundays 5:00 AM UTC | 011 | Delete cron history older than 30 days |
| `vacuum-analyze-analytics` | Sundays 3:30 AM UTC | 011 | VACUUM ANALYZE on analytics_events |
| `keep-alive` | Every 3 days 12:00 PM UTC | 012 | Prevent free-tier auto-pause (7-day timeout) |
| `edge-keep-alive` | Every 3 days 12:00 PM UTC | 014 | Call keep-alive Edge Function via pg_net |
| `edge-cleanup-analytics` | 1st of month 2:00 AM UTC | 014 | Call cleanup Edge Function via pg_net |

Verify jobs: `SELECT jobname, schedule, command FROM cron.job ORDER BY jobname;`

## Database Webhooks (pg_net)

Database webhooks fire HTTP requests when rows change, using the `pg_net` extension (migration `013_database_webhooks.sql`). Webhooks call `POST /api/webhooks/supabase` on the Next.js app to trigger cache invalidation.

| Table | Event | Effect |
|-------|-------|--------|
| `stories` | UPDATE | Revalidates `/immersive` and `/sitemap.xml` |
| `feature_flags` | UPDATE | Revalidates `/api/feature-flags` |

Setup: Configure `app.webhook_base_url` and `app.webhook_secret` in Supabase SQL Editor (see Environment Variables).

## Supabase Realtime

Realtime subscriptions provide live updates to browser sessions (free tier: 200 concurrent connections, 2M messages/month).

| Subscription | Module | Purpose |
|-------------|--------|---------|
| Feature flags | `src/hooks/use-realtime-feature-flags.ts` | Live flag sync when admin toggles |
| Stories | `src/hooks/use-realtime-stories.ts` | Notify when admin updates story |

Utilities in `src/lib/realtime.ts` provide generic `subscribeToTable()` and specific `subscribeToFeatureFlags()` / `subscribeToStories()` helpers.

## Supabase Edge Functions

Deno-based Edge Functions in `supabase/functions/` (free tier: 500K invocations/month). Scheduled via pg_cron + pg_net.

| Function | Purpose | Schedule |
|----------|---------|----------|
| `keep-alive` | Queries active stories to prevent auto-pause | Every 3 days |
| `cleanup-analytics` | Deletes analytics events older than 90 days | Monthly |

Deploy: `supabase functions deploy keep-alive && supabase functions deploy cleanup-analytics`

See `supabase/functions/README.md` for full setup instructions.

## Automated Agents

### Coverage Agent (Nightly via launchd)

`scripts/coverage-agent.sh` runs nightly at 2:00 AM via macOS launchd (`com.paisaxe.coverage-agent` in `~/Library/LaunchAgents/`). Unlike cron, launchd runs missed jobs when the Mac wakes from sleep. Uses Claude CLI to analyze test coverage and update `docs/coverage-report.md`. Logs written to `logs/`.

### Security Audit (Weekly Cron)

`security.yml` runs `npm audit` weekly on Mondays at 08:00 UTC via GitHub Actions.

### Secret Scanning (Daily Cron)

`gitleaks.yml` scans the full git history daily at 04:00 UTC via GitHub Actions.

## Development Guardrails

Rules enforced by CI. Keep these in mind when developing:

1. **No secrets in code** — Gitleaks scans git history. Use environment variables for all credentials. If a secret is accidentally committed, rotate it immediately.
2. **No copyleft dependencies** — License Check blocks GPL, AGPL, EUPL, SSPL, and similar licenses. Only use MIT, Apache-2.0, BSD, or ISC licensed packages.
3. **Performance budgets** — Lighthouse CI enforces: Performance >= 60%, Accessibility >= 80%, FCP < 3000ms, LCP < 4000ms, CLS < 0.25, TBT < 500ms (see `lighthouserc.json`).
4. **No dead code** — Knip reports unused exports, dependencies, and files on every PR. Clean up flagged items.
5. **Keep bundle size in check** — Bundle Size workflow comments on PRs with the total JS size. Monitor for unexpected growth.
6. **Health endpoint must stay healthy** — `/api/health` is monitored 24/7 by Upptime. Don't break it or remove it. It has 9 tests.
7. **Review Dependabot PRs** — Automated dependency update PRs arrive weekly. Review, test, and merge them regularly.
8. **Database function security** — All SQL/PL/pgSQL functions must have an explicit `SET search_path` clause. Use `search_path = ''` with fully qualified table references (e.g., `public.chunks`) for security-definer functions. Functions using pgvector operators need `search_path = public, extensions`. Extensions should be installed in the `extensions` schema, not `public`.

## Agent Autonomy

**Before asking the user to perform any manual step, exhaust all available tools first.**

This project has CLI tools and MCP servers available that can perform most tasks autonomously. Before telling the user "go to the Supabase dashboard and..." or "run this command manually", check whether you can do it yourself:

1. **Supabase CLI** (`supabase`) — Run migrations, deploy Edge Functions, manage config, inspect database state. Use `supabase db push`, `supabase functions deploy`, `supabase migration list`, etc.
2. **GitHub CLI** (`gh`) — Create PRs, view issues, check workflow runs, manage releases. Use `gh pr create`, `gh run list`, `gh issue view`, etc.
3. **Vercel CLI** (`vercel`) — Check deployments, inspect env vars, view logs.
4. **MCP servers** — Check what MCP tools are available in the current session. These may provide direct access to services like Supabase, GitHub, or other APIs without needing CLI.
5. **Bash** — Run any npm scripts, git commands, curl requests, or other shell operations.
6. **SQL via Supabase CLI** — Run queries directly with `supabase db execute` or connect to the database.

**The rule is simple**: If a tool or CLI can do it, use it. Only ask the user to intervene when the task genuinely requires manual action (e.g., clicking through a third-party OAuth consent screen, approving a billing change, or accessing a UI that has no CLI/API equivalent).

## Content Categories (from PDFs)

- City guides: Oviedo, Gijón, Avilés
- Activities: hiking, cycling, family activities
- Culture: pre-Romanesque art, museums, festivals
- Gastronomy: sidra, fabada, local dishes
- Camino de Santiago planning
- Seasonal events and practical tips
