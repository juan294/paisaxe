"use client";

import { useCallback } from "react";
import { useTimedValue } from "./use-timed-value";
import { useTranslation } from "@/lib/i18n";
import { getLocalizedStory } from "@/lib/localize-story";
import { useIsFinePointer } from "@/hooks/use-media-query";
import type { Story } from "@/types/immersive";

/**
 * #908/#771: single source of truth for sharing a story.
 *
 * Previously this logic was duplicated in two places with divergent
 * behaviour: the desktop `ShareButton` component and an inline handler in
 * story-viewer.tsx's mobile overflow menu. The mobile copy skipped
 * localization on one code path, had no feedback on clipboard failure, and
 * never handled a native-share rejection (including user cancellation).
 * Both call sites now use this hook so there is exactly one share
 * behaviour, in the user's language, with consistent feedback.
 *
 * The touch-vs-desktop branch inside `handleShare` is intentional and
 * preserved from the original desktop component — it isn't "the desktop
 * implementation" vs "the mobile implementation", it's a single implementation
 * that picks native share vs. clipboard based on the input device, which is
 * exactly the behaviour both call sites need.
 */
export function useShareStory(story: Story) {
  const { t, locale } = useTranslation();
  const { value: toast, show: showToast, clear: clearToast, startIntent } = useTimedValue<string>(
    1500, JSON.stringify([story.id, story.slug ?? null, locale])
  );
  // FE-M6 (#768): reuse the existing hydration-safe pointer-type hook instead
  // of re-querying matchMedia inline — one source of truth for pointer detection.
  const isFinePointer = useIsFinePointer();

  const handleShare = useCallback(async () => {
    const isCurrent = startIntent();
    if (!isCurrent()) return;
    // UX-H6 (#892): route through getLocalizedStory so a non-Spanish visitor
    // shares their own language's title/subtitle, not the raw Spanish text.
    const { title, subtitle } = getLocalizedStory(story, locale);
    const shareUrl = `${window.location.origin}/story/${story.slug || story.id}`;
    const shareData = {
      title,
      text: `${title} - ${subtitle}`,
      url: shareUrl,
    };

    const isTouchDevice = !isFinePointer;

    try {
      if (isTouchDevice && navigator.share && navigator.canShare?.(shareData)) {
        await navigator.share(shareData);
      } else {
        try {
          await navigator.clipboard.writeText(shareUrl);
          if (isCurrent()) showToast(t("share.link_copied"));
        } catch {
          // UX-L3 (#523): show error feedback when clipboard fails.
          if (isCurrent()) showToast(t("share.copy_error"));
        }
      }
    } catch (err) {
      // User cancelled share or clipboard failed - try clipboard as fallback
      if (isCurrent() && (err as Error).name !== "AbortError") {
        try {
          await navigator.clipboard.writeText(shareUrl);
          if (isCurrent()) showToast(t("share.link_copied"));
        } catch {
          // UX-L3 (#523): show error feedback instead of silently ignoring.
          if (isCurrent()) showToast(t("share.copy_error"));
        }
      }
    }
  }, [story, locale, t, showToast, isFinePointer, startIntent]);

  return { toast, handleShare, clearToast };
}
