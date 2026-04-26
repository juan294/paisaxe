# Documentation Update Report
> Generated on 2026-04-25 | Branch: develop | Changes since v1.3.0 (Wave 2 remediation)

## Summary

- **4 documents updated**
- **0 diagrams refreshed** (architecture diagram updated separately in commit `904ed260`)
- **7 version/count references corrected**
- **0 inline doc blocks updated**
- **0 items flagged [NEEDS REVIEW]**

---

## Changes by File

### `README.md`

**Reason**: Two references to `voyage-3` remained from before the `voyage-3.5` upgrade. Both were stale against `src/lib/embeddings.ts` and CLAUDE.md.

**Changes:**
- Line 39 — Tech stack table Embeddings row: `voyage-3, 512 dims` → `voyage-3.5, 512 dims`
- Line 227 — Chat Pipeline architecture step 2: `` `voyage-3` `` → `` `voyage-3.5` ``

---

### `docs/marketing/cost-forecast.md`

**Reason**: Voyage AI pricing section still listed `voyage-3` as the embedding model name. Pricing rate is unchanged ($0.12/M tokens) — only the model name needed correction.

**Changes:**
- Line 50 — Voyage AI pricing: `Embeddings (voyage-3)` → `Embeddings (voyage-3.5)`

---

### `docs/engineering/testing-guide.md`

**Reason**: Wave 2 remediation added 8 new test files (providers, admin routes with Zod schemas, rate-limit fallback, use-stories, use-favorites, check-migrations, schemas). Coverage report now shows 6,059 tests across 332 files. Three locations in the guide still showed the pre-Wave-2 count of 324 files / ~6,000 tests.

**Changes:**
- Line 14 — Overview table Unit & Component row: `324 | ~6,000` → `332 | 6,059`
- Line 130 — Unit test inventory header: `**324 files, ~6,000 tests**` → `**332 files, 6,059 tests**`
- Line 547 — Pre-commit hook section: `~6,000 tests` → `~6,059 tests`

---

## Flagged for Review

None. The architecture diagram flag from the 2026-04-24 report was resolved: the `/drawio` skill updated `docs/paisaxe-architecture.drawio.png` in commit `904ed260` with all 5 required changes (proxy layer, Pelayo split, /api/agent-run, webhook rename, CSRF+request-ID).

---

## Verification

- ESLint (`npm run lint`): **PASS** — no errors in `src/`
- Markdownlint on changed files: no new violations introduced; pre-existing MD013/MD060/MD032 violations are present throughout the docs tree but are out of scope for a refresh-only pass
- All 7 targeted edits applied and confirmed

---

## Next Steps

- Run `/pre-launch` before the next release to catch issues `/update-docs` does not cover (security, performance, accessibility, E2E).
- Run `/release` when ready to cut the next version.
