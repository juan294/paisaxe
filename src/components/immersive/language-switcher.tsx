"use client";

import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import type { Translations } from "@/lib/i18n/types";
import { es } from "@/lib/i18n/es";
import { fr } from "@/lib/i18n/fr";
import { de } from "@/lib/i18n/de";
import { pt } from "@/lib/i18n/pt";
import { ast } from "@/lib/i18n/ast";
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
 * Recursively collect every leaf translation key using dot-notation
 * (e.g. "chat.placeholder"). Mirrors the collector used by
 * `src/lib/i18n/translations.test.ts` for key-parity checks.
 */
function collectTranslationKeys(obj: Translations, prefix = ""): string[] {
  const keys: string[] = [];
  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];
    if (typeof value === "string") {
      keys.push(fullKey);
    } else if (typeof value === "object" && value !== null) {
      keys.push(...collectTranslationKeys(value, fullKey));
    }
  }
  return keys;
}

function getByPath(obj: Translations, path: string): string | Translations | undefined {
  return path.split(".").reduce<Translations | string | undefined>((acc, segment) => {
    if (acc && typeof acc === "object") return acc[segment];
    return undefined;
  }, obj);
}

/**
 * UX-M10 (#903): Compute translation coverage directly from each locale file
 * against the Spanish reference, instead of hand-maintaining a percentage
 * constant. A hand-maintained constant silently drifts out of sync with the
 * real file \u2014 'ast' was pinned at a stale 40 % long after the locale file
 * reached 81 % real coverage, hiding a fully-usable locale from the switcher.
 *
 * A key counts as "translated" when its value differs from the Spanish
 * reference value at the same path (an untranslated key is typically a
 * verbatim copy of the Spanish string). Coverage is the percentage of
 * Spanish leaf keys with a translated (different) counterpart in the target
 * locale.
 */
function computeCoverage(reference: Translations, target: Translations): number {
  const referenceKeys = collectTranslationKeys(reference);
  if (referenceKeys.length === 0) return 0;
  let translated = 0;
  for (const key of referenceKeys) {
    if (getByPath(target, key) !== getByPath(reference, key)) translated++;
  }
  return Math.round((translated / referenceKeys.length) * 100);
}

const LOCALE_FILES: Partial<Record<Locale, Translations>> = { fr, de, pt, ast };

/**
 * UX-M10 (#903): Measured UI translation coverage per locale (0\u2013100 %),
 * computed from the actual locale files at module-load time \u2014 not a
 * hand-maintained constant that can drift from reality.
 *
 * 'es' and 'en' are always shown regardless of this map (reference locales).
 * Other locales are shown only when their computed coverage meets
 * MIN_COVERAGE_THRESHOLD.
 */
export const LOCALE_COVERAGE: Partial<Record<Locale, number>> = Object.fromEntries(
  Object.entries(LOCALE_FILES).map(([code, data]) => [code, computeCoverage(es, data)])
) as Partial<Record<Locale, number>>;

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
