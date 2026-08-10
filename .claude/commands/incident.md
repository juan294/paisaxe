# Incident Response

Coordinate incident investigation using a team of specialists for production issues.

## Usage
- `/incident` — starts investigation, asks for symptoms
- `/incident "health check failing"` — starts with the provided description

## Instructions

### Step 1: Gather Context

If an argument is provided, use it as the incident description. Otherwise, ask the user to describe the symptoms.

### Step 2: Create Team

Create a team called "incident-response" with 3 specialists running in parallel:

1. **health-checker** (subagent_type: general-purpose)
   - Hit `https://paisaxe.es/api/health` and check response
   - Hit `https://paisaxe.es/api/health/db` for database status
   - Hit `https://paisaxe.es/api/stripe-test` for Stripe connectivity
   - Check DNS resolution: `dig paisaxe.es`
   - Check SSL certificate validity: `curl -vI https://paisaxe.es 2>&1 | grep -i "expire\|subject\|issuer"`
   - Check Vercel deployment status: `vercel ls --limit 5` (if CLI available)
   - Report current status of each endpoint (UP/DOWN/DEGRADED + response time)

2. **log-analyst** (subagent_type: general-purpose)
   - Check recent git history: `git log --oneline -20`
   - Look for recent deployments that might have caused issues
   - Check for recent Vercel deployment logs: `vercel logs --limit 50` (if available)
   - Read the most recent agent reports for any related warnings
   - Check if any environment variables were recently changed
   - Look for patterns in errors (specific routes, specific times)

3. **rollback-assessor** (subagent_type: general-purpose)
   - Identify the last known-good commit: check CI status of recent commits
   - Assess what would be lost in a rollback (features, fixes since last good commit)
   - Prepare rollback commands but DO NOT execute them
   - Check if database migrations would need reversal
   - Assess risk level of rollback (LOW/MEDIUM/HIGH)

### Step 3: Synthesize Response

After all specialists complete, present findings to the user:

```
## Incident Report

### Current Status
[Summary of what's up/down/degraded]

### Probable Cause
[Most likely cause based on combined findings]

### Recommended Action
[What to do next — fix forward or rollback]

### Rollback Commands (if needed)

Roll back first, investigate second. See `docs/operations/rollback.md`.

```bash
# Preferred: promote the last known-good BUILD (no rebuild, seconds to recover)
vercel rollback [deployment-id]

# Code-level revert — on develop, then through the normal release PR. Never on main directly.
git revert [commit-hash]
```

NEVER use `vercel deploy --prod` during an incident. It triggers a fresh build rather than
restoring a known-good artifact, and doing so prolonged the 2026-03-24 outage twice
(`docs/coe/2026-03-24-dependabot-production-incident.md:85-90`).

### Timeline
[Chronological list of relevant events]
```

Present this to the user in stdout. Do NOT execute any rollback commands without user confirmation. Do NOT commit or push anything.
