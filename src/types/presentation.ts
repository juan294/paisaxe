import type { Locale, Translations } from '@/lib/i18n/types';
import type { AuthUser } from './auth';

/** Presentation only: authoritative access checks remain in server routes. */
export interface InitialPresentation {
  locale: Locale;
  dictionaryLocale: Locale;
  dictionary: Translations;
  localeSource: 'cookie' | 'browser' | 'default';
  languageError: boolean;
  user: AuthUser | null;
  authError: boolean;
}
