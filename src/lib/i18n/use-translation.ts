'use client';

import { useContext } from 'react';
import { LanguageContext } from './provider';
import type { LanguageContextValue } from './provider';

/**
 * Hook to access translation function and locale management.
 *
 * @example
 * const { t, locale, setLocale } = useTranslation();
 * t('chat.placeholder'); // 'Ask about this place...' (if locale is 'en')
 */
export function useTranslation(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return context;
}
