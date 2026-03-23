# Plan: QA Infrastructure & Performance Fixes

> Created: 2026-03-09 | Status: APPROVED | Phases: 9

## Problem Statement

Agent reports from March 8-9 identified issues across QA, performance, security, and operations. All identified issues are tracked here — nothing left behind.

### Critical / High Priority
1. **CSRF blocker in LLM quality tests** — 4 weeks broken, 0/12 tests pass
2. **Chat panel E2E failures** — Journeys 3, 7, 14 fail (dynamic import timing + brittle CSS selector)
3. **Localization regression** — Journey 1: titles switch Spanish→English (Playwright has no locale set)
4. **Info panel toggle regression** — Journey 5: brittle CSS selector + possible focus issue
5. **ElevenLabs idle prefetch** — 482 KB chunk causes 5s+ cold start on first chat open

### Medium Priority
6. **JS budget exceeded by 226 KB** — polyfills add ~113 KB; browserslist not configured
7. **Health check script staleness** — wrong status string + deleted endpoint (5th consecutive report)
8. **Gitleaks not in CI** — config exists but no workflow (6th consecutive report)
9. **MCP endpoints have 0% E2E coverage** — external-facing, accept untrusted input
10. **Dependency updates** — `@supabase/ssr` 0.8→0.9, `pdfjs-dist` 5.4→5.5

### Low Priority
11. **Mock feature flag cleanup** — 10 agent flags don't belong in `MOCK_FEATURE_FLAGS`
12. **Supabase realtime tree-shaking** — ~20-30 KB potential savings (needs audit)
13. **JS budget restructure** — split budget into initial load vs total (process improvement)

### Manual / Decision Items (non-code)
14. **Check Anthropic billing** — manual dashboard check
15. **Evaluate Vercel Pro necessity** — $20/mo at ~50 visitors
16. **Evaluate Twilio phone number** — $1.15/mo with zero booking calls

## Architecture Understanding

### CSRF Flow
- `src/proxy.ts` sets `__csrf` cookie on page requests (httpOnly=false, sameSite=strict)
- Client reads cookie via `getCsrfToken()` from `src/lib/csrf-client.ts`
- Client sends cookie + `x-csrf-token` header on POST/PUT/PATCH/DELETE
- `validateCsrfToken()` in `src/lib/csrf.ts` does timing-safe comparison
- Exempt: `/api/webhooks/*`, `/api/mcp/*`, `/api/cron/*`, `/api/health`
- The LLM test (`src/tests/qa/llm-quality.test.ts`) runs in Node.js via Vitest — no browser, no cookies

### Chat Panel Dynamic Import
- `immersive-page-content.tsx:22-28`: `dynamic(() => import("voice-chat"), { ssr: false, loading: () => null })`
- Only renders when `chatOpen === true` (line 221)
- Root element: `<div className="fixed inset-0 z-50 ...">` (voice-chat.tsx:161) — no `data-testid`
- E2E tests use `.fixed.inset-0.z-50` selector — fragile

### Localization Regression Root Cause
- `story-viewer.tsx:77`: locale comes from `useTranslation()` hook
- `getLocalizedStory(story, locale)` returns Spanish when `locale === 'es'`, English when `locale === 'en'`
- **Confirmed root cause**: Playwright qa-journey project has NO locale set. Visual projects set `locale: "en-US"` but qa-journey doesn't. Browser defaults to English → `getLocalizedStory` returns English translations after hydration.
- Fix is setting `locale: "es-ES"` in Playwright config for the qa-journey project.

### Info Panel Toggle
- `story-viewer.tsx:159-160`: `else if (e.key === "i") { setShowInfo((prev) => !prev); }`
- Panel has `data-testid="story-info-panel"` (line 300) — test should use this, not CSS classes
- E2E test uses `.absolute.bottom-0.left-0.right-0` selector instead

### MCP Endpoints
- All use `validateMcpSecret()` via `x-mcp-secret` header (constant-time comparison)
- Support dual request formats (ElevenLabs webhook flat + MCP tool call)
- Places: rate limited 20/min, calls Google Places API
- Weather: rate limited 30/min, calls OpenWeatherMap API
- Make Booking: validates Spanish phone, calls ElevenLabs outbound booking agent
- Make Booking Status: acknowledges Twilio callbacks

### Health Check Script
- `scripts/qa-agent.sh:99`: checks for `"status":"ok"` — endpoint returns `"status":"healthy"`
- `scripts/qa-agent.sh:126`: checks `/api/stripe-test` — deleted Feb 5
- `/api/checkout/health` exists but requires admin auth — not suitable as replacement. Remove Stripe check entirely.

### CI Workflows
- 9 workflow files in `.github/workflows/`
- `.gitleaks.toml` exists with 1 allowlist rule — ready for integration
- `docs/operations/quality-agents.md` already documents expected Gitleaks workflow
- Should trigger on push/PR + daily at 04:00 UTC

### Supabase Client
- Browser client (`src/lib/supabase-browser.ts`) uses `@supabase/ssr`'s `createBrowserClient()` — no explicit realtime config
- Tree-shaking realtime requires auditing whether any component uses subscriptions. Savings uncertain (~20-30 KB estimate from Performance Agent, but may be less since realtime isn't explicitly enabled).

## Phases

| Phase | Description | Files | Batch? |
|-------|-------------|-------|--------|
| 1 | Fix CSRF in LLM quality tests | `src/tests/qa/llm-quality.test.ts` | `[batch-eligible]` |
| 2 | Fix chat panel E2E + ElevenLabs prefetch | `voice-chat.tsx`, `immersive-page-content.tsx`, `e2e/qa-journey.spec.ts` | `[batch-eligible]` |
| 3 | Fix info panel toggle + localization E2E | `e2e/qa-journey.spec.ts`, `playwright.config.ts` | No (depends on Phase 2) |
| 4 | Browserslist + dependency updates | `package.json` | `[batch-eligible]` |
| 5 | Fix health check script | `scripts/qa-agent.sh` | `[batch-eligible]` |
| 6 | Add Gitleaks CI workflow | `.github/workflows/gitleaks.yml` (new) | `[batch-eligible]` |
| 7 | MCP endpoint E2E tests | `e2e/mcp.spec.ts` (new) | `[batch-eligible]` |
| 8 | Mock flag cleanup + Supabase realtime audit | `e2e/fixtures/mock-data.ts`, Supabase client files | `[batch-eligible]` |
| 9 | JS budget restructure + manual reviews | Non-code decisions, GitHub issues | `[batch-eligible]` |

**Batch groups:**
- Phases 1, 4, 5, 6, 7, 8 are fully independent — can run in parallel
- Phase 3 depends on Phase 2 (shared `qa-journey.spec.ts`)
- Phase 9 is non-code and can run anytime

Phase details: `docs/plans/2026-03-09-qa-infra-fixes-phases/phase-{1..9}.md`

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| CSRF fix requires running server | Low | Medium | Test acquires real token from page request |
| Browserslist breaks on old mobile devices | Very Low | Low | `> 0.5%, not dead` covers 98%+ of traffic |
| Prefetch causes extra bandwidth | Very Low | None | Loads during idle, already needed for chat |
| Dep updates introduce breaking changes | Low | Medium | Minor version bumps; run full test suite |
| Gitleaks blocks existing PRs | Very Low | Low | Run as informational, not required check |
| Supabase realtime audit shows no savings | Medium | None | Phase 8 is audit-first; skip if no savings |

## Success Criteria

### Automated
- [ ] `npm run test:qa` — all 12 LLM tests pass (requires running server)
- [ ] `npx playwright test qa-journey` — all 10 non-auth journeys pass
- [ ] `npm run test && npm run typecheck && npm run lint` — all green
- [ ] Bundle size: `Total JS < 2,650 KB` (down from 2,726 KB)
- [ ] `npm audit` — 0 vulnerabilities
- [ ] Gitleaks workflow runs on push to develop

### Manual
- [ ] Open `/immersive`, click Ask → chat opens within 2s (prefetch)
- [ ] Navigate stories → titles stay in consistent language
- [ ] Press 'i' → info panel hides/shows smoothly
- [ ] Check Anthropic billing at console.anthropic.com
- [ ] Decision logged: keep/drop Vercel Pro
- [ ] Decision logged: keep/drop Twilio phone number
