'use client';

import {
  createContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import type { Locale } from './types';
import { es } from './es';
import { en } from './en';
import { resolveTranslation } from './resolve';
import { resolveLocale, storeLocale } from './detect-language';
import type { Translations } from './types';

// Module-level cache — es and en are always available (static imports)
const translationCache = new Map<Locale, Translations>();
translationCache.set('es', es);
translationCache.set('en', en);

// Lazy loaders for other locales (~14KB each, loaded on demand)
// es and en are pre-populated in translationCache above — no loader needed
const localeLoaders: Partial<Record<Locale, () => Promise<Translations>>> = {
  fr: () => import('./fr').then(m => m.fr),
  de: () => import('./de').then(m => m.de),
  pt: () => import('./pt').then(m => m.pt),
  ast: () => import('./ast').then(m => m.ast),
};

/** Reset cache to only static locales. Test-only. */
export function _resetTranslationCacheForTesting(): void {
  const keep = new Map<Locale, Translations>();
  keep.set('es', es);
  keep.set('en', en);
  translationCache.clear();
  for (const [k, v] of keep) translationCache.set(k, v);
}

export interface LanguageContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
}

export const LanguageContext = createContext<LanguageContextValue | null>(null);

interface LanguageProviderProps {
  children: ReactNode;
  /** Optional initial locale for testing; if omitted, auto-detects. */
  initialLocale?: Locale;
}

export function LanguageProvider({ children, initialLocale }: LanguageProviderProps) {
  // Always start with 'es' (SSR default) to prevent hydration mismatch.
  // Browser locale detection runs in useEffect after hydration.
  const [locale, setLocaleState] = useState<Locale>(initialLocale ?? 'es');
  const [loadGeneration, setLoadGeneration] = useState(0);

  // After hydration, resolve the actual locale from browser/storage
  useEffect(() => {
    if (initialLocale) return; // explicit prop — skip detection
    const resolved = resolveLocale();
    if (resolved !== 'es') {
      setLocaleState(resolved);
    }
  }, [initialLocale]);

  // Load translations for the current locale if not cached
  useEffect(() => {
    if (translationCache.has(locale)) return;
    let cancelled = false;
    localeLoaders[locale]?.().then(translations => {
      if (cancelled) return;
      translationCache.set(locale, translations);
      setLoadGeneration(n => n + 1);
    });
    return () => { cancelled = true; };
  }, [locale]);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    storeLocale(newLocale);
  }, []);

  const t = useCallback(
    (key: string): string => {
      const translations = translationCache.get(locale) ?? es;
      return resolveTranslation(key, translations);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locale, loadGeneration]
  );

  const value = useMemo<LanguageContextValue>(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}
