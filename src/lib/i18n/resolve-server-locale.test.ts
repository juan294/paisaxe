/**
 * Tests for the server-side locale resolution utility.
 *
 * FE-M4: resolveServerLocale() must pick the correct locale from HTTP
 * headers so the SSR HTML uses the right language from the first byte.
 */
import { describe, it, expect } from 'vitest';
import {
  mapLanguageTagServer,
  parseAcceptLanguage,
  resolveServerLocale,
} from './resolve-server-locale';

describe('mapLanguageTagServer', () => {
  it('maps "es" to "es"', () => {
    expect(mapLanguageTagServer('es')).toBe('es');
  });

  it('maps "en" to "en"', () => {
    expect(mapLanguageTagServer('en')).toBe('en');
  });

  it('maps "es-ES" to "es"', () => {
    expect(mapLanguageTagServer('es-ES')).toBe('es');
  });

  it('maps "en-US" to "en"', () => {
    expect(mapLanguageTagServer('en-US')).toBe('en');
  });

  it('maps "fr-FR" to "fr"', () => {
    expect(mapLanguageTagServer('fr-FR')).toBe('fr');
  });

  it('maps "de-DE" to "de"', () => {
    expect(mapLanguageTagServer('de-DE')).toBe('de');
  });

  it('maps "pt-BR" to "pt"', () => {
    expect(mapLanguageTagServer('pt-BR')).toBe('pt');
  });

  it('maps "ast" to "ast"', () => {
    expect(mapLanguageTagServer('ast')).toBe('ast');
  });

  it('returns null for unsupported "ja"', () => {
    expect(mapLanguageTagServer('ja')).toBeNull();
  });

  it('returns null for unsupported "zh-CN"', () => {
    expect(mapLanguageTagServer('zh-CN')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(mapLanguageTagServer('')).toBeNull();
  });

  it('handles uppercase input (case-insensitive)', () => {
    expect(mapLanguageTagServer('EN-US')).toBe('en');
  });
});

describe('parseAcceptLanguage', () => {
  it('returns null for empty string', () => {
    expect(parseAcceptLanguage('')).toBeNull();
  });

  it('parses simple "en" header', () => {
    expect(parseAcceptLanguage('en')).toBe('en');
  });

  it('parses "fr-FR,fr;q=0.9,en;q=0.8"', () => {
    expect(parseAcceptLanguage('fr-FR,fr;q=0.9,en;q=0.8')).toBe('fr');
  });

  it('parses "es-ES,es;q=0.9,en;q=0.8"', () => {
    expect(parseAcceptLanguage('es-ES,es;q=0.9,en;q=0.8')).toBe('es');
  });

  it('falls back to supported language when first entry is unsupported', () => {
    // "ja" is not supported, "en" is
    expect(parseAcceptLanguage('ja;q=1.0,en;q=0.8')).toBe('en');
  });

  it('returns null when no entry is supported', () => {
    expect(parseAcceptLanguage('ja,zh-CN,ko')).toBeNull();
  });

  it('respects quality values — picks highest-quality supported locale', () => {
    // "de" q=0.9 beats "en" q=0.8
    expect(parseAcceptLanguage('ja;q=1.0,de;q=0.9,en;q=0.8')).toBe('de');
  });

  it('handles entries with whitespace', () => {
    expect(parseAcceptLanguage(' en-US , fr ; q=0.9')).toBe('en');
  });

  it('handles case-insensitive quality parameter', () => {
    expect(parseAcceptLanguage('fr;Q=0.9,en;Q=0.8')).toBe('fr');
  });

  it('parses "de-DE,de;q=0.9,en-US;q=0.8"', () => {
    expect(parseAcceptLanguage('de-DE,de;q=0.9,en-US;q=0.8')).toBe('de');
  });

  it('parses "pt-BR,pt;q=0.9,es;q=0.8"', () => {
    expect(parseAcceptLanguage('pt-BR,pt;q=0.9,es;q=0.8')).toBe('pt');
  });
});

describe('resolveServerLocale', () => {
  it('returns "es" (default) when both inputs are null', () => {
    expect(resolveServerLocale(null, null)).toBe('es');
  });

  it('returns "es" (default) when both inputs are empty', () => {
    expect(resolveServerLocale('', '')).toBe('es');
  });

  it('prefers stored locale cookie over Accept-Language', () => {
    expect(
      resolveServerLocale(
        'paisaxe-locale=en; other=value',
        'fr-FR,fr;q=0.9',
      ),
    ).toBe('en');
  });

  it('falls back to Accept-Language when no cookie is set', () => {
    expect(resolveServerLocale(null, 'fr-FR,fr;q=0.9,en;q=0.8')).toBe('fr');
  });

  it('falls back to Accept-Language when cookie has unknown locale', () => {
    expect(
      resolveServerLocale(
        'paisaxe-locale=ja',  // unsupported
        'de-DE,de;q=0.9',
      ),
    ).toBe('de');
  });

  it('returns "es" (default) when Accept-Language has no supported locale', () => {
    expect(resolveServerLocale(null, 'ja,zh-CN,ko')).toBe('es');
  });

  it('parses cookie from multi-value cookie header', () => {
    const cookies = 'session=abc; paisaxe-locale=pt; other=xyz';
    expect(resolveServerLocale(cookies, 'en')).toBe('pt');
  });

  it('handles "ast" locale stored in cookie', () => {
    expect(resolveServerLocale('paisaxe-locale=ast', null)).toBe('ast');
  });

  it('handles "fr" from Accept-Language', () => {
    expect(resolveServerLocale(null, 'fr')).toBe('fr');
  });

  it('handles "de" from Accept-Language', () => {
    expect(resolveServerLocale(null, 'de')).toBe('de');
  });

  it('ignores invalid locale in cookie (non-supported value)', () => {
    // "zz" is not in SUPPORTED_LOCALES
    expect(
      resolveServerLocale('paisaxe-locale=zz', 'en-US'),
    ).toBe('en');
  });
});
