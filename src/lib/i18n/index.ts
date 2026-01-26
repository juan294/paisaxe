// Stub - real implementation on feature/i18n-infrastructure branch
'use client';

export type Locale = 'es' | 'en';

import { createContext, createElement, useContext, useState, type ReactNode } from 'react';

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextType>({
  locale: 'es',
  setLocale: () => {},
  t: (key: string) => key,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>('es');
  const t = (key: string) => key; // stub returns the key
  return createElement(I18nContext.Provider, { value: { locale, setLocale, t } }, children);
}

export function useTranslation() {
  return useContext(I18nContext);
}
