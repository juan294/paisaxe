"use client";

import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

// UX-M10 (#903) / bundle-size follow-up: coverage is computed at build time
// by scripts/generate-locale-coverage.ts from the real locale files (see
// src/lib/i18n/coverage.ts for the shared computation logic), not inline
// here. Importing fr/de/pt/ast directly in this client component would ship
// ~100KB of locale-file source into the browser bundle just to diff their
// keys for a percentage \u2014 those files are already lazy-loaded on demand by
// src/lib/i18n/provider.tsx. locale-coverage.generated.ts exports only the
// small resulting numbers, so zero locale-file bytes reach the client.
import { LOCALE_COVERAGE } from "@/lib/i18n/locale-coverage.generated";
export { LOCALE_COVERAGE };

const ALL_LANGUAGES: { code: Locale; label: string; fullName: string }[] = [
  { code: "es", label: "ES", fullName: "Espa\u00f1ol (ES)" },
  { code: "ast", label: "AST", fullName: "Asturianu (AST)" },
  { code: "en", label: "EN", fullName: "English (EN)" },
  { code: "fr", label: "FR", fullName: "Fran\u00e7ais (FR)" },
  { code: "de", label: "DE", fullName: "Deutsch (DE)" },
  { code: "pt", label: "PT", fullName: "Portugu\u00eas (PT)" },
];

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
          // UX-M6 (#899): min-h-11 (44px) meets the 44×44 touch-target
          // convention used by other toolbar controls (e.g. glassIcon
          // buttons); the visual pill still hugs its content via px-3 py-1.5.
          "flex items-center gap-1.5 px-3 py-1.5 min-h-11 rounded-full",
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
      {/* UX-M3 (#896): `inert` keeps the closed panel mounted (required for
          the open/close transition) while removing it from the a11y tree
          and tab order — options must not be reachable while invisible. */}
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
        inert={!isExpanded}
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
                // UX-M6 (#899): min-h-11 (44px) touch-target floor.
                "flex items-center px-3 py-1.5 min-h-11 rounded-lg text-xs font-medium text-left",
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
