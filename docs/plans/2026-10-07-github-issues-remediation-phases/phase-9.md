# Phase 9: Client cache consolidation

Parent: [backlog plan](../2026-10-07-github-issues-remediation.md). Owned issues: #766. Baseline: develop `fe1843713a49277bc66460e4ae7470025d01e1c6`; revalidate at entry. Status: planned, not implemented. Apply the parent's local-only authority, TDD/review/simplify loop, sequential verification, coverage ratchets and acceptance boundary in full.

## Scope and source evidence

The owner selected incremental TanStack Query adoption preserving shared state and persistence. Sources: `src/hooks/use-stories.ts:37`, `src/hooks/use-stories.ts:149`, `src/hooks/use-feature-flags.ts:22`, `src/hooks/use-feature-flags.ts:80`, `src/components/admin/analytics-cache-context.tsx:106`, `src/components/admin/analytics-cache-context.tsx:118`, `src/hooks/use-favorites.ts:8`, `src/hooks/use-favorites.ts:95`, `src/hooks/use-favorites.ts:137`, `src/hooks/use-voice-access.ts:43`.

## Design and ownership

Accepted choice: one TanStack Query client behind stable hook APIs, with domain/version/identity query keys and explicit persistence adapters. The internal-layer and bug-only alternatives were declined; do not implement parallel cache engines.

One cache owner freezes contracts/provider wiring, then migrates serially: analytics, public stories/flags, authenticated favorites/voice. Preserve server seeds, public TTL/persistence, cross-component sharing and provider identity. Private entries are keyed to authenticated user, cleared/partitioned on logout/account switch, and never served from anonymous/public persistence. Legacy unscoped favorites entry is removed/migrated only with verified ownership, never displayed to a different user. Abort/ignore replaced key/user responses. Each optimistic mutation rolls back only its own change, preserving later successful optimistic work. Entitlement events/refetch invalidate access without stale session issuance.

Do not mutate singleton caches during render. Both concurrent analytics consumers subscribe to the same in-flight result; failures clear in-flight and retain permitted stale data with visible retry. Focus revalidation must not move focus or reset editing inputs. No parallel cache domains until the shared client/keys are proven and file ownership is disjoint; default execution is serial.

```text
@ queryAdapter(key, identity, seed) -> subscribedState
ctx: shared query engine and versioned persistence
pre: public/private scope explicit; stable provider
do:
  1. lookup valid seed or scoped cache
  2. subscribe every consumer to shared in-flight work
  3. write result only for still-current identity and key
  4. emit stale/error state with retry after rejection
br: logout -> clear private scope; late old response -> ignore
fail: corrupt persistence -> discard entry and refetch
```

## Automated criteria

Use real hook/client integration with fake network only: two simultaneous consumers update, failed fetch retries, cached story renders immediately, stale failure disclosed, focus refresh preserves input, two concurrent optimistic mutations roll back independently, corrupt storage recovers, old-user response cannot populate new user, logout purges private values, new user sees no prior favorites/pass, expiry/refund refreshes entitlement. Preserve Phase 4 real-auth paid seam and Phase 7 route transitions. All five domains and matching fixtures migrate before #766 completion.

## Manual and external criteria

None for deterministic local acceptance. Dependency selection requires checking current official documentation and license/lockfile at implementation; no speculative version is pinned by this plan. Production cache/identity behavior needs authorized release/read-back.

## Stuck states and recovery

Stale data visibly remains with retry where safe; private identity changes clear prior data immediately. Failed in-flight entry is not permanent, corrupt persistence refetches, mutation error shows scoped rollback/retry. Tests prove corrected request and account-switch isolation; do not let a rejected promise freeze all future followers.

## Phase acceptance and handoff

Run the parent's applicable sequential integration gates plus the automated criteria above on the integrated candidate. Record exact identity, commands, pass/fail/skip counts, review/simplify findings and fixes, and each issue's local/runtime disposition. Manual or provider evidence is separate; missing evidence leaves the issue open. Stop after acceptance, preserving the plan and implementation receipts; proceed only with authorized continuation. Consumer ownership and command inventory are in [consumer sweep](consumer-sweep.md).
