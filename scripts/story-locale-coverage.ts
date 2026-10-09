import { fileURLToPath } from 'node:url';
import type { Story, StoryTranslation } from '../src/types/immersive';
import type { Locale } from '../src/lib/i18n/types';
import { STORY_TRANSLATIONS } from '../content/translations/story-translations';
import { FALLBACK_STORIES } from '../src/lib/stories-fallback';
import { TRANSLATION_LOCALES } from '../src/lib/translation-locales';
import { hasCompleteStoryText, hasCompleteStoryPrompts } from '../src/lib/localize-story';

interface LocaleStoryCoverage {
  complete: number;
  textComplete: number;
  promptComplete: number;
  incompleteSlugs: string[];
}

/** Checked-in/local data only. Does not contact a database or translation provider. */
export function buildStoryLocaleCoverage(stories: readonly Story[] = FALLBACK_STORIES) {
  const locales = Object.fromEntries((['es', ...TRANSLATION_LOCALES] as Locale[]).map(locale => {
    const coverage: LocaleStoryCoverage = { complete: 0, textComplete: 0, promptComplete: 0, incompleteSlugs: [] };
    for (const story of stories) {
      const source = { ...story, question_prompts: story.metadata?.question_prompts };
      const translation: StoryTranslation | undefined = locale === 'es'
        ? { title: story.title, subtitle: story.subtitle, description: story.description, question_prompts: source.question_prompts }
        : story.metadata?.translations?.[locale];
      const textComplete = hasCompleteStoryText(source, translation);
      const promptsComplete = hasCompleteStoryPrompts(source, translation);
      if (textComplete) coverage.textComplete++;
      if (source.question_prompts?.length && promptsComplete) coverage.promptComplete++;
      if (textComplete && promptsComplete) coverage.complete++;
      else coverage.incompleteSlugs.push(story.slug ?? story.id);
    }
    return [locale, coverage];
  })) as Record<Locale, LocaleStoryCoverage>;
  const catalogEntries = Object.entries(STORY_TRANSLATIONS);
  const knownSources = new Set(stories.map(story => story.slug ?? story.id));

  return {
    servedFallback: {
      stories: stories.length,
      sourcePromptStories: stories.filter(story => story.metadata?.question_prompts?.length).length,
      promptInterpretation: 'Zero eligible source stories is empty-source coverage, not exercised translation of nonempty questions.',
      locales,
    },
    staticCatalog: {
      stories: catalogEntries.length,
      sourcePrompts: 'unknown' as const,
      sourceUnknownSlugs: catalogEntries.map(([slug]) => slug).filter(slug => !knownSources.has(slug)),
      locales: Object.fromEntries(TRANSLATION_LOCALES.map(locale => [locale, {
        textEntries: catalogEntries.filter(([, entry]) => {
          const text = entry[locale];
          return text && [text.title, text.subtitle, text.description].every(value => typeof value === 'string' && value.trim());
        }).length,
        entriesWithoutPromptField: catalogEntries.filter(([, entry]) => entry[locale]?.question_prompts === undefined).length,
      }])),
      interpretation: 'Translation entries alone do not establish source-question eligibility or current database coverage.',
    },
    productionDatabase: 'unmeasured' as const,
    nativeLanguageReview: 'unmeasured' as const,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const report = buildStoryLocaleCoverage();
  console.log(JSON.stringify(report, null, 2));
  if (Object.values(report.servedFallback.locales).some(locale => locale.incompleteSlugs.length > 0)) process.exitCode = 1;
}
