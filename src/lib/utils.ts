import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Locale } from "@/lib/i18n/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * UX-M11 (#904): maps the app's locale codes to the explicit BCP-47 tag used
 * for `Intl` formatting. Every visitor-facing date/time render must go
 * through this rather than passing the raw app locale (or nothing, which
 * falls back to the browser's locale) straight into `Intl` — not every app
 * locale value is guaranteed to carry full ICU data in every runtime
 * (Asturian in particular), so the mapping is explicit and exhaustive rather
 * than relying on the value happening to also be a valid BCP-47 subtag.
 */
const INTL_LOCALE_MAP: Record<Locale, string> = {
  es: "es-ES",
  en: "en-US",
  fr: "fr-FR",
  de: "de-DE",
  pt: "pt-PT",
  ast: "ast",
};

export function toIntlLocale(locale: Locale): string {
  return INTL_LOCALE_MAP[locale] ?? INTL_LOCALE_MAP.es;
}
