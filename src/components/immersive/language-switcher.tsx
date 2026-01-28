"use client";

import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useTranslation();

  return (
    <div
      role="group"
      aria-label={t("accessibility.language_switcher")}
      className="flex items-center rounded-full bg-white/10 backdrop-blur-sm border border-white/10 overflow-hidden"
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          setLocale("es");
        }}
        className={cn(
          "px-2.5 py-1 text-xs font-medium transition-all motion-reduce:transition-none",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70",
          locale === "es"
            ? "text-white bg-white/20"
            : "text-white/50 hover:text-white/80"
        )}
      >
        ES
      </button>
      <div className="w-px h-4 bg-white/20" />
      <button
        onClick={(e) => {
          e.stopPropagation();
          setLocale("en");
        }}
        className={cn(
          "px-2.5 py-1 text-xs font-medium transition-all motion-reduce:transition-none",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70",
          locale === "en"
            ? "text-white bg-white/20"
            : "text-white/50 hover:text-white/80"
        )}
      >
        EN
      </button>
    </div>
  );
}
