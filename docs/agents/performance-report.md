# Performance Agent Report — 2026-09-24

## Summary

Status: **YELLOW**. Total JS is comfortably within budget, but the largest single chunk (ElevenLabs SDK, 733 KB) remains over its own 650 KB per-chunk budget for a second consecutive fresh-build cycle, and grew further this cycle. The scripted per-chunk check recommended in the Sep 3 report (`largest_chunk_budget_violation` in `scripts/performance-agent.sh:186`) is now wired up and correctly firing — confirmed in this run's raw output (`BUDGET VIOLATIONS: - Largest chunk (734 KB) exceeds budget (650 KB)`).

- **Total JS**: 3,463 KB vs 4,000 KB budget = **86.6% utilized** (up from 84.8% on Sep 3 — +69 KB, +2.0%).
- **No fresh performance report was produced between Sep 3 and today** — this is the first fresh build to capture the Sep 14 dependency batch (`de05c03d`, "bump the production group across 1 directory with 25 updates", #964), so this comparison spans three weeks and one full prod-dependency batch, not one cycle.
- **Root cause of growth, isolated by chunk-content grep against the Sep 14 batch diff**: the Sentry+PostHog chunk grew 310,032 B → 347,973 B (**+37,941 B, +12.2%**), driven by `posthog-js` `1.422.5 → 1.430.2` (8 minor releases) and `@sentry/core`/`@sentry/nextjs` `10.71.0 → 10.74.0`. The Supabase+resend chunk grew 343,150 B → 352,621 B (+9,471 B, +2.8%) from `@supabase/ssr` `0.12.5 → 0.12.7`. The ElevenLabs chunk grew only 746,426 B → 750,835 B (+4,409 B, +0.6%) — `@elevenlabs/react` moved just `1.15.0 → 1.15.2` (patch-only) this time, unlike the Aug→Sep cycle's 27% jump. Combined, these three chunks account for ~52 KB of the 69 KB total growth; the remainder is spread across smaller route/vendor chunks from the other ~20 packages in the same batch (`next` 16.3.3→16.3.4, `react`/`react-dom` 19.2.8→19.3.0, `lucide-react` 1.35.0→1.44.0, `stripe`/`@stripe/react-stripe-js`, `@anthropic-ai/sdk`, `zod`, `resend`, `@upstash/redis`).
- **Build provenance**: fresh build, `.next` postdates the last package.json-touching commit (`ce26513f`, 2026-09-14). Numbers are authoritative.
- Production dependencies: 34/40 (unchanged). node_modules: 1,051 MB / 1,100 MB budget (95.5%) — up from 93.4% on Sep 3, the tightest this metric has been; worth watching if another large batch lands before the next report.
- `FIRST LOAD JS (per-route split)` was not emitted by this build — same gap as prior cycles. The `2,100 KB` initial-load-only budget cannot be verified this cycle; only the `4,000 KB` total-JS (all chunks including deferred) budget is checked.

## Key Metrics

| Metric | Value | Budget | Status |
|---|---|---|---|
| Total JS (raw, all chunks) | 3,463 KB | 4,000 KB | Pass (86.6%) |
| Total CSS | 135 KB | — | Pass, unchanged |
| **Largest single chunk (ElevenLabs, deferred)** | **750,835 B (733 KB)** | **650 KB** | **FAIL (112.8%, +83 KB over)** — 2nd consecutive violating cycle |
| Production dependencies | 34 | 40 | Pass (85%) |
| node_modules | 1,051 MB | 1,100 MB | Pass, but tightest yet (95.5%) |
| Sentry+PostHog chunk | 347,973 B (340 KB) | — | +37,941 B (+12.2%) vs Sep 3 |
| Supabase+resend chunk | 352,621 B (344 KB) | — | +9,471 B (+2.8%) vs Sep 3 |
| react-dom chunk | 238,815 B (233 KB) | — | Byte-identical to Sep 3 (React version bump did not touch this chunk's size) |
| framework-runtime chunk | 175,652 B (172 KB) | — | Byte-identical to Sep 3 |
| polyfill chunk | 112,594 B (110 KB) | — | Byte-identical to Sep 3 |

Chunk-to-source mapping was independently verified this cycle by grepping each of the top chunk files for library-identifying strings (`elevenlabs`, `sentry`, `posthog`, `supabase`, `stripe`, `voyage`, `resend`, `react-dom`) against `.next/static/chunks/`, then cross-referencing occurrence counts with the actual `git show de05c03d -- package.json` diff — not carried forward from memory.

## Budget Status

1. **Total JS budget (4,000 KB)** — Pass, 86.6% utilized. Headroom shrank from 606 KB to 537 KB this cycle.
2. **Production deps (40)** — Pass, unchanged at 34.
3. **node_modules (1,100 MB)** — Pass, but now 95.5% utilized (49 MB headroom), the tightest recorded. `@sentry/nextjs` alone is a documented 67 MB permanent floor (`scripts/performance-agent.sh:63`); little room remains before this budget needs raising or a devDependency/prod trim.
4. **Largest single chunk (650 KB)** — **FAIL**, confirmed by the now-working scripted check. The ElevenLabs chunk is 733 KB, 83 KB (12.8%) over. This is the second fresh-build cycle in a row this budget has failed (Sep 3: +79 KB over; today: +83 KB over) — it has not regressed further from a new version bump this cycle (ElevenLabs itself only grew 4.4 KB), but it also has not been remediated.

## Top Optimization Opportunities

### P1 (Standing violation, unresolved for 2 cycles) — ElevenLabs chunk still 83 KB over its 650 KB budget

Unlike the Aug→Sep cycle, this cycle's growth is *not* from `@elevenlabs/react` (only +4.4 KB, a patch bump). The chunk has simply never been brought back under budget since the 1.13.0→1.15.0 jump in early September. Per the Sep 3 and subsequent triage/cost-analyst reports, this chunk is fully deferred/click-to-mount and serves zero users while ElevenLabs voice traffic remains silent — so it has no first-load impact — but the budget itself is still failing every scripted run, which is noise if left unaddressed indefinitely.

Recommended actions, in order:
1. Run `npm run build:analyze` scoped to the ElevenLabs chunk to confirm nothing new was pulled in versus the May 2026 baseline (605 KB) — three months of accumulated patch/minor bumps (605 KB → 733 KB, +21%) with no single attributable cause since Sep 3 suggests slow creep across releases, not one bad version.
2. Given voice traffic has been silent since mid-February per the Cost Analyst's recurring reports, the cheapest fix is not a code change: either (a) raise `BUDGET_LARGEST_CHUNK_KB` to reflect the SDK's real floor (e.g. 800 KB) so the check stops firing on a metric nobody intends to shrink while voice stays shelved, or (b) if/when the ElevenLabs account-separation decision lands, revisit whether the click-to-mount chunk should be lazy-loaded even further (e.g. split waveform/visualizer code from core call-handling) at that time.
3. Do not spend further engineering effort narrowing this chunk while the ElevenLabs cost/traffic decision remains open — consistent with the Sep 3 report's same recommendation, which still holds.

### P2 (Medium impact, attributable) — Sentry+PostHog chunk grew 12.2% in one dependency batch

`posthog-js` jumped 8 minor versions (`1.422.5 → 1.430.2`) and Sentry moved `10.71.0 → 10.74.0` in the Sep 14 batch, adding 37,941 B to their shared chunk — the single largest contributor to this cycle's total-JS growth. `optimizePackageImports: ["lucide-react", "posthog-js"]` (`next.config.ts:19`) is confirmed still active, so this is tree-shaken growth from genuinely new code in upstream releases, not a configuration regression.

- Check the PostHog changelog for `1.422.5...1.430.2` for newly-bundled-by-default features (e.g. session replay, surveys, feature-flag payloads) that may not be needed for this project's usage and could be opted out of via PostHog's init config.
- No code action required if the added surface is core functionality already in use — but this is worth a 10-minute changelog check before the next dependency batch compounds it further.

### P3 (Low priority, informational) — node_modules headroom is now the tightest tracked metric

At 95.5% of its 1,100 MB budget (49 MB headroom), node_modules is closer to its ceiling than total JS, largest-chunk, or prod-deps budgets. None of the Sep 14 batch's version bumps are individually large enough to explain a full audit here, but if the next dependency batch is similarly sized (20+ packages), this budget should be checked explicitly — it has no scripted violation output today, but there isn't much room left before it would.

### Closed items (confirmed still holding, no regression)

- ElevenLabs SDK remains fully deferred (click-to-mount) — not in any route's initial HTML.
- `pdfjs-dist`, `pdf-parse`, `canvas`, and `twitter-api-v2` remain in `devDependencies`/`optionalDependencies` (`package.json:134-135,144-145`) — cannot leak into client bundles.
- `optimizePackageImports: ["lucide-react", "posthog-js"]` confirmed active in `next.config.ts:19` despite `lucide-react` jumping 9 minor versions (`1.35.0 → 1.44.0`) in the same batch — no chunk in the top 10 shows meaningful `lucide` string presence, consistent with tree-shaking holding.
- react-dom, framework-runtime, and polyfill chunks are byte-identical to Sep 3 despite `react`/`react-dom` moving `19.2.8 → 19.3.0` and `next` moving `16.3.3 → 16.3.4` — confirms those version bumps did not add client-shipped code.
- The P2 recommendation from the Sep 3 report (wire up the largest-chunk budget check into `VIOLATIONS`) has been implemented and is confirmed firing correctly in this run's raw metrics output.

## Comparison to Previous Run (2026-09-03)

| Metric | Sep 3 | Sep 24 | Change |
|---|---|---|---|
| Total JS (raw) | 3,394 KB | 3,463 KB | **+69 KB (+2.0%)** |
| Total JS budget utilization | 84.8% | 86.6% | +1.8pp |
| Largest chunk (ElevenLabs) | 746,426 B (729 KB) | 750,835 B (733 KB) | +4,409 B (+0.6%) — still over its 650 KB budget |
| Sentry+PostHog chunk | 310,032 B (303 KB) | 347,973 B (340 KB) | **+37,941 B (+12.2%)** |
| Supabase+resend chunk | 343,150 B (335 KB) | 352,621 B (344 KB) | +9,471 B (+2.8%) |
| react-dom chunk | 238,815 B | 238,815 B | 0 (byte-identical) |
| framework-runtime chunk | 175,652 B | 175,652 B | 0 (byte-identical) |
| polyfill chunk | 112,594 B | 112,594 B | 0 (byte-identical) |
| Total CSS | 135 KB | 135 KB | 0 |
| Production dependencies | 34 | 34 | 0 |
| node_modules | 1,027 MB | 1,051 MB | +24 MB (95.5% of budget, tightest yet) |

No new regression this cycle beyond continued (not accelerated) drift on the standing ElevenLabs chunk violation. The Sentry+PostHog chunk growth (+12.2%) is the notable mover and is attributable to a specific, identified dependency batch rather than an unexplained increase.

---
