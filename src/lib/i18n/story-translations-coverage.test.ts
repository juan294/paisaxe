import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { STORY_TRANSLATIONS } from '../../../content/translations/story-translations';
import type { StoryLocale } from '@/types/immersive';

const TARGET_LOCALES: StoryLocale[] = ['en', 'fr', 'de', 'pt', 'ast'];

// Slugs from seed-database.ts (ALL_STORIES — static, rarely change)
const SEED_DATABASE_SLUGS = [
  'lagos-covadonga', 'oviedo-catedral', 'fabada', 'prerromanico', 'ruta-cares',
  'playa-silencio', 'sidra', 'gijon', 'aviles', 'camino-santiago',
  'llanes', 'cangas-onis', 'descenso-sella', 'quesos-asturianos', 'museo-jurrasico',
  'senda-oso', 'cudillero', 'taramundi', 'bufones-pria', 'luarca',
];

// Slugs from seed-cycling-stories.ts (static)
const SEED_CYCLING_SLUGS = [
  'angliru-bestia-asturias', 'lagos-covadonga-bicicleta', 'vias-verdes-asturias',
  'ruta-costera-llanes-niembro', 'camino-santiago-bicicleta',
];

function readJsonSlugs(relativePath: string): string[] {
  const absPath = join(process.cwd(), relativePath);
  if (!existsSync(absPath)) return [];
  try {
    const raw = JSON.parse(readFileSync(absPath, 'utf-8')) as
      | { slug?: string }[]
      | { stories?: { slug?: string }[] };
    const items = Array.isArray(raw) ? raw : (raw.stories ?? []);
    return items.map((s) => s.slug).filter((s): s is string => Boolean(s));
  } catch {
    return [];
  }
}

// Static sources are always available (committed). Processed sources are
// gitignored and only available locally or when the pipeline has run.
const staticSlugs = new Set([
  ...SEED_DATABASE_SLUGS,
  ...SEED_CYCLING_SLUGS,
  ...readJsonSlugs('content/fallback-stories.json'),
]);

const processedSlugs = new Set([
  ...readJsonSlugs('content/processed/extracted-stories.json'),
  ...readJsonSlugs('content/processed/generated-stories.json'),
]);

const allKnownSlugs = new Set([...staticSlugs, ...processedSlugs]);

function assertFullCoverage(slugs: Iterable<string>, label: string) {
  const missing: string[] = [];
  for (const slug of slugs) {
    for (const locale of TARGET_LOCALES) {
      const t = STORY_TRANSLATIONS[slug]?.[locale];
      if (!t?.title || !t?.description) {
        missing.push(`${slug}:${locale}`);
      }
    }
  }
  expect(
    missing,
    `${label} — add missing entries to content/translations/story-translations.ts`,
  ).toEqual([]);
}

describe('story translation coverage', () => {
  it('all static seed slugs have translations for every target locale', () => {
    assertFullCoverage(staticSlugs, 'Missing static story translations');
  });

  it('all processed story slugs have translations when content/processed/ is available', () => {
    if (processedSlugs.size === 0) return; // gracefully skip when files are absent (CI)
    assertFullCoverage(processedSlugs, 'Missing processed story translations');
  });

  it('all known story slugs have translations for every target locale', () => {
    assertFullCoverage(allKnownSlugs, 'Missing story translations');
  });
});
