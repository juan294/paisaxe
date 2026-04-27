# Performance Report

> Updated on 2026-04-26 (dev server cache -- production build run Apr 25 by triage agent)

## Health Status: YELLOW

**Initial load JS: 2,067 KB (CONFIRMED via Apr 25 prod build, budget: 2,000 KB) -- OVER by 67 KB**
**Total JS: 2,941 KB (budget: 3,000 KB) -- Under budget (+59 KB headroom)**

**0 KB change this cycle** (2,940 KB dev cache -- identical to Apr 25). Dev server was running again; `.next` cache unchanged. The Apr 25 production build by triage agent is the authoritative baseline: Total JS 2,941 KB, initial load ~2,067 KB.

**Key updates since Apr 25:**
- **P8 correction confirmed**: Sentry Replay removal (`fef651f5`) saved **0 KB**, not the estimated 30-50 KB. Replay was config-only and was never loaded as a client integration. This is why the initial load remains at 2,067 KB.
- **Production build baseline established**: No longer an estimate. Initial load is definitively 2,067 KB (+67 KB over budget).
- **P4 officially activated**: Triage confirmed P4 (Supabase realtime tree-shake, ~20-30 KB) as the next required action. P4 alone saves ~25 KB, landing at ~2,042 KB -- still over budget. Triage also suggests considering a budget raise to 2,100 KB.
- **node_modules budget raised**: Triage raised budget from 1,000 MB to 1,100 MB. Current: 1,048 MB -- now under budget.
- **voyageai pinned to 0.1.0**: Fixed chat API 500 regression (`8f53cd29`). Zero bundle impact.
- **QA GREEN**: LLM tests 12/12, journeys 10/10 as of Apr 26.

## Key Metrics

| Metric | Current (2026-04-26) | Previous (2026-04-25) | Apr 25 (prod build) | Apr 4 (prod build) | Budget | Status |
|--------|----------------------|------------------------|---------------------|---------------------|--------|--------|
| Total JS | **2,940 KB** (dev cache) | 2,940 KB | **2,941 KB** | 2,851 KB | 3,000 KB | Under budget (+59 KB) |
| Initial load JS | **2,067 KB** (prod build Apr 25) | ~2,065 KB (est.) | **2,067 KB** | ~1,800 KB | 2,000 KB | OVER by 67 KB |
| Total CSS | **125 KB** | 125 KB | 125 KB | 122 KB | -- | Stable |
| Production deps | **35** | 35 | 35 | 31 | 40 | Good (+5 headroom) |
| Development deps | **29** | 29 | 29 | -- | -- | Stable |
| node_modules | **1,048 MB** | 1,047 MB | 1,047 MB | 896 MB | 1,100 MB | Under budget (+52 MB) |
| .next | **429 MB** | 1,404 MB | -- | 46 MB (dev) | -- | Dev cache reset |

*Apr 26: Dev server running -- bundle measurements are dev cache. Initial load figure comes from the Apr 25 production build (authoritative). The 429 MB .next represents a rebuild/reset from the 1,404 MB peak on Apr 25.*

## Budget Status

**Split budget in effect since 2026-04-04. node_modules budget raised to 1,100 MB on 2026-04-25.**

| Budget | Limit | Current | Headroom | Status |
|--------|-------|---------|----------|--------|
| **Initial load JS** (static, excl. deferred) | 2,000 KB | **2,067 KB** (prod build Apr 25) | -67 KB | OVER -- P4 in progress |
| **Total JS** (including deferred chunks) | 3,000 KB | **2,941 KB** (prod build Apr 25) | +59 KB | Under budget |
| Production deps | 40 | 35 | +5 | Good |
| node_modules | 1,100 MB | 1,048 MB | +52 MB | Under budget (budget raised Apr 25) |

**Deferred chunks (excluded from initial load budget):**

| Chunk | Size | Status vs Apr 25 |
|-------|------|-------------------|
| ElevenLabs SDK + LiveKit | ~478 KB | 0 KB (stable) |
| PostHog analytics | ~180 KB | 0 KB (stable) |
| react-markdown + micromark | ~110 KB | 0 KB (stable) |
| Admin analytics UI | ~107 KB | 0 KB (stable) |
| **Total deferred** | **~875 KB** | 0 KB (stable) |

## Top 10 Chunks

Chunk hashes change per build -- sizes in bytes from dev cache. Content attribution is stable across builds.

| Rank | Chunk (bytes) | Size | Contents | Loading | Actionable? |
|------|--------------|------|----------|---------|-------------|
| 1 | 0jgxvc_nt0fmz (489,726) | **478 KB** | ElevenLabs SDK + LiveKit WebRTC + protobuf | Deferred (dynamic import) + idle prefetch | No -- already optimized |
| 2 | 07y9atwelbm1e (233,018) | **228 KB** | Next.js App Router bootstrap + PPR + hydration (16.2.4) | Static (framework) | No -- required |
| 3 | 08xx2ho6aacv7 (191,461) | **187 KB** | Supabase SDK (auth, postgrest, **realtime**) | Static | **P4 target -- ~20-30 KB savings** |
| 4 | 0bopql_owpunr (183,793) | **180 KB** | PostHog analytics SDK v1.369.5 | Deferred (useEffect lazy import) | No -- already optimized |
| 5 | 0wu4~xh-5rs6g (134,887) | **132 KB** | React RSC Flight client runtime | Static (framework) | No -- required |
| 6 | 0gb0~kkj~zqpo (125,174) | **122 KB** | i18n strings (all 6 locales -- Turbopack limitation) | Static | P5 closed -- not fixable |
| 7 | 0zqk8~mlt73qo (114,323) | **112 KB** | Polyfills (core-js v3) | Static | P1 applied -- no further savings |
| 8 | 03~yq9q893hmn (112,594) | **110 KB** | react-markdown + micromark parser | Deferred (inside VoiceChat) | No -- already optimized |
| 9 | 0j.n0_xy~ouxq (109,497) | **107 KB** | Admin analytics (Stripe dashboard UI) | Deferred (admin tab import) | No -- already optimized |
| 10 | 0c_qd452s0tgs (85,120) | **83 KB** | Sentry client SDK (core + browser tracing, post-P8) | Static | P8 confirmed 0 KB savings; no further action |

**Chunk 3 (Supabase, 187 KB) is the P4 target.** The realtime module is the only extractable sub-component. Estimated savings: 20-30 KB, landing at ~157-167 KB for that chunk. See P4 implementation below.

## Changes This Cycle (Apr 26 vs Apr 25)

**0 KB total JS change** -- dev cache stale; production baseline is Apr 25 prod build.

| Item | Change | Driver |
|------|--------|--------|
| Total JS (dev cache) | **0 KB** (2,940 KB) | Cache unchanged |
| Initial load (confirmed) | **0 KB** (2,067 KB) | Apr 25 prod build authoritative |
| Deferred chunks | **0 KB** (~875 KB) | Stable |
| node_modules | **+1 MB** (1,047 -> 1,048 MB) | Negligible drift |
| Production deps | **0** (35 -> 35) | Stable |
| .next disk usage | **-975 MB** (1,404 -> 429 MB) | Cache reset/rebuild |

### Commits Since Apr 25 Not Yet Reflected in Dev Cache

No code-change commits since the Apr 25 triage cycle that affect bundle size. The cache is stale from before the Apr 25 production build.

## P8 Post-Mortem: Sentry Replay Savings Were 0 KB

Previous estimates projected 30-50 KB savings from removing `replaysOnErrorSampleRate` and `replaysSessionSampleRate` from `sentry.client.config.ts`. The Apr 25 production build confirmed **0 KB saved**.

Root cause: `@sentry/replay` is only bundled when `new Replay()` is passed into `Sentry.init({ integrations: [...] })`. The Paisaxe config never passed a `Replay` instance -- it only set sampling rate config keys. Next.js's Sentry instrumentation does not auto-inject `@sentry/replay` when those keys are absent. The Sentry chunk at 83 KB is the core SDK only (browser tracing, event processing), which is required.

**Impact on P4:** Since P8 saved nothing, P4 (Supabase realtime, ~20-30 KB) is necessary but likely insufficient alone. At ~2,067 - 25 KB = ~2,042 KB, we would still be 42 KB over the 2,000 KB budget.

**Two paths to close the gap:**
1. Implement P4 (~25 KB savings) + raise budget to 2,100 KB to reflect structural growth since the Apr 4 baseline
2. Implement P4 + find an additional ~42 KB of static savings elsewhere (unlikely without significant code changes)

The budget-raise approach is defensible: the Apr 4 baseline was set before `@sentry/nextjs`, `@supabase/supabase-js` 2.97 -> 2.104, `posthog-js` upgrades, and `voyageai` additions -- all legitimate production growth. Triage already flagged this on Apr 25.

## P4: Tree-Shake Supabase Realtime -- ACTIVATED

**Estimated savings: ~20-30 KB from the initial load chunk.**

The Supabase `realtime` module enables live database subscriptions. No public-facing pages use this; only admin features require it. The browser client currently loads the full SDK for all pages.

**Implementation:**

Step 1 -- Create a realtime-free client for public pages:

```typescript
// src/lib/supabase/browser-public.ts
import { createBrowserClient } from "@supabase/ssr";

export const supabaseBrowserPublic = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    realtime: {
      params: { eventsPerSecond: 0 },
    },
  }
);
```

Step 2 -- Replace `supabaseBrowser` with `supabaseBrowserPublic` in public-facing components:
- `src/components/immersive/` (immersive story page)
- `src/components/chat/` (chat panel)
- Homepage components

Step 3 -- Keep `supabaseBrowser` (full client with realtime) in:
- `src/components/admin/` (all admin components)
- Any component using `supabase.channel()` or `.on()` subscriptions

Step 4 -- Verify with production build:
```bash
rm -rf .next && npm run build
```

Expected: Supabase chunk drops from ~187 KB to ~160-165 KB. Initial load drops from ~2,067 KB to ~2,040-2,047 KB.

**Note on budget:** Even with P4, initial load will remain ~42 KB over the 2,000 KB budget. Recommend also raising the initial load budget to 2,100 KB to reflect structural growth since Apr 4.

## Action Items (Prioritized by Impact)

| Priority | Action | Estimated Savings | Effort | Notes |
|----------|--------|-------------------|--------|-------|
| **HIGH** | **Implement P4: Supabase realtime tree-shake** | ~20-30 KB | Medium | Creates `supabaseBrowserPublic` for public pages. See code above. |
| **HIGH** | **Raise initial load budget to 2,100 KB** | Process | Trivial | Structural growth since Apr 4 baseline. P4 alone leaves ~2,042 KB -- still over 2,000 KB. |
| **LOW** | `npm install` to sync resend pin | 0 KB | Trivial | Resend 6.12.0 installed vs ^6.12.2 pinned. Security advisory housekeeping. |
| **CLOSED** | ~~postcss override~~ | ~~0 KB~~ | -- | Confirmed ineffective Apr 25 -- Next.js bundles its own isolated postcss copy. |
| **CLOSED** | ~~Run production build~~ | -- | -- | Done Apr 25 by triage agent. Baseline confirmed: 2,067 KB initial load. |
| **CLOSED** | ~~node_modules budget raise~~ | -- | -- | Done Apr 25. Now 1,100 MB; current 1,048 MB -- under budget. |

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

**Static (in initial load):**

```
// @sentry/nextjs: auto-instrumented. Core + browser tracing only (83 KB).
// @sentry/replay NOT included -- confirmed no savings from fef651f5.
// Supabase SDK: ~187 KB including realtime (~20-30 KB savings via P4)
// i18n: ~122 KB -- Turbopack limitation, not addressable
// core-js polyfills: ~112 KB -- P1 browserslist applied, stable
```

## Dependency Analysis

| Package | node_modules Size | Client Bundle Impact | Status |
|---------|-------------------|----------------------|--------|
| next + @next | 286 MB | Framework (required) | **16.2.4 -- current** |
| @sentry/nextjs + @sentry/core | 67 MB | **~83 KB static** (confirmed post-P8) | P8 complete; savings were 0 KB |
| pdfjs-dist | 66 MB | 0 KB (devDependency) | Correct |
| pdf-parse | 57 MB | 0 KB (devDependency) | Correct |
| @opentelemetry | 46 MB | 0 KB (server-only telemetry) | No action |
| lucide-react | 39 MB | ~50-75 KB (tree-shaken via `optimizePackageImports`) | **v1.8.0 -- current** |
| posthog-js | 36 MB | ~180 KB (lazy-loaded in useEffect) | **1.369.5 -- current, 0 advisories** |
| @napi-rs | 30 MB | 0 KB (native, server-only) | No action |
| typescript | 24 MB | 0 KB (devDependency) | No action |
| canvas | 19 MB | 0 KB (optionalDep, server-only) | No action |
| stripe | 18 MB | ~10-15 KB (server-side only) | **22.0.2 -- current** |
| voyageai | -- | ~2 KB (server-side only) | **Pinned to 0.1.0** (8f53cd29 -- v0.2.x ESM broke dynamic import) |
| core-js | 15 MB | ~112 KB (P1 browserslist applied) | No further action |
| zod | ~5 MB | ~8-12 KB | Verify no surprise client bundling |
| pino | ~5 MB | **0 KB** | Server-only, confirmed |

### Dependency Version Status

Per Security Agent (Apr 26): YELLOW with 8 moderate advisories. Two chains:
- postcss XSS (GHSA-qx2v-qp2m-jg93, 5 pkgs): Inside Next.js bundled copy -- not patchable via npm overrides. Build-time only, not exploitable.
- uuid bounds-check (GHSA-w5hq-g745-h8pq, 3 pkgs via resend -> svix -> uuid): Our usage path is `uuid.v4()` with no buffer arg -- not affected.

| Package | Installed | Latest | Status |
|---------|-----------|--------|--------|
| posthog-js | 1.369.5 | 1.369.5 | Current, 0 advisories |
| next | 16.2.4 | 16.2.4 | Current |
| @anthropic-ai/sdk | ^0.90.0 | 0.90.x | Current |
| @supabase/supabase-js | ^2.104.0 | 2.104.x | Current |
| react / react-dom | ^19.2.5 | 19.2.5 | Current |
| @sentry/nextjs | ^10.49.0 | 10.49.x | Current |
| @sentry/core | 10.49.0 (pinned) | 10.49.x | Current |
| zod | ^4.3.6 | 4.x | Current |
| voyageai | 0.1.0 (pinned) | 0.2.x | Pinned intentionally -- 0.2.x ESM breaks dynamic import |
| resend | 6.12.0 (installed) / ^6.12.2 (pinned) | 6.12.2 | Pin drift -- run `npm install` |
| lucide-react | ^1.8.0 | 1.8.0 | Current |
| postcss | ^8.5.10 (devDep) | 8.5.10 | Current in devDeps; Next.js internal copy at 8.4.31 (advisory) |

## Comparison: Trend History

| Metric | Feb 7 | Mar 8 | Apr 4 | Apr 12 | Apr 17 | Apr 20 | Apr 25 (prod) | **Apr 26** | Trend |
|--------|-------|-------|-------|--------|--------|--------|----------------|------------|-------|
| Total JS | 2,455 KB | 2,726 KB | 2,851 KB | 2,856 KB | 2,892 KB | 2,941 KB | **2,941 KB** | **2,940 KB** | 0 KB |
| Initial load | -- | -- | ~1,800 KB | ~1,936 KB | ~1,972 KB | ~2,066 KB | **2,067 KB** | **2,067 KB** | 0 KB |
| Deferred chunks | -- | -- | ~1,050 KB | ~920 KB | ~920 KB | ~875 KB | **~875 KB** | **~875 KB** | 0 KB |
| CSS | 130 KB | 122 KB | 123 KB | 123 KB | 123 KB | 125 KB | **125 KB** | **125 KB** | 0 KB |
| Prod deps | 27 | 31 | 31 | 31 | 31 | 34 | **35** | **35** | 0 |
| node_modules | 856 MB | 865 MB | 896 MB | 908 MB | 930 MB | 1,047 MB | **1,047 MB** | **1,048 MB** | +1 MB |

*Apr 26: Dev cache. Apr 25 prod build is the authoritative source for initial load and total JS.*
*2.5-month total growth: 2,455 -> 2,941 KB (+486 KB, +19.8%).*

## Optimization Backlog

| Priority | Action | Estimated Savings | Status |
|----------|--------|-------------------|--------|
| ~~P1~~ | ~~Browserslist~~ | ~~3 KB actual~~ | DONE (Mar 29) |
| ~~P2~~ | ~~Idle prefetch ElevenLabs~~ | ~~UX improvement~~ | DONE (Mar 29) |
| ~~P3~~ | ~~Defer Vercel Analytics/SpeedInsights~~ | ~~10-20 KB~~ | DONE (Mar 30) |
| ~~P5~~ | ~~Fix i18n bundling~~ | -- | CLOSED -- Turbopack limitation |
| ~~P6~~ | ~~Split JS budget~~ | -- | DONE (Apr 4) |
| ~~Security~~ | ~~posthog-js advisories~~ | ~~2 advisories~~ | DONE (e66e510, Apr 20) |
| ~~P8~~ | ~~Disable Sentry session replay~~ | ~~0 KB (not 30-50 KB as estimated)~~ | DONE (fef651f5, Apr 22) -- 0 KB savings confirmed |
| **P4** | **Tree-shake Supabase realtime** | **~20-30 KB** | **ACTIVATED -- implement next** |
| **Process** | **Raise initial load budget to 2,100 KB** | **YELLOW -> GREEN** | Recommended alongside P4 |

---
