"use client";

import { useState, useRef } from "react";
import { Share2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";
import type { Story } from "@/types/immersive";

interface ShareButtonProps {
  story: Story;
}

export function ShareButton({ story }: ShareButtonProps) {
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
      } else {
        try {
          await navigator.clipboard.writeText(shareUrl);
          showToast(t("share.link_copied"));
        } catch {
          // UX-L3 (#523): Show error feedback when clipboard fails on desktop
          showToast(t("share.copy_error"));
        }
      }
    } catch (err) {
      // User cancelled share or clipboard failed - try clipboard as fallback
      if ((err as Error).name !== "AbortError") {
        try {
          await navigator.clipboard.writeText(shareUrl);
          showToast(t("share.link_copied"));
        } catch {
          // UX-L3 (#523): Show error feedback instead of silently ignoring
          showToast(t("share.copy_error"));
        }
      }
    }
  };

  return (
    <div className="relative">
      <button
        onClick={handleShare}
        className="p-3 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm transition-all motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
        aria-label={t("share.share")}
        title={t("share.share")}
      >
        {toast ? (
          <Check className="h-5 w-5 text-white animate-in fade-in zoom-in duration-200" />
        ) : (
          <Share2 className="h-5 w-5 text-white" />
        )}
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
