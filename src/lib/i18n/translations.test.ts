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
      'common.close',
      'chat.placeholder',
      'chat.listening',
      'chat.thinking',
      'chat.empty_state',
      'chat.speech_hint',
      'chat.error_processing',
      'chat.error_generic',
      'chat.image_alt',
      'chat.source',
      'chat.privacy_notice',
      'chat.understood',
      'stories.ambient_off',
      'stories.ambient_on',
      'stories.ambient',
      'stories.surprise',
      'stories.related',
      'stories.no_results',
      'stories.new_badge',
      'stories.filters.title',
      'stories.filters.category',
      'stories.filters.location',
      'stories.filters.duration',
      'stories.filters.clear',
      'nav.navigate',
      'nav.show_hide',
      'nav.space',
      'nav.next',
      'share.share',
      'share.link_copied',
      'favorites.remove_saved',
      'favorites.add_saved',
      'favorites.remove',
      'favorites.add',
      'favorites.saved',
      'favorites.save',
      'favorites.title',
      'favorites.place_singular',
      'favorites.place_plural',
      'favorites.local_only',
      'favorites.local_only_description',
      'favorites.sync_with_google',
      'favorites.empty_title',
      'favorites.empty_description',
      'favorites.explore',
      'favorites.loading_more',
      'favorites.all_viewed',
      'favorites.remove_from_saved',
      'accessibility.related_stories',
      'accessibility.language_switcher',
      'auth.user',
      'auth.sign_out',
      'auth.sign_in',
      'auth.sync_favorites_title',
      'auth.sync_favorites_description',
      'auth.continue_with_google',
      'auth.maybe_later',
      'mood.title',
      'mood.subtitle',
      'mood.relaxing',
      'mood.adventurous',
      'mood.cultural',
      'mood.delicious',
      'mood.show_all',
    ];

    for (const key of essentialKeys) {
      it(`contains key "${key}" in both locales`, () => {
        expect(esKeys).toContain(key);
        expect(enKeys).toContain(key);
      });
    }
  });
});
