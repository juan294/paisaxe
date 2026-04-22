# Phase 6 — Quick Wins Bundle

**Scope:** Small, independent fixes that collectively have high hygiene value. Each is minutes of work; the bundle is a single phase for review-cost efficiency.

**Addresses:**
- §4 auth callback silent error
- §4 rerank `<= topK` early return
- §4 health `probeCache` stale purge
- §5 feature flag caching verification
- §7 replace two `waitForTimeout` calls
- §7 CI `concurrency: cancel-in-progress`

**Batch eligibility:** `[batch-eligible]` — depends only on P1.

---

## Current State (verified 2026-04-20)

- `src/app/auth/callback/route.ts:42-47` — `const { error } = await supabase.auth.exchangeCodeForSession(code);` — on error, falls through silently to generic `/immersive` redirect at L50. No logging, no user feedback.
- `src/lib/rerank.ts:23-25` — `if (chunks.length === 0) return [];` — does not short-circuit when `chunks.length <= topK`; wastes ~300ms + Voyage tokens.
- `src/app/api/health/route.ts` — `probeCache: Map` module-scoped, stale entries purged only on cache read.
- `src/lib/feature-flags-server.ts` — audit the TTL/caching behavior of `isFeatureFlagEnabled`.
- `e2e/visual-regression.spec.ts` — `waitForTimeout(300)`.
- `e2e/author-pill.spec.ts` — `waitForTimeout(600)`.
- `.github/workflows/` — 10 workflow files; none have `concurrency:` key.

## Implementation Steps

### Step 6.1 — Auth callback error logging

`src/app/auth/callback/route.ts`:

```ts
// Pseudocode
const { error } = await supabase.auth.exchangeCodeForSession(code);
if (error) {
  logger.error("[AUTH_CALLBACK_FAILURE]", { error: error.message, code_present: !!code });
  const url = new URL("/login", origin);
  url.searchParams.set("error", "session_exchange_failed");
  return NextResponse.redirect(url);
}
return NextResponse.redirect(`${origin}/immersive`);
```

Add a unit test asserting the `/login?error=session_exchange_failed` redirect on error and normal redirect on success.

### Step 6.2 — Rerank `<= topK` early return

`src/lib/rerank.ts:23-25`:

```ts
// Before
if (chunks.length === 0) {
  return [];
}

// After
if (chunks.length <= topK) {
  return chunks;  // Already ≤ topK; rerank ordering has no effect.
}
```

Add a unit test: `rerank` called with 2 chunks and `topK = 3` returns the 2 chunks unchanged and does not invoke the Voyage client.

### Step 6.3 — Health probeCache TTL purge

`src/app/api/health/route.ts` — add a periodic purge that runs on write (not only on read):

```ts
// Pseudocode
function setProbeCache(key: string, value: ProbeResult) {
  probeCache.set(key, { value, expiresAt: Date.now() + TTL_MS });
  // Purge expired entries on every write
  const now = Date.now();
  for (const [k, v] of probeCache) {
    if (v.expiresAt < now) probeCache.delete(k);
  }
}
```

Lightweight; bounds memory growth in long-lived serverless containers.

### Step 6.4 — Feature flag caching verification

Read `src/lib/feature-flags-server.ts` and confirm whether `isFeatureFlagEnabled` caches results in-process. If no cache exists (each call re-reads the DB), add a simple TTL cache (30-60s):

```ts
// Pseudocode
const flagCache = new Map<string, { value: boolean; expiresAt: number }>();

export async function isFeatureFlagEnabled(flag: string): Promise<boolean> {
  const cached = flagCache.get(flag);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const { data } = await supabase.from("feature_flags").select("enabled").eq("key", flag).maybeSingle();
  const value = data?.enabled ?? false;
  flagCache.set(flag, { value, expiresAt: Date.now() + 30_000 });
  return value;
}
```

If caching already exists, document the TTL in a comment and move on.

### Step 6.5 — Replace `waitForTimeout` in E2E

`e2e/visual-regression.spec.ts`:

```ts
// Before
await page.waitForTimeout(300);
// After — wait for the specific condition that the 300ms was masking
await page.waitForFunction(() => document.fonts.ready);
// or
await page.waitForSelector("[data-test=chart-rendered]");
```

Same for `e2e/author-pill.spec.ts` `waitForTimeout(600)` — identify what the 600ms was hiding (animation? data fetch?) and wait for the explicit condition.

### Step 6.6 — CI `concurrency: cancel-in-progress`

Append to every workflow file under `.github/workflows/`:

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

Workflows to update:
- `ci.yml`
- `e2e.yml`
- `lighthouse.yml`
- `bundle-size.yml`
- `knip.yml`
- `license-check.yml`
- `preview-smoke.yml`
- `security.yml`
- `update-visual-baselines.yml`
- `claude-review.yml`

For `update-visual-baselines.yml` (likely a manual dispatch), omit or use `cancel-in-progress: false` — cancelling baseline updates mid-flight can corrupt snapshots.

## Automated Success Criteria

```bash
cd <worktree>
npm install
npm run typecheck
npm run lint
npm run test -- src/app/auth
npm run test -- src/lib/rerank
npm run test -- src/app/api/health
npm run test -- src/lib/feature-flags-server
npm run test
npm run test:e2e
```

YAML validation:

```bash
for f in .github/workflows/*.yml; do
  grep -q "^concurrency:" "$f" && echo "$f: ok" || echo "$f: MISSING concurrency"
done
```

## Manual Success Criteria

1. Force an auth callback failure locally (e.g., invalid code); verify redirect lands on `/login?error=session_exchange_failed` and log contains `[AUTH_CALLBACK_FAILURE]`.
2. Run a chat query that returns ≤3 chunks; confirm Voyage rerank is NOT called (log absence or network tab).
3. Push two commits back-to-back to `develop`; CI cancels the earlier run.

## Rollback

Per-file `git revert` is safe; none of these changes couple.

## Files Touched

- `src/app/auth/callback/route.ts`
- `src/app/auth/callback/route.test.ts` (may exist; update or create)
- `src/lib/rerank.ts`
- `src/lib/rerank.test.ts`
- `src/app/api/health/route.ts`
- `src/lib/feature-flags-server.ts`
- `e2e/visual-regression.spec.ts`
- `e2e/author-pill.spec.ts`
- `.github/workflows/ci.yml`, `e2e.yml`, `lighthouse.yml`, `bundle-size.yml`, `knip.yml`, `license-check.yml`, `preview-smoke.yml`, `security.yml`, `claude-review.yml`

## Exit Gate

STOP. Confirm merge to `develop` with green CI.
