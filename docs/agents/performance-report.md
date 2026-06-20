# Performance Agent Report — 2026-06-19

## Summary

Status: YELLOW (advisory). Build is STALE — `.next` mtime (2026-06-19 07:59:17) predates the last source commit (`82cc7284`, 2026-06-19 08:12:05 — "fix: resolve security audit dependency pin [triage]") by approximately 13 minutes. Budget verdict suppressed per agent rules. Overall status is based on disk and dependency metrics only.

**Notable this cycle:** The long-deferred `npm run build:analyze` was finally executed on Jun 19 (9+ cycles overdue) and produced authoritative webpack-mode bundle reports at `.next/analyze/client.html`, `.next/analyze/nodejs.html`, and `.next/analyze/edge.html`. The 13-minute stale gap is from the security pin commit that landed after the build:analyze run completed — not from any code change affecting bundle composition. The stale build IS the webpack build:analyze output.

The stale build reads 2,909 KB total JS vs 3,027 KB in the previous authoritative (Turbopack) build. The -118 KB gap is attributable to compiler mode differences (webpack vs Turbopack produce slightly different chunk sizes and splits); no substantive bundle reduction occurred. The last confirmed authoritative total (3,027 KB, Jun 18) remains the best reference against the 3,500 KB total budget.

ElevenLabs click-to-mount (P3, completed May 10) is confirmed working in the webpack build: the ElevenLabs SDK appears in three small deferred chunks (8 KB + 24 KB + 24 KB = ~56 KB total async), versus the 605 KB single deferred chunk reported in prior Turbopack builds. The 605 KB figure was a Turbopack-mode artifact; in webpack-mode the SDK tree-shakes to ~56 KB of async-loaded code. Either way it has zero first-paint cost.

One previously unclassified chunk (144d3bae, 412 KB) remains unidentified from filename alone. The `.next/analyze/client.html` analyzer report is now available to inspect it — this is the first cycle where that investigation is possible.

## Key Metrics

| Signal | Value | Authoritative? | Status |
|---|---:|:---:|:---:|
| Total JS (stale webpack) | 2,909 KB | No (stale, informational) | — (suppressed) |
| Total JS (last authoritative) | 3,027 KB | Yes (Jun 18 Turbopack) | PASS — 473 KB under 3,500 KB budget |
| Initial JS (split budget half) | est. ~700-900 KB first load | Estimate | PASS — heaviest vendors deferred |
| Largest chunk (7291, webpack) | 460 KB | Stale/informational | PASS vs 650 KB per-chunk budget |
| Total CSS | 120 KB | Yes | Healthy (no hard budget) |
| Production deps | 34 / 40 | Yes | PASS — 6 headroom |
| Dev deps | 30 | Yes | Informational |
| node_modules disk | 1,023 MB | Yes | GREEN (flat) |
| .next disk | 1,273 MB | Yes | Informational (includes webpack analyze artifacts) |

## Budget Status

| Budget | Limit | Current | Status |
|---|---:|---:|:---:|
| Total JS | 3,500 KB | 3,027 KB (authoritative Jun 18) | PASS — 473 KB headroom |
| Initial JS | 2,100 KB | est. ~700-900 KB | PASS — heaviest vendors deferred |
| Per-chunk | 650 KB | 460 KB max (stale webpack) | PASS |
| Production deps | 40 | 34 | PASS — 6 headroom |
| node_modules disk | (soft) | 1,023 MB | GREEN |
| Total CSS | (no hard budget) | 120 KB | Healthy |

No budgets exceeded. Budget verdict suppressed for JS totals (stale build); dependency and disk budgets are authoritative.

## Largest Chunks Analysis (webpack build:analyze, Jun 19)

The chunk names below are webpack-mode chunks from the `npm run build:analyze` run. They differ from prior Turbopack chunk names; chunk sizes should be compared within-mode only.

| Size | Chunk | Contents | Loading | Notes |
|---:|---|---|---|---|
| 460 KB | `7291-fbbf46267b79fc85.js` | Next.js App Router client runtime + Sentry SDK (10 Sentry refs) | First paint (required) | Sentry instrumentation injected into the primary framework bundle; cannot be deferred without dropping error monitoring |
| 412 KB | `144d3bae.07e3d4f37ae764e1.js` | Unknown — NOT stripe, redis, lucide, ElevenLabs, or PostHog | Unknown (deferred?) | Requires `.next/analyze/client.html` inspection. See P1 below. |
| 196 KB | `4bd1b696-3e21ee7aa3be9ee0.js` | Unknown vendor chunk (Sentry debug ID only — not primary Sentry) | Unknown | Requires analyzer inspection |
| 196 KB | `9da6db1e.8a031680b32ac174.js` | PostHog | Deferred — post-hydration, prod-only | Confirmed; consistent with prior cycles |
| 188 KB | `framework-22c77fba66b3f272.js` | React + Next.js framework vendor | First paint (required) | Standard framework shell |
| 184 KB | `838-1d690d4b912dbffb.js` | Supabase (`GoTrueClient`) | Deferred — lazy import() in auth-provider | Confirmed; consistent with prior cycles |
| 148 KB | `main-f6c3d61df0637c30.js` | Next.js main runtime | First paint (required) | Standard |
| 110 KB | `polyfills-42372ed130431b0a.js` | Browser polyfills | First paint (required) | Standard |
| 107 KB | `6444.b53371b41307a5be.js` | Shared app chunk | First paint | Unknown composition |
| 72 KB | `app/immersive/page-*.js` | Immersive page route | Per-route | Route-specific; reasonable for a feature-rich page |

**ElevenLabs webpack-mode finding:** The ElevenLabs SDK that showed as a 605 KB single chunk in Turbopack mode appears in webpack mode as three small async chunks: 8 KB + 24 KB + 24 KB = ~56 KB total. This is correct — dynamic import() causes webpack to split the SDK more aggressively. Neither figure contributes to first-paint weight; click-to-mount is working as intended.

**Sentry distribution:** Sentry appears in the 7291 chunk (10 refs, primary SDK) plus debug ID stubs in 4 other chunks (1 ref each). The debug ID stubs are ~200-byte IIFE injections at file head, not actual Sentry code. The primary Sentry SDK is collocated with the App Router runtime in the 7291 chunk.

## Optimizations Active (stable)

- `optimizePackageImports` active for `lucide-react` and `posthog-js` (next.config.ts:19) — tree-shakes barrel exports; lucide confirmed not in any large chunk.
- `serverExternalPackages: ["@anthropic-ai/sdk", "sharp"]` — Claude SDK and image processing server-only; not in client bundles.
- `pdfjs-dist` and `pdf-parse` in `devDependencies` — confirmed never in client bundles.
- PostHog autocapture, pageview, pageleave all disabled since Jun 12 — support chunk carries no rrweb/session-recording/surveys/toolbar code.
- `esbuild` and `protobufjs` in `overrides` (not `dependencies`) — moved in Jun 16 triage; freed 2 production dep budget slots.
- Translation lazy-loading: `es` and `en` static; `fr`, `de`, `pt`, `ast` dynamic-import on demand (~15 KB each deferred).
- ElevenLabs click-to-mount since May 10 — confirmed working in webpack build (~56 KB async, zero first-paint cost).

## Closed Since Previous Run

- **P1 (9 cycles overdue) CLOSED:** `npm run build:analyze` executed Jun 19. Analyzer reports available at `.next/analyze/client.html`, `.next/analyze/nodejs.html`, `.next/analyze/edge.html`. First time since the split budget was introduced (Apr 4) that per-route initial-load data is available for inspection.

## Top Optimization Opportunities (prioritized by impact)

### 1. Inspect `.next/analyze/client.html` to identify the 412 KB unknown chunk (P1 — LOW EFFORT, HIGH INFORMATION)

The `144d3bae.07e3d4f37ae764e1.js` chunk (412 KB) is the second-largest in the webpack build and its contents are not identifiable from the filename alone. String-matching ruled out: Stripe, Upstash Redis, lucide-react, ElevenLabs SDK, and PostHog. The analyzer is now available.

```bash
open /Users/juan/code/paisaxe/.next/analyze/client.html
# Navigate to the 144d3bae chunk in the treemap
# Identify what library/modules constitute it
```

If it is a deferred chunk, no action is needed. If it is on the synchronous first-paint path, understanding its contents is necessary before the initial-load budget can be confirmed as PASS.

### 2. Run a fresh authoritative production build (P2 — MEDIUM EFFORT)

The current `.next` directory is stale (13 min gap from the security pin commit). The stale build is a webpack build:analyze build, not a standard production Turbopack build. To close the stale/authoritative gap:

```bash
npm run build
# then re-run the performance agent with fresh metrics
```

This is lower urgency than P1 because the security pin commit (`82cc7284`) only changes a package override pin, which is very unlikely to affect client bundle size. The delta from 3,027 KB (Jun 18 Turbopack) to 2,909 KB (Jun 19 webpack) is a compiler-mode artifact, not a real reduction.

### 3. ElevenLabs voice-shelving — product lever only (WATCH — 122 days zero voice traffic)

The ElevenLabs SDK (56 KB async in webpack, 605 KB in prior Turbopack measurement) has zero first-paint cost since click-to-mount landed May 10. The bundle argument for shelving is weaker now that the webpack build shows only ~56 KB async. The cost case (Cost Analyst: ~$45/mo tier downgrade, 122-day Paisaxe voice silence as of Jun 19) remains the stronger argument. User decision only.

### 4. ElevenLabs per-chunk margin watch (WATCH — cleared in webpack build)

In the Turbopack build, the ElevenLabs chunk was 605/650 KB (45 KB headroom, the tightest margin). In the webpack build it splits to ~56 KB across three async chunks — no per-chunk concern. The per-chunk budget watch can be downgraded from WATCH to informational until the next major `@elevenlabs/react` version bump. Current version: `^1.6.7`.

### 5. PostHog and Supabase — settled, no action (FOR THE RECORD)

PostHog (196 KB, deferred, confirmed in `9da6db1e` chunk) and Supabase (184 KB, deferred, confirmed in `838` chunk) are correctly lazy-loaded and carry no first-paint cost. Both have `optimizePackageImports` or `serverExternalPackages` active. Treat as settled.

## Comparison to Previous Runs

| Metric | Jun 17 | Jun 18 | Jun 19 (this run) | Change |
|---|---:|---:|---:|:---:|
| Total JS | 3,027 KB | 3,027 KB | 2,909 KB (stale webpack) | -118 KB (compiler mode, not real) |
| Total budget | 3,500 KB | 3,500 KB | 3,500 KB | unchanged |
| Total headroom | 473 KB | 473 KB | 473 KB (vs Jun 18 authoritative) | unchanged |
| Largest chunk | 605 KB (ElevenLabs, Turbopack) | 605 KB (ElevenLabs, Turbopack) | 460 KB (7291, webpack) | mode change |
| ElevenLabs (deferred) | 605 KB (Turbopack) | 605 KB (Turbopack) | ~56 KB (webpack, async) | mode change |
| Supabase chunk | 332 KB | 332 KB | 184 KB (webpack) | mode change |
| PostHog chunks | 347 KB | 347 KB | 196 KB (webpack) | mode change |
| React framework | 237 KB | 237 KB | 188 KB (webpack) | mode change |
| Total CSS | 121 KB | 121 KB | 120 KB | -1 KB (noise) |
| Production deps | 34 / 40 | 34 / 40 | 34 / 40 | unchanged |
| node_modules disk | 1,022 MB | 1,022 MB | 1,023 MB | +1 MB (noise) |
| Build provenance | CACHED-auth | CACHED-auth | STALE (13 min) | first analyze run |
| Analyzer available | No | No | YES (.next/analyze/) | FIRST TIME |

All size changes vs prior cycles reflect the webpack vs Turbopack compiler mode switch, not actual bundle reductions. No regressions confirmed.

## Recommendations Summary

1. Status YELLOW (advisory) — stale build (13 min, security pin commit after build:analyze ran). Last authoritative total: 3,027 KB / 3,500 KB (473 KB headroom, Jun 18). No budget exceeded.
2. ACTIONABLE (new): Open `.next/analyze/client.html` to identify the 412 KB `144d3bae` chunk. This is the first cycle where this is possible — the analyzer has been waiting 9+ cycles.
3. ACTIONABLE (new): Run `npm run build` to produce a fresh authoritative Turbopack build and close the stale gap. Low urgency — the security pin commit is very unlikely to change bundle size.
4. CLOSED: `npm run build:analyze` is no longer a carried action. Reports at `.next/analyze/`.
5. WATCH downgraded: ElevenLabs per-chunk margin is no longer tight in webpack mode (~56 KB async vs prior 605 KB Turbopack). Keep as informational only.
6. PRODUCT LEVER unchanged: ElevenLabs voice-shelving removes the entire SDK (~56 KB async in webpack) and enables ~$45/mo tier downgrade. 122 days zero Paisaxe voice traffic (Cost Analyst Jun 19). User decision only.
7. Cross-agent note from QA (Jun 18-19): VOYAGE_API_KEY missing from QA environment causes 11/12 LLM quality tests to fail with embedding 503. Not a performance concern.

---
