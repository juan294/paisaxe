import { describe, it, expect } from 'vitest';
import { resolveTranslation } from './resolve';
import { es } from './es';
import { en } from './en';
import { fr } from './fr';
import { de } from './de';
import { pt } from './pt';
import type { Translations } from './types';

const testTranslations: Translations = {
  common: {
    loading: 'Cargando...',
    error: 'Error',
  },
  chat: {
    placeholder: 'Escribe tu pregunta...',
    nested: {
      deep: 'Valor profundo',
    },
  },
  simple: 'Simple value',
};

describe('resolveTranslation', () => {
  it('resolves a top-level key', () => {
    expect(resolveTranslation('simple', testTranslations)).toBe('Simple value');
  });

  it('resolves a dot-notation key one level deep', () => {
    expect(resolveTranslation('common.loading', testTranslations)).toBe('Cargando...');
  });

  it('resolves a dot-notation key two levels deep', () => {
    expect(resolveTranslation('chat.placeholder', testTranslations)).toBe('Escribe tu pregunta...');
  });

  it('resolves a deeply nested key (three levels)', () => {
    expect(resolveTranslation('chat.nested.deep', testTranslations)).toBe('Valor profundo');
  });

  it('returns the key itself when key is missing', () => {
    expect(resolveTranslation('nonexistent.key', testTranslations)).toBe('nonexistent.key');
  });

  it('returns the key itself when partial path exists but leaf is missing', () => {
    expect(resolveTranslation('common.nonexistent', testTranslations)).toBe('common.nonexistent');
  });

  it('returns the key itself when path points to an object, not a string', () => {
    expect(resolveTranslation('common', testTranslations)).toBe('common');
  });

  it('returns the key itself for an empty string key', () => {
    expect(resolveTranslation('', testTranslations)).toBe('');
  });

  it('returns the key itself for a completely wrong path', () => {
    expect(resolveTranslation('a.b.c.d.e', testTranslations)).toBe('a.b.c.d.e');
  });

  it('returns the key when an intermediate value is a string (not an object)', () => {
    // 'simple' resolves to "Simple value" (a string), then trying to access 'child' on it
    // should hit the typeof !== 'object' branch and return the full key
    expect(resolveTranslation('simple.child', testTranslations)).toBe('simple.child');
  });

  it('does not crash with empty translations object', () => {
    expect(resolveTranslation('anything', {})).toBe('anything');
  });

  it('resolves correctly with actual Spanish locale keys', () => {
    expect(resolveTranslation('common.loading', es)).toBe('Cargando...');
    expect(resolveTranslation('chat.placeholder', es)).toBe('Escribe tu pregunta...');
    expect(resolveTranslation('stories.filters.category', es)).toBe('Categoría');
  });

  it('resolves correctly with actual English locale keys', () => {
    expect(resolveTranslation('common.loading', en)).toBe('Loading...');
    expect(resolveTranslation('chat.placeholder', en)).toBe('Ask about this place...');
    expect(resolveTranslation('stories.filters.category', en)).toBe('Category');
  });

  it('resolves correctly with actual French locale keys', () => {
    expect(resolveTranslation('common.loading', fr)).toBe('Chargement...');
    expect(resolveTranslation('chat.placeholder', fr)).toBe('Posez une question sur ce lieu...');
    expect(resolveTranslation('stories.filters.category', fr)).toBe('Catégorie');
  });

  it('resolves correctly with actual German locale keys', () => {
    expect(resolveTranslation('common.loading', de)).toBe('Laden...');
    expect(resolveTranslation('chat.placeholder', de)).toBe('Fragen Sie nach diesem Ort...');
    expect(resolveTranslation('stories.filters.category', de)).toBe('Kategorie');
  });

  it('resolves correctly with actual Portuguese locale keys', () => {
    expect(resolveTranslation('common.loading', pt)).toBe('Carregando...');
    expect(resolveTranslation('chat.placeholder', pt)).toBe('Pergunte sobre este lugar...');
    expect(resolveTranslation('stories.filters.category', pt)).toBe('Categoria');
  });
});
