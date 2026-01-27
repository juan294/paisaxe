"use client";

import { useState, useRef } from "react";
import { Bookmark } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";

interface BookmarkButtonProps {
  isFavorite: boolean;
  onToggle: () => void;
}

export function BookmarkButton({ isFavorite, onToggle }: BookmarkButtonProps) {
  const [toast, setToast] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { t } = useTranslation();

  const showToast = (message: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast(message);
    timerRef.current = setTimeout(() => setToast(null), 1500);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    showToast(isFavorite ? t("favorites.removed") : t("favorites.saved_toast"));
    onToggle();
  };

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        className="p-2 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm transition-all"
        title={isFavorite ? t("favorites.remove_saved") : t("favorites.add_saved")}
      >
        <Bookmark
          className={cn(
            "h-5 w-5 text-white transition-all",
            isFavorite && "fill-white"
          )}
        />
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
