"use client";

import { useState, type MouseEvent } from "react";
import { useFeatureFlags } from "@/hooks/use-feature-flags";
import { Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SuggestPlaceDialog } from "./suggest-place-dialog";
import { useTranslation } from "@/lib/i18n";

interface SuggestPlaceButtonProps {
  className?: string;
  variant?: "icon" | "menu";
  /**
   * Optional callback invoked when the button is clicked.
   * When provided, the button delegates state management to the parent
   * (lifted-state pattern) and does NOT open the built-in dialog.
   * When omitted, the button manages dialog open/close internally.
   */
  onOpen?: () => void;
}

export function SuggestPlaceButton({
  className,
  variant = "icon",
  onOpen,
}: SuggestPlaceButtonProps) {
  const { isEnabled } = useFeatureFlags();
  const { t } = useTranslation();
  // Internal dialog state — only used when onOpen is not provided
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Don't render if feature flag is disabled (also returns false while loading)
  if (!isEnabled("user_story_suggestions")) {
    return null;
  }

  const handleOpen = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (onOpen) {
      // #328: delegate to parent — no DOM coupling
      onOpen();
    } else {
      setIsDialogOpen(true);
    }
  };

  return (
    <>
      {variant === "menu" ? (
        <button
          role="menuitem"
          data-suggest-place-trigger
          onClick={handleOpen}
          className={cn(
            "flex items-center gap-3 w-full px-3 py-2 rounded-md text-white/80 hover:text-white hover:bg-white/10 transition-colors text-sm",
            className
          )}
        >
          <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
            <Lightbulb className="h-4 w-4 text-white" />
          </span>
          <span>{t("suggestions.suggest_short")}</span>
        </button>
      ) : (
        <Button
          variant="glassIcon"
          data-suggest-place-trigger
          onClick={handleOpen}
          className={cn(className)}
          aria-label={t("suggestions.suggest_place")}
          title={t("suggestions.suggest_place")}
        >
          <Lightbulb className="h-5 w-5 text-white" />
        </Button>
      )}

      {/* Only render the built-in dialog when not delegating to parent (#328) */}
      {!onOpen && (
        <SuggestPlaceDialog
          isOpen={isDialogOpen}
          onClose={() => setIsDialogOpen(false)}
        />
      )}
    </>
  );
}
