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

    it('maps "fr" to "fr"', () => {
      expect(mapLanguageTag('fr')).toBe('fr');
    });

    it('maps "fr-FR" to "fr"', () => {
      expect(mapLanguageTag('fr-FR')).toBe('fr');
    });

    it('maps "fr-CA" to "fr"', () => {
      expect(mapLanguageTag('fr-CA')).toBe('fr');
    });

    it('maps "de" to "de"', () => {
      expect(mapLanguageTag('de')).toBe('de');
    });

    it('maps "de-DE" to "de"', () => {
      expect(mapLanguageTag('de-DE')).toBe('de');
    });

    it('maps "de-AT" to "de"', () => {
      expect(mapLanguageTag('de-AT')).toBe('de');
    });

    it('maps "pt" to "pt"', () => {
      expect(mapLanguageTag('pt')).toBe('pt');
    });

    it('maps "pt-BR" to "pt"', () => {
      expect(mapLanguageTag('pt-BR')).toBe('pt');
    });

    it('maps "pt-PT" to "pt"', () => {
      expect(mapLanguageTag('pt-PT')).toBe('pt');
    });

    it('returns null for unsupported languages', () => {
      expect(mapLanguageTag('ja')).toBeNull();
      expect(mapLanguageTag('zh-CN')).toBeNull();
      expect(mapLanguageTag('ko')).toBeNull();
      expect(mapLanguageTag('ar')).toBeNull();
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
        value: ['ja', 'ko', 'en-GB'],
        configurable: true,
      });
      expect(detectBrowserLanguage()).toBe('en');
    });

    it('returns "fr" when navigator.languages starts with "fr-FR"', () => {
      Object.defineProperty(navigator, 'languages', {
        value: ['fr-FR', 'en-US'],
        configurable: true,
      });
      expect(detectBrowserLanguage()).toBe('fr');
    });

    it('returns "de" when navigator.languages starts with "de-DE"', () => {
      Object.defineProperty(navigator, 'languages', {
        value: ['de-DE', 'en-US'],
        configurable: true,
      });
      expect(detectBrowserLanguage()).toBe('de');
    });

    it('returns "pt" when navigator.languages starts with "pt-BR"', () => {
      Object.defineProperty(navigator, 'languages', {
        value: ['pt-BR', 'en-US'],
        configurable: true,
      });
      expect(detectBrowserLanguage()).toBe('pt');
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
        value: ['ja', 'ko', 'zh'],
        configurable: true,
      });
      Object.defineProperty(navigator, 'language', {
        value: 'ja',
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
        value: 'ar',
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

    it('stores and retrieves "fr"', () => {
      storeLocale('fr');
      expect(getStoredLocale()).toBe('fr');
    });

    it('stores and retrieves "de"', () => {
      storeLocale('de');
      expect(getStoredLocale()).toBe('de');
    });

    it('stores and retrieves "pt"', () => {
      storeLocale('pt');
      expect(getStoredLocale()).toBe('pt');
    });

    it('returns null for invalid stored values', () => {
      localStorage.setItem('paisaxe-locale', 'ja');
      expect(getStoredLocale()).toBeNull();
    });

    it('returns null when localStorage throws', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('storage error');
      });
      expect(getStoredLocale()).toBeNull();
    });
  });

  describe('detectBrowserLanguage — navigator.language fallback edge cases', () => {
    it('returns default "es" when navigator.languages is empty and navigator.language is empty string', () => {
      Object.defineProperty(navigator, 'languages', {
        value: [],
        configurable: true,
      });
      Object.defineProperty(navigator, 'language', {
        value: '',
        configurable: true,
      });
      // Empty string is falsy, so the navigator.language branch is skipped
      expect(detectBrowserLanguage()).toBe('es');
    });
  });

  describe('getStoredLocale server-side (line 53)', () => {
    it('returns null when window is undefined (server-side)', () => {
      const originalWindow = globalThis.window;
      // @ts-expect-error - deliberately setting window to undefined for test
      globalThis.window = undefined;
      try {
        expect(getStoredLocale()).toBeNull();
      } finally {
        globalThis.window = originalWindow;
      }
    });
  });

  describe('storeLocale server-side (line 71)', () => {
    it('does nothing when window is undefined (server-side)', () => {
      const originalWindow = globalThis.window;
      // @ts-expect-error - deliberately setting window to undefined for test
      globalThis.window = undefined;
      try {
        // Should not throw
        storeLocale('en');
      } finally {
        globalThis.window = originalWindow;
      }
    });
  });

  describe('storeLocale error handling', () => {
    it('silently ignores localStorage setItem errors', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('quota exceeded');
      });
      // Should not throw
      expect(() => storeLocale('fr')).not.toThrow();
    });
  });

  describe('detectBrowserLanguage server-side (line 27)', () => {
    it('returns default locale "es" when navigator is undefined (server-side)', () => {
      const originalNavigator = globalThis.navigator;
      // Temporarily remove navigator to simulate server-side environment
      // @ts-expect-error - deliberately setting navigator to undefined for test
      globalThis.navigator = undefined;
      try {
        expect(detectBrowserLanguage()).toBe('es');
      } finally {
        globalThis.navigator = originalNavigator;
      }
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
        value: ['ja'],
        configurable: true,
      });
      Object.defineProperty(navigator, 'language', {
        value: 'ja',
        configurable: true,
      });
      expect(resolveLocale()).toBe('es');
    });

    it('returns "fr" when browser language is French', () => {
      Object.defineProperty(navigator, 'languages', {
        value: ['fr-FR'],
        configurable: true,
      });
      expect(resolveLocale()).toBe('fr');
    });

    it('returns "de" when browser language is German', () => {
      Object.defineProperty(navigator, 'languages', {
        value: ['de-DE'],
        configurable: true,
      });
      expect(resolveLocale()).toBe('de');
    });

    it('returns "pt" when browser language is Portuguese', () => {
      Object.defineProperty(navigator, 'languages', {
        value: ['pt-BR'],
        configurable: true,
      });
      expect(resolveLocale()).toBe('pt');
    });
  });
});
