import type { Story } from "@/types/immersive";

// LOCATION-SPECIFIC: Import fallback stories from content directory
// When replicating, replace content/fallback-stories.json with location-specific stories
import fallbackStoriesData from "@content/fallback-stories.json";
import { FALLBACK_STORY_TRANSLATIONS } from "@content/translations/fallback-story-translations.generated";
import { TRANSLATION_LOCALES } from "./translation-locales";

/**
 * Client-safe fallback stories dataset.
 *
 * FE-H1 (#759): this lives in its own module — with no `@/lib/logger` or
 * Supabase imports — so client code that needs a placeholder dataset (e.g.
 * `src/hooks/use-stories.ts`) does not have to import the server-only
 * `@/lib/stories-data` module to get it. `stories-data.ts` pulls in Pino
 * (via `@/lib/logger`), which transitively hits `request-context.ts`'s
 * `node:async_hooks` require — reaching the browser bundle previously
 * triggered a CSP `unsafe-eval` violation on every page load.
 *
 * LOCATION-SPECIFIC: Hardcoded fallback stories (used when database is
 * unavailable). These stories are loaded from content/fallback-stories.json
 * for easy content management.
 */
export const FALLBACK_STORIES: Story[] = (fallbackStoriesData.stories as Story[]).map(story => {
  const catalog = FALLBACK_STORY_TRANSLATIONS[story.slug ?? story.id];
  const sourcePrompts = story.metadata?.question_prompts ?? [];
  const translations = Object.fromEntries(TRANSLATION_LOCALES.flatMap(locale => {
    const translation = catalog?.[locale];
    if (!translation) return [];
    return [[locale, {
      ...story.metadata?.translations?.[locale],
      ...translation,
      // No local source questions exist today. Do not fabricate questions or
      // claim prompt completeness if a future source gains questions.
      ...(sourcePrompts.length === 0 ? { question_prompts: [] } : {}),
    }]];
  }));
  return { ...story, metadata: { ...story.metadata, translations: { ...story.metadata?.translations, ...translations } } };
});
