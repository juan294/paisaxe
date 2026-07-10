# Performance Agent Report — 2026-07-09

## Summary

Status: GREEN. This cycle delivers the **formal post-dependency-batch baseline** that the last two cycles requested, and **closes both remaining open attribution items**. A fresh production build exists (BUILD_ID `T_qWHxOJUMuWN3TeggWBG`, built Jul 9 08:02, postdating both the #717/#718 dep batch and every source commit), so every number below is authoritative — no stale-build caveats this cycle.

Note on the metrics script's "CACHED" flag: the build was not run by the metrics script, but `.next` (Jul 9 08:02) postdates the last source/dep commit (`c9aeb037`, Jul 8 09:12) and was compiled with the post-batch installed tree (next 16.2.10, posthog-js 1.396.7, @supabase/supabase-js 2.110.0 — verified in node_modules on Jul 8). This IS the fresh post-batch build; the flag is a labeling artifact, not a data-quality problem.

Three findings this cycle:

1. **Dep batch impact confirmed at +8 KB total, zero first-paint impact.** Total JS moved 3,049 -> 3,057 KB. The delta decomposes cleanly: Supabase chunk +2.3 KB (supabase-js 2.110.0), PostHog chunk +2.4 KB (posthog-js 1.396.7), remainder spread across small chunks. Both grown chunks are deferred/async. Route-level first-loads are unchanged: `/immersive` 887 KB, base routes 707 KB, `/admin` 1,107 KB (+2 KB). Security's "expected ~zero impact" prediction holds.
2. **The 110 KB unclassified chunk is CLASSIFIED after 8+ cycles: it is core-js polyfills.** `0cz1d0mv5g_q7.js` (112,594 B) contains core-js internal module names (`symbol-to-string-registry`, `string-to-symbol-registry`, `native-string-replace`). `npm ls core-js` shows exactly one dependent: `posthog-js@1.396.7 -> core-js@3.48.0`. The chunk appears in NO route's first-load list — it loads asynchronously alongside the deferred PostHog chunk. Combined real PostHog cost: 244 + 110 = ~354 KB, all off first paint.
3. **P1 (Supabase deferral) verified holding post-batch.** The rebuilt Supabase chunk (`2iccnjqtww60x.js`, 315,234 B; signatures: supabase x65, gotrue x25, realtime x31) appears in exactly one first-load list: `/admin`. Every public route still loads it on demand. A second Supabase-adjacent chunk (`1dnam7n9w7rav.js`, 65 KB, supabase x27 — the @supabase/ssr auth-helper side) is also `/admin`-only.

One new informational flag: `.next` disk usage jumped to 1,529 MB (previous observed range 1,088–1,242 MB). This is Turbopack incremental-cache accumulation plus the retained Jul 8 webpack analyze cache — not shipped weight. Harmless; clear with `rm -rf .next` before a build if disk matters.

## Key Metrics

| Signal | Value | Status |
|---|---:|:---:|
| Total JS | 3,057 KB (+8 KB, dep batch) | PASS — 443 KB under 3,500 KB budget |
| First-load JS, `/immersive` (primary page) | 887 KB (908,821 B, measured) | PASS — unchanged post-batch |
| First-load JS, worst route (`/admin`) | 1,107 KB (1,133,572 B, measured) | PASS — admin-only surface |
| First-load JS, base routes (`/`, `/story/[slug]`) | 707 KB (724,443 B, measured) | PASS — unchanged |
| Total CSS | 134 KB (main file byte-identical 135,679 B) | Stable — 4th consecutive cycle |
| Largest chunk — ElevenLabs + LiveKit | 591 KB (605,492 B, byte-identical) | PASS — deferred, in no first-load list |
| Supabase JS client chunk | 308 KB (315,234 B, +2.3 KB) | PASS — first-load only on /admin |
| PostHog chunk | 244 KB (249,535 B, +2.4 KB) | PASS — deferred |
| core-js via posthog-js (newly classified) | 110 KB (112,594 B) | PASS — async, loads with PostHog |
| React DOM + Next.js runtime | 232 KB (237,129 B, +1 B) | Settled — framework chunk |
| Production deps | 34 / 40 | PASS — 6 headroom |
| node_modules disk | 1,031 MB | Stable |
| .next disk | 1,529 MB (new high, was 1,242 MB) | Informational — cache accumulation, not shipped weight |

## Budget Status

| Budget | Limit | Current | Status |
|---|---:|---:|:---:|
| Total JS | 3,500 KB | 3,057 KB | PASS — 443 KB headroom (12.7% under) |
| Initial JS | 2,100 KB | 887 KB on /immersive; 1,107 KB worst (/admin) | PASS — measured; 47.3% under on worst route |
| Per-chunk (informal 650 KB) | 650 KB | 591 KB max | PASS |
| Production deps | 40 | 34 | PASS |
| Total CSS | (no hard budget) | 134 KB | Baseline — stable 4th cycle |

No budgets exceeded. All numbers from the fresh post-batch build.

## First-Load JS by Route (from `.next/diagnostics/route-bundle-stats.json`, Jul 9 build)

| Route | First-load JS | Delta vs Jul 8 | Carries Supabase chunk? |
|---|---:|---:|:---:|
| /admin | 1,107 KB | +2 KB | Yes (expected — eager auth) |
| /immersive | 887 KB | ~0 | No |
| /favorites | 778 KB | ~0 | No |
| /pricing/checkout | 739 KB | +1 KB | No |
| /pricing | 731 KB | ~0 | No |
| /about, /privacy, /terms | 718 KB | +1 KB | No |
| /, /story/[slug], /coming-soon, /_not-found | 707 KB | ~0 | No |

## Chunk Classification (post-batch chunk graph — all sizes verified by signature grep)

| Size | Chunk | Contents (evidence) | Loading |
|---:|---|---|---|
| 591 KB | `3iklgkjh5uyog.js` | ElevenLabs SDK + LiveKit (livekit x168, elevenlabs x11) | Deferred — click-to-mount, in no first-load list |
| 308 KB | `2iccnjqtww60x.js` | Supabase JS: GoTrue + Postgrest + Realtime + Storage (supabase x65, gotrue x25, realtime x31) | Async on public routes; first-load only on /admin |
| 244 KB | `1zuww-tizgmla.js` | PostHog (posthog x148) | Deferred — dynamic import in `posthog-provider.tsx` |
| 232 KB | `0hgypyft3yzsy.js` | React DOM + Next.js App Router runtime | First paint (required) |
| 145 KB | `33-ly4xjin9t2.js` | Shared vendor (unchanged) | First paint — in all first-load lists |
| 110 KB | `0cz1d0mv5g_q7.js` | **CLASSIFIED: core-js@3.48.0 polyfills, sole dependent posthog-js** (core-js internal module names present; `npm ls core-js` confirms) | Async — loads with PostHog chunk, in no first-load list |
| 110 KB | `3su_i9204gfx5.js` | App code — service config/wrappers (supabase, posthog, elevenlabs, stripe, voyage refs) | Async — in no first-load list |
| 75 KB | `1-5gb9zqmqb7l.js` | Shared app/UI code | First paint — in all first-load lists |
| 64 KB | `1dnam7n9w7rav.js` | Supabase SSR/auth-helper side (supabase x27, radix x4) | First-load only on /admin |
| 52 KB | `445ry45b8bclp.js` | /immersive UI (story-info-panel, nav-hint, mood-dismissed strings, motion x24) | On /immersive first-load list |

node_modules disk sizes remain install footprints, not bundle weight: `pdfjs-dist` (61 MB) and `pdf-parse` (57 MB) are devDependencies; `canvas` (19 MB) is optional server-side; `next`/`@next`/`@sentry`/`typescript` are tooling. `core-js` (15 MB on disk) ships only the ~110 KB subset posthog-js imports.

## Top Optimization Opportunities (prioritized by impact)

### 1. CLOSED THIS CYCLE: Post-batch baseline build (was P2 since Jul 7)

The Jul 9 08:02 build is the authoritative post-#717/#718 baseline. Confirmed: +8 KB total, entirely in deferred chunks (posthog-js +2.4 KB, supabase-js +2.3 KB), zero change to any route's first-paint payload. The STALE-flag anxiety of the last two cycles is resolved. Nothing further to do.

### 2. CLOSED THIS CYCLE: 110 KB unclassified chunk identified (open since ~Jun 25)

`0cz1d0mv5g_q7.js` = core-js polyfills pulled exclusively by posthog-js, loaded async with the PostHog chunk. No action required — it is off the first-paint path. For the record, the only way to shed it would be replacing posthog-js with a lighter client (e.g. posthog-js-lite, which drops session replay/surveys and the reverse-proxy autocapture used here) — **not recommended**: the cost is 110 KB of deferred, cached JS on an analytics path, and the feature loss is real. Classified, closed, no action.

### 3. CSS 122 -> 134 KB attribution — CLOSE as baseline

Main CSS file has been byte-identical (135,679 B) for 4 consecutive cycles. Treat 134 KB as the standing baseline; removing this from the open-items list.

### 4. QA's +19% LLM-runtime question — answered from the bundle side

QA (Jul 9) asked whether the fresh post-batch build shows a latency-relevant change. From the client side: no — first-load payloads are byte-flat on every public route, so no client-bundle change can explain the LLM suite's +19% wall time. Server-side, the batch moved next 16.2.9 -> 16.2.10 (patch) and @anthropic-ai/sdk 0.106 -> 0.110 (server-external, not bundled); neither is a plausible +19% source, but the LLM suite's runtime is dominated by model/API latency, which this agent cannot measure from build artifacts. Recommendation stands with QA's own plan: watch 2 more cycles before escalating; if it persists, profile the dev-server API route timings rather than the bundle.

### 5. ElevenLabs voice-shelving — product/cost lever (WATCH, unchanged)

The 591 KB chunk is byte-identical and fully deferred (in no first-load list); it costs current users nothing. Per Cost Analyst Jul 8, this is a Feb 2027 renewal decision, not a bundle item.

### 6. Monitor total JS headroom (ONGOING WATCH)

443 KB headroom (was 451 KB). Threshold unchanged: revisit if headroom drops below 300 KB. The only foreseeable pressure is issue #721 (hydration-readiness UI work on /immersive), if it ever lands client code.

### 7. Housekeeping (LOW): .next cache growth

`.next` at 1,529 MB is a new high (+287 MB over the previous peak) from Turbopack incremental cache plus the retained webpack analyze cache. Not shipped weight, no user impact. If local disk becomes a concern: `rm -rf .next && npm run build`. Do not schedule a dedicated run for this.

## Comparison to Previous Runs

| Metric | Jul 3 | Jul 4 | Jul 6 | Jul 7 | Jul 8 | Jul 9 |
|---|---:|---:|---:|---:|---:|---:|
| Total JS | 3,022 KB | 3,022 KB | 3,022 KB | 3,022 KB | 3,049 KB | 3,057 KB |
| vs 3,500 KB budget | -478 KB | -478 KB | -478 KB | -478 KB | -451 KB | -443 KB |
| /immersive first-load | est. only | est. only | est. only | est. only | 887 KB | 887 KB (flat) |
| Total CSS | 122 KB | 122 KB | 134 KB | 134 KB | 134 KB | 134 KB |
| Supabase chunk | 324 KB (first-paint) | 324 KB (first-paint) | 324 KB (first-paint) | 324 KB (first-paint) | 306 KB (deferred) | 308 KB (deferred) |
| ElevenLabs chunk | 591 KB | 591 KB | 591 KB | 591 KB | 591 KB | 591 KB (byte-identical) |
| PostHog chunk | 241 KB | 241 KB | 241 KB | 241 KB | 241 KB | 244 KB (batch) |
| Production deps | 34/40 | 34/40 | 34/40 | 34/40 | 34/40 | 34/40 |
| node_modules | 1,024 MB | 1,029 MB | 1,029 MB | 1,029 MB | 1,031 MB | 1,031 MB |
| .next disk | 1,126 MB | 1,172 MB | 1,088 MB | 1,100 MB | 1,242 MB | 1,529 MB |

The +8 KB is the expected, now-measured cost of the 26-package dependency batch, and it landed entirely in deferred chunks. No regression: every route's first-paint payload is flat.

## Cross-Agent Observations This Cycle

**QA Jul 9 GREEN.** First fully clean sweep (12/12 LLM, 10/10 journeys) — the post-P1 hydration behavior is stable in E2E for a 2nd validation cycle. Their +19% LLM-runtime flag is addressed in item 4 above: not bundle-attributable; support their 2-cycle watch plan.

**Security Jul 9 GREEN.** Their root-cause on Dependabot alert #73 (alerts track main's lockfile, develop is patched) has no bundle implication. The remaining 17-package drift is patch/minor with posthog-js the only client-visible one — future batches should repeat this cycle's pattern: expect single-digit KB deltas in deferred chunks.

**Cost Analyst Jul 8 WATCH.** ElevenLabs chunk position unchanged (deferred, byte-identical); no bundle lever remains on the voice stack, matching their framing of it as a Feb 2027 renewal decision.

**Localization Jul 9.** i18n lazy-loading confirmed unaffected by the P1 deferral, matching their finding; no i18n bundle action needed.

**Triage.** No performance code actions this cycle — both standing open items closed by analysis of the existing fresh build, no new build or code change needed.

## Open Items

| Item | Priority | Status |
|---|---|---|
| Total JS headroom watch (443 KB; act below 300 KB) | Watch | Open — ongoing |
| Issue #721 hydration readiness — potential future client-code cost | Watch | Open (QA owns the issue) |
| LLM suite +19% runtime — server/API side | Watch | Open (QA owns; not bundle-attributable, see item 4) |
| ElevenLabs voice-shelving product decision | User decision | Open — Feb 2027 renewal window (Cost Analyst owns) |

## Closed / No-Action Items (for the record)

| Item | Resolution |
|---|---|
| Fresh post-#717/#718 baseline build | CLOSED (Jul 9) — build Jul 9 08:02, +8 KB total, all deferred chunks, first-paint flat |
| Classify `0cz1d0mv5g_q7.js` (110 KB, open since ~Jun 25) | CLOSED (Jul 9) — core-js@3.48.0 via posthog-js (sole dependent), async with PostHog chunk |
| CSS 122 -> 134 KB attribution | CLOSED — byte-identical 4 cycles; 134 KB is the baseline |
| P1: Supabase chunk off first paint | CLOSED (Jul 8) — re-verified post-batch: chunk on /admin first-load only |
| P2: build:analyze artifact | CLOSED (Jul 8) — `docs/agents/bundle-analysis/2026-07-08.html` |
| PostHog deferral | CLOSED — dynamic-imported; its full deferred cost is 244 KB + 110 KB core-js |
| `optimizePackageImports` (lucide-react, posthog-js) | CLOSED — active in `next.config.ts:19` |
| `pdfjs-dist` / `pdf-parse` client-bundle risk | CLOSED — devDependencies, never shipped |
| ElevenLabs click-to-mount | CLOSED — active, 591 KB in no first-load list |

---
