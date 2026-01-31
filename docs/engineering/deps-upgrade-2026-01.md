# Major Dependency Upgrade — January 2026

**Date:** 2026-01-27
**Branch:** `develop`
**Commits:** `74caa45` through `10d9f55` (5 commits)

This document records a coordinated upgrade of all major dependencies. It covers what changed, what broke, how it was fixed, and what to watch for going forward.

---

## Summary of Changes

| Package | Before | After | Type |
|---------|--------|-------|------|
| `tailwindcss` | ^3.4.17 | ^4.0.0 | **Major** |
| `@tailwindcss/postcss` | — | ^4.0.0 | **New** |
| `tailwind-merge` | ^2.6.0 | ^3.0.0 | **Major** |
| `tailwindcss-animate` | ^1.0.7 | — | **Removed** |
| `tw-animate-css` | — | ^1.4.0 | **Replacement** |
| `autoprefixer` | ^10.4.23 | — | **Removed** (built into Tailwind v4) |
| `vitest` | ^3.2.4 | ^4.0.0 | **Major** |
| `@vitest/coverage-v8` | ^3.2.4 | ^4.0.0 | **Major** |
| `pdf-parse` | ^1.1.1 | ^2.0.0 | **Major** |
| `pdfjs-dist` | ^4.4.168 | ^5.0.0 | **Major** |
| `@types/pdf-parse` | ^1.1.4 | — | **Removed** (v2 ships own types) |
| `lucide-react` | ^0.469.0 | ^0.563.0 | Minor |
| `@types/node` | ^22.10.5 | ^25.0.0 | Type defs |
| `@anthropic-ai/sdk` | ^0.32.0 | ^0.71.2 | Updated |

---

## Phase-by-Phase Breakdown

### Phase 1: Minor/Patch Updates (`74caa45`)

Safe changes. Updated `lucide-react` and `@types/node`. Initially removed `@anthropic-ai/sdk` (believed unused), later restored in Phase 5.

**Files changed:** `package.json`

### Phase 2: Vitest 3 to 4 (`8ab3c1a`)

Two categories of breaking changes:

#### 1. `vi.fn()` type strictness

In Vitest v4, `vi.fn()` returns `Mock<Procedure | Constructable>` which is **not assignable** to typed function signatures like `(index: number) => void`. The fix is to add explicit type parameters:

```typescript
// Before (v3 — loosely typed):
let onIndexChange: ReturnType<typeof vi.fn>;
onIndexChange = vi.fn();

// After (v4 — explicitly typed):
let onIndexChange = vi.fn<(index: number) => void>();
```

**Files fixed:**
- `src/components/immersive/story-viewer.test.tsx` — 6 mocks (`onIndexChange`, `onAskAbout`, `onCategoryChange`, `onLocationChange`, `onDurationChange`, `onClearFilters`)
- `src/components/immersive/bookmark-button.test.tsx` — 1 mock (`onToggle`)
- `src/components/immersive/share-button.test.tsx` — 1 mock (`writeTextMock`)
- `src/hooks/use-realtime-feature-flags.test.ts` — 1 mock (`mockCleanup`)

#### 2. Arrow functions cannot be constructors

Vitest v4 respects JavaScript semantics: arrow functions passed to `vi.fn()` are not callable with `new`. If a mock is used as a constructor (e.g., `new VoyageAIClient()`), the implementation must use a `function` expression:

```typescript
// Before (v3 — arrow function worked as constructor):
vi.mock("voyageai", () => ({
  VoyageAIClient: vi.fn(() => ({ embed: mockEmbed })),
}));

// After (v4 — must use function expression for constructors):
vi.mock("voyageai", () => ({
  VoyageAIClient: vi.fn(function () {
    return { embed: mockEmbed };
  }),
}));
```

**Files fixed:**
- `src/lib/embeddings.test.ts` — `VoyageAIClient` and `EmbeddingCache` constructor mocks
- `src/components/immersive/voice-chat.test.tsx` — `SpeechRecognition` constructor mock (10 occurrences)

**Rule for future tests:** Any `vi.fn()` used with `new` must use a `function` expression, not an arrow function.

### Phase 3: Tailwind CSS 3 to 4 (`0fd9765`)

The largest migration. Tailwind v4 is a ground-up rewrite with a CSS-first architecture.

#### Config changes

**`postcss.config.mjs`** — Replaced `tailwindcss` + `autoprefixer` plugins with single `@tailwindcss/postcss`:
```javascript
// Before
plugins: { tailwindcss: {}, autoprefixer: {} }
// After
plugins: { "@tailwindcss/postcss": {} }
```

**`src/app/globals.css`** — Replaced v3 directives with v4 imports:
```css
/* Before */
@tailwind base;
@tailwind components;
@tailwind utilities;

/* After */
@import "tailwindcss";
@import "tw-animate-css";
@config "../../tailwind.config.ts";
```

**`tailwind.config.ts`** — Two changes:
1. `darkMode: ["class"]` became `darkMode: "class"` (string, not single-element array)
2. Removed `plugins: [require("tailwindcss-animate")]` (plugin now loaded via CSS `@import`)

#### Animation library replacement

`tailwindcss-animate` has no Tailwind v4 support (stuck at 1.0.7). Replaced with `tw-animate-css`, the community-standard CSS-first replacement recommended by shadcn/ui (deprecated `tailwindcss-animate` in March 2025). The class names are identical — no component changes needed.

#### Renamed utility classes (not yet applied)

Tailwind v4 renames some utilities. The old names still work as aliases but emit deprecation warnings:

| v3 class | v4 class |
|----------|----------|
| `shadow-sm` | `shadow-xs` |
| `shadow` | `shadow-sm` |
| `ring-1` | `ring` |
| `outline-none` | `outline-hidden` |

These exist in `src/components/ui/button.tsx` and potentially other shadcn components. They were **not updated** in this migration because the aliases work without errors. They should be updated when shadcn components are next regenerated or when the aliases are removed in a future Tailwind release.

#### Gotcha: `@config` path

The `@config` directive path is **relative to the CSS file**, not the project root. From `src/app/globals.css`, the correct path to the project root config is `../../tailwind.config.ts` (2 levels up), not `../../../tailwind.config.ts`.

### Phase 4: PDF Libraries (`bfa65c3`)

#### pdf-parse v1 to v2

The API changed completely from a single function to a class-based design:

```typescript
// v1
import pdfParse from "pdf-parse";
const data = await pdfParse(buffer);
console.log(data.text, data.numpages);

// v2
import { PDFParse } from "pdf-parse";
const parser = new PDFParse({ data: buffer });
const result = await parser.getText();
await parser.destroy();
console.log(result.text, result.total);
```

Key differences:
- Named export `PDFParse` class instead of default export function
- Constructor takes `{ data: Buffer }` or `{ url: string }`
- `getText()` returns `{ text, total, pages }`
- Must call `destroy()` to free memory
- `numpages` became `total`
- Ships own TypeScript types (removed `@types/pdf-parse`)

**Files changed:**
- `scripts/process-pdfs.ts`
- `scripts/extract-pdf-sources.ts`

#### pdfjs-dist v4 to v5

No code changes were needed. The legacy build path (`pdfjs-dist/legacy/build/pdf.mjs`) and worker path (`pdfjs-dist/build/pdf.worker.mjs`) are unchanged in v5. The `extract-images.ts` script works as-is.

### Phase 5: Cleanup (`10d9f55`)

Restored `@anthropic-ai/sdk` (^0.32 to ^0.71) — it was incorrectly removed in Phase 1. The package is used in `scripts/generate-stories.ts`.

---

## What to Watch For

### Tailwind v4

- **Deprecated class aliases** (`shadow-sm`, `ring-1`, `outline-none`) will eventually be removed. Update them when convenient, especially when regenerating shadcn/ui components.
- **CSS variable format** may differ in v4 for some utilities. If custom CSS breaks, check the Tailwind v4 upgrade guide.
- **`@config` path** must be relative to the CSS file importing it, not the project root.

### Vitest v4

- **All new `vi.fn()` mocks** passed to typed positions need explicit type parameters.
- **All constructor mocks** (`vi.fn()` used with `new`) must use `function` expressions, never arrow functions.
- **Node.js engine**: Vitest v4 officially supports Node ^20, ^22, >=24. Node 23.x shows a warning but works. This will resolve itself when upgrading to Node 24.

### pdf-parse v2

- **Memory management**: The v2 class-based API requires calling `destroy()` after use. Forgetting this leaks memory, especially when processing many PDFs.
- **Import changed**: `import pdfParse from "pdf-parse"` no longer works. Must use `import { PDFParse } from "pdf-parse"`.

### pdfjs-dist v5

- No issues observed, but if the `legacy/build/pdf.mjs` path is removed in a future minor release, `extract-images.ts` will need updating to use the standard build path.

---

## Verification Results

All checks passed at every phase:

| Check | Result |
|-------|--------|
| `npm run typecheck` | Pass |
| `npm run lint` | Pass |
| `npm run test` | 92 files, 1108 tests, all pass |
| `npm run build` | Production build succeeds |
| `npx knip` | No new unused deps (only pre-existing findings) |
| `npm ls` | No peer dependency warnings |
