import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  mapLanguageTag,
  detectBrowserLanguage,
  getStoredLocale,
  storeLocale,
  resolveLocale,
} from './detect-language';

describe('detect-language', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('mapLanguageTag', () => {
    it('maps "es" to "es"', () => {
      expect(mapLanguageTag('es')).toBe('es');
    });

    it('maps "en" to "en"', () => {
      expect(mapLanguageTag('en')).toBe('en');
    });

    it('maps "es-ES" to "es"', () => {
      expect(mapLanguageTag('es-ES')).toBe('es');
    });

    it('maps "es-MX" to "es"', () => {
      expect(mapLanguageTag('es-MX')).toBe('es');
    });

    it('maps "en-US" to "en"', () => {
      expect(mapLanguageTag('en-US')).toBe('en');
    });

    it('maps "en-GB" to "en"', () => {
      expect(mapLanguageTag('en-GB')).toBe('en');
    });

    it('maps "EN-US" (uppercase) to "en"', () => {
      expect(mapLanguageTag('EN-US')).toBe('en');
    });

    it('returns null for unsupported languages', () => {
      expect(mapLanguageTag('fr')).toBeNull();
      expect(mapLanguageTag('de-DE')).toBeNull();
      expect(mapLanguageTag('ja')).toBeNull();
      expect(mapLanguageTag('zh-CN')).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(mapLanguageTag('')).toBeNull();
    });
  });

  describe('detectBrowserLanguage', () => {
    it('returns "en" when navigator.languages starts with "en-US"', () => {
      Object.defineProperty(navigator, 'languages', {
        value: ['en-US', 'en', 'es'],
        configurable: true,
      });
      expect(detectBrowserLanguage()).toBe('en');
    });

    it('returns "es" when navigator.languages starts with "es-ES"', () => {
      Object.defineProperty(navigator, 'languages', {
        value: ['es-ES', 'en-US'],
        configurable: true,
      });
      expect(detectBrowserLanguage()).toBe('es');
    });

    it('returns first supported language from navigator.languages', () => {
      Object.defineProperty(navigator, 'languages', {
        value: ['fr', 'de', 'en-GB'],
        configurable: true,
      });
      expect(detectBrowserLanguage()).toBe('en');
    });

    it('falls back to navigator.language when languages is empty', () => {
      Object.defineProperty(navigator, 'languages', {
        value: [],
        configurable: true,
      });
      Object.defineProperty(navigator, 'language', {
        value: 'es-AR',
        configurable: true,
      });
      expect(detectBrowserLanguage()).toBe('es');
    });

    it('returns "es" (default) when no supported language is found', () => {
      Object.defineProperty(navigator, 'languages', {
        value: ['fr', 'de', 'ja'],
        configurable: true,
      });
      Object.defineProperty(navigator, 'language', {
        value: 'fr',
        configurable: true,
      });
      expect(detectBrowserLanguage()).toBe('es');
    });

    it('returns "es" when navigator.language is also unsupported', () => {
      Object.defineProperty(navigator, 'languages', {
        value: [],
        configurable: true,
      });
      Object.defineProperty(navigator, 'language', {
        value: 'pt-BR',
        configurable: true,
      });
      expect(detectBrowserLanguage()).toBe('es');
    });
  });

  describe('getStoredLocale / storeLocale', () => {
    it('returns null when nothing is stored', () => {
      expect(getStoredLocale()).toBeNull();
    });

    it('stores and retrieves "en"', () => {
      storeLocale('en');
      expect(getStoredLocale()).toBe('en');
    });

    it('stores and retrieves "es"', () => {
      storeLocale('es');
      expect(getStoredLocale()).toBe('es');
    });

    it('returns null for invalid stored values', () => {
      localStorage.setItem('paisaxe-locale', 'fr');
      expect(getStoredLocale()).toBeNull();
    });

    it('returns null when localStorage throws', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('storage error');
      });
      expect(getStoredLocale()).toBeNull();
    });
  });

  describe('resolveLocale', () => {
    it('returns stored locale if available', () => {
      storeLocale('en');
      Object.defineProperty(navigator, 'languages', {
        value: ['es-ES'],
        configurable: true,
      });
      expect(resolveLocale()).toBe('en');
    });

    it('falls back to browser language when no stored locale', () => {
      Object.defineProperty(navigator, 'languages', {
        value: ['en-US'],
        configurable: true,
      });
      expect(resolveLocale()).toBe('en');
    });

    it('falls back to "es" when nothing is available', () => {
      Object.defineProperty(navigator, 'languages', {
        value: ['fr'],
        configurable: true,
      });
      Object.defineProperty(navigator, 'language', {
        value: 'fr',
        configurable: true,
      });
      expect(resolveLocale()).toBe('es');
    });
  });
});
