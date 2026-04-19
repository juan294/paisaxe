# Log Aggregation & Retention — Paisaxe

> Runbook for structured logging, Vercel log drains, and retention strategy.

## Overview

Paisaxe uses a thin structured-logging wrapper at `src/lib/logger.ts`. All server-side
code that emits diagnostic events SHOULD use this module rather than raw `console.*`
calls, so that logs are machine-readable and can be forwarded to an external aggregator.

The module uses **pino** in production (fast JSON serialisation, Vercel-compatible) and a
synchronous console shim in development and test environments (same JSON schema, easy to
assert in unit tests).

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

Add new keys here when introducing new diagnostic log points.

---

## Vercel Log Drain Setup (BetterStack / Logtail)

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
