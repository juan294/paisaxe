# Pre-Launch Audit Report
> Generated on 2026-02-06 by 6-specialist agent team

## Verdict: CONDITIONAL

No critical blockers prevent deployment. However, several warnings — particularly around i18n gaps in the admin panel and error pages, unauthenticated MCP endpoints, and missing HSTS header — should be addressed within the first week post-launch.

---

## Blockers (must fix before deploy)

None.

---

## Warnings (should fix soon)

### i18n & UX
1. **Spanish admin section is untranslated** — `src/lib/i18n/es.ts` lines 267-333 contain English text identical to `en.ts`. Spanish-speaking admins see English UI. All other locales (fr, de, pt, ast) are properly translated.
2. **Error/404 pages are hardcoded in Spanish only** — `src/app/error.tsx`, `global-error.tsx`, `immersive/error.tsx`, `not-found.tsx` don't use the i18n system. International visitors hitting errors see untranslated Spanish.
3. **Skip link hardcoded in Spanish** — `src/components/a11y/skip-link.tsx` uses "Ir al contenido principal" instead of the existing `accessibility.skip_to_content` translation key.
4. **Asturian locale missing from i18n test suite** — `translations.test.ts` validates es, en, fr, de, pt but not `ast`. Key mismatches would go undetected.
5. **Chat dialog lacks focus trap** — `voice-chat.tsx` renders a `role="dialog"` but users can Tab out into the background page.

### Security
6. **MCP endpoints lack authentication** — `/api/mcp/make-booking` can trigger outbound phone calls without any auth. `/api/mcp/weather` and `/api/mcp/places` have no rate limiting and consume paid API quotas.
7. **Missing HSTS header** — `Strict-Transport-Security` not configured in `next.config.ts`. While Vercel enforces HTTPS at the edge, an explicit HSTS header protects against protocol downgrade attacks.
8. **CSP includes `unsafe-eval`** — `script-src` allows `'unsafe-eval'` which weakens XSS protection. May have been added for HMR during development.
9. **Checkout error detail leakage** — `/api/checkout/day-pass` returns `details: errorMessage` in error responses, potentially exposing internal implementation details in production.
10. **npm audit: 2 high severity in `qs`** — DoS via memory exhaustion in `qs` < 6.14.1, transitive via `voyageai` SDK. Low exploitability (only used for SDK API calls, not user input parsing). No upstream fix available yet.

### Architecture & Dependencies
11. **Unused dependency: `@elevenlabs/client`** — Listed in `package.json` but never imported. Only `@elevenlabs/react` is used.
12. **Unused dependency: `eslint-config-next`** — Project uses flat ESLint config with `@next/eslint-plugin-next` directly.
13. **`lint-staged` installed but not wired up** — Pre-commit hook runs full suite instead. Either configure lint-staged (faster commits) or remove it.
14. **`dotenv` in dependencies instead of devDependencies** — Only used in `scripts/`, not in `src/`.
15. **Unused file: `src/components/admin/agent-chat.tsx`** — Not imported anywhere.
16. **`src/lib/stripe.ts` missing `server-only` guard** — Could leak Stripe SDK into client bundle if accidentally imported from a client component.

### DevOps
17. **`.env.example` missing 6 required variables** — `WEBHOOK_SECRET`, `NEXT_PUBLIC_SITE_URL`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, `QA_ALERT_PHONE`.
18. **No Node.js version pinned at project root** — CI uses Node 20, local dev runs Node 23. No `.nvmrc` or `engines` field.
19. **Health endpoint always returns HTTP 200** — Even when status is "degraded". Monitoring tools need non-2xx to trigger alerts.

### Performance
20. **Admin page has no code splitting (728KB SSR chunk)** — All 7 tab panels are eagerly imported. Could use `next/dynamic` per tab panel.

### QA
21. **4 API routes have 0% test coverage** — `agents-summary`, `costs-analytics`, `costs-analytics/[id]`, `tunnel` routes.
22. **42 recently-changed source files lack test files** — Concentrated in admin dashboard components.

---

## Recommendations (nice to have)

- **Distributed rate limiting** — Move from in-memory to Redis/Upstash for rate limiting at scale.
- **CSP reporting** — Add `report-uri` or `report-to` directive to monitor CSP violations.
- **CODEOWNERS file** — Auto-assign reviewers by directory/file pattern.
- **Knip enforcement** — Currently runs in report-only mode (`--no-exit-code`). Enable enforcement to prevent regressions.
- **Add `APP_VERSION` from package.json** — Health endpoint hardcodes "0.1.0".
- **17 unused exports + 17 unused types** — Mostly shadcn defaults and agent utilities. Low priority but good hygiene.

---

## Detailed Findings

### Architecture
**Reviewer: architect**

- **TypeScript**: `npm run typecheck` passes cleanly. Zero type errors.
- **tsconfig.json**: `strict: true` enabled. `isolatedModules`, `bundler` module resolution correctly set.
- **next.config.ts**: Comprehensive security headers, proper image config (AVIF + WebP, 30-day cache), bundle analyzer gated behind `ANALYZE` env var. `serverExternalPackages` correctly excludes `@anthropic-ai/sdk` and `sharp`.
- **proxy.ts**: Well-structured. Maintenance mode with 30s revalidation, explicit CORS allowlist, auth session refresh via `getUser()`. Correct matcher pattern for static assets.
- **Circular dependencies**: None detected. Clean dependency graph.
- **Dead code (knip)**: 1 unused file, 3 unused dependencies, 17 unused exports, 17 unused types, 1 duplicate export (`FALLBACK_STORIES`/`STORIES` in `stories-data.ts`).

### Quality Assurance
**Reviewer: qa-lead**

- **Unit tests**: 192 files, **2705 passed**, 1 skipped, 0 failures.
- **E2E tests**: 140 Playwright tests across 9 spec files (Playwright v1.58.0).
- **Coverage**: 66.46% statements, 60.29% branches, 61.64% functions, 67.13% lines.
- **Feature flag mocking**: 18 test files properly mock feature flags.
- **Gaps**: Admin components have thin coverage (marketing-dashboard 2.36%, suggestions-panel 3.48%, voice-agent-chat 1.26%, story-editor-dialog 0%). Visitor-facing critical paths (stories, chat, suggestions, payments) have solid coverage.
- **Recently changed files**: 119 of 161 changed files have tests. 42 lack test coverage, concentrated in admin dashboard components.

### Security
**Reviewer: security-reviewer**

- **Hardcoded secrets**: None found in source code. All API keys read from env vars with `.trim()`.
- **Auth flows**: `validateAdminAuth()` correctly uses `getUser()` (server-side validation) + role check. Consistently called across 15+ admin routes.
- **RLS policies**: All tables have RLS enabled. User-scoped favorites, admin-only marketing tables, service-role-only pending bookings. Migration 049 added RLS performance optimizations. All SECURITY DEFINER functions have explicit `SET search_path = ''`.
- **CORS**: Explicit domain allowlist, no wildcard `*`, localhost only in dev. Preflight handled correctly.
- **XSS**: `dangerouslySetInnerHTML` only used for JSON-LD structured data (safe pattern). `chat-safety.ts` provides prompt injection detection, input sanitization, and output leak detection.
- **CSP**: Comprehensive but weakened by `unsafe-inline`/`unsafe-eval` in `script-src` (common Next.js requirement).
- **.gitignore**: Properly excludes `.env*`, `.vercel/`, sensitive files.

### Performance
**Reviewer: performance-eng**

- **Build**: Succeeds cleanly. Total client static assets: 3.3MB.
- **Chunk sizes**: Largest client chunks 468KB x2 (below 500KB threshold). Admin SSR chunk 728KB (not client-shipped).
- **Code splitting**: VoiceChat dynamically imported with `ssr: false`. PostHog lazy-loaded. `@anthropic-ai/sdk` and `sharp` in `serverExternalPackages`.
- **Image optimization**: All production components use `next/image`. Raw `<img>` only in test mocks. Proper `sizes`, `priority` on hero image, prefetching for adjacent stories.
- **Lighthouse CI**: Configured with Perf >= 60%, A11y >= 80%, LCP < 4s, CLS < 0.25, TBT < 500ms. Runs on PRs with 3-run median.
- **Tree shaking**: lucide-react uses named imports. No bundle bloat from icon libraries.

### UX & Accessibility
**Reviewer: ux-reviewer**

- **ARIA patterns**: Well-structured — `role="progressbar"` with aria-value*, `role="log"` with `aria-live="polite"`, `role="tablist"` + `role="tab"` in admin.
- **Keyboard navigation**: Arrow keys, Space, `i` key, Escape all properly handled. Disabled when chat is open. Admin story cards have `tabIndex={0}` + `onKeyDown`.
- **Reduced motion**: 36 occurrences across 13 components. `useReducedMotion()` hook disables Ken Burns and auto-play. Above average for the industry.
- **Image alt text**: Uses meaningful story titles. Fallback to localized `t("chat.image_alt")`. No empty `alt=""` on informational images.
- **Responsive design**: Mobile-first Tailwind patterns. Safe area insets for notched devices. Overflow menu for mobile toolbar.
- **LangSync**: `<html lang>` attribute synced with locale for screen readers.
- **Gaps**: Admin i18n (Spanish untranslated), error pages (Spanish-only), skip link (hardcoded Spanish), Asturian locale untested, focus trap missing in chat dialog, some hardcoded English aria-labels.

### DevOps & Infrastructure
**Reviewer: devops**

- **CI/CD**: 8 GitHub Actions workflows — CI, E2E, Security scan, Bundle analysis, Lighthouse, Knip, License compliance, Claude review. All green.
- **Dependabot**: Configured for npm + Actions with weekly schedule and grouped updates.
- **Vercel config**: Proper domain redirects (paisaxe.com/www → paisaxe.es canonical). 301 permanent redirects.
- **Security headers**: All present (X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy, CSP).
- **Proxy**: Correct Next.js 16 pattern (proxy.ts, not middleware.ts). No conflicts.
- **.gitignore**: Comprehensive — .env*, .vercel/, node_modules/, .next/, coverage, IDE files.
- **Robots.txt**: Admin, API, auth routes disallowed. AI crawlers explicitly allowed.
- **Gaps**: .env.example incomplete (6 missing vars), no Node.js version pin, health endpoint always 200, knip in report-only mode, no branch protection (free plan limitation).
