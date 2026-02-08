import { describe, it, expect } from 'vitest';
import { es } from './es';
import { en } from './en';
import { fr } from './fr';
import { de } from './de';
import { pt } from './pt';
import { ast } from './ast';
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

function checkEmptyValues(obj: Translations, prefix = ''): string[] {
  const empties: string[] = [];
  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];
    if (typeof value === 'string' && value === '') {
      empties.push(fullKey);
    } else if (typeof value === 'object' && value !== null) {
      empties.push(...checkEmptyValues(value as Translations, fullKey));
    }
  }
  return empties;
}

const allLocales = {
  es: { name: 'Spanish', data: es },
  en: { name: 'English', data: en },
  fr: { name: 'French', data: fr },
  de: { name: 'German', data: de },
  pt: { name: 'Portuguese', data: pt },
  ast: { name: 'Asturian', data: ast },
};

const allLocaleKeys = Object.fromEntries(
  Object.entries(allLocales).map(([code, { data }]) => [code, collectKeys(data)])
);

describe('locale files', () => {
  const esKeys = allLocaleKeys.es;

  for (const [code, { name }] of Object.entries(allLocales)) {
    it(`${name} locale has translation keys`, () => {
      expect(allLocaleKeys[code].length).toBeGreaterThan(0);
    });
  }

  for (const [code, { name }] of Object.entries(allLocales)) {
    if (code === 'es') continue;
    it(`${name} locale has the same number of keys as Spanish`, () => {
      expect(allLocaleKeys[code].length).toBe(esKeys.length);
    });
  }

  for (const [code, { name }] of Object.entries(allLocales)) {
    if (code === 'es') continue;
    it(`every key in Spanish locale exists in ${name} locale`, () => {
      const targetKeySet = new Set(allLocaleKeys[code]);
      const missing = esKeys.filter((key) => !targetKeySet.has(key));
      expect(missing).toEqual([]);
    });

    it(`every key in ${name} locale exists in Spanish locale`, () => {
      const esKeySet = new Set(esKeys);
      const missing = allLocaleKeys[code].filter((key) => !esKeySet.has(key));
      expect(missing).toEqual([]);
    });
  }

  for (const [, { name, data }] of Object.entries(allLocales)) {
    it(`no value is an empty string in ${name} locale`, () => {
      expect(checkEmptyValues(data)).toEqual([]);
    });
  }

  describe('diacritics are correct', () => {
    it('French has correct diacritics in premium section', () => {
      const p = fr.premium as Record<string, string>;
      expect(p.voice_title).toContain('à');
      expect(p.feature_24h).toContain('illimitées');
      expect(p.secure_payment).toContain('sécurisé');
      expect(p.success_title).toContain('prêt');
      expect(p.success_cta).toContain('à');
      expect(p.faq_how_long).toContain('ça');
      expect(p.faq_how_long_answer).toContain('à partir');
      expect(p.faq_how_long_answer).toContain('journée');
    });

    it('German has correct umlauts in premium section', () => {
      const p = de.premium as Record<string, string>;
      expect(p.feature_24h).toContain('Gespräche');
      expect(p.secure_payment).toContain('über');
      expect(p.success_expires).toContain('gültig');
      expect(p.pricing_title).toContain('Sprachgespräche');
      expect(p.faq_how_long_answer).toContain('für');
    });

    it('Portuguese has correct diacritics in premium section', () => {
      const p = pt.premium as Record<string, string>;
      expect(p.voice_locked).toContain('função');
      expect(p.voice_locked).toContain('é uma');
      expect(p.get_day_pass).toContain('Diário');
      expect(p.sign_in_to_purchase).toContain('sessão');
      expect(p.success_expires).toContain('é válido até');
      expect(p.success_cta).toContain('Começar');
      expect(p.faq_what_included).toContain('está incluído');
    });

    it('Spanish has correct diacritics', () => {
      const filters = (es.stories as Record<string, unknown>).filters as Record<string, string>;
      expect(filters.location).toBe('Ubicación');
      expect(filters.duration).toBe('Duración');

      const auth = es.auth as Record<string, string>;
      expect(auth.sign_out).toContain('sesión');

      const mood = es.mood as Record<string, string>;
      expect(mood.title).toContain('¿Qué');
    });
  });

  describe('voice pass expiry key exists in all locales', () => {
    it('all locales have premium.voice_pass_expiry key', () => {
      for (const [code, keys] of Object.entries(allLocaleKeys)) {
        expect(keys, `Missing premium.voice_pass_expiry in ${code}`).toContain('premium.voice_pass_expiry');
      }
    });
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
      'accessibility.go_back',
      'accessibility.loading',
      'accessibility.go_to_story',
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
      it(`contains key "${key}" in all locales`, () => {
        for (const [code, keys] of Object.entries(allLocaleKeys)) {
          expect(keys, `Missing in ${code}`).toContain(key);
        }
      });
    }
  });
});
