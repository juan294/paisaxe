# Coverage Agent Report — 2026-05-05

## Summary

- **Test suite**: 6520 total tests. 6520 pass (100% green — 0 failures, fixed 1 load-race flake).
- **TypeScript**: Pass (no errors).
- **Overall coverage** (full suite):
  - statements: **98.08%** (was 97.96%)
  - branches: **94.30%** (was 94.08%)
  - functions: **98.65%** (was 98.41%)
  - lines: **98.53%** (was 98.43%)
- **Vitest config thresholds** (95/90/95/95): all PASS.
- **Changes this run**: +5 targeted tests across 3 files, lifting two files to 100% line and function coverage. Fixed 1 load-race flake.

## Changes This Run

| File | Tests | Before | After |
|------|-------|---------|-------|
| `src/app/api/admin/stories/[id]/image/route.ts` | +4 | stmt 91.04% / fn 90.9% / line 95.12% | stmt 97.01% / fn **100%** / line **100%** |
| `src/lib/logger.ts` | +1 | stmt 87.5% / fn 78.57% / line 87.5% | stmt **100%** / fn **100%** / line **100%** |
| `src/components/immersive/accessibility.test.tsx` | 0 (flake fix) | 1 failure (load-race) | 0 failures |

### Coverage Detail — what's new

**`image/route.ts` (+4 tests)**

The `firstIpv6Hextet` function (lines 63–65) and the corresponding call site in `isUnsafeIpv6` (lines 77–80) were never reached by any existing test. All prior IPv6 tests used `::1` or `::` which are caught by the early loopback check on lines 73–75 before `firstIpv6Hextet` is called.

- **fc00::1, fe80::1, ff02::1 IPv6 literals** (3 parametrized cases): URL literals like `https://[fc00::1]/image.jpg` reach `isUnsafeIpv6` past the loopback check, call `firstIpv6Hextet`, and return 400 ("Private or reserved IP addresses are not allowed"). Covers lines 63–65 and 77–85 in full.
- **DNS resolves to `::2` (non-private IPv6)**: DNS mock returns `[{ address: "::2", family: 6 }]`. `firstIpv6Hextet("::2")` splits on `:` yielding an empty first hextet, returns null, and `isUnsafeIpv6` returns false (line 78 branch covered). The URL is allowed through DNS validation; fetch for blur generation fails (mocked to reject, non-fatal); Supabase update succeeds. Covers the `first === null` branch in line 78.

Remaining uncovered statements in this file (97.01% → not 100%): lines 81 and 116 are sub-expression branches within already-covered lines (`&&`/`||` short-circuit paths and ternary arms in complex expressions). These are branch-coverage items, not reachable as separate statements.

**`logger.ts` (+1 test)**

The `makePinoLogger` function is only used when `NODE_ENV=production`. In test environments, `makeDevLogger` is used instead, leaving all of `makePinoLogger`'s body (lines 110–131) uncovered.

Added one test in the `"in production environment"` describe block:
- Stubs `NODE_ENV` to `"production"` and uses `vi.doMock("pino", ...)` (dynamic, post-reset mock) to inject a mock pino instance.
- Calls `logger.info` with meta (line 118 path), `logger.info` without meta (line 122 path), `logger.warn` (line 127), `logger.error` (line 128), and `logger.child` (line 129).
- Verifies pino instance methods were called with the expected arguments.

Remaining uncovered branch: line 129 `child:` has one uncovered branch arm (`?? {}` fallback when `sanitizeMeta` returns undefined). Statement and line coverage are 100%.

**`accessibility.test.tsx` (flake fix, no new tests)**

The "should announce new messages to screen readers" test failed in the full suite run (1 failure out of 6515 tests on the previous run). The `waitFor` default timeout of 1000ms is insufficient under full-suite load when the SSE stream for the AI response takes longer to process in jsdom. Increased timeout from 1000ms to 5000ms. Test passes cleanly in both isolation and full-suite runs.

## Remaining Low-Coverage Files

| File | Statements | Branch | Notes |
|------|-----------|--------|-------|
| `src/components/admin/agent-chat.tsx` | 42.68% | 40.69% | Requires Playwright E2E — ElevenLabs widget interaction not testable in jsdom |
| `src/components/admin/agents-dashboard/index.tsx` | 49.27% | 47.82% | Requires Playwright E2E — same reason |
| `src/components/immersive/story-viewer.tsx` | 99.1% | 98.3% | Line 306 documented as architecturally untestable: `onToggleFavorite` is a dead prop passed to `StoryInfoPanel` which never calls it |
| `src/lib/logger.ts` | 100% | 92.3% | Line 129 branch only: `sanitizeMeta(bindings) ?? {}` fallback — defensive null guard for an impossible condition given how pino works |

## Coverage Plateau

After today's fixes, 98.08% statement / 98.53% line coverage is the practical ceiling for jsdom/vitest on this codebase. The remaining gaps are:
- SSR guards and server-only paths (unreachable in jsdom)
- `agent-chat.tsx` and `agents-dashboard/index.tsx` (ElevenLabs widget — E2E only)
- Defensive dead code (`?? {}` in logger child, `story?.id` guards)
- One architecturally untestable prop (`onToggleFavorite` on line 306)
</content>
</invoke>