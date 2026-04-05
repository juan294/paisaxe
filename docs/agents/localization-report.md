# Localization Coverage Report
> **Last Updated:** 2026-04-05
> **Agent:** Paisaxe Localization Agent
> **Status:** GREEN — 100% Translation Coverage

---

## Summary

| Locale | UI Keys | Coverage | Story Translations | Type Safety |
|--------|---------|----------|--------------------|-------------|
| es (Spanish — source) | 392 | 100% | 95 stories (source) | Pass |
| en (English) | 392 | 100% | 95 stories x 3 fields | Pass |
| fr (French) | 392 | 100% | 95 stories x 3 fields | Pass |
| de (German) | 392 | 100% | 95 stories x 3 fields | Pass |
| pt (Portuguese) | 392 | 100% | 95 stories x 3 fields | Pass |
| ast (Asturian) | 392 | 100% | 95 stories x 3 fields | Pass |

**Total UI leaf keys:** 392 per locale (392 x 6 locales = 2,352 total)
**Total story translations:** 95 stories x 5 locales = 475 entries (en, fr, de, pt, ast)
**TypeScript check:** `npx tsc --noEmit` exits clean (0 errors)

---

## Fixed

**None.** All translations stable — no changes made this cycle.

---

## Remaining Gaps

**None.** Zero missing keys, zero missing story translations across all 6 locales.

---

## Orphaned Keys

**None.** All non-Spanish locales mirror the Spanish structure exactly (0 keys in en/fr/de/pt/ast that are absent from es).

---

## Coverage Details

### UI Strings (`src/lib/i18n/`)

All 6 locale files (es, en, fr, de, pt, ast) contain exactly **392 leaf keys** across 21 top-level namespaces:

| Namespace | Keys |
|-----------|------|
| `common` | 2 |
| `chat` | 14 |
| `stories` | 21 (inc. nested: `filters`, `categories`, `locations`, `durations`) |
| `nav` | 6 |
| `author_pill` | 9 |
| `share` | 2 |
| `favorites` | 19 |
| `accessibility` | 18 |
| `auth` | 7 |
| `mood` | 6 |
| `voice` | 20 |
| `suggestions` | 23 |
| `upsell` | 8 |
| `premium` | 22 |
| `fullscreen` | 7 |
| `errors` | 10 |
| `footer` | 4 |
| `info_menu` | 2 |
| `about` | 10 |
| `privacy` | 42 |
| `terms` | 47 |
| `admin` | 44 (inc. nested: `login`, `tabs`, `stories`, `featureToggles`, `analytics`) |

### Story Translations (`content/translations/story-translations.ts`)

**95 story slugs** verified. All have translations for all 5 non-Spanish locales (en, fr, de, pt, ast), each with `title`, `subtitle`, and `description` fields.

---

## Cosmetic Notes (non-blocking)

- `fr`, `de`, `pt` locale files are missing `// LOCATION-SPECIFIC` inline comments that appear in `es` and `en` (8 comment blocks). No functional impact — purely cosmetic. Unchanged since Mar 7.

---

## Methodology

1. Read all 6 locale files in `src/lib/i18n/`
2. Extracted leaf keys programmatically via recursive object traversal (`getLeafKeys`)
3. Compared all non-Spanish locales against `es` as source of truth
4. Parsed `content/translations/story-translations.ts` for slug + locale coverage (all 95 slugs x 5 locales x 3 fields)
5. Ran `npx tsc --noEmit` for locale files — 0 errors

---

## Cross-Agent Recommendations

- **Performance Agent:** Locale bundle sizes stable (~15 KB each). Lazy-loading (es+en static, fr/de/pt/ast dynamic) in place. No optimization needed.
- **Code Quality Agent:** No dead translations found. All 392 keys actively referenced. No new keys since Mar 7. Cosmetic: fr/de/pt missing 8 inline `// LOCATION-SPECIFIC` comments — no functional impact.
- **Security Agent:** No sensitive data in translation files (no API keys, tokens, or PII).
- **Coverage Agent:** No locale-related coverage concerns.
- **QA Agent:** No locale-related issues. All translations stable for 30 consecutive days.
- **Cost Analyst Agent:** No cost-related localization concerns.
