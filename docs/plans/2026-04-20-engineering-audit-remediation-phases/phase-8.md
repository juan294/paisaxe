# Phase 8 — Request Correlation IDs

**Scope:** Generate or extract an `X-Request-ID` in the proxy, propagate it through the Pino child logger for every log line emitted during a request, and attach it as a Sentry tag. Enables cross-system debugging: a single ID connects Vercel logs, Sentry events, and (optionally) client-side network captures.

**Addresses:** §9#2.

**Batch eligibility:** No — depends on P3's logger infrastructure.

---

## Current State

After P3, the logger interface is:

```ts
export const logger: Logger; // info/warn/error with (msg, meta)
```

No `logger.child()` factory, no per-request context propagation, no request ID in Sentry events.

`src/proxy.ts` does not currently read or set `X-Request-ID`.

## Target State

- `src/proxy.ts` reads incoming `X-Request-ID` header (if upstream — e.g., Vercel edge — set one) or generates `crypto.randomUUID()`.
- The request ID is written to response headers as `X-Request-ID`.
- Forwarded to downstream route handlers via `request.headers.set("x-request-id", id)`.
- Route handlers can call `logger.child({ request_id })` to get a scoped logger; all logs emitted during that request carry the ID.
- Sentry `beforeSend` reads the ID from the current async context (via `AsyncLocalStorage`) and attaches it as `event.tags.request_id`.

## Implementation Steps

### Step 8.1 — Proxy: generate/extract request ID

`src/lib/proxy/request-id.ts` (new):

```ts
// Pseudocode
export function getOrCreateRequestId(request: NextRequest): string {
  const upstream = request.headers.get("x-request-id");
  if (upstream && /^[a-zA-Z0-9_-]{8,128}$/.test(upstream)) return upstream;
  return crypto.randomUUID();
}
```

`src/proxy.ts` — insert before CSP step:

```ts
// Pseudocode
const requestId = getOrCreateRequestId(request);
request.headers.set("x-request-id", requestId);
// After response is built:
response.headers.set("X-Request-ID", requestId);
```

### Step 8.2 — AsyncLocalStorage for cross-cut context

`src/lib/request-context.ts` (new):

```ts
// Pseudocode
import { AsyncLocalStorage } from "node:async_hooks";

type RequestContext = { requestId: string };
const storage = new AsyncLocalStorage<RequestContext>();

export function runWithRequestContext<T>(ctx: RequestContext, fn: () => T): T {
  return storage.run(ctx, fn);
}

export function getRequestId(): string | undefined {
  return storage.getStore()?.requestId;
}
```

Wrap route execution in a Next.js middleware-adjacent hook. Simpler alternative: have each route handler do `logger.child({ request_id: request.headers.get("x-request-id") })` at the top. The AsyncLocalStorage approach avoids the per-handler boilerplate but requires integration with Next.js request lifecycle — assess complexity and pick whichever is cleaner.

### Step 8.3 — Logger child factory

Extend `src/lib/logger.ts`:

```ts
// Pseudocode
export interface Logger {
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
  child(bindings: Record<string, unknown>): Logger;
}
```

Pino natively supports `.child({...})`. If the dev/test branch uses custom stdout writes, add the same child-forwarding semantics.

### Step 8.4 — Sentry tag from context

Update `src/lib/sentry-before-send.ts` (from P3):

```ts
// Pseudocode
import { getRequestId } from "./request-context";

export function sanitizeSentryEvent(event) {
  // ... existing PII sanitization
  const requestId = getRequestId();
  if (requestId) {
    event.tags = { ...event.tags, request_id: requestId };
  }
  return event;
}
```

### Step 8.5 — Tests

```ts
// src/lib/proxy/request-id.test.ts
it("uses upstream X-Request-ID when well-formed", () => {
  const req = new Request("https://x/", { headers: { "x-request-id": "abc-123_456" } });
  expect(getOrCreateRequestId(req)).toBe("abc-123_456");
});
it("generates a UUID when upstream missing", () => {
  const req = new Request("https://x/");
  expect(getOrCreateRequestId(req)).toMatch(/^[0-9a-f-]{36}$/);
});
it("rejects malformed upstream IDs (potential injection)", () => {
  const req = new Request("https://x/", { headers: { "x-request-id": "a\nb" } });
  expect(getOrCreateRequestId(req)).toMatch(/^[0-9a-f-]{36}$/);
});
```

Integration test: hit a local endpoint, capture logs, assert the request ID appears on every log line produced during the request.

## Automated Success Criteria

```bash
cd <worktree>
npm install
npm run typecheck
npm run lint
npm run test -- src/lib/proxy/request-id
npm run test -- src/lib/request-context
npm run test
```

## Manual Success Criteria

1. `curl -i http://localhost:3000/api/health` — response contains `X-Request-ID: <uuid>` header.
2. Trigger a known error path locally; confirm Sentry event in dev has `tags.request_id` matching the header value.
3. The same request ID appears across all log lines emitted during the request (stdout inspection).

## Rollback

`git revert`. Request ID is additive; removing reverts to the pre-P8 state cleanly.

## Files Touched

- `src/lib/proxy/request-id.ts` (new)
- `src/lib/request-context.ts` (new)
- `src/proxy.ts`
- `src/lib/logger.ts`
- `src/lib/sentry-before-send.ts`

## Exit Gate

STOP. Confirm merge to `develop` with green CI.
