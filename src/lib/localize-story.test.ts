import { describe, it, expect } from 'vitest';
import { getLocalizedStory, hasTranslation } from './localize-story';
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
