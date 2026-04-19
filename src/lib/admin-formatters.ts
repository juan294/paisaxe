/**
 * admin-formatters.ts
 *
 * Shared formatting helpers and story metadata utilities for admin components.
 * Extracted from src/app/admin/page.tsx (AR-M2) to reduce per-file change surface.
 */

import type { AdminStory } from "@/types/admin";
import type { StoryMetadata, StoryLocale, TranslationStatus } from "@/types/immersive";

/** All locales that require a complete translation for a story. */
export const TRANSLATION_LOCALES: StoryLocale[] = ["en", "fr", "de", "pt", "ast"];

/**
 * Returns true if a story is missing any required translation.
 * A locale is considered "missing" if:
 *  - It has no translation content (title/subtitle/description), OR
 *  - Its status is not "complete"
 */
export function hasMissingTranslations(story: AdminStory): boolean {
  const metadata = story.metadata as StoryMetadata | undefined;
  if (!metadata) return true;

  const translations = metadata.translations || {};
  const status = metadata.translation_status || {};

  for (const locale of TRANSLATION_LOCALES) {
    const translation = translations[locale];
    const localeStatus = status[locale] as TranslationStatus | undefined;

    const hasContent =
      translation &&
      (translation.title?.trim() ||
        translation.subtitle?.trim() ||
        translation.description?.trim());

    if (!hasContent || localeStatus?.status !== "complete") {
      return true;
    }
  }

  return false;
}
