import type { Locale } from './types';

export const LOCALE_COOKIE = 'paisaxe-locale';

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && ['es', 'en', 'fr', 'de', 'pt', 'ast'].includes(value);
}

export function mapLanguageTag(tag: string): Locale | null {
  const [primary = ''] = tag.toLowerCase().split('-');
  return isLocale(primary) ? primary : null;
}

export function getLocaleCookie(): Locale | null {
  if (typeof document === 'undefined') return null;
  const value = document.cookie.split(';').map(c => c.trim()).find(c => c.startsWith(LOCALE_COOKIE + '='))?.slice(LOCALE_COOKIE.length + 1);
  return isLocale(value) ? value : null;
}

export function resolveRequestLocale(cookie: string | null | undefined, acceptLanguage: string | null) {
  if (isLocale(cookie)) return { locale: cookie, source: 'cookie' as const };
  const candidates = (acceptLanguage ?? '').split(',').map((entry, order) => {
    const [tag = '', ...parameters] = entry.trim().split(';');
    const quality = parameters.find(p => p.trim().startsWith('q='));
    const weight = quality === undefined ? 1 : Number(quality.trim().slice(2));
    return { locale: mapLanguageTag(tag), weight, order };
  }).filter(c => c.locale && Number.isFinite(c.weight) && c.weight > 0 && c.weight <= 1)
    .sort((a, b) => b.weight - a.weight || a.order - b.order);
  if (candidates[0]?.locale) return { locale: candidates[0].locale, source: 'browser' as const };
  return { locale: 'es' as const, source: 'default' as const };
}
