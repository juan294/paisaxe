// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { Story, StoryLocale, StoryTranslation } from '../src/types/immersive';
import { buildStoryLocaleCoverage } from './story-locale-coverage';

const questions: Record<StoryLocale, string> = {
  en: 'What can I visit here?', fr: 'Que puis-je visiter ici ?',
  de: 'Was kann ich hier besichtigen?', pt: 'O que posso visitar aqui?', ast: '¿Qué puedo visitar equí?',
};
const source: Story = {
  id: 'prompt-fixture', slug: 'prompt-fixture', title: 'Un lugar', subtitle: 'Una visita',
  description: 'Un lugar para visitar.', image: '/test.jpg', category: 'culture', sourcePdf: 'test.pdf',
  metadata: {
    question_prompts: ['¿Qué puedo visitar aquí?'],
    translations: Object.fromEntries(Object.entries(questions).map(([locale, question]) => [locale, {
      title: 'Title', subtitle: 'Subtitle', description: 'Description', question_prompts: [question],
    }])),
  },
};

describe('Phase 7 local story coverage evidence', () => {
  it('distinguishes complete served fallback text from vacuous prompt and unmeasured external evidence', () => {
    const report = buildStoryLocaleCoverage();
    expect(report.servedFallback.stories).toBe(25);
    expect(report.servedFallback.sourcePromptStories).toBe(0);
    for (const locale of ['es', 'en', 'fr', 'de', 'pt', 'ast'] as const) {
      expect(report.servedFallback.locales[locale]).toMatchObject({
        complete: 25, textComplete: 25, promptComplete: 0, incompleteSlugs: [],
      });
    }
    expect(report.staticCatalog).toMatchObject({ stories: 113, sourcePrompts: 'unknown' });
    expect(report.productionDatabase).toBe('unmeasured');
    expect(report.nativeLanguageReview).toBe('unmeasured');
  });

  it('exercises nonempty source questions in all six locales without calling them corpus evidence', () => {
    const report = buildStoryLocaleCoverage([source]);
    expect(report.servedFallback.sourcePromptStories).toBe(1);
    for (const locale of ['es', 'en', 'fr', 'de', 'pt', 'ast'] as const) {
      expect(report.servedFallback.locales[locale]).toMatchObject({ complete: 1, textComplete: 1, promptComplete: 1, incompleteSlugs: [] });
    }
    expect(report.productionDatabase).toBe('unmeasured');
  });

  it.each([
    { label: 'missing subtitle', delta: { subtitle: '' }, textComplete: 0 },
    { label: 'blank description', delta: { description: ' ' }, textComplete: 0 },
    { label: 'missing questions', delta: { question_prompts: undefined }, textComplete: 1 },
    { label: 'wrong question count', delta: { question_prompts: ['First?', 'Second?'] }, textComplete: 1 },
  ])('reports $label as a concrete incomplete slug', ({ delta, textComplete }) => {
    const broken: Story = {
      ...source,
      metadata: {
        ...source.metadata,
        translations: { ...source.metadata!.translations, en: { ...source.metadata!.translations!.en, ...delta } as StoryTranslation },
      },
    };
    const report = buildStoryLocaleCoverage([broken]);
    expect(report.servedFallback.locales.en).toMatchObject({ complete: 0, textComplete, incompleteSlugs: ['prompt-fixture'] });
    expect(report.servedFallback.locales.fr.complete).toBe(1);
  });
});
