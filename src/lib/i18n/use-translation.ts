'use client';

import { useContext, useMemo, useRef } from 'react';
import { LanguageContext } from './provider';
import type { LanguageContextValue } from './provider';
import { es } from './es';
import { resolveTranslation } from './resolve';

/**
 * Hook to access translation function and locale management.
 *
 * Returns a fallback with Spanish translations if called outside LanguageProvider
 * (e.g. during HMR, error boundary cascades, or SSR edge cases).
 *
 * @example
 * const { t, locale, setLocale } = useTranslation();
 * t('chat.placeholder'); // 'Ask about this place...' (if locale is 'en')
 */
export function useTranslation(): LanguageContextValue {
  const context = useContext(LanguageContext);
  const hasWarned = useRef(false);

  const fallback = useMemo<LanguageContextValue>(() => ({
    locale: 'es',
    setLocale: () => {},
    t: (key: string) => resolveTranslation(key, es),
  }), []);

  if (!context && !hasWarned.current) {
    hasWarned.current = true;
    console.warn(
      'useTranslation: LanguageProvider not found, using fallback. This may indicate a rendering issue.'
    );
  }

  return context ?? fallback;
}
