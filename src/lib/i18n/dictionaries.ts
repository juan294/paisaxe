import type { Locale, Translations } from './types';
import { es } from './es';
import { en } from './en';

const cache = new Map<Locale, Translations>([['es', es], ['en', en]]);
const loaders = {
  fr: () => import('./fr').then(m => m.fr),
  de: () => import('./de').then(m => m.de),
  pt: () => import('./pt').then(m => m.pt),
  ast: () => import('./ast').then(m => m.ast),
};

export function cachedDictionary(locale: Locale): Translations | undefined {
  return cache.get(locale);
}

export async function loadDictionary(locale: Locale): Promise<Translations> {
  const existing = cache.get(locale);
  if (existing) return existing;
  const dictionary = await loaders[locale as keyof typeof loaders]();
  cache.set(locale, dictionary);
  return dictionary;
}

/** Reset only public dictionary resources, never user preferences. */
export function resetDictionaryCacheForTesting() {
  cache.clear();
  cache.set('es', es);
  cache.set('en', en);
}
