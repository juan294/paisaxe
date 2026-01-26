import type { Translations } from './types';

/**
 * Resolve a dot-notation key from a translations object.
 * Returns the key itself as fallback if the translation is missing (never crashes).
 *
 * @example
 * resolveTranslation('chat.placeholder', esTranslations) // 'Escribe tu pregunta...'
 * resolveTranslation('nonexistent.key', esTranslations)   // 'nonexistent.key'
 */
export function resolveTranslation(key: string, translations: Translations): string {
  const parts = key.split('.');
  let current: Translations | string = translations;

  for (const part of parts) {
    if (typeof current !== 'object' || current === null) {
      return key;
    }
    const next: string | Translations | undefined = current[part];
    if (next === undefined) {
      return key;
    }
    current = next;
  }

  if (typeof current === 'string') {
    return current;
  }

  // If the result is an object (not a leaf node), return the key as fallback
  return key;
}
