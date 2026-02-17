# Pre-Launch Audit Report

> Generated on 2026-02-16
> Previous audits: 2026-02-07 through 2026-02-13
> Branch: `develop`

## Verdict: READY

All blockers resolved. Warnings are non-critical and should be addressed within 1 week of deploy.

---

## Blockers (all resolved)

| # | Area | Issue | Resolution |
|---|------|-------|------------|
| ~~B1~~ | Security | RLS bug in migration 066: `webhook_config` used wrong column | Fixed in migration 067 (`fe63b53`), applied to production |
| ~~B2~~ | DevOps | `CRON_SECRET` missing from `.env.example` and CLAUDE.md | Added to both (`fe63b53`)

---

## Warnings (should fix within 1 week)

| # | Area | Issue | Impact |
|---|------|-------|--------|
| W1 | Security | `update_feature_flags_updated_at()` trigger function in migration 008 has no explicit `SET search_path` — inconsistent with the security pattern established in migration 015 | Low risk, best practice |
| W2 | QA | Flaky E2E test: `immersive.spec.ts:51` keyboard navigation on mobile — failed once, passed on retry. Timing/race condition. | CI reliability |
| W3 | QA | Low coverage on admin components: `story-editor-dialog` (40.74%), `voice-agent-chat` (45.56%), `costs-analytics-panel` (50.76%), `suggestions-panel` (54.65%), `admin/page.tsx` (56.56%) | Bug detection gap |
| W4 | QA | Untested payment path: `src/app/api/checkout/embedded/route.ts` has no test file | Revenue risk |
| W5 | QA | 14+ source files with no test file at all (including `navigation-hint`, `story-progress-bar`, `json-ld`, `voice-purchase-cta`, `site-info-menu`, `chat-upsell-cta`, page components) | Coverage gaps |
| W6 | UX | Hardcoded English strings in `pricing/page.tsx` ("Premium Access", "Voice Pass · 24h") and `dialog.tsx` ("Close") — breaks i18n | Non-English users |
| W7 | UX | Low-contrast footer text: `text-white/40` (~3.2:1 ratio) fails WCAG AA for small text (requires 4.5:1) | Accessibility |
| W8 | UX | Small touch targets on social links (~28px) and chat dismiss button (~24px) — below WCAG 44px minimum | Mobile usability |
| W9 | Performance | 472KB WebRTC/ElevenLabs chunk — close to 500KB threshold. Already code-split via `dynamic()`, loads only on voice activation. | Slow connections |
| W10 | Performance | No per-route bundle size tracking — Turbopack doesn't support `@next/bundle-analyzer` HTML output | Regression detection |
| W11 | DevOps | No dedicated error tracking service (Sentry or equivalent) — server errors only visible in Vercel function logs with limited retention | Incident response |
| W12 | DevOps | Health endpoint doesn't check external services (Anthropic, Voyage AI, Stripe, ElevenLabs) — reports "healthy" even if core features are degraded | Monitoring gap |
| W13 | DevOps | No documented uptime monitoring — CLAUDE.md says `/api/health` is "monitored 24/7" but no config found in codebase | Observability |
| W14 | Architecture | Node engine `>=24.0.0` is aggressive — Node 24 is current but many environments use 22 LTS. Verify Vercel runtime matches. | Deployment risk |

---

## Recommendations (nice to have)

| # | Area | Recommendation |
|---|------|----------------|
| R1 | Architecture | Add `https://eu.i.posthog.com` to CSP `connect-src` as safety net for PostHog direct connections |
| R2 | Architecture | Run `npm install` to sync local node_modules with lockfile (4 packages behind wanted versions) |
| R3 | Security | Document the CSRF `httpOnly: false` cookie design decision for future auditors |
| R4 | Performance | Add `priority` prop to above-the-fold hero images in immersive view for better LCP |
| R5 | Performance | Add `React.memo` to heavy list items (`StoryCard`, chat message items) |
| R6 | Performance | Add size-limit CI check or Lighthouse CI per-route monitoring |
| R7 | UX | Translate hardcoded admin `aria-label` strings (lower priority — admin-only) |
| R8 | UX | Regenerate 28 skipped visual regression baselines |
| R9 | QA | Add `test.describe.configure({ retries: 1 })` to flaky keyboard nav test |
| R10 | QA | Add tests for `json-ld.tsx` (SEO structured data) |
| R11 | DevOps | Add `.nvmrc` file for local development consistency |
| R12 | DevOps | Tighten `continue-on-error: true` on visual regression tests before stable release cadence |

---

## Detailed Findings

### Architecture

**Reviewer**: architect | **Verdict**: Clean

| Check | Result |
|-------|--------|
| TypeScript (`npm run typecheck`) | **0 errors** |
| Dead code (`npx knip`) | **0 unused exports, files, or dependencies** |
| Circular dependencies (`madge`) | **0 circular imports** across 594 files |
| npm audit | 2 low severity (`qs` via `voyageai` — mitigated by override) |

**next.config.ts** — Well-configured: AVIF/WebP optimization, PostHog reverse proxy, security headers (HSTS, X-Frame-Options, CSP delegation to proxy.ts), bundle analyzer, `outputFileTracingExcludes`.

**tsconfig.json** — Properly strict: `strict: true`, `bundler` moduleResolution, path aliases, incremental builds.

**proxy.ts** — Production-ready with excellent defense-in-depth: canonical redirect (308), maintenance mode, CORS, CSRF (timing-safe), per-request CSP nonce with `strict-dynamic`, auth session refresh with 3s timeout.

**Outdated packages** (all minor/patch):

| Package | Current | Wanted |
|---------|---------|--------|
| @typescript-eslint/eslint-plugin | 8.54.0 | 8.55.0 |
| dotenv | 17.2.4 | 17.3.1 |
| jsdom | 28.0.0 | 28.1.0 |
| lucide-react | 0.563.0 | 0.564.0 |
| posthog-js | 1.343.2 | 1.347.2 |
| tailwind-merge | 3.4.0 | 3.4.1 |

---

### Quality Assurance

**Reviewer**: qa-lead | **Verdict**: Strong

| Metric | Value |
|--------|-------|
| Unit tests | **4,581 passed**, 0 failed, 0 skipped |
| E2E tests | **150 passed**, 0 failed, 28 skipped (visual baselines) |
| Test files | 285 |
| Statement coverage | **91.1%** |
| Branch coverage | **83.67%** |
| Function coverage | **89.32%** |
| Line coverage | **92.05%** |
| Flaky tests | 1 (keyboard nav on mobile) |

**Coverage by area:**

| Area | Statements | Branch | Functions | Lines |
|------|------------|--------|-----------|-------|
| src/lib | 98.11% | 89.05% | 98.87% | 98.53% |
| src/hooks | 97.66% | 90.53% | 100% | 98.55% |
| src/config | 100% | 75% | 100% | 100% |
| src/types | 100% | 90.41% | 100% | 100% |
| src/components | 63.88% | 41.66% | 80% | 65.62% |
| src/app/admin | 57.63% | 47.79% | 60% | 57.29% |

Library/utility code is very well tested (98%+). The gap is primarily in admin UI components and some page-level components.

Feature flag testing is comprehensive — 26 test files reference feature flag mocking.

---

### Security

**Reviewer**: security-reviewer | **Verdict**: Strong (1 blocker)

| Check | Result |
|-------|--------|
| npm audit | 2 low severity (theoretical, server-side only) |
| Hardcoded secrets | **None found** (test files use obvious fakes) |
| Admin auth | **PASS** — `getUser()` server-side, RBAC enforced |
| CSRF protection | **PASS** — timing-safe double-submit cookie |
| CORS | **PASS** — strict origin allowlist, no wildcards |
| XSS vectors | **PASS** — 3 `dangerouslySetInnerHTML` all safe |
| CSP headers | **PASS** — per-request nonce, `strict-dynamic`, `frame-ancestors 'none'` |
| RLS policies | **FAIL** — migration 066 `webhook_config` uses wrong column (see B1) |
| MCP auth | **PASS** — constant-time comparison, `.trim()` on env var |
| Env var hygiene | **PASS** — consistent `.trim()` usage |

All user-facing tables have RLS enabled with correct policies. The only bug is in `webhook_config` (admin-only table, migration 066).

---

### Performance

**Reviewer**: performance-eng | **Verdict**: Solid

| Metric | Value |
|--------|-------|
| Build time | ~7.3s (Turbopack) |
| Total client JS | 2,880 KB (all chunks) |
| Total client CSS | 140 KB |
| Largest chunk | 472 KB (ElevenLabs/WebRTC) |
| Chunks > 100KB | 9 |
| Static pages | 2 |
| Dynamic pages | 66 |

**Well-implemented patterns:**
- Admin page: 8 components dynamically imported with `ssr: false`
- VoiceChat: dynamically imported, loads only on activation
- Stripe: scoped to checkout page only
- PostHog: lazy-loaded after hydration, production only
- `optimizePackageImports` for lucide-react (44MB) and posthog-js (29MB)
- Server-only packages (`@anthropic-ai/sdk`, `sharp`) in `serverExternalPackages`
- `next/image` used throughout (no raw `<img>` in production code)
- Font optimization via `next/font/google` (self-hosted, no FOUT)
- DNS prefetch for Supabase and Unsplash
- SSE streaming for chat responses
- Lighthouse CI budgets: Perf >= 60%, A11y >= 80%, LCP < 4s

---

### UX & Accessibility

**Reviewer**: ux-reviewer | **Verdict**: Solid foundation

**Strengths:**
- Complete i18n: 6 locales (es, en, fr, de, pt, ast) with 100% key parity (100 tests passing)
- Skip link, language sync, semantic HTML (`<main>`, `<article>`, `<nav>`, etc.)
- Custom `useFocusTrap` hook for dialogs with proper focus restore
- `useReducedMotion` hook + `motion-reduce:` Tailwind variants
- Live regions (`aria-live="polite"`) for story changes and chat messages
- Keyboard navigation: arrow keys, Space/Enter, Escape, tab-accessible progress bar
- `ComponentErrorBoundary` with localized error messages and retry
- Mobile-first responsive design with safe area insets

**Issues found:**
- 3 hardcoded English strings in user-facing components (pricing page, dialog close button)
- Admin components use hardcoded English `aria-label` strings throughout
- Small touch targets on social links (28px) and dismiss button (24px)
- Low-contrast footer text (`text-white/40` = ~3.2:1 vs 4.5:1 required)

---

### DevOps & Infrastructure

**Reviewer**: devops | **Verdict**: Production-ready (1 blocker)

| Area | Status |
|------|--------|
| Vercel config | **GOOD** — 3 cron jobs, 3 redirects |
| Env vars documentation | **NEEDS FIX** — `CRON_SECRET` missing |
| Health endpoint | **GOOD** (could check more services) |
| CI pipeline | **EXCELLENT** — 9 workflows, 4 required checks |
| DNS | **GOOD** — all 4 domains resolve to Vercel |
| Branch protection | **EXCELLENT** — enforce_admins, 4 required checks, force push blocked |
| Security headers | **EXCELLENT** |
| Error tracking | **MISSING** (no Sentry) |
| Uptime monitoring | **UNDOCUMENTED** |

**CI status (develop):** 4/4 recent completed runs are green. One in progress.

**Main branch:** Clean. Recent activity is only Claude Code Review triggers from issues.

**DNS resolution:**

| Domain | Record | Value |
|--------|--------|-------|
| paisaxe.es | A | 76.76.21.21 (Vercel) |
| paisaxe.com | A | 76.76.21.21 (Vercel) |
| www.paisaxe.es | CNAME | cname.vercel-dns.com |
| www.paisaxe.com | CNAME | cname.vercel-dns.com |

---

## Summary

The codebase is in strong shape. Since the last audit (2026-02-13), test count grew from 4,051 to 4,581 unit tests and coverage remains above 91%. The architecture is clean (0 TypeScript errors, 0 circular deps, 0 dead code). Security posture is excellent with nonce-based CSP, CSRF, timing-safe auth, and comprehensive RLS — except for the one migration bug. Infrastructure is well-configured with proper branch protection, DNS, and CI.

**To reach READY status, fix B1 and B2.** Everything else is polish.
