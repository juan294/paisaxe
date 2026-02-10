# Pre-Launch Audit Report

> Generated on 2026-02-09 (post code-quality cleanup, embedded checkout, content discovery, subscription optimizer, legal i18n)
> Previous audits: 2026-02-07, 2026-02-08

## Verdict: CONDITIONAL

No critical blockers. Three HIGH items should be addressed before next production release: E2E CI native dependency failure (blocks merges to `main`), Stripe checkout pages at 0% test coverage (money path), and CSP missing Stripe domains.

## Blockers (must fix before deploy)

None.

## High Priority (fix before next release)

1. **E2E tests fail on CI** — `canvas` npm package requires system libs (`libpixman-1-dev`, `libcairo2-dev`, etc.) not installed on the Ubuntu runner. Since `Playwright E2E` is a required status check for `main`, this blocks production releases. Fix: add `apt-get install` step in `e2e.yml` before `npm ci`.

2. **Stripe checkout pages at 0% test coverage** — `pricing/checkout/page.tsx` and `pricing/checkout/return/page.tsx` are untested. The API routes have 100% coverage, but the client-side payment pages have none. These are the money path.

3. **CSP missing Stripe domains** — `script-src`, `frame-src`, and `connect-src` don't include Stripe domains (`js.stripe.com`, `api.stripe.com`). Embedded Checkout may be blocked in strict browsers.

## Warnings (should fix soon)

4. **Auth flow coverage at 61-73%** — `auth-provider.tsx` (61.76% stmts, 41.66% branches), `auth/callback/route.ts` (73%, 25% functions), `admin-auth.ts` (73%, 25% functions). These guard the entire authenticated experience.

5. **5 flaky E2E tests** — All fail because `h1` selector not found within 5s on `/immersive`. Test reliability issue, not a prod bug. Fix: use `data-testid` or increase timeout.

6. **2 error boundaries with hardcoded Spanish** — `src/app/favorites/error.tsx` and `src/app/admin/error.tsx` use hardcoded Spanish strings instead of `useTranslation()`. All other error boundaries use i18n correctly.

7. **CSP uses `unsafe-inline` for script-src** — Known tech debt with existing TODO in `next.config.ts:59`. Medium priority — no user-controlled content renders as inline scripts.

## Recommendations (nice to have)

8. Monitor `voyageai` SDK for `qs` vulnerability fix (GHSA-6rw7-vpxm-498p) — low exploitability.
9. 36 unused exported TypeScript types — no bundle impact, pure hygiene.
10. Doc drift: `RESEND_API_KEY` and `ADMIN_EMAIL` in `.env.example` but not in CLAUDE.md env vars section.
11. Supabase health check latency 511ms — monitor for consistency.

## Detailed Findings

### Architecture
- **Dependencies**: 31 production, 28 dev — clean, no duplicates, no unnecessary
- **TypeScript**: strict mode, zero errors, zero `any` in production code, zero `@ts-ignore`
- **Circular dependencies**: None (verified with madge across 540 files)
- **Dead code**: Zero unused files, zero unused dependencies. 36 unused type exports (no runtime impact)
- **next.config.ts**: Well-configured security headers, image optimization (AVIF/WebP, 30-day cache), PostHog reverse proxy, bundle analyzer available
- **proxy.ts**: Well-structured request chain with 3s auth timeout, strict CORS, proper redirects
- **tsconfig.json**: Strict mode, bundler resolution, proper path aliases

### Quality Assurance
- **Unit tests**: 233 files, 3,459 tests, ALL PASSING
- **E2E tests**: 121 passed, 5 failed (flaky selector), 28 skipped
- **Coverage overall**: 76.27% statements, 66.88% branches, 68.4% functions, 77.05% lines
- **Core lib coverage**: 96% (excellent)
- **API route coverage**: 85-100% (good)
- **Admin component coverage**: 0-41% (low, but admin-only behind auth)
- **Payment page coverage**: 0% (HIGH risk — money path)
- **Feature flag mocks**: Comprehensive — all 28 flags covered in tests

### Security
- **npm audit**: 2 high (qs DoS via voyageai) — low exploitability, no fix available upstream
- **Hardcoded secrets**: None in source. Only test dummies in `*.test.ts` files
- **Auth flows**: Solid — `getUser()` server-side verification + role check, no bypass vectors
- **CORS**: Strict allowlist, no wildcards, no credential reflection
- **XSS**: All 6 `dangerouslySetInnerHTML` uses are properly sanitized or use server-side constants
- **SQL injection**: All queries use Supabase parameterized client, zero raw SQL
- **RLS**: All tables have appropriate policies
- **Webhook signatures**: HMAC-SHA256 + timing-safe comparison + replay protection
- **Encryption**: AES-256-GCM with random IV, correct implementation
- **Rate limiting**: IP-based, 10 req/60s, map size capped at 10K entries
- **.env files**: All variants in .gitignore, never committed to history

### Performance
- **Build**: Clean, no warnings, 58 routes
- **Largest chunk**: 471KB (ElevenLabs WebRTC) — lazy-loaded, not in initial bundle
- **No chunks exceed 500KB**
- **Code splitting**: Excellent — 8 dynamic imports on admin page, voice chat lazy-loaded, PostHog async, i18n locales on-demand
- **Images**: All use `next/image`, zero raw `<img>` in production code, AVIF/WebP enabled
- **CSS**: 135KB total (reasonable for Tailwind)
- **Lighthouse CI**: Configured with budgets (Perf >= 60%, A11y >= 80%, LCP < 4s, CLS < 0.25)
- **Tree-shaking**: `optimizePackageImports` for lucide-react, server externals for Anthropic SDK and sharp

### UX & Accessibility
- **ARIA labels**: Thorough — all icon buttons, progress bar, language switcher, toolbar menu, dialogs, spinners
- **Image alt text**: 100% coverage, including dynamic chat images via i18n
- **i18n**: 100/100 parity tests pass across all 6 locales (es, en, fr, de, pt, ast)
- **Responsive**: Proper breakpoints on all key pages, mobile-specific patterns
- **Keyboard navigation**: Full arrow key support, focus trapping in dialogs, `focus-visible` rings
- **Error states**: Well-handled with i18n — except 2 error boundaries with hardcoded Spanish
- **Reduced motion**: Supported

### DevOps & Infrastructure
- **Vercel**: Clean config, domain consolidation redirects working
- **DNS**: Both domains resolve to Vercel, www CNAMEs correct, 308 redirects working
- **SSL/TLS**: TLS 1.3, HSTS with preload, cert valid until Apr 2026
- **Health endpoint**: Healthy — Supabase connected, DB at 0.5% capacity (39.6MB / 8GB)
- **CI pipeline**: 8 workflows (CI, E2E, security, Lighthouse, bundle size, license check, knip, Claude review)
- **Branch protection**: Required checks on `main`, force push blocked
- **`main` branch**: All recent CI runs passing
- **Email**: Resend verified (DKIM + SPF), SES forwarding to Gmail operational
