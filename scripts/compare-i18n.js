const fs = require('fs');

// Parse all locale files to extract key paths
function extractKeys(content) {
  const keys = new Set();

  // Remove comments
  content = content.replace(/\/\/.*$/gm, '');
  content = content.replace(/\/\*[\s\S]*?\*\//g, '');

  // Find the main object after 'export const XX: Translations = {'
  const objStart = content.indexOf('= {');
  if (objStart === -1) return keys;

  let braceCount = 0;
  let currentPath = [];
  let pos = objStart + 2; // start at the '{'

  // Tokenize: track braces and key-value pairs
  while (pos < content.length) {
    const ch = content[pos];

    // Skip single-quoted strings
    if (ch === "'") {
      pos++;
      while (pos < content.length && content[pos] !== "'") {
        if (content[pos] === '\\') pos++; // skip escaped chars
        pos++;
      }
      pos++;
      continue;
    }

    // Skip double-quoted strings
    if (ch === '"') {
      pos++;
      while (pos < content.length && content[pos] !== '"') {
        if (content[pos] === '\\') pos++;
        pos++;
      }
      pos++;
      continue;
    }

    // Skip template literals
    if (ch === '`') {
      pos++;
      while (pos < content.length && content[pos] !== '`') {
        if (content[pos] === '\\') pos++;
        pos++;
      }
      pos++;
      continue;
    }

    if (ch === '{') {
      braceCount++;
      pos++;
      continue;
    }

    if (ch === '}') {
      braceCount--;
      if (braceCount > 0) {
        currentPath.pop();
      }
      pos++;
      continue;
    }

    // Look for key patterns: identifier followed by colon (or quoted key followed by colon)
    const keyMatch = content.slice(pos).match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*:/);
    const quotedKeyMatch = content.slice(pos).match(/^'([^']+)'\s*:/);

    let keyName = null;
    let matchLen = 0;

    if (quotedKeyMatch && (!keyMatch || quotedKeyMatch.index <= keyMatch.index)) {
      keyName = quotedKeyMatch[1];
      matchLen = quotedKeyMatch[0].length;
    } else if (keyMatch) {
      keyName = keyMatch[1];
      matchLen = keyMatch[0].length;
    }

    if (keyName && keyName !== 'export' && keyName !== 'const' && keyName !== 'import' && keyName !== 'type') {
      // Check what follows the colon (skip whitespace)
      let afterColon = pos + matchLen;
      while (afterColon < content.length && /\s/.test(content[afterColon])) afterColon++;

      if (content[afterColon] === '{') {
        // This is a nested object - push to path
        currentPath.push(keyName);
        pos = afterColon; // will hit the '{' on next iteration
        continue;
      } else {
        // This is a leaf value
        const fullKey = [...currentPath, keyName].join('.');
        keys.add(fullKey);
        pos += matchLen;
        continue;
      }
    }

    pos++;
  }

  return keys;
}

const locales = ['es', 'en', 'fr', 'de', 'pt', 'ast'];
const allKeys = {};
const basePath = '/Users/juan/code/paisaxe/src/lib/i18n/';

for (const locale of locales) {
  const content = fs.readFileSync(basePath + locale + '.ts', 'utf8');
  allKeys[locale] = extractKeys(content);
}

// Use es as reference
const esKeys = [...allKeys.es].sort();
console.log('=== ES (reference) has ' + esKeys.length + ' leaf keys ===\n');

// Show top-level sections for each locale
for (const locale of locales) {
  const sections = new Set();
  for (const key of allKeys[locale]) {
    sections.add(key.split('.')[0]);
  }
  console.log(locale.toUpperCase() + ' sections (' + allKeys[locale].size + ' keys): ' + [...sections].sort().join(', '));
}
console.log();

// Compare each locale against es
for (const locale of locales) {
  if (locale === 'es') continue;

  const missing = esKeys.filter(k => !allKeys[locale].has(k));
  const extra = [...allKeys[locale]].filter(k => !allKeys.es.has(k)).sort();

  console.log('=== ' + locale.toUpperCase() + ' vs ES ===');
  console.log('Total keys: ' + allKeys[locale].size + ' (es: ' + esKeys.length + ')');

  if (missing.length > 0) {
    console.log('MISSING from ' + locale.toUpperCase() + ' (' + missing.length + '):');
    for (const k of missing) console.log('  - ' + k);
  } else {
    console.log('No missing keys');
  }

  if (extra.length > 0) {
    console.log('EXTRA in ' + locale.toUpperCase() + ' (' + extra.length + '):');
    for (const k of extra) console.log('  + ' + k);
  } else {
    console.log('No extra keys');
  }
  console.log();
}
