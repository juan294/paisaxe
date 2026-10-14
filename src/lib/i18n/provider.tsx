'use client';

import { createContext, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import type { Locale, Translations } from './types';
import { es } from './es';
import { resolveTranslation } from './resolve';
import { getStoredLocale, resolveLocale, storeLocale } from './detect-language';
import { getLocaleCookie, isLocale } from './preference';
import { cachedDictionary, loadDictionary, resetDictionaryCacheForTesting } from './dictionaries';

export const _resetTranslationCacheForTesting = resetDictionaryCacheForTesting;

export interface LanguageContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
  dictionaryLocale?: Locale;
  loadError?: boolean;
  isLanguageLoading?: boolean;
  legacyMigrated?: boolean;
  retryLanguage?: () => void;
}

export const LanguageContext = createContext<LanguageContextValue | null>(null);

interface LanguageProviderProps {
  children: ReactNode;
  initialLocale?: Locale;
  initialDictionary?: Translations;
  initialDictionaryLocale?: Locale;
  initialLanguageError?: boolean;
  /** The server cannot observe legacy localStorage on the first visit. */
  reconcileLegacyPreference?: boolean;
}

export function LanguageProvider({ children, initialLocale, initialDictionary, initialDictionaryLocale, initialLanguageError = false, reconcileLegacyPreference = false }: LanguageProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale ?? 'es');
  const [dictionary, setDictionary] = useState(() => ({ locale: initialLocale ?? 'es', language: initialDictionaryLocale ?? initialLocale ?? 'es', data: initialDictionary ?? cachedDictionary(initialLocale ?? 'es') }));
  const [loadError, setLoadError] = useState(initialLanguageError);
  const [legacyMigrated, setLegacyMigrated] = useState(false);
  const [loadGeneration, setLoadGeneration] = useState(0);

  useEffect(() => {
    if (reconcileLegacyPreference && !getLocaleCookie()) {
      const legacy = getStoredLocale();
      if (legacy) {
        storeLocale(legacy);
        setLocaleState(legacy);
        setLegacyMigrated(true);
      }
    } else if (!initialLocale) {
      setLocaleState(resolveLocale());
    }
  }, [initialLocale, reconcileLegacyPreference]);

  useEffect(() => {
    // The supplied active dictionary covers server paint and hydration.
    if (dictionary.locale === locale && dictionary.language === locale && dictionary.data) return;
    if (initialLanguageError && locale === initialLocale && loadGeneration === 0) return;
    let cancelled = false;
    setLoadError(false);
    const timer = setTimeout(() => {
      if (cancelled) return;
      cancelled = true;
      setDictionary({ locale, language: 'es', data: undefined });
      setLoadError(true);
    }, 1500);
    void loadDictionary(locale).then(data => {
      clearTimeout(timer);
      if (!cancelled) setDictionary({ locale, language: locale, data });
    }).catch(() => {
      clearTimeout(timer);
      if (!cancelled) {
        setDictionary({ locale, language: 'es', data: undefined });
        setLoadError(true);
      }
    });
    return () => { cancelled = true; clearTimeout(timer); };
    // Dictionary completion must not start another load; locale/generation own it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale, loadGeneration]);

  const setLocale = useCallback((newLocale: Locale) => {
    if (!isLocale(newLocale)) return;
    setLoadGeneration(n => n + 1);
    setLocaleState(newLocale);
    setLoadError(false);
    setLegacyMigrated(false);
    storeLocale(newLocale);
  }, []);
  const retryLanguage = useCallback(() => setLoadGeneration(n => n + 1), []);
  const active = dictionary.locale === locale ? dictionary.data : cachedDictionary(locale);
  const dictionaryLocale = active ? (dictionary.locale === locale ? dictionary.language : locale) : 'es';
  const t = useCallback((key: string) => resolveTranslation(key, active ?? es), [active]);
  const value = useMemo<LanguageContextValue>(() => ({ locale, setLocale, t, dictionaryLocale, loadError, isLanguageLoading: !active && !loadError, legacyMigrated, retryLanguage }), [locale, setLocale, t, dictionaryLocale, loadError, active, legacyMigrated, retryLanguage]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}
