# Performance Agent Report — 2026-08-24

## Summary

Status: **YELLOW**. Every enforced budget still passes, but the total-JS ceiling now has the thinnest margin on record, and the underlying cause is diffuse (dependency-version drift across five weeks of batches) rather than one fixable regression.

- **Per-route gzip budgets (authoritative, `check-bundle-budget.ts` / PE-H3):** all 84 routes pass. This measures exactly what a browser downloads per route, gzip-summed from the real Turbopack build's prerendered HTML — the strongest signal available.
- **Raw total JS across all chunks:** 3,214 KB vs a 3,500 KB budget = **91.8% utilized**, the highest on record (previous high: 87.7% on Jul 17). Only **286 KB** of headroom remains on this metric.
- **Build provenance:** fresh, verified production build (`BUILD_ID` + `static/chunks` present, postdates last source commit). This run's numbers are authoritative.
- No new production dependency was added (34 → 34). The +143 KB / +4.7% growth since Jul 17 is attributable to ~15 minor/patch dependency bumps landed across multiple triage cycles (Sentry, posthog-js, `@elevenlabs/react`, `@supabase/supabase-js`, Stripe, lucide-react), not a single new import.

## Key Metrics

| Metric | Value | Budget | Status |
|---|---|---|---|
| Total JS (raw, all chunks) | 3,214 KB | 3,500 KB | Pass (91.8%) |
| Total CSS | 135 KB | — | Pass |
| Production dependencies | 34 | 40 | Pass (85%) |
| `/admin` (gzip, per-route) | 320.6 KB | 377.9 KB | Pass (84.8%) |
| `/immersive` (gzip, per-route) | 279.3 KB | 342.8 KB | Pass (81.5%) |
| `/favorites` (gzip, per-route) | 260.4 KB | 300.8 KB | Pass (86.6%) |
| `/pricing/checkout` (gzip, per-route) | 246.5 KB | 283.2 KB | Pass (87.0%) |
| Story detail pages (68 routes, gzip) | 243.6 KB | 274.4 KB | Pass (88.8%) — tightest margin, most routes affected |
| `/`, `/coming-soon`, `/_not-found` (gzip) | 233.3 KB | 274.4 KB | Pass (85.0%) |
| `node_modules` | 1,033 MB | — | Informational |
| `.next` | 292 MB | — | Informational |

`npm run check-bundle-budget` output in full: **"All 84 routes within budget."**

## Budget Status

Nothing is exceeded. Two different metrics are tracked here and they're telling different stories, which is itself worth flagging:

1. **Per-route gzip budgets** (what a visitor actually downloads) — comfortable, 11–19% headroom everywhere, tightest on the 68 story-detail pages at 88.8%.
2. **Raw total-JS budget** (sum of every `.js` file in `.next/static/chunks`, uncompressed, including chunks never loaded together by any single route — e.g. the deferred ElevenLabs and Sentry chunks) — at 91.8%, with only 286 KB of headroom before the 3,500 KB ceiling.

Metric (2) is the one actually at risk of tripping, and it's the coarser, less meaningful of the two: it sums chunks regardless of whether any route ever loads them together. It was set as a budget on 2026-04-04 before the per-route gzip checker (PE-H3) existed. Recommend treating breaches of it as a prompt to re-run `check-bundle-budget` rather than as a real regression signal on its own — see P1 below.

## Top Optimization Opportunities

### P1 (process, not code) — Reconcile the total-JS budget with the per-route gzip budget before it false-alarms

The raw total-JS metric is 8.2% away from its ceiling and has been climbing steadily (87.7% → 88.7% → 91.8% since Jul 17) purely from dependency patch/minor bumps, while every real user-facing route is comfortably under budget by the more accurate gzip measure. At the current drift rate (~+150 KB per 5-6 week dependency-batch cycle), the raw ceiling could trip within 1-2 more batch cycles even though no route would actually be close to its own budget. When that happens, the fix is `check-bundle-budget` (confirm no route regressed), not urgent code work. Recommend either raising the raw-total budget to match current baseline + headroom, or retiring it in favor of `check-bundle-budget` as the sole gate, so a future false-positive doesn't trigger unnecessary optimization work.

### P2 — Identify what's driving the story-detail template's tighter margin (informational, no regression)

The 68 story-detail routes (`/story/*`) sit at 88.8% of their per-route gzip budget (243.6 / 274.4 KB) — the tightest margin of any route class, and by far the largest number of routes sharing it. This isn't a regression (all passing), but it's the one place where a future +5% chunk change is most likely to cross a line, and because it's shared across 68 pages, any fix there has outsized leverage. No action needed now; flagging so the next agent that touches `src/components/immersive/story-viewer.tsx` or its 16 shared chunks checks `check-bundle-budget` before merging.

### P3 (informational) — Total JS growth is diffuse dependency drift, not one culprit

Cross-referencing chunk byte sizes against the Jul 16/17 report's confirmed chunk-to-source mapping (Turbopack doesn't label chunks by source module, so identity is inferred by size continuity, not certain):

| Likely contents | Jul 17 size | Aug 24 size | Delta |
|---|---|---|---|
| ElevenLabs SDK (deferred, click-to-mount) | 605,634 B | ~586,584 B | -19 KB |
| Supabase client | 316,908 B | ~342,407 B | +25 KB |
| PostHog + Sentry | 260,405 B | ~286,509 B | +26 KB |
| react-dom (framework runtime) | 237,129 B | ~238,815 B | +2 KB |
| polyfill (`nomodule`-gated, zero cost to modern browsers) | 112,594 B | 112,594 B | 0 (identical) |

These four tracked chunks net to roughly +34 KB; the remaining ~109 KB of the +143 KB total growth is spread across smaller, previously-unlisted chunks (a Next.js framework-runtime chunk at 175,811 B now appears in `rootMainFiles` alongside the 238,815 B one, per `build-manifest.json` — this pairing wasn't broken out in the Jul 17 table). None of this indicates a new heavy import; `optimizePackageImports` for `lucide-react` and `posthog-js` is confirmed still active (`next.config.ts:19`), `pdfjs-dist`/`pdf-parse` remain devDependencies-only (can't leak into the client bundle), and the Sentry client SDK is still dynamically imported and fully dead-code-eliminated when no DSN is set (`src/lib/sentry-client-init.ts`, #818) — no session-replay integration is configured, so there's no easy Sentry-side win either. **No action recommended** beyond the P1 budget reconciliation.

### Closed items (confirmed still holding, no regression)

- ElevenLabs SDK remains fully deferred — the ~586 KB chunk does not appear in any route's initial HTML (click-to-mount landed 2026-05-10).
- `pdfjs-dist` and `pdf-parse` remain in `devDependencies` — verified via `package.json:132-134` — cannot leak into client bundles.
- `optimizePackageImports: ["lucide-react", "posthog-js"]` confirmed active in `next.config.ts:19`.
- The 112.6 KB polyfill chunk (`0cz1d0mv5g_q7.js`) is byte-identical to the Jul 17 build and remains `nomodule`-gated — zero cost to any browser in the target list (`last 2 Chrome/Firefox/Safari/Edge versions`). No further action; this was correctly closed in the Jul 17 report and stays closed.

## Comparison to Previous Run (2026-07-17)

| Metric | Jul 17 | Aug 24 | Change |
|---|---|---|---|
| Total JS (raw) | 3,071 KB | 3,214 KB | +143 KB (+4.7%) |
| Total JS budget utilization | 87.7% | 91.8% | +4.1pp |
| Total CSS | 135 KB | 135 KB | 0 |
| Production dependencies | 34 | 34 | 0 |
| `node_modules` | 1,036 MB | 1,033 MB | -3 MB |

Note on history continuity: `.performance-history.json` has no entries between 2026-07-17 and today — a 38-day gap despite the harness fix landing 2026-07-18 per that cycle's triage summary. This run's fresh, verified build should re-populate the series going forward; if the next cycle's entry is also missing, the harness needs another look (out of scope for this run — the metrics handed to this agent were valid and fresh, so the collection step itself worked today).
