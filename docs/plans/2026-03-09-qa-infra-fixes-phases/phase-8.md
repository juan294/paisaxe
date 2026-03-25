# Phase 8: Mock Flag Cleanup + Supabase Realtime Audit `[batch-eligible]`

> **Files**: `e2e/fixtures/mock-data.ts`, Supabase client files
> **Estimated effort**: Small

## Problem

### Mock Feature Flags
`MOCK_FEATURE_FLAGS` in `e2e/fixtures/mock-data.ts` contains 10 agent flags that belong to the local `AgentFlagKey` system (`scripts/agent-config.json`), not the Supabase `feature_flags` table:

Agent flags to remove:
1. `coverage_agent_enabled`
2. `security_agent_enabled`
3. `qa_agent_enabled`
4. `documentation_agent_enabled`
5. `performance_agent_enabled`
6. `localization_agent_enabled`
7. `cost_analyst_agent_enabled`
8. `subscription_optimizer_enabled`
9. `content_discovery_agent_enabled`
10. `automated_agents` (master toggle)

These are harmless but architecturally incorrect — agent flags are read from `scripts/agent-config.json` via shell scripts, not from the feature flags API.

### Supabase Realtime
Performance report suggests tree-shaking Supabase realtime (~20-30 KB savings). Need to audit whether any component uses realtime subscriptions before disabling.

## Changes

### Part 1: Remove agent flags from mock data — `e2e/fixtures/mock-data.ts`

```pseudo
  export const MOCK_FEATURE_FLAGS = {
    // Discovery & ordering
    randomized_order: false,
    seasonal_surfacing: false,
    // ... (keep all 17 FeatureFlagKey entries)

-   // Agent flags (these belong to AgentFlagKey, not FeatureFlagKey)
-   automated_agents: false,
-   coverage_agent_enabled: false,
-   security_agent_enabled: false,
-   qa_agent_enabled: false,
-   documentation_agent_enabled: false,
-   performance_agent_enabled: false,
-   localization_agent_enabled: false,
-   cost_analyst_agent_enabled: false,
-   subscription_optimizer_enabled: false,
-   content_discovery_agent_enabled: false,
  };
```

### Part 2: Supabase Realtime Audit

**Step 1**: Search for realtime usage across the codebase:
```bash
grep -r "\.channel\(" src/ --include="*.ts" --include="*.tsx"
grep -r "\.on\(" src/ --include="*.ts" --include="*.tsx" | grep -i "postgres_changes\|broadcast\|presence"
grep -r "supabase.*subscribe\|supabase.*realtime" src/ --include="*.ts" --include="*.tsx"
```

**Step 2**: If NO realtime usage found → disable realtime in browser client:
```pseudo
// src/lib/supabase-browser.ts
  const client = createBrowserClient(url, key, {
+   realtime: { enabled: false },
  });
```

**Step 3**: If realtime IS used → document the finding and skip this optimization. File a separate issue for future consideration.

**Step 4**: Measure impact — build before and after, compare chunk sizes.

## Verification

```bash
# After removing agent flags — verify E2E tests still pass
npx playwright test --project=desktop

# After Supabase change (if applied) — verify auth flows work
npm run test && npm run typecheck
npx playwright test --grep "sign-in|favorites|auth"
```

## Notes

- Removing agent flags from mocks is safe — no E2E test reads them. The feature flags API route filters by `FeatureFlagKey` type anyway.
- The Supabase realtime audit may conclude "no change needed" — that's a valid outcome.
- If realtime is disabled, existing Supabase functionality (auth, postgrest queries) is completely unaffected.
