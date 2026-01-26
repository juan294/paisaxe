"use client";

import { Share2 } from "lucide-react";
import { useAnalytics } from "@/hooks/use-analytics";
import type { Story } from "@/types/immersive";

interface ShareButtonProps {
  story: Story;
}

export function ShareButton({ story }: ShareButtonProps) {
  const { trackEvent } = useAnalytics();

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();

    const shareUrl = `${window.location.origin}/story/${story.slug || story.id}`;
    const shareData = {
      title: story.title,
      text: `${story.title} - ${story.subtitle}`,
      url: shareUrl,
    };

    try {
      if (navigator.share && navigator.canShare?.(shareData)) {
        await navigator.share(shareData);
        trackEvent("story_share", "story_sharing", { storyId: story.id, shareMethod: "native" });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        trackEvent("story_share", "story_sharing", { storyId: story.id, shareMethod: "clipboard" });
      }
    } catch (err) {
      // User cancelled share or clipboard failed - try clipboard as fallback
      if ((err as Error).name !== "AbortError") {
        try {
          await navigator.clipboard.writeText(shareUrl);
          trackEvent("story_share", "story_sharing", { storyId: story.id, shareMethod: "clipboard" });
        } catch {
          // Silently ignore
        }
      }
    }
  };

  return (
    <button
      onClick={handleShare}
      className="p-2 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm transition-all"
      title="Compartir"
    >
      <Share2 className="h-5 w-5 text-white" />
    </button>
  );
}
