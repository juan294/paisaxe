# Phase 9 — Reliability Hardening

**Scope:** Two independent reliability items that can batch together.
1. Health endpoint per-probe timeouts (§9#3): prevent `/api/health` from hanging when Supabase or an external service stalls — uptime monitors false-flag today.
2. Fail-stale-translation cron (§9#7): prevent indefinite "translating…" UI states by failing rows whose translation has exceeded a reasonable timeout.

**Addresses:** §9#3, §9#7.

**Batch eligibility:** `[batch-eligible]` — file-disjoint; depends on P6's health probeCache cleanup.

---

## Part A — Health Probe Timeouts

### Current State

`src/app/api/health/route.ts` (~357 LoC). Each probe (Supabase, Anthropic health, Voyage, ElevenLabs, Stripe) runs to completion. No `AbortController` per probe. A single stuck downstream → full request hangs → Vercel function times out at 10s / 25s → uptime monitor alerts.

### Target State

Each probe is wrapped in `Promise.race` with a per-probe timeout (default 2s). On timeout: probe marked `degraded` with `reason: "timeout"`. The overall endpoint always returns within `N × timeout_ms` + a safety margin.

### Implementation

```ts
// Pseudocode — helper
async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        controller.signal.addEventListener("abort", () =>
          reject(new Error(`${label} probe timed out after ${ms}ms`)),
          { once: true },
        ),
      ),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

// Apply per probe
const supabaseResult = await withTimeout(probeSupabase(), 2000, "supabase").catch(err => ({
  status: "degraded", reason: err.message,
}));
```

Timeouts per probe type:
- Supabase: 2000ms
- Anthropic/Voyage/ElevenLabs: 3000ms
- Stripe: 2000ms

Tests: stub a probe to never resolve; assert endpoint returns within timeout + 200ms.

---

## Part B — Fail-Stale-Translation Cron

### Current State

Stories in a "translating" status can remain that way indefinitely if the translation pipeline fails silently. Frontend UI likely shows "translating…" forever.

Audit before implementing:

```bash
grep -rn "translating\|translation_status\|is_translating" src/ supabase/migrations/
ls supabase/migrations/ | grep -i translate
```

Identify:
- The exact table/column that tracks translation status.
- What the timeout SHOULD be (audit existing cron files in `src/app/api/cron/` for style; a 30-minute timeout is a reasonable default).
- Whether a retry vs. fail decision is needed.

### Target State

A cron job (Vercel Cron) runs every 15 minutes. Finds rows with `translation_status = 'translating'` AND `translation_started_at < NOW() - INTERVAL '30 minutes'`. Marks them `translation_status = 'failed'` with `translation_error = 'timeout'`. Logs via structured logger.

### Implementation

`src/app/api/cron/fail-stale-translations/route.ts` (new):

```ts
// Pseudocode
import { verifyCronSecret } from "@/lib/cron-auth";

export async function GET(request: NextRequest) {
  const authCheck = verifyCronSecret(request);
  if (!authCheck.valid) return authCheck.error;

  const supabase = createAdminClient();
  // Advisory lock to avoid overlap (see existing crons for pattern)
  const lockAcquired = await supabase.rpc("try_advisory_lock", { p_key: 9001 });
  if (!lockAcquired) {
    return NextResponse.json({ status: "skipped", reason: "lock_held" });
  }

  try {
    const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from("stories") // or whichever table
      .update({ translation_status: "failed", translation_error: "timeout" })
      .eq("translation_status", "translating")
      .lt("translation_started_at", cutoff)
      .select("id");

    if (error) {
      logger.error("[CRON_FAIL_STALE_TRANSLATIONS]", { error: error.message });
      return NextResponse.json({ error: "Failed" }, { status: 500 });
    }

    logger.info("[CRON_FAIL_STALE_TRANSLATIONS]", { failed_count: data?.length ?? 0 });
    return NextResponse.json({ status: "ok", failed_count: data?.length ?? 0 });
  } finally {
    await supabase.rpc("release_advisory_lock", { p_key: 9001 });
  }
}
```

Register in `vercel.json`:

```json
{
  "crons": [
    { "path": "/api/cron/fail-stale-translations", "schedule": "*/15 * * * *" }
  ]
}
```

Migration `080_fail_stale_translations_support.sql`:
- Ensure `translation_started_at` column exists. If not, add it and backfill current translating rows with `NOW()`.
- Ensure `translation_error` column exists.

### Tests

```ts
// Pseudocode
it("marks rows translating for >30 min as failed", async () => {
  // seed: 1 row translating 45min ago, 1 row translating 5min ago
  await GET(buildCronRequest());
  // assert first row is now 'failed', second unchanged
});
```

---

## Automated Success Criteria

```bash
cd <worktree>
npm install
npm run typecheck
npm run lint
npm run test -- src/app/api/health
npm run test -- src/app/api/cron/fail-stale-translations
npm run test
```

## Manual Success Criteria

1. Simulate a stuck Supabase by blocking network to `*.supabase.co` locally; `curl /api/health` returns within ~2.5s with Supabase marked `degraded`.
2. Insert a test `stories` row with `translation_status='translating'` and `translation_started_at=now() - '1 hour'`; invoke the cron endpoint; row is now `failed`.
3. Run cron twice rapidly; second invocation logs `skipped (lock_held)`.

## Rollback

- Health timeouts: `git revert` the route change; probes go back to uncapped.
- Cron: remove the cron entry from `vercel.json` + revert the route. Migration 080 is additive and safe to leave.

## Files Touched

- `src/app/api/health/route.ts`
- `src/app/api/cron/fail-stale-translations/route.ts` (new)
- `src/app/api/cron/fail-stale-translations/route.test.ts` (new)
- `supabase/migrations/080_fail_stale_translations_support.sql` (new)
- `vercel.json`

## Exit Gate

STOP. Confirm merge to `develop` with green CI.
