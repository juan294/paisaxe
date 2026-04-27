# ADR-0015: Service Layer Architecture

**Status:** Proposed
**Date:** 2026-04-26
**Deciders:** Juan Gonzalez
**Finding ID:** BE-S1

---

## Context

Every API route handler in `src/app/api/` currently owns the full request lifecycle: input validation, admin auth checks, business logic, database queries, and external API calls. This makes individual route files difficult to unit-test in isolation (auth and DB are tightly coupled to the HTTP layer) and creates duplication when multiple routes need the same business logic.

Examples of the current pattern:

- `src/app/api/admin/agent-reports/route.ts` — auth check + filesystem read inline
- `src/app/api/chat/route.ts` — auth, rate limiting, vector search, Claude streaming, all in one handler
- `src/app/api/admin/stories/route.ts` — auth + Supabase CRUD inline

As the application grows post-launch, this pattern becomes a maintenance burden.

---

## Decision

Extract a **service layer** at `src/services/` post-launch. Each service encapsulates the business logic for one domain, with no HTTP concerns:

```
src/services/
  agent-reports.service.ts    # Report file stat / future Supabase Storage reads
  chat.service.ts             # RAG pipeline: search → rerank → Claude
  stories.service.ts          # Story CRUD, status transitions, translation checks
  feature-flags.service.ts    # Flag reads and writes
```

Route handlers become thin adapters:

```typescript
// Before (all mixed together)
export async function GET(req: Request) {
  const auth = await validateAdminAuth();
  if (!auth.valid) return auth.error;
  const stories = await supabase.from("stories").select("*");
  // ... 50 more lines
}

// After (thin handler)
export async function GET(req: Request) {
  const auth = await validateAdminAuth();
  if (!auth.valid) return auth.error;
  return NextResponse.json(await storiesService.listAll());
}
```

Services are plain async functions/classes with no Next.js imports. They can be unit-tested without mocking the HTTP layer.

---

## Alternatives Considered

1. **Keep the current pattern** — Acceptable short-term, but each route file will continue to grow.
2. **Repository pattern** — Adds another abstraction layer (repo → service → route). Overkill for a solo project at this scale.
3. **tRPC** — Type-safe RPC is appealing but requires a larger migration and is incompatible with streaming responses.

---

## Consequences

- **Positive:** Business logic becomes independently testable; duplication decreases; route files stay under 100 LOC.
- **Positive:** A service can swap its backing store (e.g., agent-reports moving from filesystem to Supabase Storage) without touching route files.
- **Negative:** Migration cost — existing routes must be refactored incrementally.
- **Neutral:** `src/services/.gitkeep` is added now as a placeholder; no functional code changes yet.

---

## Implementation Plan

This is post-launch work. Implement one service at a time, starting with the highest-traffic routes:

1. `chat.service.ts` — highest complexity, highest test value
2. `stories.service.ts` — most routes share story logic
3. Remaining services as capacity allows

Each migration: write service unit tests → extract logic → update route → verify existing route tests still pass.
