# Code Quality Report (ARCHIVED)

> **ARCHIVED**: This standalone report has been consolidated into the unified Codebase Health Check.
> See `docs/health-report-[DATE].md` for the latest code quality data.
> This file is kept for historical reference only and is no longer updated.

> Generated on 2026-02-09 (final standalone run)

## Summary

- Dead code items found: **17** (11 barrel re-exports, 5 dead type re-exports, 1 commented-out import)
- Pattern violations: **6** duplicated logic patterns
- Complexity hotspots: **7** monolith components, **27** files over 300 lines

## Dead Code

### Unused Barrel Exports — `src/components/admin/marketing-dashboard/index.ts`
11 re-exports that are never imported externally. Only `MarketingDashboard` is used outside the module.

**Fix:** Remove lines 2-14, keep only the `MarketingDashboard` export.

Exports to remove: `AccountCard`, `AccountConfigDialog`, `PostRow`, `StatCard`, `DraftsPanel`, `CreateDraftDialog`, `PLATFORM_BADGES`, `PLATFORM_NAMES`, `PLATFORM_CREDENTIALS`, `DAY_NAMES`, `statColorClasses`.

### Dead Type Re-exports — `src/components/admin/story-editor-dialog/types.ts:53`
5 types re-exported but consumers import from canonical locations (`@/types/admin`, `@/types/immersive`):
`CurationStatus`, `ContentImage`, `StoryCategory`, `StoryLocation`, `StoryDuration`.

**Fix:** Remove the re-export line.

### Same-file-only Exported Types (7 items, style issue)
Types exported but only used within the same file. Low impact — remove `export` or keep for API documentation:
- `UseStoryFiltersReturn` in `src/hooks/use-story-filters.ts:4`
- `ChatActionsResult` in `src/lib/chat-action-detection.ts:22`
- `TopicRelevance` in `src/lib/chat-safety.ts:13`
- `UpsellDetectionResult` in `src/lib/chat-upsell-detection.ts:13`
- `SendEmailOptions` in `src/lib/email.ts:19`
- `SendSMSResult` in `src/lib/twilio-sms.ts:25`
- `ValidationResult` in `src/lib/validation.ts:16`

### Commented-Out Code (1 instance)
- `src/components/immersive/author-typewriter.test.tsx:5-6` — commented-out import with explanation. Tests use dynamic `await import()` instead. Safe to remove both lines.

### Stale TODOs
**None.** Only 1 TODO found (`next.config.ts:59` — CSP nonce migration) and it's 1 day old.

### Unused Files / Dependencies
**None.** Codebase is clean.

## Pattern Violations

### 1. Duplicated `getClientIp` / IP Extraction (5 files)
IP address extraction logic duplicated with slight variations:
- `src/app/api/chat/route.ts:44` — basic `x-forwarded-for` only
- `src/app/api/chat/stream/route.ts:31` — same basic pattern
- `src/app/api/suggestions/route.ts:14-16` — adds `x-real-ip` fallback
- `src/app/api/mcp/weather/route.ts:125-131` — full `getClientIp` function
- `src/app/api/mcp/places/route.ts:275-281` — identical `getClientIp` function

**Fix:** Extract to `src/lib/request-utils.ts` with `x-real-ip` fallback included.

### 2. Supabase Admin Client — 3 Different Creation Patterns (4 files)
- Canonical: `createAdminClient()` from `src/lib/supabase.ts`
- Custom: `getSupabaseAdmin()` in `src/lib/costs/manual-costs.ts:11-20`
- Inline: Direct `createClient()` in `src/app/api/admin/github-analytics/route.ts:26`, `src/app/api/cron/github-traffic-sync/route.ts:88`, `src/app/api/cron/content-discovery/route.ts:64`

**Fix:** Consolidate all to use `createAdminClient()` from `supabase.ts`.

### 3. `formatForHogQL` Duplicated (2 files)
- `src/app/api/admin/analytics/route.ts:75`
- `src/app/api/admin/costs-analytics/route.ts:211`

**Fix:** Extract to `src/lib/posthog-query.ts` (which already exists).

### 4. `ELEVENLABS_API_BASE` Duplicated (2 files)
- `src/app/api/admin/elevenlabs-analytics/route.ts:12`
- `src/app/api/admin/costs-analytics/route.ts:180`

**Fix:** Extract to `src/config/elevenlabs-agents.ts` or a shared constants file.

### 5. `VALID_CATEGORIES` Duplicated (2 files)
- `src/app/api/admin/stories/route.ts:12-18`
- `src/app/api/admin/stories/[id]/route.ts:6-12`

**Fix:** Export from `@/types/immersive` alongside the existing `StoryCategory` type.

### 6. Minor: Relative Import in Same-Directory File
- `src/lib/posting-service.ts:9` uses `./supabase` while other lib files use `@/lib/supabase`

**Fix:** Change to `@/lib/supabase` for consistency.

### Patterns That Are Clean
- **Naming conventions**: All consistent (PascalCase components, camelCase utils, kebab-case files)
- **Auth patterns**: 3 distinct patterns (admin, user, MCP) all used correctly and consistently
- **Component structure**: Consistent `"use client"` → imports → types → component → export
- **TypeScript strictness**: Excellent — zero `: any` in code, zero `@ts-ignore`, non-null assertions only in tests
- **Error response format**: All API routes return `{ error: "message" }` consistently
- **Import aliases**: `@/` used consistently for cross-directory imports

## Complexity Hotspots

### Monolith Components (7 components needing decomposition)

| Component | Lines | useState | Key Problem |
|-----------|-------|----------|-------------|
| `ImageEditorDialog` | 636 | 14 | 3 tabs, fullscreen, drag-drop, search — all in one component |
| `AdminPageContent` | 591 | 14 | Auth, routing, CRUD, bulk ops, search, 6 tab panels |
| `StoryViewer` | 519 | 5 | Navigation, gestures, filters, toolbar, related stories |
| `VoiceAgentChat` | 431 | 10 | WebSocket lifecycle + message streaming + UI rendering |
| `SuggestionsPanel` | 403 | 9 | CRUD + pagination + filtering + status management |
| `CreateStoryDialog` | 394 | 14 | Multi-step form + image handling + validation |
| `FeatureTogglesPanel` | 336 | 9 | Feature flag CRUD + environment switching |

### Prop Drilling (systemic issue)
State extracted to parent but drilled down through excessive props:
- `ImageTab`: **25 props** — worst case
- `DetailsTab`: **20 props**
- `StoryViewer`: **14 props**

**Root cause:** Components were partially decomposed (UI extracted) but state stayed in the parent, creating massive prop lists instead of using Context or composition.

### Deep Nesting (worst offenders)
- **5 levels**: `src/lib/claude.ts:116` — curl process callback chain for SSE parsing
- **4 levels**: `src/lib/costs/tier-alerts.ts:73`, `src/lib/claude.ts:123`, `image-editor-dialog.tsx:173`

### Large Files (top 5)
| Lines | File | Description |
|-------|------|-------------|
| 814 | `admin/page.tsx` | Admin page monolith |
| 811 | `visitors-analytics-panel.tsx` | Visitors analytics |
| 696 | `stripe-analytics-panel.tsx` | Stripe analytics |
| 681 | `image-editor-dialog.tsx` | Image editor |
| 574 | `story-viewer.tsx` | Story viewer |

### Long Functions (top 5)
| Lines | Function | File |
|-------|----------|------|
| 636 | `ImageEditorDialog` | `image-editor-dialog.tsx` |
| 591 | `AdminPageContent` | `admin/page.tsx` |
| 519 | `StoryViewer` | `story-viewer.tsx` |
| 431 | `VoiceAgentChat` | `voice-agent-chat.tsx` |
| 403 | `SuggestionsPanel` | `suggestions-panel.tsx` |

## Recommended Actions

### Top 5 Most Impactful Improvements (ordered by effort-to-impact ratio)

1. **Extract `getClientIp` to shared utility** — Touches 5 files, eliminates inconsistent IP extraction, 15 min fix.

2. **Consolidate Supabase admin client** — 4 files creating their own client. Change to `createAdminClient()` from `supabase.ts`. 20 min fix.

3. **Clean up barrel exports** — Remove 11 dead re-exports from marketing-dashboard/index.ts and 5 dead type re-exports. 5 min fix.

4. **Extract shared constants** — `formatForHogQL`, `ELEVENLABS_API_BASE`, `VALID_CATEGORIES` duplicated across files. 15 min fix.

5. **Decompose `ImageEditorDialog`** — Largest complexity hotspot. Extract `useImageEditor` hook and have `ImageTab` consume it via context instead of 25 props. 1-2 hour refactor, but eliminates the worst prop drilling and the largest monolith in the codebase.

### Not Recommended Right Now
- Decomposing analytics panels (they're large but read-only dashboards — complexity is inherent)
- Refactoring `claude.ts` nesting (inherent to callback-based streaming APIs)
- Removing same-file-only exports (purely cosmetic)
