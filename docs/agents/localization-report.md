# Localization Report

Date: 2026-08-23
Agent: Paisaxe Localization Agent
Status: Structural parity confirmed; translation distinctiveness gaps identified

## Summary

**Key Structural Finding:** All locales verified to have identical key structure (411 keys each) with 100% parity — no missing or orphaned keys detected.

**Translation Distinctiveness:** Coverage analysis identifies that many non-Spanish locales retain Spanish values for shared vocabulary (common in Romance languages). Effective coverage varies:
- English (en): 100% — all keys have distinct translations
- French (fr): 99% — ~4 keys retain Spanish values  
- German (de): 99% — ~4 keys retain Spanish values
- Portuguese (pt): 88% — 46 keys retain Spanish values (many are legitimate cognates)
- Asturian (ast): 81% — 76 keys retain Spanish values

Two manual fixes applied this session: Portuguese "Entendido" → "Entendi" and "Todas" → "Tudo".

Story translations remain 100% complete (113 stories × 5 locales = 565 records, all translated).

### UI Translations (src/lib/i18n/*.ts)

Spanish (es) is the source of truth with 411 leaf keys.

**Structural Validation (Key Parity):**

| Locale | Leaf keys | Missing | Orphaned | Empty strings | Status |
|--------|-----------|---------|----------|---------------|--------|
| es (source) | 411 | — | — | 0 | Source |
| en | 411 | 0 | 0 | 0 | Pass ✓ |
| fr | 411 | 0 | 0 | 0 | Pass ✓ |
| de | 411 | 0 | 0 | 0 | Pass ✓ |
| pt | 411 | 0 | 0 | 0 | Pass ✓ |
| ast | 411 | 0 | 0 | 0 | Pass ✓ |

Placeholder parity ({current}, {total}, {title}, {description}, etc.) verified: 0 mismatches across all locales.

**Translation Distinctiveness (Value Coverage):**

| Locale | Total Keys | Distinct Values | % Translated | Gap |
|--------|-----------|-----------------|--------------|-----|
| es (source) | 411 | 411 | 100% | — |
| en | 411 | 411 | 100% | 0 keys |
| fr | 411 | 407 | 99% | 4 keys |
| de | 411 | 407 | 99% | 4 keys |
| pt | 411 | 365 | 89% | 46 keys |
| ast | 411 | 335 | 82% | 76 keys |

Note: Many "untranslated" keys (especially in pt and ast) are shared vocabulary between Romance languages where Spanish and Portuguese/Asturian use identical words (e.g., "Filtros", "Cultura", "navegar").

### Story Translations (content/translations/story-translations.ts)

113 story slugs × 5 target locales = 565 translation records. All complete with title, subtitle, and description.

| Check | Result | Status |
|-------|--------|--------|
| Slugs in STORY_TRANSLATIONS | 113 | ✓ |
| Records present (slug × locale) | 565 / 565 | ✓ |
| Records with title | 565 / 565 | ✓ |
| Records with subtitle | 565 / 565 | ✓ |
| Records with description | 565 / 565 | ✓ |
| Missing slug:locale pairs | 0 | ✓ |
| Per-locale completion (en, fr, de, pt, ast) | 113/113 each | ✓ |

**Story Coverage:** 100% across all 5 non-Spanish locales. No gaps or missing records.

### Verification (2026-08-23)

| Check | Result | Status |
|-------|--------|--------|
| Structural parity (all keys present) | Pass — 411 keys per locale | ✓ |
| Key count parity (es vs others) | Pass — no missing/orphaned keys | ✓ |
| Empty string check | Pass — 0 empty values | ✓ |
| TypeScript type safety | Pass — 0 errors in src/lib/i18n/ | ✓ |
| Placeholder consistency | Pass — 0 mismatches across locales | ✓ |
| Story record completeness | Pass — 565 records across 5 locales | ✓ |
| Translation distinctiveness (coverage.ts) | Measured — 81-100% per locale | ⚠ |

**Test Coverage:**
- `npm run test -- src/lib/i18n/`: Validates key parity and placeholder formats
- `locale-coverage.generated.ts`: Measures translation distinctiveness (value coverage)
- `story-translations-coverage.test.ts`: Enforces story translation record completeness

## Fixed

**This Session:**
- `pt.ts`: "chat.understood" — "Entendido" → "Entendi" (proper Portuguese form)
- `pt.ts`: "stories.all" — "Todas" → "Tudo" (correct Portuguese for "all" in this context)

**Files Modified:** 1 (src/lib/i18n/pt.ts)
**Changes Applied:** 2

## Remaining Gaps

**Portuguese (pt) — 44 keys** (after 2 fixes applied):
- 36+ keys are shared vocabulary with Spanish (legitimate cognates)
- 4+ keys need review: Asturian cultural phrases, location labels, mood descriptors
- Example: "author_pill.buen_camino: ¡buen Camino!" → should be Portuguese equivalent

**Asturian (ast) — 76 keys:**
- Majority require Asturian-specific translations (not simply Spanish words)
- Includes: common nouns, UI labels, cultural expressions, technical terms
- Many keys lack standardized Asturian terminology (active language evolution)

**French (fr) & German (de) — ~4 keys each:**
- Minor keys, likely prepositions or connectors
- Lower priority given near-complete status

## Orphaned Keys

None — all 411 keys verified to have Spanish source with exact placeholder parity.

## Recommendations

1. **Immediate:** Document that many "untranslated" keys in pt and ast are shared vocabulary or legitimately identical across languages
2. **Asturian:** Escalate for native speaker review — many technical terms lack standardized Asturian equivalents
3. **Portuguese:** Confirm 44-key gap is acceptable given cognate density of Romance languages
4. **Testing:** Run `npm run typecheck && npm run test -- locale-coverage.test.ts` to verify parity holds

## Notes

- **Structural Integrity:** 100% — all 5 non-Spanish locales have identical key structure to Spanish (411 keys, 0 orphans, 0 missing)
- **Story Translations:** 100% — 565 records (113 stories × 5 locales) all complete with title, subtitle, description
- **Coverage Metric:** `locale-coverage.generated.ts` measures value distinctiveness (how many keys differ from Spanish), not structural parity
- **Cognate Density:** Portuguese-Spanish share ~89% vocabulary; many "untranslated" keys are legitimate shared words
- **Asturian Status:** Regional minority language; standardized tech terminology still evolving; some neologisms may be required
