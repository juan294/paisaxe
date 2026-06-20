import { describe, it, expect } from 'vitest';
import { getLocalizedStory, hasTranslation, trimStoryTranslations, trimStoriesTranslations } from './localize-story';
import type { Story } from '@/types/immersive';

describe('getLocalizedStory', () => {
  const mockStory: Story = {
    id: 'test-story',
    title: 'Título en Español',
    subtitle: 'Subtítulo',
    description: 'Descripción del lugar.',
    image: '/test.jpg',
    category: 'nature',
    sourcePdf: 'test.pdf',
    metadata: {
      translations: {
        en: {
          title: 'English Title',
          subtitle: 'English Subtitle',
          description: 'Description of the place.',
        },
        fr: {
          title: 'Titre en Français',
          subtitle: 'Sous-titre',
          description: 'Description du lieu.',
        },
      },
    },
  };

  it('should return Spanish text when locale is es', () => {
    const result = getLocalizedStory(mockStory, 'es');
    expect(result.title).toBe('Título en Español');
    expect(result.subtitle).toBe('Subtítulo');
    expect(result.description).toBe('Descripción del lugar.');
  });

  it('should return English text when locale is en', () => {
    const result = getLocalizedStory(mockStory, 'en');
    expect(result.title).toBe('English Title');
    expect(result.subtitle).toBe('English Subtitle');
    expect(result.description).toBe('Description of the place.');
  });

  it('should return French text when locale is fr', () => {
    const result = getLocalizedStory(mockStory, 'fr');
    expect(result.title).toBe('Titre en Français');
    expect(result.subtitle).toBe('Sous-titre');
    expect(result.description).toBe('Description du lieu.');
  });

  it('should fallback to Spanish when locale has no translation', () => {
    const result = getLocalizedStory(mockStory, 'de');
    expect(result.title).toBe('Título en Español');
    expect(result.subtitle).toBe('Subtítulo');
    expect(result.description).toBe('Descripción del lugar.');
  });

  it('should fallback to Spanish when story has no translations', () => {
    const storyWithoutTranslations: Story = {
      ...mockStory,
      metadata: undefined,
    };
    const result = getLocalizedStory(storyWithoutTranslations, 'en');
    expect(result.title).toBe('Título en Español');
    expect(result.subtitle).toBe('Subtítulo');
    expect(result.description).toBe('Descripción del lugar.');
  });

  it('should handle partial translations by falling back individual fields', () => {
    const storyWithPartialTranslation: Story = {
      ...mockStory,
      metadata: {
        translations: {
          de: {
            title: 'Deutscher Titel',
            subtitle: '', // Empty
            description: 'Deutsche Beschreibung.',
          },
        },
      },
    };
    const result = getLocalizedStory(storyWithPartialTranslation, 'de');
    expect(result.title).toBe('Deutscher Titel');
    expect(result.subtitle).toBe('Subtítulo'); // Fallback to Spanish
    expect(result.description).toBe('Deutsche Beschreibung.');
  });

  it('should fallback title to Spanish when translation title is empty', () => {
    const storyWithEmptyTitle: Story = {
      ...mockStory,
      metadata: {
        translations: {
          de: {
            title: '', // Empty title
            subtitle: 'Deutscher Untertitel',
            description: 'Deutsche Beschreibung.',
          },
        },
      },
    };
    const result = getLocalizedStory(storyWithEmptyTitle, 'de');
    expect(result.title).toBe('Título en Español'); // Fallback to Spanish
    expect(result.subtitle).toBe('Deutscher Untertitel');
    expect(result.description).toBe('Deutsche Beschreibung.');
  });

  it('should fallback description to Spanish when translation description is empty', () => {
    const storyWithEmptyDescription: Story = {
      ...mockStory,
      metadata: {
        translations: {
          de: {
            title: 'Deutscher Titel',
            subtitle: 'Deutscher Untertitel',
            description: '', // Empty description
          },
        },
      },
    };
    const result = getLocalizedStory(storyWithEmptyDescription, 'de');
    expect(result.title).toBe('Deutscher Titel');
    expect(result.subtitle).toBe('Deutscher Untertitel');
    expect(result.description).toBe('Descripción del lugar.'); // Fallback to Spanish
  });
});

describe('hasTranslation', () => {
  const mockStory: Story = {
    id: 'test-story',
    title: 'Título',
    subtitle: 'Subtítulo',
    description: 'Descripción',
    image: '/test.jpg',
    category: 'nature',
    sourcePdf: 'test.pdf',
    metadata: {
      translations: {
        en: {
          title: 'Title',
          subtitle: 'Subtitle',
          description: 'Description',
        },
        fr: {
          title: 'Titre',
          subtitle: '',
          description: 'Description',
        },
      },
    },
  };

  it('should return true for Spanish (always available)', () => {
    expect(hasTranslation(mockStory, 'es')).toBe(true);
  });

  it('should return true when complete translation exists', () => {
    expect(hasTranslation(mockStory, 'en')).toBe(true);
  });

  it('should return false when translation is incomplete', () => {
    expect(hasTranslation(mockStory, 'fr')).toBe(false);
  });

  it('should return false when translation does not exist', () => {
    expect(hasTranslation(mockStory, 'de')).toBe(false);
  });

  it('should return false when story has no translations', () => {
    const storyWithoutMeta: Story = { ...mockStory, metadata: undefined };
    expect(hasTranslation(storyWithoutMeta, 'en')).toBe(false);
  });
});

// PE-M1: trimStoryTranslations strips all but the active locale + Spanish default
describe('trimStoryTranslations', () => {
  const storyWithAllLocales: Story = {
    id: 'test-story',
    title: 'Título en Español',
    subtitle: 'Subtítulo',
    description: 'Descripción.',
    image: '/test.jpg',
    category: 'nature',
    sourcePdf: 'test.pdf',
    metadata: {
      question_prompts: ['¿Qué ver?'],
      translations: {
        en: { title: 'English Title', subtitle: 'English Subtitle', description: 'Description.' },
        fr: { title: 'Titre', subtitle: 'Sous-titre', description: 'Description.' },
        de: { title: 'Titel', subtitle: 'Untertitel', description: 'Beschreibung.' },
        pt: { title: 'Título', subtitle: 'Subtítulo', description: 'Descrição.' },
        ast: { title: 'Títulu', subtitle: 'Subtítulu', description: 'Descripción.' },
      },
    },
  };

  it('PE-M1: keeps only the active locale translation when locale is non-Spanish', () => {
    const trimmed = trimStoryTranslations(storyWithAllLocales, 'en');
    const translations = trimmed.metadata?.translations ?? {};
    // Only the 'en' locale should remain
    expect(Object.keys(translations)).toEqual(['en']);
    expect(translations['en']).toBeDefined();
  });

  it('PE-M1: serialized payload no longer carries all 5 locales', () => {
    const trimmed = trimStoryTranslations(storyWithAllLocales, 'fr');
    const translations = trimmed.metadata?.translations ?? {};
    // Should not contain non-active locales
    expect(translations['en']).toBeUndefined();
    expect(translations['de']).toBeUndefined();
    expect(translations['pt']).toBeUndefined();
    expect(translations['ast']).toBeUndefined();
    // Should contain the active locale
    expect(translations['fr']).toBeDefined();
  });

  it('PE-M1: returns story unchanged when locale is Spanish (no translations needed)', () => {
    const trimmed = trimStoryTranslations(storyWithAllLocales, 'es');
    // Spanish returns the same reference (fast path)
    expect(trimmed).toBe(storyWithAllLocales);
  });

  it('PE-M1: returns story unchanged when no translations exist', () => {
    const noTranslations: Story = { ...storyWithAllLocales, metadata: { question_prompts: [] } };
    const trimmed = trimStoryTranslations(noTranslations, 'en');
    expect(trimmed).toBe(noTranslations);
  });

  it('PE-M1: preserves other metadata fields when trimming', () => {
    const trimmed = trimStoryTranslations(storyWithAllLocales, 'en');
    expect(trimmed.metadata?.question_prompts).toEqual(['¿Qué ver?']);
  });

  it('PE-M1: does not mutate the original story', () => {
    const original = storyWithAllLocales;
    trimStoryTranslations(original, 'en');
    // Original should still have all 5 locales
    expect(Object.keys(original.metadata?.translations ?? {})).toHaveLength(5);
  });

  it('PE-M1: trimStoriesTranslations applies to each story in an array', () => {
    const stories = [storyWithAllLocales, storyWithAllLocales];
    const trimmed = trimStoriesTranslations(stories, 'de');
    for (const s of trimmed) {
      const keys = Object.keys(s.metadata?.translations ?? {});
      expect(keys).toEqual(['de']);
    }
  });

  it('PE-M1: trimStoriesTranslations returns original array reference for Spanish (fast path)', () => {
    const stories = [storyWithAllLocales];
    const trimmed = trimStoriesTranslations(stories, 'es');
    expect(trimmed).toBe(stories);
  });
});
