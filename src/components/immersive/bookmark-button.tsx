"use client";

import { useTimedValue } from "@/hooks/use-timed-value";
import { useRouter } from "next/navigation";
import { Bookmark } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";
import { Button } from "@/components/ui/button";

interface BookmarkButtonProps {
  /** Whether this navigates to /favorites (true) or toggles favorite status (false) */
  isNavigationMode?: boolean;
  /** Whether auth is required (user not logged in) */
  requiresAuth?: boolean;
  /** Called when auth is required and button is clicked */
  onAuthRequired?: () => void;
  /** Whether the current item is favorited (for toggle mode) */
  isFavorite?: boolean;
  /** Toggle callback (for toggle mode) */
  onToggle?: () => void;
  /** Block activation while the caller verifies authentication. */
  disabled?: boolean;
}

export function BookmarkButton({
  isNavigationMode = false,
  requiresAuth = false,
  onAuthRequired,
  isFavorite = false,
  onToggle,
  disabled = false,
}: BookmarkButtonProps) {
  const { value: toast, show: showToast } = useTimedValue<string>(1500);
  const router = useRouter();
  const { t } = useTranslation();

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    // If auth required, trigger sign-in
    if (requiresAuth) {
      onAuthRequired?.();
      return;
    }

    if (isNavigationMode) {
      // Navigate to favorites page
      router.push("/favorites");
    } else {
      // Toggle mode - show toast and call toggle
      showToast(isFavorite ? t("favorites.removed") : t("favorites.saved_toast"));
      onToggle?.();
    }
  };

  // Determine label based on mode
  const label = isNavigationMode
    ? t("favorites.bookmarks")
    : isFavorite
      ? t("favorites.remove_saved")
      : t("favorites.add_saved");

  return (
    <div className="relative">
      <Button
        variant="glassIcon"
        disabled={disabled}
        onClick={handleClick}
        aria-label={label}
        title={label}
      >
        <Bookmark
          className={cn(
            "h-5 w-5 text-white transition-all",
            !isNavigationMode && isFavorite && "fill-white"
          )}
        />
      </Button>

      {/* Toast - only show in toggle mode */}
      {!isNavigationMode && (
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
      )}
    </div>
  );
}
