import { describe, it, expect } from 'vitest';
import { es } from './es';
import { en } from './en';
import type { Translations } from './types';

/**
 * Recursively collect all keys from a translation object using dot-notation.
 */
function collectKeys(obj: Translations, prefix = ''): string[] {
  const keys: string[] = [];
  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];
    if (typeof value === 'string') {
      keys.push(fullKey);
    } else if (typeof value === 'object' && value !== null) {
      keys.push(...collectKeys(value as Translations, fullKey));
    }
  }
  return keys;
}

describe('locale files', () => {
  const esKeys = collectKeys(es);
  const enKeys = collectKeys(en);

  it('Spanish locale has translation keys', () => {
    expect(esKeys.length).toBeGreaterThan(0);
  });

  it('English locale has translation keys', () => {
    expect(enKeys.length).toBeGreaterThan(0);
  });

  it('both locales have the same number of keys', () => {
    expect(esKeys.length).toBe(enKeys.length);
  });

  it('every key in Spanish locale exists in English locale', () => {
    const enKeySet = new Set(enKeys);
    const missingInEn = esKeys.filter((key) => !enKeySet.has(key));
    expect(missingInEn).toEqual([]);
  });

  it('every key in English locale exists in Spanish locale', () => {
    const esKeySet = new Set(esKeys);
    const missingInEs = enKeys.filter((key) => !esKeySet.has(key));
    expect(missingInEs).toEqual([]);
  });

  it('no value is an empty string in Spanish locale', () => {
    function checkValues(obj: Translations, prefix = ''): string[] {
      const empties: string[] = [];
      for (const key of Object.keys(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        const value = obj[key];
        if (typeof value === 'string' && value === '') {
          empties.push(fullKey);
        } else if (typeof value === 'object' && value !== null) {
          empties.push(...checkValues(value as Translations, fullKey));
        }
      }
      return empties;
    }
    expect(checkValues(es)).toEqual([]);
  });

  it('no value is an empty string in English locale', () => {
    function checkValues(obj: Translations, prefix = ''): string[] {
      const empties: string[] = [];
      for (const key of Object.keys(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        const value = obj[key];
        if (typeof value === 'string' && value === '') {
          empties.push(fullKey);
        } else if (typeof value === 'object' && value !== null) {
          empties.push(...checkValues(value as Translations, fullKey));
        }
      }
      return empties;
    }
    expect(checkValues(en)).toEqual([]);
  });

  describe('essential keys exist', () => {
    const essentialKeys = [
      'common.loading',
      'common.error',
      'common.close',
      'chat.placeholder',
      'chat.send',
      'chat.thinking',
      'stories.askAbout',
      'stories.clearFilters',
      'filters.filters',
      'filters.category',
      'categories.nature',
      'categories.cities',
      'categories.food',
      'categories.culture',
      'categories.activities',
      'locations.eastern',
      'locations.central',
      'locations.western',
      'favorites.saved',
      'favorites.save',
      'mood.title',
      'controls.share',
      'controls.surprise',
      'auth.signIn',
      'auth.signOut',
      'privacy.notice',
    ];

    for (const key of essentialKeys) {
      it(`contains key "${key}" in both locales`, () => {
        expect(esKeys).toContain(key);
        expect(enKeys).toContain(key);
      });
    }
  });
});
