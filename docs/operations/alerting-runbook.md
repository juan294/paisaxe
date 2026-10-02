# Alerting Runbook

> Response procedures for Paisaxe production alerts.

## Alert Channels

| Channel | Used for | Owner |
|---------|----------|-------|
| PostHog Alerts | Error rate spikes, event anomalies | Juan Gonzalez |
| Vercel email notifications | Build failures, deployment errors | Juan Gonzalez |
| Sentry (DSN configured; delivery unverified — see below) | Unhandled exceptions, performance regressions | Juan Gonzalez |
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

## Sentry Delivery Unverified (DO-B1)

**Status as of 2026-08-18:** The Sentry project `the-creative-token/paisaxe` exists and
`NEXT_PUBLIC_SENTRY_DSN` is configured, so `/api/health` correctly reports
`sentry.status: "configured"`. That only confirms the SDK was initialized with a DSN — it
does **not** confirm events are reaching the project. A 90-day dashboard query returned
zero issues, including across the 2026-07-20 outage window, where a real production
failure left no trace in Sentry. Treat "configured" and "verified delivering" as two
different claims until this is checked.

This means every procedure below that says "check Sentry" or relies on Sentry as a
signal may currently be checking a dashboard that never receives events. Cross-check with
PostHog `$exception` events and the Vercel function logs / log drain (see
`docs/operations/logging.md`) until delivery is confirmed.

**Verification procedure (human action required):**

1. Run `npm run verify-sentry-delivery` with the same DSN production uses. It fires a
   synthetic exception tagged `do_b1_sentry_delivery_check:true` and prints a unique
   marker — see `scripts/verify-sentry-delivery.ts` for details.
2. Open the Sentry dashboard for `the-creative-token/paisaxe` and confirm an issue with
   that tag/marker actually arrives (usually within ~1 minute).
3. If nothing arrives after a few minutes, the pipeline is broken — this is a real
   observability gap, not a docs issue. File/reopen an issue and keep #821 open.
4. Only once a human has completed steps 1–3 successfully should this section (and #821)
   be considered resolved.

---

## Health Endpoint Degraded

**Trigger:** `GET https://paisaxe.es/api/health` returns `status != "healthy"` in the JSON body (the endpoint always returns HTTP 200; degraded state is signalled via the body only).

**Automated monitor:** CI uses `node scripts/check-health-readiness.mjs <base-url>` to parse `/api/health` and fail on any non-healthy body. The required `Smoke test Vercel preview` gate does **not** currently pass `--require-sentry` — missing Sentry configuration is not release-blocking today. `sentry.status: "configured"` (see DO-B1) only proves `NEXT_PUBLIC_SENTRY_DSN` is non-empty, not that error delivery actually works, and the Preview environment does not carry that DSN — hard-gating on it now would fail every release PR. `/api/health/live` still returns liveness regardless.

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
     -H "x-webhook-secret: $WEBHOOK_SECRET"
   ```
   (`GET` is what Vercel Cron itself sends, authenticated via `Authorization: Bearer $CRON_SECRET` — see
   `verifyVercelCron` in `src/lib/cron-auth.ts`. The `POST` handler used for manual/pg_cron recovery
   checks `verifyWebhookSecret` instead, which reads the `x-webhook-secret` header against
   `WEBHOOK_SECRET`, falling back to admin-cookie auth. A `POST` with an `Authorization: Bearer` header
   returns 401.)
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
3. For `header_missing` or `mismatch`: verify the Vercel cron configuration (`vercel.json`) is sending the correct Authorization header, or that the secret wasn't rotated without updating all call sites — see [secret-inventory.md](secret-inventory.md#cron_secret-rotation-vercel-and-the-operators-local-copy) for `CRON_SECRET`'s multi-homed rotation order (Vercel's own Cron feature reads this env var, and the operator's local `.env.local` copy goes stale silently).
4. Once the secret is correctly configured, trigger the affected cron manually to confirm (see the
   `POST` auth note under [Cron Job Failure](#cron-job-failure) above):
   ```bash
   curl -X POST https://paisaxe.es/api/cron/<route> \
     -H "x-webhook-secret: $WEBHOOK_SECRET"
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

## ElevenLabs Voice Credential Rejected

**Trigger:** `[ELEVENLABS_CREDENTIAL_REJECTED]`, a failed
`elevenlabs-voice-canary` monitor check-in, or `/api/health/voice` returning
`provider: credential_rejected`.

The event contains only the safe fingerprint, provider status, agent key, and
failure class. It must never contain an API key, bearer, provider response
body, or signed `wss://` URL.

1. Treat this as an active voice outage. Visitor, admin, and booking paths use
   the same production runtime key.
2. Compare the reported fingerprint with
   `ELEVENLABS_API_KEY_FINGERPRINT` in the affected Vercel environment.
3. If the key was disabled, expired, or replaced, follow
   [the credential rotation runbook](../runbooks/elevenlabs-credential-rotation.md).
   Keep the old key enabled until the new candidate passes.
4. Run `npm run check-elevenlabs-voice` against the candidate, then production,
   with the appropriate `RELEASE_TARGET_URL` and `HEALTH_PROBE_SECRET`.
5. Confirm a successful scheduled check-in after recovery.

Sentry delivery is still unverified as documented above. Do not mark the voice
alert ready until a success check-in and a test credential-rejection event both
arrive at the operator destination.

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

## Stripe Payment-Without-Grant (QA-L4)

**Trigger:** `[STRIPE_UNRECOVERABLE]` or `[STRIPE_RPC_TIMEOUT]` log events from `src/app/api/webhooks/stripe/route.ts`. Both are logged at `error` level and also forwarded to Sentry via `Sentry.captureMessage()` (search the `stripe_alert` tag below), in addition to the structured log line.

This is the highest-severity silent-failure class in the system: Stripe has taken payment, but the handler could not grant access, and — for `STRIPE_UNRECOVERABLE` specifically — the endpoint deliberately returns `200` so Stripe stops retrying (retrying a malformed event forever would be worse). **Do not change that 200 response** to force retries; a malformed event will never become processable no matter how many times Stripe redelivers it. If a reconciliation job is ever added to detect this class automatically, it must be strictly read-only against Stripe/the DB — remediation stays a manual, audited action (see Steps below).

### Structured Telemetry Log Events

| Event | Level | Fields | Sentry tag | Meaning |
|-------|-------|--------|------------|---------|
| `[STRIPE_UNRECOVERABLE]` | `error` | `eventId`, `reason` (`missing_user_id` \| `missing_payment_intent`) | `stripe_alert: "unrecoverable"` | Checkout session paid but carries no usable `user_id` / `payment_intent` in metadata — the grant RPC is never called. Returns `200` so Stripe stops retrying. |
| `[STRIPE_RPC_TIMEOUT]` | `error` | `eventId`, `purchaseType` | `stripe_alert: "rpc_timeout"` | The `grant_day_pass_idempotent` RPC took longer than 10s (BE-L2 client-side timeout). Returns `500` so Stripe retries — the retry itself is safe (the RPC is idempotent on `eventId`), but repeated timeouts indicate a systemic DB issue, not a transient blip. |
| `[STRIPE_RPC_FAILURE]` | `error` | `eventId`, `error` | — (not yet wired to Sentry; same remediation path applies) | The RPC returned a Postgres error. Returns `500` so Stripe retries. |

**Example log drain query:**
```
msg:[STRIPE_UNRECOVERABLE] OR msg:[STRIPE_RPC_TIMEOUT] OR msg:[STRIPE_RPC_FAILURE]
```

### Manual-grant remediation procedure

1. Find the event: search Vercel logs (or Sentry, tag `stripe_alert`) for the `eventId` in the marker, then look up that event in the Stripe dashboard → Developers → Events to confirm payment actually settled (`payment_status: "paid"`) and read `checkout.session.completed.data.object.metadata` for the intended `user_id` and `purchase_type`.
2. Confirm no grant already exists for that payment: `SELECT * FROM public.stripe_webhook_events WHERE event_id = '<eventId>';` and `SELECT * FROM public.voice_purchases WHERE payment_provider_id = '<payment_intent id from Stripe>';` — if a row already exists, no action is needed (the grant succeeded on a later retry).
3. If confirmed paid with no grant, call the same RPC the webhook would have called, using the Supabase SQL editor (or `psql` against production, service-role only) with the values recovered from Stripe:
   ```sql
   SELECT public.grant_day_pass_idempotent(
     p_event_id           => '<Stripe event id>',
     p_event_type         => '<Stripe event type>',
     p_user_id            => '<user_id from session metadata>',
     p_payment_provider_id => '<payment_intent id>',
     p_expires_at         => '<now() + entitlement window for purchase_type>',
     p_amount_paid        => <session.amount_total>,
     p_purchase_type      => '<purchase_type from session metadata>'
   );
   ```
   This is the exact idempotent path the webhook uses — safe to run even if a concurrent retry lands at the same time (it will simply report `'duplicate'`).
4. Confirm the row now exists in `voice_purchases` and notify the affected user if there was a meaningful delay.
5. File a post-mortem issue if this was caused by a code/config bug (e.g. a checkout session created without `metadata.user_id`) rather than a one-off DB blip: `gh issue create --title "Incident: Stripe payment-without-grant <date>" --label "type: bug,priority: high,area: payments"`.

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
- [Secret inventory & rotation](secret-inventory.md) — for `Cron Auth Rejected` / `Stripe Webhook
  Failure` where the fix is a credential rotation, not just a config check
