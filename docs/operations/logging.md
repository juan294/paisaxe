# Log Aggregation & Retention — Paisaxe

> Runbook for structured logging, Vercel log drains, and retention strategy.

## Overview

Paisaxe uses a thin structured-logging wrapper at `src/lib/logger.ts`. All server-side
code that emits diagnostic events SHOULD use this module rather than raw `console.*`
calls, so that logs are machine-readable and can be forwarded to an external aggregator.

The module uses **pino** in production (fast JSON serialisation, Vercel-compatible) and a
synchronous console shim in development and test environments (same JSON schema, easy to
assert in unit tests).

**Console guard**: An ESLint rule blocks raw `console.*` calls in API routes (`src/app/api/**`).
All diagnostic output in server code must go through `logger` so it is structured, sanitized,
and forwarded to Sentry.

**Sentry integration**: All `logger.error()` calls also surface in Sentry with the full metadata
object as extra context. PII is stripped via `beforeSend` in `src/lib/logger-sanitize.ts` before
events are transmitted.

> **Sentry delivery status: configured but unverified (as of 2026-08-18).** The Sentry
> project `the-creative-token/paisaxe` exists and `NEXT_PUBLIC_SENTRY_DSN` is set, so
> `/api/health` correctly reports `sentry.status: "configured"` — but "configured" only
> means the SDK was initialized with a DSN, not that events are reaching the project. A
> 90-day issue query against the dashboard returned **zero results**, including across
> the known 2026-07-20 outage window where a real production failure occurred and left
> no trace in Sentry. Do not read "configured" as "verified working."
>
> **Verification procedure:** run `npm run verify-sentry-delivery` (see
> `scripts/verify-sentry-delivery.ts`) with the same DSN production uses. It fires one
> synthetic exception tagged `do_b1_sentry_delivery_check:true` and prints a unique
> marker. A human must then open the Sentry dashboard and confirm an issue with that
> tag/marker actually arrived — the script cannot check the live dashboard itself, so a
> successful run only proves the SDK attempted delivery, not that Sentry received it.
> Tracked in GitHub issue #821 until that dashboard check has actually been done.

---

## Using the Logger

```typescript
import { logger } from "@/lib/logger";

// Info — operational events
logger.info("[STARTUP]");
logger.info("[SEARCH_COMPLETE]", { query: "playas", results: 3, duration_ms: 42 });

// Warn — degraded but recoverable
logger.warn("[FEATURE_FLAG_FAILURE]", { flag: "visitor_voice_agent", error: err.message });
logger.warn("[TABLE_FALLBACK]", { table: "chunks", fallback: "keyword_search" });

// Error — failure requiring attention
logger.error("[CHAT_STREAM_FAILURE]", { error: err.message, duration_ms: 1200 });
logger.error("[PAYMENT_WEBHOOK_FAILURE]", { event: "checkout.session.completed", code: 500 });
```

### API

```typescript
logger.info(msg: string, meta?: Record<string, unknown>): void
logger.warn(msg: string, meta?: Record<string, unknown>): void
logger.error(msg: string, meta?: Record<string, unknown>): void
```

All methods accept an optional `meta` object. Every emitted line is a single JSON object
with at minimum `{ time, level, msg }`.

---

## Log Key Conventions

Use ALL_CAPS bracket keys as the message string. This makes log lines easy to grep and
alert on.

| Key | Level | Meaning |
|-----|-------|---------|
| `[TABLE_FALLBACK]` | warn | Vector search unavailable; fell back to keyword search |
| `[FEATURE_FLAG_FAILURE]` | warn | Feature flag lookup threw or timed out |
| `[CHAT_STREAM_FAILURE]` | error | Claude streaming response failed mid-stream |
| `[PAYMENT_WEBHOOK_FAILURE]` | error | Stripe webhook handler returned non-2xx |
| `[SEARCH_COMPLETE]` | info | Hybrid search returned results (include `duration_ms`) |
| `[STARTUP]` | info | Application cold start (edge / serverless function warm-up) |
| `[RERANK_FAILURE]` | error | Voyage reranking step failed; results returned unranked |
| `[CSRF_VALIDATION_FAILURE]` | warn | CSRF double-submit cookie mismatch on a state-mutating request |
| `[RATE_LIMIT_EXCEEDED]` | warn | Per-IP rate limit hit; includes `ip` and `route` in meta |
| `[RATE_LIMIT_DEGRADED]` | warn | Rate limiter fell back to in-memory (Redis unavailable) |
| `[STRIPE_WEBHOOK_INVALID_SIG]` | error | Stripe webhook signature verification failed |
| `[TRANSLATION_STALE]` | warn | Story stuck in `translating` state past timeout; marked failed |
| `[ELEVENLABS_WEBHOOK_FAILURE]` | error | Post-call ElevenLabs webhook could not parse transcript |
| `[CRON_SUCCESS]` | info | Cron job completed; includes `job` (name) and `duration_ms` |
| `[CRON_FAILURE]` | error | Cron job threw; includes `job` (name) and `error` (message) |
| `[CRON_AUTH_REJECTED]` | warn | Vercel cron secret verification failed; includes `reason` (`missing_secret` \| `header_missing` \| `mismatch`) |
| `[HONEYPOT_TRIGGERED]` | warn | Suggestion POST honeypot field was non-empty; request silently discarded |
| `[ADMIN_AUDIT]` | info | Admin write action; includes `route`, `action`, and `user_id` |
| `[ADMIN_PROFILE_LOOKUP_FAILED]` | error | Non-PGRST116 error during admin role lookup; indicates DB connectivity issue |

Add new keys here when introducing new diagnostic log points.

---

## Vercel Log Drain Setup (BetterStack / Logtail)

> **Status: UNVERIFIED — treat as not confirmed working.**
>
> A "confirm and configure" task for this drain was tracked in #503, which was closed on
> 2026-05-01 with **no recorded evidence** (no closing comment, no live-tail
> confirmation) that a drain was actually observed receiving traffic. The closure is not
> proof the drain works — as of 2026-08-18 there is still no independent confirmation
> either way, and the 2026-07-20 outage left no trace in Sentry either (see the Sentry
> section above), which is consistent with neither sink having ever been verified live.
>
> Vercel Pro plan retention can be as short as 1 hour for function logs. Without a
> confirmed-working drain, logs from an incident may be irrecoverably lost before anyone
> can investigate.
>
> **How to verify (human dashboard action — no CLI equivalent exists for this check):**
> Vercel dashboard → Project → Settings → Log Drains. If the list is empty, no drain is
> active. If a drain IS listed, trigger a request against production and confirm a
> matching JSON line appears in the drain destination's live tail within a minute or
> two — a drain merely existing in the list is not the same as it delivering.
>
> **Tracking:** GitHub issue #821 is the live tracker for this until a human has
> actually observed a production log line arrive at the drain destination. Do not close
> #821 (or re-close a follow-up) on doc or config changes alone.
>
> **Impact of not doing it:** All runtime logs (errors, payment events, auth failures) are
> lost after Vercel's retention window. Stripe dispute resolution requires payment audit
> trails — this is a compliance risk.

Vercel supports [log drains](https://vercel.com/docs/observability/log-drains/log-drains-reference)
that forward all function logs to an external service in real time.

### Step-by-step: BetterStack (Logtail) Free Tier

BetterStack's free tier provides **1 GB/month ingestion** and **3-day retention** — adequate
for development, but see the Retention section below for production requirements.

1. **Create a BetterStack account** at <https://betterstack.com>

2. **Create a new Source**
   - Go to Logs → Sources → New Source
   - Platform: **HTTP**
   - Name: `paisaxe-production` (or `paisaxe-preview`)
   - Copy the **Source token** shown after creation.

3. **Add the log drain in Vercel**

   ```bash
   # Replace <SOURCE_TOKEN> with the token from BetterStack
   vercel log-drains add \
     --url "https://in.logs.betterstack.com" \
     --type json \
     --header "Authorization: Bearer <SOURCE_TOKEN>" \
     --project paisaxe
   ```

   Or via the Vercel dashboard: Project → Settings → Log Drains → Add Drain.

   | Field | Value |
   |-------|-------|
   | Delivery format | JSON |
   | URL | `https://in.logs.betterstack.com` |
   | Custom headers | `Authorization: Bearer <SOURCE_TOKEN>` |
   | Environments | Production, Preview (choose as needed) |

4. **Verify** — Trigger a request to the deployed app and check BetterStack → Live Tail.
   You should see JSON objects with a `message` field (the pino-serialised line) plus
   Vercel metadata (`deploymentId`, `projectId`, `source`).

5. **Set up an alert** (recommended)
   - BetterStack → Alerts → New Alert
   - Condition: `level = "error"` OR keyword `[CHAT_STREAM_FAILURE]`
   - Channel: email or PagerDuty

---

## Log Retention Recommendation

| Environment | Minimum retention | Reason |
|-------------|-------------------|--------|
| Production  | **30 days** | Stripe requires merchants to retain payment audit trails for dispute resolution (typically 120 days). 30 days is the floor for diagnosing incidents after the fact. |
| Preview     | 7 days | Sufficient for PR-level debugging |
| Development | N/A (local only) | No drain needed |

### Upgrading BetterStack retention

BetterStack free tier retains logs for **3 days only**. To reach 30-day retention:

- **Starter plan** ($24/month): 30-day retention, unlimited ingestion — recommended for production.
- **Alternative: Axiom** (<https://axiom.co>) — free tier includes 90-day retention with 500 GB/month, generous for a single project.

To switch to Axiom:

1. Create a dataset at <https://app.axiom.co> → Datasets → New Dataset.
2. Get the API token: Settings → API Tokens.
3. Update the Vercel log drain URL to `https://api.axiom.co/v1/datasets/<DATASET>/ingest`
   with header `Authorization: Bearer <AXIOM_TOKEN>` and `Content-Type: application/json`.

---

## Local Development

The dev-mode shim writes synchronously to `process.stdout`. No external service is needed.

```bash
npm run dev
# Logs appear inline in the terminal as JSON lines:
# {"time":1776598509503,"level":"info","msg":"[SEARCH_COMPLETE]","results":3}
```

To pretty-print locally, pipe through `pino-pretty`:

```bash
npm run dev 2>&1 | npx pino-pretty
```

---

## Adding New Log Points

1. Import the logger: `import { logger } from "@/lib/logger";`
2. Choose a key following the `[SCREAMING_SNAKE_CASE]` convention.
3. Add the key to the table in this document.
4. No other configuration required — pino handles serialisation and the drain forwards automatically.
