/**
 * Server-side locale resolution for the Next.js App Router.
 *
 * FE-M4: Called from the root layout (server component) so the correct
 * locale is baked into the SSR HTML, eliminating the Spanish flash for
 * non-Spanish users whose preferred language differs from the SSR default.
 *
 * Resolution order (mirrors client-side `resolveLocale` in detect-language.ts):
 * 1. User's stored locale cookie  (`paisaxe-locale`)
 * 2. First supported locale from the `Accept-Language` header
 * 3. Default: 'es'
 *
 * This is a pure utility — it does NOT import React or Next.js server hooks
 * so it remains testable in a plain Node/Vitest environment.
 */

import type { Locale } from './types';

const SUPPORTED_LOCALES: Locale[] = ['es', 'en', 'fr', 'de', 'pt', 'ast'];
const DEFAULT_LOCALE: Locale = 'es';
const STORAGE_KEY = 'paisaxe-locale';

/**
 * Map a single language tag (e.g. 'en-US', 'fr-FR') to a supported Locale.
 * Returns null if the language is not supported.
 */
export function mapLanguageTagServer(tag: string): Locale | null {
  const primary = tag.split('-')[0].toLowerCase().trim();
  if (SUPPORTED_LOCALES.includes(primary as Locale)) {
    return primary as Locale;
  }
  return null;
}

/**
 * Parse an Accept-Language header value and return the first supported locale.
 * Handles quality values (q=) and returns the highest-priority supported locale.
 *
 * Example: "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7" → 'fr'
 */
export function parseAcceptLanguage(header: string): Locale | null {
  if (!header) return null;

  // Split by comma, parse tag + q value, sort by q descending
  const entries = header
    .split(',')
    .map((part) => {
      const [tag, q] = part.trim().split(';');
      const quality = q ? parseFloat(q.replace(/^q=/i, '').trim()) : 1.0;
      return { tag: (tag ?? '').trim(), quality: isNaN(quality) ? 1.0 : quality };
    })
    .sort((a, b) => b.quality - a.quality);

  for (const { tag } of entries) {
    const mapped = mapLanguageTagServer(tag);
    if (mapped) return mapped;
  }

  return null;
}

/**
 * Resolve the locale to serve from the SSR context.
 *
 * @param cookieHeader - Raw `cookie` header string (from `request.headers.get('cookie')`)
 * @param acceptLanguageHeader - `Accept-Language` header value
 */
export function resolveServerLocale(
  cookieHeader: string | null,
  acceptLanguageHeader: string | null,
): Locale {
  // 1. Check for stored locale cookie
  if (cookieHeader) {
    const match = cookieHeader
      .split(';')
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${STORAGE_KEY}=`));

    if (match) {
      const value = match.slice(STORAGE_KEY.length + 1).trim();
      if (SUPPORTED_LOCALES.includes(value as Locale)) {
        return value as Locale;
      }
    }
  }

  // 2. Parse Accept-Language
  if (acceptLanguageHeader) {
    const detected = parseAcceptLanguage(acceptLanguageHeader);
    if (detected) return detected;
  }

  // 3. Default
  return DEFAULT_LOCALE;
}
