export type Locale = 'es' | 'en';

export type TranslationKey = string;

export interface Translations {
  [key: string]: string | Translations;
}
