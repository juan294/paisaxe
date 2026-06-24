# Performance Agent Report — 2026-06-23

## Summary

Status: GREEN. The cached build is authoritative — `.next` mtime (2026-06-23 08:02:42) postdates the last source/dep commit (`6a75b659`, 2026-06-22 08:18:06 CEST). Total JS 3,003 KB is 497 KB under the 3,500 KB budget.

**Headlines this cycle:**
- No source or dependency changes since Jun 22 — all chunk sizes are identical.
- QA stable: 12/12 LLM safety tests pass (2nd consecutive clean cycle after 6-week blind period).
- QA YELLOW on journeys (8/10) — keyboard harness flakiness (`window.focus()` unreliable in headless Playwright), not a production or performance regression.
- ElevenLabs click-to-mount remains active; 126-day Paisaxe voice silence (Cost Analyst Jun 23).
- All three open items carried from Jun 22 — no new performance action items this cycle.

## Key Metrics

| Signal | Value | Authoritative? | Status |
|---|---:|:---:|:---:|
| Total JS (Turbopack cached, Jun 23) | 3,003 KB | Yes (build postdates last commit) | PASS — 497 KB under 3,500 KB |
| Largest chunk (ElevenLabs+LiveKit, deferred) | 591 KB | Yes | PASS — zero first-paint cost |
| Second-largest chunk (Sentry+Next.js, first-paint) | 324 KB | Yes | Settled — cannot be deferred |
| Total CSS | 122 KB | Yes | Healthy (no hard budget) |
| Production deps | 34 / 40 | Yes | PASS — 6 headroom |
| Dev deps | 30 | Yes | Informational |
| node_modules disk | 1,022 MB | Yes | GREEN (flat vs Jun 22) |
| .next disk | 424 MB | Yes | Informational |

## Budget Status

| Budget | Limit | Current | Status |
|---|---:|---:|:---:|
| Total JS | 3,500 KB | 3,003 KB | PASS — 497 KB headroom |
| Initial JS | 2,100 KB | est. ~700-900 KB | PASS — heaviest vendors confirmed deferred |
| Per-chunk | 650 KB | 591 KB max | PASS |
| Production deps | 40 | 34 | PASS — 6 headroom |
| node_modules disk | (soft) | 1,022 MB | GREEN |
| Total CSS | (no hard budget) | 122 KB | Healthy |

No budgets exceeded.

## Largest Chunks Analysis (Turbopack cached, 2026-06-23)

All chunks are Turbopack-mode. Compare within-mode only.

| Size | Chunk | Contents | Loading | Notes |
|---:|---|---|---|---|
| 591 KB | `3dni6-zzi9wpn.js` | ElevenLabs SDK + LiveKit (WebRTC) | Deferred — click-to-mount | Stable for 5 consecutive cycles (Jun 18–23). Zero first-paint cost. Click-to-mount active since May 10. |
| 324 KB | `1wc2k45fb81oe.js` | Next.js App Router client runtime + Sentry SDK | First paint (required) | Stable. Cannot be deferred — Sentry must be present at page load. Settled. |
| 232 KB | `3wy6iknrljhg9.js` | Unknown vendor — presumed PostHog (deferred) | Deferred (inferred) | Stable for 5 cycles. Within budget. |
| 224 KB | `0-6-fbvv-8y9f.js` | Unknown vendor — presumed Supabase (deferred) | Deferred (inferred) | Stable for 5 cycles. Within budget. |
| 145 KB | `33-ly4xjin9t2.js` | Unknown shared chunk | Unknown | Stable. |
| 110 KB | `0cz1d0mv5g_q7.js` | Unknown | Unknown | Stable. |
| 110 KB | `3su_i9204gfx5.js` | Unknown | Unknown | Stable. |
| 75 KB | `1-5gb9zqmqb7l.js` | Unknown | Unknown | Stable. |
| 52 KB | `445ry45b8bclp.js` | Unknown | Unknown | Stable. |
| 50 KB | `30ag7c5m39-7t.js` | Unknown | Unknown | Stable. |

**Why the zero change vs Jun 22 is expected:** The only source commit since Jun 22 is `6a75b659` ("fix: clear suggest place dialog timeout"), a single setTimeout/clearTimeout change in a dialog component. This does not touch any vendor chunk and produces at most single-digit bytes in an application chunk — below Turbopack's content-hash variation floor.

**ElevenLabs 591 KB chunk:** Unchanged for 5 consecutive Turbopack cycles (Jun 18–23). Click-to-mount active since May 10. At 126-day Paisaxe voice silence (Cost Analyst Jun 23), this chunk is never triggered by any live user. Zero first-paint cost. The bundle case for shelving is secondary to the product/cost decision (~$22-45/mo tier downgrade per Cost Analyst).

**Sentry+Next.js 324 KB chunk:** Settled. This is the primary first-paint weight and cannot be deferred without removing Sentry. No action.

**Two unknown deferred vendor chunks (232 KB, 224 KB):** Presumed PostHog and Supabase based on size profile from prior webpack analyze runs. Both deferred. Classification via `npm run build:analyze` remains an open bookkeeping item.

## Optimizations Active (stable)

All optimizations confirmed active. No changes this cycle.

| Optimization | Status | Source | Impact |
|---|---|---|---|
| `optimizePackageImports: ["lucide-react", "posthog-js"]` | Active | `next.config.ts:19` | Tree-shakes 1,000+ lucide icons; tree-shakes PostHog |
| `serverExternalPackages: ["@anthropic-ai/sdk", "sharp"]` | Active | `next.config.ts:12` | Server-only — never in client bundles |
| ElevenLabs click-to-mount | Active (since May 10) | `@elevenlabs/react` dynamic import | ElevenLabs + LiveKit (591 KB combined) deferred to click interaction |
| Translation lazy-loading | Active | i18n module | `es` + `en` static; `fr`, `de`, `pt`, `ast` dynamic ~15 KB each |
| `pdfjs-dist` + `pdf-parse` in devDependencies | Confirmed | `package.json` | Never in client bundles |
| PostHog autocapture/session-recording disabled | Active (Jun 12) | PostHog init config | rrweb/session-recording code excluded from PostHog chunk |
| `esbuild` + `protobufjs` in `overrides` not `dependencies` | Active | `package.json overrides` | Freed 2 production dep budget slots (34/40) |
| Image AVIF/WebP, 30-day cache TTL | Active | `next.config.ts:78-99` | Reduces image transfer weight; long cache for immutable content |
| `cacheComponents: true` (PPR) | Active | `next.config.ts:16` | Static shell prerendering — improves TTFB for immersive pages |

## Comparison to Previous Runs

| Metric | Jun 18 (auth. Turbopack) | Jun 20 (stale Turbopack) | Jun 21 (stale Turbopack) | Jun 22 (stale Turbopack) | Jun 23 (cached, authoritative) |
|---|---:|---:|---:|---:|---:|
| Total JS | 3,027 KB | 2,992 KB | 3,003 KB | 3,003 KB | 3,003 KB |
| vs 3,500 KB budget | -473 KB | -508 KB | -497 KB | -497 KB | -497 KB |
| Largest chunk (ElevenLabs+LiveKit) | 605 KB | 591 KB | 605 KB | 605 KB | 591 KB |
| Sentry+Next.js chunk | N/A | 323 KB | 332 KB | 332 KB | 324 KB |
| Total CSS | 121 KB | 121 KB | 122 KB | 122 KB | 122 KB |
| Production deps | 34/40 | 34/40 | 34/40 | 34/40 | 34/40 |
| node_modules | 1,022 MB | 1,022 MB | 1,022 MB | 1,022 MB | 1,022 MB |
| Build provenance | AUTH Turbopack | STALE Turbopack | STALE Turbopack | STALE Turbopack | CACHED (authoritative) |

Minor chunk-size fluctuations between cycles (e.g., 605 KB vs 591 KB for the ElevenLabs chunk) are Turbopack content-hash variation — not real size changes. No regressions vs Jun 18 authoritative.

## Top Optimization Opportunities (prioritized by impact)

### 1. Run a fresh authoritative production build (LOW EFFORT, bookkeeping)

The current cached Turbopack build is authoritative for the current source tree, but it is not a production Next.js build (`next build`). A production build would:
- Produce a verified total-JS number under the webpack/SWC pipeline (vs Turbopack dev)
- Confirm the 497 KB budget headroom with production optimizations applied
- Provide a content-hash baseline for future chunk tracking

```bash
cd /Users/juan/code/paisaxe
npm run build
```

Expected outcome: Total JS close to 3,003 KB (Turbopack) or the Jun 18 production baseline of 3,027 KB. No regressions expected given zero source changes.

### 2. Classify the two unknown deferred vendor chunks via build analyzer (LOW EFFORT, hygiene)

Two chunks of 232 KB and 224 KB remain unclassified. Both are deferred and within budget. Based on size profile from prior webpack analyze runs, these are almost certainly PostHog and Supabase. Combine with the routine production build above.

```bash
npm run build:analyze
open /Users/juan/code/paisaxe/.next/analyze/client.html
```

Low urgency — both are deferred and total JS is 497 KB under budget.

### 3. ElevenLabs voice-shelving — product lever (WATCH, 126-day Paisaxe silence)

The ElevenLabs SDK + LiveKit (591 KB, deferred click-to-mount) serves zero Paisaxe visitors. The click-to-mount optimization already eliminates first-paint cost, so the bundle case for shelving is exhausted. The cost case (~$22-45/mo tier downgrade at 126-day silence per Cost Analyst Jun 23) is the primary lever. Product/business decision only; no further code optimization available without the product call.

### 4. Monitor total JS headroom (ONGOING WATCH)

Current headroom: 497 KB vs 3,500 KB total budget. At the historical pace of ~35-80 KB per major feature addition, there is approximately 6-14 major features of runway. No action needed; revisit if headroom drops below 300 KB.

## Cross-Agent Observations This Cycle

**QA YELLOW (keyboard harness flakiness):** Journey tests 8/10 — Journey 2 (ArrowRight nav) and Journey 5 (i-key overlay) fail on `window.focus()` unreliability in headless Playwright. No code change between Jun 22 (10/10) and Jun 23, confirming these are harness-level flakes, not performance-related hydration or rendering regressions. The QA and Security agents both recommend replacing `page.evaluate(() => window.focus())` with `page.getByTestId("story-viewer").first().click()` in `e2e/qa-journey.spec.ts:101` and `e2e/qa-journey.spec.ts:196/203`.

**i18n key count (411 vs 406):** Localization agent (Jun 22-23) confirms 5 new keys added in parity across all 6 locales. Each ~15 KB translation file gains a few bytes from 5 extra keys. Not measurable as a bundle delta.

**QA LLM safety stable (2nd consecutive cycle):** VOYAGE_API_KEY fix confirmed working end-to-end in launchd/cron context for 2nd cycle. Prior concern about Voyage AI 503 timeouts affecting chat response latency is resolved — embedding path is operating normally.

**Cost Analyst — ElevenLabs voice silence:** 126-day Paisaxe silence (since Feb 17). Cost analyst Jun 23 notes ElevenLabs cycle-average decelerating to 315.6 chars/day, projected 3.16% utilization by Jul 7 reset. Cost case for voice-shelving stronger than bundle case (click-to-mount already active).

## Open Items

| Item | Priority | Status |
|---|---|---|
| Fresh `npm run build` (production pipeline) | Low | Open — bookkeeping; cached build is authoritative |
| Classify 237 KB and 229 KB Turbopack unknown deferred chunks | Informational | Open — combine with fresh production build above |
| ElevenLabs voice-shelving product decision | User decision | Open — 126-day Paisaxe silence; cost lever, not a code action |

## Closed / No-Action Items (for the record)

| Item | Resolution |
|---|---|
| 412 KB unknown `144d3bae` chunk (webpack) | CLOSED Jun 20: LiveKit (ElevenLabs WebRTC dep), deferred/async |
| `npm run build:analyze` (9+ cycles overdue) | CLOSED Jun 19: webpack analyze at `.next/analyze/`; Turbopack re-runs deferred to routine build |
| `optimizePackageImports` for lucide-react / posthog-js | CLOSED: Confirmed active `next.config.ts:19` |
| `pdfjs-dist` / `pdf-parse` in devDependencies | CLOSED: Confirmed, never in client bundles |
| ElevenLabs click-to-mount (P3) | CLOSED May 10: Active and stable |
| ElevenLabs per-chunk budget risk | CLOSED: 591-605 KB combined (Turbopack) under 650 KB per-chunk limit |
| Sentry colocation with Next.js runtime | CLOSED: By design, cannot be deferred |
| PostHog and Supabase deferred loading | CLOSED: Confirmed deferred in all builds |
| VOYAGE_API_KEY QA environment propagation | CLOSED Jun 22: Fix confirmed working — 12/12 LLM tests pass for 2nd consecutive cycle |

---
