"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";
import type { Mood } from "@/lib/mood-mapping";

interface MoodOverlayProps {
  onSelectMood: (mood: Mood) => void;
  onDismiss: () => void;
}

const MOOD_OPTIONS: { mood: Mood; labelKey: string; emoji: string; color: string }[] = [
  { mood: "relajante", labelKey: "mood.relaxing", emoji: "\u{1F30A}", color: "from-blue-500/20 to-blue-600/20 hover:from-blue-500/30 hover:to-blue-600/30" },
  { mood: "aventurero", labelKey: "mood.adventurous", emoji: "\u{26F0}\u{FE0F}", color: "from-emerald-500/20 to-emerald-600/20 hover:from-emerald-500/30 hover:to-emerald-600/30" },
  { mood: "cultural", labelKey: "mood.cultural", emoji: "\u{1F3DB}\u{FE0F}", color: "from-amber-500/20 to-amber-600/20 hover:from-amber-500/30 hover:to-amber-600/30" },
  { mood: "delicioso", labelKey: "mood.delicious", emoji: "\u{1F372}", color: "from-red-500/20 to-red-600/20 hover:from-red-500/30 hover:to-red-600/30" },
];

export function MoodOverlay({ onSelectMood, onDismiss }: MoodOverlayProps) {
  const { t } = useTranslation();

  const handleSelect = (mood: Mood) => {
    onSelectMood(mood);
  };

  const handleDismiss = () => {
    onDismiss();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-xl" />

      {/* Content */}
      <div className="relative max-w-md w-full text-center rounded-2xl border border-white/20 bg-white/10 p-6 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-300 motion-reduce:animate-none" role="dialog" aria-label={t("mood.title")}>
        {/* Dismiss button */}
        <button
          onClick={handleDismiss}
          aria-label={t("common.close")}
          className="absolute -top-2 -right-2 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-all motion-reduce:transition-none z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 className="text-2xl font-bold text-white mb-2">
          {t("mood.title")}
        </h2>
        <p className="text-white/60 text-sm mb-8">
          {t("mood.subtitle")}
        </p>

        <div className="grid grid-cols-2 gap-3">
          {MOOD_OPTIONS.map(({ mood, labelKey, emoji, color }) => (
            <button
              key={mood}
              onClick={() => handleSelect(mood)}
              className={cn(
                "flex flex-col items-center gap-2 p-6 rounded-2xl",
                "bg-gradient-to-br backdrop-blur-sm",
                "border border-white/10",
                "text-white transition-all motion-reduce:transition-none hover:scale-105 motion-reduce:hover:scale-100",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70",
                color
              )}
            >
              <span className="text-3xl">{emoji}</span>
              <span className="font-medium">{t(labelKey)}</span>
            </button>
          ))}
        </div>

        <button
          onClick={handleDismiss}
          className="mt-6 text-sm text-white/60 hover:text-white/80 transition-colors"
        >
          {t("mood.show_all")}
        </button>
      </div>
    </div>
  );
}
