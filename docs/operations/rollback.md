# Rollback Procedures

Runbook for rolling back production deployments, code changes, and database migrations.

> **Key lesson from the 2026-03-24 incident**: Roll back first, investigate second. Every minute spent diagnosing on a broken production deployment is a minute of user-facing downtime. Promote the last known good deployment immediately, then investigate in isolation.

## 1. Vercel Rollback

### Via Dashboard (fastest)

1. Open the [Vercel Dashboard](https://vercel.com/dashboard) and navigate to the **paisaxe** project.
2. Click **Deployments** in the left sidebar.
3. Find the last deployment marked **Ready** before the current broken one.
4. Click the **three-dot menu (⋯)** next to that deployment.
5. Select **Promote to Production**.
6. Verify the rollback:

```bash
curl -s https://paisaxe.es/api/health | jq
```

The response should show `"status": "healthy"`.

### Via CLI

```bash
# List recent deployments to find the deployment URL to roll back to
vercel ls --limit 10

# Promote a specific deployment to production
vercel rollback <deployment-url-or-id>

# Verify
curl -s https://paisaxe.es/api/health | jq
```

### When to Use Vercel Rollback

Use this when the **deployment itself is broken** — i.e., the current production deployment has a runtime error, crashes serverless functions, or returns 500s across the board. This is the fastest recovery path because it requires no code changes and no CI cycle.

> **CRITICAL**: Never promote a broken deployment "briefly" to capture logs. This causes additional downtime. Use Vercel's log viewer on the deployment detail page to inspect logs without promoting the deployment.

---

## 2. Code Rollback

Use this when a specific commit introduced a bug that was deployed to production, and you need to cleanly reverse the change.

### Identify the Bad Commit

```bash
# Show recent commits on main
git log main --oneline -20

# Compare what's on main vs a known good state
git log <known-good-sha>..main --oneline
```

### Revert on develop

Never commit directly to `main`. Revert on `develop` first, then release:

```bash
# Create a revert commit on develop
git checkout develop
git revert <bad-commit-sha> --no-edit

# If the revert touches multiple commits (e.g., a squash-merged feature)
git revert <oldest-sha>..<newest-sha> --no-edit

# Verify locally
npm run typecheck 2>&1
npm run lint 2>&1
npm run test 2>&1
npm run build 2>&1

# Push to develop
git add -A && git push
```

### Release the Revert to Production

Once the revert is on `develop` and CI passes, follow the standard release process:

```bash
# Check CI status on develop
gh run list --branch develop --limit 5

# When all checks pass, create the release PR (user must authorize)
gh pr create --base main --head develop --title "Revert: <description of what was reverted>"
```

Wait for all 5 required checks (`lint-and-typecheck`, `test`, `build`, `e2e`, `Smoke test Vercel preview`) to pass, then the user merges.

### Reverting a Dependency Upgrade

For framework or dependency regressions (see 2026-03-24 incident), pin back to the last known good version:

```bash
# Example: revert Next.js to a previous version
npm install next@<last-good-version>

# Commit
git add package.json package-lock.json
git commit -m "revert: downgrade next to <version> — runtime crash on Vercel (#<issue>)"
```

---

## 3. Database Migration Rollback

### Forward-Only Principle

**Supabase migrations are forward-only. There are no `down.sql` files.**

Reasons:
- Applied migrations may have already modified data. A `down.sql` that drops a column cannot restore data that was inserted into that column after the migration ran.
- The Supabase migration runner does not support rollback natively.
- Forward-only migrations are simpler to reason about and audit.

**What to do instead of rolling back a migration: write a compensation migration.**

### Compensation Migration

A compensation migration is a new, forward-applied migration that reverses the effect of a previous one.

```bash
# Generate a new migration file
touch supabase/migrations/$(date +%Y%m%d%H%M%S)_revert_<description>.sql
```

Examples:

```sql
-- Revert a dropped column: add it back
ALTER TABLE chunks ADD COLUMN IF NOT EXISTS old_column_name text;

-- Revert a dropped table: recreate it (structure only — data is gone)
CREATE TABLE IF NOT EXISTS analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- ... columns ...
);

-- Revert a changed column type: alter it back
ALTER TABLE chunks ALTER COLUMN embedding TYPE vector(1024);
```

> **Data is not recoverable through a compensation migration.** If the original migration dropped a table or truncated data, that data is gone unless a backup exists. See the Migration Policy runbook (`migration-policy.md`) for pre-migration backup requirements.

### Applying the Compensation Migration

```bash
# Test locally first (requires Docker Desktop)
supabase start
supabase db reset

# Push to production after local verification
supabase db push

# Verify the fix
curl -s https://paisaxe.es/api/health | jq
```

---

## 4. Incident Communication Template

Use this template when production is impacted. Post updates in the relevant Slack channel, GitHub issue, or status page.

### Initial Alert (post within 5 minutes of discovering the issue)

```
INCIDENT: [paisaxe.es] Production degradation
Time detected: HH:MM UTC
Impact: [Brief description — e.g., "All pages returning 500", "Chat API down", "Site fully down"]
Status: Investigating
```

### Rollback Confirmed (post when rollback is in progress or complete)

```
UPDATE: [paisaxe.es] Rollback in progress
Time: HH:MM UTC
Action taken: [e.g., "Promoted deployment <id> from YYYY-MM-DD HH:MM UTC to production"]
Root cause (preliminary): [e.g., "Next.js 16.2.1 runtime crash on Vercel serverless"]
ETA to resolution: [e.g., "Site should be back in 2-3 minutes"]
```

### Resolution (post when site is confirmed healthy)

```
RESOLVED: [paisaxe.es] Production restored
Time: HH:MM UTC
Duration: X minutes
Root cause: [One sentence summary]
What was rolled back: [Deployment ID / commit SHA / migration]
Follow-up: [Issue #N tracking permanent fix / post-mortem]
```

---

## Quick Reference

| Situation | Action | Time to recover |
|-----------|--------|----------------|
| Broken deployment (runtime crash) | Vercel dashboard → Promote previous | 2-3 min |
| Bad commit, CI still passing | `git revert` on develop → PR to main | 30-60 min |
| Bad dependency upgrade | Pin back to previous version → PR to main | 30-60 min |
| Bad migration (no data loss) | Compensation migration → `supabase db push` | 15-30 min |
| Bad migration (data dropped) | Compensation migration + restore from backup | Variable |

---

## Related Runbooks

- [Migration Policy](./migration-policy.md) — expand/contract pattern, destructive migration checklist
- [Operations Guide](./operations.md) — health endpoint, CI/CD, pre-launch checklist
- [CoE: 2026-03-24 Dependabot Incident](../coe/2026-03-24-dependabot-production-incident.md)
