# Test Coverage Report

> Last updated: 2026-01-28
> Scheduled: nightly at 2:00 CET via `scripts/coverage-agent.sh`

## Summary

- **Total tests:** 1247
- **Test files:** 102
- **Statement coverage:** 86.90%
- **Branch coverage:** 81.46%
- **Function coverage:** 83.76%
- **Line coverage:** 87.56%

## Files at 100%

| File | Category |
|------|----------|
| `src/app/error.tsx` | App |
| `src/app/global-error.tsx` | App |
| `src/app/layout.tsx` | App |
| `src/app/loading.tsx` | App |
| `src/app/not-found.tsx` | App |
| `src/app/opengraph-image.tsx` | App |
| `src/app/page.tsx` | App |
| `src/app/providers.tsx` | App |
| `src/app/robots.ts` | App |
| `src/app/admin/error.tsx` | Admin |
| `src/app/admin/loading.tsx` | Admin |
| `src/app/api/admin/analytics/route.ts` | API |
| `src/app/api/admin/feature-flags/[key]/route.ts` | API |
| `src/app/api/admin/stories/route.ts` | API |
| `src/app/api/analytics/route.ts` | API |
| `src/app/api/chat/route.ts` | API |
| `src/app/api/feature-flags/route.ts` | API |
| `src/app/favorites/error.tsx` | App |
| `src/app/favorites/layout.tsx` | App |
| `src/app/favorites/loading.tsx` | App |
| `src/app/immersive/error.tsx` | App |
| `src/app/immersive/layout.tsx` | App |
| `src/app/immersive/loading.tsx` | App |
| `src/components/a11y/lang-sync.tsx` | A11y |
| `src/components/a11y/skip-link.tsx` | A11y |
| `src/components/admin/curation-badge.tsx` | Admin |
| `src/components/admin/placeholder-badge.tsx` | Admin |
| `src/components/admin/story-card.tsx` | Admin |
| `src/components/admin/story-grid.tsx` | Admin |
| `src/components/auth/sign-in-prompt.tsx` | Auth |
| `src/components/immersive/favorite-button.tsx` | Immersive |
| `src/components/immersive/language-switcher.tsx` | Immersive |
| `src/components/immersive/privacy-notice.tsx` | Immersive |
| `src/components/immersive/related-stories.tsx` | Immersive |
| `src/components/immersive/skeleton-chat-message.tsx` | Immersive |
| `src/components/immersive/skeleton-story-card.tsx` | Immersive |
| `src/components/immersive/skeleton-story-detail.tsx` | Immersive |
| `src/components/immersive/story-filters.tsx` | Immersive |
| `src/components/seo/json-ld.tsx` | SEO |
| `src/components/ui/button.tsx` | UI |
| `src/components/ui/card.tsx` | UI |
| `src/components/ui/dialog.tsx` | UI |
| `src/components/ui/input.tsx` | UI |
| `src/components/ui/skeleton.tsx` | UI |
| `src/hooks/use-admin-role.ts` | Hooks |
| `src/hooks/use-auth.ts` | Hooks |
| `src/hooks/use-favorites.ts` | Hooks |
| `src/hooks/use-realtime-feature-flags.ts` | Hooks |
| `src/hooks/use-story-filters.ts` | Hooks |
| `src/hooks/use-viewed-stories.ts` | Hooks |
| `src/lib/asturianu.ts` | Lib |
| `src/lib/embeddings.ts` | Lib |
| `src/lib/mood-mapping.ts` | Lib |
| `src/lib/og-image-helpers.ts` | Lib |
| `src/lib/realtime.ts` | Lib |
| `src/lib/related-stories.ts` | Lib |
| `src/lib/shuffle.ts` | Lib |
| `src/lib/supabase-browser.ts` | Lib |
| `src/lib/supabase.ts` | Lib |
| `src/lib/unsplash-placeholders.ts` | Lib |
| `src/lib/utils.ts` | Lib |
| `src/lib/validation.ts` | Lib |
| `src/lib/i18n/en.ts` | i18n |
| `src/lib/i18n/es.ts` | i18n |
| `src/lib/i18n/provider.tsx` | i18n |
| `src/lib/i18n/use-translation.ts` | i18n |
| `src/types/auth.ts` | Types |
| `src/types/feature-flags.ts` | Types |
| `src/types/immersive.ts` | Types |

## Files Below 100%

| File | Stmts | Branch | Funcs | Lines | Uncovered Lines | Reason |
|------|-------|--------|-------|-------|-----------------|--------|
| `src/types/index.ts` | 0% | 0% | 0% | 0% | all | Pure TypeScript interfaces with no runtime code. V8 reports 0% but there is nothing to execute. |
| `src/types/analytics.ts` | 0% | 0% | 0% | 0% | all | Pure TypeScript types with no runtime code. Same as `index.ts`. |
| `src/lib/i18n/index.ts` | 0% | 0% | 0% | 0% | all | Re-export barrel file with no runtime logic. |
| `src/lib/i18n/types.ts` | 0% | 0% | 0% | 0% | all | Pure TypeScript types with no runtime code. |
| `src/app/story/[slug]/page.tsx` | 0% | 0% | 0% | 0% | 10-36 | New story detail page — not yet tested. |
| `src/components/admin/admin-tabs.tsx` | 0% | 0% | 0% | 0% | 12-26 | New admin component — not yet tested. |
| `src/components/admin/analytics-dashboard.tsx` | 0% | 0% | 0% | 0% | 10-124 | New admin component — not yet tested. |
| `src/components/admin/feature-toggles-panel.tsx` | 0% | 0% | 0% | 0% | 10-94 | New admin component — not yet tested. |
| `src/components/immersive/active-indicator.tsx` | 0% | 100% | 0% | 0% | 6-8 | Small presentational component — not yet tested. |
| `src/components/immersive/freshness-badge.tsx` | 0% | 0% | 0% | 0% | 14-29 | New component — not yet tested. |
| `src/components/immersive/suggestion-prompts.tsx` | 0% | 0% | 0% | 0% | 13-29 | New component — not yet tested. |
| `src/components/immersive/volume-button.tsx` | 0% | 0% | 0% | 0% | 20-52 | New component — not yet tested. |
| `src/hooks/use-realtime-stories.ts` | 0% | 100% | 0% | 0% | 19-24 | Realtime subscription hook — not yet tested. |
| `src/components/immersive/mood-overlay.tsx` | 8% | 100% | 0% | 8% | 22-62 | New component — mostly untested. |
| `src/lib/admin-api.ts` | 57% | 55% | 57% | 59% | 131-196 | New admin API functions added in Phase 7 — not yet tested. |
| `src/app/immersive/page.tsx` | 58% | 40% | 64% | 60% | 59-62,66-69,78-94,133-144,159-160,172-178 | Significant new functionality added (mood overlay, suggestions, story detail). Many new branches untested. |
| `src/app/story/[slug]/opengraph-image.tsx` | 100% | 66% | 100% | 100% | 29-95 | Some branches uncovered but all statements and lines covered. |
| `src/app/auth/callback/route.ts` | 71% | 100% | 25% | 71% | 20-25 | Supabase SSR cookie plumbing — `getAll`/`setAll` callbacks inside `createServerClient` config are never invoked when the entire client is mocked. Untestable at unit level. |
| `src/lib/admin-auth.ts` | 73% | 100% | 25% | 73% | 23-28 | New `validateAdminAuth` helper functions — not fully covered. |
| `src/components/immersive/share-button.tsx` | 78% | 73% | 100% | 80% | 49-53 | Web Share API fallback to clipboard — `navigator.share` availability varies in jsdom. |
| `src/components/immersive/story-viewer.tsx` | 80% | 64% | 75% | 79% | 313-325,329,336-338,370,414-415,462 | Touch gesture handlers and new Phase 7 features (mood overlay, volume). jsdom doesn't support touch events natively. |
| `src/hooks/use-feature-flags.ts` | 84% | 61% | 100% | 82% | 29,33,48-49,69-71 | New feature flag hook with Realtime integration — some branches untested. |
| `src/app/favorites/page.tsx` | 85% | 77% | 82% | 89% | 36-42,51 | Conditional rendering tied to auth state and hover — some branches untested. |
| `src/app/admin/page.tsx` | 89% | 89% | 68% | 89% | 65-67,251-310 | New admin tabs (analytics, feature toggles) added — callback handlers not fully covered. |
| `src/app/api/health/route.ts` | 90% | 61% | 100% | 90% | 79,119-136 | Database storage usage calculation — some branches for degraded state untested. |
| `src/components/admin/image-editor-dialog.tsx` | 90% | 87% | 81% | 92% | 108,360,469-479 | Drag event handlers and new crop/resize features. |
| `src/lib/i18n/detect-language.ts` | 91% | 83% | 100% | 96% | 27 | Accept-Language header edge case. |
| `src/lib/i18n/resolve.ts` | 91% | 87% | 100% | 91% | 17 | Fallback resolution edge case. |
| `src/hooks/use-reduced-motion.ts` | 92% | 50% | 100% | 100% | 14 | `matchMedia` availability check — always available in jsdom. |
| `src/app/api/favorites/route.ts` | 92% | 100% | 70% | 92% | 15-20 | Supabase SSR cookie plumbing — same as auth/callback. |
| `src/components/immersive/bookmark-button.tsx` | 92% | 91% | 100% | 100% | 19 | Minor branch in component props. |
| `src/app/sitemap.ts` | 100% | 75% | 100% | 100% | 13 | One branch uncovered but all statements/lines covered. |
| `src/proxy.ts` | 94% | 90% | 100% | 94% | 12 | Proxy configuration edge case. |
| `src/components/auth/auth-button.tsx` | 94% | 93% | 85% | 94% | 65 | Loading state variant — one branch untested. |
| `src/app/api/admin/stories/[id]/status/route.ts` | 95% | 91% | 100% | 95% | 20 | Defensive `id` emptiness check — unreachable through Next.js App Router. |
| `src/components/auth/auth-provider.tsx` | 100% | 81% | 100% | 100% | 59-61 | `signInWithGoogle` redirect URL fallback for SSR — not reachable in jsdom. |
| `src/lib/rate-limit.ts` | 96% | 81% | 100% | 96% | 52 | Map overflow pruning when exceeding 10,000 entries. |
| `src/lib/rerank.ts` | 89% | 85% | 100% | 89% | 43-44 | Reranker error fallback path. |
| `src/components/immersive/voice-chat.tsx` | 97% | 92% | 100% | 98% | 81 | Minor edge case in voice recognition. |
| `src/lib/claude.ts` | 97% | 81% | 100% | 100% | 30,90-95,105 | Some branches for API error handling uncovered. |
| `src/app/api/admin/stories/[id]/image/route.ts` | 98% | 92% | 100% | 98% | 19 | Defensive `id` emptiness check — unreachable through Next.js App Router. |
| `src/hooks/use-stories.ts` | 98% | 88% | 100% | 98% | 41 | Defensive early-return for fresh cache — unreachable because callers check staleness. |
| `src/app/api/webhooks/supabase/route.ts` | 95% | 94% | 100% | 100% | 24 | Webhook secret validation edge case. |
| `src/hooks/use-analytics.ts` | 90% | 87% | 100% | 100% | 7 | Analytics event dispatch edge case. |
| `src/lib/embedding-cache.ts` | 100% | 91% | 100% | 100% | 55 | One branch for cache eviction uncovered. |
| `src/lib/freshness.ts` | 100% | 50% | 100% | 100% | 5 | Date comparison edge case. |
| `src/lib/search.ts` | 100% | 94% | 100% | 100% | 89 | One branch in search logic uncovered. |
| `src/lib/seasonal-weighting.ts` | 100% | 83% | 100% | 100% | 12 | Seasonal date range edge case. |
| `src/lib/stories-data.ts` | 100% | 98% | 100% | 100% | 244 | One branch for fallback slug matching. |
| `src/app/api/chat/route.ts` | 100% | 90% | 100% | 100% | 69 | One branch in chat request validation. |
| `src/components/immersive/category-filter-badge.tsx` | 100% | 95% | 100% | 100% | 51,65 | Minor conditional rendering branches. |
| `src/types/admin.ts` | 100% | 66% | 100% | 100% | 35,37,40-41 | TypeScript type guard branches — runtime types match but V8 reports uncovered. |
| `src/types/immersive.ts` | 100% | 95% | 100% | 100% | 105 | One branch in type validation. |

## Tests Not Worth Writing

These are deliberately untested and considered acceptable:

1. **Supabase SSR cookie callbacks** (`auth/callback/route.ts:20-25`, `favorites/route.ts:15-20`): Internal `getAll`/`setAll` callbacks passed to `createServerClient`. These are Supabase framework plumbing that only executes during real HTTP request/response cycles. The entire `createServerClient` is mocked in tests, so these callbacks are never invoked. Would require integration tests with a real Supabase instance.

2. **Pure TypeScript type files** (`src/types/index.ts`, `src/types/analytics.ts`, `src/lib/i18n/index.ts`, `src/lib/i18n/types.ts`): No runtime code exists — interfaces and types are erased at compile time. V8 reports 0% but this is a false negative.

3. **Touch gesture handlers** (`story-viewer.tsx:313-338`): `onTouchStart`/`onTouchEnd` swipe detection. jsdom has no touch event support. Testing would require manual `TouchEvent` construction with synthetic `touches` arrays, producing brittle tests that don't validate real behavior. Better covered by E2E tests.

4. **CSS hover states** (`favorites/page.tsx`): Conditional rendering tied to mouse hover. jsdom cannot simulate CSS pseudo-states. Would need E2E/Playwright testing.

5. **SSR-only code paths** (`auth-provider.tsx:59-61`): `typeof window === "undefined"` branch for server-side rendering. jsdom always has `window` defined. Would require a separate SSR test environment configuration.

6. **Defensive unreachable guards** (`image/route.ts:19`, `status/route.ts:20`): `if (!id)` checks on App Router route params. Next.js guarantees `id` exists via the `[id]` URL pattern. These are defense-in-depth guards that can't be triggered through the framework.

7. **Rate limit map overflow** (`rate-limit.ts:52`): Pruning when map exceeds 10,000 entries. The logic is a single `map.clear()` call. Creating 10K entries in a test is expensive for negligible coverage value.

## How It Works

1. Runs `npx vitest run --coverage` to measure current coverage
2. Identifies files below 100% statement coverage
3. Reads source + test files, writes missing tests
4. Re-runs full suite to verify nothing broke
5. Updates this file with the results
6. Logs output to `logs/coverage-agent-YYYY-MM-DD.log`

Run manually anytime:
```bash
./scripts/coverage-agent.sh
```

## History

- **2026-01-26**: Initial coverage agent run -- 705 tests, 48 files
- **2026-01-28**: Post-Phase 7 refresh -- 1247 tests, 102 files
