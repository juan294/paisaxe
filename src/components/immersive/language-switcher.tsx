"use client";

import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const ALL_LANGUAGES: { code: Locale; label: string; fullName: string }[] = [
  { code: "es", label: "ES", fullName: "Espa\u00f1ol (ES)" },
  { code: "ast", label: "AST", fullName: "Asturianu (AST)" },
  { code: "en", label: "EN", fullName: "English (EN)" },
  { code: "fr", label: "FR", fullName: "Fran\u00e7ais (FR)" },
  { code: "de", label: "DE", fullName: "Deutsch (DE)" },
  { code: "pt", label: "PT", fullName: "Portugu\u00eas (PT)" },
];

/**
 * UX-M3: Estimated UI translation coverage per locale (0\u2013100 %).
 *
 * 'es' and 'en' are always shown (reference locales, 100 % coverage).
 * Other locales are shown only when their coverage meets MIN_COVERAGE_THRESHOLD.
 *
 * Update these values whenever a locale's translation file is updated:
 * - Run the translation coverage script (if available) or manually audit
 *   `src/lib/i18n/<locale>.ts` against `es.ts` to estimate completeness.
 *
 * @remarks
 * This is a reversible, minimal gate: lowering MIN_COVERAGE_THRESHOLD or
 * raising a locale's coverage score will make it visible immediately.
 * The gate is intentionally static (no runtime API call) to keep the
 * component synchronous and tree-shakeable.
 */
export const LOCALE_COVERAGE: Partial<Record<Locale, number>> = {
  es: 100,
  en: 100,
  fr: 85,  // French translation file is substantially complete
  de: 85,  // German translation file is substantially complete
  pt: 85,  // Portuguese translation file is substantially complete
  ast: 40, // Asturian translation is partial \u2014 below threshold by default
};

/**
 * Minimum coverage percentage required to show a locale in the switcher.
 * 'es' and 'en' are always shown regardless of this value.
 */
export const MIN_COVERAGE_THRESHOLD = 70;

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);

  // UX-M3: Only show locales that meet the coverage threshold.
  // 'es' and 'en' are always included as reference locales.
  const languages = useMemo(
    () =>
      ALL_LANGUAGES.filter((lang) => {
        if (lang.code === "es" || lang.code === "en") return true;
        const coverage = LOCALE_COVERAGE[lang.code] ?? 0;
        return coverage >= MIN_COVERAGE_THRESHOLD;
      }),
    [],
  );

  const currentLanguage = languages.find((lang) => lang.code === locale) ?? ALL_LANGUAGES.find((lang) => lang.code === locale) ?? ALL_LANGUAGES[0];

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsExpanded(false);
      }
    }

    if (isExpanded) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isExpanded]);

  // Close on escape and return focus to trigger
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsExpanded(false);
        triggerRef.current?.focus();
      }
    }

    if (isExpanded) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [isExpanded]);

  // Focus first option when dropdown opens
  useEffect(() => {
    if (isExpanded && listboxRef.current) {
      const firstOption = listboxRef.current.querySelector<HTMLElement>('[role="option"]');
      firstOption?.focus();
    }
  }, [isExpanded]);

  const handleLanguageSelect = useCallback((langCode: Locale) => {
    setLocale(langCode);
    setIsExpanded(false);
  }, [setLocale]);

  // Arrow key navigation within the listbox
  const handleListboxKeyDown = useCallback((event: React.KeyboardEvent) => {
    const listbox = listboxRef.current;
    if (!listbox) return;

    const options = Array.from(listbox.querySelectorAll<HTMLElement>('[role="option"]'));
    if (options.length === 0) return;

    const currentIndex = options.indexOf(document.activeElement as HTMLElement);

    if (event.key === "ArrowDown") {
      event.preventDefault();
      const next = currentIndex < options.length - 1 ? currentIndex + 1 : 0;
      options[next].focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      const prev = currentIndex > 0 ? currentIndex - 1 : options.length - 1;
      options[prev].focus();
    } else if (event.key === "Home") {
      event.preventDefault();
      options[0].focus();
    } else if (event.key === "End") {
      event.preventDefault();
      options[options.length - 1].focus();
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (currentIndex >= 0) {
        handleLanguageSelect(languages[currentIndex].code);
      }
    }
  }, [handleLanguageSelect, languages]);

  return (
    <div
      ref={containerRef}
      role="group"
      aria-label={t("accessibility.language_switcher")}
      className="relative"
    >
      {/* Toggle Button */}
      <button
        ref={triggerRef}
        onClick={(e) => {
          e.stopPropagation();
          setIsExpanded(!isExpanded);
        }}
        aria-expanded={isExpanded}
        aria-haspopup="listbox"
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-full",
          "text-xs font-medium text-white",
          "bg-white/10 backdrop-blur-sm border border-white/10",
          "transition-all duration-200",
          "hover:bg-white/15",
          "active:scale-95",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        )}
      >
        <span>{currentLanguage.label}</span>
        <ChevronDown
          className={cn(
            "h-3 w-3 text-white/70 transition-transform duration-300 ease-[cubic-bezier(0.65,0,0.35,1)]",
            isExpanded && "rotate-180"
          )}
        />
      </button>

      {/* Dropdown Panel */}
      <div
        className={cn(
          "absolute top-full right-0 mt-2 p-1.5 rounded-xl",
          "bg-white/10 backdrop-blur-xl border border-white/20",
          "transition-all duration-200 ease-[cubic-bezier(0.65,0,0.35,1)]",
          isExpanded
            ? "opacity-100 translate-y-0 scale-100 pointer-events-auto"
            : "opacity-0 -translate-y-2 scale-95 pointer-events-none"
        )}
        onClick={(e) => e.stopPropagation()}
        role="listbox"
        aria-label={t("accessibility.language_switcher")}
        onKeyDown={handleListboxKeyDown}
      >
        <div ref={listboxRef} className="flex flex-col gap-1">
          {languages.map((lang, index) => (
            <button
              key={lang.code}
              role="option"
              aria-selected={locale === lang.code}
              aria-label={lang.fullName}
              tabIndex={-1}
              onClick={(e) => {
                e.stopPropagation();
                handleLanguageSelect(lang.code);
              }}
              style={{
                animationDelay: isExpanded ? `${50 + index * 30}ms` : "0ms",
              }}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium text-left",
                "transition-all duration-200",
                "active:scale-95",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70",
                locale === lang.code
                  ? "bg-white text-black"
                  : "bg-white/10 text-white/80 hover:text-white hover:bg-white/15",
                isExpanded && "animate-fade-in-up"
              )}
            >
              {lang.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
