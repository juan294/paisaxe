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

## PayPal Booking Deposits (experience booking, sandbox)

**Trigger:** any `error`-level marker below from the booking deposit flow
(`src/lib/booking/{capture,cancel,reconcile,webhook-events}.ts`,
`src/app/api/webhooks/paypal/route.ts`, `src/app/api/booking/voucher/redeem/route.ts`).
PayPal runs in **sandbox** only (`src/lib/paypal/env.ts` refuses any other host), so no real
money moves; the markers still mean a visitor's booking or deposit needs attention.

Design facts that shape the response: every capture goes through one path and only captures
buyer-approved orders; money that moved is confirmed or refunded, never shown unpaid (R2-01);
an uncertain capture stays `capture_pending` until PayPal says otherwise (R2-02); webhooks go
through the `paypal_webhook_events` inbox and are replayed by the `reconcile-bookings` cron
(every 5 minutes); every refund uses `refund:<payments.operation_key>` as its PayPal-Request-Id,
so a retry never refunds twice.

### Structured Telemetry Log Events

| Event | Level | Fields | Meaning | First response |
|-------|-------|--------|---------|----------------|
| `[PAYPAL_WEBHOOK_INVALID]` | `warn` (401), `error` (400) | `reason`, `transmissionId` | A request without PayPal's transmission headers or failing verification (401), or a verified event with no id or type (400) | Occasional 401s are scanners; a burst after a deploy means `PAYPAL_WEBHOOK_ID` no longer matches the listener: check it against the PayPal app's webhook |
| (HTTP 429, no marker) | — | — | The webhook route's per-IP limit (120 a minute) answered 429; in production it also fails closed when the rate-limit backend (Upstash) is unreachable, see "Rate Limit Backend Degraded" | Nothing is lost: PayPal redelivers, and the reconcile cron queries PayPal for every open payment. Fix the backend if `[RATE_LIMIT_DEGRADED]` accompanies it |
| `[PAYPAL_WEBHOOK_VERIFY_FAILED]` | `error` | `transmissionId`, `error` | PayPal's verification API could not answer; the route answers 500 so PayPal redelivers | Transient unless repeated; check PayPal status and the `PAYPAL_*` variables |
| `[PAYPAL_WEBHOOK_PROCESSING_FAILED]` | `error` | `eventId`, `eventType`, `error` | The event is stored but processing failed; 500, PayPal redelivers and the cron replays it from the inbox | Look for a following success for the same `eventId`; if none after 15 minutes, read its `last_error` in `paypal_webhook_events` |
| `[PAYPAL_WEBHOOK_UNMATCHED]` | `error` | `eventId`, `eventType`, `orderId`, `captureId` (invoice events: `eventId`, `eventType`, `invoiceId`) | The event matches no payment (for example another environment's event on a shared sandbox app); it stays in the inbox and the drain skips it | Expected for foreign events; investigate only if the order or custom id is one of ours |
| `[PAYPAL_CAPTURE_MISMATCH]` | `error` | `bookingId`, `orderId`/`eventId`, `source`, `captured` | An order or capture whose amount, currency or custom id is not the booking's. Uncaptured: never captured, booking `needs_attention`. Captured: refunded in one write (`order_mismatch`) | Treat as a possible tampering or integration bug: compare the order in the PayPal sandbox dashboard with the booking |
| `[PAYPAL_CAPTURE_DENIED]` | `error` | `bookingId`, `paymentId`, `eventId` | PayPal declined the capture; payment `capture_failed`, booking `needs_attention` | Nothing was charged; the visitor can be offered a new quote |
| `[PAYPAL_COMPENSATING]` | `error` | `bookingId`, `paymentId`, `reason` | Money moved but the booking cannot be fulfilled (`slot_gone`, `order_mismatch`, `duplicate_capture`); a refund was requested | Follow it with the `refund_id` until `refunded` (the cron does) |
| `[PAYPAL_REFUND_FAILED]` | `error` | `bookingId`, `paymentId`, `error` or `refundStatus` | A refund request failed (retried with the same key) or PayPal reported it `FAILED`/`CANCELLED` (payment `refund_failed`, booking `needs_attention`) | For a final failure, refund by hand in the PayPal dashboard; the `PAYMENT.CAPTURE.REFUNDED` webhook then records it |
| `[PAYPAL_REFUND_REFUSED]` | `error` | `bookingId`, `paymentId`, `status`, `issue` | A cancellation refund PayPal refuses for good (400/403/404/422 except `PREVIOUS_REQUEST_IN_PROGRESS`); not retried; payment `refund_failed`, booking `needs_attention` | Read `issue`, fix the cause (for example the sandbox merchant balance) and refund by hand. Known limitation: a refused compensation refund is still retried every run |
| `[BOOKING_CANCEL_REFUND_FAILED]` | `error` | `bookingId`, `error` | The cancellation is recorded but the refund request failed; the visitor saw "lo reintentaremos" and the cron retries with the same key | Check the next cron runs; escalate if it repeats |
| `[CRON_RECONCILE_ATTENTION]` | `error` | `bookingId`, `paymentId`, `passes`, `reason` — or `staleCount`, `bookingIds` | Three inconclusive capture passes (the payment stays `capture_pending` and keeps being reconciled), or bookings in `needs_attention` for more than 15 minutes | Open the operator view (`/operator/<capability>`): exceptions are highlighted; compare each with the PayPal sandbox order |
| `[VOUCHER_GRANT_FAILED]` | `error` | `userId`, `error` | Voucher redemption failed in the database (500); the visitor can retry | Check Supabase health and the `redeem_voucher` RPC |
| `[PAYPAL_CREATE_ORDER_FAILED]` | `error` | `bookingId`, `error` | The order could not be created (PayPal error or not configured); the tool and the pay button answer `payment_unavailable` | Check the `PAYPAL_*` variables and PayPal status |
| `[PAYPAL_INVOICE_FAILED]` | `error` | `bookingId`, `error` | `send_balance_invoice` could not create or send the balance invoice (PayPal error or not configured); the tool answers `payment_unavailable`. A created draft stays `draft` and the next call sends it | Check the `PAYPAL_*` variables and PayPal status; the visitor can ask again |
| `[PAYPAL_INVOICE_NO_PAYER]` | `error` | `bookingId`, `orderId` | The captured order has no payer email at PayPal, so the balance cannot be invoiced (`invalid_state`) | Look up the order in the sandbox dashboard; collect the balance another way |
| `[PAYPAL_INVOICE_DUPLICATE]` | `error` | `bookingId`, `kept`, `orphan` | Two concurrent calls created two invoices; `kept` is the booking's, `orphan` is an unsent draft | Delete the `orphan` draft in the PayPal dashboard; nothing was sent to the payer |
| `[PAYPAL_INVOICE_REFRESH_FAILED]` | `warn` | `bookingId`, `invoiceId`, `error` | A repeated `send_balance_invoice` could not re-read the invoice; the stored status was answered | Transient unless repeated |
| `[PAYPAL_INVOICE_PAID]` | `info` | `bookingId`, `invoiceId` | PayPal reported the invoice `PAID` with nothing due and the whole balance paid; `balance_paid_at` set | None |
| `[PAYPAL_INVOICE_UNSETTLED]` | `warn` | `bookingId`, `invoiceId`, `invoiceStatus`, `dueAmountCents` | An invoice-paid event (or re-read) for a partial (`PARTIALLY_PAID`) or pending (`PAYMENT_PENDING`) payment; the balance is not marked paid | None while pending; a partial payment should not happen (partial payments are disabled on the invoice): check the invoice |
| `[PAYPAL_INVOICE_MISMATCH]` | `error` | `bookingId`, `invoiceId`, `balanceCents`, `amountCents`, `paidAmountCents`, `dueAmountCents`, `currency` | PayPal says `PAID` but the amounts or currency are not the booking's balance; nothing is written | Compare the invoice in the sandbox dashboard with the booking; treat as an integration bug |
| `[PAYPAL_INVOICE_PAID_INACTIVE]` | `warn` | `bookingId`, `invoiceId`, `status` | The balance was paid on a booking that is no longer confirmed (money moved, so it is recorded) | Followed by `[BOOKING_BALANCE_PAID_ON_CANCEL]` once a cancellation completes |
| `[PAYPAL_INVOICE_CANCELLED]` | `info` | `bookingId`, `invoiceId` | The visitor cancelled the booking and its unpaid balance invoice was cancelled at PayPal | None |
| `[PAYPAL_INVOICE_CANCEL_FAILED]` | `error` | `bookingId`, `error` | The visitor's cancellation is recorded, but the balance invoice could not be cancelled now; it stays payable until the cron (step 9) cancels it | Check the next cron runs (`[CRON_RECONCILE_ITEM_FAILED]` with `step: "invoices"`); if it repeats, cancel the invoice by hand in the PayPal dashboard |
| `[BOOKING_BALANCE_PAID_ON_CANCEL]` | `error` | `bookingId`, `invoiceId`, `invoiceStatus` | A cancelled booking's balance had already been paid (or partly paid); the deposit was refunded per policy, the balance was **not** (known limitation); the booking is `needs_attention` | Decide with the visitor and refund the balance by hand in the PayPal dashboard (invoice refund) |

**Example log drain query:**
```
msg:[PAYPAL_* OR msg:[CRON_RECONCILE_ATTENTION] OR msg:[BOOKING_CANCEL_REFUND_FAILED] OR msg:[BOOKING_BALANCE_PAID_ON_CANCEL] OR msg:[VOUCHER_GRANT_FAILED]
```

**Read-only diagnosis (service role, local or with the owner's authorization for production):**

```sql
SELECT b.reference, b.status, b.cancellation_confirmed_at, b.invoice_id, b.invoice_status, b.balance_paid_at,
       p.status AS payment, p.order_id, p.capture_id, p.refund_id, p.compensation_reason, p.reconcile_passes
FROM public.bookings b LEFT JOIN public.payments p ON p.booking_id = b.id
WHERE b.id = '<bookingId>' ORDER BY p.created_at;

SELECT event_id, event_type, received_at, processed_at, attempts, last_error
FROM public.paypal_webhook_events WHERE processed_at IS NULL ORDER BY received_at;
```

Never change payment or booking rows by hand to "fix" a state: refund through PayPal and let
the webhook or the cron record it. Production writes need the owner's authorization.

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
