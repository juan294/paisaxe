# ADR-0018: Edge Runtime Not Feasible for Chat Stream Endpoint

**Status:** Accepted
**Date:** 2026-05-02
**Deciders:** Juan Gonzalez
**Context:** Issue #513 — PE-M1 from Wave 2 pre-launch audit

## Decision

Do **not** adopt the Edge runtime for `src/app/api/chat/stream/route.ts` at this time.

## Context

The Wave 2 audit (PE-M1) flagged that the SSE streaming chat endpoint runs on the Node.js lambda runtime and suggested evaluating Edge runtime to reduce cold-start latency.

## Evaluation

Hard blockers found during evaluation:

1. **`node:child_process` in `src/lib/claude.ts:103,281`** — The route dynamically imports `@/lib/claude`. Edge runtime builds are statically analyzed; any `node:child_process` reference in the module graph causes a build failure regardless of whether that code path executes at runtime.

2. **`pino` logger** — `src/lib/logger.ts` imports `pino`, which relies on Node.js streams internally. Edge-compatible logging would require a separate logger.

3. **`node:async_hooks` in `src/lib/request-context.ts`** — The module gracefully handles Edge (`typeof EdgeRuntime !== 'undefined'` guard), so this is not a hard blocker, but it does mean request correlation IDs would not propagate in Edge.

The deferred-import pattern in `route.ts` (importing heavy deps after validation) is a Node.js cold-start optimization. It does not help with Edge compatibility because Edge bundles are compiled statically at build time.

## Path to Edge (for future reference)

To make the chat endpoint Edge-compatible would require:

1. Extract `node:child_process` code from `claude.ts` into a separate Node-only module (see ADR-0016 for the planned claude.ts modularization)
2. Replace `pino` with an Edge-compatible structured logger (e.g., a thin `console.log` wrapper)
3. Accept loss of `x-request-id` propagation, or implement via Edge-compatible storage (e.g., `AsyncContext` if/when available in Edge)

Track ADR-0016 (`0016-claude-module-refactor.md`) — once `claude.ts` is modularized, the blocking issue is resolved.

## Consequences

- No bundle change; chat endpoint remains on Node.js lambda
- Cold-start cost remains; mitigated by existing deferred-import optimization (PE-H3/PE-H4 in place)
- Revisit after ADR-0016 is implemented
