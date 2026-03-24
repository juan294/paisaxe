# Pre-Launch Audit Report

> Generated on 2026-03-23 | Branch: `develop` | Commit: `4b34230` | 6 parallel specialists
> Previous audit: 2026-03-07 (verdict: CONDITIONAL)

## Verdict: CONDITIONAL

**0 blockers. 30 warnings across 6 domains. All CI green. 5,562 tests passing at 98.5% coverage.**

The codebase is in strong shape — no security vulnerabilities, no TypeScript errors, no dead code, 100% test pass rate. The warnings are predominantly admin UI polish (focus indicators, heading hierarchy), documentation gaps (6 undocumented env vars), and build noise (prerender fetch warnings). None are user-facing regressions.

---

## Blockers (must fix before release)

None.

---

## Warnings Summary

| # | Issue | Severity | Found by | Risk |
|---|-------|----------|----------|------|
| 1 | 6 undocumented env vars in production code | Medium | devops | New deploys may miss required config |
| 2 | 10 admin date inputs missing focus indicators | Medium | ux-reviewer | Keyboard a11y gap in admin UI |
| 3 | Admin sub-panels use h1 instead of h2 | Low | ux-reviewer | Heading hierarchy violation |
| 4 | Hardcoded Spanish aria-label in question-prompts.tsx | Low | ux-reviewer | Screen reader i18n issue |
| 5 | Admin `focus:` vs `focus-visible:` inconsistency (~15 inputs) | Low | ux-reviewer | Minor a11y pattern inconsistency |
| 6 | ~130 prerender fetch warnings in build output | Low | performance-eng | Build noise, masks real errors |
| 7 | 8 large files > 500 lines | Low | architect | Maintainability concern |
| 8 | 4 major version bumps available | Low | architect | Tech debt accumulation |
| 9 | 46 commits ahead of `main` | Low | devops | Large release delta |
| 10 | Dead `ANTHROPIC_ADMIN_API_KEY` reference | Low | devops | Dead code in cost tracking |
| 11 | CSP uses `unsafe-inline` (documented/intentional) | Low | security-reviewer | XSS mitigation relies on input validation |
| 12 | In-memory rate limit fallback without Upstash | Low | security-reviewer | Weaker rate limiting per-instance |
| 13 | 7 route segments missing `loading.tsx` | Low | performance-eng | No loading skeleton for pricing, about, etc. |
| 14 | 119 "use client" components | Low | performance-eng | Static pages forced client-side by i18n |
| 15 | Footer text at 10px / admin badges at 8px | Low | ux-reviewer | Below WCAG recommended minimum |

---

## Detailed Findings

### 1. Quality Assurance (qa-lead) — GREEN

| Metric | Value |
|--------|-------|
| Total tests | 5,562 |
| Pass rate | 100% |
| TypeScript errors | 0 |
| Lint errors | 0 |
| Statement coverage | 98.52% |
| Branch coverage | 95.30% |
| Function coverage | 98.60% |
| Line coverage | 98.93% |
| Skipped tests | 0 |
| E2E status | PASS (latest) |
| Untested critical files | 0 |

**Warnings:**
- E2E: 2 of 3 recent runs failed before the latest fix (now green)
- Some barrel/type files show 0% coverage (expected — type-only files)
- `image-optimization.ts` has 72.41% branch coverage (lowest lib file)

**Recommendations:**
- Add coverage threshold enforcement in CI to prevent regression
- Monitor E2E stability after today's fixes

---

### 2. Security (security-reviewer) — GREEN

| Metric | Value |
|--------|-------|
| npm audit (all) | 0 advisories |
| npm audit (prod) | 0 advisories |
| Hardcoded secrets | 0 |
| Exposed client env vars | 0 |
| dangerouslySetInnerHTML | 8 (all safe — JSON.stringify or escapeHtml) |
| eval()/Function() | 0 |
| Timing-safe comparisons | 4/4 webhooks |
| License violations | 0 |

**Warnings:**
- CSP uses `'unsafe-inline'` due to PPR/nonce incompatibility (documented, intentional)
- In-memory rate limiting resets on serverless cold starts (Upstash fallback implemented)
- Nonce generated but unused in CSP (reserved for when PPR supports nonces)

---

### 3. Infrastructure (devops) — YELLOW

| Metric | Value |
|--------|-------|
| Build | SUCCESS |
| CI status (latest) | ALL PASS (4/4 workflows) |
| Undocumented env vars | 6 |
| Error pages | 3/3 (not-found, error, global-error) |
| Git state | Clean |
| Commits ahead of main | 46 |
| Health endpoint | EXISTS (comprehensive) |
| Cron routes | 3 |

**Warnings:**
- 6 env vars used in production but not in `.env.example`: `MCP_API_SECRET`, `POSTHOG_PROJECT_ID`, `POSTHOG_PERSONAL_API_KEY`, `ELEVENLABS_PHONE_NUMBER_ID`, `ELEVENLABS_BOOKING_AGENT_ID`, `ALLOW_AGENT_RUN`
- `ANTHROPIC_ADMIN_API_KEY` referenced but doesn't exist on personal accounts (dead code)
- 46 commits ahead of `main` — significant release delta
- Branch protection API returned 404 (likely PAT permissions — CI confirms checks are enforced)

---

### 4. Architecture (architect) — GREEN

| Metric | Value |
|--------|-------|
| TypeScript errors | 0 |
| Outdated packages | 25 (4 major) |
| Circular dependencies | 0 |
| Unused exports (knip) | 0 |
| Files > 500 lines | 8 |
| `as any` in prod code | 1 |
| TODO/FIXME/HACK | 0 |

**Warnings:**
- No centralized API route handler wrapper (449 `validateAdminAuth` calls across 68 files)
- 8 files > 500 lines (admin page 826, analytics panels 549–811, story-viewer 584, proxy 569)
- 4 major version bumps: `@vercel/analytics` v2, `@vercel/speed-insights` v2, `@vitejs/plugin-react` v6, `knip` v6
- `voyageai` 0.1.0 → 0.2.1 (significant for 0.x package)

---

### 5. Performance (performance-eng) — YELLOW

| Metric | Value |
|--------|-------|
| Build status | SUCCESS (with warnings) |
| Total JS (static chunks) | ~3.0 MB (pre-gzip) |
| Largest chunk | ~472 KB (ElevenLabs, dynamically imported) |
| API routes | 52 |
| Pages | 13 (+72 story slugs) |
| Dynamic imports | 12 |
| Raw `<img>` tags | 0 |
| Missing loading.tsx | 7 routes |
| `"use client"` files | 119 |

**Warnings:**
- ~130 prerender fetch warnings for `/story/[slug]` (build noise, not runtime failures)
- Largest chunk 472 KB (ElevenLabs) — dynamically imported, acceptable
- 119 "use client" components — static pages forced client-side by i18n `useTranslation()`
- 7 route segments missing `loading.tsx` (pricing most impactful)
- No `browserslist` configuration (using Next.js defaults)

**Positives:**
- All images use `next/image` (0 raw `<img>`)
- Stripe lazy-loaded properly (singleton pattern)
- `optimizePackageImports` for lucide-react and posthog-js
- No synchronous file reads in API routes
- Font self-hosted via `next/font`

---

### 6. UX/Accessibility (ux-reviewer) — YELLOW

| Metric | Value |
|--------|-------|
| Pages with proper h1 | 11/13 |
| Missing ARIA labels | 0 (visitor-facing) |
| outline-none without focus-visible | 10 (admin date inputs) |
| prefers-reduced-motion | 100% immersive, 0% explicit admin (global CSS fallback covers all) |
| Missing alt text | 0 |
| Error boundaries | 6 |
| Loading states | 7 (4 route + 3 skeleton) |
| Empty states | Present on all key pages |
| Skip link | Yes |
| aria-live regions | 2 |

**Warnings:**
- 10 admin date picker inputs: `outline-none` without any focus indicator
- Admin sub-panel h1 elements should be h2 (5 panels)
- Hardcoded Spanish `aria-label="Preguntas sugeridas"` in question-prompts.tsx
- ~15 admin inputs use `focus:` instead of `focus-visible:`
- Footer 10px text, admin 8px badges — below WCAG recommended minimum
- Checkout page has ambiguous h1 in breadcrumb

**Positives:**
- All visitor-facing pages have proper ARIA labels
- Skip link implemented
- Language sync component
- Roving tabindex in progress bar
- Dedicated accessibility test file
- All forms have proper label associations

---

## Recommendations Priority

### Quick wins (batch into one PR)
1. Document 6 missing env vars in `.env.example` and CLAUDE.md
2. Fix hardcoded aria-label in question-prompts.tsx (use `t()`)
3. Remove dead `ANTHROPIC_ADMIN_API_KEY` reference
4. Add `.first()` to remaining admin focus indicator date inputs

### Medium effort
5. Add `loading.tsx` to `/pricing` route
6. Demote admin sub-panel h1 → h2
7. Standardize admin focus styles to `focus-visible:`
8. Suppress prerender fetch warnings with proper try/catch

### Lower priority
9. Major dependency upgrades (`@vercel/analytics` v2, etc.)
10. Decompose large admin files (826-line admin page)
11. Server-side i18n for static pages
12. Add `browserslist` configuration
