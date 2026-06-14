# Performance Agent Report — 2026-06-13

## Summary

Status: GREEN, authoritative. Build provenance is CACHED-but-authoritative: `.next` mtime (07:40:34) postdates the last source/dep commit (`74e73938`, 07:38:37), so the on-disk bundle reflects the current source tree exactly. No rebuild was required.

This is the strongest bundle position in months. Total JS fell to **3,025 KB**, now **475 KB under the 3,500 KB total budget** — a -162 KB cut this cycle on top of last cycle's -206 KB react-markdown removal. Over two cycles the bundle has dropped 3,393 KB (Jun 11) -> 3,187 KB (Jun 12) -> **3,025 KB (Jun 13)**, a cumulative -368 KB (-11%).

Two distinct wins landed this cycle, both from the global-shell remediation (`986bc0e1`, #600 #612):

1. **`global-error.tsx` i18n purge (drives the -162 KB total reduction).** The global error shell — which replaces the root layout and ships as its own entry bundle — was statically importing all six full translation files (`es/en/fr/de/pt/ast`, ~406 keys each) plus the `resolveTranslation` machinery. It only renders four strings (title, description, retry, go-home). The fix replaces the full-translation import with a tiny inline `errorCopy` map (4 strings x 6 locales). This eliminated a duplicated, first-paint-adjacent copy of the entire i18n bundle.

2. **`auth-provider.tsx` Supabase lazy-load (improves initial-load, total-neutral).** The Supabase browser client (the 330 KB `GoTrueClient` chunk) is now dynamically imported via `await import("@/lib/supabase-browser")` inside `getSupabaseClient()` (auth-provider.tsx:32) and gated behind a real anon-key check (skipped entirely with dummy/CI credentials). It previously sat on the synchronous first-paint path. This moves 330 KB off first paint without changing total weight.

Combined with react-markdown's full removal last cycle (confirmed: zero `micromark`/`mdast`/`remark` signatures across all chunks, zero `ReactMarkdown` imports in `src/`), the three heaviest vendor chunks — ElevenLabs (605 KB), Supabase (330 KB), PostHog (344 KB) — are now all OFF the synchronous first-paint path. That is ~1,279 KB (42% of the bundle) deferred or click-to-mount.

Actions taken by this agent: read-only analysis only. No source changes, no rebuild (existing artifacts are authoritative per provenance).

## Key Metrics

| Signal | Value | Authoritative? | Status |
|---|---:|:---:|:---:|
| Total JS | 3,025 KB | Yes (cached build postdates last src commit) | PASS — 475 KB under 3,500 KB |
| Shared first-load shell (`rootMainFiles`) | 532 KB | Yes (from build-manifest) | Healthy framework baseline |
| Initial JS (split budget half) | est. well under 2,100 KB | Estimate (see note) | PASS — heaviest vendors now deferred |
| Largest chunk (ElevenLabs) | 605 KB | Yes | Within 650 KB per-chunk budget (45 KB headroom) |
| Total CSS | 122 KB | Yes | Healthy (no hard budget) |
| Production deps | 34 / 40 | Yes | PASS (6 headroom) |
| Dev deps | 30 | Yes | Informational |
| node_modules disk | 1,018 MB | Yes | GREEN (within normal range) |
| .next disk | 84 MB | Yes | GREEN |

Note on Initial JS: this is a Turbopack production build (a `turbopack-*` chunk is present in `rootMainFiles`, and `build:analyze` uses `--webpack`). The webpack-style `app-build-manifest.json` with per-route first-load totals is absent from the on-disk artifacts, so the precise initial-load number cannot be derived without a `npm run build:analyze` (webpack) run. What IS measurable: the shared shell every route loads (`rootMainFiles`) is 532 KB, and the three heaviest vendor chunks are all confirmed deferred. A realistic per-page first load is roughly the shell (532 KB) + shared app chunk (112 KB) + the route's own chunk — on the order of ~700-900 KB, comfortably under the 2,100 KB initial budget. The old "total minus deferred" estimate is no longer reliable: react-markdown's removal invalidated that subtraction. If an exact initial figure is needed for the split budget, run `build:analyze`.

### Largest chunks (authoritative cached build)

| Size | Chunk | Contents (evidence) | Loading | Notes |
|---:|---|---|---|---|
| 605 KB | `3l7h0thz1bbdh.js` | ElevenLabs SDK (`elevenlabs`/`convai` confirmed) | Deferred — click-to-mount (`bd833288`) | Tightest per-chunk margin |
| 330 KB | `0cx7amjxnog2y.js` | Supabase client (`GoTrueClient` confirmed) | **Now deferred** — lazy `import()` in auth-provider | Moved off first paint this cycle |
| 237 KB | `0273rfe8p5u4v.js` | React + Next framework vendor (`react-dom`/`scheduler`) | First paint (`rootMainFiles`, required) | Identical |
| 227 KB | `0gcbkw8dl4r9-.js` | PostHog core (`posthog` confirmed) | Deferred — post-hydration, prod-only | Identical |
| 148 KB | `3c-18qv58e7zi.js` | Next.js App Router client runtime (`createHrefFromUrl` confirmed) | First paint (`rootMainFiles`, required framework) | Identified prior cycle; no app-level lever |
| 117 KB | `2f1alz9dhg520.js` | PostHog support (no rrweb/replay/surveys signatures) | Deferred | Identical |
| 112 KB | `0cz1d0mv5g_q7.js` | Shared app chunk (no vendor signatures) | First paint | ~Identical |
| 76 KB | `3uwi2y7pkzyjg.js` | Shared runtime | First paint (`rootMainFiles`) | — |
| 67 KB | `14q503fs3fh64.js` | Route chunk | Per-route | — |
| 56 KB | `3g-njyekx_z2d.js` | Route chunk | Per-route | — |

Deferred / lazy weight: ElevenLabs 605 + Supabase 330 + PostHog 344 = ~1,279 KB — about 42% of the bundle never loads on synchronous first paint.

### Dependencies

Production deps at 34 / 40 (react-markdown's removal already reflected; 6 headroom). pdfjs-dist and pdf-parse remain `devDependencies` (never client-shipped). `lucide-react` and `posthog-js` remain covered by `optimizePackageImports` in `next.config.ts:19`. `voyageai` stays pinned at 0.1.0 (0.2.x has broken ESM) — exclude from any dep batch.

## Budget Status

| Budget | Limit | Current | Status |
|---|---:|---:|:---:|
| Total JS | 3,500 KB | 3,025 KB | PASS — 475 KB headroom |
| Initial JS | 2,100 KB | est. ~700-900 KB first load (shell 532 KB) | PASS — heaviest vendors deferred |
| Per-chunk | 650 KB | 605 KB max (ElevenLabs) | PASS — 45 KB headroom (tightest budget) |
| Production deps | 40 | 34 | PASS — 6 headroom |
| node_modules disk | (soft) | 1,018 MB | PASS |
| Total CSS | (no hard budget) | 122 KB | Healthy |

No budgets exceeded. Per-chunk (ElevenLabs at 605/650) remains the thinnest margin of the three bundle budgets.

## Top Optimization Opportunities (prioritized by impact)

The bundle is now genuinely lean at the application level. With react-markdown gone and PostHog already minimally configured, there is no large reducible *app-level* weight remaining. The biggest levers are now product decisions or precision-measurement, not engineering cleanups.

### 1. ElevenLabs voice-shelving — 605 KB, product lever only (HIGHEST IMPACT, NON-ENGINEERING)

The single largest chunk (605 KB) is already deferred to click-to-mount, so it costs nothing at first paint. The only way to remove it from the bundle is the product decision to shelve voice. Cost Analyst (Jun 12) reports 115 days of zero Paisaxe voice traffic and frames shelving as a ~$45/mo tier-downgrade lever. If voice is shelved, total drops to ~2,420 KB and the budget should be re-lowered to ~3,100 KB (as proposed in prior reports). This is a user/product decision; no agent action.

### 2. Initial-load precision — run `build:analyze` to verify the split budget's initial half (LOW EFFORT, MEASUREMENT)

The split budget (initial 2,100 / total 3,500) has been in force since 2026-04-04, but the initial half cannot be verified from the current Turbopack cached artifacts — `app-build-manifest.json` with per-route first-load totals is absent. The total half is authoritative and green (475 KB headroom); the initial half is only estimable. One webpack `npm run build:analyze` run would produce the authoritative per-route first-load numbers and let the initial budget be checked precisely rather than estimated. Worth doing once to confirm the post-remediation initial-load picture, especially since two first-paint reductions just landed.

### 3. PostHog — already optimal, no further structural lever (NO ACTION)

For the record, so future cycles don't re-flag it: PostHog (344 KB across two chunks) is already (a) lazy-loaded via dynamic `import()` after hydration, (b) production-only, and (c) minimally configured — `autocapture: false`, `capture_pageview: false`, `capture_pageleave: false`, `person_profiles: "never"`, `persistence: "memory"` (posthog-provider.tsx:88-96). The 117 KB support chunk contains no rrweb / session-recording / surveys / web-vitals / toolbar signatures, so there is no replay weight to cut. The only remaining lever would be dropping PostHog entirely — not warranted. Treat this chunk as settled.

### 4. Per-chunk headroom watch — `@elevenlabs/react` bumps (WATCH)

The ElevenLabs SDK (605 / 650 KB) leaves only 45 KB of per-chunk headroom — the tightest of all budgets. Security (Jun 13) notes `@elevenlabs/react` 1.6.7 is available. Any bump beyond patch level should get a fresh-build measurement BEFORE merge, not after — a minor feature release could plausibly consume the remaining 45 KB. Pair this with the sharp 0.35.1 bump Security also flagged (per-chunk headroom is thin).

### 5. Supabase first-paint deferral — CLOSED THIS CYCLE (for the record)

The 330 KB Supabase/`GoTrueClient` chunk was the largest first-paint vendor weight in every prior report. The global-shell remediation moved it to a post-hydration dynamic import (auth-provider.tsx:32), gated behind a real anon-key check. It no longer blocks first paint. This was a long-standing implicit opportunity; it is now resolved as a side effect of the auth-provider refactor.

## Recommendations Summary

1. Status GREEN, authoritative: 3,025 KB / 3,500 KB (475 KB headroom) — best position in months, -368 KB over two cycles.
2. The three heaviest vendor chunks (ElevenLabs, Supabase, PostHog = 1,279 KB) are now all deferred or click-to-mount. First paint is dominated by the 532 KB framework shell.
3. No large app-level reducible weight remains. PostHog is settled (already lazy + minimal); react-markdown is gone.
4. Remaining levers are non-engineering: ElevenLabs voice-shelving (product/cost decision) and one `build:analyze` run to verify the initial-load budget half precisely.
5. Watch `@elevenlabs/react` bumps — 45 KB per-chunk headroom is the tightest margin; measure before merge.

## Comparison to Previous Run

| Metric | Jun 11 (fresh build) | Jun 12 (react-markdown removed) | Jun 13 (this run) | Net change |
|---|---:|---:|---:|:---:|
| Total JS | 3,393 KB | 3,187 KB | 3,025 KB | -368 KB (2 cycles) |
| Total budget | 3,500 KB | 3,500 KB | 3,500 KB | unchanged |
| Total headroom | 107 KB | 313 KB | 475 KB | +368 KB |
| ElevenLabs chunk | 605 KB | 605 KB | 605 KB | unchanged (deferred) |
| Supabase chunk | 332 KB (first paint) | 330 KB (first paint) | 330 KB (**deferred**) | moved off first paint |
| PostHog chunks | 346 KB | ~344 KB | 344 KB | ~unchanged (deferred) |
| react-markdown family | 431 KB | removed | absent | -431 KB |
| Total CSS | 122 KB | 122 KB | 122 KB | unchanged |
| Production deps | 35 / 40 | 34 / 40 | 34 / 40 | -1 (react-markdown) |
| Build provenance | FRESH | n/a | CACHED-authoritative | — |

Improvements: -162 KB this cycle (global-error i18n purge); Supabase 330 KB moved off first paint (auth-provider lazy-load); cumulative -368 KB / +368 KB headroom over two cycles. Regressions: none.
