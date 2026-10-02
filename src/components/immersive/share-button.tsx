"use client";

import { Share2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { ToolbarOverflowItem } from "./toolbar-overflow-menu";
import { useShareStory } from "@/hooks/use-share-story";
import type { Story } from "@/types/immersive";

interface ShareButtonProps {
  story: Story;
  /**
   * #908/#771: "icon" is the standalone glass icon button (desktop nav).
   * "menu" renders as a ToolbarOverflowItem-style row so it can be dropped
   * directly into the mobile overflow menu, reusing the exact same share
   * logic and feedback instead of a separate, weaker inline implementation.
   */
  variant?: "icon" | "menu";
}

export function ShareButton({ story, variant = "icon" }: ShareButtonProps) {
  const { t } = useTranslation();
  const { toast, handleShare } = useShareStory(story);

  const onClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    handleShare();
  };

  if (variant === "menu") {
    return (
      <ToolbarOverflowItem
        icon={
          toast ? (
            <Check className="h-4 w-4 animate-in fade-in zoom-in duration-200" />
          ) : (
            <Share2 className="h-4 w-4" />
          )
        }
        // Regression risk from #908: the icon variant's toast is an
        // absolutely-positioned popover anchored to its own trigger button,
        // which would clip inside the overflow menu's constrained popover.
        // Swapping the row's own label in place — instead of layering a
        // second popover — avoids that clipping without needing a portal.
        label={<span role="status">{toast || t("share.share")}</span>}
        onClick={handleShare}
      />
    );
  }

  return (
    <div className="relative">
      <Button
        variant="glassIcon"
        onClick={onClick}
        aria-label={t("share.share")}
        title={t("share.share")}
      >
        {toast ? (
          <Check className="h-5 w-5 text-white animate-in fade-in zoom-in duration-200" />
        ) : (
          <Share2 className="h-5 w-5 text-white" />
        )}
      </Button>

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
