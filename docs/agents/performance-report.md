# Performance Report

> Updated on 2026-04-30 (dev server cache -- no production build this cycle. Apr 25 prod build remains authoritative for initial load.)

## Health Status: YELLOW

**Initial load JS: ~2,067 KB (Apr 25 prod baseline, budget: 2,000 KB) -- OVER by 67 KB. P4 not yet implemented.**
**Total JS: 2,986 KB dev cache (budget: 3,000 KB) -- 14 KB headroom only. CRITICAL.**

Zero change this cycle. All 10 top chunks carry identical byte sizes to Apr 29 -- the dev cache was not invalidated (no code changes landed between Apr 29 and Apr 30 agent runs). The YELLOW status and all outstanding action items carry forward unchanged.

**QA regression clarification**: The Apr 29 Chat API 403 (QA RED) is confirmed by Security Agent and QA Agent (Apr 30) to be a test harness gap -- Node.js `fetch` omits the `Origin` header automatically, and CSRF enforcement (SE-M2) requires it. Fix is a one-line change in `src/tests/qa/llm-quality.test.ts:43`: add `'Origin': API_URL` to headers. Production chat is not broken. The immersive page journeys recovered to 10/10, confirming `bab3c40e` fixed the story render regression.

**Key state entering May:**
- P4 (Supabase realtime tree-shake) -- activated Apr 25, still unimplemented
- Budget raise to 2,100 KB initial / 3,100 KB total -- still pending
- Production build -- still needed this cycle (dev cache only since Apr 25)
- Chunk 7 (0v_78g45r38tv, 119 KB) -- still unclassified (static vs deferred)
- QA harness Origin header fix -- one-line change, unblocks LLM safety confirmation

## Key Metrics

| Metric | Today (2026-04-30 dev) | Apr 29 (dev) | Apr 25 (prod) | Apr 4 (prod) | Budget | Status |
|--------|------------------------|--------------|----------------|--------------|--------|--------|
| Total JS | **2,986 KB** (dev cache) | 2,986 KB | **2,941 KB** | 2,851 KB | 3,000 KB | 14 KB headroom -- CRITICAL |
| Initial load JS | **~2,067 KB** (Apr 25 prod) | 2,067 KB | **2,067 KB** | ~1,800 KB | 2,000 KB | OVER by 67 KB |
| Total CSS | 125 KB | 125 KB | 125 KB | 122 KB | -- | Stable |
| Production deps | **35** | 35 | 35 | 31 | 40 | Good |
| Development deps | 30 | 30 | 29 | -- | -- | Stable |
| node_modules | **1,048 MB** | 1,048 MB | 1,047 MB | 896 MB | 1,100 MB | Under (+52 MB) |
| .next | 959 MB | 873 MB | -- | 46 MB | -- | Active dev session |

*Apr 30: Dev cache, zero change from Apr 29. Apr 25 prod build is authoritative for initial load.*
*2.7-month total growth (prod baseline): 2,455 -> 2,986 KB dev (+531 KB, +21.6%).*

## Budget Status

| Budget | Limit | Current | Headroom | Status |
|--------|-------|---------|----------|--------|
| **Initial load JS** | 2,000 KB | **~2,067 KB** (Apr 25 prod) | -67 KB | OVER -- P4 not yet implemented |
| **Total JS** | 3,000 KB | **2,986 KB** (dev cache) | +14 KB | CRITICAL -- any wave-3 growth risks breach |
| Production deps | 40 | 35 | +5 | Good |
| node_modules | 1,100 MB | 1,048 MB | +52 MB | Under |

**Deferred chunks (excluded from initial load budget, included in total):**

| Chunk | Size | Status |
|-------|------|--------|
| ElevenLabs SDK + LiveKit | ~478 KB | Stable |
| PostHog analytics | ~180 KB | Stable |
| react-markdown + micromark | ~110 KB | Stable |
| Admin analytics UI | ~107 KB | Stable |
| **Total deferred** | **~875 KB** | Stable |

## Top 10 Chunks (Apr 30 dev cache)

All chunks byte-for-byte identical to Apr 29. Hashes unchanged -- no code changes landed this cycle.

| Rank | Chunk | Size | Contents | Loading | Actionable? |
|------|-------|------|----------|---------|-------------|
| 1 | 0jgxvc_nt0fmz (489,726 B) | **478 KB** | ElevenLabs SDK + LiveKit WebRTC + protobuf | Deferred (dynamic import) | No -- already optimized |
| 2 | 07y9atwelbm1e (233,018 B) | **228 KB** | Next.js App Router bootstrap + PPR (16.2.4) | Static (framework) | No -- required |
| 3 | 08xx2ho6aacv7 (191,461 B) | **187 KB** | Supabase SDK (auth, postgrest, realtime) | Static | **P4 target -- ~20-30 KB savings** |
| 4 | 0bopql_owpunr (183,793 B) | **180 KB** | PostHog analytics SDK v1.369.5 | Deferred (useEffect lazy import) | No -- already optimized |
| 5 | 0wu4~xh-5rs6g (134,887 B) | **132 KB** | React RSC Flight client runtime | Static (framework) | No -- required |
| 6 | 0mzmsu1pb-cds (127,520 B) | **125 KB** | i18n strings -- all 6 locales, 405 keys | Static | Closed (P5) -- Turbopack limitation |
| 7 | 0v_78g45r38tv (121,745 B) | **119 KB** | Unknown -- appeared in Apr 29 top 10. Likely shared code from FE-M1 voice-chat sub-component extraction. | Unknown -- run prod build to classify | **Investigate: determine static vs deferred** |
| 8 | 0ktbr965wa~br (114,831 B) | **112 KB** | Polyfills (core-js v3) | Static | No -- P1 applied, stable |
| 9 | 03~yq9q893hmn (112,594 B) | **110 KB** | react-markdown + micromark | Deferred (inside VoiceChat) | No -- already optimized |
| 10 | 0ax6.6ah0eu8 (109,497 B) | **107 KB** | Admin analytics (Stripe dashboard UI) | Deferred (admin tab import) | No -- already optimized |

**All 10 hashes match Apr 29 exactly.** Zero code changes reached the dev cache between reporting cycles.

## Changes This Cycle (Apr 30 vs Apr 29)

| Item | Change | Driver |
|------|--------|--------|
| Total JS (dev cache) | **0 KB** (2,986 KB unchanged) | No code changes; dev server cache frozen |
| Initial load (prod baseline) | **0 KB** (2,067 KB) | No new prod build; Apr 25 baseline unchanged |
| i18n chunk | **0 KB** (127,520 B) | Localization Agent confirms 405 keys (up from 404 Apr 27), but chunk hash unchanged -- byte size stable |
| Deferred chunks | **0 KB** (~875 KB) | Stable |
| node_modules | **0 MB** (1,048 MB) | Stable |
| Production deps | **0** (35) | Stable |

## P4: Tree-Shake Supabase Realtime -- ACTIVATED, NOT YET IMPLEMENTED

**Status: Activated Apr 25 by triage. Not implemented. `src/lib/supabase/browser-public.ts` does not exist.**

**Estimated savings: ~20-30 KB from initial load. Also protects the 14 KB total headroom.**

With total headroom at 14 KB and any wave-3 PR likely adding 5-30 KB, P4 is the gating action before further development. Cost Analyst Agent (Apr 30) echoes: "P4 (Supabase realtime tree-shake, ~25 KB) must be implemented before wave-3."

### Implementation

Step 1 -- Create a realtime-free client for public pages:

```typescript
// src/lib/supabase-browser-public.ts
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

Step 2 -- Replace `supabaseBrowser` import in public components:
- `src/components/immersive/` (story viewer, voice-chat sub-components)
- `src/components/chat/`
- Homepage components

Step 3 -- Keep full client in:
- `src/components/admin/`
- Any caller using `supabase.channel()` or `.on()` subscriptions

Step 4 -- Verify:
```bash
rm -rf .next && npm run build
```

Expected: Supabase chunk drops from ~187 KB to ~160-165 KB. Initial load: 2,067 KB -> ~2,040-2,047 KB.

**P4 alone still leaves initial load ~40-47 KB over budget.** Pair with budget raise to 2,100 KB for GREEN.

## Action Items (Prioritized by Impact)

| Priority | Action | Estimated Savings | Effort | Notes |
|----------|--------|-------------------|--------|-------|
| **CRITICAL** | **Implement P4: Supabase realtime tree-shake** | ~20-30 KB initial load + protects 14 KB total headroom | Medium | See code above. Activated Apr 25, still unimplemented. Wave-3 cannot proceed without it. |
| **CRITICAL** | **Run prod build after P4** | Visibility + confirms chunk 7 | Trivial | `rm -rf .next && npm run build`. Dev cache frozen at 2,986 KB -- need confirmation of actual initial-load impact of wave-2 merges. |
| **HIGH** | **Raise initial load budget to 2,100 KB** | YELLOW -> GREEN (initial load) | Trivial | P4 alone brings initial load to ~2,042 KB -- still over 2,000 KB. 2,100 KB reflects structural growth since Apr 4 baseline. |
| **HIGH** | **Fix QA harness Origin header** | LLM safety tests unblocked | Trivial | `src/tests/qa/llm-quality.test.ts:43`: add `'Origin': API_URL` to fetch headers. CSRF (SE-M2) enforcement requires it. This is a harness gap, not a production bug -- production chat is unaffected. |
| **MEDIUM** | **Classify chunk 7 (0v_78g45r38tv, 119 KB)** | Potential savings if static | Trivial | Prod build will reveal if this chunk is deferred or in initial load. If static, it needs investigation -- FE-M1 voice-chat extraction may have accidentally pulled code into the initial load path. |
| **MEDIUM** | **Raise total budget to 3,100 KB if wave-3 planned** | Process change | Trivial | 14 KB headroom is exhausted by a single medium-size feature PR. Either implement P4 first or raise total budget before wave-3 begins. |
| **LOW** | Monitor Next.js for postcss inner copy upgrade | Security cleanup | None | postcss override confirmed ineffective (Next.js isolation). Build-time only. Monitor upstream. |
| **CLOSED** | ~~postcss override~~ | ~~0 KB~~ | -- | Confirmed ineffective Apr 25. |
| **CLOSED** | ~~P8: Sentry Replay removal~~ | ~~0 KB~~ | -- | Replay was config-only. Confirmed Apr 25. |
| **CLOSED** | ~~node_modules budget raise~~ | -- | -- | Done Apr 25 (1,000 -> 1,100 MB). |

## Dynamic Import Chain Verification

**Deferred correctly (not in initial load):**

```
immersive-page-content.tsx
  -> dynamic(() => import("./voice-chat"), { ssr: false })       // DEFERRED
    -> voice-chat/chat-header.tsx                                // DEFERRED (FE-M1 sub-component)
    -> voice-chat/chat-message-list.tsx                          // DEFERRED (FE-M1 sub-component)
    -> voice-chat/chat-composer.tsx                              // DEFERRED (FE-M1 sub-component)
    -> voice-chat/chat-error-banner.tsx                          // DEFERRED (FE-M1 sub-component)
    -> dynamic(() => import("./voice-chat-elevenlabs"))           // DEFERRED
      -> import { useConversation } from "@elevenlabs/react"      // ~478 KB
    -> import ReactMarkdown from "react-markdown"                 // ~110 KB
    -> import { usePostHog } from "posthog-js/react"              // ~180 KB
  -> requestIdleCallback(() => import("./voice-chat"))            // PREFETCH (P2)

admin/page.tsx
  -> 8 dynamic imports: FeatureToggles, Analytics, Marketing,
     Suggestions, Agents, StoryEditor, CreateStory, SelectionToolbar  // ~107 KB
```

**Static (in initial load):**

```
@sentry/nextjs: core + browser tracing (~83 KB, unchanged)
Supabase SDK: ~187 KB including realtime -- P4 target
i18n: ~125 KB -- Turbopack limitation (405 keys, stable)
core-js polyfills: ~112 KB -- P1 browserslist applied, stable
Button component: glass variants (UX-M9) -- small increase absorbed
```

**Unconfirmed:**
```
Chunk 0v_78g45r38tv (121,745 B, ~119 KB) -- Appeared Apr 29. Not present pre-wave-2.
Possible sources: FE-M1 shared code, glass Button variants, or other wave-2 shared modules.
Prod build required to classify as static or deferred.
```

## Dependency Analysis

| Package | node_modules Size | Client Bundle Impact | Status |
|---------|-------------------|----------------------|--------|
| next + @next | 286 MB | Framework (required) | 16.2.4 -- current |
| @sentry/nextjs + @sentry/core | 67 MB | ~83 KB static | P8 complete; 0 KB savings confirmed |
| pdfjs-dist | 66 MB | 0 KB (devDependency) | Correct |
| pdf-parse | 57 MB | 0 KB (devDependency) | Correct |
| @opentelemetry | 46 MB | 0 KB (server-only) | No action |
| lucide-react | 39 MB | ~50-75 KB (tree-shaken via `optimizePackageImports`) | v1.8.0 -- current |
| posthog-js | 36 MB | ~180 KB (lazy-loaded in useEffect) | 1.369.5 -- current, 0 advisories |
| @napi-rs | 30 MB | 0 KB (native, server-only) | No action |
| typescript | 24 MB | 0 KB (devDependency) | v6.0.3 -- current |
| canvas | 19 MB | 0 KB (optionalDep, server-only) | No action |
| stripe | 18 MB | ~10-15 KB (server-side only) | 22.0.2 -- current |
| voyageai | -- | ~2 KB (server-side only) | Pinned 0.1.0 (intentional -- v0.2.x ESM broke dynamic import) |
| core-js | 15 MB | ~112 KB (P1 browserslist applied) | No further action |
| zod | ~5 MB | ~8-12 KB | OK -- v4.3.6 |

### Dependency Version Status

Per Security Agent (Apr 30): GREEN -- 1 moderate advisory (@anthropic-ai/sdk GHSA-p7fg-763f-g4gf, not exploitable -- Local Filesystem Memory Tool not used, Vercel ephemeral filesystem has no exploit path). 18 outdated production packages (all minor/patch, 0 CVEs). voyageai intentionally pinned at 0.1.0.

| Package | Installed | Status |
|---------|-----------|--------|
| posthog-js | 1.369.5 | Current, 0 advisories |
| next | 16.2.4 | Current |
| @anthropic-ai/sdk | ^0.90.0 | 1 advisory (not exploitable); upgrade to 0.91.1 requires changelog review (breaking change) |
| @supabase/supabase-js | ^2.104.0 | Patch updates available; safe to batch |
| react / react-dom | ^19.2.5 | Current |
| @sentry/nextjs | ^10.49.0 | Current |
| voyageai | 0.1.0 (pinned) | Intentional pin -- DO NOT UPGRADE past 0.1.0 (v0.2.x ESM broke embeddings) |
| zod | ^4.3.6 | Current |
| lucide-react | ^1.8.0 | Current |

## Comparison: Trend History

| Metric | Feb 7 | Mar 8 | Apr 4 | Apr 12 | Apr 17 | Apr 25 (prod) | Apr 29 | **Apr 30** | Trend |
|--------|-------|-------|-------|--------|--------|----------------|--------|------------|-------|
| Total JS | 2,455 | 2,726 | 2,851 | 2,856 | 2,892 | **2,941** | 2,986 | **2,986 (dev)** | 0 KB this cycle |
| Initial load | -- | -- | ~1,800 | ~1,936 | ~1,972 | **2,067** | 2,067 | **2,067 (prod)** | Stable -- no prod build |
| Deferred chunks | -- | -- | ~1,050 | ~920 | ~920 | **~875** | ~875 | **~875** | Stable |
| CSS | 130 | 122 | 123 | 123 | 123 | **125** | 125 | **125** | Stable |
| Prod deps | 27 | 31 | 31 | 31 | 31 | **35** | 35 | **35** | Stable |
| node_modules | 856 | 865 | 896 | 908 | 930 | **1,047** | 1,048 | **1,048 MB** | Stable |

*2.7-month total growth (dev cache): 2,455 -> 2,986 KB (+531 KB, +21.6%).*
*Wave-2 growth rate (Apr 23-29): ~+90 KB over 6 days. Headroom is exhausted -- P4 is the gate for wave-3.*

## Optimization Backlog

| Priority | Action | Estimated Savings | Status |
|----------|--------|-------------------|--------|
| ~~P1~~ | ~~Browserslist~~ | ~~3 KB actual~~ | DONE (Mar 29) |
| ~~P2~~ | ~~Idle prefetch ElevenLabs~~ | ~~UX improvement~~ | DONE (Mar 29) |
| ~~P3~~ | ~~Defer Vercel Analytics/SpeedInsights~~ | ~~10-20 KB~~ | DONE (Mar 30) |
| ~~P5~~ | ~~Fix i18n bundling~~ | -- | CLOSED -- Turbopack limitation |
| ~~P6~~ | ~~Split JS budget~~ | -- | DONE (Apr 4) |
| ~~Security~~ | ~~posthog-js advisories~~ | ~~2 advisories~~ | DONE (e66e510, Apr 20) |
| ~~P8~~ | ~~Disable Sentry session replay~~ | ~~0 KB confirmed~~ | DONE (fef651f5, Apr 22) |
| **P4** | **Tree-shake Supabase realtime** | **~20-30 KB initial load** | **ACTIVE -- must implement before wave-3** |
| **Process** | **Raise initial load budget to 2,100 KB** | **YELLOW -> GREEN** | Recommended alongside P4 |
| **Process** | **Run prod build each cycle** | **Visibility** | Required -- dev cache is unreliable for budget decisions |

---
