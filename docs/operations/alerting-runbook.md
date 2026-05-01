# Alerting Runbook

> Response procedures for Paisaxe production alerts.

## Alert Channels

| Channel | Used for | Owner |
|---------|----------|-------|
| PostHog Alerts | Error rate spikes, event anomalies | Juan Gonzalez |
| Vercel email notifications | Build failures, deployment errors | Juan Gonzalez |
| Sentry (if configured) | Unhandled exceptions, performance regressions | Juan Gonzalez |
| Manual monitoring | `/api/health` endpoint status | Juan Gonzalez |

**Escalation path:** All alerts route to Juan Gonzalez (solo developer). No on-call rotation. For incidents affecting real users, triage immediately during business hours; review within 24 h at off-hours.

---

## Health Endpoint Degraded

**Trigger:** `GET https://paisaxe.es/api/health` returns non-200 or `status != "healthy"`.

**Steps:**

1. Check Vercel deployment status: `vercel ls --limit 5`
2. Check the latest deployment logs in the Vercel dashboard for build or startup errors.
3. Verify Supabase is reachable:
   - Open Supabase dashboard → check for ongoing incidents at status.supabase.com
   - Run a manual query against the project to confirm connectivity
4. Check if environment variables are missing or malformed:
   - Review the Vercel project settings → Environment Variables
   - Common issue: invisible trailing whitespace (`.trim()` all values before use)
5. Check recent commits on `main` for changes that could affect startup or the health route.
6. **Rollback procedure** (if a bad deploy caused the degradation):
   ```bash
   # Identify the last known-good deployment
   vercel ls --limit 10
   # Promote it
   vercel promote <deployment-url>
   ```
7. After restoring health, file a post-mortem issue: `gh issue create --title "Incident: health endpoint degraded <date>" --label "type: bug,priority: critical,area: infra"`

---

## Cron Job Failure

**Trigger:** A Vercel Cron job (pg_cron, webhook dispatch) fails or does not fire. Observable via `[CRON_FAILURE]` log events or absence of `[CRON_SUCCESS]` log events.

### Structured Telemetry Log Events

All cron handlers emit structured log events on every run:

| Event | Level | Fields | Meaning |
|-------|-------|--------|---------|
| `[CRON_SUCCESS]` | `info` | `job`, `duration_ms` | Job completed successfully |
| `[CRON_FAILURE]` | `error` | `job`, `error` | Job failed with an error message |

**Job names** (match `vercel.json` paths):

| Job name | Route | Schedule |
|----------|-------|----------|
| `github-traffic-sync` | `/api/cron/github-traffic-sync` | Every 6 hours |
| `content-discovery` | `/api/cron/content-discovery` | Weekly Mon 3 AM |
| `subscription-optimizer` | `/api/cron/subscription-optimizer` | Weekly Mon 4 AM |
| `fail-stale-translations` | `/api/cron/fail-stale-translations` | Every 15 min |
| `fail-stale-bookings` | `/api/cron/fail-stale-bookings` | Every 5 min |

**Example log drain query** (filter by structured field in Vercel / log aggregator):
```
msg:[CRON_FAILURE] OR msg:[CRON_SUCCESS]
```

**Steps:**

1. Check Vercel Cron logs: Vercel dashboard → Project → Deployments → Functions → Cron Logs
2. Search for `[CRON_FAILURE]` events — the `job` and `error` fields identify the failing handler.
3. Identify which cron route failed (see `vercel.json` for the schedule definitions).
4. Test the route manually:
   ```bash
   curl -X POST https://paisaxe.es/api/cron/<route> \
     -H "Authorization: Bearer $CRON_SECRET"
   ```
5. Check for dependency issues: Supabase connectivity, external API rate limits (PostHog, ElevenLabs, etc.)
6. If the job is idempotent, trigger it manually once the root cause is resolved.
7. If it cannot be recovered, log the missed run and resume on the next scheduled interval.
8. For recurring failures: set up a log drain alert on `[CRON_FAILURE]` events in your log aggregator.

---

## Cron Auth Rejected

**Trigger:** `[CRON_AUTH_REJECTED]` log events — cron route handler rejected the incoming request before executing the job.

**Fields:** `reason` — one of `missing_secret` (no `CRON_SECRET` env var configured), `header_missing` (request had no `Authorization` header), or `mismatch` (header value didn't match secret).

**Steps:**

1. Check the `cron_auth` field in `/api/health` — it surfaces the current cron secret validation state.
2. For `missing_secret`: verify `CRON_SECRET` is set in Vercel environment variables → Settings → Environment Variables.
3. For `header_missing` or `mismatch`: verify the Vercel cron configuration (`vercel.json`) is sending the correct Authorization header, or that the secret wasn't rotated without updating all call sites.
4. Once the secret is correctly configured, trigger the affected cron manually to confirm:
   ```bash
   curl -X POST https://paisaxe.es/api/cron/<route> \
     -H "Authorization: Bearer $CRON_SECRET"
   ```

---

## Honeypot Triggered

**Trigger:** `[HONEYPOT_TRIGGERED]` log events on `POST /api/suggestions` — a bot submitted the hidden `website` field.

This is informational only — the request was silently discarded with a fake 200 response. No action required unless the volume is high enough to indicate an active campaign.

**Steps:**

1. If volume is high, check `ip` and `user_agent` in the log meta.
2. Consider adding Cloudflare rate limiting at the CDN level for the `/api/suggestions` route.
3. If the honeypot field is being triggered by a legitimate browser extension that autofills hidden fields, investigate whether to adjust the field name.

---

## Error Rate Spike

**Trigger:** PostHog alert — error event rate exceeds baseline by 2× or more.

**Steps:**

1. Open PostHog → Insights → filter by `$exception` events in the last 1 hour.
2. Identify the top error types and affected routes.
3. Cross-reference with recent deploys: `git log main --oneline --since="2 hours ago"`
4. If a deploy caused the spike:
   - Hotfix on `develop`, create a release PR, and fast-track through CI
   - Or rollback (see rollback procedure above)
5. If external service (Anthropic, ElevenLabs, Stripe, Supabase) is down:
   - Check the service status page
   - Graceful degradation is in place for most routes — verify fallback behavior
   - No code change needed; monitor until the service recovers

---

## Build / Deploy Failure

**Trigger:** Vercel build fails on `main` (CI notification email).

**Steps:**

1. Check GitHub Actions for the failing check: `gh run list --branch main --limit 3`
2. View the specific failure: `gh run view <run-id> --log-failed`
3. Fix the issue on `develop`, push, and verify CI passes.
4. Create a hotfix PR `develop → main` only if the failure is blocking a critical path.
5. Do NOT force-push to `main` — branch protection is in place.

---

## Develop Smoke Check Failure (DO-M5)

**Trigger:** The `Develop smoke check` job fails in CI on a direct `develop` push.

This job uses `continue-on-error: true` so it never blocks the push, but a failure indicates a runtime regression in the Vercel preview that was not caught by unit tests or the dummy-key build (e.g. a missing env var, a broken API route, or a Dependabot dependency bump with a breaking change).

**Steps:**

1. Check which step failed: `gh run list --branch develop --limit 3`, then `gh run view <run-id> --log-failed`
2. Identify the failing probe:
   - `Smoke check - liveness endpoint` (`/api/health/live`) — the process is not serving requests (startup crash, build error, or Vercel config issue)
   - `Smoke check - health endpoint` (`/api/health`) — the app started but a backend dependency (Supabase, Anthropic, etc.) is unreachable or returning `status != "healthy"`
3. Check the Vercel preview URL from the workflow output and hit it manually to confirm the failure.
4. Fix on `develop`, push, and verify the next smoke run passes before creating a release PR to `main`.
5. If the failure is from a Dependabot dependency bump: check the dep changelog for breaking changes, then pin or revert as needed.

---

## Stripe Webhook Failure

**Trigger:** Stripe dashboard shows failed webhook deliveries.

**Steps:**

1. Check Stripe dashboard → Developers → Webhooks → recent delivery attempts.
2. Identify the failing event type.
3. Test the endpoint manually using the Stripe CLI:
   ```bash
   stripe trigger payment_intent.succeeded
   ```
4. Check for `STRIPE_WEBHOOK_SECRET` env var correctness in Vercel.
5. Stripe retries failed webhooks automatically for 3 days — once fixed, deliveries will resume.

---

## See Also

- [Rollback runbook](rollback.md)
- [Operations overview](operations.md)
- [Branch protection](branch-protection.md)
- [Pending setup items](pending-setup.md)
