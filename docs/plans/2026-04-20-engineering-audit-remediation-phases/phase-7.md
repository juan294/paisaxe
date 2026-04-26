# Phase 7 — Webhook Idempotency Pattern Propagation

**Scope:** Apply the atomic-write idempotency pattern established in P1 to the other two webhook endpoints: `webhooks/elevenlabs` and `webhooks/translate`. These have the same defect class as the Stripe webhook — multi-write sequences without a transaction boundary — and the same fix template applies.

**Addresses:** §9#6.

**Batch eligibility:** No — depends on P1's RPC pattern + migration template.

---

## Current State (to be audited)

Before implementing, read both files end-to-end and identify each multi-write sequence:

```bash
# Expected inspection
cat src/app/api/webhooks/elevenlabs/route.ts
cat src/app/api/webhooks/translate/route.ts
ls supabase/migrations/ | grep -iE "elevenlabs|translate"
```

For each webhook, enumerate:
1. The dedup/idempotency key (event_id or equivalent).
2. The side-effect writes (which tables, in what order).
3. The current transaction boundary (likely none).
4. The current retry behavior (what HTTP status is returned on partial failure).

### Audit Addendum — 2026-04-23

- `webhooks/elevenlabs`
  - Equivalent idempotency key: `conversation_id` for `post_call_transcription` deliveries.
  - Current side effects: fetch `pending_bookings` row by `conversation_id` -> send SMS through Twilio -> update `pending_bookings.status` / `outcome_message`.
  - Transaction boundary: none. Duplicate deliveries can resend SMS, and the SMS send happens before the database write.
  - Retry behavior: route returns `200` for most downstream failures, including booking update failures after SMS has already been sent.

- `webhooks/translate`
  - Equivalent idempotency key: `storyId + locales + forceRetranslate` payload tuple.
  - Current side effects: route delegates to `translateStory()`, which updates `stories.metadata.translation_status` to `translating`, calls Anthropic, then updates `stories.metadata.translations` / `translation_status` again for success or failure.
  - Transaction boundary: none, and the external API call sits between two database writes.
  - Retry behavior: translation failures return `500`, but there is no webhook-level dedup guard, so repeated deliveries rerun the whole flow.

## Target State

For each webhook: a single `supabase.rpc('<name>_idempotent', { ... })` call wrapping dedup + side-effect writes in one Postgres function with `SECURITY DEFINER`, `SET search_path = ''`, `ON CONFLICT DO NOTHING`.

## Implementation Steps

### Step 7.1 — Inspect and document

Write a brief audit note in this phase file (inline addendum) summarizing the two webhook routes' current write sequences. If either is already atomic (unlikely but possible), mark as "already safe" and move on.

### Step 7.2 — Migration (shared)

`supabase/migrations/079_webhook_idempotency_rpcs.sql`:

```sql
-- Pseudocode — one function per webhook
CREATE OR REPLACE FUNCTION public.process_elevenlabs_event_idempotent(
  p_event_id TEXT,
  /* ... */
) RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_inserted UUID;
BEGIN
  INSERT INTO public.elevenlabs_webhook_events (event_id) VALUES (p_event_id)
    ON CONFLICT (event_id) DO NOTHING RETURNING id INTO v_inserted;
  IF v_inserted IS NULL THEN RETURN 'duplicate'; END IF;
  -- side-effect inserts here
  RETURN 'processed';
END; $$;

CREATE OR REPLACE FUNCTION public.process_translate_event_idempotent(
  p_event_id TEXT,
  /* ... */
) RETURNS TEXT /* ... similar structure */;

REVOKE ALL ON FUNCTION public.process_elevenlabs_event_idempotent(/*...*/) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_elevenlabs_event_idempotent(/*...*/) TO service_role;
-- Same grants for translate function.
```

Prerequisite: each webhook needs a dedup table analogous to `stripe_webhook_events`. If missing, create it in the same migration:

```sql
CREATE TABLE IF NOT EXISTS public.elevenlabs_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.translate_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Step 7.3 — Local migration verification

```bash
supabase start
supabase db reset
docker exec supabase_db_paisaxe psql -U postgres -c \
  "SELECT proname, prosecdef FROM pg_proc WHERE proname LIKE '%_idempotent';"
```

Expect both functions present with `prosecdef = t`.

### Step 7.4 — Red: regression tests

Per webhook, add tests analogous to P1's:
- "does not record dedup when side-effect insert fails"
- "returns duplicate on repeat event_id"
- "happy path returns processed"

### Step 7.5 — Green: rewrite route handlers

Replace each webhook's multi-write block with a single `supabase.rpc` call, mirroring the Stripe route structure from P1. Use the shared logger from P3 with `[ELEVENLABS_WEBHOOK_*]` / `[TRANSLATE_WEBHOOK_*]` tags.

## Automated Success Criteria

```bash
cd <worktree>
npm install
npm run typecheck
npm run lint
npm run test -- src/app/api/webhooks
npm run test
```

## Manual Success Criteria

1. Local `supabase db reset` applies migration 079 cleanly.
2. Replay an ElevenLabs webhook twice locally (via `curl` with the same signature) — second call returns 200 `duplicate`, no duplicate rows in side-effect tables.
3. Same replay test for translate webhook.

## Rollback

`git revert` the route changes. Migration 079 is forward-only but the RPCs become unused — safe to leave.

## Files Touched

- `supabase/migrations/079_webhook_idempotency_rpcs.sql` (new)
- `src/app/api/webhooks/elevenlabs/route.ts`
- `src/app/api/webhooks/elevenlabs/route.test.ts`
- `src/app/api/webhooks/translate/route.ts`
- `src/app/api/webhooks/translate/route.test.ts`

## Exit Gate

STOP. Confirm merge to `develop` with green CI.
