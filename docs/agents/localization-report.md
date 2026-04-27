# Localization Report — 2026-04-27

Status: GREEN — 100% translation coverage across all 6 supported locales. No edits needed this cycle.

## Summary

| Locale | UI keys | Story translations | Completion |
|--------|---------|--------------------|-----------:|
| es (Spanish, source of truth) | 395 | 100 (base) | 100% |
| en (English)                  | 395 | 100 | 100% |
| fr (French)                   | 395 | 100 | 100% |
| de (German)                   | 395 | 100 | 100% |
| pt (Portuguese)               | 395 | 100 | 100% |
| ast (Asturian)                | 395 | 100 | 100% |

Note: The agent brief lists 5 supported locales (es, en, fr, de, pt). The codebase also ships `ast.ts` (Asturian/Bable) and `ast` story translations — included here for completeness since they follow the same invariants.

## UI Translations (src/lib/i18n/)

- Leaf key count: **395 per locale**, stable.
- Missing keys: 0 for every non-es locale.
- Orphaned keys (present in non-es but not in es): 0.
- Placeholder consistency: pass — every translated string preserves the same `{var}` set as its Spanish source (verified mechanically via regex diff against es).
- Type safety: project-wide `npx tsc --noEmit` exits clean (0 errors).

## Story Translations (content/translations/story-translations.ts)

- Total stories tracked: **100** (up from 95 in earlier reports — 5 stories added since 2026-03-07 baseline).
- Per-locale story coverage: 100/100 for en, fr, de, pt, ast.
- Per-story field coverage: every story has non-empty `title`, `subtitle`, and `description` in all 5 target locales.
- Total translated story records: **500** (100 stories × 5 locales).

## Fixed This Run

None. All translations were already complete and well-formed when the agent started. Zero edits made to `src/lib/i18n/*.ts` or `content/translations/story-translations.ts`.

## Remaining Gaps

None at the data layer. All UI keys and story fields are present, type-safe, and placeholder-consistent.

The only outstanding cosmetic note carried from prior cycles is irrelevant to translation correctness:
- Some non-source locale files have been observed in past audits to omit a few inline `// LOCATION-SPECIFIC` reviewer hints that exist in `es.ts` / `en.ts` / `ast.ts`. These are translator comments only — they have no runtime effect and do not represent translation gaps. No action taken this cycle.

## Orphaned Keys

None. Every key in en/fr/de/pt/ast has a corresponding key in es.

The language-switcher block (`languageSwitcher.languages.{es|en|fr|de|pt|ast}`) intentionally renders each locale's native self-label inside every locale file (e.g. "Español", "English", "Français", "Deutsch", "Português", "Asturianu"). This is by design, not an orphan.

## Verification Commands Used

```bash
npx tsx /tmp/check-i18n.ts      # leaf-key diff + placeholder check across 6 locales
npx tsx /tmp/check-stories.ts   # 100 stories x 5 locales coverage check
npx tsc --noEmit                # full TypeScript check, 0 errors
```

## Source-of-Truth Stability

- Spanish (es) remains the source of truth. No Spanish strings were added, modified, or removed in this run.
- Story count grew from 95 to 100 since the previous agent baseline; all 5 newly tracked stories already have complete translations in en/fr/de/pt/ast — no backlog.
- Translation content has been stable for an extended period; the only changes in `src/lib/i18n/` since 2026-03-07 have been routine commits that preserve the 395-key invariant.
