"use client";

import { useTranslation } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const languages: { code: Locale; label: string }[] = [
  { code: "es", label: "ES" },
  { code: "en", label: "EN" },
  { code: "fr", label: "FR" },
  { code: "de", label: "DE" },
  { code: "pt", label: "PT" },
];

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useTranslation();

  return (
    <div
      role="group"
      aria-label={t("accessibility.language_switcher")}
      className="flex items-center rounded-full bg-white/10 backdrop-blur-sm border border-white/10 overflow-hidden"
    >
      {languages.map((lang, index) => (
        <span key={lang.code} className="contents">
          {index > 0 && <div className="w-px h-4 bg-white/20" />}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setLocale(lang.code);
            }}
            className={cn(
              "px-2 py-1 text-xs font-medium transition-all motion-reduce:transition-none",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70",
              locale === lang.code
                ? "text-white bg-white/20"
                : "text-white/50 hover:text-white/80"
            )}
          >
            {lang.label}
          </button>
        </span>
      ))}
    </div>
  );
}
