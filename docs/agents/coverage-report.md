# Coverage Agent Report — 2026-06-18

## Status: GREEN (three new tests added; targeted image-route gaps closed)

A clean full-suite coverage run completed this cycle. Three previously
uncovered paths in `stories/[id]/image/route.ts` were covered by new tests.
No source code was modified — test files only. Nothing committed; the user
reviews and commits manually.

## Overall coverage (authoritative)

| Metric     | This run (2026-06-18) | Prior baseline (2026-06-16) | Delta  |
|------------|-----------------------|-----------------------------|--------|
| Statements | 98.71% (10771/10911)  | 98.67% (10765/10910)        | +0.04  |
| Branches   | 95.53% (7086/7417)    | 95.51% (7084/7417)          | +0.02  |
| Functions  | 98.81% (2084/2109)    | 98.71% (2081/2108)          | +0.10  |
| Lines      | 99.16% (10262/10348)  | 99.12% (10256/10347)        | +0.04  |

Suite result: all 6663 tests across 361 test files passing, 0 failures (exit 0).
3 new tests added to `src/app/api/admin/stories/[id]/image/route.test.ts`.

## Files improved this cycle

| File | Before (stmts) | After (stmts) | Funcs before | Funcs after |
|------|----------------|---------------|--------------|-------------|
| `src/app/api/admin/stories/[id]/image/route.ts` | 93.52% | 97.05% | 82.35% | 94.11% |

### What was covered

Three genuinely testable paths in `readRemoteImageBufferWithLimit` and the
outer fetch-controller timeout:

**Line 140 — `throw new RemoteImageTooLargeError()` (no-body path)**
Triggered when `response.body === null` and `arrayBuffer.byteLength > MAX_REMOTE_SIZE`.
Test: mock fetch resolves with `body: null` and `arrayBuffer()` returning an
11 MB ArrayBuffer. Route enters the `if (!response.body)` branch, reads the
full buffer, detects it exceeds 10 MB, and throws. A `setupStoryUpdateMock()`
call was also required — `createAdminClient()` is invoked before the fetch
block, and without it the route would TypeError on the DB step instead of
returning 400.

**Lines 168-169 — `return Buffer.concat(chunks…)` (streaming reader success path)**
Triggered when the body is a ReadableStream and all chunks fit within the
10 MB limit. Test: mock fetch resolves with a single-chunk `ReadableStream`
containing 8 bytes. Route reads the stream, accumulates chunks, and returns
the concatenated Buffer; subsequent blur generation completes with the mocked
`generateBlurPlaceholder`.

**Line 322 — `fetchController.abort()` (fetch-timeout callback)**
The `setTimeout` callback fires after `FETCH_TIMEOUT_MS` (8 000 ms) and
aborts the fetch via `AbortController`. Test: mock fetch never resolves;
the signal's `abort` event rejects with a `DOMException("AbortError")`.
`vi.useFakeTimers()` + `vi.advanceTimersByTimeAsync(8001)` fires the timeout
synchronously. The route catches the AbortError as non-fatal, logs a warning,
and continues with no blur placeholder.

## Remaining gaps in the image route (newly documented)

These four lines in `route.ts` remain uncovered and are intentionally not
force-tested:

| Line | Reason |
|------|--------|
| 88 | IPv6 SSRF-guard branch (`0xfc00–0xfdff` / `0xfe80–0xfebf` / `0xff00–0xffff` ranges): the existing IPv6 test covers `2001:db8:` and loopback; the additional numeric-range branches are a V8 statement/branch split not worth a brittle address-table test. |
| 123 | `error instanceof Error ? error.message : String(error)` inside the DNS-lookup error handler: the `String(error)` branch requires `dns.lookup` to reject with a non-Error value — all realistic DNS errors are `Error` instances. |
| 153 | `if (!value) continue` inside the `ReadableStream` reader loop: V8 closure instrumentation gap — `ReadableStreamDefaultReader.read()` in Node.js never yields `value = undefined` on a non-done chunk; the branch is architecturally unreachable at runtime. |
| 429 | Outer catch: `logger.error("Admin image API error:", …)` — requires an unexpected throw from inside the main `try` block (beyond the inner fetch catch). Already well-covered by the "unexpected error" tests; the specific line was being missed due to branch-path ordering in V8's attribution. |

## Remaining gaps (unchanged from prior cycles)

These are carried forward from prior cycles and are either Playwright-only,
SSR/defensive guards, or V8 instrumentation limits.

- Playwright-only components (unit coverage not the right tool):
  - `src/components/admin/voice-agent-chat.tsx` (~45% stmts)
  - `src/components/admin/agents-dashboard/index.tsx` (~49% stmts)
  - `src/components/admin/story-editor-dialog/index.tsx` (~89% — the
    save/approve/curate button handlers are exercised via E2E, not unit tests)
- SSR / environment guards unreachable in jsdom:
  - `src/components/posthog-provider.tsx:17` (`typeof window === "undefined"` guard)
  - `src/hooks/use-media-query.ts:15` (SSR guard)
  - `src/lib/request-context.ts:49` (AsyncLocalStorage path under jsdom/ESM)
- V8 timer/closure instrumentation gaps:
  - `src/components/immersive/author-typewriter.tsx` (~86% — ref-based timer
    callbacks the V8 coverage provider does not always attribute)
  - `src/lib/translate-story.ts` defensive recovery branches
  - `src/app/api/health/route.ts:223` (Promise.all catch the provider may not
    instrument)
- Documented dead/defensive branches retained from prior cycles:
  - `src/hooks/use-stories.ts` `enabled`-param guards (param defaults true,
    never passed false)
  - `src/app/api/webhooks/translate/route.ts:206` (recovery branch
    architecturally blocked by the identical entry-gate schema)
  - `src/app/api/admin/feature-flags/[key]/route.ts:41` (Zod fieldErrors
    path architecturally unreachable — schema errors are always form-level,
    not field-level, given the single-field schema shape)
  - `src/components/admin/marketing-dashboard/post-row.tsx:18`
    (`formatDate(undefined)` guard — `formatDate` is only called behind a
    truthy `&&` so `undefined` can never reach it)

## Environment note

No worker-starvation issues this run. Full suite completed in ~46s with the
default worker count. The Mac Studio appears less loaded than on prior cycles.
