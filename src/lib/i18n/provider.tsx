'use client';

import {
  createContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import type { Locale } from './types';
import { es } from './es';
import { en } from './en';
import { fr } from './fr';
import { de } from './de';
import { pt } from './pt';
import { ast } from './ast';
import { resolveTranslation } from './resolve';
import { resolveLocale, storeLocale } from './detect-language';
import type { Translations } from './types';

const locales: Record<Locale, Translations> = { es, en, fr, de, pt, ast };

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
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (typeof window === 'undefined') return initialLocale ?? 'es';
    return initialLocale ?? resolveLocale();
  });

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

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}
