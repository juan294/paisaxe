"use client";

import { useState, useRef } from "react";
import { Share2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAnalytics } from "@/hooks/use-analytics";
import { useTranslation } from "@/lib/i18n";
import type { Story } from "@/types/immersive";

interface ShareButtonProps {
  story: Story;
}

export function ShareButton({ story }: ShareButtonProps) {
  const { trackEvent } = useAnalytics();
  const { t } = useTranslation();
  const [toast, setToast] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (message: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast(message);
    timerRef.current = setTimeout(() => setToast(null), 1500);
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();

    const shareUrl = `${window.location.origin}/story/${story.slug || story.id}`;
    const shareData = {
      title: story.title,
      text: `${story.title} - ${story.subtitle}`,
      url: shareUrl,
    };

    const isTouchDevice = window.matchMedia("(pointer: coarse)").matches;

    try {
      if (isTouchDevice && navigator.share && navigator.canShare?.(shareData)) {
        await navigator.share(shareData);
        trackEvent("story_share", "story_sharing", { storyId: story.id, shareMethod: "native" });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        showToast(t("share.link_copied"));
        trackEvent("story_share", "story_sharing", { storyId: story.id, shareMethod: "clipboard" });
      }
    } catch (err) {
      // User cancelled share or clipboard failed - try clipboard as fallback
      if ((err as Error).name !== "AbortError") {
        try {
          await navigator.clipboard.writeText(shareUrl);
          showToast(t("share.link_copied"));
          trackEvent("story_share", "story_sharing", { storyId: story.id, shareMethod: "clipboard" });
        } catch {
          // Silently ignore
        }
      }
    }
  };

  return (
    <div className="relative">
      <button
        onClick={handleShare}
        className="p-2 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm transition-all"
        title={t("share.share")}
      >
        <Share2 className="h-5 w-5 text-white" />
      </button>

      {/* Toast */}
      <div
        role="status"
        className={cn(
          "absolute top-full left-1/2 -translate-x-1/2 mt-2",
          "px-3 py-1.5 rounded-lg",
          "bg-black/80 backdrop-blur-sm",
          "text-xs text-white font-medium whitespace-nowrap",
          "transition-opacity duration-300 ease-out",
          toast
            ? "opacity-100"
            : "opacity-0 pointer-events-none",
        )}
      >
        {toast}
      </div>
    </div>
  );
}
