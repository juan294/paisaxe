# Performance Report

> Updated on 2026-04-24 (dev server cache -- last production build verified Apr 4)

## Health Status: YELLOW (initial load budget may still be breached; Replay removal unverified)

**Initial load JS: ~2,065 KB (budget: 2,000 KB) -- UNCONFIRMED, needs production build**
**Total JS: 2,940 KB (budget: 3,000 KB) -- Under budget (+60 KB headroom)**

**-1 KB change this cycle** (2,941 KB -> 2,940 KB, Apr 22 -> Apr 24). Heavy commit activity landed between the Apr 22 and Apr 24 runs (wave 1 remediation, hygiene hardening, dependency pinning), but because the dev server was running the `.next` cache has not been rebuilt and the bundle measurement is essentially a stale snapshot. **The byte-identical size despite two days of merges is itself a signal that the cache is not reflecting recent code changes -- in particular the Sentry Replay removal from `fef651f5`.**

**Major win this cycle (unverified):** `sentry.client.config.ts` no longer sets `replaysOnErrorSampleRate` or `replaysSessionSampleRate`. Commit `fef651f5` (Apr 22, "fix: resolve triage performance findings") removed both knobs entirely. Estimated savings: **~30-50 KB off the static initial load**. A production build is required to confirm the actual number.

**New direct dep:** `@sentry/core@10.49.0` promoted to an explicit pinned dependency by commit `d3ffaa50` (AR-H2 remediation, 2026-04-24). Bundle-neutral -- previously present as a transitive peer of `@sentry/nextjs`. Production dep count is now 35/40.

## Key Metrics

| Metric | Current (2026-04-24) | Previous (2026-04-22) | Apr 20 | Apr 4 (prod build) | Budget | Status |
|--------|----------------------|------------------------|--------|---------------------|--------|--------|
| Total JS | **2,940 KB** | 2,941 KB | 2,941 KB | 2,851 KB | 3,000 KB (split) | Under budget (+60 KB) |
| Initial load JS | **~2,065 KB (est.)** | ~2,066 KB | ~2,066 KB | ~1,800 KB | 2,000 KB (split) | Potentially over budget |
| Total CSS | **125 KB** | 125 KB | 125 KB | 122 KB | -- | Stable |
| Production deps | **35** | 34 | 34 | 31 | 40 | Good (+5 headroom) |
| Development deps | **29** | 29 | 29 | -- | -- | Stable |
| node_modules | **1,047 MB** | 1,047 MB | 1,047 MB | 896 MB | 1,000 MB | OVER BUDGET (-47 MB) |
| .next | 800 MB | 801 MB | 801 MB | 46 MB (dev) | -- | Dev cache (stable) |

*Current (2026-04-24): Dev server was running -- cached `.next` data. The 1 KB change is cache churn, not a real bundle delta. Initial load estimate is derived (total minus known deferred chunks); a production build is needed for exact numbers.*

## Budget Status

**Split budget in effect since 2026-04-04.**

| Budget | Limit | Current | Headroom | Status |
|--------|-------|---------|----------|--------|
| **Initial load JS** (static, excl. deferred) | 2,000 KB | **~2,065 KB (est.)** | -65 KB | Potentially OVER -- Replay removal likely closes the gap |
| **Total JS** (including deferred chunks) | 3,000 KB | **2,940 KB** | +60 KB | Under budget |
| Production deps | 40 | 35 | +5 | Good |
| node_modules | 1,000 MB | 1,047 MB | -47 MB | OVER BUDGET (operational only) |

**Deferred chunks (excluded from initial load budget):**

| Chunk | Size | Status vs Apr 22 |
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
| 4 | 01jcq5ly8dpgu (183,807) | **180 KB** | PostHog analytics SDK v1.369.3 | Deferred (useEffect lazy import) | No -- already optimized |
| 5 | 0wu4~xh-5rs6g (134,887) | **132 KB** | React RSC Flight client runtime | Static (framework) | No -- required |
| 6 | 0gb0~kkj~zqpo (125,174) | **122 KB** | i18n strings (all 6 locales -- Turbopack limitation) | Static | P5 closed -- not fixable |
| 7 | 0zqk8~mlt73qo (114,323) | **112 KB** | Polyfills (core-js v3) | Static | P1 applied -- no further savings |
| 8 | 03~yq9q893hmn (112,594) | **110 KB** | react-markdown + micromark parser | Deferred (inside VoiceChat) | No -- already optimized |
| 9 | 0j.n0_xy~ouxq (109,497) | **107 KB** | Admin analytics (Stripe dashboard UI) | Deferred (admin tab import) | No -- already optimized |
| 10 | 0c_qd452s0tgs (85,120) | **83 KB** | Sentry client SDK (core + browser tracing, post-Replay-removal) OR i18n legal/secondary | Static | **Re-measure after prod build** |

*Note: Chunk 10 stayed at 85,120 bytes despite the Replay removal -- either (a) dev cache still includes Replay because HMR didn't rebuild this chunk, or (b) this chunk never held Replay and the savings will surface in a different chunk after prod build. Bundle-analyzer on a fresh prod build is required to resolve the attribution.*

## Changes This Cycle (Apr 24 vs Apr 22)

**-1 KB total JS change** -- dev cache stale; wave 1 remediation and Replay removal not reflected.

| Item | Change | Driver |
|------|--------|--------|
| Total JS | **-1 KB** (2,941 -> 2,940 KB) | Cache churn (not real) |
| Initial load (est.) | **-1 KB** (~2,066 -> ~2,065 KB) | Cache churn |
| Deferred chunks | **0 KB** (~875 -> ~875 KB) | Stable |
| node_modules | **0 MB** (1,047 -> 1,047 MB) | No net dep-size change |
| Production deps | **+1** (34 -> 35) | `@sentry/core` pinned as explicit direct dep (AR-H2) |

### Commits Touching the Bundle (Apr 22 -> Apr 24)

Substantial activity landed since the last report, but most is server-side or correctness fixes rather than client bundle growth:

- `fef651f5` **fix: resolve triage performance findings** -- **P8 DONE**: removed `replaysOnErrorSampleRate` and `replaysSessionSampleRate` from `sentry.client.config.ts`. Expected ~30-50 KB initial-load savings.
- `af583fd6` **fix: harden logging and sentry pii handling** -- adds `beforeSend: sanitizeSentryEvent`. Server-side sanitizer, negligible client impact.
- `5b207ee5` **fix: land quick wins bundle** -- correctness-focused, not bundle size.
- `bdb87490` **fix: simplify csp and add xss canary** -- header changes only.
- `134c01aa` **fix: PE-H3 chat first-token latency** -- streaming optimization; UX win, not bundle.
- `c7167fe4` **fix: stabilize public shell hydration** -- hydration fix; neutral to bundle.
- `d3ffaa50` **fix: AR-H2 dependency management** -- pinned `@sentry/core@10.49.0` as explicit dep. Bundle-neutral; dep count +1.
- `827d70cc` **fix: integrate wave 1 remediation locally** -- merge commit.

## Carried High-Impact Action: P8 -- DONE (Verification Pending)

**`sentry.client.config.ts` (current state):**

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

`replaysOnErrorSampleRate` and `replaysSessionSampleRate` are gone. The `@sentry/replay` integration should no longer be pulled into the static client bundle by Next.js auto-instrumentation. Test coverage added in `src/lib/sentry-client-config.test.ts` locks the "no Replay sample rates" behavior in place.

**Why the savings are not visible in the current metrics:** the dev server was running when metrics were captured, so `.next/static/chunks/` reflects an older cache. The only way to confirm the actual saving is a fresh production build. **Run `npm run build` and re-compare.**

## Action Items (Prioritized by Impact)

| Priority | Action | Estimated Savings | Effort | Notes |
|----------|--------|-------------------|--------|-------|
| **URGENT** | **Run production build to measure Replay removal** | **~30-50 KB confirmation** | Trivial | `rm -rf .next && npm run build`. Dev cache is stale. If initial load drops below 2,000 KB, status moves to GREEN. |
| **HIGH** | **Run bundle-analyzer on fresh prod build** | Visibility | Trivial | `npm run build:analyze`. Confirms chunk 10 attribution and verifies `@sentry/replay` is gone from static chunks. |
| **MEDIUM** | **P4: Tree-shake Supabase realtime** | ~20-30 KB | Medium | Only if P8 + prod build still leaves initial load over 2,000 KB. Standby. |
| **LOW** | **Cleanup empty `svix` and `uuid` files in repo root** | None | Trivial | Both are zero-byte untracked files (stray shell output). Delete. |
| **LOW** | **Sync `resend` pin** | None | Trivial | Security Agent (Apr 24): `node_modules` has `resend@6.12.0`; `package.json` pins `^6.12.2`. `npm install` on develop to resync. |
| **LOW** | node_modules budget (1,047 MB > 1,000 MB) | ~67 MB | None | Operational only. @sentry/nextjs is the 67 MB driver. Consider raising budget to 1,100 MB now Sentry is permanent. |

## P4: Tree-Shake Supabase Realtime -- Standby

Standing by behind P8 verification. If the production build + Replay removal still leaves initial load at or above 2,000 KB, apply P4 next:

```typescript
// src/lib/supabase-browser-public.ts -- public pages (immersive, chat, etc.)
import { createBrowserClient } from "@supabase/ssr";

export const supabaseBrowserPublic = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { realtime: { enabled: false } },
);
```

All public-facing pages import `supabaseBrowserPublic`. Admin pages keep the full client with realtime.

## Security-Adjacent Performance Notes

Security Agent (Apr 24) flagged three transitive advisories on `uuid<14` via the `resend -> svix -> uuid` chain. Not exploitable (svix internally uses `uuid.v4()` without caller-provided `buf`). Waiting on `svix >=1.91.2` upstream. **No performance action required** -- these are server-side, bundle-neutral.

## Previously Implemented

| Optimization | Impact | Implemented | Verified |
|--------------|--------|-------------|----------|
| **P1: Browserslist** | ~3 KB actual (predicted 80-112 KB) | 2026-03-29 | Measured Apr 4 |
| **P2: Idle prefetch ElevenLabs** | UX improvement (cold-start fix) | 2026-03-29 | N/A (UX) |
| **P3: Defer Vercel Analytics/SpeedInsights** | ~10-20 KB deferred | 2026-03-30 | Verified Apr 4 |
| **P6: Split JS budget** | Process clarity | 2026-04-04 | Both targets met |
| **next@16.2.2+** | GHSA-h27x-g6w4-24gq closed | 2026-04-03 | 16.2.4 current |
| **All dep gaps cleared** | 2c8f991: 3 majors + 6 minors | 2026-04-12 | Synced Apr 13 |
| **Agent script budget fix** | Split 2,000/3,000 KB thresholds | 2026-04-14 | Confirmed |
| **P7: posthog-js 1.367.0 -> 1.369.3** | Security + 2 minor versions | 2026-04-17 (triage) | 1.369.3 current |
| **posthog-js security upgrade** | 2 advisories resolved (protobufjs + dompurify) | 2026-04-20 (e66e510) | 0 vulns confirmed |
| **P8: Disable Sentry session replay** | ~30-50 KB (pending prod-build verification) | **2026-04-22 (fef651f5)** | Unit test added; prod-build measurement pending |

## Dynamic Import Chain Verification

### Code-Splitting Coverage: Good (deferred chunks all correct)

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
]))   // ~180 KB after hydration, production only (v1.369.3)
```

**Static (in initial load -- re-audit after prod build):**

```
// @sentry/nextjs: auto-instrumented at build time by Next.js.
// AS OF fef651f5 (Apr 22): Replay integration NO LONGER included.
// Next prod build should show ~30-50 KB drop in Sentry static chunk.

// zod: used in API route handlers (server-side) AND potentially client-side
// for form validation. Verify no 'use client' components import zod.

// pino: server-side only (confirmed by coverage agent -- logger.ts is
// production-only).
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
| posthog-js | 36 MB | ~180 KB (lazy-loaded in useEffect) | **1.369.3 -- current** |
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

Per Security Agent (Apr 24): YELLOW with 3 moderate `uuid<14` advisories (transitive, not exploitable). Local `node_modules` has drifted from `package.json` on `resend` (6.12.0 vs pinned `^6.12.2`). Outdated production patches available: `@supabase/supabase-js` 2.104.x, `posthog-js` 1.369.5, `resend` 6.12.2.

| Package | Installed | Latest Known | Status |
|---------|-----------|--------------|--------|
| posthog-js | 1.369.3 | 1.369.5 | Minor patch available |
| next | 16.2.4 | 16.2.x | Current |
| @anthropic-ai/sdk | 0.90.x | 0.90.x | Current |
| @supabase/supabase-js | 2.103.3 | 2.104.x | Patch available |
| react / react-dom | 19.2.5 | 19.2.5 | Current |
| @sentry/nextjs | 10.49.0 | 10.49.x | Current |
| @sentry/core | 10.49.0 (pinned) | 10.49.x | Current (direct dep as of d3ffaa50) |
| zod | 4.3.6 | 4.x | Current |
| pino | 10.3.1 | 10.x | Current |
| stripe | 22.0.2 | 22.0.2 | Current |
| @supabase/ssr | 0.10.2 | 0.10.2 | Current |
| @upstash/redis | 1.37.0 | 1.37.0 | Current |
| voyageai | 0.2.1 | 0.2.1 | Current |
| @vercel/analytics | 2.0.1 | 2.0.1 | Current |
| @vercel/speed-insights | 2.0.0 | 2.0.0 | Current |
| lucide-react | 1.8.0 | 1.8.0 | Current |
| resend | 6.12.0 (installed) / ^6.12.2 (pinned) | 6.12.2 | **Pin drift -- run `npm install`** |
| knip (dev) | 6.5.0 | 6.5.0 | Current |

## Comparison: Trend History

| Metric | Feb 7 | Mar 8 | Apr 4 | Apr 12 | Apr 17 | Apr 20 | Apr 22 | **Apr 24** | Trend |
|--------|-------|-------|-------|--------|--------|--------|--------|------------|-------|
| Total JS | 2,455 KB | 2,726 KB | 2,851 KB | 2,856 KB | 2,892 KB | 2,941 KB | 2,941 KB | **2,940 KB** | -1 KB |
| Initial load (est.) | -- | -- | ~1,800 KB | ~1,936 KB | ~1,972 KB | ~2,066 KB | ~2,066 KB | **~2,065 KB** | -1 KB |
| Deferred chunks | -- | -- | ~1,050 KB | ~920 KB | ~920 KB | ~875 KB | ~875 KB | **~875 KB** | 0 KB |
| CSS | 130 KB | 122 KB | 123 KB | 123 KB | 123 KB | 125 KB | 125 KB | **125 KB** | 0 KB |
| Prod deps | 27 | 31 | 31 | 31 | 31 | 34 | 34 | **35** | +1 (@sentry/core pinned) |
| node_modules | 856 MB | 865 MB | 896 MB | 908 MB | 930 MB | 1,047 MB | 1,047 MB | **1,047 MB** | 0 MB |

*Apr 24: Dev server cache -- does not reflect the Replay removal in `fef651f5` (Apr 22). Fresh production build needed to confirm the ~30-50 KB expected delta.*

**2.5-month total growth: 2,455 -> 2,940 KB (+485 KB, +19.8%).** The bundle has plateaued in the dev cache for 4 consecutive cycles. The next production build should break that plateau downward for the first time since Feb, thanks to P8.

## Remaining Backlog

### P4: Tree-shake Supabase realtime -- standby

Deprioritized behind P8 verification. Re-evaluate after production build measurement.

### P5: i18n bundling -- CLOSED (Turbopack limitation)

All 6 locales bundled in initial JS (~122 KB combined). Turbopack 16.x eagerly bundles `import()` calls in `'use client'` components. An inline `if`-chain rewrite was attempted and reverted after causing +565 KB regression. Accepted limitation.

### P8: Disable Sentry session replay -- DONE (Apr 22), verification pending

Implemented in `fef651f5`. Awaiting production build confirmation.

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
| **URGENT** | **Run `npm run build` to measure P8** | Confirmation | Trivial | Ready |
| **HIGH** | **Run `npm run build:analyze`** | Visibility | Trivial | Confirms Replay is actually gone from static chunks |
| **MEDIUM** | **P4: Tree-shake Supabase realtime** | ~20-30 KB | Medium | Standby -- only if P8 insufficient |
| **LOW** | Cleanup empty `svix` and `uuid` files in repo root | None | Trivial | Stray shell output; delete |
| **LOW** | Sync `resend` pin via `npm install` | None | Trivial | Pin drift flagged by Security Agent |
| **LOW** | node_modules budget adjustment | Process | Trivial | Raise to 1,100 MB now Sentry is permanent |

---
