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
cd /Users/juan/Documents/code/paisaxe
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

<important if="you are pushing code to a remote">
### Push Accountability

After pushing to the development branch, spawn a background agent to monitor CI.
If CI fails, the background agent investigates, fixes, and re-pushes.
Main terminal continues working -- push verification is non-blocking.
If a background fix requires changes that conflict with current work, notify the user before applying fixes.
**Pushing to `main` is PROHIBITED** -- see Production Safety above.
</important>

## TDD Protocol

All code changes follow Red-Green-Refactor:
1. **Red** -- Write a failing test FIRST
2. **Green** -- Minimum code to pass
3. **Refactor** -- Clean up with green tests

No exceptions. Bug fixes need a regression test. Refactors need existing coverage. No "tests later."

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

# Agent management (local flags)
scripts/agent-ctl.sh status           # Show all agent flags
scripts/agent-ctl.sh enable <key>     # Enable an agent
scripts/agent-ctl.sh disable <key>    # Disable an agent
scripts/agent-ctl.sh master on|off    # Master toggle

# Headless mode (non-interactive CI/batch runs)
claude -p "Fix all TypeScript lint errors and run tests" --allowedTools "Edit,Read,Bash,Write" --output-format json
claude -p "Read issue #240 and implement the fix with TDD" --allowedTools "Edit,Read,Bash,Write,Grep"
```


## Environment Variables

All env vars are documented in `.env.local`. Key groups: Anthropic, Voyage AI, ElevenLabs, Supabase, Google OAuth, Stripe, Twilio, Resend, Upstash Redis, PostHog, Vercel Cron. Always `.trim()` env vars before use (Vercel CLI may add invisible chars).

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

### Local Agent Flags
Flags in `scripts/agent-config.json` (gitignored). Defaults in `scripts/agent-config.defaults.json`. CLI: `scripts/agent-ctl.sh`. Admin dashboard uses dev-only route `/api/admin/agent-config`.

### Proxy (NOT Middleware)
**IMPORTANT: This project uses `src/proxy.ts`, NOT `middleware.ts`.**

Next.js 16 introduced `proxy.ts` as the recommended replacement for middleware. You cannot have both files - the build will fail if both exist.

All request interception logic goes in `proxy.ts`:
- Maintenance mode redirects
- CORS handling for API routes
- Auth session refresh (via Supabase `getUser()`)

**Never create a `middleware.ts` file in this project.**

### CSP and PPR Compatibility (IMPORTANT)

**PPR (`cacheComponents`) prerenders HTML at build time WITHOUT CSP nonces.** This means:

1. **Never use `'strict-dynamic'` in CSP** — it overrides `'self'` per CSP Level 3, blocking ALL scripts when nonces aren't in the HTML
2. **Never use nonce-only CSP** — prerendered pages don't have nonces, so nonce-gated scripts won't execute
3. **Current policy**: `script-src 'self' 'unsafe-inline' blob: https://js.stripe.com` — `'self'` covers same-origin external scripts, `'unsafe-inline'` covers Next.js hydration inline scripts
4. **If re-enabling nonces**: Must restore `headers()` call in root layout to read `x-csp-nonce`, which makes the layout dynamic (incompatible with PPR static shell)
5. **E2E canary**: `e2e/smoke.spec.ts` has a "CSP canary" test that verifies JavaScript executes. If CSP ever blocks scripts again, this test fails immediately.

## Database Schema

Core tables (see `supabase/migrations/` for full DDL):

- **chunks**: PDF content with embeddings (vector 512)
- **images**: Extracted PDF images
- **stories**: Immersive story content
- **user_profiles**: RBAC (role: 'user' | 'admin')
- **feature_flags**: Runtime feature toggles

## Development Guardrails

1. **No secrets in code** — Use env vars. Gitleaks scans git history.
2. **No copyleft dependencies** — MIT, Apache-2.0, BSD, ISC only. See `docs/project/license-exceptions.md` for approved exceptions.
3. **Performance budgets** — Lighthouse: Perf >= 70%, A11y >= 80%, LCP < 4s.
4. **No dead code** — Knip reports unused exports on PRs.
5. **Health endpoint is sacred** — `/api/health` monitored 24/7. Don't break it.
6. **Database function security** — All functions need explicit `SET search_path`. Use `search_path = ''` with fully qualified refs for security-definer functions.
7. **Production is sacred** — No agent touches `main`, production deployments, or production infrastructure without explicit user authorization in the current conversation. See Production Safety section.

## Deployment

- Production deploys from `main` only. Changes pushed to `develop` must be merged to `main` via PR before they go live.
- Always confirm the target branch before pushing — if the goal is production deployment, ensure the PR targets `main`.

<important if="you are merging PRs, merging branches to main, deploying, or handling dependency updates">
### Deployment Safety

- **Merging to `main` IS deploying to production.** Every merge triggers a production deployment. No exceptions.
- **Dependabot PRs target `main` by default.** Never merge them directly. Cherry-pick to `develop`, close the PR, release normally.
- **Every CI run and deployment costs money.** Before starting: estimate how many runs/deploys this will trigger. If more than 2-3, batch the work.
- **Framework upgrades (Next.js, React, etc.) require preview deployment verification.** CI passing is NOT sufficient. Deploy to a preview URL and verify before merging to production.
- **When production is down:** Roll back immediately. Investigate on non-production. Fix forward on `develop`. Never deploy to diagnose. Never promote broken deployments "briefly."
- **Batch dependency updates** into a single branch and PR. Never merge N PRs one-by-one (causes O(n^2) CI waste from rebase cascades).
- **Justify every external action** — before any CI run, deployment, or API call: Is this needed? Is this justified? Is this verifiable? If any answer is "no," stop.
</important>

<important if="you are writing Supabase migrations or creating tables in Supabase">
### Supabase Migration Rules

- **Every migration that creates a public-facing table must include explicit grants:**
  ```sql
  GRANT SELECT ON table_name TO anon, authenticated;
  ```
- **Add `ALTER DEFAULT PRIVILEGES` in the initial setup migration** so all future tables automatically get anon SELECT. Never rely on Supabase dashboard-granted defaults for migration-created tables.
- **Fallback data paths must log at ERROR level.** If a query fails and the code falls back to default/placeholder data, log `[TABLE_FALLBACK]` at ERROR — not INFO. Silent fallbacks hide permission bugs for days.
- **Health endpoints must check actual data access**, not just connectivity. Return `"degraded"` if primary tables are inaccessible.
</important>

<important if="you are creating or modifying Supabase database migrations">
### Supabase Migration Safety

Always test migrations locally before pushing to the remote project.

```bash
# 1. Ensure local Supabase is running (requires Docker Desktop)
supabase start

# 2. Apply all migrations to the local Postgres instance
supabase db reset

# 3. Verify the migration worked (query the local database)
docker exec supabase_db_<project> psql -U postgres -c "<verification query>"

# 4. Only after local verification succeeds, push to remote
supabase db push
```

- The local instance is a full Postgres with RLS, extensions, and auth — treat it as your UAT environment.
- If `supabase start` fails, check that Docker Desktop is running.
- The container name follows the pattern `supabase_db_<project>` where `<project>` is the Supabase project name from `supabase/config.toml`.
- Never push a migration to remote without testing it locally first.
</important>

## Language & Tone

- All user-facing content for the Asturias project must be in Spanish unless explicitly stated otherwise.
- For social media copy: keep tone confident and positive — avoid pitying, resentful, or overly dramatic language. Never mention unreleased/unpublished features.

## Sub-Agent & Background Task Guidelines

- Sub-agents may lack Bash or file-write permissions. Verify access first; if a sub-agent fails due to permissions, take over manually.
- Self-healing pipelines: try alternative tools on failure (`Write` fails → `Edit`), retry once, consolidate output into one PR + one issue for unresolved items. See `.claude/skills/multi-agent/` for full protocol.

## Testing & CI

- This project uses TDD. Always write tests before or alongside implementation.
- All PRs must have CI green before merging. Run the full test suite locally before pushing.
- After merging to develop, if production deployment is the goal, immediately create a PR from develop → main.

## Tool & API Awareness

- You CAN set Vercel environment variables via CLI — do not claim otherwise.
- You CANNOT handle credentials (npm tokens, API keys) directly — ask the user to provide/set them.
- Upstash Redis API differs from standard Redis: use `zrange` with options instead of `zrangebyscore`/`zrevrangebyscore`.

## Agent Autonomy

Exhaust CLI tools, shell commands, and file tools before asking the user. Only escalate when genuinely impossible. Production-affecting actions need explicit human authorization.

**Tools to exhaust before suggesting manual steps:**
Supabase CLI, GitHub CLI (`gh`), Vercel CLI (develop/preview only), MCP servers, Bash (npm scripts, git, curl), SQL (`supabase db execute`).

**EXCEPTION — Production-affecting actions require user authorization (see Production Safety):**
- Anything touching `main` branch (push, PR, merge)
- Production deployments, database migrations
- External service configuration changes (ElevenLabs, Stripe, Vercel env vars, DNS)

## RPI Workflow

This project follows the Research-Plan-Implement (RPI) pattern.
All significant changes go through four phases:
1. /research — Understand the codebase as-is
2. /plan — Create a phased implementation spec
3. /implement — Execute one phase at a time with review gates
4. /validate — Verify implementation against the plan

### Context Management

- Each RPI phase should be its own conversation. Don't run research + plan + implement in one session.
- Use `/clear` between unrelated tasks. Use `/compact` when context is heavy but the task continues.
- Subagents are context control mechanisms — they search/read in their window and return only distilled results.
- Research and planning happen on the default branch. Implementation happens in worktrees or feature branches.
- If research comes back wrong, throw it out and restart with more specific steering.

### Rules for All Phases

- Read all mentioned files COMPLETELY before doing anything else.
- Never suggest improvements during research — only document what exists.
- Every code reference must include file:line.
- Spawn parallel subagents for independent research tasks.
- Wait for ALL subagents before synthesizing.
- Never write documents with placeholder values.

### Rules for Implementation

- Follow the atomic loop: implement → review (plan compliance) → fix → approve → `/simplify` (code quality) → verify.
- Run `/simplify` after reviewer approval — it handles code reuse, quality, and efficiency in one native pass.
- Check for `[batch-eligible]` phases in the plan — use `/batch` to execute independent phases in parallel.
- Run ALL automated verification after each phase.
- STOP after each phase and wait for human confirmation.
- Never auto-proceed to the next phase.
- If the plan doesn't match reality, STOP and explain the mismatch.

### Pre-Release Workflow

```
/pre-launch -> /remediate -> /update-docs -> /release
```

- `/remediate` -- resolve all pre-launch findings with parallel TDD agents, CI verification
- `/update-docs` -- refreshes all documentation, diagrams, version references, and inline code docs
- `/release` -- version bump, CHANGELOG, tag, GitHub release, registry publish advisory

### Testing Philosophy

- Prefer automated verification over manual testing.
- Manual testing is ONLY for: sudo, hardware, new installs, truly visual-only validation.
- If you can verify it with a command or tool, do so automatically.
- Don't use Claude for linting/formatting — use automated tools and hooks instead.

## Working Patterns

<examples>
<example name="push-sequence">
Commit before pulling -- hook blocks dirty pulls.

```bash
git add src/feature.ts && git commit -m "feat: add feature"
git pull --rebase && git push
```

</example>

<example name="verification">
Run checks sequentially, never as parallel tool calls.

```bash
npm run typecheck 2>&1; npm run lint 2>&1; npm run test 2>&1
```

</example>

<example name="worktree-cleanup">
Remove worktrees before merging PRs. Use -D (uppercase) for branches.

```bash
git worktree remove --force ../feature-branch; git branch -D feature-branch
```

</example>

<example name="file-paths">
Use absolute paths in all file tools and worktree commands. Never use ~.

```bash
cd /Users/juan/code/paisaxe && npm run test
```

</example>
</examples>

Domain-specific rules (git, CI, deployment, Python, macOS, Supabase, GitHub CLI, multi-agent) are in `.claude/skills/` -- loaded automatically when relevant.

## Memory Management

When you discover an operational lesson during any session — CI failure pattern, permission issue, workaround, tooling quirk, environment-specific behavior — save it to auto memory immediately. Don't wait to be asked.

After completing `/bootstrap`, `/adopt`, or any significant configuration change, save the key decisions and project context to auto memory so future sessions start with full awareness.

## Project File Locations

Go directly to these paths — never search the codebase for them.

| Topic | Path | Notes |
|-------|------|-------|
| Agent reports | `docs/agents/*-report.md` | Gitignored. Local-only operational history. Never committed (Rule #70) |
| Agent logs | `logs/<name>.log`, `<name>.error.log` | Gitignored. Read alongside reports to diagnose failures |
| Agent scripts | `scripts/agents/` | Gitignored. Standalone bash files invoking Claude CLI headless |
| ADRs | `docs/decisions/` | Architecture decision records |
| PR descriptions | `docs/prs/{number}_description.md` | |
| Research docs | `docs/research/YYYY-MM-DD-description.md` | |
| Plans | `docs/plans/YYYY-MM-DD-description.md` | Phase files in `-phases/phase-N.md` |

## Issue Tracking (GitHub Issues)

**GitHub Issues is the single source of truth.** See @docs/project/issue-workflow.md for full workflow, labels, and templates.

**Auto-Filing (MANDATORY):** When the user mentions a bug, feature, or task — create a GitHub issue immediately via `gh issue create`. Don't ask, just file it. Every issue gets one `type:` label + one `priority:` label + `area:` label(s). Multiple items = multiple issues. Reference in commits: `Fixes #N` or `Refs #N`. Close once merged to `develop` with green CI.

## Autonomous Issue Implementation

**Trigger:** User says "implement issue #N" or "work on issue #N end-to-end"

Workflow: Read issue → create worktree branch → write failing tests → implement → run full suite → commit (`Fixes #N`) → push → monitor CI (retry up to 3x) → report summary. Follow all conventions (TDD, worktree, branch naming). Don't ask questions — make reasonable decisions and document assumptions.

## Agent Teams

Debug mode, large refactoring, and health check workflows are defined in `.claude/skills/` — loaded automatically when triggered.
