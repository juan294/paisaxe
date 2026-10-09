import { describe, expect, it } from 'vitest';
import { es } from './es';
import { en } from './en';
import { fr } from './fr';
import { de } from './de';
import { pt } from './pt';
import { ast } from './ast';
import { collectTranslationKeys, getByPath } from './coverage';
import { interpolate } from './interpolate';

const dictionaries = { es, en, fr, de, pt, ast };
const requiredRecoveryKeys = [
  'navigation.preparing',
  'navigation.recovery',
  'navigation.reload',
  'navigation.ready',
  'locale.loadFailed',
  'locale.retry',
  'locale.storyFallback',
  'locale.legacyMigrated',
  'auth.verificationFailed',
  'auth.retryVerification',
  'voice.accessUnavailable',
  'voice.checkAccess',
  'voice.contactSupport',
  'voice.suspended',
  'voice.revoked',
  'voice.expired',
  'common.rateLimited',
  'common.retry',
];

function placeholders(template: string): string[] {
  return [...new Set(Array.from(template.matchAll(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g), (match) => match[1]))].sort();
}

// Dictionary completeness is not native-language review. In particular, shared
// words (e.g. Portuguese "Total") and proper names may equal Spanish correctly.
describe('six-locale dictionary contract', () => {
  const referenceKeys = collectTranslationKeys(es).sort();

  for (const [locale, dictionary] of Object.entries(dictionaries)) {
    it(`${locale} has exactly the complete Spanish leaf-key set and usable plain text`, () => {
      expect(collectTranslationKeys(dictionary).sort()).toEqual(referenceKeys);
      for (const key of referenceKeys) {
        const text = getByPath(dictionary, key);
        expect(typeof text, `${locale}:${key}`).toBe('string');
        expect((text as string).trim(), `${locale}:${key}`).not.toBe('');
        expect(text, `${locale}:${key}`).not.toMatch(/<\/?[a-z][^>]*>/i);
      }
    });

    it(`${locale} provides explicit readiness, language, auth, voice-access and rate-limit recovery copy`, () => {
      for (const key of requiredRecoveryKeys) {
        const text = getByPath(dictionary, key);
        expect(typeof text, `${locale}:${key} must not fall back to a dotted key`).toBe('string');
        expect((text as string).trim(), `${locale}:${key}`).not.toBe('');
        expect(text, `${locale}:${key}`).not.toBe(key);
      }
      expect(placeholders(getByPath(dictionary, 'common.rateLimited') as string))
        .toEqual(['seconds']);
    });

    it(`${locale} preserves every placeholder set, including booking and safety copy`, () => {
      for (const key of referenceKeys) {
        const reference = getByPath(es, key) as string;
        const text = getByPath(dictionary, key);
        expect(typeof text, `${locale}:${key}`).toBe('string');
        expect(placeholders(text as string), `${locale}:${key}`).toEqual(placeholders(reference));
      }
    });

    it(`${locale} renders every placeholder literally through the real interpolation helper`, () => {
      for (const key of referenceKeys) {
        const text = getByPath(dictionary, key) as string;
        const names = placeholders(text);
        if (names.length === 0) continue;
        const values = Object.fromEntries(names.map((name) => [name, `${name}: $& $1 $$ $\` $' <text>`]));
        const rendered = interpolate(text, values);
        for (const name of names) {
          expect(rendered, `${locale}:${key}:${name}`).toContain(values[name]);
          expect(rendered, `${locale}:${key}:${name}`).not.toContain(`{${name}}`);
        }
      }
    });
  }

  it('preserves literal dollar sequences at every repeated placeholder occurrence', () => {
    const literal = "$& $1 $$ $` $'";
    expect(interpolate('{amount} / {amount} / {hours}', { amount: literal, hours: 2 }))
      .toBe(`${literal} / ${literal} / 2`);
  });

  it('provides Asturian short playback and coherent booking/recovery terminology', () => {
    // These existing regressions are independently named, rather than treating
    // every identical Spanish/cognate value as missing translation.
    expect(getByPath(ast, 'accessibility.play_short')).toBe('Reproducir');
    expect(getByPath(ast, 'errors.generic_title')).toBe('Daqué salió mal');
    expect(getByPath(ast, 'booking.page.backToChat')).toBe('Tornar al asistente');
    expect(getByPath(ast, 'booking.page.steps.offer')).toBe('Ufierta aceptada');
  });
});
