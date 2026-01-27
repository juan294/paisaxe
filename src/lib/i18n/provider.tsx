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

const locales: Record<Locale, Translations> = { es, en };

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
  const [locale, setLocaleState] = useState<Locale>(initialLocale ?? 'es');
  const [initialized, setInitialized] = useState(!!initialLocale);

  // Detect browser language on mount (client-side only)
  useEffect(() => {
    if (!initialLocale) {
      const detected = resolveLocale();
      setLocaleState(detected);
      setInitialized(true);
    }
  }, [initialLocale]);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    storeLocale(newLocale);
  }, []);

  const t = useCallback(
    (key: string): string => {
      return resolveTranslation(key, locales[locale]);
    },
    [locale]
  );

  const value = useMemo<LanguageContextValue>(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t]
  );

  // Avoid rendering children with wrong locale before detection completes
  // This prevents a flash of Spanish content for English users
  if (!initialized) {
    return null;
  }

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}
