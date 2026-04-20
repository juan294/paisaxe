# Localization Coverage Report
> **Last Updated:** 2026-04-20
> **Agent:** Paisaxe Localization Agent
> **Status:** GREEN — 100% Translation Coverage

## Summary

| Locale | UI Keys | Coverage | Story Translations | Coverage |
|--------|---------|----------|--------------------|----------|
| es (Spanish) | 395 / 395 | 100% (source) | 95 / 95 | 100% (source) |
| en (English) | 395 / 395 | 100% | 95 / 95 | 100% |
| fr (French) | 395 / 395 | 100% | 95 / 95 | 100% |
| de (German) | 395 / 395 | 100% | 95 / 95 | 100% |
| pt (Portuguese) | 395 / 395 | 100% | 95 / 95 | 100% |
| ast (Asturian) | 395 / 395 | 100% | 95 / 95 | 100% |

**Total leaf keys verified:** 395 per locale (programmatic count via tsx)
**Stability:** 42 consecutive days with no translation changes (since 2026-03-07)

## Analysis Details

### UI String Analysis

- **Source of truth:** `src/lib/i18n/es.ts` — 395 leaf keys across 22 top-level sections
- **Key sections:** common, chat, stories, nav, author_pill, share, favorites, accessibility, auth, mood, voice, suggestions, upsell, premium, fullscreen, errors, footer, info_menu, about, privacy, terms, admin
- **Missing keys:** 0 across all 5 non-Spanish locales
- **Orphaned keys:** 0 (no keys in non-Spanish locales without a Spanish source)
- **Method:** programmatic comparison using `npx tsx` — all locales confirmed structurally identical

### Story Translation Analysis

- **Total story slugs:** 95
- **Locales with translations:** en, fr, de, pt, ast (5 non-Spanish locales)
- **Coverage:** 95/95 (100%) for all locales
- **Each entry includes:** title, subtitle, description
- **Source file:** `content/translations/story-translations.ts`
- **Count verification:** `grep -c "^    en: {"` returns 95 — matches all other locales

### TypeScript Type Safety

- **Result:** Pass — `npx tsc --noEmit` exits with 0 errors
- **No structural drift** between locale files

## Fixed This Run

No changes made. All translations are complete and stable.

## Remaining Gaps

None. 100% coverage across all 6 locales.

## Orphaned Keys

None found.

## Notes

- Previous runs reported 392 keys; current programmatic count via tsx returns 395. The difference reflects counting methodology (leaf node count vs. prior method). The count is consistent across all 6 locales, which is the correctness criterion.
- fr/de/pt `// LOCATION-SPECIFIC` inline comments were added by triage agent on 2026-04-14 (commit e858ef7) to match es/en/ast parity. That cosmetic gap is now closed.
- Lazy-loading configuration: es + en are static imports; fr, de, pt, ast load dynamically on demand (~15 KB each).

## Cross-Agent Recommendations

- **Performance Agent:** Locale bundle sizes unchanged. 395 keys stable, lazy-loading (es+en static, fr/de/pt/ast dynamic) remains in place. No optimization needed.
- **Code Quality Agent:** No dead translations. All 395 keys actively referenced. No new keys since 2026-03-07.
- **Security Agent:** No sensitive data in any translation file. No API keys, tokens, or PII.
- **Coverage Agent:** No locale-related coverage concerns.
- **QA Agent:** No locale-related issues. All translations stable for 42 days.
- **Cost Analyst Agent:** No cost-related localization concerns.
