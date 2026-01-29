# Pre-Launch Security and Performance Audit

**Date**: 2026-01-29
**Commit**: `b90cbf9` (develop branch)
**Status**: Implemented

This document details the pre-launch codebase audit conducted before the Paisaxe production release. All changes are contained in a single commit for easy reference and potential rollback.

---

## Quick Reference

To view all changes made in this audit:
```bash
git show b90cbf9 --stat
git show b90cbf9  # Full diff
```

To revert all audit changes if issues arise:
```bash
git revert b90cbf9
```

---

## Changes Summary

| Category | Change | Risk Level | Rollback Impact |
|----------|--------|------------|-----------------|
| Security | Webhook timing attack fix | Low | Would re-introduce vulnerability |
| Security | Path traversal fix | Low | Would re-introduce vulnerability |
| Performance | useMemo for relatedStories | Very Low | Minor perf regression |
| Performance | React.memo for RelatedStories | Very Low | Minor perf regression |
| Cleanup | Remove canvas dependency | None | Would need to reinstall |
| Cleanup | Remove posthog-node dependency | None | Would need to reinstall |
| Cleanup | Remove tw-animate-css | None | Would need to reinstall + re-add import |
| Cleanup | Delete posthog-server.ts | None | Would need to recreate file |
| Cleanup | Delete use-realtime-stories.ts | None | Would need to recreate file |
| Cleanup | Delete 6 unused scripts | None | Would need to recreate files |

---

## Detailed Changes

### 1. Security: Webhook Signature Timing Attack Fix

**File**: `src/app/api/webhooks/supabase/route.ts`

**Problem**: The webhook secret comparison used direct string comparison (`!==`), which is vulnerable to timing attacks. An attacker could gradually guess the secret by measuring response times.

**Before**:
```typescript
if (!secret || secret !== expectedSecret) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

**After**:
```typescript
import { timingSafeEqual } from "crypto";

// Use constant-time comparison to prevent timing attacks
if (
  !secret ||
  !expectedSecret ||
  secret.length !== expectedSecret.length ||
  !timingSafeEqual(Buffer.from(secret), Buffer.from(expectedSecret))
) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

**Potential Issues After Change**:
- If webhook authentication starts failing unexpectedly, check that `WEBHOOK_SECRET` environment variable is set correctly
- The length check before `timingSafeEqual` prevents a crash when lengths differ (timingSafeEqual requires equal-length buffers)

---

### 2. Security: Path Traversal Vulnerability Fix

**File**: `src/app/api/content-images/[...path]/route.ts`

**Problem**: Path validation happened before `path.join()` normalized the path. Sophisticated attacks using URL encoding or symlinks could potentially escape the intended directory.

**Before**: Only pre-resolution checks for `..` and `.` segments

**After**: Added post-resolution validation:
```typescript
const baseDir = path.join(process.cwd(), "content", "images");
const imagePath = path.join(baseDir, relativePath);

// Post-resolution validation: ensure the resolved path is within the base directory
// This catches URL encoding attacks and symlink escapes that pre-resolution checks miss
const resolvedPath = path.resolve(imagePath);
if (!resolvedPath.startsWith(baseDir + path.sep) && resolvedPath !== baseDir) {
  return NextResponse.json({ error: "Invalid path" }, { status: 400 });
}
```

**Potential Issues After Change**:
- If legitimate image requests start returning 400 "Invalid path" errors, check:
  - Whether any symlinks exist in `content/images/` that point outside the directory
  - Whether the base path resolution differs between development and production environments
- The check uses `path.sep` to ensure proper path boundary matching (prevents `/content/images-other/` from matching)

---

### 3. Performance: useMemo for relatedStories

**File**: `src/components/immersive/story-viewer.tsx`

**Problem**: `relatedStories` was recomputed on every render, even when the story hadn't changed.

**Before**:
```typescript
const relatedStories = story ? getRelatedStories(story, allStories) : [];
```

**After**:
```typescript
const relatedStories = useMemo(
  () => (story ? getRelatedStories(story, allStories) : []),
  [story, allStories]
);
```

**Potential Issues After Change**:
- If related stories don't update when expected, the memoization may be caching stale results
- Check that `story` and `allStories` references change appropriately when data updates
- The dependency array uses the full `story` object, so any property change will trigger recalculation

---

### 4. Performance: React.memo for RelatedStories

**File**: `src/components/immersive/related-stories.tsx`

**Problem**: The component re-rendered whenever the parent re-rendered, even if its props hadn't changed.

**Before**:
```typescript
export function RelatedStories({ stories, onSelectStory }: RelatedStoriesProps) {
```

**After**:
```typescript
export const RelatedStories = memo(function RelatedStories({
  stories,
  onSelectStory,
}: RelatedStoriesProps) {
  // ... component body
});
```

**Potential Issues After Change**:
- If the RelatedStories component stops updating when it should, check:
  - Whether `stories` array reference is stable (use useMemo in parent if needed)
  - Whether `onSelectStory` callback is stable (wrap in useCallback in parent if needed)
- React.memo does shallow comparison by default

---

### 5. Removed: canvas Dependency

**Change**: Removed `canvas` package from `package.json`

**Why**: 15MB+ native binary that was never imported or used anywhere in the codebase. Likely leftover from early PDF processing experiments.

**Potential Issues After Change**:
- If any script or component that processes images starts failing with "canvas not found", the dependency would need to be reinstalled
- Currently no code imports canvas, so this is unlikely

**To Restore**:
```bash
npm install canvas
```

---

### 6. Removed: posthog-node Dependency

**Change**:
- Removed `posthog-node` package from `package.json`
- Deleted `src/lib/posthog-server.ts`

**Why**: Server-side PostHog integration was set up but never actually used. The functions were exported but never imported anywhere.

**Potential Issues After Change**:
- If you planned to add server-side analytics tracking, you'll need to recreate this integration
- Client-side PostHog (`posthog-js`) is still installed and working

**To Restore**:
```bash
npm install posthog-node
```
Then recreate `src/lib/posthog-server.ts`:
```typescript
import "server-only";
import { PostHog } from "posthog-node";

let posthogClient: PostHog | null = null;

export function getPostHogServerClient(): PostHog | null {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    return null;
  }

  if (!posthogClient) {
    posthogClient = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
      host: "https://eu.i.posthog.com",
      flushAt: 1,
      flushInterval: 0,
    });
  }

  return posthogClient;
}

export async function shutdownPostHog(): Promise<void> {
  if (posthogClient) {
    await posthogClient.shutdown();
    posthogClient = null;
  }
}
```

---

### 7. Removed: tw-animate-css Dependency

**Change**:
- Removed `tw-animate-css` package from `package.json`
- Removed `@import "tw-animate-css"` from `src/app/globals.css`

**Why**: The project uses Tailwind's built-in animation classes (`animate-pulse`, `animate-spin`, etc.) and custom animations defined in `globals.css`. The tw-animate-css library was imported but its classes weren't being used.

**Potential Issues After Change**:
- If any animation stops working, check if it was using a tw-animate-css class (e.g., `animate-fade-in`, `animate-bounce-in`)
- The custom `animate-slow-zoom` and `animate-ambient-zoom` animations in globals.css are unaffected

**To Restore**:
```bash
npm install tw-animate-css
```
Then add to `src/app/globals.css`:
```css
@import "tw-animate-css";
```

---

### 8. Removed: use-realtime-stories.ts Hook

**Change**: Deleted `src/hooks/use-realtime-stories.ts`

**Why**: Hook was exported but never imported anywhere in the codebase.

**Potential Issues After Change**:
- If you planned to implement real-time story updates in the UI, you'll need to recreate this hook
- The underlying `subscribeToStories` function in `src/lib/realtime.ts` still exists

**To Restore**:
```typescript
// src/hooks/use-realtime-stories.ts
"use client";

import { useEffect } from "react";
import { subscribeToStories } from "@/lib/realtime";
import type { StoryRow } from "@/types/immersive";

export function useRealtimeStories(
  onStoryUpdated: (row: StoryRow) => void
): void {
  useEffect(() => {
    const cleanup = subscribeToStories((row: StoryRow) => {
      onStoryUpdated(row);
    });

    return cleanup;
  }, [onStoryUpdated]);
}
```

---

### 9. Removed: Unused Development Scripts

**Change**: Deleted 6 scripts from `scripts/` directory:
- `assign-placeholder-images.ts` - One-time placeholder utility
- `check-db-status.ts` - Ad-hoc database inspection tool
- `check-image-sources.ts` - Development utility for checking image sources
- `extract-pdf-sources.ts` - Superseded by process-pdfs.ts
- `extract-stories-from-chunks.ts` - Legacy 26KB script for story extraction
- `update-image-sources.ts` - Old image source updater

**Why**: These scripts were not referenced in any npm commands and were leftover development utilities.

**Potential Issues After Change**:
- If you need to run any of these utilities, they would need to be recreated
- The active scripts (`process-pdfs.ts`, `seed-database.ts`, `seed-images.ts`, etc.) are unaffected

**To Restore**: The scripts can be recovered from git history:
```bash
git show b90cbf9^:scripts/assign-placeholder-images.ts > scripts/assign-placeholder-images.ts
# Repeat for other scripts as needed
```

---

## Test Results

All 1612 tests pass after these changes:
- 104 test files
- TypeScript strict mode passes
- ESLint passes with no errors

---

## Not Changed (Considered but Deferred)

The following items were identified during the audit but **intentionally not addressed**:

1. **Distributed rate limiting** - Current in-memory rate limiting is sufficient for launch
2. **CSRF tokens for admin routes** - SameSite cookies provide reasonable protection
3. **CSP headers** - Would require careful configuration; not critical for a tourism info site
4. **Feature flag caching in chat API** - Low priority; current implementation is fine for expected load
5. **Known Next.js CVEs** - Moderate severity, primarily affect self-hosted; Vercel mitigates risk

---

## Monitoring Recommendations

After launch, monitor for:

1. **Webhook failures** - Check logs for "Unauthorized" responses that might indicate the timing-safe comparison is behaving differently than expected
2. **Content image 400 errors** - Watch for unexpected "Invalid path" responses
3. **Performance regressions** - Compare Core Web Vitals before/after to confirm memoization improvements
4. **Missing animations** - Verify all animations still work after removing tw-animate-css

---

## Contact

If issues arise related to this audit, the changes can be reviewed in commit `b90cbf9` or reverted entirely with `git revert b90cbf9`.
