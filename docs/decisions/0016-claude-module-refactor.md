# ADR-0016: Planned Modularization of claude.ts

**Status:** Proposed
**Date:** 2026-04-26
**Deciders:** Juan Gonzalez
**Finding ID:** AR-S1

---

## Context

`src/lib/claude.ts` (532 lines) contains three distinct concerns:

1. **Streaming transport layer** (lines 1–224) — `streamAnthropicAPI`, `streamWithSDK`, `streamWithCurl`
2. **Non-streaming transport layer** (lines 226–384) — `callAnthropicAPI`, `callWithSDK`, `callWithCurl`
3. **Domain logic** (lines 386–532) — `generateChatResponse`, `streamChatResponse`, `sanitizeOutput`, `extractSourcesFromChunks`, prompt builders

Both transport layers share `AnthropicMessage`, `StreamOptions`, `USE_CURL`, and `createAbortError`, making a naïve split into two files messy without a shared types file.

---

## Decision

Split `src/lib/claude.ts` into three modules post-launch:

```
src/lib/
  claude-types.ts      # AnthropicMessage, StreamOptions, USE_CURL, createAbortError
  claude-transport.ts  # callAnthropicAPI (non-streaming) + callWithSDK + callWithCurl
  claude-stream.ts     # streamAnthropicAPI + streamWithSDK + streamWithCurl
  claude.ts            # generateChatResponse, streamChatResponse, sanitizeOutput,
                       # extractSourcesFromChunks — domain logic only
```

`claude.ts` becomes the public API surface. Consumers keep their current imports untouched. Only internal file structure changes.

---

## Alternatives Considered

1. **Two-file split (claude.ts + claude-stream.ts)** — Possible but duplicates the shared types. Three files is cleaner.
2. **Leave as-is** — Acceptable at current size; becomes a problem as prompts and models multiply.
3. **Do it now** — Not worth the risk immediately before/after launch. No external API surface changes, so the refactor can wait for a quiet cycle.

---

## Consequences

- **Positive:** Each file has a single responsibility and stays under 200 LOC.
- **Positive:** Transport layer can be tested independently (mock SDK vs. curl paths).
- **Negative:** Three-file migration requires updating `translate-story.ts` import (currently `import { callAnthropicAPI } from "./claude"`) and any future consumers.
- **Neutral:** `claude.ts` remains the barrel export so zero breaking changes for route handlers.

---

## Implementation Steps (when ready)

1. Create `src/lib/claude-types.ts` — move `AnthropicMessage`, `StreamOptions`, `USE_CURL`, `createAbortError`
2. Create `src/lib/claude-transport.ts` — move `callAnthropicAPI` + private helpers; import from `claude-types.ts`
3. Create `src/lib/claude-stream.ts` — move `streamAnthropicAPI` + private helpers; import from `claude-types.ts`
4. Update `src/lib/claude.ts` — remove moved code, re-export `callAnthropicAPI` for backward compat
5. Update `src/lib/translate-story.ts` import if desired (or keep pointing to `claude.ts` barrel)
6. Run `npm run typecheck && npm run test` — no test changes required (public API unchanged)
