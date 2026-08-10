# ADR-0017: Do Not Migrate Client Hooks to SWR/TanStack Query

**Status:** Accepted
**Date:** 2026-05-02
**Deciders:** Juan Gonzalez
**Context:** Issue #495 — FE-M3 from Wave 2 pre-launch audit

## Decision

Do **not** migrate the existing client data-fetching hooks to SWR or TanStack Query at this time.

## Context

The Wave 2 audit (FE-M3) flagged that five hooks hand-roll overlapping fetch/cache patterns and recommended adopting SWR or TanStack Query with a documented decision.

Hooks evaluated:

| Hook | Pattern | Complexity |
|------|---------|------------|
| `src/hooks/use-stories.ts` | SWR-like with localStorage persistence + SSR seed | High |
| `src/hooks/use-feature-flags.ts` | TTL cache + server-seed dedup + E2E stub bypass | High |
| `src/components/admin/analytics-cache-context.tsx` | Map-based cache, per-tab stale times | Medium |
| `src/hooks/use-voice-access.ts` | Auth-gated fetch, no shared cache needed | Low |

## Evaluation

**SWR**
- Bundle cost: ~25 KB gzipped
- Handles: dedup, stale-while-revalidate, focus revalidation
- Does NOT handle: localStorage persistence (requires plugin), server-seed pattern for Next.js App Router, per-instance custom TTLs
- `use-stories` requires localStorage for offline resilience — SWR has no built-in equivalent

**TanStack Query**
- Bundle cost: ~50 KB gzipped
- Handles: all SWR features plus devtools, mutations, infinite queries
- Does NOT handle: localStorage persistence natively, requires QueryClient wrapper in root layout
- Overkill for the current read-only fetch patterns

**Key finding:** The `use-stories` and `use-feature-flags` hooks are tightly integrated with Next.js App Router's server-component → client-component data handoff pattern. The `initialFlags`/`initialStories` server-seed optimization avoids a client-side flash on first paint; replicating this in SWR or TanStack Query requires non-trivial configuration and carries regression risk.

## Consequences

- No new dependency added; bundle size unchanged
- No regression risk in SSR hydration patterns
- The TTL inconsistency noted in FE-M3 is intentional: `use-stories` (5 min) vs `use-feature-flags` (60 s) reflect different data volatility
- Revisit if Next.js App Router ships a first-class data-fetching primitive that integrates cleanly with Server Components and SWR/TanStack Query simultaneously
