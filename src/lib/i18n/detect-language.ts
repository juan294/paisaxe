import type { Locale } from './types';

const SUPPORTED_LOCALES: Locale[] = ['es', 'en', 'fr', 'de', 'pt'];
const DEFAULT_LOCALE: Locale = 'es';
const STORAGE_KEY = 'paisaxe-locale';

/**
 * Map a browser language tag (e.g. 'en-US', 'es-MX') to a supported Locale.
 * Returns null if the language is not supported.
 */
export function mapLanguageTag(tag: string): Locale | null {
  const primary = tag.split('-')[0].toLowerCase();
  if (SUPPORTED_LOCALES.includes(primary as Locale)) {
    return primary as Locale;
  }
  return null;
}

/**
 * Detect the user's preferred locale from the browser.
 * Checks navigator.languages first (array of preferred languages),
 * then falls back to navigator.language.
 * Returns the first supported locale found, or the default ('es').
 */
export function detectBrowserLanguage(): Locale {
  if (typeof navigator === 'undefined') {
    return DEFAULT_LOCALE;
  }

  // Check navigator.languages first (ordered by user preference)
  const languages = navigator.languages;
  if (languages && languages.length > 0) {
    for (const lang of languages) {
      const mapped = mapLanguageTag(lang);
      if (mapped) return mapped;
    }
  }

  // Fall back to navigator.language
  if (navigator.language) {
    const mapped = mapLanguageTag(navigator.language);
    if (mapped) return mapped;
  }

  return DEFAULT_LOCALE;
}

/**
 * Get the stored locale preference from localStorage.
 * Returns null if no preference is stored or if running on the server.
 */
export function getStoredLocale(): Locale | null {
  if (typeof window === 'undefined') return null;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && SUPPORTED_LOCALES.includes(stored as Locale)) {
      return stored as Locale;
    }
  } catch {
    // localStorage may be unavailable (e.g. private browsing in some browsers)
  }

  return null;
}

/**
 * Store the locale preference in localStorage.
 */
export function storeLocale(locale: Locale): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // Silently ignore storage errors
  }
}

/**
 * Resolve the locale to use:
 * 1. Stored preference (user previously chose a language)
 * 2. Browser language detection
 * 3. Default to 'es'
 */
export function resolveLocale(): Locale {
  const stored = getStoredLocale();
  if (stored) return stored;

  return detectBrowserLanguage();
}
