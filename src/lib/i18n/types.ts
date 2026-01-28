export type Locale = 'es' | 'en' | 'fr' | 'de' | 'pt';

export type TranslationKey = string;

export interface Translations {
  [key: string]: string | Translations;
}
