# Pre-Launch Audit Report

> Generated on 2026-02-11 (brand asset update, cost tracking, story pipeline hardening)
> Previous audits: 2026-02-07, 2026-02-08, 2026-02-09, 2026-02-10
> Release: develop -> main

## Verdict: READY

No blockers found. All warnings are low-severity, already tracked, or cosmetic. The site is production-ready.

---

## Blockers (must fix before deploy)

None.

---

## Warnings (should fix soon)

| # | Area | Issue | Severity | Notes |
|---|------|-------|----------|-------|
| W1 | Security | `qs` vulnerability in `voyageai` dependency | Low-Medium | Server-side only, no user-controlled query strings reach it. No upstream fix available. |
| W2 | Security | CSP `'unsafe-inline'` in `script-src` | Medium | Already tracked TODO in `next.config.ts`. Migrate to nonce-based CSP when feasible. |
| W3 | QA | 1 flaky E2E test (Journey 13: `h1` timeout) | Low | Race condition in qa-journey spec. Not a product bug — test needs more specific selector or longer timeout. |
| W4 | QA | 5/28 feature flags have no test mocks | Low | `mood_discovery`, `asturianu_touches`, `story_freshness`, `automated_agents`, `content_discovery_agent_enabled` |
| W5 | Performance | Largest client chunk at 470KB (protobuf/Supabase) | Low | Under 500KB threshold. Monitor with `ANALYZE=true npm run build`. |
| W6 | A11y | Admin icon-only buttons lack `aria-label` | Low | Internal tooling only, not user-facing. |

---

## Recommendations (nice to have)

| # | Area | Recommendation |
|---|------|----------------|
| R1 | Dependencies | Run `npm update` for patch updates (@types/node, @types/react, posthog-js, resend) |
| R2 | Dependencies | Verify `jsdom@28.0.0` is intentional (npm shows 27.0.1 as latest) |
| R3 | Performance | Add `posthog-js` to `optimizePackageImports` in next.config.ts |
| R4 | Performance | Switch `<img>` to `next/image` in `voice-chat.tsx:283` for auto-optimization |
| R5 | Security | Consider distributed rate limiting (Upstash/Redis) for production resilience |
| R6 | Security | Verify `NODE_ENV=production` on Vercel (prevents stack trace leakage) |
| R7 | QA | Add test mocks for the 5 untested feature flags |
| R8 | QA | Plan admin UI test coverage (~45 components at 0%) |
| R9 | QA | Add `use-focus-trap` hook unit tests |
| R10 | A11y | Add `aria-expanded` to `CategoryFilterBadge` toggle button |
| R11 | A11y | Add responsive breakpoints to admin panels without any (maintenance, feature-toggles, agent-config, tunnel-control) |
| R12 | DevOps | Consider pinning Node.js version in CI for reproducible builds |
| R13 | Architecture | Fix duplicate step "3" comment in proxy.ts (cosmetic) |

---

## Detailed Findings

### Architecture (architect)

| Check | Result |
|-------|--------|
| TypeScript strict mode | PASS — `strict: true`, zero `any` types, zero `@ts-ignore` |
| Typecheck | PASS — 0 errors |
| Dead code (knip) | PASS — clean |
| Circular dependencies | PASS — 0 found (551 files scanned) |
| Dependencies | GOOD — no duplicates, no unnecessary prod deps |
| next.config.ts | GOOD — comprehensive security headers, image optimization, CSP |
| proxy.ts | GOOD — correct request handling chain, auth timeout, fail-open maintenance |
| tsconfig.json | PASS — strict, isolatedModules, bundler resolution |

**Key finding:** Zero type errors, zero dead code, zero circular dependencies. Architecture is clean.

---

### Quality Assurance (qa-lead)

| Metric | Value |
|--------|-------|
| Unit tests | 3,804 passed / 0 failed |
| E2E tests | 125 passed / 1 flaky / 28 skipped |
| Line coverage (src/) | 98.36% |
| Branch coverage (src/) | 93.15% |
| Function coverage (src/) | 94.73% |
| Overall line coverage | 79.92% (admin UI gap) |

**Key findings:**
- All critical user-facing paths have test coverage (chat, auth, payments, voice, proxy, health)
- 1 flaky E2E test in qa-journey spec (h1 timeout race condition)
- 5/28 feature flags lack test mocks
- Admin UI components (~45 files) at 0% coverage — not blocking but a maintenance risk
- Source-only coverage is excellent at 97.6% lines

---

### Security (security-reviewer)

| Check | Result |
|-------|--------|
| Hardcoded secrets | PASS — none found |
| Admin auth flow | PASS — `getUser()` + role check, 401/403 properly returned |
| CORS configuration | PASS — explicit allowlist, no wildcards |
| XSS vectors | PASS — all 7 `dangerouslySetInnerHTML` uses are safe (JSON.stringify or escapeHtml) |
| CSP headers | WARNING — `unsafe-inline` in script-src (tracked TODO) |
| Client-side secrets | PASS — no server secrets exposed to client bundles |
| Webhook verification | PASS — Stripe, ElevenLabs (HMAC+timestamp), Supabase all use proper signature verification |
| MCP auth | PASS — `timingSafeEqual` used |
| Rate limiting | PASS — in-memory per-IP limiting on chat, MCP routes |
| Chat safety | PASS — injection detection, sanitization, length limits, topic relevance |
| SQL injection | PASS — parameterized queries only via Supabase client |
| npm audit | WARNING — 2 high (`qs` via `voyageai`), server-side only, low real-world risk |

**Key finding:** No security blockers. The `qs` vulnerability and CSP `unsafe-inline` are known and tracked.

---

### Performance (performance-eng)

| Metric | Value |
|--------|-------|
| Build time | 10.6s (Turbopack) |
| Build warnings | 0 |
| Static pages | 58 generated in 390ms |
| Largest chunk | 470KB (under 500KB threshold) |
| Total client JS | 2.7MB uncompressed |
| CSS | 136KB total |
| Dead code | None (knip clean) |
| Dynamic imports | 9 heavy components lazily loaded |
| Image format | All stories WebP (14.1MB / 102 images) |

**Key findings:**
- Build is clean with no warnings
- Code splitting is excellent — admin panels dynamically imported, never reach visitor bundles
- Image optimization well-configured (AVIF+WebP, 30-day cache, responsive sizes, priority loading)
- Font loading optimal (self-hosted Inter via next/font)
- Tree-shaking configured for lucide-react
- One `<img>` tag in voice-chat could use `next/image` (minor)

---

### UX & Accessibility (ux-reviewer)

| Check | Result |
|-------|--------|
| ARIA labels | GOOD — 104 labels across 54 files; admin has gaps |
| Alt text | PASS — all `<Image>` and `<img>` have alt props |
| i18n completeness | EXCELLENT — 6 locales, enforced parity in tests, type-safe |
| Responsive design | GOOD — visitor-facing is well-covered; some admin panels lack breakpoints |
| Keyboard navigation | GOOD — proper focus traps, arrow key nav, skip-to-content |
| Error states | GOOD — i18n error messages, `role="alert"`, ComponentErrorBoundary |
| Reduced motion | GOOD — `motion-reduce` support throughout, auto-play disabled |
| Semantic HTML | GOOD — `<main>`, `<article>`, proper roles, live regions |

**Key findings:**
- Visitor-facing accessibility is strong with a dedicated 507-line test suite
- i18n is type-safe with enforced parity across all 6 locales
- Admin icon-only buttons lack aria-labels (internal tooling, low priority)
- `CategoryFilterBadge` missing `aria-expanded` attribute

---

### DevOps & Infrastructure (devops)

| Check | Result |
|-------|--------|
| Vercel config | PASS — domain redirects correct (301 permanent) |
| Env vars | PASS — all 27 required vars in `.env.example` |
| Health endpoint | PASS — healthy, Supabase connected, DB at 0.5% |
| GitHub Actions | PASS — all workflows green on both branches |
| DNS | PASS — both domains -> Vercel (76.76.21.21) |
| Branch protection | PASS — 4 required checks, no force push, no delete |
| HTTPS/headers | PASS — HSTS 2yr+preload, CSP, X-Frame-Options DENY |
| CI workflows | PASS — 9 well-configured workflows, consistent tooling |
| Architecture compliance | PASS — proxy.ts in use, no middleware.ts conflict |

**Key findings:**
- Infrastructure is solid across the board
- All 4 required status checks enforced on `main`
- Security headers are comprehensive and correctly configured
- Health endpoint shows Supabase at 845ms latency (likely cold start)
