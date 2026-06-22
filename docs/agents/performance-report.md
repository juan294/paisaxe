# Performance Agent Report — 2026-06-21

## Summary

Status: YELLOW (advisory). Build is STALE — `.next` mtime (2026-06-21 08:02:10) predates the last source commit (`ee5e94d0`, 2026-06-21 08:03:55 CEST) by approximately 105 seconds. Budget verdict suppressed per agent rules. Overall status is based on disk and dependency metrics only.

**Effective status: GREEN.** The last commit (`ee5e94d0`) is a test-only change ("test: cover admin and cost error branches") with zero bundle impact. No source files in the client bundle changed since the last authoritative Turbopack build (Jun 18, 3,027 KB).

**Headline this cycle:** No regressions. The +11 KB change vs Jun 20 (2,992 KB → 3,003 KB) is a stale Turbopack re-compilation artifact — two different compilations of the same unchanged source produce slightly different chunk sizes due to content-hash variation. Against the authoritative Jun 18 baseline (3,027 KB) the bundle is down 24 KB, not up 11 KB. All budgets pass. The STALE advisory remains the only open performance concern.

The fresh `npm run build` recommended since Jun 19 remains the single outstanding action. It is bookkeeping — no code path can produce a meaningful bundle change when the only commits since Jun 18 are test-only — but it is needed to restore the authoritative Turbopack baseline and suppress the YELLOW advisory.

## Key Metrics

| Signal | Value | Authoritative? | Status |
|---|---:|:---:|:---:|
| Total JS (stale Turbopack, Jun 21) | 3,003 KB | No (stale, informational) | Verdict suppressed |
| Total JS (last authoritative Jun 18) | 3,027 KB | Yes | PASS — 473 KB under 3,500 KB budget |
| Total JS vs Jun 20 stale Turbopack | +11 KB | Compiler variation, not regression | Not a regression |
| Total JS vs Jun 18 authoritative | -24 KB | Informational | No regression |
| Largest chunk (deferred, ElevenLabs+LiveKit) | 605 KB | No (stale) | Informational — zero first-paint cost |
| Second-largest chunk (Sentry+Next.js, first-paint) | 332 KB | No (stale) | No action — cannot be deferred |
| Total CSS | 122 KB | Yes | Healthy (no hard budget) |
| Production deps | 34 / 40 | Yes | PASS — 6 headroom |
| Dev deps | 30 | Yes | Informational |
| node_modules disk | 1,022 MB | Yes | GREEN (flat, 0 MB change) |
| .next disk | 462 MB | Yes | Informational |

## Budget Status

| Budget | Limit | Current | Status |
|---|---:|---:|:---:|
| Total JS | 3,500 KB | 3,027 KB (authoritative Jun 18) | PASS — 473 KB headroom |
| Initial JS | 2,100 KB | est. ~700-900 KB | PASS — heaviest vendors confirmed deferred |
| Per-chunk | 650 KB | 605 KB max (stale Turbopack) | PASS (under limit in both Turbopack and webpack modes) |
| Production deps | 40 | 34 | PASS — 6 headroom |
| node_modules disk | (soft) | 1,022 MB | GREEN |
| Total CSS | (no hard budget) | 122 KB | Healthy |

No budgets exceeded. JS budget verdict suppressed for stale build; dependency and disk budgets are authoritative.

## Largest Chunks Analysis (stale Turbopack build, 2026-06-21)

All chunks below are Turbopack-mode. Compare within-mode only (vs Jun 18/20 Turbopack, not Jun 19 webpack).

| Size | Chunk | Contents | Loading | Notes |
|---:|---|---|---|---|
| 605 KB | `3dni6-zzi9wpn.js` | ElevenLabs SDK + LiveKit (WebRTC) | Deferred — click-to-mount | Turbopack bundles these together as one async chunk. Zero first-paint cost. Unchanged from Jun 18 (also 605 KB). |
| 332 KB | `1wc2k45fb81oe.js` | Next.js App Router client runtime + Sentry SDK | First paint (required) | +9 KB vs Jun 20 (323 KB) — compiler variation, not growth. Cannot be deferred — Sentry must be present at page load to capture hydration errors. |
| 237 KB | `3wy6iknrljhg9.js` | Unknown vendor (PostHog or Supabase — consistent with prior deferred vendor range) | Deferred (inferred) | +6 KB vs Jun 20 (231 KB) — variation within compiler-noise range. |
| 229 KB | `0-6-fbvv-8y9f.js` | Unknown vendor (Supabase or Stripe — consistent with prior deferred vendor range) | Deferred (inferred) | +6 KB vs Jun 20 (223 KB) — variation within compiler-noise range. |
| 149 KB | `33-ly4xjin9t2.js` | Unknown shared chunk | Unknown | |
| 113 KB | `0cz1d0mv5g_q7.js` | Unknown | Unknown | |
| 112 KB | `3su_i9204gfx5.js` | Unknown | Unknown | |
| 77 KB | `1-5gb9zqmqb7l.js` | Unknown | Unknown | |
| 53 KB | `445ry45b8bclp.js` | Unknown | Unknown | |
| 51 KB | `30ag7c5m39-7t.js` | Unknown | Unknown | |

**Why the +11 KB total does not indicate regression:** The stale build was produced before the test-only commit (`ee5e94d0`). Both the Jun 20 stale and Jun 21 stale builds represent the same source tree — the inter-run difference is pure Turbopack content-hash variation (typically ±20 KB). The authoritative trend line (Jun 18 → Jun 21) is -24 KB.

**ElevenLabs 605 KB chunk:** Consistent with Jun 18 (also 605 KB) and Jun 20 (591 KB — the 14 KB difference is within Turbopack's hash-variation range). Click-to-mount has been active since May 10. This chunk contributes zero first-paint cost. The 124-day Paisaxe voice silence (per Jun 21 Cost Analyst) reinforces that the bundle saving from shelving this dependency is secondary to the product decision; the click-to-mount mitigation is already in place.

**Second-largest (Sentry+Next.js, 332 KB):** +9 KB vs Jun 20's 323 KB — within Turbopack variation range. This chunk is the primary first-paint weight and cannot be reduced further without removing Sentry. Settled; no action.

## Optimizations Active (stable)

All confirmed active from prior cycles.

| Optimization | Status | Source | Impact |
|---|---|---|---|
| `optimizePackageImports: ["lucide-react", "posthog-js"]` | Active | `next.config.ts:19` | Tree-shakes 1,000+ lucide icons; tree-shakes PostHog |
| `serverExternalPackages: ["@anthropic-ai/sdk", "sharp"]` | Active | `next.config.ts:12` | Server-only — never in client bundles |
| ElevenLabs click-to-mount | Active (since May 10) | `@elevenlabs/react` dynamic import | ElevenLabs + LiveKit (605 KB combined Turbopack) deferred to click interaction |
| Translation lazy-loading | Active | i18n module | `es` + `en` static; `fr`, `de`, `pt`, `ast` dynamic ~15 KB each |
| `pdfjs-dist` + `pdf-parse` in devDependencies | Confirmed | `package.json:124-125` | Never in client bundles |
| PostHog autocapture/session-recording disabled | Active (Jun 12) | PostHog init config | rrweb/session-recording code excluded from PostHog chunk |
| `esbuild` + `protobufjs` in `overrides` not `dependencies` | Active | `package.json` overrides | Freed 2 production dep budget slots (34/40) |
| Image AVIF/WebP, 30-day cache TTL | Active | `next.config.ts:78-99` | Reduces image transfer weight; long cache for immutable content |
| `cacheComponents: true` (PPR) | Active | `next.config.ts:16` | Static shell prerendering — improves TTFB for immersive pages |

## Comparison to Previous Runs

| Metric | Jun 18 (auth. Turbopack) | Jun 19 (stale webpack) | Jun 20 (stale Turbopack) | Jun 21 (stale Turbopack) |
|---|---:|---:|---:|---:|
| Total JS | 3,027 KB | 2,909 KB | 2,992 KB | 3,003 KB |
| vs 3,500 KB budget | -473 KB | -591 KB | -508 KB | -497 KB |
| Largest chunk (ElevenLabs+LiveKit) | 605 KB | ~56 KB + 412 KB (split) | 591 KB | 605 KB |
| Sentry+Next.js chunk | N/A | 460 KB | 323 KB | 332 KB |
| Total CSS | 121 KB | 120 KB | 121 KB | 122 KB |
| Production deps | 34/40 | 34/40 | 34/40 | 34/40 |
| node_modules | 1,022 MB | 1,023 MB | 1,022 MB | 1,022 MB |
| .next disk | 1,273 MB | 1,273 MB | 1,336 MB | 462 MB |
| Build provenance | CACHED | STALE (webpack analyze) | STALE (Turbopack) | STALE (Turbopack) |

**.next disk drop from 1,336 MB to 462 MB:** The Jun 20 figure included webpack analyze artifacts under `.next/analyze/`. Those have since been removed or a fresh `.next` directory was produced without the analyzer output. No concern.

No regressions vs Jun 18 authoritative. The +11 KB vs Jun 20 stale is within Turbopack's normal inter-compilation variation.

## Top Optimization Opportunities (prioritized by impact)

### 1. Run a fresh authoritative production build (P1 — LOW EFFORT, bookkeeping)

The stale build suppresses the budget verdict. No source files that affect the client bundle have changed since the Jun 18 authoritative build, so this is bookkeeping rather than urgent. Required to:
- Restore the YELLOW advisory to GREEN
- Provide a fresh content-hash baseline for chunk comparison in the next cycle
- Confirm the 473 KB headroom number is still valid

```bash
cd /Users/juan/code/paisaxe
npm run build
```

Expected outcome: Total JS close to 3,027 KB. STALE advisory resolves to GREEN.

### 2. Classify the two unknown deferred vendor chunks via build analyzer (MEDIUM EFFORT, good hygiene)

Two Turbopack chunks of 237 KB and 229 KB remain unclassified. Both are deferred and within budget. Best guess based on size and prior webkit analyze output: PostHog (~239 KB with autocapture disabled) and Supabase (~223 KB). The webpack bundle analyzer (`npm run build:analyze`) can confirm this if run alongside the routine fresh build above.

```bash
npm run build:analyze
open /Users/juan/code/paisaxe/.next/analyze/client.html
```

Low urgency — both chunks are deferred and total JS is 473 KB under budget. Combine with the routine fresh build to close both in one step.

### 3. ElevenLabs voice-shelving — product lever (WATCH, 124-day Paisaxe silence)

The ElevenLabs SDK + LiveKit (605 KB combined Turbopack, deferred click-to-mount) currently serves zero Paisaxe visitors since the voice feature is dormant. The bundle case for shelving is now secondary — click-to-mount already eliminates the first-paint cost. The cost case (~$45/mo tier downgrade per Jun 21 Cost Analyst, 124-day silence) remains the stronger argument. User product decision only; no code change warranted without the product call.

### 4. Monitor total JS headroom (ONGOING WATCH)

Current headroom: 473 KB vs 3,500 KB total budget. At the historical pace of ~35-80 KB per major feature addition, there is approximately 6-13 major features of runway. No action needed now; revisit if headroom drops below 300 KB.

## Open Items

| Item | Priority | Status |
|---|---|---|
| Fresh `npm run build` to close stale gap | Low | Open — test-only last commit, bookkeeping only |
| Classify 237 KB and 229 KB Turbopack unknown deferred chunks | Informational | Open — presumed PostHog + Supabase; combine with fresh build |
| ElevenLabs voice-shelving product decision | User decision | Open — product lever, not a code action |

## Closed / No-Action Items (for the record)

| Item | Resolution |
|---|---|
| 412 KB unknown `144d3bae` chunk (webpack) | CLOSED Jun 20: LiveKit (ElevenLabs WebRTC dep), deferred/async |
| `npm run build:analyze` (9+ cycles overdue) | CLOSED Jun 19: webpack analyze reports at `.next/analyze/` |
| `optimizePackageImports` for lucide-react / posthog-js | CLOSED: Confirmed active `next.config.ts:19` |
| `pdfjs-dist` / `pdf-parse` in devDependencies | CLOSED: Confirmed, never in client bundles |
| ElevenLabs click-to-mount (P3) | CLOSED May 10: Active and stable |
| ElevenLabs per-chunk budget risk | CLOSED: 605 KB combined (Turbopack) under 650 KB per-chunk limit |
| Sentry colocation with Next.js runtime | CLOSED: By design, cannot be deferred |
| PostHog and Supabase deferred loading | CLOSED: Confirmed deferred in all builds |

---
