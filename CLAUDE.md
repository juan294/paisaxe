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
main      # PRODUCTION — live site. Agents MUST NOT touch without explicit user authorization.
develop   # Active development (DEFAULT)
```

1. All development happens on `develop`
2. Never commit directly to `main` — it is protected with required status checks
3. Release to production via PR: `develop` → `main` (see Production Release below)
4. Always run tests before committing
5. **No PRs for `develop`** — commit/merge directly, verify CI, done
6. **PRs required for `main`** — branch protection enforces CI must pass before merge

### Production Safety (MANDATORY — THIS IS A LIVE SITE)

**The site is live. Real users are visiting paisaxe.es and paisaxe.com. Every production change carries risk.**

**No agent may perform ANY of the following without the user explicitly saying "do it" or "go ahead" in the current conversation:**

1. **Push to `main`** — NEVER. Not even a typo fix.
2. **Create a PR targeting `main`** — NEVER. Only when the user requests a release.
3. **Merge a PR into `main`** — NEVER. The user merges production PRs themselves or gives explicit authorization.
4. **Run `vercel` deploy commands** — NEVER for production. Preview deployments on `develop` are fine.
5. **Modify Supabase production data** — NEVER. Migrations must be reviewed.
6. **Modify Vercel environment variables** — NEVER. The user does this.
7. **Modify DNS, domain settings, or external service configs** — NEVER.

**"Explicit authorization" means the user types something like:**
- "Create the release PR"
- "Go ahead and merge it"
- "Push to main"
- "Deploy to production"

**These do NOT count as authorization:**
- The user asking you to "fix a bug" (fix it on `develop`, don't release it)
- The user saying "ship it" about a feature (merge to `develop`, not `main`)
- CI being green (necessary but not sufficient)
- A previous conversation's authorization (authorization does not carry over)

### Production Release (develop → main)

**This is a user-initiated process. Agents prepare, users authorize.**

`main` is protected with branch protection rules:
- **Required status checks**: `lint-and-typecheck`, `test`, `build`, `e2e` must all pass
- **Force pushes blocked**, **deletion blocked**
- **PRs required** (0 approvals — solo dev can self-merge after CI passes)

#### Release Process

**Step 1: User requests a release.** The agent does NOT initiate this.

**Step 2: Agent prepares a release summary** (does NOT create the PR yet):
```bash
# Show what will be released
git log main..develop --oneline

# Verify all checks pass on develop
gh run list --branch develop --limit 3

# Run the full local test suite
npm run test && npm run typecheck && npm run lint && npm run test:e2e
```

Present the summary to the user:
- List of commits since last release
- CI status on develop
- Any known risks or breaking changes
- Recommendation: safe to release or not

**Step 3: User confirms.** Only after explicit "go ahead" or equivalent:
```bash
# Create the PR
gh pr create --base main --head develop --title "Release: description of changes"

# Wait for all 4 status checks to pass
gh pr checks
```

**Step 4: User authorizes merge.** Report CI status and wait for the user to say "merge it":
```bash
# Merge once user confirms
gh pr merge --merge
```

**Step 5: Verify deployment** (agent can do this autonomously after merge):
```bash
vercel ls --limit 5
# Check /api/health on production
curl -s https://paisaxe.es/api/health
```

**Never bypass branch protection.** If CI fails on the PR, fix on `develop` first, push, and let the PR update.

### Worktree-First Development (MANDATORY)

**Every feature, refactor, bug fix, or change MUST be done in its own git worktree. No exceptions.**

This is the default way of working — you do NOT need to be told to create a worktree. Always create one automatically at the start of any task.

#### Workflow

There are two worktree paths depending on context:

**Interactive (main terminal)** — worktree outside the project:
```bash
git worktree add -b feature/short-name ../paisaxe-short-name develop
cd ../paisaxe-short-name
```

**Background agents (spawned via Task tool)** — worktree INSIDE the project:
```bash
# IMPORTANT: Background agents are sandboxed to the project directory.
# Worktrees at ../paisaxe-* are INACCESSIBLE to background agents.
# Always use .worktrees/ which is gitignored.
git worktree add -b feature/short-name .worktrees/short-name develop
cd .worktrees/short-name
```

**How to know which to use:** If you were spawned as a background agent (via `run_in_background: true` or as a team member), you MUST use `.worktrees/`. If you're the main interactive agent, use `../paisaxe-short-name`.

**Full lifecycle (same for both paths):**
```bash
# 1. CREATE — Start every task by creating a worktree (pick the right path above)
git worktree add -b feature/short-name <path> develop

# 2. WORK — All changes happen in the worktree directory
cd <path>
npm install  # Required — worktrees don't share node_modules
# ... write tests first, then implement, then commit

# 3. MERGE — After tests pass, merge back into develop
cd /Users/juan/Documents/GenAI_Projects/paisaxe
git merge feature/short-name

# 4. CLEAN UP — Always remove the worktree and branch after merge
git worktree remove <path>
git branch -d feature/short-name
```

#### Branch Naming Convention

| Type | Pattern | Example |
|------|---------|---------|
| Feature | `feature/short-name` | `feature/booking-calendar` |
| Bug fix | `fix/short-name` | `fix/sse-buffer-overflow` |
| Refactor | `refactor/short-name` | `refactor/auth-middleware` |
| Chore | `chore/short-name` | `chore/update-deps` |

#### Rules

1. **Auto-create**: When the user asks for any code change, immediately create a worktree. Do not ask — just do it.
2. **Isolate**: Each worktree = one logical change. Never mix unrelated changes.
3. **Install deps**: Run `npm install` in the worktree before running tests — worktrees don't share `node_modules/`.
4. **Test in worktree**: Run `npm run test && npm run typecheck && npm run lint` inside the worktree before merging.
5. **Merge cleanly**: Merge the feature branch into `develop` from the main repo directory.
6. **Always clean up**: Remove the worktree directory AND delete the branch after a successful merge. Never leave stale worktrees.
7. **Parallel work**: Multiple agents can work in separate worktrees simultaneously — this is one of the key benefits.
8. **Background agents use `.worktrees/`**: Agents spawned with `run_in_background: true` or as team members are sandboxed to the project directory. They CANNOT access `../paisaxe-*` paths. Always use `.worktrees/short-name` inside the project.
9. **If merge conflicts arise**: Resolve them in the main repo during merge, never in the worktree.

## Push Accountability (MANDATORY — Background)

**Every push to `develop` requires CI verification. No exceptions. No matter how small the change.**

**Pushing to `main` is PROHIBITED** — see Production Safety above. This section applies to `develop` only.

**This runs as a background agent so the terminal stays unblocked.** After ANY `git push origin develop`, immediately spawn a background task (using `run_in_background: true`) that:

1. **Polls CI status** — `gh run list --limit 5` until the run completes
2. **If CI passes** — Log success, no interruption needed
3. **If CI fails** — Investigate with `gh run view <run-id> --log-failed`, fix the issue, and re-push — all in the background
4. **NEVER push to `main`** — Even if a background fix seems urgent, it stays on `develop`

The main terminal continues working on the next task immediately after pushing. The background agent owns the push outcome until CI is green on `develop`.

**If a background fix requires changes that conflict with current work**, notify the user before applying fixes.

**This is non-negotiable.** You own the outcome of your push until CI is green. If you break the build on `develop`, you fix the build — automatically in the background. But `main` is never touched without user authorization.

## Test-Driven Development (MANDATORY)

**NO code is written without a failing test first. No exceptions. Not even "small" changes.**

This is non-negotiable. Every feature, bug fix, and refactor follows this exact sequence:

1. **Red**: Write a failing test FIRST — before touching any implementation code
2. **Green**: Write the minimum code to make the test pass
3. **Refactor**: Clean up while tests stay green

#### Rules

- **Tests before code, always.** If you catch yourself writing implementation code without a test, stop and write the test first.
- **Bug fixes need a regression test.** Before fixing a bug, write a test that reproduces it. Then fix the code so the test passes.
- **Refactors need existing tests.** Before refactoring, ensure tests exist that cover the current behavior. If they don't, write them first.
- **No "I'll add tests later."** There is no later. Tests are written in the same worktree, in the same commit sequence, before the implementation.

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
ELEVENLABS_WEBHOOK_SECRET=   # ElevenLabs webhook signature verification
GITHUB_TOKEN=            # GitHub PAT with `repo` scope (traffic analytics)

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

# Credentials encryption
CREDENTIALS_ENCRYPTION_KEY=             # AES-256 encryption key for stored credentials

# Voice Agent MCP tools (optional)
OPENWEATHERMAP_API_KEY=                 # Weather data for voice agent
GOOGLE_PLACES_API_KEY=                  # Places data for voice agent

# Resend (transactional email)
RESEND_API_KEY=                         # Resend API key for sending emails
ADMIN_EMAIL=                            # Admin notification recipient (default: admin@paisaxe.es)

# Upstash Redis (distributed rate limiting - optional)
UPSTASH_REDIS_REST_URL=                # Upstash Redis REST URL
UPSTASH_REDIS_REST_TOKEN=              # Upstash Redis REST token

# PostHog analytics (optional)
NEXT_PUBLIC_POSTHOG_KEY=                # PostHog project API key
NEXT_PUBLIC_POSTHOG_HOST=               # PostHog ingestion host
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
7. **Production is sacred** — No agent touches `main`, production deployments, or production infrastructure without explicit user authorization in the current conversation. See Production Safety section.

## Deployment

- Production deploys from `main` only. Changes pushed to `develop` must be merged to `main` via PR before they go live.
- Always confirm the target branch before pushing — if the goal is production deployment, ensure the PR targets `main`.

## Language & Tone

- All user-facing content for the Asturias project must be in Spanish unless explicitly stated otherwise.
- For social media copy: keep tone confident and positive — avoid pitying, resentful, or overly dramatic language. Never mention unreleased/unpublished features.

## Sub-Agent & Background Task Guidelines

- Sub-agents (Task tool) may lack Bash or file-write permissions. If spawning agents for fixes, verify they have the required tool access first.
- If a sub-agent fails due to permissions, take over manually immediately rather than retrying.
- Be aware of context window limits when receiving multiple parallel task notifications.

## Testing & CI

- This project uses TDD. Always write tests before or alongside implementation.
- All PRs must have CI green before merging. Run the full test suite locally before pushing.
- After merging to develop, if production deployment is the goal, immediately create a PR from develop → main.

## Tool & API Awareness

- You CAN set Vercel environment variables via CLI — do not claim otherwise.
- You CANNOT handle credentials (npm tokens, API keys) directly — ask the user to provide/set them.
- Upstash Redis API differs from standard Redis: use `zrange` with options instead of `zrangebyscore`/`zrevrangebyscore`.

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
3. **Vercel CLI** — `vercel` for deployments and logs (develop/preview only)
4. **MCP servers** — Check available tools in the session
5. **Bash** — npm scripts, git, curl
6. **SQL** — `supabase db execute` for queries

Only ask for manual intervention when genuinely required (OAuth consent, billing, UI-only features).

**EXCEPTION — Production-affecting actions require user authorization (see Production Safety):**
- Anything touching `main` branch (push, PR, merge)
- Production deployments
- Production database migrations
- External service configuration changes (ElevenLabs, Stripe, Vercel env vars, DNS)

Agent autonomy applies to **development work on `develop`**. Production is user-controlled.

## Issue Tracking (GitHub Issues)

**GitHub Issues is the single source of truth for all planned work.** See @docs/project/issue-workflow.md for the full workflow.

### Quick Reference

Every issue gets **one type label** + **one priority label** + **area label(s)**:

- **Type**: `type: bug`, `type: feature`, `type: enhancement`, `type: chore`, `type: security`, `type: docs`
- **Priority**: `priority: critical`, `priority: high`, `priority: medium`, `priority: low`
- **Area**: `area: chat`, `area: voice`, `area: payments`, `area: admin`, `area: content`, `area: infra`, `area: marketing`, `area: auth`, `area: ux`

### Auto-Filing Issues (MANDATORY)

**When the user mentions a bug, feature idea, enhancement, or task — create a GitHub issue immediately.** Do not wait to be asked. Do not ask "should I create an issue?" Just file it.

The user will throw ideas, complaints, observations, and requests in conversation. The agent's job is to:

1. **Parse what the user said** into a clear issue title and description.
2. **Classify it** with the right type, priority, and area labels.
3. **Create it via CLI** — `gh issue create --title "..." --label "..." --body "..."`.
4. **Report back** — show the issue number and URL so the user knows it's tracked.

If the description would benefit from more detail, **ask the user** before creating — but bias toward filing it now with what you have rather than blocking on perfect information. You can always edit the issue later.

**Example flow:**
```
User: "The voice chat sometimes drops after 30 seconds on mobile"
Agent: *immediately creates issue* →
  gh issue create \
    --title "Voice: connection drops after ~30s on mobile" \
    --label "type: bug,priority: high,area: voice" \
    --body "## Description\nVoice chat sessions drop..."
Agent: "Filed as #19 — type: bug, priority: high, area: voice"
```

**Multiple items in one message?** Create multiple issues. One issue per concern.

### General Agent Rules for Issues

1. **Reference issues in commits.** Use `Fixes #N` or `Refs #N` in commit messages.
2. **Close issues when merged to `develop` with green CI.** No need to wait for production release.
3. **When starting work on an issue**, mention the issue number in your first commit.
4. **Use the CLI:**
   ```bash
   # Create an issue
   gh issue create --title "Chat: timeout on long queries" --label "type: bug,priority: high,area: chat" --body "..."

   # List open issues by priority
   gh issue list --label "priority: critical"
   gh issue list --label "priority: high"

   # Edit an issue to add detail later
   gh issue edit 19 --body "updated description..."
   ```

## Content Categories

From 37 PDFs in `content/pdfs/`:
- City guides: Oviedo, Gijón, Avilés
- Activities: hiking, cycling, family activities
- Culture: pre-Romanesque art, museums, festivals
- Gastronomy: sidra, fabada, local dishes
- Camino de Santiago planning

## Debug Mode (Agent Team)

**Trigger:** User says "enter debug mode", "debug this", or "let's debug this"

When triggered, create a team of parallel investigators to diagnose the issue:

1. **Assess complexity** — Simple bugs (single component, clear error): 3 investigators. Cross-cutting issues (multiple systems, intermittent): up to 5.

2. **Create team** called "debug-squad" with investigators, each assigned a different hypothesis:
   - Each investigator focuses on a different area (API / client / database / config / dependencies / etc.)
   - Each investigator must state their hypothesis upfront, then gather evidence
   - Investigators should actively try to disprove their own hypothesis
   - Time-boxed: if no evidence found after thorough investigation, report "hypothesis unlikely" and stop

3. **Synthesize findings** — After all investigators complete:
   - Rank hypotheses by evidence strength
   - Present the most likely root cause with supporting evidence
   - Propose a specific fix with code changes

4. **Do NOT auto-apply fixes** — Present the diagnosis and proposed fix to the user for approval. Only implement after the user confirms.

**Example team for a "chat responses are empty" bug:**
- Investigator 1: API route — check if the Claude API is being called correctly, verify request/response
- Investigator 2: Client-side — check if SSE parsing is working, verify state updates
- Investigator 3: Database/RAG — check if embeddings are being retrieved, verify search results

## Large Refactoring (Agent Team)

**Trigger:** Auto-detected when a refactoring operation will touch 5+ files. Claude proposes using a team; proceeds only with user agreement.

When triggered, create a team called "refactor" with 4 sequential specialists:

### Phase 1 (Parallel)
1. **architect** — Plan the refactoring: define target architecture, sequence of changes, identify risks. Produces a step-by-step plan.
2. **dependency-analyst** — Map all imports/exports of affected modules, trace all consumers, list all tests that cover the affected code. Produces a dependency map.

### Phase 2 (Sequential, after Phase 1)
3. **implementer** — Execute the refactoring changes following the architect's plan. After each file change, run `npm run typecheck` to catch errors early. Does NOT run tests (that's the test-updater's job).

### Phase 3 (Sequential, after Phase 2)
4. **test-updater** — Update all affected tests based on the dependency analyst's map. Run `npm run test` after each test file update. Fix any failures. Run the full suite at the end.

### Final Verification
After all specialists complete, the lead runs:
```bash
npm run test && npm run typecheck && npm run lint
```

**Do NOT commit** — present the full diff to the user for review. The user decides whether to commit.

## Code Quality Deep-Dive (Agent Team)

**Trigger:** User says "run a code quality audit" or "deep dive on code quality"

Create a team called "code-quality" with 3 parallel specialists:

1. **dead-code-hunter**
   - Run `npx knip` to find unused exports, files, and dependencies
   - Check for commented-out code blocks
   - Find unused CSS classes or Tailwind utilities
   - Look for TODO/FIXME/HACK comments older than 30 days
   - Produce a prioritized list of dead code to remove

2. **pattern-enforcer**
   - Check for consistent naming conventions across the codebase
   - Verify all API routes follow the same auth pattern
   - Check that all components follow the same file structure
   - Look for duplicated logic that could be consolidated
   - Verify error handling patterns are consistent
   - Check for consistent use of TypeScript types vs `any`

3. **complexity-analyst**
   - Identify functions longer than 50 lines
   - Find files larger than 300 lines
   - Look for deeply nested conditionals (3+ levels)
   - Check for functions with more than 4 parameters
   - Identify components with too many responsibilities
   - Suggest specific simplification strategies

### Output

Write the final report to `docs/agents/code-quality-report.md`:

```
# Code Quality Report
> Generated on [date]

## Summary
- Dead code items found: [N]
- Pattern violations: [N]
- Complexity hotspots: [N]

## Dead Code
[Prioritized list from dead-code-hunter]

## Pattern Violations
[Findings from pattern-enforcer]

## Complexity Hotspots
[Findings from complexity-analyst with simplification suggestions]

## Recommended Actions
[Top 5 most impactful improvements, ordered by effort-to-impact ratio]
```
