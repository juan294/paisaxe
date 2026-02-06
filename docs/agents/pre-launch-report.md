# Pre-Launch Audit Report

> Generated on 2026-02-06 (launch eve) by 6-specialist agent team

## Verdict: CONDITIONAL

The codebase is in **strong shape for launch**. All 2,766 unit tests pass, all 118 E2E tests pass, CI is green on both `develop` and `main`, Vercel deployments are healthy, and the security posture is solid. There is 1 minor blocker (missing test file for an admin-only endpoint) and several warnings that should be addressed within the first week post-launch.

**Blocker count: 1** (admin-only, low user impact)
**Warning count: 19**
**Recommendation count: 15**

---

## Blockers (must fix before deploy)

| # | Finding | Source | Risk |
|---|---------|--------|------|
| B1 | **Missing test file for `src/app/api/admin/agents/run/route.ts`** — 0% coverage, no test file exists. This is a write endpoint that triggers agent execution. | QA | Low (admin-only) |

---

## Warnings (should fix within 1 week)

### Security
| # | Finding | Source |
|---|---------|--------|
| W1 | `qs` high-severity vulnerability (GHSA-6rw7-vpxm-498p) in `voyageai` dependency — DoS via memory exhaustion. Low exploitability since voyageai is server-side only. No upstream fix available yet. | Security |
| W2 | `dangerouslySetInnerHTML` + `renderMarkdown` without sanitization in `agents-dashboard.tsx:784` — admin-only but should add DOMPurify. | Security |

### Quality Assurance
| # | Finding | Source |
|---|---------|--------|
| W3 | `src/lib/claude.ts` — 40% coverage. Core AI pipeline needs better error/streaming path tests. | QA |
| W4 | `src/lib/posting-service.ts` — 0% coverage. Social media posting with external API calls. | QA |
| W5 | `src/lib/admin-api.ts` — 20% coverage. Large admin client surface (839 lines). | QA |
| W6 | `src/hooks/use-voice-access.ts` — 0% coverage. Older voice access hook still in use. | QA |
| W7 | Feature flag E2E gaps — only 2 of 26 flags have E2E gating tests. Visitor-facing flags like `visitor_voice_agent`, `booking_system` untested. | QA |
| W8 | `src/config/agent-prompts.ts` — 0% coverage (348 lines). Agent prompt config should have snapshot/validation tests. | QA |

### Architecture
| # | Finding | Source |
|---|---------|--------|
| W9 | 17 unused exports + 17 unused types detected by knip. Includes deferred features (X posting) shipping dead code. | Architect |
| W10 | 6 large files (1,000-1,500 lines) — all admin components. Maintenance risk. | Architect |
| W11 | 5 outdated dependencies — `@anthropic-ai/sdk`, `@elevenlabs/react`, `@supabase/supabase-js`, `posthog-js`. Patch updates available. | Architect |
| W12 | Unlisted dependency `canvas` in `scripts/extract-images.ts`. | Architect |

### Performance
| # | Finding | Source |
|---|---------|--------|
| W13 | Protobuf chunk at 465KB (close to 500KB threshold) — `@bufbuild/protobuf` from Supabase Realtime. Monitor for growth. | Performance |
| W14 | Lighthouse CI only triggers on PRs, but dev workflow uses direct commits — Lighthouse may never run. | Performance |

### DevOps
| # | Finding | Source |
|---|---------|--------|
| W15 | `.env.example` incomplete — missing `CREDENTIALS_ENCRYPTION_KEY`, `ELEVENLABS_WEBHOOK_SECRET`, `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`. | DevOps |
| W16 | No error monitoring service (Sentry, etc.) — production errors only discoverable via Vercel logs. | DevOps |
| W17 | In-memory rate limiting resets on serverless cold starts — largely ineffective on Vercel. | DevOps |

### UX & Accessibility
| # | Finding | Source |
|---|---------|--------|
| W18 | 2 hardcoded English `aria-label`s in visitor-facing components (`toolbar-overflow-menu.tsx`, `story-viewer.tsx`). | UX |
| W19 | Toolbar overflow menu lacks keyboard focus management — keyboard users can't navigate into open menu. | UX |

---

## Recommendations (nice to have)

1. **CSP nonce-based scripts** — Replace `'unsafe-inline'` in `script-src` with nonce-based CSP for stronger XSS protection (Security)
2. **Persistent rate limiting** — Migrate to Vercel KV or Upstash Redis for cross-instance rate limiting (DevOps/Security)
3. **Bump version to 1.0.0** — `package.json` shows `0.1.0`; signal production readiness (DevOps)
4. **Add Lighthouse CI on push** — Add `push` trigger to `lighthouse.yml` for `develop`/`main` branches (Performance)
5. **Clean up unused exports** — Remove the 34 unused exports/types flagged by knip (Architecture)
6. **Remove `STORIES` backward-compat alias** — Dead export in `stories-data.ts` (Architecture)
7. **Reduce console.log noise** — 17 server-side console.log/debug calls across 8 files (Architecture)
8. **PostHog loading optimization** — Defer PostHog load to after first user interaction (Performance)
9. **Vercel function region** — Consider `cdg1` (Paris) or `mad1` (Madrid) for lower latency to Spanish users (DevOps)
10. **Security scan level** — Change `npm audit --audit-level=critical` to `--audit-level=high` (DevOps)
11. **Enforce knip in CI** — Remove `--no-exit-code` from knip workflow (DevOps)
12. **Add `motion-reduce:` variants to coming-soon page** — Respects `prefers-reduced-motion` (UX)
13. **Privacy/Terms translations** — Pages are Spanish-only; consider English translation or language notice (UX)
14. **Add dedicated "toggle info" button** in story viewer for assistive tech (UX)
15. **Disaster recovery runbook** — Document Supabase backup/recovery procedures (DevOps)

---

## Detailed Findings

### Architecture (architect)

**Overall: Strong** — No blockers.

- **TypeScript**: Compiles cleanly, strict mode enabled, zero errors
- **ESLint**: Zero errors
- **Tests**: 196 files, 2,766 tests passing, 1 skipped
- **Circular dependencies**: None (verified with madge across 438 files)
- **Peer dependencies**: All satisfied
- **Next.js config**: Production-ready with comprehensive security headers, image optimization (AVIF + WebP, 30-day cache), PostHog reverse proxy
- **Proxy (`src/proxy.ts`)**: Well-structured with maintenance mode, CORS, auth refresh. No `middleware.ts` (correct for Next.js 16)
- **`tsconfig.json`**: Strict mode, bundler resolution, proper path aliases
- **Dead code (knip)**: 17 unused exports, 17 unused types, 1 duplicate export, 1 unlisted dependency

---

### Quality Assurance (qa-lead)

**Overall: Strong** — 1 blocker (missing test file).

- **Unit tests**: 2,766 passed, 0 failed, 1 skipped (24.9s)
- **E2E tests**: 118 passed, 22 skipped, 0 failed (47.7s)
- **Coverage**: 67.02% statements, 60.26% branches, 62.23% functions, 67.74% lines

**Critical path coverage:**

| Path | Coverage | Status |
|------|----------|--------|
| Payments (Stripe) | 95%+ | Excellent |
| Auth (Supabase + OAuth) | 73-100% | Good |
| Webhooks (all 5 endpoints) | 80-100% | Good |
| Chat/RAG search + embeddings | 100% | Excellent |
| Chat safety + config | 100% | Excellent |
| Core Claude integration | 40% | Needs improvement |
| Voice chat components | 80-82% | Good |
| Feature flags (server + client) | Covered | Good |

---

### Security (security-reviewer)

**Overall: Solid** — No blockers.

- **Hardcoded secrets**: None found. All API keys from `process.env` with `.trim()`
- **Auth**: Two-layer admin auth (Supabase JWT + role check), all 53 admin routes protected
- **Public API routes**: Rate-limited, input validated, injection detection, sanitization
- **MCP routes**: Protected by `MCP_API_SECRET` header validation
- **Webhooks**: All 3 webhook endpoints verify signatures (Stripe, Supabase, ElevenLabs)
- **RLS**: All tables have appropriate policies with performance optimizations
- **CORS**: Properly restrictive — only `paisaxe.es`, `paisaxe.com` + variants
- **CSP**: Comprehensive — `default-src 'self'`, `frame-ancestors 'none'`, `form-action 'self'`
- **HSTS**: 2 years, includeSubDomains, preload
- **Rate limiting**: In-memory, 10 req/60s per IP on chat routes
- **Input validation**: Injection detection, sanitization, prompt leakage detection
- **Error disclosure**: Generic errors in production, detailed only in development

---

### Performance (performance-eng)

**Overall: Excellent** — No blockers.

- **Build**: Clean, 7.8s compile (Turbopack), 49 routes, no warnings
- **Largest chunk**: 465KB (protobuf) — under 500KB threshold
- **Code splitting**: Admin panels (5x `next/dynamic`), VoiceChat, PostHog all lazy-loaded
- **API route dynamic imports**: Heavy server deps loaded inside handler functions
- **Images**: All production images use `next/image` with AVIF + WebP, 30-day cache
- **Fonts**: Self-hosted via `next/font/google` (no render-blocking)
- **Loading states**: All major routes have `loading.tsx`
- **Lighthouse CI**: Configured with budgets (Perf >= 60%, A11y >= 80%, LCP < 4s)
- **Preconnects**: Supabase storage, fonts, Unsplash

---

### UX & Accessibility (ux-reviewer)

**Overall: Excellent** — No blockers.

- **ARIA labels**: Comprehensive across all interactive elements with localized `t()` calls
- **Images**: All use `next/image` with meaningful alt text
- **i18n**: 6 locales (es, en, fr, de, pt, ast) with automated parity tests (~160 keys each)
- **Responsive**: Mobile-first with proper `sm:`, `md:`, `lg:` breakpoints
- **Skip-to-content**: Implemented and functional
- **Focus-visible rings**: Consistent pattern across all interactive elements
- **Motion-reduce**: Comprehensive `motion-reduce:` variants on all animations (except coming-soon page)
- **Error states**: All localized, user-friendly, with retry actions
- **Heading hierarchy**: Correct across all pages
- **Live regions**: `aria-live="polite"` for story changes (screen reader friendly)

---

### DevOps & Infrastructure (devops)

**Overall: Healthy** — No blockers.

- **CI**: All 3 core workflows green on both `develop` and `main` (CI, E2E, Security)
- **Additional CI**: 5 PR-triggered workflows (Lighthouse, bundle size, knip, license, Claude review)
- **Vercel**: All deployments `Ready`, 1-2 minute build times
- **Health endpoint**: Checks Supabase connectivity + DB size, returns 200/503
- **Domains**: `paisaxe.com` -> `paisaxe.es` redirects (301 permanent)
- **Dependabot**: Configured for npm + Actions with weekly schedule
- **`.gitignore`**: Comprehensive — .env*, .vercel/, node_modules/, .next/, coverage

---

## Pre-Launch Checklist

- [x] All unit tests pass (2,766/2,766)
- [x] All E2E tests pass (118/118)
- [x] TypeScript compiles cleanly (zero errors)
- [x] ESLint reports zero errors
- [x] CI green on `develop` and `main`
- [x] Vercel deployments healthy
- [x] No hardcoded secrets in source
- [x] Auth flows properly secured (admin + public + webhooks)
- [x] RLS policies on all Supabase tables
- [x] Webhook signature verification on all endpoints
- [x] CORS properly restrictive
- [x] Security headers comprehensive (HSTS, CSP, X-Frame-Options, etc.)
- [x] No circular dependencies
- [x] No chunks > 500KB
- [x] Images optimized (AVIF + WebP via next/image)
- [x] Code splitting on heavy components
- [x] i18n complete across 6 locales with automated parity tests
- [x] Error pages localized with retry actions
- [x] Heading hierarchy correct
- [x] Motion-reduce support across animations
- [x] Skip-to-content navigation
- [x] Domain redirects configured (canonical paisaxe.es)
- [ ] Add test file for `api/admin/agents/run` (B1)
- [ ] Set up error monitoring service (W16)
- [ ] Update `.env.example` with missing vars (W15)
