export type Locale = 'es' | 'en' | 'fr' | 'de' | 'pt' | 'ast';

export interface Translations {
  [key: string]: string | Translations;
}
