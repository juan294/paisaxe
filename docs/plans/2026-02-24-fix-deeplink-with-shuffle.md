# Plan: Fix Deep-Link Story Index When Shuffle Is Active

> Created: 2026-02-24 | Single phase — no phase files needed

## Problem

When `randomized_order` is enabled and a user opens a shared link like `/immersive?story=lagos-covadonga`:

1. `allStories` = stories from DB in `display_order` order: `[Lagos(0), Oviedo(1), Gijon(2), ...]`
2. `filteredStories` = shuffled order: `[Gijon(0), Lagos(1), Oviedo(2), ...]`
3. The deep-link effect (`immersive-page-content.tsx:72-83`) searches `allStories` for the slug → finds index `0`
4. `setCurrentIndex(0)` is called
5. But `filteredStories[0]` is **Gijon**, not Lagos — the user lands on the wrong story

The root cause: `currentIndex` is used to index into `filteredStories` (line 142), but the deep-link effect finds the index in `allStories` (line 75).

## Fix

Change the deep-link effect to search `filteredStories` instead of `allStories`, and add a `useRef` guard to prevent re-running when filters change later in the session.

### Files Changed

**`src/app/immersive/immersive-page-content.tsx`**

```
// Add ref declaration after line 48 (the useTransition line):
+ const deepLinkHandled = useRef(false);

// Replace lines 70-83 (the deep-link useEffect):
- useEffect(() => {
-   const storySlug = searchParams.get("story");
-   if (storySlug && allStories.length > 0) {
-     const index = allStories.findIndex((s) => s.slug === storySlug || s.id === storySlug);
-     if (index >= 0) {
-       setCurrentIndex(index);
-       if (searchParams.get("voice") === "ready") {
-         setChatOpen(true);
-       }
-     }
-   }
- }, [searchParams, allStories]);

+ useEffect(() => {
+   const storySlug = searchParams.get("story");
+   if (storySlug && filteredStories.length > 0 && !deepLinkHandled.current) {
+     const index = filteredStories.findIndex((s) => s.slug === storySlug || s.id === storySlug);
+     if (index >= 0) {
+       deepLinkHandled.current = true;
+       setCurrentIndex(index);
+       if (searchParams.get("voice") === "ready") {
+         setChatOpen(true);
+       }
+     }
+   }
+ }, [searchParams, filteredStories]);
```

Note: `filteredStories` is already in scope — it comes from `useStoryFilters(processedStories)` at line 119-128. However, the deep-link effect currently runs *before* the `useStoryFilters` call in the source. The effect declaration order doesn't matter for React hooks (effects run after render, not inline), but for readability we should move the effect to after the `useStoryFilters` destructuring. We'll place it right after line 128.

**`src/app/immersive/immersive-page-content.test.tsx`**

Update the existing deep-link test (lines 233-248) to verify the fix works with shuffled stories:

```
// Modify existing test: "?story= query param sets initial index"
// The mock currently uses `allStories` order for both useStories and useStoryFilters.
// Add a new test that verifies correct behavior when filteredStories is in a different order.

+ it("?story= query param finds story in shuffled filteredStories", () => {
+   setupDefaults();
+   // Simulate shuffled order: oviedo-cathedral is now at index 0
+   const shuffledStories = [mockStories[1], mockStories[0]];
+   vi.mocked(useStoryFilters).mockReturnValue({
+     ...defaultFiltersMock(shuffledStories),
+   });
+   vi.mocked(useSearchParams).mockReturnValue({
+     get: (key: string) => (key === "story" ? "oviedo-cathedral" : null),
+     toString: () => "",
+   } as unknown as ReturnType<typeof useSearchParams>);
+
+   render(<ImmersivePageContent serverShuffleSeed={42} />);
+
+   const viewer = screen.getByTestId("story-viewer");
+   // oviedo-cathedral is at index 0 in the shuffled filteredStories
+   expect(viewer).toHaveAttribute("data-index", "0");
+ });
```

Also update the existing test (line 236-248) to remain valid — it still works because without shuffle, `allStories` order === `filteredStories` order, so index 1 is correct.

## Test Strategy

### Red (write first)
1. New test: deep-link with shuffled `filteredStories` — asserts the story lands at its index in the shuffled array, not the DB array.
2. New test: deep-link effect does not re-run when filters change after initial deep-link handling.

### Green
3. Apply the code change to `immersive-page-content.tsx`.

### Verify
4. Run `npm run test` — all existing tests pass.
5. Run `npm run typecheck` and `npm run lint`.

## Success Criteria

### Automated
- [ ] New test: deep-linked story resolves to correct index in shuffled `filteredStories`
- [ ] New test: deep-link effect fires only once (doesn't reset index on filter change)
- [ ] Existing test: `?story= query param sets initial index` still passes (unshuffled case)
- [ ] Full test suite green
- [ ] TypeScript compiles, lint passes

### Manual (optional verification)
- Enable `randomized_order` flag → open `/immersive?story=oviedo-cathedral` → lands on Oviedo Cathedral regardless of shuffle order
