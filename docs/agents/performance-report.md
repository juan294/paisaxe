# Performance Report

> Updated on 2026-04-03

## Health Status: YELLOW (JS budget exceeded by 304 KB — dev cache data)

**IMPORTANT CAVEAT:** Production build was skipped (dev server was running). Bundle sizes below are from the dev server's `.next` cache — they may differ from a production build. Dependency and disk metrics are still accurate.

**Total JS: 2,804 KB — exceeds 2,500 KB budget by 304 KB (12.2% over).** Unchanged from Apr 2 (same dev cache, 0 change). **P1 (browserslist), P2 (idle prefetch), and P3 (analytics deferral) are all implemented** — actual impact can only be measured with a production build.

**next@16.2.2 upgrade is now day 3 overdue** — unblocked since Apr 1. Security advisory GHSA-h27x-g6w4-24gq (exploitable PPR DoS) remains open. Upgrade path is clear.

**posthog-js discrepancy persists:** package.json range is `^1.353.0` and installed version remains 1.353.0. Latest is now 1.364.6 (12 minor versions behind). Dependabot PR is the clean path.

**NEW: stripe ecosystem now 2 major versions behind** — stripe 20.3.1 installed vs 22.0.0 latest. @stripe/stripe-js 8.8.0 vs 9.0.1 latest. @stripe/react-stripe-js 5.6.0 vs 6.1.0 latest. Coordinate as a single upgrade.

## Key Metrics

| Metric | Current (2026-04-03)* | Previous (2026-04-02)* | Mar 8 (prod build) | Budget | Status |
|--------|----------------------|----------------------|---------------------|--------|--------|
| Total JS | **2,804 KB** | 2,804 KB | 2,726 KB | 2,500 KB | **Over budget** |
| Total CSS | **124 KB** | 124 KB | 122 KB | - | Good |
| Production deps | 31 | 31 | 31 | 40 | Good |
| node_modules | 862 MB | 862 MB | 865 MB | - | Stable |
| .next | 948 MB | 947 MB | 1,027 MB | - | Dev cache (+1 MB, noise) |

*\*Dev server cache — not a production build.*

## Budget Status

| Budget | Limit | Current (dev) | Estimated (prod)** | Status |
|--------|-------|---------------|-------------------|--------|
| Total JS | 2,500 KB | **2,804 KB** | **~2,562-2,714 KB** | Over budget (closer with P1+P3) |
| Production deps | 40 | 31 | 31 | Good |

*\*\*Estimated: dev cache typically 10-20% larger than production, plus P1 browserslist (~80-112 KB) and P3 analytics deferral (~10-20 KB) savings.*

## Top 10 Chunks Identified

| Rank | Chunk | Size | Contents | Loading | Actionable? |
|------|-------|------|----------|---------|-------------|
| 1 | 0cusi_t26v7g_ | **482 KB** | ElevenLabs SDK + LiveKit WebRTC + protobuf | **Deferred** (dynamic import) + idle prefetch | No — already optimized |
| 2 | 0u95dh6lcl7tm | **232 KB** | Next.js App Router bootstrap + PPR + hydration | Static (framework) | No — required |
| 3 | 0xhb4vj110r-q | **176 KB** | PostHog analytics SDK v1.353.0 | **Deferred** (useEffect lazy import) | Merge Dependabot PR to update to 1.364.6 |
| 4 | 0k0pvzuuazt5v | **167 KB** | Supabase SDK (auth, postgrest, realtime) | Static | See P4 below |
| 5 | 109wl9l4s.nsr | **145 KB** | react-markdown + micromark parser | **Deferred** (inside VoiceChat) | No — already optimized |
| 6 | 01wdr4.40b75i | **134 KB** | React RSC Flight client runtime | Static (framework) | No — required |
| 7 | 01zssc3s5ox6h | **124 KB** | i18n strings (all 6 locales in dev mode) | Static (dev) | Verified correct — see P5 |
| 8 | 03~yq9q893hmn | **112 KB** | Polyfills (core-js v3.38.1) | Static | **FIXED — P1 browserslist added** |
| 9 | 0o5wigcmhjn65 | **108 KB** | Admin analytics (Stripe dashboard UI) | **Deferred** (admin tab import) | No — already optimized |
| 10 | 0g4ao1l.hblqi | **84 KB** | Additional i18n/legal page translations | Static | Low priority |

### Load Profile Summary

| Category | Size | % of Total | Notes |
|----------|------|-----------|-------|
| **Deferred (dynamic imports)** | ~921 KB | 32.8% | Loads on-demand only (includes analytics.tsx P3) |
| **Framework (Next.js + React)** | ~366 KB | 13.1% | Bootstrap, router, RSC runtime |
| **Vendor (static)** | ~279 KB | 9.9% | Supabase, polyfills (polyfills should shrink after P1) |
| **App code (static)** | ~208 KB | 7.4% | i18n strings (both chunks) |
| **Other smaller chunks** | ~1,030 KB | 36.7% | Page routes, shared modules |

## Optimization Status

### No New Changes This Cycle (Apr 3)

No bundle changes since Apr 2. Dev cache unchanged (same `.next` cache, +1 MB noise in .next dir).

| Observation | Status |
|-------------|--------|
| analytics.tsx | 100% tested (3 tests confirmed Apr 2) — `dynamic({ ssr: false })` pattern correct |
| posthog-js | Discrepancy persists: package.json `^1.353.0`, installed 1.353.0. Latest 1.364.6 (12 behind). Dependabot PR needed. |
| next@16.2.2 | Upgrade path clear since Apr 1 — now **day 3 overdue** |
| stripe | NEW: jumped to 22.0.0 — now 2 major versions ahead. Coordinate with @stripe/stripe-js 9.0.1 + @stripe/react-stripe-js 6.1.0 |
| @elevenlabs/react | 1.0.2 available vs 0.14.0 installed — major version gap (breaking changes possible) |

### Previously Implemented

| Optimization | Impact | Implemented |
|-------------|--------|-------------|
| **P1: Browserslist** | ~80-112 KB savings (unverified, needs prod build) | 2026-03-29 (triage) |
| **P2: Idle prefetch ElevenLabs** | UX improvement (cold-start fix) | 2026-03-29 (triage) |
| **P3: Defer Vercel Analytics/SpeedInsights** | ~10-20 KB deferred | 2026-03-30 (triage) |
| ~~P7: Update posthog-js~~ | ~~Security fix~~ | **REVERTED — lockfile only, package.json still ^1.353.0** |

### Action Items

#### #1 — Upgrade next@16.2.2 (HIGH PRIORITY — day 3 unblocked)

Security advisory GHSA-h27x-g6w4-24gq remains open. next@16.2.2 released Apr 1. Package.json shows `"next": "^16.1.6"` — `npm audit fix` should upgrade it automatically.

```bash
# Step 1: Verify Vercel supports Next 16.2.2 in their runtime
# (check Vercel changelog or run a preview deploy on a test branch first)

# Step 2: Apply the upgrade
npm audit fix

# Step 3: Full verification
npm run test && npm run typecheck && npm run lint && npm run test:e2e

# Step 4: Push to develop
git add package.json package-lock.json
git commit -m "fix: upgrade next to 16.2.2 (GHSA-h27x-g6w4-24gq)"
git push
```

**Effort:** Low. **Risk:** Low (patch release). **Security impact:** Closes 5 sub-advisories including 1 exploitable PPR buffering DoS.

#### #2 — Fix posthog-js version (LOW effort, HIGH hygiene)

The Mar 30 triage "P7 posthog-js update" only updated the lockfile — `package.json` still shows `^1.353.0` and the installed version remains 1.353.0. The Dependabot PR is the clean path: it bumps both `package.json` and the lockfile together. Latest version: 1.364.6 (we're 12 minor versions behind).

```bash
# Option A: Merge open Dependabot PR (preferred — clean, auditable)
gh pr list --label dependencies | grep posthog
gh pr merge <PR_NUMBER> --merge

# Option B: Manual bump
npm install posthog-js@^1.364.6
git add package.json package-lock.json
git commit -m "chore: update posthog-js 1.353.0 -> 1.364.6 (dompurify vuln fix)"
```

**Effort:** Trivial. **Security impact:** dompurify vuln fix. **Bundle size:** Unchanged (~176 KB either version).

#### #3 — Run production build to verify P1-P3 savings (CRITICAL for measurement)

All budget assessment is based on dev cache since Mar 8. P1 (browserslist), P2 (idle prefetch), and P3 (analytics deferral) are implemented but unverified. A production build is the only way to know if we're actually within budget.

```bash
# Kill dev server first (if running)
# Then:
cd /Users/juan/code/paisaxe && npm run build 2>&1 | tee /tmp/next-build.log

# After build, re-run the performance metrics script to get accurate numbers
```

**Expected outcome:** ~2,562-2,714 KB total JS (savings from browserslist + smaller dev overhead). May bring us to or near the 2,500 KB budget.

#### #4 — Coordinate Stripe ecosystem upgrade (MEDIUM priority)

Security agent flagged stripe jumped to 22.0.0 — now 2 major versions behind our 20.3.1. The full Stripe ecosystem must be upgraded together:

| Package | Installed | Latest | Gap |
|---------|-----------|--------|-----|
| stripe | 20.3.1 | 22.0.0 | +2 major |
| @stripe/stripe-js | 8.8.0 | 9.0.1 | +1 major |
| @stripe/react-stripe-js | 5.6.0 | 6.1.0 | +1 major |

```bash
npm install stripe@^22.0.0 @stripe/stripe-js@^9.0.1 @stripe/react-stripe-js@^6.1.0
# Then: full test + E2E — Stripe major versions have breaking changes
```

**Effort:** Medium (review Stripe changelog for breaking changes). **Risk:** Medium (major version bumps). **Impact:** Reduces supply-chain risk, accesses new Stripe APIs.

### Remaining Backlog

#### P4: Tree-shake Supabase realtime module (~20-30 KB savings) — LOW IMPACT (DOWNGRADED)

Chunk `0k0pvzuuazt5v` (167 KB) includes the Supabase SDK with `RealtimeClient`. Realtime subscriptions are used **only in admin pages** (`use-realtime-feature-flags.ts`). Public-facing pages never create realtime connections.

**Why downgraded:** Creating two separate Supabase client instances (public vs admin) adds complexity for ~20-30 KB savings. Current singleton pattern in `supabase-browser.ts` is simpler.

**Fix (if pursued):**
```typescript
// src/lib/supabase-browser-public.ts
const supabase = createBrowserClient(url, key, {
  realtime: { enabled: false },
});
```

**Effort:** Medium. **Savings:** ~20-30 KB.

#### P5: Verify i18n lazy loading in production build — NEEDS PRODUCTION BUILD

The lazy-loading implementation in `src/lib/i18n/provider.tsx` is correct:
- `es` and `en` are statically imported (lines 12-13)
- `fr`, `de`, `pt`, `ast` are loaded via `import()` only when the locale changes (lines 27-30)

The 124 KB i18n chunk in dev mode is likely a dev-mode artifact. A production build should show only es+en (~70 KB) in the initial bundle with fr/de/pt/ast deferred.

**Action:** Run `npm run build:analyze` to verify.

#### P6: Split JS budget (initial vs total) — PROCESS IMPROVEMENT

With ~921 KB (32.8%) deferred behind dynamic imports, the 2,500 KB total budget penalizes good code-splitting.

**Recommendation:**
- **Initial load JS:** <= 1,800 KB
- **Total JS:** <= 3,000 KB (currently 2,804 KB dev — 196 KB headroom)

## Dynamic Import Chain Verification

### Code-Splitting Coverage: Excellent

**12 `dynamic()` imports + 18+ lazy `import()` calls** across the codebase.

### Public site (visitor-facing) — PROPERLY DEFERRED

```
immersive-page-content.tsx
  -> dynamic(() => import("./voice-chat"), { ssr: false })     // DEFERRED
    -> dynamic(() => import("./voice-chat-elevenlabs"))         // DEFERRED
      -> import { useConversation } from "@elevenlabs/react"    // 482 KB
    -> import ReactMarkdown from "react-markdown"               // ~145 KB
    -> import { usePostHog } from "posthog-js/react"            // ~176 KB
  -> requestIdleCallback(() => import("./voice-chat"))          // PREFETCH (P2)
```

### Admin dashboard — PROPERLY DEFERRED

```
admin/page.tsx
  -> 8 dynamic imports: FeatureToggles, Analytics, Marketing,
     Suggestions, Agents, StoryEditor, CreateStory, SelectionToolbar
  -> MarketingDashboard -> dynamic(() => import("voice-agent-chat"))
```

### PostHog — LAZILY LOADED

```
posthog-provider.tsx -> useEffect(() => Promise.all([
  import("posthog-js"), import("posthog-js/react")
]))   // 176 KB after hydration, production only
```

### Vercel Analytics — DEFERRED (P3 DONE, tested)

```
layout.tsx
  -> import { VercelAnalytics } from "src/components/analytics"
    -> dynamic(() => import("@vercel/analytics/next"), { ssr: false })    // DEFERRED
    -> dynamic(() => import("@vercel/speed-insights/next"), { ssr: false }) // DEFERRED
```

*Coverage agent Apr 2: analytics.tsx now has 3 tests, 100% coverage confirmed.*

## Dependency Analysis

| Package | node_modules Size | Client Bundle Impact | Status |
|---------|------------------|---------------------|--------|
| next + @next | 257 MB | Framework (required) | **Upgrade to 16.2.2 — day 3 overdue** |
| pdfjs-dist | 63 MB | **0 KB** (devDependency) | Correct |
| pdf-parse | 57 MB | **0 KB** (devDependency) | Correct |
| lucide-react | 45 MB | ~50-75 KB (tree-shaken via `optimizePackageImports`) | Optimized |
| @opentelemetry | 40 MB | 0 KB (server-only) | No action |
| posthog-js | 31 MB | ~176 KB (lazy-loaded in useEffect) | **Stale at 1.353.0 — 12 minor versions behind 1.364.6** |
| @napi-rs | 29 MB | 0 KB (native, server-only) | No action |
| typescript | 23 MB | 0 KB (devDependency) | No action |
| canvas | 19 MB | 0 KB (optionalDep, server-only) | No action |
| @img | 16 MB | 0 KB (sharp image processing, server-only) | No action |
| core-js | 15 MB | **~0-30 KB** (P1 browserslist should eliminate most polyfills) | **P1 applied — verify in prod build** |
| rxjs | 12 MB | ~0 KB (transitive, tree-shaken) | No action |
| @babel | 12 MB | 0 KB (build tool) | No action |
| es-abstract | 11 MB | 0 KB (transitive, dev-only) | No action |

### Outdated Dependencies Requiring Attention

| Package | Installed | Latest | Gap | Priority |
|---------|-----------|--------|-----|----------|
| next | 16.1.6 | 16.2.2 | patch | **CRITICAL — day 3 overdue (GHSA-h27x-g6w4-24gq)** |
| stripe | 20.3.1 | 22.0.0 | +2 major | High — coordinate with @stripe/* |
| @stripe/stripe-js | 8.8.0 | 9.0.1 | +1 major | High — part of Stripe ecosystem upgrade |
| @stripe/react-stripe-js | 5.6.0 | 6.1.0 | +1 major | High — part of Stripe ecosystem upgrade |
| @elevenlabs/react | 0.14.0 | 1.0.2 | +1 major | Medium — major version, review breaking changes |
| posthog-js | 1.353.0 | 1.364.6 | +12 minor | Medium — merge Dependabot PR |
| @anthropic-ai/sdk | 0.78.0 | 0.82.0 | +4 minor | Low — API compatible, minor features |

## Comparison: 10-Run Trend

| Metric | Feb 6 | Feb 7 | Mar 8 | Mar 29* | Mar 30* | Apr 1* | Apr 2* | **Apr 3*** | Trend |
|--------|-------|-------|-------|---------|---------|--------|--------|------------|-------|
| Total JS | 2,889 KB | 2,455 KB | 2,726 KB | 2,804 KB | 2,804 KB | 2,804 KB | 2,804 KB | **2,804 KB** | Flat (dev cache) |
| CSS | - | 130 KB | 122 KB | 124 KB | 124 KB | 124 KB | 124 KB | **124 KB** | Stable |
| Prod deps | 27 | 27 | 31 | 31 | 31 | 31 | 31 | **31** | Stable |
| node_modules | 850 MB | 856 MB | 865 MB | 862 MB | 862 MB | 862 MB | 862 MB | **862 MB** | Stable |
| .next | - | - | 1,027 MB | 1,008 MB | 942 MB | 945 MB | 947 MB | **948 MB** | Stable (noise) |
| EL deferred | No | Yes | Yes | Yes | Yes | Yes | Yes | **Yes** | Stable |
| EL idle prefetch | No | No | No | Yes (NEW) | Yes | Yes | Yes | **Yes** | Stable |
| Browserslist | No | No | No | Yes (NEW) | Yes | Yes | Yes | **Yes** | Stable |
| Analytics deferred | No | No | No | No | Yes (NEW) | Yes | Yes | **Yes** | Stable |
| posthog-js | 1.237.x | 1.237.x | 1.353.0 | 1.353.0 | 1.353.0 | 1.353.0 | 1.353.0 (stale) | **1.353.0 (day 3 stale)** | Stale — Dependabot PR needed |
| next | 16.x | 16.x | 16.1.6 | 16.1.6 | 16.1.6 | 16.1.6 | 16.1.6 (day 2 overdue) | **16.1.6 (day 3 overdue)** | Upgrade needed |
| stripe | - | - | 20.3.1 | 20.3.1 | 20.3.1 | 20.3.1 | 20.3.1 | **20.3.1 (2 major behind)** | NEW gap — coordinate upgrade |

*\*Dev server cache — may overcount vs production build.*

## Disk Usage

| Directory | Size | Notes |
|-----------|------|-------|
| node_modules | 862 MB | Stable |
| .next | 948 MB | Dev server cache (+1 MB from Apr 2, noise level) |

## Action Plan

| Priority | Action | Estimated Savings | Effort | Status |
|----------|--------|-------------------|--------|--------|
| ~~P1~~ | ~~Browserslist~~ | ~~80-112 KB~~ | ~~Trivial~~ | **DONE (Mar 29)** |
| ~~P2~~ | ~~Idle prefetch ElevenLabs~~ | ~~UX improvement~~ | ~~Low~~ | **DONE (Mar 29)** |
| ~~P3~~ | ~~Defer Vercel Analytics/SpeedInsights~~ | ~~10-20 KB deferred~~ | ~~Low~~ | **DONE (Mar 30)** |
| **#1** | **Upgrade next@16.2.2** | Security + minor | Low | **DAY 3 OVERDUE** |
| **#2** | **Fix posthog-js (merge Dependabot PR)** | Security fix + 12 minor versions | Trivial | **Pending** |
| **#3** | **Run production build** | Measurement | Low | **Critical — still pending** |
| **#4** | **Stripe ecosystem upgrade (20→22, stripe-js 8→9, react-stripe-js 5→6)** | Supply-chain risk | Medium | **NEW — 2 major versions behind** |
| P4 | Tree-shake Supabase realtime | ~20-30 KB | Medium | Downgraded |
| P5 | Verify i18n bundling (needs prod build) | ~40-80 KB | Low | Blocked on build |
| P6 | Split JS budget (initial vs total) | Process clarity | Trivial | Pending |

**Next critical actions (in order):**
1. **Upgrade next@16.2.2** — day 3 overdue. `npm audit fix` should handle it. Full test + E2E after.
2. **Merge Dependabot PR for posthog-js** — cleans up the version discrepancy properly.
3. **Run `npm run build`** — measure actual impact of P1 + P3. Expected: ~2,562-2,714 KB total JS.
4. **Plan Stripe ecosystem upgrade** — stripe 20→22, @stripe/stripe-js 8→9, @stripe/react-stripe-js 5→6. Review changelogs for breaking changes before applying.

---

## Cross-Agent Context

**For Security Agent:** next@16.2.2 upgrade is now day 3 overdue — 5 sub-advisories including GHSA-h27x-g6w4-24gq exploitable DoS remain open. posthog-js at 1.353.0 — 12 minor versions behind 1.364.6. stripe 20.3.1 now 2 major versions behind 22.0.0 — flag as coordinated upgrade with @stripe/stripe-js 9.0.1 and @stripe/react-stripe-js 6.1.0. @elevenlabs/react 0.14.0 vs 1.0.2 — major version gap.

**For Code Quality Agent:** posthog-js stale at 1.353.0 (package.json range not updated — Dependabot PR merge preferred over manual bump). next@16.2.2 upgrade is the only security-blocking action. Stripe ecosystem: stripe 20.3.1→22.0.0 (+2 majors), @stripe/stripe-js 8.8.0→9.0.1, @stripe/react-stripe-js 5.6.0→6.1.0 — coordinate together. All 12 `dynamic()` imports verified correct.

**For QA Agent:** No user-facing changes this cycle. After next@16.2.2 upgrade, run full test + E2E suite. After Stripe ecosystem upgrade, verify full payment flow E2E — major version bump may have breaking changes.

**For Coverage Agent:** analytics.tsx 100% covered (3 tests). No new production dependencies. posthog-js update when applied is no API change — no coverage impact. Stripe major upgrade may surface new code paths to test.

**For Cost Analyst Agent:** posthog-js stale at 1.353.0 — no cost impact from version. Zero production voice usage means ElevenLabs SDK still never exercised. Stripe 2-major-version gap has no cost impact today but may affect payment reliability. Bandwidth unchanged until production build verified.

**For Localization Agent:** i18n lazy loading code correct (es+en static, fr/de/pt/ast dynamic). Production build still needed to confirm dev-mode artifact. Localization agent corrected Apr 3: 392 keys (not 356 as reported Apr 2).

---

*Report generated by Performance Agent — 2026-04-03*
*Dev server cache data — production build needed for accurate measurements*
*P1 + P2 + P3 implemented — awaiting production build verification*
*next@16.2.2 upgrade day 3 overdue — posthog-js discrepancy confirmed — NEW: stripe 2 major versions behind*
