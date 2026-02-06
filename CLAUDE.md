# Paisaxe

**Look. Ask. Discover.** — An immersive tourism experience for Asturias, Spain.

For project vision and voice guidelines, see @docs/project/project-charter.md.
For operations (monitoring, pg_cron, webhooks, agents), see @docs/operations/operations.md.

**Domains**: paisaxe.es, paisaxe.com

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS + shadcn/ui |
| Database | Supabase (PostgreSQL + pgvector) |
| AI Chat | Claude API (Anthropic) |
| Embeddings | Voyage AI (voyage-3, 512 dims) |
| Reranking | Voyage AI (rerank-2.5) |
| Voice | ElevenLabs Conversational AI |
| Payments | Stripe |
| Testing | Vitest + Playwright |
| Deployment | Vercel |

## Git Workflow

**IMPORTANT: Always work on `develop` branch. Only merge to `main` for production releases.**

```bash
main      # Production releases only
develop   # Active development (DEFAULT)
```

1. All development happens on `develop`
2. Never commit directly to `main`
3. Merge `develop` → `main` only when releasing to production
4. Always run tests before committing

## Push Accountability (MANDATORY — Background)

**Every push requires CI verification. No exceptions. No matter how small the change.**

**This runs as a background agent so the terminal stays unblocked.** After ANY `git push`, immediately spawn a background task (using `run_in_background: true`) that:

1. **Polls CI status** — `gh run list --limit 5` until the run completes
2. **If CI passes** — Log success, no interruption needed
3. **If CI fails** — Investigate with `gh run view <run-id> --log-failed`, fix the issue, and re-push — all in the background
4. **Verify deployment** — For `main` branch, confirm Vercel deployment succeeds

The main terminal continues working on the next task immediately after pushing. The background agent owns the push outcome until CI is green.

**If a background fix requires changes that conflict with current work**, notify the user before applying fixes.

**This is non-negotiable.** You own the outcome of your push until CI is green and deployment is healthy. If you break the build, you fix the build — automatically in the background.

## Test-Driven Development

**NO feature ships without a test written first. No exceptions.**

1. **Red**: Write a failing test FIRST
2. **Green**: Write minimal code to pass
3. **Refactor**: Clean up while tests stay green

## Key Commands

```bash
# Before committing
npm run test           # Run all tests
npm run typecheck      # Check types
npm run lint           # Check linting

# Testing
npm run test:watch     # Watch mode
npm run test:coverage  # Coverage report
npm run test:e2e       # Playwright E2E tests
npm run test:e2e:ui    # Playwright UI mode

# Data pipeline
npm run seed-db        # Generate embeddings and populate DB
```

## Environment Variables

Required in `.env.local`:
```
ANTHROPIC_API_KEY=       # Claude API
VOYAGE_API_KEY=          # Voyage AI embeddings
ELEVENLABS_API_KEY=      # Voice agents (optional)

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=    # For seeding

GOOGLE_CLIENT_ID=        # OAuth
GOOGLE_CLIENT_SECRET=

WEBHOOK_SECRET=          # Supabase webhooks
NEXT_PUBLIC_SITE_URL=

# Stripe (payments)
STRIPE_SECRET_KEY=                      # Server-side API key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=     # Client-side publishable key
STRIPE_WEBHOOK_SECRET=                  # Webhook signature verification
STRIPE_DAY_PASS_PRICE_ID=               # Price ID for Day Pass product

# Twilio (SMS alerts, voice booking)
TWILIO_ACCOUNT_SID=                     # Twilio account SID
TWILIO_AUTH_TOKEN=                      # Twilio auth token
TWILIO_PHONE_NUMBER=                    # Twilio sender phone number
QA_ALERT_PHONE=                         # Phone for critical alerts (E.164: +34612345678)
```

## Architecture Decisions

### Embeddings & Search
- Model: `voyage-3` with 512 dimensions (Matryoshka)
- Hybrid search: vector similarity + keyword matching
- Two-stage retrieval: fetch 10 candidates, rerank to top 3 via `rerank-2.5`

### Chat Flow
1. User query → Voyage embedding (512 dims)
2. Vector search → top 10 candidates
3. Rerank → top 3
4. Claude generates response with context
5. Render with markdown + source attribution

### Voice Agents
- **Pelayo**: Visitor-facing tourism guide (gated by `visitor_voice_agent` feature flag)
- Xander, Iris, Penny: Admin-only social media marketing agents (in `src/agents/index.ts`)

### Admin Auth
- Supabase Auth (Google OAuth) + `user_profiles.role = 'admin'`
- Server: `validateAdminAuth()` checks cookies
- Client: `useAdminRole()` hook

### Analytics Dashboard Caching
- **CSS visibility**: All 4 panels (Visitors, Voice, Costs, Revenue) stay mounted via `display:none` — no remount/refetch on tab switch
- **In-memory SWR**: `AnalyticsCacheProvider` + `useAnalyticsData` hook in `analytics-cache-context.tsx`
- Cache key = `${tabKey}:${JSON.stringify(params)}`, stale after 2 minutes
- Background revalidation shows thin blue pulse bar, never blocks UI
- `refresh()` invalidates cache (used after CRUD mutations in costs panel)
- **HTTP Cache-Control**: `private, max-age=120, stale-while-revalidate=300` on all 4 admin analytics API routes
- No external dependencies — pure React Context + `useRef<Map>`

### Proxy (NOT Middleware)
**IMPORTANT: This project uses `src/proxy.ts`, NOT `middleware.ts`.**

Next.js 16 introduced `proxy.ts` as the recommended replacement for middleware. You cannot have both files - the build will fail if both exist.

All request interception logic goes in `proxy.ts`:
- Maintenance mode redirects
- CORS handling for API routes
- Auth session refresh (via Supabase `getUser()`)

**Never create a `middleware.ts` file in this project.**

## Database Schema

Core tables (see `supabase/migrations/` for full DDL):

- **chunks**: PDF content with embeddings (vector 512)
- **images**: Extracted PDF images
- **stories**: Immersive story content
- **user_profiles**: RBAC (role: 'user' | 'admin')
- **feature_flags**: Runtime feature toggles

## Development Guardrails

1. **No secrets in code** — Use env vars. Gitleaks scans git history.
2. **No copyleft dependencies** — MIT, Apache-2.0, BSD, ISC only.
3. **Performance budgets** — Lighthouse: Perf >= 60%, A11y >= 80%, LCP < 4s.
4. **No dead code** — Knip reports unused exports on PRs.
5. **Health endpoint is sacred** — `/api/health` monitored 24/7. Don't break it.
6. **Database function security** — All functions need explicit `SET search_path`. Use `search_path = ''` with fully qualified refs for security-definer functions.

## Troubleshooting

### Vercel Environment Variables with Invisible Characters

**Symptom**: API calls fail with connection errors or "invalid request" errors despite correct-looking credentials.

**Cause**: When adding environment variables to Vercel via CLI, trailing whitespace or newlines can be accidentally included (e.g., from command output capture or copy-paste).

**Diagnosis**:
```typescript
// Add this to debug endpoints:
const rawLength = process.env.MY_VAR?.length ?? 0;
const trimmedLength = process.env.MY_VAR?.trim().length ?? 0;
const hasInvisibleChars = rawLength !== trimmedLength;
// If hasInvisibleChars is true, the env var has trailing/leading whitespace
```

**Fix**: Always `.trim()` environment variables before use, especially API keys:
```typescript
const apiKey = process.env.API_KEY?.trim();
```

**Prevention**: When adding env vars to Vercel via CLI, pipe values directly:
```bash
# Good - pipes value directly
grep '^MY_VAR=' .env.local | cut -d'=' -f2- | vercel env add MY_VAR production

# Bad - may capture extra output
echo $MY_VAR | vercel env add MY_VAR production
```

## Agent Autonomy

**Before asking the user to perform any manual step, exhaust all available tools first.**

Use these before telling the user "go to the dashboard and...":

1. **Supabase CLI** — `supabase db push`, `supabase functions deploy`, etc.
2. **GitHub CLI** — `gh pr create`, `gh run list`, `gh issue view`
3. **Vercel CLI** — `vercel` for deployments and logs
4. **MCP servers** — Check available tools in the session
5. **Bash** — npm scripts, git, curl
6. **SQL** — `supabase db execute` for queries

Only ask for manual intervention when genuinely required (OAuth consent, billing, UI-only features).

## Content Categories

From 37 PDFs in `content/pdfs/`:
- City guides: Oviedo, Gijón, Avilés
- Activities: hiking, cycling, family activities
- Culture: pre-Romanesque art, museums, festivals
- Gastronomy: sidra, fabada, local dishes
- Camino de Santiago planning
