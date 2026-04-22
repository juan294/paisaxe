# Phase 10 — Final Hygiene + Deep Integration Tests

**Scope:** Tail hygiene items from the second-stage proposal: upgrade `lucide-react` (§9#5), verify Vercel region matches Supabase region (§9#9), replace the mocked Stripe E2E test with a real Stripe-test-mode end-to-end flow (§9#10).

**Addresses:** §9#5, §9#9, §9#10.

**Batch eligibility:** No — this phase consolidates items that each affect shared surfaces (package.json, vercel.json, e2e infrastructure) and sensibly land as a single review.

---

## Part A — lucide-react Upgrade

### Audit first

```bash
npm view lucide-react version
grep '"lucide-react"' package.json
```

Audit says "`^1.8.0` (verify — may be correct current major)". Lucide has been on 0.x for a long time; if the version is `0.x`, check whether a newer minor is available and whether there are breaking icon renames.

### Implementation

```bash
npx npm-check-updates -u lucide-react
npm install
npm run typecheck  # surfaces renamed icon imports
```

For every typecheck error from renamed icons, update the import. Run visual regression E2E to catch rendering drift:

```bash
npm run test:e2e -- visual-regression
```

If renames are extensive, consider splitting this into its own small PR for easier review.

---

## Part B — Vercel Region vs. Supabase Region

### Audit

```bash
cat vercel.json | jq '.regions'
# Expected: ["cdg1"] per audit
```

Check Supabase project region:

```bash
supabase projects list
# or via dashboard — note the region
```

### Action

If mismatched (e.g., Vercel `cdg1` = Paris, Supabase in a US region), the round-trip latency is invisible in local profiling. Two options:

- **Option 1 (preferred):** Move Vercel to the Supabase region by updating `vercel.json`:
  ```json
  { "regions": ["<supabase-region-code>"] }
  ```
- **Option 2:** Move Supabase to the Vercel region (requires project migration — Supabase supports region transfer via support; much larger undertaking).

If regions already match, document the verification in `docs/operations/operations.md` with the date.

### Pre-deploy check

Before merging, measure a representative DB call latency with preview deployments in both configurations to confirm the delta. **User action:** deploy preview with the new region, measure, then decide before merging to `develop`.

---

## Part C — Real Stripe E2E

### Current State

Audit identified `e2e/checkout.spec.ts` as a smoke test mocking `/api/voice-access`. The entire payments flow has zero true integration coverage.

### Target State

A new Playwright spec `e2e/stripe-real-checkout.spec.ts` that:
1. Uses Stripe test-mode keys (from a dedicated `STRIPE_TEST_SECRET_KEY` env var, not prod keys).
2. Spawns `stripe listen` locally (or uses `stripe trigger`) to forward webhooks to the local dev server.
3. Drives the UI through a real checkout session with `4242 4242 4242 4242`.
4. Waits for the `voice_purchases` row to appear in the local DB.
5. Asserts `/immersive` shows unlocked state after purchase.

### Implementation

```ts
// Pseudocode
import { test, expect } from "@playwright/test";
import Stripe from "stripe";

test("real Stripe checkout grants access end-to-end", async ({ page, context }) => {
  test.skip(!process.env.STRIPE_TEST_SECRET_KEY, "requires Stripe test key");

  const stripe = new Stripe(process.env.STRIPE_TEST_SECRET_KEY, { apiVersion: "2024-..." });

  // Sign in as a test user
  await signInAsTestUser(page);

  // Start checkout
  await page.goto("/immersive");
  await page.click("[data-test=buy-day-pass]");

  // Redirect to Stripe Checkout — fill test card
  await page.waitForURL(/checkout\.stripe\.com/);
  await page.fill("input[name=cardnumber]", "4242424242424242");
  await page.fill("input[name=exp-date]", "12/34");
  await page.fill("input[name=cvc]", "123");
  await page.fill("input[name=postal]", "28001");
  await page.click("button[type=submit]");

  // Back to our site — voice_purchases should be present
  await page.waitForURL(/immersive/);
  // Poll DB or /api/voice-access to confirm
  await expect.poll(async () => {
    const res = await page.request.get("/api/voice-access");
    return (await res.json()).active;
  }, { timeout: 15_000 }).toBe(true);
});
```

Webhook forwarding: run `stripe listen --forward-to http://localhost:3000/api/webhooks/stripe` as a test fixture or precondition. Consider a `global-setup.ts` Playwright hook.

Add this spec to a **separate CI job** (not default `npm run test:e2e`) that runs only when `STRIPE_TEST_SECRET_KEY` is present — keeps local dev fast and avoids CI credential pressure. Schedule: nightly or pre-release.

```yaml
# .github/workflows/e2e-stripe-integration.yml (new)
on:
  workflow_dispatch:
  schedule: [ { cron: '0 3 * * *' } ]  # nightly
jobs:
  e2e-stripe:
    runs-on: ubuntu-latest
    env:
      STRIPE_TEST_SECRET_KEY: ${{ secrets.STRIPE_TEST_SECRET_KEY }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npx playwright install chromium
      - run: npm run test:e2e -- stripe-real-checkout
```

---

## Automated Success Criteria

```bash
cd <worktree>
npm install
npm run typecheck
npm run lint
npm run test
npm run test:e2e          # baseline suite stays green
# real Stripe E2E (only if STRIPE_TEST_SECRET_KEY is set locally):
STRIPE_TEST_SECRET_KEY=... npm run test:e2e -- stripe-real-checkout
```

## Manual Success Criteria

1. **lucide-react:** Visual regression E2E passes; spot-check each admin page's icons look unchanged.
2. **Vercel region:** `vercel.json` either already matches Supabase or is updated; preview-deployment latency measurement recorded in `docs/operations/operations.md`.
3. **Stripe E2E:** Runs locally against a Stripe test account; asserts the full grant flow end-to-end.
4. Nightly CI job for the Stripe E2E is registered and green.

## Rollback

- lucide-react: `npm install lucide-react@<previous-version>` + revert icon-rename edits.
- Vercel region: revert `vercel.json`; redeploy.
- Stripe E2E: revert the spec + workflow files.

## Files Touched

- `package.json`, `package-lock.json` (lucide-react)
- `vercel.json` (region, if changed)
- `e2e/stripe-real-checkout.spec.ts` (new)
- `e2e/global-setup.ts` (likely new — Stripe webhook listen setup)
- `.github/workflows/e2e-stripe-integration.yml` (new)
- `docs/operations/operations.md` (region verification note)

## Exit Gate

STOP. Confirm merge to `develop` with green CI. Plan complete after this phase.
