# Performance Agent Report — 2026-06-18

## Summary

Status: GREEN, authoritative. Build provenance is CACHED-authoritative: `.next` mtime (2026-06-18 08:02:08) postdates the last source/dep commit (`23e83038`, 2026-06-17 10:53:28 — "chore(deps): bump the production group across 1 directory with 13 updates (#643)"), so the on-disk bundle reflects the current source tree exactly.

Total JS is **3,027 KB** — identical to Jun 17. The 13-package production dep bump (#643 merged Jun 17) was entirely bundle-neutral: all updated packages are either server-only, deferred-chunk residents with no size change, or lockfile-level pin resolutions. No budget changes this cycle.

The overall picture is stable. Three heavy vendor chunks — ElevenLabs (605 KB), Supabase (332 KB), PostHog (347 KB across two chunks) — remain off the synchronous first-paint path (deferred or click-to-mount). Together they represent ~1,284 KB, roughly 42% of total weight, that never loads on first paint. First paint is dominated by the ~532 KB framework shell (React + Next.js App Router runtime).

One engineering action remains open: **`npm run build:analyze`** for authoritative per-route initial-load budget measurement. Now 9 cycles deferred. One product lever remains open: ElevenLabs voice-shelving (605 KB reduction, ~$45/mo tier downgrade, 121 days zero voice traffic per Cost Analyst Jun 18).

## Key Metrics

| Signal | Value | Authoritative? | Status |
|---|---:|:---:|:---:|
| Total JS | 3,027 KB | Yes (CACHED-authoritative) | PASS — 473 KB under 3,500 KB budget |
| Initial JS (split budget half) | est. ~700-900 KB first load | Estimate (no webpack manifest) | PASS — heaviest vendors deferred |
| Largest chunk (ElevenLabs) | 605 KB | Yes | PASS — 45 KB under 650 KB per-chunk budget |
| Total CSS | 121 KB | Yes | Healthy (no hard budget) |
| Production deps | 34 / 40 | Yes | PASS — 6 headroom |
| Dev deps | 30 | Yes | Informational |
| node_modules disk | 1,022 MB | Yes | GREEN (flat) |
| .next disk | 358 MB | Yes | Informational (cache, not shipped) |

Note on Initial JS: the build uses Turbopack. The webpack-style `app-build-manifest.json` with per-route first-load totals is absent from cached artifacts, so the precise initial-load number cannot be confirmed without a `npm run build:analyze` (webpack) run. The three heaviest vendor chunks are confirmed deferred, putting realistic per-page first load around 700-900 KB — comfortably under the 2,100 KB initial budget half.

## Budget Status

| Budget | Limit | Current | Delta vs Jun 17 | Status |
|---|---:|---:|---:|:---:|
| Total JS | 3,500 KB | 3,027 KB | 0 KB | PASS — 473 KB headroom |
| Initial JS | 2,100 KB | est. ~700-900 KB | — | PASS — heaviest vendors deferred |
| Per-chunk | 650 KB | 605 KB max (ElevenLabs) | 0 KB | PASS — 45 KB headroom (tightest) |
| Production deps | 40 | 34 | 0 | PASS — 6 headroom |
| node_modules disk | (soft) | 1,022 MB | 0 MB | GREEN |
| Total CSS | (no hard budget) | 121 KB | 0 KB | Healthy |

No budgets exceeded.

## Largest Chunks Analysis

| Size (bytes) | Chunk | Contents (inferred) | Loading | Notes |
|---:|---|---|---|---|
| 605,485 | `3ok4a8oup1rkk.js` | ElevenLabs SDK (`elevenlabs`/`convai`) | Deferred — click-to-mount | Unchanged; 45 KB headroom vs 650 KB per-chunk budget |
| 331,828 | `0ccjtfdj3941f.js` | Supabase client (`GoTrueClient`) | Deferred — lazy import() in auth-provider | Unchanged from Jun 17 |
| 237,297 | `0273rfe8p5u4v.js` | React + Next framework vendor (`react-dom`/`scheduler`) | First paint (required) | Unchanged |
| 229,170 | `0x97hp5pq2jca.js` | PostHog core (`posthog`) | Deferred — post-hydration, prod-only | Unchanged from Jun 17 |
| 148,880 | `3c-18qv58e7zi.js` | Next.js App Router client runtime | First paint (required framework) | Unchanged |
| 117,617 | `2f1alz9dhg520.js` | PostHog support chunk | Deferred | Unchanged |
| 112,594 | `0cz1d0mv5g_q7.js` | Shared app chunk | First paint | Unchanged |
| 76,897 | `3uwi2y7pkzyjg.js` | Shared runtime | First paint | Unchanged |
| 67,763 | `14q503fs3fh64.js` | Route chunk | Per-route | Unchanged |
| 56,058 | `3e64rfhwmn64h.js` | Route chunk | Per-route | Unchanged |

All chunk hashes are identical to Jun 17 — the 13-package dep bump (#643) produced zero client-side size delta. The bump included @anthropic-ai/sdk, @supabase/supabase-js, @sentry/nextjs/@sentry/core, and other production packages that are either server-external (`serverExternalPackages`) or already represented in the deferred chunks above with no change.

Deferred / lazy weight: ElevenLabs 605 + Supabase 332 + PostHog 347 = ~1,284 KB — about 42% of total weight never loads on synchronous first paint.

## Optimizations Active (for the record)

- `optimizePackageImports` active for `lucide-react` and `posthog-js` (next.config.ts:19) — confirmed via prior cycles, no change.
- `serverExternalPackages: ["@anthropic-ai/sdk", "sharp"]` — Claude SDK and image processing are server-only, never in client bundles.
- `pdfjs-dist` and `pdf-parse` in `devDependencies` — cannot leak into client bundles.
- PostHog autocapture, pageview, and pageleave all disabled since Jun 12 triage — support chunk carries no rrweb/session-recording/surveys/toolbar code.
- `esbuild` and `protobufjs` in `overrides` (not `dependencies`) — both moved to overrides in Jun 16 triage, freeing 2 production dep budget slots.
- Translation lazy-loading: `es` and `en` static; `fr`, `de`, `pt`, `ast` dynamic-import on demand (~15 KB each deferred).

## Closed Since Previous Run

Nothing closed this cycle — no bundle-affecting changes landed. The Jun 17 dep batch (#643, 13 production packages) confirmed bundle-neutral by the unchanged chunk inventory above. The Security agent independently confirmed 0 advisories on Jun 17 and Jun 18.

## Top Optimization Opportunities (prioritized by impact)

### 1. Run `build:analyze` for authoritative initial-load budget measurement (LOW EFFORT — 9 CYCLES OVERDUE)

The split budget (initial 2,100 KB / total 3,500 KB, since 2026-04-04) has an authoritative total-half check (3,027 KB, 473 KB headroom) but no authoritative initial-half number. The Turbopack cached build does not produce `app-build-manifest.json` with per-route first-load breakdowns. A single `npm run build:analyze` (webpack flag) produces:

- Authoritative per-route first-load JS totals
- Webpack bundle tree for visual chunk composition inspection
- Confirmation that all dep-pin cleanups and dep bumps are bundle-neutral (expected: ~0 delta)

```bash
npm run build:analyze
# Opens .next/analyze/client.html and server.html
# Produces per-route first-load numbers matching Vercel's build output
```

This is the only outstanding engineering-side action with a concrete path to run. Pair it with any future dep batch to amortize the build time.

### 2. ElevenLabs voice-shelving — 605 KB, product lever only (HIGHEST RAW IMPACT, NON-ENGINEERING)

The single largest chunk (605 KB) is already deferred to click-to-mount, so it has zero first-paint cost. It is also the tightest per-chunk margin: 605 / 650 KB, only 45 KB headroom. Cost Analyst (Jun 18) reports 121 days of zero Paisaxe voice traffic; the product case for shelving voice has been flagged for multiple consecutive cycles.

If voice is shelved:
- Total JS drops from 3,027 KB to approximately 2,420 KB
- The per-chunk margin concern disappears entirely
- Total budget can be re-lowered to ~3,100 KB to match actual footprint
- ~$45/mo ElevenLabs tier downgrade becomes available

This is a user/product decision. No agent action until the decision is made.

### 3. ElevenLabs per-chunk headroom watch (WATCH — no action yet)

The 605 / 650 KB per-chunk margin is the tightest budget. Any `@elevenlabs/react` bump beyond patch level must include a fresh-build measurement before merge. The current version in package.json is `^1.6.7`. A feature minor (e.g., 1.6.x → 1.7.x) that adds SDK capabilities could plausibly consume the remaining 45 KB. Security (Jun 18) reports GREEN with 0 advisories — no forced ElevenLabs bump this cycle. Measure before committing to any ElevenLabs minor or major upgrade.

### 4. PostHog — already optimal, no further lever (FOR THE RECORD, NO ACTION)

PostHog (347 KB across two chunks) is (a) lazy-loaded via dynamic `import()` after hydration, (b) production-only, (c) minimally configured — autocapture, pageview, and pageleave all disabled since Jun 12. The support chunk contains no rrweb / session-recording / surveys / web-vitals / toolbar signatures. `optimizePackageImports` active for tree-shaking. Treat as settled unless a significant posthog-js major ships new default-enabled features.

## Comparison to Previous Runs

| Metric | Jun 16 | Jun 17 | Jun 18 (this run) | Change (cycle) |
|---|---:|---:|---:|:---:|
| Total JS | 3,024 KB | 3,027 KB | 3,027 KB | 0 KB (stable) |
| Total budget | 3,500 KB | 3,500 KB | 3,500 KB | unchanged |
| Total headroom | 476 KB | 473 KB | 473 KB | unchanged |
| ElevenLabs chunk | 605 KB | 605 KB | 605 KB | unchanged (deferred) |
| Supabase chunk | 331 KB | 332 KB | 332 KB | unchanged |
| PostHog chunks | 346 KB | 347 KB | 347 KB | unchanged |
| React framework | 237 KB | 237 KB | 237 KB | unchanged |
| Total CSS | 122 KB | 121 KB | 121 KB | unchanged |
| Production deps | 36 / 40 | 34 / 40 | 34 / 40 | unchanged |
| node_modules disk | 1,017 MB | 1,022 MB | 1,022 MB | unchanged |
| Build provenance | CACHED-authoritative | CACHED-authoritative | CACHED-authoritative | — |

No regressions. No improvements. The bundle is stable at 3,027 KB for two consecutive cycles, confirming the Jun 17 13-package dep batch was entirely bundle-neutral.

## Recommendations Summary

1. Status GREEN, authoritative: 3,027 KB / 3,500 KB (473 KB headroom). 0 KB change from Jun 17 — 13-package dep batch confirmed bundle-neutral.
2. ACTIONABLE (carried, ~9 cycles): run `npm run build:analyze` once to obtain authoritative per-route initial-load totals and verify the initial-half budget (2,100 KB). This is the only outstanding engineering action.
3. WATCH: ElevenLabs per-chunk margin is 45 KB (605/650 KB). Any `@elevenlabs/react` minor or major bump must measure before merge. Current version is `^1.6.7`.
4. PRODUCT LEVER: ElevenLabs voice-shelving removes 605 KB, clears the per-chunk watch, and enables ~$45/mo tier downgrade. 121 days zero Paisaxe voice traffic per Cost Analyst Jun 18. User decision only.
5. PostHog (347 KB, two chunks), Supabase (332 KB), and ElevenLabs (605 KB, click-to-mount) are all correctly deferred. No further structural lever on any of them.
6. Cross-agent note from QA (Jun 18): LLM quality tests now reach the server (port fix confirmed) but fail at the Voyage AI embedding stage (503, VOYAGE_API_KEY missing in QA env). Not a performance concern — no bundle changes involved.

---
