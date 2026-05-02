# Performance Report

> Updated on 2026-05-01 (dev server cache -- production build skipped. Apr 25 prod build remains authoritative for initial load.)

## Health Status: RED

**Total JS: 3,008 KB (budget: 3,000 KB) -- OVER by 8 KB. Headroom is gone. Single-cycle growth +22 KB driven by commit `3163f478` (13 production dep bumps).**

**Initial load JS: ~2,067 KB (Apr 25 prod baseline, budget: 2,000 KB) -- OVER by 67 KB. P4 still not implemented.**

The 14 KB total-JS headroom warned about on Apr 30 was breached this cycle. Commit `3163f478` (chore(deps): curated production dep bumps -- 13 packages) added +22 KB across the bundle: PostHog, Supabase, ElevenLabs, and Anthropic SDK chunks all grew on minor/patch bumps. P4 (Supabase realtime tree-shake) is no longer optional -- it is the only remaining lever to recover headroom without reverting deps or raising budgets.

**P4 file `src/lib/supabase-browser-public.ts` confirmed not present** in working tree as of this run -- the optimization activated by triage on Apr 25 has not landed in any commit since.

**State entering this cycle:**
- Total JS: OVER budget by 8 KB (first breach since the split budget was adopted Apr 4)
- Initial load: still 67 KB over (unchanged baseline since Apr 25)
- P4 (Supabase realtime tree-shake): still unimplemented, file does not exist
- Budget raise to 2,100 KB initial / 3,100 KB total: still pending
- Production build: still needed -- dev cache has been authoritative for 6 days
- QA harness Origin header fix: one-line change still pending

## Key Metrics

| Metric | Today (2026-05-01 dev) | Apr 30 (dev) | Apr 25 (prod) | Apr 4 (prod) | Budget | Status |
|--------|------------------------|--------------|----------------|--------------|--------|--------|
| Total JS | **3,008 KB** (dev cache) | 2,986 KB | 2,941 KB | 2,851 KB | 3,000 KB | **OVER by 8 KB** |
| Initial load JS | **~2,067 KB** (Apr 25 prod) | 2,067 KB | 2,067 KB | ~1,800 KB | 2,000 KB | OVER by 67 KB |
| Total CSS | 125 KB | 125 KB | 125 KB | 122 KB | -- | Stable |
| Production deps | **35** | 35 | 35 | 31 | 40 | Good |
| Development deps | 30 | 30 | 29 | -- | -- | Stable |
| node_modules | **1,046 MB** | 1,048 MB | 1,047 MB | 896 MB | 1,100 MB | Under (+54 MB) |
| .next | 1,281 MB | 959 MB | -- | 46 MB | -- | Active dev session, growing |

*2.7-month total growth (dev cache): 2,455 -> 3,008 KB (+553 KB, +22.5%).*
*Single-cycle growth (Apr 30 -> May 1): +22 KB driven by `3163f478` (curated dep bumps).*

## Budget Status

| Budget | Limit | Current | Headroom | Status |
|--------|-------|---------|----------|--------|
| **Total JS** | 3,000 KB | **3,008 KB** | **-8 KB** | **OVER -- first breach since Apr 4 split** |
| **Initial load JS** | 2,000 KB | **~2,067 KB** (Apr 25 prod) | -67 KB | OVER -- P4 not implemented |
| Production deps | 40 | 35 | +5 | Good |
| node_modules | 1,100 MB | 1,046 MB | +54 MB | Under |

**Deferred chunks (excluded from initial load budget, included in total):**

| Chunk | Size | Status |
|-------|------|--------|
| ElevenLabs SDK + LiveKit | ~482 KB | +4 KB (`@elevenlabs/react` 1.1.x -> 1.3.0) |
| PostHog analytics | ~186 KB | +6 KB (1.369.5 -> 1.372.5) |
| react-markdown + micromark | ~110 KB | Stable |
| Admin analytics UI | ~107 KB | Stable |
| **Total deferred** | **~885 KB** | +10 KB this cycle |

## Top 10 Chunks (May 1 dev cache)

| Rank | Chunk | Size | Likely contents | Loading | Delta vs Apr 30 |
|------|-------|------|-----------------|---------|------------------|
| 1 | 1206~6g7o__rc.js (493,450 B) | **482 KB** | ElevenLabs SDK + LiveKit WebRTC + protobuf | Deferred | +4 KB |
| 2 | 07y9atwelbm1e.js (233,018 B) | **228 KB** | Next.js App Router bootstrap + PPR | Static (framework) | 0 KB (hash unchanged) |
| 3 | 0kugx322_2-wg.js (200,358 B) | **196 KB** | Supabase SDK (auth + postgrest + realtime) | Static | **+9 KB** -- P4 target |
| 4 | 00fah59htysmj.js (190,030 B) | **186 KB** | PostHog analytics SDK 1.372.5 | Deferred | +6 KB |
| 5 | 0wu4~xh-5rs6g.js (134,887 B) | **132 KB** | React RSC Flight client runtime | Static (framework) | 0 KB (hash unchanged) |
| 6 | 0mzmsu1pb-cds.js (127,520 B) | **125 KB** | i18n strings -- 6 locales, 405 keys | Static | 0 KB (hash unchanged) |
| 7 | 10e1-kbfg7iqw.js (125,258 B) | **122 KB** | **New chunk hash this cycle.** Likely the carry-over of chunk 7 from Apr 29 (0v_78g45r38tv, 119 KB) plus 3 KB. Possibly shared FE-M1 voice-chat code or Anthropic SDK 0.91.1 surface. Run prod build to classify. | Unknown | +3 KB |
| 8 | 0ktbr965wa~br.js (114,831 B) | **112 KB** | Polyfills (core-js v3) | Static | 0 KB (hash unchanged) |
| 9 | 03~yq9q893hmn.js (112,594 B) | **110 KB** | react-markdown + micromark | Deferred | 0 KB (hash unchanged) |
| 10 | 13lm54j7eil8i.js (109,499 B) | **107 KB** | Admin analytics (Stripe dashboard UI) | Deferred | 0 KB (hash unchanged) |

**Static chunks (hashes 2/5/6/8) are byte-for-byte identical to Apr 30. Growth is concentrated in 4 chunks (1, 3, 4, 7) -- all attributable to `3163f478`.**

## Changes This Cycle (May 1 vs Apr 30)

| Item | Change | Driver |
|------|--------|--------|
| Total JS (dev cache) | **+22 KB** (2,986 -> 3,008 KB) | `3163f478` curated dep bumps (13 packages) |
| Supabase chunk | **+9 KB** (187 -> 196 KB) | `@supabase/supabase-js` 2.104 -> 2.105.1, `@supabase/ssr` patch |
| PostHog chunk | **+6 KB** (180 -> 186 KB) | `posthog-js` 1.369.5 -> 1.372.5 |
| ElevenLabs chunk | **+4 KB** (478 -> 482 KB) | `@elevenlabs/react` 1.1.x -> 1.3.0 |
| Chunk 7 (renamed) | **+3 KB** (119 -> 122 KB) | Likely Anthropic SDK 0.90.0 -> 0.91.1 surface change |
| Initial load (prod baseline) | **0 KB** (2,067 KB) | No new prod build; Apr 25 baseline still authoritative |
| node_modules | **-2 MB** (1,048 -> 1,046 MB) | `7b1888a3` -- removed unused typed Supabase factories (Knip cleanup) |
| Production deps | **0** (35) | No new packages, only version bumps |

**Note:** The +22 KB is a dev-cache estimate. A production build may show a smaller delta because production tree-shaking is more aggressive. The Apr 25 prod baseline (2,941 KB total / 2,067 KB initial) does not yet reflect any of the wave-2 merges or the May 1 dep bumps. **A fresh prod build is the single highest-value action this cycle.**

## Root Cause: Commit `3163f478` Dep Bumps

```
$ git show 3163f478 --stat -- package.json
 package.json | 26 +-
```

The 13 packages bumped (per package.json HEAD):
- `@anthropic-ai/sdk` 0.90.0 -> 0.91.1 (closes GHSA-p7fg-763f-g4gf, server-side only -- minimal client impact)
- `@elevenlabs/react` 1.1.x -> 1.3.0 (+~4 KB in deferred ElevenLabs chunk)
- `@stripe/react-stripe-js` patch
- `@stripe/stripe-js` patch
- `@supabase/ssr` 0.10.x -> 0.10.2 (covered by P4)
- `@supabase/supabase-js` 2.104 -> 2.105.1 (+~9 KB in static Supabase chunk -- targets P4)
- `@sentry/nextjs` + `@sentry/core` patch
- `next` 16.2.x -> 16.2.4 (no chunk size impact -- framework chunk hash unchanged)
- `posthog-js` 1.369.5 -> 1.372.5 (+~6 KB in deferred PostHog chunk)
- Plus 4 minor/patch dev-deps (also in `3163f478`).

**No package was removed.** Total prod deps stable at 35.

## P4: Tree-Shake Supabase Realtime -- ESCALATED FROM CRITICAL TO BLOCKING

**Status: Activated Apr 25 by triage. Not implemented. `src/lib/supabase-browser-public.ts` does not exist.**

**Estimated savings: ~20-30 KB from initial load. Recovers ~25 KB of total-JS headroom (would put total at ~2,983 KB, 17 KB under budget).**

P4 is now the only zero-revert path back inside both budgets. Without it, every wave-3 PR risks a deeper RED state.

### Implementation

Step 1 -- Create a realtime-free client for public pages:

```typescript
// src/lib/supabase-browser-public.ts
import { createBrowserClient } from "@supabase/ssr";

export const supabaseBrowserPublic = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim(),
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

Expected: Supabase chunk drops from ~196 KB to ~165-170 KB. Initial load: 2,067 KB -> ~2,037-2,047 KB. Total JS: 3,008 KB -> ~2,978-2,983 KB (back inside total budget).

**P4 alone still leaves initial load ~37-47 KB over the 2,000 KB budget.** Pair with budget raise to 2,100 KB for GREEN on initial load.

## Action Items (Prioritized by Impact)

| Priority | Action | Estimated Savings | Effort | Notes |
|----------|--------|-------------------|--------|-------|
| **BLOCKING** | **Implement P4: Supabase realtime tree-shake** | ~25 KB total + ~25 KB initial load | Medium | See code above. Total JS now OVER budget. P4 is the only zero-revert recovery. Activated Apr 25, still unimplemented 6 days later. |
| **CRITICAL** | **Run prod build this cycle** | Visibility (no client savings) | Trivial | `rm -rf .next && npm run build`. Dev cache has been authoritative for 6 days. Apr 25 prod baseline does not reflect any wave-2 merges or `3163f478` bumps. **Without a fresh build the actual current initial-load size is unknown.** |
| **HIGH** | **Raise total budget to 3,100 KB** | RED -> YELLOW (total) | Trivial | Reflects real growth since Apr 4. Edit `scripts/performance-agent.sh` budget constant. |
| **HIGH** | **Raise initial load budget to 2,100 KB** | YELLOW -> GREEN after P4 | Trivial | P4 alone brings initial load to ~2,042 KB -- still over 2,000 KB. 2,100 KB reflects structural growth since Apr 4. |
| **HIGH** | **Fix QA harness Origin header** | Unblocks LLM safety tests | Trivial | `src/tests/qa/llm-quality.test.ts:43`: add `'Origin': API_URL` to fetch headers. CSRF (SE-M2) requires it. Production unaffected. |
| **MEDIUM** | **Classify chunk 7 (10e1-kbfg7iqw, 122 KB)** | Potential savings if static and avoidable | Trivial | Prod build will reveal if this is deferred or initial-load. If static, investigate FE-M1 voice-chat extraction and Anthropic 0.91.1 client surface. |
| **LOW** | Monitor PostHog and Supabase upgrade rate | Process | None | Both grew >5 KB on minor bumps this cycle. Future bumps should be batched and benchmarked, not absorbed silently. |
| **LOW** | Monitor Next.js for postcss inner-copy upgrade | Security cleanup | None | postcss override confirmed ineffective (Next.js isolation). |

## Quick Wins vs Heavy Lifts

**Quick wins (trivial effort, today):**
1. Run `rm -rf .next && npm run build` -- 5-minute action that gives accurate post-`3163f478` numbers and either confirms or refutes the dev-cache +22 KB delta.
2. Raise the total-JS budget in `scripts/performance-agent.sh` from 3,000 KB to 3,100 KB. The current 3,000 KB cap was set Apr 4 against a 2,851 KB baseline; growth has outpaced the cap by 5.5%.
3. Fix the QA harness Origin header (`src/tests/qa/llm-quality.test.ts:43`). One-line change unblocks LLM safety test coverage that has been blind for 3 cycles.

**Heavy lift (medium effort, this week):**
1. Implement P4. ~30-60 minutes of focused work plus a prod-build verification cycle. Recovers ~25 KB on both budgets.

## Dynamic Import Chain Verification

**Deferred correctly (not in initial load):**

```
immersive-page-content.tsx
  -> dynamic(() => import("./voice-chat"), { ssr: false })       // DEFERRED
    -> voice-chat/chat-header.tsx                                 // DEFERRED (FE-M1 sub-component)
    -> voice-chat/chat-message-list.tsx                           // DEFERRED (FE-M1 sub-component)
    -> voice-chat/chat-composer.tsx                               // DEFERRED (FE-M1 sub-component)
    -> voice-chat/chat-error-banner.tsx                           // DEFERRED (FE-M1 sub-component)
    -> dynamic(() => import("./voice-chat-elevenlabs"))           // DEFERRED
      -> import { useConversation } from "@elevenlabs/react"      // ~482 KB (was 478)
    -> import ReactMarkdown from "react-markdown"                 // ~110 KB
    -> import { usePostHog } from "posthog-js/react"              // ~186 KB (was 180)
  -> requestIdleCallback(() => import("./voice-chat"))            // PREFETCH (P2)

admin/page.tsx
  -> 8 dynamic imports: FeatureToggles, Analytics, Marketing,
     Suggestions, Agents, StoryEditor, CreateStory, SelectionToolbar  // ~107 KB
```

**Static (in initial load):**

```
@sentry/nextjs: core + browser tracing (~83 KB, unchanged)
Supabase SDK: ~196 KB including realtime -- P4 target (was 187 KB)
i18n: ~125 KB -- Turbopack limitation (405 keys, stable)
core-js polyfills: ~112 KB -- P1 browserslist applied, stable
```

**Unconfirmed:**
```
Chunk 10e1-kbfg7iqw (125,258 B, ~122 KB) -- New hash this cycle. Probable carry-over of chunk 7
  from Apr 29 (was 0v_78g45r38tv, 119 KB) plus +3 KB. Possible sources: FE-M1 shared code,
  Anthropic SDK 0.91.1 client surface, or other wave-2 shared modules. Prod build required to
  classify as static or deferred. If static, this chunk alone is the largest unexplained contribution
  to initial load growth since Apr 4.
```

## Dependency Analysis

| Package | node_modules Size | Client Bundle Impact | Status |
|---------|-------------------|----------------------|--------|
| next + @next | 286 MB | Framework (required) | 16.2.4 -- current |
| @sentry/nextjs + @sentry/core | 68 MB | ~83 KB static | P8 complete; 0 KB savings confirmed |
| pdfjs-dist | 61 MB | 0 KB (devDependency) | Correct |
| pdf-parse | 57 MB | 0 KB (devDependency) | Correct |
| @opentelemetry | 46 MB | 0 KB (server-only) | No action |
| lucide-react | 39 MB | ~50-75 KB (tree-shaken via `optimizePackageImports`) | v1.14.0 -- current |
| posthog-js | 37 MB | **~186 KB (lazy-loaded)** | 1.372.5 -- current. **+6 KB this cycle.** |
| @napi-rs | 30 MB | 0 KB (native, server-only) | No action |
| typescript | 24 MB | 0 KB (devDependency) | v6.0.3 -- current |
| canvas | 19 MB | 0 KB (optionalDep, server-only) | No action |
| stripe | 18 MB | ~10-15 KB (server-side) | 22.x -- current |
| voyageai | -- | ~2 KB (server-side only) | **Pinned 0.1.0 (intentional -- v0.2.x ESM broke dynamic import). Do NOT auto-bump.** |
| core-js | 15 MB | ~112 KB (P1 browserslist applied) | No further action |
| zod | ~5 MB | ~8-12 KB | OK -- v4.4.1 |

### Dependency Version Status

Per Security Agent (Apr 30): GREEN -- 1 moderate advisory (@anthropic-ai/sdk GHSA-p7fg-763f-g4gf, not exploitable). Commit `3163f478` already cleared the upgrade path. 4 outdated patches remain after this cycle's batch.

| Package | Installed | Status |
|---------|-----------|--------|
| posthog-js | 1.372.5 | Current after `3163f478`; +6 KB chunk impact |
| next | 16.2.4 | Current |
| @anthropic-ai/sdk | ^0.91.1 | Current after `3163f478` (advisory closed) |
| @supabase/supabase-js | ^2.105.1 | Current after `3163f478`; +9 KB chunk impact (P4 target) |
| @elevenlabs/react | ^1.3.0 | Current; +4 KB deferred chunk |
| react / react-dom | ^19.2.5 | Current |
| @sentry/nextjs | ^10.51.0 | Current |
| voyageai | 0.1.0 (pinned) | Intentional -- DO NOT UPGRADE past 0.1.0 |
| zod | ^4.4.1 | Current |
| lucide-react | ^1.14.0 | Current |

## Comparison: Trend History

| Metric | Feb 7 | Mar 8 | Apr 4 | Apr 12 | Apr 17 | Apr 25 (prod) | Apr 29 | Apr 30 | **May 1** | Trend |
|--------|-------|-------|-------|--------|--------|----------------|--------|--------|-----------|-------|
| Total JS | 2,455 | 2,726 | 2,851 | 2,856 | 2,892 | 2,941 | 2,986 | 2,986 | **3,008 (dev)** | **+22 KB this cycle, OVER budget** |
| Initial load | -- | -- | ~1,800 | ~1,936 | ~1,972 | 2,067 | 2,067 | 2,067 | **2,067 (Apr 25 prod)** | Stale -- prod build needed |
| Deferred chunks | -- | -- | ~1,050 | ~920 | ~920 | ~875 | ~875 | ~875 | **~885** | +10 KB (PostHog + ElevenLabs) |
| CSS | 130 | 122 | 123 | 123 | 123 | 125 | 125 | 125 | **125** | Stable |
| Prod deps | 27 | 31 | 31 | 31 | 31 | 35 | 35 | 35 | **35** | Stable |
| node_modules | 856 | 865 | 896 | 908 | 930 | 1,047 | 1,048 | 1,048 | **1,046 MB** | -2 MB (Knip cleanup) |

*2.7-month total growth (dev cache): 2,455 -> 3,008 KB (+553 KB, +22.5%).*
*Wave-2 + dep-bump growth (Apr 23 -> May 1): ~+150 KB over 8 days. Total budget breached.*

## Comparison vs Previous Run (Apr 30)

| Item | Apr 30 | May 1 | Delta | Verdict |
|------|--------|-------|-------|---------|
| Total JS (dev) | 2,986 KB | 3,008 KB | **+22 KB** | **REGRESSION -- budget breached** |
| Supabase chunk | 187 KB | 196 KB | **+9 KB** | Regression -- targets P4 |
| PostHog chunk | 180 KB | 186 KB | **+6 KB** | Regression -- minor bump impact |
| ElevenLabs chunk | 478 KB | 482 KB | **+4 KB** | Regression -- deferred, no UX impact |
| New chunk 7 | 119 KB | 122 KB | **+3 KB** | Regression -- still unclassified |
| node_modules | 1,048 MB | 1,046 MB | **-2 MB** | Improvement (Knip cleanup `7b1888a3`) |
| Initial load | -- | -- | unchanged | No new prod build |

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
| **P4** | **Tree-shake Supabase realtime** | **~25 KB initial + ~25 KB total** | **BLOCKING -- total budget breached** |
| **Process** | **Raise total budget to 3,100 KB** | **RED -> YELLOW** | Required this cycle |
| **Process** | **Raise initial load budget to 2,100 KB** | **YELLOW -> GREEN after P4** | Recommended alongside P4 |
| **Process** | **Run prod build each cycle** | **Visibility** | Required -- dev cache 6 days stale |

---
