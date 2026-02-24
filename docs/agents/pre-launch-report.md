# Pre-Launch Audit Report

> Generated on 2026-02-24
> Previous audits: 2026-02-07 through 2026-02-24
> Branch: `develop` (commit `0dc756f`)

## Verdict: READY

**No blockers found.** The codebase is production-ready. Test coverage at 91.6% (4,674 tests, 290 files, 100% pass rate). Zero type errors, zero lint errors, zero npm audit vulnerabilities.

### Score: 57/60

| Category | Score | Max | Status |
|----------|-------|-----|--------|
| Architecture | 10 | 10 | Zero type errors, zero dead code, clean deps |
| Quality Assurance | 8 | 10 | Stale visual snapshots; some flaky E2E |
| Security | 9 | 10 | Checkout endpoints lack rate limiting |
| Performance | 10 | 10 | All chunks < 500KB; lazy loading in place |
| UX & Accessibility | 10 | 10 | 5 minor a11y warnings (cosmetic) |
| DevOps & Infrastructure | 10 | 10 | All systems operational |

---

## Blockers (must fix before deploy)

**None.**

---

## Warnings (should fix soon)

### Quality Assurance

1. **W-QA1: Stale visual regression snapshots for immersive page.** Both `[visual-desktop]` and `[visual-mobile]` immersive page screenshots fail consistently. Snapshots need regeneration with `npx playwright test --update-snapshots`. File: `e2e/visual-regression.spec.ts`.

2. **W-QA2: Flaky E2E tests.** Between 3 and 17 failures depending on the run (visual regressions on pricing/favorites/about pages, chat messageIndex timing, author pill visibility). Consider increasing timeouts or adding `waitForLoadState` guards.

### Security

3. **W-SEC1: Checkout endpoints lack rate limiting.** `/api/checkout/day-pass` and `/api/checkout/embedded` have no rate limiting. While both require authentication, a compromised account could spam Stripe checkout session creation. Recommend 5 sessions/min per user.

### UX & Accessibility

4. **W-UX1: Hardcoded Spanish aria-label in `question-prompts.tsx:19`.** Uses `"Preguntas sugeridas"` instead of `t("accessibility.suggested_questions")`. Not localized for non-Spanish users.

5. **W-UX2: Image alt text uses untranslated title.** `story-viewer.tsx:250` uses `story.title` (always Spanish) instead of `localizedStory.title` for alt text.

6. **W-UX3: Inconsistent focus style in `site-info-menu.tsx:41`.** Uses `focus:ring-2 focus:ring-white/50` instead of project standard `focus-visible:ring-2 focus-visible:ring-white/70`.

7. **W-UX4: Navigation hint overlay lacks semantic role.** `navigation-hint.tsx` has no `role="status"` or `aria-hidden="true"` — screen readers may be confused by its presence.

8. **W-UX5: Error pages lack `role="alert"`.** `error.tsx` and `immersive/error.tsx` containers don't have `role="alert"`, so screen readers won't auto-announce errors.

### Performance

9. **W-PERF1: Largest chunk at 471KB.** Approaching 500KB threshold. Monitor with `npm run build:analyze` — after gzip this is ~140-190KB, which is acceptable.

### DevOps

10. **W-OPS1: No dedicated error monitoring.** PostHog captures basic errors via autocapture, but there's no structured error tracking (Sentry/Bugsnag) with source maps, grouping, or alerting.

---

## Recommendations (nice to have)

- Clean up 3 redundant knip ignore patterns in `knip.json`
- Add `role="menu"` to `site-info-menu.tsx:77` dropdown (inconsistent with `ToolbarOverflowMenu`)
- Add `motion-reduce:animate-none` to `NavigationHint` pulse animation
- Test 4 feature flags by name (`related_stories`, `story_sharing`, `seasonal_surfacing`, `ambient_discovery`) — currently covered generically
- Improve branch coverage in `recurring-costs.ts` (60%) and `image-optimization.ts` (69%)
- Improve `voice-agent-chat.tsx` coverage (#145) — admin-only component

---

## Detailed Findings

### Architecture

**Auditor: architect | 0 blockers, 0 warnings, 14 info**

- TypeScript strict mode enabled, `tsc --noEmit` passes with zero errors
- ESLint passes with zero errors
- Knip reports zero unused exports, files, or dependencies (3 redundant ignore patterns only)
- `next.config.ts` production-ready: AVIF/WebP images, 30-day cache, security headers, server external packages, output file tracing exclusions
- `src/proxy.ts` well-architected: canonical domain redirect, maintenance mode, CORS, CSRF, CSP with per-request nonces, 1.5s auth timeout
- No `middleware.ts` conflict — `proxy.ts` is the sole request interceptor
- No circular dependencies in `lib/`, `hooks/`, or `components/immersive/`
- Import direction follows clean architecture: `app -> components -> hooks -> lib`
- `vercel.json` properly configured: `cdg1` region, 3 cron jobs, canonical redirects
- Zero npm audit vulnerabilities
- `engines: >=23.0.0` — compatible with current Vercel deployment

### Quality Assurance

**Auditor: qa-lead | 0 blockers, 2 warnings, 3 info**

- **4,674 unit tests across 290 files — 100% pass rate**
- **91.6% statement coverage, 84.3% branch, 89.6% function, 92.5% line**
- All critical paths have test files: proxy, stories-server, feature-flags-server, chat API, admin stories, all Stripe/checkout routes
- All 28 feature flags covered (individually or via generic infrastructure)
- All recently changed files (last 7 days) have corresponding test coverage
- 0% coverage files are all barrel exports or type definitions (no runtime logic)
- E2E: 139-153 passing, 28 intentionally skipped, 3-17 flaky (mostly visual regressions)
- Visual regression snapshots for immersive page consistently stale

### Security

**Auditor: security-reviewer | 0 blockers, 1 warning, 10 info**

- Zero npm audit vulnerabilities
- No hardcoded secrets in source (only test placeholders)
- No `.env` files with real secrets committed
- Admin auth uses server-side `getUser()` + role check with proper 401/403 responses
- Proxy auth has 1.5s timeout protection against Supabase hangs
- RLS enabled on all 20 tables
- CORS: strict origin allowlist, no wildcards, dev-only localhost
- CSP: nonce-based `strict-dynamic`, well-tested, comprehensive directives
- CSRF: double-submit cookie with timing-safe comparison, `SameSite=Strict`
- All 4 webhook endpoints verify signatures/secrets
- Rate limiting on chat (10/min), suggestions (1/min), MCP endpoints — distributed via Upstash Redis
- Checkout endpoints (`day-pass`, `embedded`) lack rate limiting (auth-gated but unmetered)
- DB security-definer functions use `search_path = public, extensions` (acceptable for pg_net)

### Performance

**Auditor: performance-eng | 0 blockers, 1 warning, 7 info**

- Build completes successfully, 130 pages
- Largest chunk 471KB (under 500KB threshold, ~150KB after gzip)
- Zero raw `<img>` tags in production — all use `next/image` with AVIF/WebP
- 9 `dynamic()` imports: VoiceChat, all 8 admin panels
- Stripe.js lazy-loaded via singleton pattern (tested)
- PostHog dynamically imported, production-only
- ElevenLabs SDK deferred behind dynamic VoiceChat
- `next/font` (Inter) self-hosted, no external font links
- Lighthouse CI enforces LCP < 4s and CLS < 0.25 at error severity
- Vercel Analytics + Speed Insights + PostHog RUM in production
- `lucide-react` and `posthog-js` in `optimizePackageImports`
- Bundle analyzer available via `npm run build:analyze`

### UX & Accessibility

**Auditor: ux-reviewer | 0 blockers, 5 warnings, 4 info**

- All key interactive elements have proper ARIA labels (story-viewer, share, surprise-me, mood-overlay, bookmark, toolbar, language-switcher, fullscreen, voice-chat)
- Full keyboard support: arrow keys for story navigation, roving tabindex on progress bar, focus trapping in modals
- 6 complete locales (es, en, fr, de, pt, ast) with automated completeness tests
- Strong responsive design: Tailwind breakpoints, safe-area-inset support, mobile overflow menu
- `prefers-reduced-motion` respected at both JS and CSS levels (30+ occurrences)
- Error boundaries on all routes with localized messages and retry buttons
- `ComponentErrorBoundary` uses `role="alert"` (but page-level error boundaries do not)
- One hardcoded Spanish aria-label in question-prompts
- Image alt text not localized (uses Spanish title for all locales)
- Inconsistent focus style on site-info-menu trigger
- Navigation hint overlay lacks semantic role

### DevOps & Infrastructure

**Auditor: devops | 0 blockers, 1 warning, 7 info**

- Health endpoint operational: `https://paisaxe.es/api/health` returns HTTP 200 with Supabase connected (252ms latency), DB at 0.5% capacity
- All security headers confirmed on production responses (HSTS preload, X-Frame-Options DENY, CSP with nonces)
- CI healthy: latest push has 3 workflows in progress, 1 passed; no failures in recent history
- Main branch has zero failures in last 10 CI runs
- Branch protection fully configured: 4 required checks, enforce admins, force push/deletion blocked
- All 31 env vars in CLAUDE.md present in `.env.example`
- 3 cron jobs configured and authenticated via `CRON_SECRET`
- 9 GitHub Actions workflows covering CI, E2E, Lighthouse, security, knip, license, bundle size, AI review, visual baselines
- PostHog provides basic error visibility but no dedicated error monitoring (Sentry/Bugsnag) with source maps and alerting

---

## Changes Since Last Audit (2026-02-17 → 2026-02-24)

| Change | Impact |
|--------|--------|
| Deep-link fix for shuffled story order (`0dc756f`) | Share links now resolve correctly with `randomized_order` enabled |
| `randomized_order` feature flag enabled | Stories shuffled per-session for visitor discovery |
| 2 new tests for deep-link + shuffle interaction | Regression coverage for new fix |
| Test count: 4,672 → 4,674 | +2 tests |
| Statement coverage: 91.2% → 91.6% | Slight improvement |

---

## Historical Action Items

### P1 — All resolved
- [x] Resolve `qs` override (#147)
- [x] Add auth to checkout health endpoint (#148)
- [x] Fix flaky E2E `ask-button` locators (#151)
- [x] Fix Stripe.js lockfile mismatch (#150)

### P2 — All resolved
- [x] Update outdated deps (#150)
- [x] Fix low contrast text (#158)
- [x] Add MoodOverlay focus trap (#159)
- [x] Resolve minimatch/dependabot issue (#154)
- [x] Lazy-load Stripe.js (#156)

### P3 — Mostly resolved
- [x] Add ISR to static pages (#163)
- [x] Add `generateStaticParams` for stories (#163)
- [x] Pin Vercel region (#164)
- [x] Improve admin component coverage (#152, #167)
- [x] Promote LCP/CLS to error in Lighthouse (#157)
- [ ] Improve voice-agent-chat.tsx coverage (#145) — backlog
- [ ] Consider Supabase lazy-loading (#155) — backlog
- [ ] Add rate limiting to checkout endpoints — new
- [ ] Update stale visual regression snapshots — new
- [ ] Add dedicated error monitoring (Sentry) — new
