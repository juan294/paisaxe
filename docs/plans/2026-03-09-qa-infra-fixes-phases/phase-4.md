# Phase 4: Browserslist + Dependency Updates `[batch-eligible]`

> **Files**: `package.json`
> **Estimated effort**: Small

## Problem

### Browserslist
Total JS is 2,726 KB — exceeds the 2,500 KB budget by 226 KB. Chunk `a6dad97d` (113 KB) contains polyfills for `Object.assign`, `Promise.finally`, `Array.flat`, `fetch` shimming, etc. Modern browsers (the only browsers visiting a 2026 tourism site) don't need these.

No `browserslist` config exists in `package.json` or `next.config.ts`, so Next.js defaults to a broad compatibility target.

### Dependency Updates
Security report flagged two outdated production dependencies:
- `@supabase/ssr`: 0.8.0 → 0.9.0 (auth library, minor version)
- `pdfjs-dist`: 5.4.624 → 5.5.207 (PDF parsing, minor version — may contain fixes)

## Changes

### 1. Add browserslist — `package.json`

```pseudo
  {
    "name": "paisaxe",
    ...
+   "browserslist": [
+     "last 2 Chrome versions",
+     "last 2 Firefox versions",
+     "last 2 Safari versions",
+     "last 2 Edge versions",
+     "> 0.5%, not dead"
+   ],
    ...
  }
```

### 2. Update dependencies

```bash
npm install @supabase/ssr@^0.9.0 pdfjs-dist@^5.5.207
```

After updating, check for breaking changes:
- `@supabase/ssr` 0.9: Read changelog — `createBrowserClient` and `createServerClient` API may have minor changes
- `pdfjs-dist` 5.5: Used only in seed script (`npm run seed-db`), not in production runtime. Low risk.

## Verification

```bash
# Build and compare total JS size
npm run build 2>&1 | tail -20

# Compare chunk sizes — look for polyfills chunk to shrink or disappear
ls -la .next/static/chunks/ | sort -k5 -n -r | head -20

# Full test suite to confirm nothing breaks
npm run test && npm run typecheck && npm run lint

# Verify no new audit issues
npm audit

# Verify Supabase auth still works (if @supabase/ssr changed)
npx playwright test --grep "sign-in|auth|favorites"
```

### Expected outcome
- Polyfills chunk (~113 KB) should shrink significantly or be eliminated
- Total JS should drop to ~2,613-2,650 KB range
- 0 npm audit vulnerabilities
- No functional changes to the application

## Notes

- `> 0.5%, not dead` covers ~98% of global browser traffic
- This does NOT drop iOS Safari support — Safari 15+ (2021) is well within "last 2 versions"
- Tourists visiting in 2026 with a browser from before 2023 are an extreme edge case
- If browserslist savings are less than expected, Phase 9 addresses the budget restructure
- `pdfjs-dist` is a devDependency used in the seed script — zero impact on production bundle
