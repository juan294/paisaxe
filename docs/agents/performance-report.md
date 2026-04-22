# Performance Report

> Updated on 2026-04-22 (dev server cache — last production build verified Apr 4)

## Health Status: YELLOW (initial load budget potentially breached; node_modules over budget)

**Initial load JS: ~2,066 KB (budget: 2,000 KB) — UNCONFIRMED, needs production build**
**Total JS: 2,941 KB (budget: 3,000 KB) — Under budget (+59 KB headroom)**

**0 KB change this cycle** (2,941 KB -> 2,941 KB, Apr 21 -> Apr 22). **Zero commits** between the Apr 21 and Apr 22 agent runs — the working tree has only uncommitted changes to agent reports and test files. This is the 2nd consecutive no-change cycle. Status remains YELLOW carried over from Apr 20, pending a production build to confirm whether the initial-load estimate (~2,066 KB) is a real breach or a dev-cache artifact.

**Carried finding (confirmed this cycle):** `sentry.client.config.ts:11-12` still sets `replaysOnErrorSampleRate: 1.0` and `replaysSessionSampleRate: 0.01`. The Replay integration adds ~30-50 KB to the static client bundle and remains the single highest-ROI action available. Security Agent (Apr 22) independently flagged that any sample-rate change should verify PII masking first — applies to *increasing* replay; *disabling* is strictly safer.

## Key Metrics

| Metric | Current (2026-04-22) | Previous (2026-04-21) | Apr 17 | Mar 8 (prod build) | Budget | Status |
|--------|----------------------|-----------------------|--------|---------------------|--------|--------|
| Total JS | **2,941 KB** | 2,941 KB | 2,892 KB | 2,726 KB | 3,000 KB (split) | Under budget (+59 KB) |
| Initial load JS | **~2,066 KB (est.)** | ~2,066 KB | ~1,972 KB | — | 2,000 KB (split) | Potentially over budget |
| Total CSS | **125 KB** | 125 KB | 123 KB | 122 KB | — | Stable |
| Production deps | **34** | 34 | 31 | 31 | 40 | Good (+6 headroom) |
| Development deps | **29** | 29 | 29 | — | — | Stable |
| node_modules | **1,047 MB** | 1,047 MB | 930 MB | 865 MB | 1,000 MB | OVER BUDGET (-47 MB) |
| .next | 801 MB | 801 MB | 46 MB (dev) | — | — | Dev cache (stable) |

*Current (2026-04-22): Dev server was running — cached .next data. Byte-identical to Apr 21 snapshot because no commits landed. Initial load estimate is derived (total minus deferred); production build needed for exact numbers.*

## Budget Status

**Split budget in effect since 2026-04-04.**

| Budget | Limit | Current | Headroom | Status |
|--------|-------|---------|----------|--------|
| **Initial load JS** (static, excl. deferred) | 2,000 KB | **~2,066 KB (est.)** | -66 KB | Potentially OVER — confirm with prod build |
| **Total JS** (including deferred chunks) | 3,000 KB | **2,941 KB** | +59 KB | Under budget |
| Production deps | 40 | 34 | +6 | Good |
| node_modules | 1,000 MB | 1,047 MB | -47 MB | OVER BUDGET |

**Deferred chunks (excluded from initial load budget):**

| Chunk | Size | Status vs Apr 21 |
|-------|------|------------------|
| ElevenLabs SDK + LiveKit | ~478 KB | 0 KB (stable) |
| PostHog analytics | ~180 KB | 0 KB (stable) |
| react-markdown + micromark | ~110 KB | 0 KB (stable) |
| Admin analytics UI | ~107 KB | 0 KB (stable) |
| **Total deferred** | **~875 KB** | 0 KB (stable) |

## Top 10 Chunks Identified

Chunk hashes change on each build — sizes in bytes from dev cache. Content attribution by size comparison with prior cycles. Byte-identical to Apr 21.

| Rank | Chunk (bytes) | Size | Contents | Loading | Actionable? |
|------|--------------|------|----------|---------|-------------|
| 1 | 0jgxvc_nt0fmz (489,726) | **478 KB** | ElevenLabs SDK + LiveKit WebRTC + protobuf | Deferred (dynamic import) + idle prefetch | No — already optimized |
| 2 | 07y9atwelbm1e (233,018) | **228 KB** | Next.js App Router bootstrap + PPR + hydration (16.2.4) | Static (framework) | No — required |
| 3 | 0725zmn7nfom (191,174) | **187 KB** | Supabase SDK (auth, postgrest, realtime) | Static | See P4 below |
| 4 | 01jcq5ly8dpgu (183,807) | **180 KB** | PostHog analytics SDK v1.369.3 | Deferred (useEffect lazy import) | No — already optimized |
| 5 | 0wu4~xh-5rs6g (134,887) | **132 KB** | React RSC Flight client runtime | Static (framework) | No — required |
| 6 | 0gb0~kkj~zqpo (125,174) | **122 KB** | i18n strings (all 6 locales — Turbopack limitation) | Static | P5 closed — not fixable |
| 7 | 0zqk8~mlt73qo (114,323) | **112 KB** | Polyfills (core-js v3) | Static | P1 applied — no further savings |
| 8 | 03~yq9q893hmn (112,594) | **110 KB** | react-markdown + micromark parser | Deferred (inside VoiceChat) | No — already optimized |
| 9 | 0j.n0_xy~ouxq (109,497) | **107 KB** | Admin analytics (Stripe dashboard UI) | Deferred (admin tab import) | No — already optimized |
| 10 | 0c_qd452s0tgs (85,120) | **83 KB** | i18n legal/secondary translations OR Sentry client SDK + Replay | Static | **Investigate + disable Replay (P8)** |

*Note: Chunk 10 remains the prime suspect for the @sentry/nextjs client SDK **plus** Replay integration. Replay alone adds ~30-50 KB. Bundle-analyzer is required to split attribution between Sentry-core and the secondary i18n bundle.*

## Changes This Cycle (Apr 22 vs Apr 21)

**0 KB total JS change** — no commits landed between agent runs.

| Item | Change | Driver |
|------|--------|--------|
| Total JS | **0 KB** (2,941 -> 2,941 KB) | No commits |
| Initial load (est.) | **0 KB** (~2,066 -> ~2,066 KB) | No static additions |
| Deferred chunks | **0 KB** (~875 -> ~875 KB) | Stable |
| node_modules | **0 MB** (1,047 -> 1,047 MB) | No dep changes |
| Production deps | **0** (34 -> 34) | None added |

### Commits Touching the Bundle

None. Last three commits (aee2119, 171c9ff, e5c82e2) pre-date the Apr 21 run and were already accounted for.

## Carried High-Impact Action: P8 — Disable Sentry Session Replay

**`sentry.client.config.ts:5-14` (verified this cycle, unchanged):**

```typescript
if (dsn) {
  Sentry.init({
    dsn,
    // Capture 10% of transactions for performance monitoring
    tracesSampleRate: 0.1,
    // Only enable replay in production to avoid noise
    replaysOnErrorSampleRate: 1.0,     // <- Replay active on every error
    replaysSessionSampleRate: 0.01,    // <- 1% of all sessions recorded
  });
}
```

Both replay knobs are non-zero, which pulls `@sentry/replay` into the static client bundle. Replay is the largest optional Sentry integration (~30-50 KB gzip). Sentry has now had ~48 hours of production time (added Apr 20, `#274`/`#275`) — still insufficient to justify the bundle cost.

**Fix:**

```typescript
// sentry.client.config.ts
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    // Replay intentionally disabled — reintroduce via the
    // `replayIntegration()` import + integrations array if needed.
  });
}
```

**Effort:** Trivial (3 lines). **Savings:** ~30-50 KB off static initial load. **Risk:** None — replay is additive instrumentation; error reporting, perf traces, and source-mapped stacks all still work. **Verdict:** Do this before touching P4. If the production build comes back under budget after removing Replay, P4 (Supabase realtime tree-shake) can stay on the shelf.

## Action Items (Prioritized by Impact)

| Priority | Action | Estimated Savings | Effort | Notes |
|----------|--------|-------------------|--------|-------|
| **URGENT** | **Run production build to confirm initial load** | N/A | Trivial | `npm run build` — dev cache estimate may overstate actual size. Production build on Apr 4 measured 2,851 KB total (41 KB below dev cache). |
| **HIGH** | **P8: Disable Sentry session replay** | **~30-50 KB** | Trivial | Edit `sentry.client.config.ts:11-12`. Highest ROI. 48 hours of Sentry in prod — no meaningful replay sample yet. |
| **HIGH** | **P4: Tree-shake Supabase realtime module** | ~20-30 KB | Medium | Only needed if P8 + production build still leaves initial load over 2,000 KB. |
| **MEDIUM** | **Run bundle-analyzer** | N/A | Trivial | `npm run build:analyze` — confirms exact Sentry/Replay chunk size and isolates chunk 10's attribution. |
| Low | node_modules budget (1,047 MB > 1,000 MB) | ~67 MB | None needed | Operational only. @sentry/nextjs is the 67 MB driver. Consider raising budget to 1,100 MB now that Sentry is permanent. |

## P4: Tree-Shake Supabase Realtime — Standby

Deferred behind P8 because P8 has higher savings (~30-50 KB vs ~20-30 KB) at lower effort. If P8 + production build confirmation still leaves headroom under +10 KB, apply P4 next:

```typescript
// src/lib/supabase-browser-public.ts — public pages (immersive, chat, etc.)
import { createBrowserClient } from "@supabase/ssr";

export const supabaseBrowserPublic = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { realtime: { enabled: false } },
);
```

All public-facing pages import `supabaseBrowserPublic`. Admin pages keep the full client with realtime.

## Previously Implemented

| Optimization | Impact | Implemented | Verified |
|-------------|--------|-------------|---------|
| **P1: Browserslist** | ~3 KB actual (predicted 80-112 KB) | 2026-03-29 | Measured Apr 4 |
| **P2: Idle prefetch ElevenLabs** | UX improvement (cold-start fix) | 2026-03-29 | N/A (UX) |
| **P3: Defer Vercel Analytics/SpeedInsights** | ~10-20 KB deferred | 2026-03-30 | Verified Apr 4 |
| **P6: Split JS budget** | Process clarity | 2026-04-04 | Both targets met |
| **next@16.2.2+** | GHSA-h27x-g6w4-24gq closed | 2026-04-03 | 16.2.4 current |
| **All dep gaps cleared** | 2c8f991: 3 majors + 6 minors | 2026-04-12 | Synced Apr 13 |
| **Agent script budget fix** | Split 2,000/3,000 KB thresholds | 2026-04-14 | Confirmed |
| **P7: posthog-js 1.367.0 -> 1.369.3** | Security + 2 minor versions | 2026-04-17 (triage) | 1.369.3 current |
| **posthog-js security upgrade** | 2 advisories resolved (protobufjs + dompurify) | 2026-04-20 (e66e510) | 0 vulns confirmed |

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

**Static (in initial load — audit needed):**

```
// @sentry/nextjs: auto-instrumented at build time by Next.js. Currently
// INCLUDES @sentry/replay (~30-50 KB) because sentry.client.config.ts
// sets replaysOnErrorSampleRate / replaysSessionSampleRate to non-zero.
// P8 removes this.

// zod: used in API route handlers (server-side) AND potentially client-side
// for form validation. Check if any 'use client' components import zod.

// pino: server-side only (confirmed by coverage agent — logger.ts is
// production-only).
```

## Dependency Analysis

| Package | node_modules Size | Client Bundle Impact | Status |
|---------|------------------|---------------------|--------|
| next + @next | 286 MB | Framework (required) | **16.2.4 — current** |
| @sentry/nextjs | 67 MB | **~70-120 KB static (incl. Replay)** | Added Apr 20 — P8 action needed |
| pdfjs-dist | 66 MB | 0 KB (devDependency) | Correct |
| pdf-parse | 57 MB | 0 KB (devDependency) | Correct |
| @opentelemetry | 46 MB | 0 KB (server-only telemetry) | No action |
| lucide-react | 39 MB | ~50-75 KB (tree-shaken via `optimizePackageImports`) | **v1.8.0 — current** |
| posthog-js | 36 MB | ~180 KB (lazy-loaded in useEffect) | **1.369.3 — current** |
| @napi-rs | 30 MB | 0 KB (native, server-only) | No action |
| typescript | 24 MB | 0 KB (devDependency) | No action |
| canvas | 19 MB | 0 KB (optionalDep, server-only) | No action |
| stripe | 18 MB | ~10-15 KB (server-side only) | **22.0.2 — current** |
| @img | 16 MB | 0 KB (sharp, server-only) | No action |
| core-js | 15 MB | ~112 KB (P1 browserslist applied) | No further action |
| zod | ~5 MB | ~8-12 KB | Added Apr 20 — verify no surprise client bundling |
| pino | ~5 MB | **0 KB** | Added Apr 20 — server-only, confirmed |

### Dependency Version Status

Per Security Agent (Apr 22): 10 outdated packages, all minor/patch, zero CVEs. 3 production patches available for next batch: @supabase/supabase-js 2.104.0, posthog-js 1.369.5, resend 6.12.2. None are bundle-impacting.

| Package | Installed | Latest Known | Status |
|---------|-----------|--------------|--------|
| posthog-js | 1.369.3 | 1.369.5 | Minor patch available |
| next | 16.2.4 | 16.2.x | Current |
| @anthropic-ai/sdk | 0.90.0 | 0.90.x | Current |
| @supabase/supabase-js | 2.103.3 | 2.104.0 | Patch available |
| react / react-dom | 19.2.5 | 19.2.5 | Current |
| @sentry/nextjs | 10.49.0 | 10.x | Current |
| zod | 4.3.6 | 4.x | Current |
| pino | 10.3.1 | 10.x | Current |
| stripe | 22.0.2 | 22.0.2 | Current |
| @supabase/ssr | 0.10.2 | 0.10.2 | Current |
| @upstash/redis | 1.37.0 | 1.37.0 | Current |
| voyageai | 0.2.1 | 0.2.1 | Current |
| @vercel/analytics | 2.0.1 | 2.0.1 | Current |
| @vercel/speed-insights | 2.0.0 | 2.0.0 | Current |
| lucide-react | 1.8.0 | 1.8.0 | Current |
| resend | 6.11.0 | 6.12.2 | Patch available |
| knip (dev) | 6.5.0 | 6.5.0 | Current |

**Zero security advisories** (per Security Agent Apr 22: GREEN streak maintained after e66e510).

## Comparison: Trend History

| Metric | Feb 7 | Mar 8 | Apr 4 | Apr 12 | Apr 17 | Apr 20 | Apr 21 | **Apr 22** | Trend |
|--------|-------|-------|-------|--------|--------|--------|--------|------------|-------|
| Total JS | 2,455 KB | 2,726 KB | 2,851 KB | 2,856 KB | 2,892 KB | 2,941 KB | 2,941 KB | **2,941 KB** | 0 KB |
| Initial load (est.) | — | — | ~1,800 KB | ~1,936 KB | ~1,972 KB | ~2,066 KB | ~2,066 KB | **~2,066 KB** | 0 KB |
| Deferred chunks | — | — | ~1,050 KB | ~920 KB | ~920 KB | ~875 KB | ~875 KB | **~875 KB** | 0 KB |
| CSS | 130 KB | 122 KB | 123 KB | 123 KB | 123 KB | 125 KB | 125 KB | **125 KB** | 0 KB |
| Prod deps | 27 | 31 | 31 | 31 | 31 | 34 | 34 | **34** | 0 |
| node_modules | 856 MB | 865 MB | 896 MB | 908 MB | 930 MB | 1,047 MB | 1,047 MB | **1,047 MB** | 0 MB |

*Apr 22: Dev server cache — byte-identical to Apr 21. No commits this cycle.*

**2.5-month total growth: 2,455 -> 2,941 KB (+486 KB, +19.8%).** Apr 20 spike (+49 KB from Sentry/zod/pino) has plateaued for two cycles. P8 (disable Replay) could claw back ~30-50 KB and likely bring initial load back under the 2,000 KB budget without any architectural rework.

## Remaining Backlog

### P4: Tree-shake Supabase realtime — standby

Deprioritized behind P8. Re-evaluate after production build + P8 measurement.

### P5: i18n bundling — CLOSED (Turbopack limitation)

All 6 locales bundled in initial JS (~122 KB combined). Turbopack 16.x eagerly bundles `import()` calls in `'use client'` components. An inline `if`-chain rewrite was attempted and reverted after causing +565 KB regression. Accepted limitation.

### P8: Disable Sentry session replay — HIGHEST PRIORITY (carried)

See P8 section above. Still unimplemented as of Apr 22.

## Action Plan

| Priority | Action | Estimated Savings | Effort | Status |
|----------|--------|-------------------|--------|--------|
| ~~P1~~ | ~~Browserslist~~ | ~~3 KB actual~~ | — | DONE (Mar 29) |
| ~~P2~~ | ~~Idle prefetch ElevenLabs~~ | ~~UX improvement~~ | — | DONE (Mar 29) |
| ~~P3~~ | ~~Defer Vercel Analytics/SpeedInsights~~ | ~~10-20 KB~~ | — | DONE (Mar 30) |
| ~~P5~~ | ~~Fix i18n bundling~~ | — | — | CLOSED — Turbopack limitation |
| ~~P6~~ | ~~Split JS budget~~ | — | — | DONE (Apr 4) |
| ~~Security~~ | ~~posthog-js -> 1.369.x~~ | ~~2 advisories~~ | — | DONE (e66e510, Apr 20) |
| **URGENT** | **Run `npm run build` to confirm initial load** | Confirmation only | Trivial | Ready |
| **HIGH** | **P8: Disable Sentry session replay** | ~30-50 KB | Trivial | Actionable now |
| **HIGH** | **P4: Tree-shake Supabase realtime** | ~20-30 KB | Medium | Standby — only if P8 insufficient |
| **MEDIUM** | **Run `npm run build:analyze`** | Confirmation | Trivial | Needed to isolate chunk 10 attribution |
| Low | node_modules budget adjustment | Process | Trivial | Raise to 1,100 MB now Sentry is permanent |

---
