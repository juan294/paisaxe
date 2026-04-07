# Localization Coverage Report
> **Last Updated:** 2026-04-07
> **Agent:** Paisaxe Localization Agent
> **Status:** GREEN — 100% Translation Coverage

## Summary

| Locale | UI Keys | Coverage | Story Translations | Coverage |
|--------|---------|----------|--------------------|----------|
| es (Spanish) | 392 / 392 | 100% | 95 / 95 | 100% (source) |
| en (English) | 392 / 392 | 100% | 95 / 95 | 100% |
| fr (French) | 392 / 392 | 100% | 95 / 95 | 100% |
| de (German) | 392 / 392 | 100% | 95 / 95 | 100% |
| pt (Portuguese) | 392 / 392 | 100% | 95 / 95 | 100% |
| ast (Asturian) | 392 / 392 | 100% | 95 / 95 | 100% |

**Total leaf keys (UI):** 392 per locale  
**Total story translations:** 95 stories × 5 locales = 475 (title + subtitle + description each)  
**TypeScript check:** PASS — `npx tsc --noEmit` exits clean (0 errors)

## Fixed This Cycle

None. All translations stable for **32 consecutive days** (since 2026-03-07).

## Remaining Gaps

None. Coverage is complete across all locales.

## Orphaned Keys

None. All 392 keys in non-Spanish locales have corresponding Spanish source entries.

## Key Distribution by Section

| Section | Leaf Keys |
|---------|-----------|
| common | 2 |
| chat | 15 |
| stories (incl. filters, categories, locations, durations) | 24 |
| nav | 6 |
| author_pill | 9 |
| share | 2 |
| favorites | 23 |
| accessibility | 21 |
| auth | 7 |
| mood | 7 |
| voice | 23 |
| suggestions | 28 |
| upsell | 9 |
| premium | 28 |
| fullscreen | 8 |
| errors | 12 |
| footer | 4 |
| info_menu | 2 |
| about | 13 |
| privacy | 50 |
| terms | 44 |
| admin (incl. login, tabs, stories, featureToggles, analytics) | 55 |
| **Total** | **392** |

## Notes

- Spanish (`es`) is the source of truth. No Spanish strings were modified.
- Cosmetic: `fr`, `de`, `pt` locale files are missing 8 inline `// LOCATION-SPECIFIC` comments present in `es` and `en`. No functional impact.
- `ast` (Asturian) locale uses the Asturianu persona name "Pelayu" (not "Pelayo") consistently throughout voice prompts — correct per locale conventions.
- Story translations verified: all 95 slugs have `en`, `fr`, `de`, `pt`, and `ast` blocks confirmed by grep (95/95 each).

## Cross-Agent Recommendations

- **Performance Agent:** Locale bundle sizes stable (~15 KB each). Lazy-loading (es+en static, fr/de/pt/ast dynamic) in place. No optimization needed.
- **Code Quality Agent:** No dead translations found. All 392 keys actively referenced. No new keys since Mar 7. Cosmetic: fr/de/pt missing 8 inline `// LOCATION-SPECIFIC` comments — no functional impact.
- **Security Agent:** No sensitive data in translation files (no API keys, tokens, or PII).
- **Coverage Agent:** No locale-related coverage concerns.
- **QA Agent:** No locale-related issues. All translations stable for 32 days.
- **Cost Analyst Agent:** No cost-related localization concerns.
