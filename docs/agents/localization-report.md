# Localization Agent Report

Date: 2026-06-14
Agent: Paisaxe Localization Agent
Status: COMPLETE — 100% coverage, no edits needed.

## Summary

Translation coverage is Complete across all supported locales. No edits were required this cycle.

Supported locales (6): es (Spanish, source of truth), en (English), fr (French), de (German), pt (Portuguese), ast (Asturianu).

Note: the project ships an additional locale beyond the five in the agent brief — ast (Asturianu) — declared in `src/lib/i18n/types.ts` as a first-class `Locale`. It is verified at the same parity as the other locales.

### UI Strings (`src/lib/i18n/{locale}.ts`)

| Locale | Leaf keys | Missing | Orphaned | Completion |
|--------|-----------|---------|----------|------------|
| es (source) | 406 | — | — | 100% |
| en | 406 | 0 | 0 | 100% |
| fr | 406 | 0 | 0 | 100% |
| de | 406 | 0 | 0 | 100% |
| pt | 406 | 0 | 0 | 100% |
| ast | 406 | 0 | 0 | 100% |

Key parity was verified programmatically by extracting every dot-notation leaf key from the Spanish source and diffing against each target locale. All five non-Spanish locales contain exactly the 406 keys present in `es.ts` — zero missing, zero orphaned.

### Story Translations (`content/translations/story-translations.ts`)

| Metric | Value |
|--------|-------|
| Unique known story slugs | 113 |
| Slugs with translation entries | 113 |
| Target locales per story | 5 (en, fr, de, pt, ast) |
| Target-locale records | 565 (113 x 5) |
| Slugs missing any target-locale coverage | 0 |
| Entries missing title or description | 0 |
| Entries with undefined subtitle | 0 |
| Orphan entries (no source slug) | 0 |

Slug sources cross-checked: seed-database.ts (20), seed-cycling-stories.ts (5), `content/fallback-stories.json` (8), `content/processed/extracted-stories.json` (81), `content/processed/generated-stories.json` (8). All 113 unique slugs resolve to a complete translation entry (title + subtitle + description) for every target locale.

## Fixed

No translations were added, removed, or modified this cycle. Both UI strings and story translations were already at 100% coverage on entry.

## Remaining Gaps

None. There are no missing UI keys and no missing story translations for any supported locale.

## Orphaned Keys

None. No locale (en, fr, de, pt, ast) contains a UI key absent from the Spanish source, and no story-translation entry references a slug outside the known seed/processed/fallback sources.

## Integrity Checks

- Placeholder safety: Pass. Every interpolation placeholder used in the Spanish source (`{current}`, `{total}`, `{title}`, `{time}`, `{hours}`) is preserved identically in all five target locales. Programmatic placeholder diff across all 406 keys x 5 locales returned 0 mismatches.
- Location-specific content: Pass. `LOCATION-SPECIFIC` markers (region names, site names, the Pelayo persona name, content-source attribution) are present and consistently localized across all locale files.
- TypeScript: Pass. Project-wide `npx tsc --noEmit` returned 0 errors.
- Tests: Pass. `translations.test.ts` and `story-translations-coverage.test.ts` — 105 tests passing. `translations.test.ts` dynamically compares each locale's key count to the Spanish source, so any future key addition without locale parity fails CI automatically. `story-translations-coverage.test.ts` asserts every static seed slug (and processed slugs when present locally) has full target-locale coverage.

## Cross-Reference With Other Agents

No locale-related issues raised by any other agent in shared context. Recent Performance Agent reports confirm i18n bundle behavior is stable: `es` + `en` are static imports and `fr`/`de`/`pt`/`ast` are dynamically imported (lazy-loaded). The Jun 13 Performance report notes `global-error.tsx` was fixed to stop statically importing all six full i18n bundles (it only renders four strings) — a -162 KB first-paint saving. No translation content changed as part of that fix; this report confirms all six bundles remain at full key parity afterward.
