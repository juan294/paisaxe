# Phase 5 — SSE Abort Propagation + Event Taxonomy

**Scope:** Wire `request.signal` into the chat SSE route so client disconnects abort the Anthropic stream. Add an abort E2E test. Document the SSE event taxonomy in `src/types/sse.ts`. Verify whether the dynamic-import Turbopack workaround at `stream/route.ts:84-90` is still required on Next.js 16.2.4.

**Addresses:** §3.5 (High), §9#8 SSE taxonomy, §5 bullet "verify dynamic imports still needed", §7 abort test gap.

**Batch eligibility:** `[batch-eligible]` — depends only on P1.

---

## Current State (verified 2026-04-20)

`src/app/api/chat/stream/route.ts` (195 LoC):
- `request.signal` — does not appear anywhere.
- `AbortController` — not constructed anywhere.
- L91-93 — dynamic import of `streamChatResponse` from `@/lib/claude` (Turbopack workaround per comment at L84-90).
- L140-146 — `for await (const chunk of streamChatResponse(enrichedMessage, chunks, asturianEnabled, messageIndex, images))` — no signal option.
- L163-166 — `console.error("[CHAT_STREAM_FAILURE]", ...)`.
- L105 — `console.error("[CHAT_STREAM] Embedding/search failed:", ...)`.
- L186 — `console.error("Stream chat API error:", error)`.

`src/app/api/chat/stream/route.test.ts` — existing tests at L315 and L343 already cover partial-yield-then-throw (error event + `[CHAT_STREAM_FAILURE]` logging). No abort test exists.

## Target State

- `POST` handler reads `request.signal`, constructs an internal `AbortController` linked to it, and passes `controller.signal` into `streamChatResponse(..., { signal })`.
- `streamChatResponse` in `src/lib/claude/*` accepts `signal` and forwards it to the Anthropic SDK call.
- On `request.signal` abort: the `ReadableStream` is cancelled, Anthropic generation stops, no further billable tokens are consumed, `[CHAT_STREAM_ABORTED]` is logged at WARN level.
- SSE event taxonomy documented as a type in `src/types/sse.ts` and consumed by both server and client.
- Optional: add `hadPartialContent: boolean` to the `error` event so clients know whether to discard rendered partial text.

## Implementation Steps

### Step 5.1 — Red: abort unit test

Add to `src/app/api/chat/stream/route.test.ts`:

```ts
// Pseudocode
it("propagates request.signal abort into streamChatResponse", async () => {
  const controller = new AbortController();
  const streamSpy = vi.fn().mockImplementation(async function* (_msg, _chunks, _ast, _idx, _imgs, { signal }) {
    expect(signal).toBeInstanceOf(AbortSignal);
    yield { text: "partial " };
    await new Promise((resolve, reject) => {
      signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    });
    yield { text: "never reached" };
  });
  mockStreamChatResponse.mockImplementation(streamSpy);

  const request = buildRequest({ signal: controller.signal });
  const responsePromise = POST(request);
  // Simulate client disconnect mid-stream
  setTimeout(() => controller.abort(), 50);
  const response = await responsePromise;

  const events = await readSseEvents(response.body);
  expect(events.some(e => e.text === "partial ")).toBe(true);
  expect(events.some(e => e.text === "never reached")).toBe(false);
  // Assert no error event emitted on clean abort (it's a cancellation, not a failure)
  expect(events.some(e => e.type === "error")).toBe(false);
});
```

### Step 5.2 — Green: wire signal in route handler

`src/app/api/chat/stream/route.ts` (pseudocode, inside POST after dynamic imports):

```ts
// Link request.signal to an internal controller for safe propagation
const abortController = new AbortController();
request.signal.addEventListener("abort", () => abortController.abort(), { once: true });

const stream = new ReadableStream({
  async start(controller) {
    try {
      for await (const chunk of streamChatResponse(
        enrichedMessage, chunks, asturianEnabled, messageIndex, images,
        { signal: abortController.signal }
      )) {
        if (abortController.signal.aborted) break;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "text", text: chunk.text })}\n\n`));
      }
      if (!abortController.signal.aborted) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
      }
    } catch (err) {
      if (err?.name === "AbortError" || abortController.signal.aborted) {
        logger.warn("[CHAT_STREAM_ABORTED]", { reason: "client_disconnect" });
      } else {
        logger.error("[CHAT_STREAM_FAILURE]", { error: err.message });
        controller.enqueue(encoder.encode(
          `data: ${JSON.stringify({ type: "error", message: "stream_failed", hadPartialContent: hasEmittedText })}\n\n`
        ));
      }
    } finally {
      controller.close();
    }
  },
  cancel() {
    abortController.abort();
  },
});
```

Track `hasEmittedText` locally to populate `hadPartialContent`.

### Step 5.3 — Green: accept signal in streamChatResponse

In `src/lib/claude/*` (likely `src/lib/claude/stream.ts` or similar — verify):

```ts
// Pseudocode
export async function* streamChatResponse(
  message: string,
  chunks: Chunk[],
  asturian: boolean,
  messageIndex: number,
  images: Image[],
  options?: { signal?: AbortSignal }
): AsyncGenerator<{ text: string }> {
  const response = await anthropic.messages.create(
    { model, messages, system, stream: true, ... },
    { signal: options?.signal }  // SDK supports this
  );
  for await (const event of response) { ... }
}
```

Verify the exact Anthropic SDK signature supports `signal` in the request options object (recent versions do).

### Step 5.4 — SSE event taxonomy type

`src/types/sse.ts` (new):

```ts
// Pseudocode
export type SseEvent =
  | { type: "text"; text: string }
  | { type: "done" }
  | { type: "error"; message: string; hadPartialContent: boolean };

export const SSE_EVENT_TYPES = ["text", "done", "error"] as const;

export function encodeSseEvent(event: SseEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export function parseSseEvent(data: string): SseEvent | null {
  try {
    const parsed = JSON.parse(data);
    if (parsed.type === "text" && typeof parsed.text === "string") return parsed;
    if (parsed.type === "done") return parsed;
    if (parsed.type === "error" && typeof parsed.message === "string") return parsed;
    return null;
  } catch { return null; }
}
```

Route handler uses `encodeSseEvent`. Client code in `voice-chat.tsx` (or wherever SSE is consumed) uses `parseSseEvent` and discards partial text when `error` event has `hadPartialContent: true`.

### Step 5.5 — Abort E2E test

`e2e/sse-abort.spec.ts` (new):

```ts
// Pseudocode
test("aborting the chat request stops Anthropic billing", async ({ page, request }) => {
  const controller = new AbortController();
  const promise = request.post("/api/chat/stream", {
    data: { message: "write a long essay", /* ... */ },
    signal: controller.signal,
  });
  await new Promise(r => setTimeout(r, 200));
  controller.abort();
  await expect(promise).rejects.toThrow();
  // Check local log output for [CHAT_STREAM_ABORTED] tag (if possible from test env)
});
```

### Step 5.6 — Verify Turbopack dynamic-import workaround

Research step: the comment at L84-90 documents why `streamChatResponse` is dynamically imported (Turbopack bug). Reproduce on current Next.js (`16.2.4`):

```bash
# Temporarily revert the dynamic import to a static one
# import { streamChatResponse } from "@/lib/claude";
npm run build
npm run dev
# Trigger a chat request, observe whether Anthropic streaming works
```

If the issue is resolved, convert to a static import (removes ~150ms TTFB). If not, leave the workaround in place and update the comment with the Next.js version verified against.

## Automated Success Criteria

```bash
cd <worktree>
npm install
npm run typecheck
npm run lint
npm run test -- src/app/api/chat/stream
npm run test -- src/types/sse
npm run test       # full suite
npm run test:e2e -- sse-abort
```

## Manual Success Criteria

1. Open chat on local dev, start a long response, close the tab mid-stream. Observe local log: `[CHAT_STREAM_ABORTED] { reason: "client_disconnect" }`. No `[CHAT_STREAM_FAILURE]`. No further Anthropic tokens in the stream.
2. The error-event client contract is documented in `src/types/sse.ts` and consumed where SSE is parsed.
3. Turbopack workaround status is recorded in the route file's comment (either removed with a note, or retained with the verified version number).

## Rollback

`git revert` the merge. No schema or external side-effects.

## Files Touched

- `src/app/api/chat/stream/route.ts`
- `src/app/api/chat/stream/route.test.ts`
- `src/lib/claude/*` (whichever file exports `streamChatResponse`)
- `src/types/sse.ts` (new)
- `src/components/immersive/voice-chat.tsx` (SSE consumer — parse & discard partial)
- `e2e/sse-abort.spec.ts` (new)

## Exit Gate

STOP. Confirm merge to `develop` with green CI.
