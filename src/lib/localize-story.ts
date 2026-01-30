import type { Story, StoryLocale } from '@/types/immersive';
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
