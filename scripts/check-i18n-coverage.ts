import { es } from '../src/lib/i18n/es.js';
import { en } from '../src/lib/i18n/en.js';
import { fr } from '../src/lib/i18n/fr.js';
import { de } from '../src/lib/i18n/de.js';
import { pt } from '../src/lib/i18n/pt.js';
import { ast } from '../src/lib/i18n/ast.js';
import { STORY_TRANSLATIONS } from '../content/translations/story-translations.js';

function extractKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [key, val] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
      keys.push(...extractKeys(val as Record<string, unknown>, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

// UI Translation Analysis
const locales = { es, en, fr, de, pt, ast } as Record<string, Record<string, unknown>>;
const esKeys = new Set(extractKeys(es));
const targetLocales = ['en', 'fr', 'de', 'pt', 'ast'] as const;

console.log('=== UI TRANSLATION KEY ANALYSIS ===');
console.log(`Spanish (source of truth): ${esKeys.size} keys`);
console.log('');

for (const name of targetLocales) {
  const locale = locales[name];
  const localeKeys = new Set(extractKeys(locale));
  const missing = [...esKeys].filter(k => !localeKeys.has(k));
  const orphans = [...localeKeys].filter(k => !esKeys.has(k));
  console.log(`${name.toUpperCase()}: ${localeKeys.size} keys, missing: ${missing.length}${missing.length > 0 ? ` -> ${missing.join(', ')}` : ''}, orphans: ${orphans.length}${orphans.length > 0 ? ` -> ${orphans.join(', ')}` : ''}`);
}

// Story Translation Analysis
console.log('');
console.log('=== STORY TRANSLATION ANALYSIS ===');
const storyLocales = ['en', 'fr', 'de', 'pt', 'ast'] as const;
const slugs = Object.keys(STORY_TRANSLATIONS);
console.log(`Total story slugs: ${slugs.length}`);

const missingByLocale: Record<string, string[]> = {};
for (const loc of storyLocales) {
  missingByLocale[loc] = [];
}

for (const slug of slugs) {
  const translations = STORY_TRANSLATIONS[slug];
  for (const loc of storyLocales) {
    if (!translations[loc]) {
      missingByLocale[loc].push(slug);
    }
  }
}

for (const loc of storyLocales) {
  const missing = missingByLocale[loc];
  console.log(`${loc.toUpperCase()}: ${slugs.length - missing.length}/${slugs.length} stories, missing: ${missing.length}${missing.length > 0 ? ` -> ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? '...' : ''}` : ''}`);
}
