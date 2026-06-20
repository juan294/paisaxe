# ADR-0020: Client State Management — Keep Custom Hooks, Add a Shared Cache Factory

**Status:** Accepted
**Date:** 2026-06-20
**Deciders:** Juan Gonzalez
**Context:** Issue #533 — FE-S1 from Wave 3 pre-launch audit
**Supersedes scope of:** ADR-0017 (which declined SWR for the Wave 2 FE-M3 finding)

## Decision

1. **Keep the current custom hooks** for client/server state. Do **not** adopt
   SWR or TanStack Query.
2. **Standardize the duplicated fetch/cache/dedup logic** behind a single
   internal `createCachedResource` factory so new hooks stop hand-rolling the
   same singleton-cache + in-flight-promise + TTL pattern.
3. **No dedicated client-state library** (Zustand/Jotai) — current client-only
   state is local and does not justify a store.

ADR-0017 answered the narrow Wave 2 question ("migrate these specific hooks to
SWR?") with "no." This ADR answers the broader Wave 3 strategic question
("what is our state-management approach going forward?") and makes the custom-
hook approach a deliberate, documented standard rather than an accumulation of
copies.

## Context

Three hooks/contexts hand-roll overlapping server-state caching:

| Module | Pattern | Cache TTL |
|--------|---------|-----------|
| `src/hooks/use-stories.ts` | Singleton in-memory cache + in-flight promise dedup + localStorage persistence (`paisaxe-stories-cache`, versioned) + SSR seed | 5 min |
| `src/hooks/use-feature-flags.ts` | Singleton cache + in-flight promise dedup + server-seed dedup + E2E stub bypass | 60 s |
| `src/components/admin/analytics-cache-context.tsx` | `Map`-keyed cache + in-flight `Map` + per-query stale time, via React context | 2 min |

All three independently reimplement: a module-level cache object, an in-flight
promise to dedupe concurrent callers, a timestamp/TTL freshness check, and a
"seed from server component props on first render" path. This is the real
finding in FE-S1 — not that the *technology* is wrong, but that the *pattern is
copy-pasted*.

## Evaluation

### Why not SWR / TanStack Query

The ADR-0017 analysis still holds and is the deciding factor:

- **`use-stories` needs versioned localStorage persistence** for offline
  resilience. SWR requires a plugin; TanStack Query requires a persister + a
  `QueryClient` provider in the root layout. Both are extra surface for one hook.
- **Next.js App Router server-seed handoff** (`initialStories`, `initialFlags`)
  avoids a first-paint flash. Replicating this cleanly in either library is
  non-trivial and carries hydration-regression risk on a live site.
- **Bundle cost**: SWR ~25 KB, TanStack Query ~50 KB gzipped — against a
  Lighthouse perf budget of >=70% (CLAUDE.md guardrail #3). The custom hooks
  add ~0 KB beyond React.
- The read patterns are simple cached GETs. There are no mutations, optimistic
  updates, or infinite queries that would actually exercise a query library's
  strengths.

### Why a shared factory instead of leaving copies

The duplication is the maintainable risk: a bug fix to the dedup or TTL logic
must currently be applied in three places. A single `createCachedResource`
factory consolidates:

```ts
// src/hooks/create-cached-resource.ts (proposed)
interface CachedResourceOptions<T> {
  ttlMs: number;
  fetcher: () => Promise<T>;
  persist?: { key: string; version: number };   // opt-in localStorage
  seed?: T;                                       // server-component seed
}

// Returns a hook that owns the singleton cache + in-flight dedup + TTL,
// and (optionally) localStorage persistence and an SSR seed.
function createCachedResource<T>(opts: CachedResourceOptions<T>): () => {
  data: T | null;
  isReady: boolean;
  refresh: () => Promise<void>;
};
```

`use-stories`, `use-feature-flags`, and any future read hook become thin wrappers
that supply a `fetcher`, `ttlMs`, and optional `persist`/`seed`. The
analytics context stays as-is (its per-query `Map` keying is a genuinely
different shape) or is migrated opportunistically.

### Why no Zustand/Jotai

Client-only state in the app is local component state (forms, toggles, modal
open/close). There is no cross-tree client store that React context +
`useState` does not already cover. Adding a store would be speculative.

## Migration Strategy (incremental, no big-bang)

1. Land `createCachedResource` with full test coverage (TDD).
2. Refactor `use-feature-flags` onto it first (simplest: TTL + seed, no persist).
3. Refactor `use-stories` onto it (adds the `persist` path).
4. Leave `analytics-cache-context` until a third query consumer appears.

Each step is independently shippable and behavior-preserving — no user-facing
change, covered by the existing hook tests.

## Consequences

- No new dependency; bundle size unchanged; perf budget unaffected.
- Single source of truth for cache/dedup/TTL logic — fixes apply once.
- SSR server-seed and localStorage-persistence patterns are preserved.
- Revisit only if the app gains genuine mutation-heavy or real-time
  collaborative state, OR Next.js ships a first-class data primitive that
  integrates cleanly with Server Components (the ADR-0017 trigger).
