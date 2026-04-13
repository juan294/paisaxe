/**
 * Compare leaf translation keys across all locale files.
 * Spanish (es) is the source of truth.
 *
 * Usage: npx tsx scripts/compare-i18n-keys.ts
 */

import { es } from '../src/lib/i18n/es';
import { en } from '../src/lib/i18n/en';
import { fr } from '../src/lib/i18n/fr';
import { de } from '../src/lib/i18n/de';
import { pt } from '../src/lib/i18n/pt';
import { ast } from '../src/lib/i18n/ast';

type NestedObj = { [key: string]: string | NestedObj };

function getLeafKeys(obj: NestedObj, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') {
      keys.push(path);
    } else if (typeof value === 'object' && value !== null) {
      keys.push(...getLeafKeys(value as NestedObj, path));
    }
  }
  return keys.sort();
}

const locales: Record<string, NestedObj> = { es, en, fr, de, pt, ast };
const esKeys = new Set(getLeafKeys(es as NestedObj));

console.log('=== i18n Leaf Key Comparison ===');
console.log(`\nSource of truth: es (${esKeys.size} leaf keys)\n`);

const allLocaleKeys: Record<string, Set<string>> = {};

for (const [name, obj] of Object.entries(locales)) {
  const keys = new Set(getLeafKeys(obj as NestedObj));
  allLocaleKeys[name] = keys;
}

// Summary table
console.log('--- Leaf Key Counts ---');
for (const [name, keys] of Object.entries(allLocaleKeys)) {
  const missing = [...esKeys].filter(k => !keys.has(k));
  const orphaned = [...keys].filter(k => !esKeys.has(k));
  console.log(
    `  ${name.padEnd(4)} : ${String(keys.size).padStart(4)} keys | ` +
    `${String(missing.length).padStart(3)} missing | ` +
    `${String(orphaned.length).padStart(3)} orphaned`
  );
}

// Details per locale
for (const [name, keys] of Object.entries(allLocaleKeys)) {
  if (name === 'es') continue;

  const missing = [...esKeys].filter(k => !keys.has(k)).sort();
  const orphaned = [...keys].filter(k => !esKeys.has(k)).sort();

  if (missing.length === 0 && orphaned.length === 0) {
    console.log(`\n--- ${name} : PERFECT MATCH ---`);
    continue;
  }

  console.log(`\n--- ${name} ---`);

  if (missing.length > 0) {
    console.log(`  Missing (${missing.length} keys not in ${name} but in es):`);
    for (const k of missing) {
      console.log(`    - ${k}`);
    }
  }

  if (orphaned.length > 0) {
    console.log(`  Orphaned (${orphaned.length} keys in ${name} but not in es):`);
    for (const k of orphaned) {
      console.log(`    + ${k}`);
    }
  }
}
