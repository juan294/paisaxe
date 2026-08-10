import type { Story, StoryLocale, StoryMetadata } from '@/types/immersive';
import type { Locale } from '@/lib/i18n';

/**
 * Get localized story text based on the current locale.
 * Falls back to Spanish (the default) if translation is not available.
 *
 * @param story - The story to localize
 * @param locale - The target locale
 * @returns Object with localized title, subtitle, and description
 */
export function getLocalizedStory(
  story: Story,
  locale: Locale
): { title: string; subtitle: string; description: string } {
  // Spanish is the default - use the story's main fields
  if (locale === 'es') {
    return {
      title: story.title,
      subtitle: story.subtitle,
      description: story.description,
    };
  }

  // Check if we have a translation for this locale
  const translation = story.metadata?.translations?.[locale as StoryLocale];

  if (translation) {
    return {
      title: translation.title || story.title,
      subtitle: translation.subtitle || story.subtitle,
      description: translation.description || story.description,
    };
  }

  // Fallback to Spanish
  return {
    title: story.title,
    subtitle: story.subtitle,
    description: story.description,
  };
}

/**
 * Check if a story has a translation for the given locale
 */
export function hasTranslation(story: Story, locale: Locale): boolean {
  if (locale === 'es') return true;
  const translation = story.metadata?.translations?.[locale as StoryLocale];
  return !!(translation?.title && translation?.subtitle && translation?.description);
}

/**
 * PE-M1: Trim story translations to only the active locale (plus Spanish default).
 *
 * The metadata.translations object can hold up to 5 non-Spanish locale entries.
 * Shipping all of them client-side inflates the JSON payload for every story even
 * though only one locale is displayed at a time. This function strips the unused
 * locale translations so the client payload only carries what it needs.
 *
 * Spanish (the default) lives in story.title/subtitle/description — it is never
 * inside translations — so it is always available. Only the currently-active
 * non-Spanish locale is kept inside translations.
 *
 * Language switching still works: if the user switches locale, the active locale
 * translation is already in the payload (it was the selected one at hydration) and
 * Spanish always falls back from the story's own fields. Switching to a third locale
 * that wasn't pre-loaded will transparently fall back to Spanish — the same behaviour
 * as if the translation simply didn't exist.
 *
 * @param story - Story to trim
 * @param locale - The active display locale
 * @returns A new Story object with trimmed translations (immutable — original unchanged)
 */
export function trimStoryTranslations(story: Story, locale: Locale): Story {
  // Spanish is always available from the story's own fields — no translations needed
  if (locale === 'es' || !story.metadata?.translations) {
    return story;
  }

  const activeKey = locale as StoryLocale;
  const activeTranslation = story.metadata.translations[activeKey];

  // Keep only the active locale's translation (drop all others)
  const trimmedTranslations = activeTranslation
    ? { [activeKey]: activeTranslation }
    : {};

  return {
    ...story,
    metadata: {
      ...story.metadata,
      translations: trimmedTranslations as StoryMetadata['translations'],
    },
  };
}

/**
 * PE-M1: Trim translations for a batch of stories.
 * Applies trimStoryTranslations to each story for the given active locale.
 */
export function trimStoriesTranslations(stories: Story[], locale: Locale): Story[] {
  // Fast path: Spanish locale means no translations are needed at all
  if (locale === 'es') return stories;
  return stories.map((s) => trimStoryTranslations(s, locale));
}
