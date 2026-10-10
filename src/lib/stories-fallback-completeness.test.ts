// @vitest-environment node
import { describe, expect, it } from 'vitest';
import fallback from '../../content/fallback-stories.json';
import { STORY_TRANSLATIONS } from '../../content/translations/story-translations';
import { FALLBACK_STORY_TRANSLATIONS } from '../../content/translations/fallback-story-translations.generated';
import { FALLBACK_STORIES } from './stories-fallback';
import { getLocalizedStory, hasTranslation } from './localize-story';
import { TRANSLATION_LOCALES } from './translation-locales';

describe('Phase 7 actually served local fallback content', () => {
  it('ships exactly the fallback translations with every approved field intact', () => {
    const slugs = fallback.stories.map(story => story.slug ?? story.id);
    expect(Object.keys(FALLBACK_STORY_TRANSLATIONS).sort()).toEqual([...slugs].sort());
    for (const slug of slugs) {
      expect(FALLBACK_STORY_TRANSLATIONS[slug], `${slug}: regenerate fallback translations`).toEqual(STORY_TRANSLATIONS[slug]);
    }
  });

  it('preserves the original 25 story identities and Spanish source fields', () => {
    expect(FALLBACK_STORIES).toHaveLength(25);
    expect(FALLBACK_STORIES.map(({ metadata: _metadata, ...story }) => story)).toEqual(fallback.stories);
    expect(fallback.stories.every(story => !('metadata' in story))).toBe(true);
  });

  it.each(TRANSLATION_LOCALES)('serves approved %s text for every fallback story with explicit empty questions', (locale) => {
    for (const story of FALLBACK_STORIES) {
      const expected = STORY_TRANSLATIONS[story.slug ?? story.id]?.[locale];
      expect(expected, `${story.slug}:${locale} catalog entry`).toBeDefined();
      expect(getLocalizedStory(story, locale), `${story.slug}:${locale} served text`).toEqual({
        title: expected!.title, subtitle: expected!.subtitle, description: expected!.description,
      });
      expect(story.metadata?.translations?.[locale]?.question_prompts, `${story.slug}:${locale} empty-source questions`).toEqual([]);
      expect(hasTranslation(story, locale), `${story.slug}:${locale} source-aware completeness`).toBe(true);
    }
  });

  it('does not invent source questions for a corpus that contains none', () => {
    expect(FALLBACK_STORIES.filter(story => story.metadata?.question_prompts?.length)).toHaveLength(0);
  });
});
