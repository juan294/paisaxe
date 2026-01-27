"use client";

import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";

interface FavoriteButtonProps {
  isFavorite: boolean;
  onToggle: () => void;
  className?: string;
}

export function FavoriteButton({
  isFavorite,
  onToggle,
  className,
}: FavoriteButtonProps) {
  const { t } = useTranslation();

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={cn(
        "px-6 py-3 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white rounded-full font-medium transition-all hover:scale-105 flex items-center gap-2",
        className
      )}
      aria-label={isFavorite ? t("favorites.remove") : t("favorites.add")}
    >
      <Heart
        className={cn(
          "h-5 w-5 transition-all",
          isFavorite && "fill-red-500 text-red-500"
        )}
      />
      <span>{isFavorite ? t("favorites.saved") : t("favorites.save")}</span>
    </button>
  );
}
