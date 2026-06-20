# Coverage Agent Report — 2026-06-20

## Status: GREEN (plateau holds; 1 new security-regression test added)

A clean full-suite coverage run completed this cycle: **361 test files, 6676 tests
passing, 0 failures**. One new test was added covering the streaming-body size-limit
(DoS/SSRF) path in the admin image route. No source code was modified — test files
only. Nothing committed; the user reviews and commits manually.

The codebase remains at its established statement-coverage plateau (~98.7%). After a
file-by-file pass over all 32 files with residual statement gaps, every remaining gap
is one of four categories: SSR `typeof window === "undefined"` guards (unreachable in
jsdom), caller-protected defensive guards (the call site already checks the same
condition), V8 ESM instrumentation artifacts, or Playwright/E2E-only admin components.
None are worth a brittle unit test.

## Overall coverage (authoritative)

| Metric     | This run (2026-06-20) | Prior (2026-06-19)   | Delta |
|------------|-----------------------|----------------------|-------|
| Statements | 98.74% (10774/10911)  | 98.74% (10774/10911) | 0.00  |
| Branches   | 95.63% (7093/7417)    | 95.63% (7093/7417)   | 0.00  |
| Functions  | 98.86% (2085/2109)    | 98.86% (2085/2109)   | 0.00  |
| Lines      | 99.18% (10264/10348)  | 99.18% (10264/10348) | 0.00  |

Suite result: all **6676 tests** across 361 test files passing, 0 failures (exit 0).
+1 test vs the prior cycle (6675 → 6676). All four coverage thresholds
(stmts 95 / branches 90 / funcs 95 / lines 95) pass with comfortable margin.

## Test added this cycle

| File | Path | What it verifies |
|------|------|------------------|
| image route test | `src/app/api/admin/stories/[id]/image/route.test.ts` | Streaming response body that exceeds the 10 MB remote-image limit → 400 "Image too large", `reader.cancel()` runs, DB update skipped |

### Why this test matters (and the V8 caveat)

`readRemoteImageBufferWithLimit` in the admin image route has two oversize-rejection
paths: the no-body `arrayBuffer().byteLength > maxBytes` path (route line 140, already
tested) and the **streaming** path inside the reader loop (lines 157-160:
`if (totalBytes > maxBytes) { abortFetch(); await reader.cancel()…; throw
RemoteImageTooLargeError(); }`). Only the no-body path was covered. The new test feeds
a `ReadableStream` enqueuing an 11 MB chunk and asserts the route returns 400 and
cancels the reader — a genuine regression guard for the DoS/SSRF download-size limit.

The test passes and exercises the path in isolation (the route file reaches 100% line
coverage when run alone). However, line 158 still shows as an uncovered *statement* in
the **full multi-file** aggregate. This is the same V8 ESM coverage-merge limitation
documented in prior cycles (`use-stream-chat.ts:172`, `health/route.ts:228`): a
statement inside an async read loop that is covered in isolation is not always credited
when the module is loaded across hundreds of test files. The test is kept for its
regression value regardless of the aggregate-coverage artifact — which is why the
headline numbers are flat this cycle.

## Residual statement gaps — full classification (32 files)

### Playwright / E2E-only (2 files — unchanged, by design)
- `src/components/admin/voice-agent-chat.tsx` — 45.2% (lines 86-223, 404, 454). ElevenLabs widget; browser-only.
- `src/components/admin/agents-dashboard/index.tsx` — 49.3% (lines 59-131, 213, 257-259). Live agent runner; E2E-only.

These two account for the bulk of the uncovered statements and are the top Playwright
E2E targets (consistent with QA's standing recommendation). story-editor save / approve
/ curate handlers (`image-editor-dialog.tsx:56,109,129`) are likewise E2E-only.

### SSR `typeof window === "undefined"` guards (unreachable in jsdom)
- `src/hooks/use-media-query.ts:15`
- `src/hooks/use-stories.ts:58,95` (loadFromStorage / saveToStorage SSR guards)
- `src/hooks/use-voice-session.ts:75` (saveState SSR guard)
- `src/components/posthog-provider.tsx:17`
- `src/lib/stories-data.ts:14` (server-side `return supabase` branch)

### Caller-protected defensive guards (call site already checks the condition)
- `src/lib/sentry-before-send.ts:8` — `if (!headers) return headers` inside
  `redactHeaders`, only ever called under `if (event.request.headers)`.
- `src/lib/claude.ts:381` — `throw lastError || …` after a loop that always returns or
  throws ("// Should not reach here, but TypeScript needs it").
- `src/lib/logger-sanitize.ts:52` — `sanitizeString`'s own sensitive-key guard;
  `sanitizeValue` redacts sensitive keys (line 80) before ever calling `sanitizeString`.
- `src/app/api/admin/feature-flags/[key]/route.ts:41` — `flat.fieldErrors` fallthrough.
  Schema has only `enabled`/`config` (caught at lines 28/31) plus a refinement
  (formErrors, caught at line 35); no input can reach the fallthrough.
- `src/app/api/admin/stories/[id]/image/route.ts:35,38,49` — `parseIpv4Octets` /
  `isUnsafeIpv4` invalid-input branches; the route only feeds them validated 4-octet
  addresses (documented inline in the test file).
- `src/components/admin/image-editor-dialog.tsx:56,109,129` — `if (!story) return`
  handler guards; buttons aren't rendered without a story.
- `src/components/admin/stripe-analytics-panel.tsx:244`,
  `src/components/admin/github-analytics-panel.tsx:254` — empty-data `return null`
  guards in chart sub-components (parent renders a separate empty state).
- `src/app/favorites/page.tsx:38` — `loadMore` re-entrancy guard; the only caller
  (IntersectionObserver) already checks `hasMore && !isLoadingMore`.

### V8 ESM instrumentation artifacts (covered in isolation, not in aggregate)
- `src/app/api/admin/stories/[id]/image/route.ts:158` (this cycle's new test — see above)
- `src/app/api/health/route.ts:223` (Promise.all catch)
- `src/lib/request-context.ts:49` (AsyncLocalStorage under jsdom/ESM)
- `src/components/immersive/author-typewriter.tsx:40-96` (ref-based typewriter timers)
- Single-line residuals in `story-viewer.tsx:306`, `voice-chat.tsx:173`,
  `toolbar-overflow-menu.tsx:68`, `agents/run/route.ts:241`, `use-stories.ts:155`,
  `auth-provider.tsx:96`, assorted admin analytics panels.

## Cross-agent notes

- **Security Agent**: The new streaming oversize-image test hardens the SSRF/DoS
  download-size limit (`readRemoteImageBufferWithLimit`). Both the no-body and
  streaming rejection paths now have explicit regression coverage; the IPv4/IPv6 SSRF
  checks remain fully covered. No regression risk.
- **QA Agent**: `voice-agent-chat` (~45%) and `agents-dashboard/index` (~49%) remain
  the top Playwright E2E targets; `image-editor-dialog` save/approve/curate handlers
  are also E2E-only. All other residual gaps are documented-unreachable.
- **Code Quality Agent**: Several `if (!x) return` guards (image-editor-dialog handlers,
  feature-flags route fallthrough, claude.ts:381) are caller-protected dead code —
  candidates for removal if a leaner surface is preferred, though they are cheap
  defensive insurance.

## Methodology note

The terminal coverage table wraps long filenames, which misaligns the "Uncovered
Line #s" column and can make covered lines look uncovered. This cycle's gap analysis
was driven off `coverage/coverage-final.json` (per-statement `statementMap` + `s`
counters) rather than the wrapped text table, for accurate line-level attribution.
