"use client";

import { Shuffle } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

interface SurpriseMeButtonProps {
  totalStories: number;
  currentIndex: number;
  viewedIndices: Set<number>;
  onJumpTo: (index: number) => void;
}

export function SurpriseMeButton({
  totalStories,
  currentIndex,
  viewedIndices,
  onJumpTo,
}: SurpriseMeButtonProps) {
  const { t } = useTranslation();

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    // Find unviewed indices
    const unviewed: number[] = [];
    for (let i = 0; i < totalStories; i++) {
      if (!viewedIndices.has(i) && i !== currentIndex) {
        unviewed.push(i);
      }
    }

    // If all viewed, pick any random one except current
    const candidates = unviewed.length > 0
      ? unviewed
      : Array.from({ length: totalStories }, (_, i) => i).filter((i) => i !== currentIndex);

    if (candidates.length === 0) return;

    const targetIndex = candidates[Math.floor(Math.random() * candidates.length)];

    onJumpTo(targetIndex);
  };

  return (
    <button
      onClick={handleClick}
      className="p-3 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm transition-all motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
      aria-label={t("stories.surprise")}
      title={t("stories.surprise")}
    >
      <Shuffle className="h-5 w-5 text-white" />
    </button>
  );
}
