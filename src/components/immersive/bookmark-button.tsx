"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Bookmark } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";

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
}

export function BookmarkButton({
  isNavigationMode = false,
  requiresAuth = false,
  onAuthRequired,
  isFavorite = false,
  onToggle,
}: BookmarkButtonProps) {
  const [toast, setToast] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();
  const { t } = useTranslation();

  const showToast = (message: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast(message);
    timerRef.current = setTimeout(() => setToast(null), 1500);
  };

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
      <button
        onClick={handleClick}
        className="p-2 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm transition-all motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
        aria-label={label}
        title={label}
      >
        <Bookmark
          className={cn(
            "h-5 w-5 text-white transition-all",
            !isNavigationMode && isFavorite && "fill-white"
          )}
        />
      </button>

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
