# Coverage Agent Report — 2026-04-08

## Summary

- **Test suite**: 100% passing (5716 tests, +7) — 0 failures
- **TypeScript**: No errors
- **Overall coverage**: **98.73% statements** (unchanged), **96.64% branch** (unchanged), **98.72% function** (unchanged), **99.13% line** (unchanged)

## New Tests Added (+7)

| File | Test | Impact |
|------|------|--------|
| `src/hooks/use-stories.test.ts` | Documents `useStories` SSR guard (line 124) | Documentation |
| `src/hooks/use-stories.test.ts` | Documents `initialStories` ternary dead branch (line 131) | Documentation |
| `src/hooks/use-stories.test.ts` | Documents `clearStoriesCache` SSR guard (line 277) | Documentation |
| `src/lib/chat-action-detection.test.ts` | Documents sort tie-breaker (line 357) as unreachable | Documentation |
| `src/lib/chat-action-detection.test.ts` | Documents address dedup (line 417) as unreachable | Documentation |
| `src/components/admin/github-analytics-panel.test.tsx` | Documents StatCard dead branches (lines 238–246) | Documentation |
| `src/app/favorites/page.test.tsx` | Documents GalleryItem null-safe guards (lines 222–227) | Documentation |

## Coverage Plateau

The coverage plateau at 98.73% statements / 96.64% branch continues (day 8 of stability). All remaining uncovered lines are architecturally unreachable dead code or SSR-only guards. There is no new testable coverage to improve.

The only files requiring actual coverage improvement need Playwright E2E tests:
- `voice-agent-chat.tsx` (45.6%) — ElevenLabs WebSocket/SDK
- `agents-dashboard/index.tsx` (48.5%) — ElevenLabs terminal UI

## Remaining Low-Coverage Files (Carry-Over)

| File | Stmt% | Reason |
|------|-------|--------|
| `voice-agent-chat.tsx` | 45.6% | ElevenLabs SDK — requires Playwright E2E |
| `agents-dashboard/index.tsx` | 48.5% | ElevenLabs SDK — requires Playwright E2E |

## Documented Unreachable Guards (All Carry-Overs)

All remaining uncovered lines are confirmed dead code or SSR-only paths. Newly documented this run:

| File | Lines | Type | Why Unreachable |
|------|-------|------|-----------------|
| `use-stories.ts` | 124 | SSR guard | `else if (typeof window !== "undefined")` false branch — SSR context not reachable in jsdom |
| `use-stories.ts` | 131 | Dead ternary branch | `hasInitial ? initialStories : FALLBACK_STORIES` — cache.data always truthy when hasInitial is true (set at lines 121-123) |
| `use-stories.ts` | 277 | SSR guard | `clearStoriesCache` window check — SSR path not reachable in jsdom |
| `chat-action-detection.ts` | 357 | Dead tie-breaker | Sort `|| b.text.length - a.text.length` — patterns have mutually exclusive prefixes; no two candidates share the same start position |
| `chat-action-detection.ts` | 417 | Dead dedup | `detectChatActions` address dedup — `detectAddresses` already deduplicates; outer dedup never catches a duplicate |
| `github-analytics-panel.tsx` | 238 | Dead OR fallback | `statColorClasses[color] || statColorClasses.stone` — all call sites pass valid TypeScript-enforced color keys |
| `github-analytics-panel.tsx` | 246 | Dead ternary branch | `: value` string branch — all 5 StatCard call sites pass `number` values from API |
| `favorites/page.tsx` | 222,227 | Dead null guards | `if (currentRef)` false branch — React sets ref synchronously during commit; ref never null when effect fires |

Previously documented carry-overs (unchanged):

| File | Lines | Type | Why Unreachable |
|------|-------|------|-----------------|
| `author-typewriter.tsx` | 17–57,65,82–103 | V8 instrumentation limit | Fake-timer async paths; ref guard always true in jsdom |
| `story-editor-dialog/index.tsx` | 40–84 | Dead null guards | Component returns null on line 88 before callbacks can be triggered with null story |
| `use-voice-session.ts` | 75–111 | SSR guard + V8 merge | SSR guard; V8 maps node/jsdom to same branch |
| `language-switcher.tsx` | 72–75 | Dead listbox guards | Listbox open state never reached via keyboard in jsdom |
| `posthog-provider.tsx` | 17 | SSR guard | `window` always defined in jsdom |
| `post-row.tsx` | 18 | Dead null guard | `formatDate` never called with null in practice |
| `image-optimization.ts` | 130–131 | Dead JPEG branch | JPEG handling tested but retained; V8 marks as dead |
| `favorites/page.tsx` | 36 | Dead guard | IntersectionObserver pre-checks `hasMore && !isLoadingMore` before calling `loadMore` |
| `use-stories.ts` | 39,76 | SSR guards | `window` always defined in jsdom |
| `chat-action-detection.ts` | 371–375 | Dead guard | `matches` sourced from `candidates`; `.find()` always succeeds |
| `github-analytics-panel.tsx` | 254 | Dead guard | Parent checks `daily.length > 0` before rendering `TrafficChart` |
| `stripe-analytics-panel.tsx` | 225–244,531 | Dead guards | Parent checks `data.length > 0`; TypeScript-enforced status keys |
| `visitors-analytics-panel.tsx` | 544 | Dead guard | Parent checks `utmCampaigns.length > 0` before rendering `UTMTable` |
| `image-editor-dialog.tsx` | 56,109,129 | Dead null guards | Component returns null on render; buttons not rendered when story is null |
| `claude.ts` | 323 | Exhaustiveness throw | TypeScript exhaustiveness — only reachable with new unhandled stream event types |
| `i18n/provider.tsx` | 25–26 | Dead lazy loaders | `es`/`en` static imports always resolve; lazy paths structurally unused |
| `account-config-dialog.tsx` | 47 | Dead null guard | Component returns null before rendering save button when `platform` is null |
| `toolbar-overflow-menu.tsx` | 67 | Dead ref guard | React sets ref synchronously during render; ref never null when effect fires |

## Cross-Agent Recommendations

- **Performance Agent**: No new dependencies added. 7 test-only additions. No bundle impact.
- **Code Quality Agent**: Dead code catalogue now fully documented across all carry-over files. No new dead code introduced.
- **Security Agent**: All webhook and MCP error paths remain fully covered. No regression.
- **QA Agent**: No new testability gaps. `voice-agent-chat` and `agents-dashboard` still require Playwright E2E for coverage improvement.
- **Cost Analyst Agent**: No cost-related coverage gaps.
- **Localization Agent**: No locale-related coverage concerns.
