"use client";

import { useState } from "react";
import { useFeatureFlags } from "@/hooks/use-feature-flags";
import { Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";
import { SuggestPlaceDialog } from "./suggest-place-dialog";
import { useTranslation } from "@/lib/i18n";

interface SuggestPlaceButtonProps {
  className?: string;
}

export function SuggestPlaceButton({ className }: SuggestPlaceButtonProps) {
  const { isEnabled } = useFeatureFlags();
  const { t } = useTranslation();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Don't render if feature flag is disabled (also returns false while loading)
  if (!isEnabled("user_story_suggestions")) {
    return null;
  }

  return (
    <>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsDialogOpen(true);
        }}
        data-suggest-place-trigger
        className={cn(
          "p-2 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm transition-all motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black",
          className
        )}
        aria-label={t("suggestions.suggest_place")}
        title={t("suggestions.suggest_place")}
      >
        <Lightbulb className="h-5 w-5 text-white" />
      </button>

      <SuggestPlaceDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
      />
    </>
  );
}
