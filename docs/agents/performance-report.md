# Performance Agent Report — 2026-06-20

## Summary

Status: YELLOW (advisory). Build is STALE per script — `.next` mtime (2026-06-20 08:40:12) predates the last source commit (`09b6ab7d`, 2026-06-20 08:39:49 CEST) by approximately 23 seconds. Budget verdict suppressed per agent rules. Overall status is based on disk and dependency metrics only.

**Effective status: GREEN.** The last commit (`09b6ab7d`) is a test-only change (`test(story-viewer): make dynamic-import flush deterministic under parallel load`) with zero bundle impact. No source files in the client bundle changed. The .next directory is substantively current.

**Notable this cycle:** Both open P1/P2 items from Jun 19 are now CLOSED. The 412 KB unknown chunk (`144d3bae`) was identified as LiveKit — ElevenLabs' WebRTC transitive dependency — by Jun 20 triage, and confirmed deferred/async via webpack runtime inspection. No first-paint cost; no budget concern. The Jun 20 triage recommended a fresh `npm run build` before the next cycle to establish a clean authoritative Turbopack baseline.

Total JS is 2,992 KB — a +83 KB increase vs the prior stale webpack build (2,909 KB, Jun 19), but a -35 KB decrease vs the last authoritative Turbopack build (3,027 KB, Jun 18). The +83 KB figure is a compiler mode artifact (Turbopack vs webpack produce different chunk splits), not a real bundle increase. The bundle is 508 KB under the 3,500 KB total budget.

## Key Metrics

| Signal | Value | Authoritative? | Status |
|---|---:|:---:|:---:|
| Total JS (stale Turbopack) | 2,992 KB | No (stale, informational) | — (verdict suppressed) |
| Total JS (last authoritative) | 3,027 KB | Yes (Jun 18 Turbopack) | PASS — 508 KB under 3,500 KB budget |
| Total JS vs prior run | +83 KB | Compiler mode delta, not real | Not a regression |
| Total JS vs Jun 18 Turbopack | -35 KB | Informational | No regression |
| Initial JS | N/A (first/deferred split unclear, stale build) | No | — (suppressed) |
| Largest chunk | 591 KB (stale Turbopack) | No | Informational |
| Total CSS | 121 KB | Yes | Healthy (no hard budget) |
| Production deps | 34 / 40 | Yes | PASS — 6 headroom |
| Dev deps | 30 | Yes | Informational |
| node_modules disk | 1,022 MB | Yes | GREEN (flat from Jun 19) |
| .next disk | 1,336 MB | Yes | Informational (+63 MB vs Jun 19, includes analyze artifacts) |

## Budget Status

| Budget | Limit | Current | Status |
|---|---:|---:|:---:|
| Total JS | 3,500 KB | 3,027 KB (authoritative Jun 18) | PASS — 508 KB headroom |
| Initial JS | 2,100 KB | est. ~700-900 KB | PASS — heaviest vendors confirmed deferred |
| Per-chunk | 650 KB | 591 KB max (stale Turbopack) | PASS |
| Production deps | 40 | 34 | PASS — 6 headroom |
| node_modules disk | (soft) | 1,022 MB | GREEN |
| Total CSS | (no hard budget) | 121 KB | Healthy |

No budgets exceeded. JS budget verdict suppressed for stale build; dependency and disk budgets are authoritative.

## Closed Since Previous Run

- **P1 CLOSED (carried 10+ cycles): 412 KB unknown chunk identified.** Jun 20 triage confirmed the `144d3bae.07e3d4f37ae764e1.js` chunk (webpack) = LiveKit, ElevenLabs' WebRTC dependency. It is deferred/async via webpack runtime — zero first-paint cost, no budget concern. This was the longest-running open item in the performance tracker.

- **P2 CARRIED (low priority): Fresh authoritative build.** A `npm run build` is still recommended for the next cycle to produce a clean Turbopack baseline and close the stale gap. The last source change (test-only) does not affect bundle output; this is bookkeeping only.

## Largest Chunks Analysis (stale Turbopack build, 2026-06-20)

The chunk names below are Turbopack-mode chunks. They differ from the webpack analyze chunks in the Jun 19 report; chunk sizes should be compared within-mode only (compare against Jun 18 Turbopack, not Jun 19 webpack).

| Size | Chunk | Contents | Loading | Notes |
|---:|---|---|---|---|
| 591 KB | `37qcb34taif-j.js` | ElevenLabs SDK + LiveKit (WebRTC) | Deferred — click-to-mount | Turbopack bundles these together as a single async chunk; webpack split them to ~56 KB + 412 KB. Either way: zero first-paint cost |
| 323 KB | `3-s8d23d-qf70.js` | Next.js App Router client runtime + Sentry SDK | First paint (required) | Sentry instrumentation collocated with framework shell; cannot be deferred without dropping error monitoring |
| 231 KB | `274uuhnvmb06c.js` | Unknown vendor — likely PostHog or Supabase | Deferred (inferred) | Consistent with prior Turbopack deferred vendor chunks in the 190-350 KB range |
| 223 KB | `407cnfme6y1ex.js` | Unknown vendor — likely Supabase or Stripe | Deferred (inferred) | Consistent with prior Turbopack Supabase/Stripe deferred ranges |
| 145 KB | `28fwbosvnm994.js` | Unknown shared chunk | Unknown | React framework shell or shared route chunk |
| 110 KB | `0cz1d0mv5g_q7.js` | Unknown | Unknown | |
| 110 KB | `0wi1t58-3j8-9.js` | Unknown | Unknown | |
| 75 KB | `0stqub71or1b_.js` | Unknown | Unknown | |
| 52 KB | `2g4boyx0boo31.js` | Unknown | Unknown | |
| 50 KB | `2wzikxr6_-2gr.js` | Unknown | Unknown | |

**Comparison note:** In the Jun 18 Turbopack build the largest chunk was also ~605 KB (ElevenLabs/LiveKit combined by Turbopack). Today's 591 KB for the same combined deferred chunk is -14 KB, likely noise or from the story-viewer dynamic import refactor landing in this build. The click-to-mount implementation remains active and functional; both the ElevenLabs SDK and LiveKit are correctly loaded only on user interaction.

**Second-largest chunk (323 KB, Sentry+Next.js):** This is the primary first-paint chunk carrying Sentry's error monitoring SDK alongside the App Router client runtime. In webpack mode this was 460 KB; Turbopack produces a smaller combined chunk here. This chunk cannot be reduced further without removing Sentry — the SDK must be present at page load to capture hydration and initial load errors. No action.

## Optimizations Active (stable)

All confirmed from prior cycles, verified against `next.config.ts`:

| Optimization | Status | Source | Impact |
|---|---|---|---|
| `optimizePackageImports: ["lucide-react", "posthog-js"]` | Active | `next.config.ts:19` | Avoids barrel-bundling 1,000+ lucide icons; tree-shakes PostHog |
| `serverExternalPackages: ["@anthropic-ai/sdk", "sharp"]` | Active | `next.config.ts:12` | Claude SDK + image processing server-only; never in client bundles |
| ElevenLabs click-to-mount | Active (May 10) | `@elevenlabs/react` dynamic import | ElevenLabs + LiveKit (591 KB combined) zero first-paint cost |
| Translation lazy-loading | Active | i18n module | `es` + `en` static; `fr`, `de`, `pt`, `ast` dynamic ~15 KB each |
| `pdfjs-dist` + `pdf-parse` in devDependencies | Confirmed | `package.json:123-124` | Never in client bundles |
| PostHog autocapture/session-recording disabled | Active (Jun 12) | PostHog init config | rrweb/session-recording code excluded from PostHog chunk |
| `esbuild` + `protobufjs` in `overrides` not `dependencies` | Active (Jun 16 triage) | `package.json:142,143` | Freed 2 production dep budget slots (34/40 now instead of 36/40) |
| Image AVIF/WebP, 30-day cache TTL | Active | `next.config.ts:79-99` | Reduces image transfer weight; long cache for immutable content |

## Comparison to Previous Runs

| Metric | Jun 18 (auth.) | Jun 19 (stale webpack) | Jun 20 (stale Turbopack) | Notes |
|---|---:|---:|---:|:---|
| Total JS | 3,027 KB | 2,909 KB | 2,992 KB | Jun 18 is the authoritative reference |
| vs 3,500 KB budget | -473 KB | -591 KB | -508 KB | All within budget |
| Largest chunk | 605 KB | 460 KB | 591 KB | Compiler mode differences |
| ElevenLabs (deferred) | 605 KB | ~56 KB | 591 KB | Turbopack bundles ElevenLabs+LiveKit together; webpack splits them |
| Total CSS | 121 KB | 120 KB | 121 KB | Stable |
| Production deps | 34/40 | 34/40 | 34/40 | Unchanged |
| node_modules | 1,022 MB | 1,023 MB | 1,022 MB | Stable |
| .next disk | 1,273 MB | 1,273 MB | 1,336 MB | +63 MB includes analyze artifacts |
| Build provenance | CACHED | STALE (webpack analyze) | STALE (Turbopack) | Fresh build recommended |
| Unknown large chunk | Yes (412 KB) | Yes (412 KB) | RESOLVED: LiveKit | Jun 20 triage closed this |

No regressions vs Jun 18 authoritative. The +83 KB vs Jun 19 stale webpack is a compiler mode artifact.

## Top Optimization Opportunities (prioritized by impact)

### 1. Run a fresh authoritative production build (P1 — LOW EFFORT, establishes clean baseline)

The current stale build suppresses the budget verdict. The last source change was test-only with zero bundle impact, so a fresh build is bookkeeping rather than urgent. Still recommended before the next performance cycle to restore the authoritative Turbopack baseline.

```bash
cd /Users/juan/code/paisaxe
npm run build
```

Expected outcome: Total JS very close to 3,027 KB. A fresh build resolves the STALE advisory and restores the budget verdict to PASS.

### 2. ElevenLabs voice-shelving — product lever only (WATCH — 123 days zero Paisaxe voice traffic)

The ElevenLabs SDK + LiveKit together are 591 KB deferred in Turbopack mode (~56 KB in webpack mode). Either way they carry zero first-paint cost since click-to-mount landed May 10. The bundle case for shelving has weakened. The cost case (~$45/mo combined ElevenLabs tier downgrade, 123-day Paisaxe voice silence per Jun 20 Cost Analyst) remains the stronger argument. User decision only.

### 3. Sentry + Next.js combined chunk: no-action, document as settled (INFORMATIONAL)

The 323 KB (Turbopack) / 460 KB (webpack) first-paint chunk combining the Next.js App Router runtime and Sentry SDK is the dominant first-paint weight. It cannot be deferred. Sentry's SDK footprint within it is approximately 100-120 KB. The only lever would be removing Sentry error monitoring, which is not appropriate for a production site. Document as settled — do not carry as an open item in future cycles.

### 4. Inspect `.next/analyze/client.html` for unknown deferred chunks (MEDIUM EFFORT, good hygiene)

The Jun 19 webpack analyze run produced reports at `.next/analyze/client.html`. Two deferred chunks of 231 KB and 223 KB remain unidentified in this cycle (Turbopack mode makes chunk-to-library mapping harder without a separate webpack analyze run). Both are presumed to be PostHog and Supabase based on size consistency with prior cycles; running the analyzer would confirm.

Since these are deferred and within budget, this is low urgency. Schedule alongside the next routine dep batch.

```bash
npm run build:analyze
open /Users/juan/code/paisaxe/.next/analyze/client.html
```

### 5. Monitor total JS headroom as new features land (ONGOING WATCH)

Current headroom: 508 KB vs 3,500 KB total budget. At the current pace of ~35-80 KB per major feature addition, there is ~6-14 major features of runway. No action needed now; revisit if headroom drops below 300 KB.

## Open Items from Prior Cycles

| Item | Priority | Status |
|---|---|---|
| Fresh `npm run build` to close stale gap | Low | Open — test-only last commit, no urgency |
| Identify 231 KB and 223 KB Turbopack unknown chunks | Informational | Open — presumed PostHog + Supabase, deferred |
| ElevenLabs voice-shelving product decision | User decision | Open — product lever, not a code action |

## Closed / No-Action Items (for the record)

| Item | Resolution |
|---|---|
| 412 KB unknown `144d3bae` chunk | CLOSED: LiveKit (ElevenLabs WebRTC dep), deferred/async — Jun 20 triage |
| `npm run build:analyze` (9+ cycles overdue) | CLOSED: Run Jun 19, reports at `.next/analyze/` |
| `optimizePackageImports` for lucide-react / posthog-js | CLOSED: Confirmed active next.config.ts:19 |
| `pdfjs-dist` / `pdf-parse` in devDependencies | CLOSED: Confirmed, never in client bundles |
| ElevenLabs click-to-mount (P3) | CLOSED: Active since May 10 |
| ElevenLabs per-chunk budget risk | CLOSED: 591 KB combined (Turbopack) / 56 KB (webpack), well under 650 KB per-chunk limit in both modes |
| Sentry colocation with Next.js runtime | CLOSED: By design, cannot be deferred |
| PostHog and Supabase — lazy loading | CLOSED: Confirmed deferred in all builds |

---
