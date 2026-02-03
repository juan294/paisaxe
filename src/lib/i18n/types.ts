export type Locale = 'es' | 'en' | 'fr' | 'de' | 'pt' | 'ast';

export type TranslationKey = string;

export interface Translations {
  [key: string]: string | Translations;
}
