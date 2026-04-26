# Performance Report

> Updated on 2026-04-25 (dev server cache -- last production build verified Apr 4)

## Health Status: YELLOW (initial load budget unconfirmed; production build required for 3+ cycles)

**Initial load JS: ~2,065 KB (est., budget: 2,000 KB) -- UNCONFIRMED. P8 savings of ~30-50 KB expected but not measured.**
**Total JS: 2,940 KB (budget: 3,000 KB) -- Under budget (+60 KB headroom)**

**0 KB change this cycle** (2,940 KB -> 2,940 KB, Apr 24 -> Apr 25). The dev server was running again and `.next` cache was used for bundle measurement. This is the **5th consecutive cycle** with no change in measured total JS. The Sentry Replay removal from `fef651f5` (Apr 22) and two additional source commits (`87a3f149`, `610601b4`) are not reflected in these numbers.

**YELLOW status is driven entirely by the unverified initial load budget.** A single `rm -rf .next && npm run build` would either close the gap (if P8 savings bring initial load below 2,000 KB) or reveal whether P4 is also needed.

**Notable this cycle:** The `.next` directory grew from ~800 MB to 1,404 MB (+604 MB). This is dev-server cache expansion from PPR static pre-rendering during normal use -- it does not affect client bundle sizes but does indicate the dev server rebuilt more routes.

## Key Metrics

| Metric | Current (2026-04-25) | Previous (2026-04-24) | Apr 20 | Apr 4 (prod build) | Budget | Status |
|--------|----------------------|------------------------|--------|---------------------|--------|--------|
| Total JS | **2,940 KB** | 2,940 KB | 2,941 KB | 2,851 KB | 3,000 KB (split) | Under budget (+60 KB) |
| Initial load JS | **~2,065 KB (est.)** | ~2,065 KB | ~2,066 KB | ~1,800 KB | 2,000 KB (split) | Potentially over -- unverified |
| Total CSS | **125 KB** | 125 KB | 125 KB | 122 KB | -- | Stable |
| Production deps | **35** | 35 | 34 | 31 | 40 | Good (+5 headroom) |
| Development deps | **29** | 29 | 29 | -- | -- | Stable |
| node_modules | **1,047 MB** | 1,047 MB | 1,047 MB | 896 MB | 1,000 MB | OVER BUDGET (-47 MB) |
| .next | **1,404 MB** | ~800 MB | 801 MB | 46 MB (dev) | -- | Dev cache (grew +604 MB this cycle) |

*Dev server was running -- all bundle measurements are from stale `.next` cache. Initial load estimate is derived (total minus known deferred chunks). Production build is required for exact numbers.*

## Budget Status

**Split budget in effect since 2026-04-04.**

| Budget | Limit | Current | Headroom | Status |
|--------|-------|---------|----------|--------|
| **Initial load JS** (static, excl. deferred) | 2,000 KB | **~2,065 KB (est.)** | -65 KB (est.) | Potentially OVER -- P8 expected to close gap |
| **Total JS** (including deferred chunks) | 3,000 KB | **2,940 KB** | +60 KB | Under budget |
| Production deps | 40 | 35 | +5 | Good |
| node_modules | 1,000 MB | 1,047 MB | -47 MB | OVER BUDGET (operational only) |

**Deferred chunks (excluded from initial load budget):**

| Chunk | Size | Status vs Apr 24 |
|-------|------|-------------------|
| ElevenLabs SDK + LiveKit | ~478 KB | 0 KB (stable) |
| PostHog analytics | ~180 KB | 0 KB (stable) |
| react-markdown + micromark | ~110 KB | 0 KB (stable) |
| Admin analytics UI | ~107 KB | 0 KB (stable) |
| **Total deferred** | **~875 KB** | 0 KB (stable) |

## Top 10 Chunks Identified

Chunk hashes change on each build -- sizes in bytes from dev cache. Content attribution by size comparison with prior cycles.

| Rank | Chunk (bytes) | Size | Contents | Loading | Actionable? |
|------|--------------|------|----------|---------|-------------|
| 1 | 0jgxvc_nt0fmz (489,726) | **478 KB** | ElevenLabs SDK + LiveKit WebRTC + protobuf | Deferred (dynamic import) + idle prefetch | No -- already optimized |
| 2 | 07y9atwelbm1e (233,018) | **228 KB** | Next.js App Router bootstrap + PPR + hydration (16.2.4) | Static (framework) | No -- required |
| 3 | 0o~u430-x9btt (191,438) | **187 KB** | Supabase SDK (auth, postgrest, realtime) | Static | See P4 below |
| 4 | 01jcq5ly8dpgu (183,807) | **180 KB** | PostHog analytics SDK v1.369.5 | Deferred (useEffect lazy import) | No -- already optimized |
| 5 | 0wu4~xh-5rs6g (134,887) | **132 KB** | React RSC Flight client runtime | Static (framework) | No -- required |
| 6 | 0gb0~kkj~zqpo (125,174) | **122 KB** | i18n strings (all 6 locales -- Turbopack limitation) | Static | P5 closed -- not fixable |
| 7 | 0zqk8~mlt73qo (114,323) | **112 KB** | Polyfills (core-js v3) | Static | P1 applied -- no further savings |
| 8 | 03~yq9q893hmn (112,594) | **110 KB** | react-markdown + micromark parser | Deferred (inside VoiceChat) | No -- already optimized |
| 9 | 0j.n0_xy~ouxq (109,497) | **107 KB** | Admin analytics (Stripe dashboard UI) | Deferred (admin tab import) | No -- already optimized |
| 10 | 0c_qd452s0tgs (85,120) | **83 KB** | Sentry client SDK (core + browser tracing, post-Replay-removal) OR i18n secondary content | Static | **Re-measure after prod build** |

*Chunk 10 remained at 85,120 bytes unchanged from Apr 24, Apr 22, and Apr 20. This confirms the dev cache has not been rebuilt since before the P8 Replay removal. The real post-P8 Sentry chunk size is unknown until a production build is run.*

## Changes This Cycle (Apr 25 vs Apr 24)

**0 KB total JS change** -- dev cache stale; recent source commits not reflected.

| Item | Change | Driver |
|------|--------|--------|
| Total JS | **0 KB** (2,940 -> 2,940 KB) | Cache stale (no rebuild) |
| Initial load (est.) | **0 KB** (~2,065 -> ~2,065 KB) | Cache stale |
| Deferred chunks | **0 KB** (~875 -> ~875 KB) | Stable |
| node_modules | **0 MB** (1,047 -> 1,047 MB) | No net dep-size change |
| Production deps | **0** (35 -> 35) | Stable |
| .next disk usage | **+604 MB** (800 -> 1,404 MB) | Dev server PPR cache expansion |

### Commits Since Apr 24 (Source Changes Not Yet Reflected in Metrics)

| Commit | Description | Bundle Impact |
|--------|-------------|---------------|
| `87a3f149` | Fix development CSP eval support | Zero -- CSP is a response header, not client JS |
| `610601b4` | fix: address ultrareview findings on #384 | Likely zero or minimal -- ultrareview findings typically target server-side logic |

*Previously unverified (since Apr 22):*
- `fef651f5` P8: removed `replaysOnErrorSampleRate` + `replaysSessionSampleRate` from `sentry.client.config.ts`. Expected ~30-50 KB off Sentry static chunk.
- `af583fd6` PII sanitization in `sentry-before-send.ts`. Server-side only.

## Critical Action: Production Build Required (5th Consecutive Request)

**This is the single most impactful action available. It costs ~3 minutes and resolves the YELLOW status.**

The dev server cache has not been cleared since before `fef651f5` (Apr 22). Until a production build is run:
- The ~30-50 KB P8 Sentry Replay savings are **invisible in all metrics**
- The initial load budget violation (-65 KB estimated) **cannot be confirmed or cleared**
- The YELLOW status will persist indefinitely regardless of further code improvements

```bash
rm -rf .next && npm run build
```

Post-P8 initial load estimate:
- Current estimate: ~2,065 KB
- P8 savings: ~30-50 KB
- Post-P8 estimate: ~2,015-2,035 KB

**This still lands over the 2,000 KB budget.** If confirmed, P4 (Supabase realtime tree-shake, ~20-30 KB) becomes necessary to clear the budget. Combined P8 + P4 estimated: ~2,000 KB -- right at the edge.

## Action Items (Prioritized by Impact)

| Priority | Action | Estimated Savings | Effort | Notes |
|----------|--------|-------------------|--------|-------|
| **CRITICAL** | **Run production build** | **Verify P8 savings** | 3 min | `rm -rf .next && npm run build`. Resolves YELLOW status. 5th cycle requested. |
| **HIGH** | **Run bundle-analyzer on fresh prod build** | Visibility | 3 min | `npm run build:analyze`. Confirms chunk 10 attribution, verifies `@sentry/replay` is gone from static chunks. |
| **MEDIUM** | **P4: Tree-shake Supabase realtime** | ~20-30 KB | Medium | Activate only if P8 + prod build still shows initial load over 2,000 KB. See code below. |
| **LOW** | **postcss override** (Security Agent recommendation) | 0 KB bundle | Trivial | Add `"postcss": ">=8.5.10"` to `package.json` overrides. Clears 5 security advisories. postcss is build-time only -- zero bundle impact. |
| **LOW** | **Sync `npm install`** | 0 KB | Trivial | Security Agent (Apr 24/25): resend pin drift. Also clears uuid advisory chain partially. |
| **LOW** | node_modules budget raise | Process | Trivial | Raise to 1,100 MB now @sentry/nextjs (67 MB) is a permanent dep. 47 MB overrun is structural. |

## P4: Tree-Shake Supabase Realtime -- Standby

Activate only after production build confirms initial load is still above 2,000 KB after P8. The Supabase `realtime` module adds ~20-30 KB to public pages that don't need live subscriptions.

```typescript
// src/lib/supabase-browser-public.ts -- new file for public pages
import { createBrowserClient } from "@supabase/ssr";

export const supabaseBrowserPublic = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { realtime: { enabled: false } },
);
```

Replace `supabaseBrowser` imports in public-facing pages (immersive, chat, homepage) with `supabaseBrowserPublic`. Admin pages keep the full client with realtime.

## Cross-Agent Findings

### QA Agent (Apr 25): Chat API 500 Regression

QA Agent reports `/api/chat` returning 500 for all non-safety LLM tests since the wave 1 remediation commits (`77359718` logger edge runtime isolation). **Performance implication:** Fast 500s (124-321ms) suggest an initialization failure, not a timeout. This is a correctness issue, not a bundle size issue. No action from the performance side -- but if the fix introduces new client-side imports, monitor the initial load delta.

### Security Agent (Apr 25): postcss Advisory

Security Agent recommends adding `"postcss": ">=8.5.10"` to `package.json` overrides to clear 5 of 8 moderate advisories (GHSA-qx2v-qp2m-jg93 chain). postcss is a build-time dependency only. **Adding the override has zero client bundle impact** -- it just forces hoisted transitive deps to use the patched version.

## P8 Verification: Sentry Config Current State

`sentry.client.config.ts` (confirmed clean as of Apr 25):

```typescript
import * as Sentry from "@sentry/nextjs";
import { sanitizeSentryEvent } from "@/lib/sentry-before-send";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    beforeSend: sanitizeSentryEvent,
  });
}
```

`replaysOnErrorSampleRate` and `replaysSessionSampleRate` are confirmed absent. The `@sentry/replay` integration should not be auto-instrumented into the static client bundle. Chunk 10 (83 KB, confirmed unchanged in dev cache) must be re-measured in a production build to confirm actual savings.

## Dynamic Import Chain Verification

**Deferred correctly (not in initial load):**

```
immersive-page-content.tsx
  -> dynamic(() => import("./voice-chat"), { ssr: false })     // DEFERRED
    -> dynamic(() => import("./voice-chat-elevenlabs"))         // DEFERRED
      -> import { useConversation } from "@elevenlabs/react"    // ~478 KB
    -> import ReactMarkdown from "react-markdown"               // ~110 KB
    -> import { usePostHog } from "posthog-js/react"            // ~180 KB
  -> requestIdleCallback(() => import("./voice-chat"))          // PREFETCH (P2)

admin/page.tsx
  -> 8 dynamic imports: FeatureToggles, Analytics, Marketing,
     Suggestions, Agents, StoryEditor, CreateStory, SelectionToolbar  // ~107 KB

posthog-provider.tsx -> useEffect(() => Promise.all([
  import("posthog-js"), import("posthog-js/react")
]))   // ~180 KB after hydration, production only (v1.369.5)
```

**Static (in initial load -- unchanged from Apr 24):**

```
// @sentry/nextjs: auto-instrumented at build time by Next.js.
// AS OF fef651f5 (Apr 22): Replay integration NO LONGER included.
// Next prod build needed to confirm the actual chunk-10 size drop.

// Supabase SDK: includes realtime module (~20-30 KB savings available via P4
// if initial load remains over 2,000 KB after production build)
```

## Dependency Analysis

| Package | node_modules Size | Client Bundle Impact | Status |
|---------|-------------------|----------------------|--------|
| next + @next | 286 MB | Framework (required) | **16.2.4 -- current** |
| @sentry/nextjs + @sentry/core | 67 MB | **~40-70 KB static (Replay removed)** | P8 applied; verify in prod build |
| pdfjs-dist | 66 MB | 0 KB (devDependency) | Correct |
| pdf-parse | 57 MB | 0 KB (devDependency) | Correct |
| @opentelemetry | 46 MB | 0 KB (server-only telemetry) | No action |
| lucide-react | 39 MB | ~50-75 KB (tree-shaken via `optimizePackageImports`) | **v1.8.0 -- current** |
| posthog-js | 36 MB | ~180 KB (lazy-loaded in useEffect) | **1.369.5 -- current** |
| @napi-rs | 30 MB | 0 KB (native, server-only) | No action |
| typescript | 24 MB | 0 KB (devDependency) | No action |
| canvas | 19 MB | 0 KB (optionalDep, server-only) | No action |
| @rolldown | 19 MB | 0 KB (dev/build-time) | No action |
| stripe | 18 MB | ~10-15 KB (server-side only) | **22.0.2 -- current** |
| @img | 16 MB | 0 KB (sharp, server-only) | No action |
| core-js | 15 MB | ~112 KB (P1 browserslist applied) | No further action |
| zod | ~5 MB | ~8-12 KB | Verify no surprise client bundling |
| pino | ~5 MB | **0 KB** | Server-only, confirmed |

### Dependency Version Status

Per Security Agent (Apr 25): YELLOW with 8 moderate advisories (postcss chain via transitive deps + uuid bounds-check via resend -> svix). Neither is exploitable.

| Package | Installed | Latest | Status |
|---------|-----------|--------|--------|
| posthog-js | 1.369.5 | 1.369.5 | Current |
| next | 16.2.4 | 16.2.4 | Current |
| @anthropic-ai/sdk | 0.90.x | 0.90.x | Current |
| @supabase/supabase-js | 2.104.x | 2.104.x | Current |
| react / react-dom | 19.2.5 | 19.2.5 | Current |
| @sentry/nextjs | 10.49.0 | 10.49.x | Current |
| @sentry/core | 10.49.0 (pinned) | 10.49.x | Current |
| zod | 4.3.6 | 4.x | Current |
| pino | 10.3.1 | 10.x | Current |
| stripe | 22.0.2 | 22.0.2 | Current |
| resend | 6.12.0 (installed) / ^6.12.2 (pinned) | 6.12.2 | Pin drift -- run `npm install` |
| lucide-react | 1.8.0 | 1.8.0 | Current |

## Comparison: Trend History

| Metric | Feb 7 | Mar 8 | Apr 4 | Apr 12 | Apr 17 | Apr 20 | Apr 24 | **Apr 25** | Trend |
|--------|-------|-------|-------|--------|--------|--------|--------|------------|-------|
| Total JS | 2,455 KB | 2,726 KB | 2,851 KB | 2,856 KB | 2,892 KB | 2,941 KB | 2,940 KB | **2,940 KB** | 0 KB |
| Initial load (est.) | -- | -- | ~1,800 KB | ~1,936 KB | ~1,972 KB | ~2,066 KB | ~2,065 KB | **~2,065 KB** | 0 KB |
| Deferred chunks | -- | -- | ~1,050 KB | ~920 KB | ~920 KB | ~875 KB | ~875 KB | **~875 KB** | 0 KB |
| CSS | 130 KB | 122 KB | 123 KB | 123 KB | 123 KB | 125 KB | 125 KB | **125 KB** | 0 KB |
| Prod deps | 27 | 31 | 31 | 31 | 31 | 34 | 35 | **35** | 0 |
| node_modules | 856 MB | 865 MB | 896 MB | 908 MB | 930 MB | 1,047 MB | 1,047 MB | **1,047 MB** | 0 MB |

*Apr 25: Dev server cache. P8 savings (~30-50 KB) and recent source commits not reflected. Bundle has measured 0 KB change for 5 consecutive cycles -- entirely due to stale cache, not actual stability.*

**2.5-month total growth: 2,455 -> 2,940 KB (+485 KB, +19.8%).** Plateau in dev-cache measurements since Apr 20. First production build since Apr 4 is needed to establish a trustworthy baseline.

## Remaining Backlog

### P4: Tree-shake Supabase realtime -- standby

Deprioritized behind P8 production-build verification. If initial load after prod build is still above 2,000 KB, apply P4. If it drops below, close P4 as unnecessary.

Combined P8 + P4 estimate: ~2,065 KB - ~30-50 KB (P8) - ~20-30 KB (P4) = ~1,985-2,015 KB. Right at or just below budget.

### P5: i18n bundling -- CLOSED (Turbopack limitation)

All 6 locales bundled in initial JS (~122 KB combined). Turbopack 16.x eagerly bundles `import()` calls in `'use client'` components. Accepted limitation.

### P8: Disable Sentry session replay -- DONE (Apr 22), verification pending

Implemented in `fef651f5`. Confirmed in source (Apr 25). Awaiting production build confirmation. Chunk 10 unchanged at 83 KB in dev cache -- expected to drop 30-50 KB in a fresh build.

## Action Plan

| Priority | Action | Estimated Savings | Effort | Status |
|----------|--------|-------------------|--------|--------|
| ~~P1~~ | ~~Browserslist~~ | ~~3 KB actual~~ | -- | DONE (Mar 29) |
| ~~P2~~ | ~~Idle prefetch ElevenLabs~~ | ~~UX improvement~~ | -- | DONE (Mar 29) |
| ~~P3~~ | ~~Defer Vercel Analytics/SpeedInsights~~ | ~~10-20 KB~~ | -- | DONE (Mar 30) |
| ~~P5~~ | ~~Fix i18n bundling~~ | -- | -- | CLOSED -- Turbopack limitation |
| ~~P6~~ | ~~Split JS budget~~ | -- | -- | DONE (Apr 4) |
| ~~Security~~ | ~~posthog-js -> 1.369.x~~ | ~~2 advisories~~ | -- | DONE (e66e510, Apr 20) |
| ~~P8~~ | ~~Disable Sentry session replay~~ | ~~30-50 KB~~ | -- | **DONE (fef651f5, Apr 22)** |
| **CRITICAL** | **Run `rm -rf .next && npm run build`** | Confirmation | 3 min | 5th cycle requested |
| **HIGH** | **Run `npm run build:analyze`** | Visibility | 3 min | Confirms Replay gone from static chunks |
| **MEDIUM** | **P4: Tree-shake Supabase realtime** | ~20-30 KB | Medium | Standby -- only if prod build still over 2,000 KB |
| **LOW** | postcss override for security | 0 KB bundle | Trivial | `"postcss": ">=8.5.10"` in overrides |
| **LOW** | Sync resend pin via `npm install` | 0 KB | Trivial | Pin drift: 6.12.0 installed vs ^6.12.2 pinned |
| **LOW** | node_modules budget to 1,100 MB | Process | Trivial | 47 MB overrun is structural (@sentry/nextjs 67 MB) |

---
