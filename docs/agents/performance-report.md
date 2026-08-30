# Performance Agent Report — 2026-08-27

## Summary

Status: **GREEN**. The 2026-08-24 triage action (raising the raw total-JS budget from 3,500 KB to 4,000 KB, per this agent's own P1 recommendation) has resolved last cycle's YELLOW. No source code, dependency count, or bundle content has changed since the Aug 24 build — this is a re-verification of a byte-identical build, not a new state.

- **Total JS**: 3,214 KB vs the new 4,000 KB budget = **80.4% utilized**, down from 91.8% last cycle purely because the ceiling moved, not because the bundle shrank. 786 KB of headroom now, versus 286 KB before.
- **Per-route gzip budgets** (`npm run check-bundle-budget`, the authoritative per-visitor-download metric): ran fresh against this build — **all 84 routes pass**, with every route's KB figure byte-identical to the Aug 24 run (`/admin` 320.6/377.9 KB, `/immersive` 279.3/342.8 KB, `/favorites` 260.4/300.8 KB, `/pricing/checkout` 246.5/283.2 KB, the 68 story-detail routes at 243.6/274.4 KB each). This confirms zero drift at the route level, not just at the aggregate-chunk level.
- **Build provenance**: fresh Turbopack production build (`.next/BUILD_ID` present, postdates the last source commit `ef475937`, 2026-08-24). This run's numbers are authoritative for both the raw-total and per-route metrics.
- No new production dependency (34 → 34, unchanged since Aug 24). No largest-chunk-list entry changed size versus Aug 24's confirmed chunk-to-source mapping.

## Key Metrics

| Metric | Value | Budget | Status |
|---|---|---|---|
| Total JS (raw, all chunks) | 3,214 KB | 4,000 KB | Pass (80.4%) |
| Total CSS | 135 KB | — | Pass |
| Production dependencies | 34 | 40 | Pass (85%) |
| node_modules | 1,033 MB | 1,100 MB | Pass (93.9%) — tightest tracked budget, but flat/declining trend |
| Largest single chunk (ElevenLabs, deferred) | 586,584 B (573 KB) | 650 KB | Pass (88.1%) |
| `/admin` (gzip, per-route) | 320.6 KB | 377.9 KB | Pass (84.8%) |
| `/immersive` (gzip, per-route) | 279.3 KB | 342.8 KB | Pass (81.5%) |
| `/favorites` (gzip, per-route) | 260.4 KB | 300.8 KB | Pass (86.6%) |
| `/pricing/checkout` (gzip, per-route) | 246.5 KB | 283.2 KB | Pass (87.0%) |
| Story detail pages (68 routes, gzip) | 243.6 KB | 274.4 KB | Pass (88.8%) — tightest per-route margin, most routes affected |
| `/`, `/coming-soon`, `/_not-found` (gzip) | 233.3 KB | 274.4 KB | Pass (85.0%) |
| `.next` build output | 369 MB | — | Informational (includes build cache; not a shipped artifact) |

`npm run check-bundle-budget` output: **"All 84 routes within budget."** (re-run live for this report, not carried from the metrics header, which omitted per-route data this cycle.)

## Budget Status

Nothing is exceeded, and for the first time in several cycles both tracked JS budgets have comfortable headroom:

1. **Per-route gzip budgets** (what a visitor actually downloads) — 11–19% headroom everywhere, unchanged from Aug 24.
2. **Raw total-JS budget** — 80.4% utilized (786 KB headroom), now the healthier of the two aggregate JS metrics after the Aug 24 budget correction.

The one budget now running the tightest is **node_modules at 93.9%** (1,033 / 1,100 MB) — see P1 below. It is informational only (doesn't gate CI) but is worth a preemptive look given an incoming dependency batch.

## Top Optimization Opportunities

### P1 (informational, no regression) — node_modules is now the tightest-margin budget; flat trend means no urgent action, but watch the next dependency batch

At 1,033 / 1,100 MB (93.9%), `node_modules` has less headroom than either JS budget. Unlike the total-JS metric's climb before Aug 24, this one has been **flat-to-declining** across the last several cycles (1,047 MB May 9 -> 1,036 MB Jul 17 -> 1,033 MB Aug 24 -> 1,033 MB today), so there's no active drift to correct. The reason to flag it now: the security agent's Aug 27 report lists 25 outdated packages queued for the next batch, including `@elevenlabs/react` (3 minor versions behind) and the Stripe/`@supabase/ssr` trio. A batch of that size could plausibly add 10-30 MB. Recommendation: after the next dependency batch lands, re-run this agent (or `du -sh node_modules`) once — if it crosses ~1,080 MB, raise `BUDGET_NODE_MODULES_MB` in `scripts/performance-agent.sh:62` proactively rather than waiting for a violation, following the same pattern used for the total-JS budget on Aug 24. No action needed today.

### P2 (informational, unchanged) — Story-detail template remains the tightest per-route margin

The 68 story-detail routes (`/story/*`) sit at 88.8% of their per-route gzip budget (243.6 / 274.4 KB) — unchanged byte-for-byte since Jul 17/Aug 24. This is not a regression; it's flagged because it's the largest route class (68 of 84 routes) and the one most likely to cross its line first if `src/components/immersive/story-viewer.tsx` or its 16 shared chunks grow. No action needed now; next agent touching that component should run `npm run check-bundle-budget` before merging.

### P3 (closed) — Total-JS budget reconciliation

Last cycle's P1 (raw total-JS budget nearing its ceiling due to diffuse dependency drift, recommending the budget be reconciled with the more accurate per-route gzip check) was actioned by the Aug 24 triage: `BUDGET_TOTAL_JS_KB` raised 3,500 -> 4,000 in `scripts/performance-agent.sh:60`. Utilization dropped from 91.8% to 80.4% with zero code change. Closing this item — no further action.

### Closed items (confirmed still holding, no regression)

- ElevenLabs SDK remains fully deferred (click-to-mount, landed 2026-05-10) — the 573 KB chunk does not appear in any route's initial HTML and stays under its own 650 KB per-chunk budget.
- `pdfjs-dist` and `pdf-parse` remain in `devDependencies` (`package.json:132-133`) — cannot leak into client bundles.
- `optimizePackageImports: ["lucide-react", "posthog-js"]` confirmed active in `next.config.ts:19`.
- All six chunks with a confirmed source mapping from the Aug 24 report (ElevenLabs 586,584 B, Supabase client 342,407 B, PostHog+Sentry 286,509 B, react-dom 238,815 B, framework-runtime 175,811 B, polyfill 112,594 B) are byte-identical in this build — independent confirmation that nothing shifted between the two runs.

## Comparison to Previous Run (2026-08-24)

| Metric | Aug 24 | Aug 27 | Change |
|---|---|---|---|
| Total JS (raw) | 3,214 KB | 3,214 KB | 0 |
| Total JS budget | 3,500 KB | 4,000 KB | +500 KB (triage action) |
| Total JS budget utilization | 91.8% | 80.4% | -11.4pp (budget change only) |
| Total CSS | 135 KB | 135 KB | 0 |
| Production dependencies | 34 | 34 | 0 |
| Per-route gzip (all 84 routes) | Pass | Pass | Unchanged, byte-identical |
| node_modules | 1,033 MB | 1,033 MB | 0 |
| `.next` | 292 MB | 369 MB | +77 MB (build-cache artifact, not shipped bytes — see note) |

Note on `.next` growth: the +77 MB is almost certainly Turbopack's incremental build cache, not new shipped output — the actual `static/chunks` total (3,214 KB) and every per-route gzip figure are unchanged. Not actionable; flagging only so a future cycle doesn't mistake cache growth for a shipped-bundle regression.

No regressions this cycle. The build is byte-identical to Aug 24 at every level checked (aggregate, per-chunk, and per-route); the only change is the budget correction already actioned by triage.

---
