# Phase 2: Fix Chat Panel E2E + ElevenLabs Prefetch `[batch-eligible]`

> **Files**: `src/components/immersive/voice-chat.tsx`, `src/app/immersive/immersive-page-content.tsx`, `e2e/qa-journey.spec.ts`
> **Estimated effort**: Small-Medium

## Problem

Three E2E journeys (3, 7, 14) fail because the chat panel can't be found:
1. **Selector brittleness**: Tests use `.fixed.inset-0.z-50` CSS class selector
2. **Dynamic import latency**: VoiceChat loads 482 KB on first click — 5s timeout often insufficient
3. **No loading indicator**: `loading: () => null` means nothing renders during chunk download

## Changes

### 1. Add `data-testid` to chat panel root — `voice-chat.tsx:161`

```pseudo
  <div
    ref={dialogRef}
+   data-testid="chat-panel"
    className="fixed inset-0 z-50 flex items-end justify-center p-4 md:items-center"
    role="dialog"
    aria-label={...}
  >
```

### 2. Add idle prefetch for VoiceChat — `immersive-page-content.tsx`

After the existing VoiceChat dynamic import declaration (~line 28), add an idle-time prefetch:

```pseudo
+ // Prefetch the voice chat chunk during browser idle time
+ // so it's ready when the user clicks "Ask"
+ useEffect(() => {
+   if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
+     const id = requestIdleCallback(() => {
+       import("@/components/immersive/voice-chat");
+     });
+     return () => cancelIdleCallback(id);
+   }
+ }, []);
```

This preloads the 482 KB ElevenLabs chunk during idle time, eliminating cold-start latency.

### 3. Update E2E selectors and timeouts — `e2e/qa-journey.spec.ts`

**Journey 3** (~line 121):
```pseudo
- const chatPanel = page.locator(".fixed.inset-0.z-50");
- await expect(chatPanel).toBeVisible();
+ const chatPanel = page.locator('[data-testid="chat-panel"]');
+ await expect(chatPanel).toBeVisible({ timeout: 15000 });
```

**Journey 7** (~line 250): Same selector update.

**Journey 14** (~line 365): Same selector update.

## Verification

```bash
npx playwright test qa-journey --grep "Journey 3|Journey 7|Journey 14"
```

All three journeys should pass with the new selector and increased timeout.

## Notes

- `requestIdleCallback` is supported in all modern browsers; Safari added support in 16.4 (2023)
- The prefetch is fire-and-forget — if it doesn't complete before the user clicks, the normal dynamic import path still works
- The 15s timeout is a safety margin; with prefetch, actual load should be <2s
- The existing `data-testid="story-info-panel"` on the article element (story-viewer.tsx:300) confirms this project already uses data-testid conventions
