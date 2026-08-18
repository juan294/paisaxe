# Alerting Runbook

> Response procedures for Paisaxe production alerts.

## Alert Channels

| Channel | Used for | Owner |
|---------|----------|-------|
| PostHog Alerts | Error rate spikes, event anomalies | Juan Gonzalez |
| Vercel email notifications | Build failures, deployment errors | Juan Gonzalez |
| Sentry (if configured) | Unhandled exceptions, performance regressions | Juan Gonzalez |
| Manual monitoring | `/api/health` endpoint status | Juan Gonzalez |

## Escalation & On-Call SLO (accepted risk)

Paisaxe is operated by a **single developer** (Juan Gonzalez). There is **no on-call rotation and no paging** — this is a deliberate, documented risk-acceptance decision appropriate to the project's current scale (low-volume tourism site, €1.99 voice passes, no PII beyond auth identity), not an oversight.

**Accepted Service-Level Objective (SLO):**

| Condition | Target response | Rationale |
|-----------|-----------------|-----------|
| Critical alert during **business hours** (approx. 09:00–21:00 CET) | Triage immediately (minutes) | Operator is typically reachable |
| Critical alert **off-hours / asleep** | Best-effort, reviewed within **24 h** | No paging; alerts are pull-based (email/dashboard), so off-hours detection is not guaranteed |
| Non-critical alert | Reviewed within **24 h** | — |

**What "accepted risk" means here:** an outage that begins off-hours may persist until the operator next checks alerts (worst case ~12 h overnight). For a non-life-critical, low-revenue site this downtime exposure is acceptable and is explicitly chosen over the cost/complexity of a paging rotation. The graceful-degradation fallbacks (fallback stories, fail-closed rate limiting, Stripe's 3-day webhook retry) bound the blast radius of most failure modes during that window.

**Escalation path:** All alert channels (PostHog, Vercel email, Sentry, manual `/api/health` checks) route to the single operator. There is no secondary contact. If the operator becomes unavailable for an extended period, the documented mitigation is to enable `maintenance_mode` (admin panel → Feature Flags → Behavior) to take the site to a safe holding state rather than leave it degraded.

**Re-evaluation trigger:** revisit this risk acceptance (and consider wiring critical alerts to a paging service such as BetterStack email-to-PagerDuty) if any of the following hold: sustained traffic growth, handling of sensitive user data, a second operator joins, or recurring off-hours incidents are observed.

---

## Health Endpoint Degraded

**Trigger:** `GET https://paisaxe.es/api/health` returns `status != "healthy"` in the JSON body (the endpoint always returns HTTP 200; degraded state is signalled via the body only).

**Automated monitor:** CI uses `node scripts/check-health-readiness.mjs <base-url>` to parse `/api/health` and fail on any non-healthy body. The required `Smoke test Vercel preview` gate adds `--require-sentry`, so missing Sentry configuration is treated as release-blocking even though `/api/health/live` still returns liveness.

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
| `retry-booking-sms` | `/api/cron/retry-booking-sms` | Every 10 min |

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

## Rate Limit Backend Degraded

**Trigger:** `GET https://paisaxe.es/api/health` returns `rate_limit.status: "degraded"` in the JSON body.

**Fields:** `rate_limit.backend` — `"blocked"` (Upstash credentials absent in production) or `"upstash"` with `reason: "upstash_unavailable"` (credentials present but Redis unreachable).

**Steps:**

1. For `backend: "blocked"` / `reason: "upstash_missing"`: verify `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set in Vercel environment variables → Settings → Environment Variables.
2. For `reason: "upstash_unavailable"`: check the Upstash console for Redis instance health. The rate limiter has already failed closed — all chat/API requests are being denied until Redis recovers.
3. Once credentials are corrected or Redis recovers, the `rate_limit.status` will return to `"ok"` on the next health probe without a redeploy.

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

## Develop Push Runtime Regressions (DO-H1)

**There is no smoke check on direct `develop` pushes.** A prior "Develop smoke check" job (DO-M5) was removed (DO-H1) because it could never probe anything — `vercel.json`'s `ignoreCommand` skips the Vercel build for direct `develop` pushes, so the job's wait loop always timed out, and its timeout branch always reported success anyway. Full rationale is in the comment header of `.github/workflows/ci.yml`. Building a real preview for `develop` pushes instead was rejected: Preview deployments share production Supabase and live Stripe keys, so a mutating probe there would be a production write.

**What this means operationally:** a runtime regression introduced by a direct `develop` push (missing env var, broken API route, a Dependabot bump with a breaking change) is not caught until the next PR from `develop` to `main` runs `preview-smoke.yml` — the **"Smoke test Vercel preview"** required check, which has a genuine preview to probe. Until that PR runs:

1. Assume `develop` HEAD's runtime health is unverified beyond what the dummy-key CI build (`Lint & Typecheck`, `Test`, `Build`) catches.
2. If you need runtime confidence sooner, open a PR from `develop` to `main` (without merging) to trigger `preview-smoke.yml` early, or verify manually against a local Docker stack.
3. If `preview-smoke.yml` fails on a release PR, fix on `develop`, push, and let the PR re-run before merging (see `docs/runbooks/release-checklist.md`).

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
