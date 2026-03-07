# Performance: TTFB Optimization for /immersive

> **Status**: ✅ All phases complete — pending production release
> **Created**: 2026-03-07
> **Branch**: `develop`
> **Trigger**: Vercel Speed Insights showing 15.39s TTFB, 17.34s FCP/LCP, RES score 35 (Poor)

## Problem Statement

The `/immersive` route (the main landing page) has catastrophic server-side performance:

| Metric | Current (P75, UAE) | Target |
|--------|-------------------|--------|
| TTFB | 15.39s | < 0.5s |
| FCP | 17.34s | < 2s |
| LCP | 17.34s | < 3s |
| RES | 35 (Poor) | > 70 |

All 3 data points are from United Arab Emirates users hitting the Paris (cdg1) function region.
From a European location, TTFB is ~0.33s (warm function), confirming this is a cold-start + caching problem.

## Root Cause Analysis

### 1. `headers()` in Root Layout Forces ALL Pages Dynamic

`src/app/layout.tsx:122` calls `await headers()` to read the CSP nonce. This **opts every page in the entire app into dynamic rendering** — no CDN caching, no ISR, no static generation. The build output confirms every page is `f (Dynamic)` except `/robots.txt` and `/sitemap.xml`.

Pages like `/about`, `/privacy`, `/terms` already have `export const revalidate = 3600` in their layouts, but it has **no effect** because the root layout's `headers()` forces dynamic rendering for the entire route tree.

### 2. No CDN Caching for `/immersive`

Every request to `/immersive` invokes a serverless function that:
1. **proxy.ts**: Fetches maintenance mode flag from Supabase (30s cache)
2. **proxy.ts**: Generates CSP nonce, refreshes auth session
3. **page.tsx**: Fetches feature flag + stories from Supabase in parallel (60s cache)
4. **page.tsx**: Generates random shuffle seed via `Math.random()`

On a cold start (empty function + empty caches), all Supabase calls miss cache = 3+ network round-trips.

### 3. Single Function Region + Low Traffic

- Function region: `cdg1` (Paris) only
- UAE traffic: 3 visits/week = function is ALWAYS cold
- Cold start + cache miss + geographic distance = 15s TTFB

## Solution Architecture

**Core insight**: JSON-LD `<script type="application/ld+json">` is a data block, NOT executable JavaScript. Per CSP Level 3 and the HTML spec, browsers do not apply `script-src` restrictions to non-JavaScript MIME types. Chrome 73+ (March 2019), Firefox 58+ (January 2018), and Safari 15.4+ (March 2022) all exempt data blocks from CSP. The nonce on JSON-LD is unnecessary.

**Strategy**: Remove `headers()` from layouts (safe — nonce isn't needed for JSON-LD), then enable ISR + PPR so the page is CDN-cached globally.

### What Changes

| Component | Before | After |
|-----------|--------|-------|
| Root layout | `async`, calls `headers()`, forces all pages dynamic | Synchronous, no dynamic APIs |
| Immersive layout | `async`, calls `headers()` | Synchronous, no dynamic APIs |
| JSON-LD scripts | Rendered with `nonce` prop | Rendered without `nonce` (safe for data blocks) |
| `/immersive` page | Dynamic (re-rendered every request) | ISR with 60s revalidation |
| `/about`, `/privacy`, `/terms` | Dynamic (despite `revalidate=3600`) | Actually ISR now (revalidate works) |
| PPR | Disabled | Enabled — static shell cached at CDN |
| Function regions | Paris only | Paris + Bahrain |

### What Does NOT Change

- CSP header generation in `proxy.ts` — nonce still generated and included in `script-src`
- `'strict-dynamic'` CSP — Vercel Analytics, SpeedInsights, PostHog continue working
- Executable `<script>` tags (if any are added later) still need nonces
- Proxy maintenance mode check, CORS, CSRF, auth refresh — all unchanged
- Client-side shuffle fallback — already exists at `immersive-page-content.tsx:53`

## Phases

| Phase | Description | Depends On | Batch |
|-------|-------------|------------|-------|
| [Phase 1](./2026-03-07-perf-ttfb-optimization-phases/phase-1.md) | ✅ Remove `headers()` from layouts | None | [batch-eligible] |
| [Phase 2](./2026-03-07-perf-ttfb-optimization-phases/phase-2.md) | ✅ Enable ISR on `/immersive` | Phase 1 | |
| [Phase 3](./2026-03-07-perf-ttfb-optimization-phases/phase-3.md) | ✅ Enable PPR (cacheComponents) | Phase 1 | |
| [Phase 4](./2026-03-07-perf-ttfb-optimization-phases/phase-4.md) | ✅ Add Bahrain function region | None | [batch-eligible] |

Phase 1 and Phase 4 are independent and can run in parallel.
Phase 2 and Phase 3 both depend on Phase 1 but are independent of each other — they could also be batched after Phase 1 completes.

## Expected Impact

| Metric | Current | After Phase 1+2 | After Phase 1+2+3 |
|--------|---------|-----------------|-------------------|
| TTFB (CDN hit) | 15.39s | ~50ms | ~50ms |
| TTFB (cache miss) | 15.39s | ~1-3s | ~50ms (shell) + streaming |
| FCP | 17.34s | ~1-2s | ~0.5-1s |
| LCP | 17.34s | ~2-3s | ~1-2s |
| RES | 35 | >70 | >80 |

The CDN cache is the game-changer. With ISR, the rendered HTML is cached at Vercel's CDN edge globally. After the first render, ALL users (regardless of location) get ~50ms TTFB until the 60s revalidation window. PPR adds the safety net: even on a full cache miss, the prerendered static shell (skeleton) is served instantly from CDN.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| JSON-LD blocked by ancient browser | Very Low | Low (SEO only, no visible impact) | All browsers since 2019 exempt data blocks from CSP |
| PPR experimental instability | Low | Medium | PPR vulnerability patched in next@16.1.6 (installed). Phase 3 is independent — can be reverted without affecting Phase 1+2. |
| ISR serving stale stories | Expected | Low | 60s staleness is acceptable. Admin can trigger revalidation via on-demand ISR if needed. |
| Shuffle flicker on cache miss | Low | Low | Server seed still works within ISR — same seed for all users during revalidation window. No flicker. |

## Verification (Post-Implementation)

### Automated
```bash
# Build should show /immersive as ISR (not dynamic)
npm run build 2>&1 | grep -E '/(immersive|about|privacy|terms)'
# Should show circle (static/ISR) not f (dynamic)

# All tests pass
npm run test && npm run typecheck && npm run lint

# E2E still works
npm run test:e2e
```

### Manual (after deploy to production)
```bash
# TTFB from multiple regions
curl -s -o /dev/null -w "TTFB: %{time_starttransfer}s\n" https://paisaxe.es/immersive

# Verify JSON-LD renders without nonce
curl -s https://paisaxe.es/immersive | grep 'application/ld+json'

# Verify CSP header still present
curl -sI https://paisaxe.es/immersive | grep -i content-security-policy

# Verify cache headers (should see age > 0 on second request)
curl -sI https://paisaxe.es/immersive | grep -iE '(x-vercel-cache|age|cache-control)'

# Check Vercel Speed Insights after 7 days of data collection
```
