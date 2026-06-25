# Performance Agent Report — 2026-06-24

## Summary

Status: GREEN (with a measurement caveat). Total JS is 3,003 KB — 497 KB under the 3,500 KB total budget — and every chunk is identical to the Jun 23 cycle. No regressions.

The caveat this cycle is real and worth acting on: the cached build measures the **previous** dependency versions, not the ones the lockfile now declares. The Jun 24 production dep batch (PR #705, commit `50f74c15`) bumped `@elevenlabs/react`, `@anthropic-ai/sdk`, `posthog-js`, and `lucide-react` in `package.json` + `package-lock.json`, but `npm install` was never run locally — `node_modules` still holds the older versions, and the cached chunk hashes are byte-for-byte identical to Jun 23. So these numbers are authoritative for the *installed* tree but do **not** yet reflect the merged dep batch.

**Headlines this cycle:**
- Bundle flat at 3,003 KB; largest chunk (ElevenLabs + LiveKit, deferred) 591 KB. Zero change vs Jun 23 — same content hashes.
- `node_modules` is one dep-batch behind the lockfile (details below). CI is unaffected (CI runs `npm ci`); only the local perf-metrics environment is stale.
- Top action upgraded from bookkeeping to needed: `npm install && npm run build` to sync deps and capture authoritative post-#705 chunk + initial-JS numbers (Triage Jun 24 already asked to "monitor chunk sizes in the next authoritative build").
- No new code-level optimization opportunities — the optimization surface remains fully explored (click-to-mount, `optimizePackageImports`, devDep PDF libs, PostHog capture disabled).

## Stale Dependency Tree (new finding this cycle)

PR #705 (Jun 24, 07:40:53) updated the lockfile, but the installed packages were never refreshed. Verified by reading each package's installed `package.json`:

| Package | Declared (package.json / lockfile) | Installed (node_modules) | Client bundle role |
|---|---|---|---|
| `@elevenlabs/react` | ^1.7.0 | **1.6.7** | Drives the 591 KB deferred chunk (click-to-mount) |
| `@anthropic-ai/sdk` | ^0.105.0 | **0.104.2** | `serverExternalPackages` — never in client bundles |
| `posthog-js` | ^1.391.5 | **1.386.8** | Deferred chunk (tree-shaken via `optimizePackageImports`) |
| `lucide-react` | ^1.21.0 | **1.20.0** | Icon imports (tree-shaken via `optimizePackageImports`) |

Supporting evidence:
- The ElevenLabs chunk `3dni6-zzi9wpn.js` is identical in name and size (605,184 bytes) to Jun 23. A real `@elevenlabs/react` 1.6.7→1.7.0 rebuild would change the content hash.
- `node_modules/@elevenlabs/react` was last installed 2026-06-16 16:44:13 — before the Jun 24 batch.
- The `.next` chunk mtime (08:03:12) is a Turbopack cache-reuse touch, not a rebuild against new deps.

**Impact assessment (expected, unmeasured):** small. `@anthropic-ai/sdk` is server-external (zero client delta regardless). `@elevenlabs/react` is a minor and lives entirely in the deferred click-to-mount chunk (no first-paint cost either way). `posthog-js` and `lucide-react` are minor/patch and are tree-shaken. No regression is expected — but it is unverified until a fresh install + build.

## Key Metrics

| Signal | Value | Authoritative? | Status |
|---|---:|:---:|:---:|
| Total JS (Turbopack cached) | 3,003 KB | For installed tree only (one batch stale) | PASS — 497 KB under 3,500 KB |
| Largest chunk (ElevenLabs + LiveKit, deferred) | 591 KB | Yes (installed tree) | PASS — zero first-paint cost |
| Second-largest chunk (Next.js runtime + Sentry, first-paint) | 324 KB | Yes | Settled — cannot be deferred |
| Total CSS | 122 KB | Yes | Healthy (no hard budget) |
| Production deps | 34 / 40 | Yes | PASS — 6 headroom |
| Dev deps | 30 | Yes | Informational |
| node_modules disk | 1,022 MB | Yes | GREEN (flat vs Jun 23) |
| .next disk | 453 MB | Yes | Informational (+29 MB dev-cache growth) |

## Budget Status

| Budget | Limit | Current | Status |
|---|---:|---:|:---:|
| Total JS | 3,500 KB | 3,003 KB | PASS — 497 KB headroom (14% under) |
| Initial JS | 2,100 KB | est. ~700–900 KB | PASS (estimated) — heaviest vendors confirmed deferred; precise number needs `next build` First Load JS |
| Per-chunk (informal 650 KB) | 650 KB | 591 KB max | PASS |
| Production deps | 40 | 34 | PASS — 6 headroom |
| node_modules disk | (soft) | 1,022 MB | GREEN |
| Total CSS | (no hard budget) | 122 KB | Healthy |

No budgets exceeded. The initial-JS figure is an estimate — the Turbopack dev cache does not emit per-route "First Load JS". A production `next build` is the only authoritative source for the 2,100 KB initial budget.

## Largest Chunks Analysis (Turbopack cached, installed tree)

Compare within Turbopack mode only. Bytes from the metrics file; KB = bytes / 1024.

| Size | Chunk | Contents | Loading | Notes |
|---:|---|---|---|---|
| 591 KB | `3dni6-zzi9wpn.js` | ElevenLabs SDK + LiveKit (WebRTC) | Deferred — click-to-mount | Identical hash for 6 consecutive cycles (Jun 18–24). Built against `@elevenlabs/react` 1.6.7, not the merged 1.7.0. Zero first-paint cost. |
| 324 KB | `1wc2k45fb81oe.js` | Next.js App Router client runtime + Sentry SDK | First paint (required) | Settled. Cannot be deferred — Sentry must load at page start. |
| 232 KB | `3wy6iknrljhg9.js` | Presumed PostHog (deferred) | Deferred (inferred) | Stable 6 cycles. Built against `posthog-js` 1.386.8. Within budget. |
| 224 KB | `0-6-fbvv-8y9f.js` | Presumed Supabase (deferred) | Deferred (inferred) | Stable 6 cycles. Within budget. |
| 145 KB | `33-ly4xjin9t2.js` | Unknown shared chunk | Unknown | Stable. |
| 110 KB | `0cz1d0mv5g_q7.js` | Unknown | Unknown | Stable. |
| 110 KB | `3su_i9204gfx5.js` | Unknown | Unknown | Stable. |
| 75 KB | `1-5gb9zqmqb7l.js` | Unknown | Unknown | Stable. |
| 52 KB | `445ry45b8bclp.js` | Unknown | Unknown | Stable. |
| 50 KB | `30ag7c5m39-7t.js` | Unknown | Unknown | Stable. |

**Largest node_modules packages are disk-install sizes, not bundle weight.** `pdfjs-dist` (61 MB) + `pdf-parse` (57 MB) are `devDependencies` and `canvas` (19 MB) is an `optionalDependency` for server-side PDF rendering — none ship to the client. `next` (186 MB), `@next` (117 MB), `@sentry` (75 MB), and `typescript` (24 MB) are tooling/runtime install footprints, not client payload.

## Optimizations Active (stable, re-verified this cycle)

| Optimization | Status | Source | Impact |
|---|---|---|---|
| `optimizePackageImports: ["lucide-react", "posthog-js"]` | Active | `next.config.ts:19` | Tree-shakes 1,000+ lucide icons; tree-shakes PostHog |
| `serverExternalPackages: ["@anthropic-ai/sdk", "sharp"]` | Active | `next.config.ts:12` | Server-only — never in client bundles |
| ElevenLabs click-to-mount | Active | `src/components/immersive/voice-chat.tsx:48` (`VoiceChatElevenLabs = dynamic(...)`) | ElevenLabs + LiveKit (591 KB) deferred to click |
| PostHog autocapture + pageview + session-recording disabled | Active | `src/components/posthog-provider.tsx:98-100` (`autocapture: false`, `capture_pageview: false`) | rrweb/session-recording excluded from PostHog chunk |
| Translation lazy-loading | Active | i18n module | `es` + `en` static; `fr`, `de`, `pt`, `ast` dynamic (~15 KB each) |
| `pdfjs-dist` + `pdf-parse` in `devDependencies` | Confirmed | `package.json:124-125` | Never in client bundles |
| `esbuild` + `protobufjs` in `overrides` (not `dependencies`) | Active | `package.json:143-144` | Keeps production deps at 34/40 |
| Image AVIF/WebP, 30-day cache TTL | Active | `next.config.ts:78-98` | Smaller transfers; long cache for immutable images |
| `cacheComponents: true` (PPR) | Active | `next.config.ts:16` | Static-shell prerender — better TTFB on immersive pages |

## Comparison to Previous Runs

| Metric | Jun 20 (stale TP) | Jun 21 (stale TP) | Jun 22 (stale TP) | Jun 23 (cached) | Jun 24 (cached, deps stale) |
|---|---:|---:|---:|---:|---:|
| Total JS | 2,992 KB | 3,003 KB | 3,003 KB | 3,003 KB | 3,003 KB |
| vs 3,500 KB budget | -508 KB | -497 KB | -497 KB | -497 KB | -497 KB |
| Largest chunk (ElevenLabs+LiveKit) | 591 KB | 605 KB | 605 KB | 591 KB | 591 KB |
| Next.js runtime + Sentry chunk | 323 KB | 332 KB | 332 KB | 324 KB | 324 KB |
| Total CSS | 121 KB | 122 KB | 122 KB | 122 KB | 122 KB |
| Production deps | 34/40 | 34/40 | 34/40 | 34/40 | 34/40 |
| node_modules | 1,022 MB | 1,022 MB | 1,022 MB | 1,022 MB | 1,022 MB |
| Installed deps match lockfile? | Yes | Yes | Yes | Yes | **No — behind PR #705** |

Zero regression vs Jun 23. The only material change this cycle is environmental: the lockfile advanced (PR #705) but the local install did not, so the bundle numbers describe the pre-#705 dependency set.

## Top Optimization Opportunities (prioritized by impact)

### 1. Sync deps and run a fresh authoritative build (LOW EFFORT, now NEEDED)

`node_modules` is one dep-batch behind the lockfile, so the current numbers cannot confirm the post-#705 bundle. Resync and build to get authoritative chunk sizes **and** the per-route First Load JS that the 2,100 KB initial budget actually depends on.

```bash
cd /Users/juan/code/paisaxe
npm install            # syncs node_modules to package-lock.json (pulls @elevenlabs/react 1.7.0, etc.)
npm run build          # production pipeline — emits per-route "First Load JS"
```

Expected outcome: total JS within a few KB of 3,003 KB; ElevenLabs deferred chunk roughly flat (1.6.7→1.7.0 is a minor); no first-paint change (`@anthropic-ai/sdk` is server-external). The value is confirmation, not a fix — it closes the only open measurement gap this cycle and satisfies Triage's Jun 24 request to verify chunk sizes after the batch.

### 2. Classify the two unknown deferred vendor chunks (LOW EFFORT, hygiene)

The 232 KB and 224 KB chunks remain inferred (PostHog, Supabase) rather than confirmed. Both are deferred and within budget. Resolve opportunistically alongside step 1 — `build:analyze` uses the webpack pipeline and writes a treemap:

```bash
npm run build:analyze
open /Users/juan/code/paisaxe/.next/analyze/client.html
```

Low urgency — both chunks are deferred and total JS is 497 KB under budget.

### 3. ElevenLabs voice-shelving — product lever (WATCH, 127-day Paisaxe silence)

The ElevenLabs SDK + LiveKit (591 KB, deferred click-to-mount) serves zero Paisaxe visitors (127-day voice silence, Cost Analyst Jun 24). Click-to-mount already removes all first-paint cost, so the **bundle** case is exhausted. The remaining lever is the **cost** case (~$22–45/mo tier downgrade per Cost Analyst). This is a product/business decision, not a code optimization. No code action available.

### 4. Monitor total JS headroom (ONGOING WATCH)

Headroom is 497 KB against the 3,500 KB total budget. At the historical pace of ~35–80 KB per major feature, that is roughly 6–14 features of runway. No action; revisit if headroom drops below 300 KB.

## Cross-Agent Observations This Cycle

**QA YELLOW (journeys 7/10), but not performance-related.** QA Jun 24 reports Journeys 2/5/6 timing out on `getByTestId("story-viewer")` because the `story-viewer` testid is absent from the DOM (a harness/testid mismatch), and one RAG content-language miss (English query against the Spanish PDF corpus). None of these are hydration, render, or bundle issues. LLM safety remains 12/12. Performance has no contribution here.

**Security GREEN (8th consecutive).** Security Jun 24 closed 8 Dependabot alerts via PR #707 (undici 7.28.0, dompurify 3.4.11). undici is a server-side HTTP dep — zero client bundle impact, consistent with the flat numbers.

**Triage Jun 24 merged the dep batch (#705, #706, #707, #704).** This is the source of the lockfile/`node_modules` skew above. Triage explicitly asked Performance to "monitor chunk sizes in the next authoritative build" — step 1 is that build.

**Localization stable.** 411 leaf keys per locale, lazy-loading unchanged (~15 KB each). No bundle delta.

## Open Items

| Item | Priority | Status |
|---|---|---|
| `npm install` + `npm run build` to sync deps and capture post-#705 chunk + First Load JS | Low-but-needed | Open — only open measurement gap this cycle |
| Classify 232 KB and 224 KB deferred chunks via `build:analyze` | Informational | Open — combine with step 1 |
| ElevenLabs voice-shelving product decision | User decision | Open — 127-day silence; cost lever, not a code action |

## Closed / No-Action Items (for the record)

| Item | Resolution |
|---|---|
| `optimizePackageImports` for lucide-react / posthog-js | CLOSED — active `next.config.ts:19` |
| `pdfjs-dist` / `pdf-parse` in client bundles | CLOSED — both `devDependencies`, never shipped |
| ElevenLabs click-to-mount (P3) | CLOSED — active `voice-chat.tsx:48` |
| ElevenLabs per-chunk budget risk | CLOSED — 591 KB under 650 KB per-chunk threshold |
| Sentry colocation with Next.js runtime | CLOSED — by design, first-paint, cannot defer |
| PostHog autocapture / session-recording weight | CLOSED — disabled `posthog-provider.tsx:98-100` |
| `@anthropic-ai/sdk` client bundle risk | CLOSED — `serverExternalPackages`, server-only |

---
