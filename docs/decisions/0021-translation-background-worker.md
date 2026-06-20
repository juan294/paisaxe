# ADR-0021: Dedicated Background Worker for Translation When Volume Grows

**Status:** Accepted (deferred implementation)
**Date:** 2026-06-20
**Deciders:** Juan Gonzalez
**Context:** Issue #525 — BE-S1 from Wave 3 pre-launch audit

## Decision

Keep the current **HTTP-handler-drains-queue** translation architecture for now.
Define explicit volume thresholds at which work migrates to a **dedicated
background worker** (Inngest or Supabase Queues + Edge Function consumer). This
ADR records the trigger thresholds and the target architecture so the migration
is a planned step, not a reaction to a production incident.

## Context

`src/app/api/webhooks/translate/route.ts` durably enqueues translation jobs and
then **drains them inline within the same HTTP request**:

- Jobs are claimed with a row-level lease via the
  `claim_next_translate_webhook_event` RPC
  (`route.ts:242`, migration `supabase/migrations/079`).
- Batch size is **3** jobs per invocation (`TRANSLATE_JOB_BATCH_SIZE`,
  `route.ts:16`); each job runs `translateStory()` and takes ~5–15s.
- The lease is **180s** (`TRANSLATE_JOB_LEASE_SECONDS`, `route.ts:13`),
  deliberately sized so a 3-job batch (~45s) completes inside **Vercel's 60s
  function timeout** with ~15s margin.

This is a sound design for the current scale: durable enqueue (no lost jobs on
crash), lease-based reclaim of crashed handlers, and bounded fan-out so a bulk
story approval cannot spawn unbounded concurrent work. But it is **coupled to
the 60s HTTP timeout** — the batch size and lease are tuned around it. As
translation volume grows, draining inside the request stops fitting.

## Failure Modes at Scale

The current model degrades when:

1. **Backlog exceeds throughput.** With batch size 3 and one HTTP-triggered
   drain per enqueue/cron tick, a burst of approvals across many stories ×
   5 locales accumulates faster than handlers drain. Latency to "all
   translated" climbs.
2. **Per-job time approaches the budget.** Longer source stories or slower
   model responses push a 3-job batch past 45s, eroding the 60s margin and
   risking mid-batch timeouts (recoverable via lease, but wasteful).
3. **No independent retry/backoff.** Retries piggyback on the next HTTP trigger
   rather than an exponential-backoff scheduler.

## Migration Triggers (thresholds)

Migrate to a dedicated worker when **any** of these holds for a sustained period:

| Signal | Threshold |
|--------|-----------|
| Sustained translate queue depth | > 50 pending jobs for > 1h |
| p95 time-to-fully-translated after approval | > 10 min |
| Single-batch (3-job) wall time | > 45s observed regularly (timeout margin gone) |
| Bulk-approval bursts | > 20 stories approved within 5 min, routinely |
| Locale fan-out | adding locales beyond the current 5 (`en, fr, de, pt, ast`) |

Below these, the inline drain is the correct, simplest design — do not migrate
preemptively.

## Proposed Architecture (deferred)

Decouple **enqueue** (fast, in the HTTP request) from **process** (a worker,
unbounded by the 60s HTTP timeout):

**Option A — Supabase Queues + Edge Function consumer (lowest new surface)**
- Reuse the existing durable queue tables / RPCs from migration 079.
- A Supabase Edge Function (or pg_cron-driven consumer) drains the queue on its
  own schedule, with its own timeout envelope, independent of Vercel HTTP.
- The webhook becomes enqueue-only and returns `202 Accepted` immediately.
- Pro: stays inside the existing Supabase stack; no new vendor.

**Option B — Inngest (richest workflow primitives)**
- Webhook emits an `story/translate.requested` event.
- An Inngest function fans out per-locale steps with built-in concurrency
  limits, automatic retries with exponential backoff, and step-level
  observability.
- Pro: durable multi-step workflows, throttling, and retries out of the box.
- Con: new vendor + dependency; only justified once workflow complexity (per-
  locale retries, partial-failure handling) is the actual pain.

**Recommendation when triggered:** start with **Option A** (Supabase Queues
consumer) since the durable queue already exists in migration 079 — the change
is "move the drain loop out of the HTTP handler into a scheduled consumer." Move
to Inngest only if per-locale retry/backoff and step observability become
needed.

In both options the webhook handler's responsibility shrinks to: authenticate,
validate, `enqueue_translate_webhook_event`, return `202`. The
claim/process/complete RPCs stay; only the *caller* of the drain loop changes.

## Consequences

- No change today; the inline-drain architecture remains and is correct for
  current volume.
- The migration is pre-designed: a triggered move is mechanical and starts from
  the queue tables that already exist.
- Decoupling enqueue from process removes the 60s-timeout coupling that
  currently constrains `TRANSLATE_JOB_BATCH_SIZE` and `TRANSLATE_JOB_LEASE_SECONDS`.
- Revisit when any threshold above is crossed.
