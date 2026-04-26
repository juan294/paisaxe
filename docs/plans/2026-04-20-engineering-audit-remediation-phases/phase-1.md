# Phase 1 — Stripe Webhook Atomicity + Unrecoverable Response Codes

**Scope:** Close the Ship Blocker (§3.1): dedup row writes before voice_purchases, leaving "paid but no access" state on any transient failure. Also fix the §4 unrecoverable-event handling: `missing user_id` returns 400 which Stripe treats as retry-triggering.

**Addresses:** §3.1 (Critical), §4 bullet "stripe-webhook returns 500 on missing user_id".

**Batch eligibility:** No — ship blocker, merges to `develop` before Wave 2 starts.

---

## Current State (verified 2026-04-20)

`src/app/api/webhooks/stripe/route.ts`:
- L62-65 — missing `user_id` → `return NextResponse.json({ error: "Missing user_id" }, { status: 400 })`. Stripe retries on all non-2xx, so this event retries forever with no hope of success.
- L78-80 — `supabase.from("stripe_webhook_events").insert({ event_id: event.id })` commits the dedup row first.
- L84-89 — `23505` unique-violation branch returns 200 `duplicate` (correct for concurrent duplicates).
- L91 — non-23505 dedup error → 500.
- L98-105 — `supabase.from("voice_purchases").insert({ user_id, payment_provider_id, ... })`.
- L109 — purchase insert error → 500. **Combined with the dedup row already committed, this is the defect.**
- No `supabase.rpc` usage anywhere in the file.

`src/app/api/webhooks/stripe/route.test.ts` (493 LoC):
- `vi.mock("@/lib/supabase", ...)` top-level with `from/insert/select/eq/maybeSingle` chain.
- Per-test overrides via `mockFrom = vi.fn((table) => ...)` switching on table name.
- L395-435 — existing test: dedup conflict → purchase NOT called. Converse direction (purchase fail → dedup NOT written) does not exist.
- L319-352 — "500 on database error" exists but only asserts status, not rollback.

Migration 077 (verified post-review in audit §0): `stripe_webhook_events (id, event_id UNIQUE, created_at)`. No grants, no RLS.

SECURITY DEFINER template: `supabase/migrations/018_user_profiles_rbac.sql:35-40`.

## Target State

Single Postgres function `grant_day_pass_idempotent(event_id, user_id, payment_provider_id, expires_at, amount_paid)` that:
1. `INSERT INTO stripe_webhook_events (event_id) ON CONFLICT DO NOTHING RETURNING id;`
2. If no row returned → event already processed → no-op success (return `{ status: 'duplicate' }`).
3. Else `INSERT INTO voice_purchases (...)` in the same transaction.
4. Both commit together or neither does.
5. `SECURITY DEFINER`, `SET search_path = ''`, fully qualified `public.stripe_webhook_events` / `public.voice_purchases`.
6. Granted `EXECUTE` to `service_role`.

Route rewrites to call the RPC once; maps `{ status }` to the HTTP response. `missing user_id` and `missing payment_intent` both return 200 (events are unrecoverable) with a distinct `[STRIPE_UNRECOVERABLE]` log at ERROR level for alerting.

## Implementation Steps

### Step 1.1 — Write the migration (Red: schema test first)

`supabase/migrations/078_grant_day_pass_idempotent.sql`:

```sql
-- Pseudocode structure
CREATE OR REPLACE FUNCTION public.grant_day_pass_idempotent(
  p_event_id TEXT,
  p_user_id UUID,
  p_payment_provider_id TEXT,
  p_expires_at TIMESTAMPTZ,
  p_amount_paid INTEGER
) RETURNS TEXT  -- 'granted' | 'duplicate'
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_inserted UUID;
BEGIN
  INSERT INTO public.stripe_webhook_events (event_id)
    VALUES (p_event_id)
    ON CONFLICT (event_id) DO NOTHING
    RETURNING id INTO v_inserted;

  IF v_inserted IS NULL THEN
    RETURN 'duplicate';
  END IF;

  INSERT INTO public.voice_purchases (
    user_id, payment_provider_id, expires_at, amount_paid,
    provider, status, created_at
  ) VALUES (
    p_user_id, p_payment_provider_id, p_expires_at, p_amount_paid,
    'stripe', 'active', NOW()
  );

  RETURN 'granted';
END;
$$;

REVOKE ALL ON FUNCTION public.grant_day_pass_idempotent(TEXT, UUID, TEXT, TIMESTAMPTZ, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grant_day_pass_idempotent(TEXT, UUID, TEXT, TIMESTAMPTZ, INTEGER) TO service_role;
```

Verify the exact `voice_purchases` column names + types against the current schema before finalizing. Check migrations 049 onward for the canonical definition.

### Step 1.2 — Local migration verification

Per `.claude/rules/supabase.md`:

```bash
supabase start
supabase db reset
docker exec supabase_db_paisaxe psql -U postgres -c \
  "SELECT proname, prosecdef FROM pg_proc WHERE proname = 'grant_day_pass_idempotent';"
# Expect: grant_day_pass_idempotent | t
```

### Step 1.3 — Red: add regression test

Add to `stripe/route.test.ts`:

```ts
// Pseudocode
it("does not record dedup when voice_purchases insert fails", async () => {
  mockRpc.mockResolvedValueOnce({ data: null, error: { message: "boom" } });
  const response = await POST(request);
  expect(response.status).toBe(500);
  // Stripe will retry; on retry, the RPC is called again and should succeed
  mockRpc.mockResolvedValueOnce({ data: "granted", error: null });
  const retry = await POST(sameRequest);
  expect(retry.status).toBe(200);
  expect(await retry.json()).toMatchObject({ status: "granted" });
});

it("returns 200 (unrecoverable) when user_id is missing", async () => {
  const response = await POST(requestWithoutUserId);
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ status: "unrecoverable" });
});
```

### Step 1.4 — Green: rewrite route handler

`src/app/api/webhooks/stripe/route.ts`:

```ts
// Pseudocode — replaces L62–L110
if (!userId) {
  logger.error("[STRIPE_UNRECOVERABLE]", { eventId: event.id, reason: "missing_user_id" });
  return NextResponse.json({ status: "unrecoverable", reason: "missing_user_id" }, { status: 200 });
}
if (!paymentIntentId) {
  logger.error("[STRIPE_UNRECOVERABLE]", { eventId: event.id, reason: "missing_payment_intent" });
  return NextResponse.json({ status: "unrecoverable", reason: "missing_payment_intent" }, { status: 200 });
}

const { data, error } = await supabase.rpc("grant_day_pass_idempotent", {
  p_event_id: event.id,
  p_user_id: userId,
  p_payment_provider_id: paymentIntentId,
  p_expires_at: calculateExpiryDate(),
  p_amount_paid: amountTotal,
});

if (error) {
  logger.error("[STRIPE_RPC_FAILURE]", { eventId: event.id, error: error.message });
  return NextResponse.json({ error: "Database error" }, { status: 500 });
}

return NextResponse.json({ status: data }, { status: 200 });
```

Note: this uses the shared logger (migrated as part of Phase 3's top-callsite list; Phase 1 simply writes through `logger` from the start rather than `console.error`).

### Step 1.5 — Update test mocks

Replace the table-switching `mockFrom` pattern with `mockRpc`. Preserve existing tests that check signature verification, missing fields, and the now-removed dedup flow (delete obsolete dedup-conflict tests since the RPC encapsulates them — replace with "RPC returns 'duplicate' → route returns 200").

## Automated Success Criteria

```bash
cd <worktree>
npm install
npm run typecheck
npm run lint
npm run test -- src/app/api/webhooks/stripe
npm run test
```

Plus local migration verification (Step 1.2 docker query).

## Manual Success Criteria

1. `supabase db reset` runs cleanly on a fresh local DB.
2. Regression test from Step 1.3 is present and passing.
3. Stripe test-mode one-time replay against local dev (optional sanity check — trigger a `checkout.session.completed` webhook twice via `stripe listen`/`stripe trigger`; confirm second call returns 200 `duplicate`).

## Rollback

`git revert` the merge. Migration 078 is additive — leave it in place (the function is unused after revert but causes no harm).

## Files Touched

- `supabase/migrations/078_grant_day_pass_idempotent.sql` (new)
- `src/app/api/webhooks/stripe/route.ts` (modified)
- `src/app/api/webhooks/stripe/route.test.ts` (modified)

## Exit Gate

STOP after this phase. Human confirms P1 merged to `develop` with green CI before Wave 2 begins.
