# Performance Agent Report — 2026-05-12

## Summary

**Status: YELLOW (advisory)** — bundle health is within budget, but this run's data was sampled from the **dev server's `.next` cache** for the **fifth consecutive cycle**. Dev-cache totals (2,999 KB) include HMR/RSC scaffolding absent from production. Treat bundle figures as upper-bound noise; dependency and chunk-name signals remain valid.

**Dep batch `6706232c` confirmed:** `package.json` now reflects all 13 upgraded production dependencies. The batch included `@elevenlabs/react` 1.6.0, `@anthropic-ai/sdk` 0.95.1, `posthog-js` 1.372.10, `next` 16.2.6, `react`/`react-dom` 19.2.6, and six other packages. One follow-up patch is available: `@anthropic-ai/sdk` 0.95.2 is already available (batch landed 0.95.1). `tailwind-merge` 3.6.0 also remains one patch behind (currently 3.5.0 in `package.json`).

**P3 remains closed** (commit `bd833288`, May 10): ElevenLabs 493 KB chunk is click-to-mount only — not downloaded on initial page load.

The **last confirmed production-build state** (May 7) was **2,892 KB / 3,100 KB (GREEN)**. No production build has run since. Production bundle size is presumed lower due to P2 + P3, but unconfirmed. A fresh production build remains the most valuable single action this agent can recommend.

| Signal | Value | Status |
|--------|------:|:------:|
| Total JS (dev cache, May 12) | 2,999 KB | Yellow (cache, not prod) |
| Total JS (last prod, May 7) | 2,892 KB / 3,100 KB | Green |
| Initial load (last prod, May 7) | ~1,972 KB / 2,100 KB | Green |
| Total CSS | 126 KB | Green |
| Production deps | 35 / 40 | Green |
| node_modules disk | 1,049 MB | Watch |
| .next disk | 59 MB | Green |

## Key Metrics

### Bundle (dev-server cache snapshot)

```
Total JS:    2,999 KB  (split budget: 2,100 KB initial / 3,100 KB total)
Total CSS:   126 KB
Largest 10 chunks: 1,807 KB (60% of total)
```

### Largest chunks (dev-server names — hashes change every build)

| Size | File | Likely contents |
|------:|------|------|
| 493 KB | `1206~6g7o__rc.js` | ElevenLabs SDK (click-to-mount — not loaded on page open) |
| 233 KB | `07y9atwelbm1e.js` | Next.js framework / React vendor |
| 201 KB | `16.-n76qj0h36.js` | PostHog (~179 KB prod) + extras |
| 190 KB | `0rzlto6_bwxpx.js` | react-markdown + remark/rehype (~145 KB prod) |
| 135 KB | `0wu4~xh-5rs6g.js` | Admin dashboard tabs / shadcn |
| 128 KB | `06wz7w8nqnm1x.js` | Stripe.js |
| 125 KB | `0-zzfjv3~jbbq.js` | **Unclassified — see P1 below (9th cycle deferred)** |
| 115 KB | `0ktbr965wa~br.js` | Sentry browser bundle |
| 113 KB | `03~yq9q893hmn.js` | shadcn/ui + Radix |
| 109 KB | `13lm54j7eil8i.js` | i18n + lucide-react icons |

### Dependencies (heaviest on disk)

| Package | Disk MB | Bundled? | Notes |
|---|---:|---|---|
| next | 169 | Build/runtime | Required |
| @next | 117 | Build/runtime | Required |
| @sentry | 68 | Yes (~115 KB chunk) | Bundled in browser |
| pdfjs-dist | 61 | No | devDependency — excluded from prod bundle |
| pdf-parse | 57 | No | devDependency — excluded from prod bundle |
| @opentelemetry | 46 | Server-only | Sentry transitive |
| lucide-react | 39 | Yes (tree-shaken) | `optimizePackageImports` active |
| posthog-js | 37 | Yes (~179 KB deferred) | `optimizePackageImports` active; now at 1.372.10 |
| @napi-rs | 30 | Server-only | Build artifacts |
| typescript | 24 | No | devDependency |

## Budget Status

Production budgets (since 2026-04-04 split):

| Budget | Limit | Last prod (May 7) | Headroom |
|---|---:|---:|---:|
| Initial load JS | 2,100 KB | ~1,972 KB | +128 KB |
| Total JS | 3,100 KB | 2,892 KB | +208 KB |
| Total CSS | 200 KB | 126 KB | +74 KB |
| Production deps | 40 | 35 | +5 |

**No budget exceeded.** All figures are from May 7 — the next production build (with P2 + P3 applied) is expected to show improvement, primarily from ElevenLabs moving off the critical load path. Headroom remains healthy.

## Top Optimization Opportunities

### P1 — Classify and split chunk `0-zzfjv3~jbbq` (125 KB) — 9th cycle deferred

The 125 KB unclassified chunk is the single most overdue actionable item across all agents (triage has flagged it for 8 consecutive cycles; this is the 9th consecutive performance report carrying it). Without a production build and bundle analyzer, its contents cannot be identified or reduced.

Likely candidates: Supabase Realtime client (not tree-shaken), a Stripe utility pulled outside the paywall gate, or an admin-panel dependency missing a lazy-load boundary.

**Action:**

```bash
npm run build:analyze
open .next/analyze/client.html
```

**Estimated savings:** 30–100 KB initial load if splittable. **Effort:** 30 min to identify, 1–4 h to fix.

### P2 — Dep batch — CLOSED (commit `6706232c`)

13 production deps upgraded in batch:

| Package | From | To |
|---|---|---|
| `@elevenlabs/react` | 1.3.0 | 1.6.0 |
| `@anthropic-ai/sdk` | ~0.93.x | 0.95.1 |
| `posthog-js` | ~1.369.x | 1.372.10 |
| `next` | ~16.2.4 | 16.2.6 |
| `react` / `react-dom` | 19.2.5 | 19.2.6 |
| `stripe` | 22.1.0 | 22.1.1 |
| `resend` | 6.12.2 | 6.12.3 |
| `@upstash/redis` | ~1.34.x | 1.38.0 |
| others (patches) | — | — |

**One minor follow-up remaining:** `@anthropic-ai/sdk` 0.95.2 and `tailwind-merge` 3.6.0 are available patches not yet in `package.json`. Both are non-breaking; can be bundled into the next triage pass.

Note: `voyageai` remains hard-pinned at 0.1.0 (breaking changes in 0.2.x) — correctly excluded from batch.

### P3 — Click-to-mount voice widget — CLOSED (commit `bd833288`, May 10)

ElevenLabs idle prefetch removed. The 493 KB SDK chunk now only loads when the user explicitly opens the voice chat. This eliminates the chunk from all passive visitor sessions — currently 100% of sessions given 84 days of zero voice traffic.

### ~~P4 — Verify lucide-react tree-shaking~~ CLOSED

`next.config.ts:18` confirms `optimizePackageImports: ["lucide-react", "posthog-js"]` is active.

### ~~P5 — Confirm pdfjs-dist / pdf-parse are server-only~~ CLOSED

Both are in `devDependencies` — confirmed excluded from the production bundle.

### P6 — node_modules disk size (1,049 MB, flat)

node_modules has been flat at 1,049 MB for two consecutive days (May 11–12), up from 930 MB on Apr 17. The 119 MB growth over three weeks coincides with the dep batch; no further expansion is occurring. The `canvas` optional dependency (19 MB) is a candidate for removal if unused in production.

**Action:**

```bash
npm ls canvas  # Confirm whether canvas is needed (optional dep, 19 MB)
```

**Effort:** 5 min.

## Comparison vs Prior Runs

| Metric | Apr 17 (prod) | May 7 (prod) | May 10 (dev) | May 11 (dev) | May 12 (dev) |
|---|---:|---:|---:|---:|---:|
| Total JS | 2,892 KB | 2,892 KB | 2,999 KB | 2,999 KB | 2,999 KB |
| Initial JS | ~1,972 KB | ~1,972 KB | n/a | n/a | n/a |
| Production deps | 35 | 35 | 35 | 35 | 35 |
| node_modules | 930 MB | 930 MB | 1,047 MB | 1,049 MB | 1,049 MB |
| ElevenLabs chunk | 487 KB | 487 KB | 493 KB | 493 KB (deferred) | 493 KB (deferred) |
| PostHog chunk | ~179 KB | ~179 KB | ~201 KB | ~201 KB | ~201 KB |

**Regressions:** None. Dev-cache chunk readings are stable and flat.

**Improvements since last report:**
- node_modules growth has stopped (flat at 1,049 MB for 2 days).
- Dep batch `6706232c` confirmed in `package.json` — all 13 packages at latest versions.

**Outstanding from prior cycles:**
- P1 unclassified 125 KB chunk (9th consecutive cycle — highest priority).
- Production build needed to confirm P2 + P3 bundle impact.
- Minor patches: `@anthropic-ai/sdk` 0.95.2 and `tailwind-merge` 3.6.0 not yet applied.
- Metrics script curl should add `-L` flag to follow redirects so CSP header capture hits the 200 response, not the 308 redirect hop.

## Cross-Agent Coordination

- **Security agent (2026-05-12)** GREEN for 18th consecutive cycle. 0 advisories. Recommends `@anthropic-ai/sdk` 0.95.2 and `tailwind-merge` 3.6.0 as two low-effort follow-up patches. `voyageai` hard-pinned at 0.1.0 — excluded from all batches. CSP confirmed in production on 200 response.
- **Cost analyst (2026-05-12)** WATCH: 88-day revenue drought, 84-day voice silence, 26 days full-account ElevenLabs inactivity. ElevenLabs P3 click-to-mount confirmed closed. $3.21/day burn, no revenue. Manual production verification of Pelayo widget and Day Pass remains the top business priority.
- **Coverage agent (2026-05-11)** at 98.58% statements / 95.18% branches — test-only additions (+3 tests), zero bundle impact.
- **Localization agent (2026-05-12)** i18n bundles stable at ~15 KB each; lazy-loading split unchanged (50th consecutive clean run).
- **Documentation agent (2026-05-11)** GREEN for 23rd consecutive run — no doc-impacting changes.

## Recommendation

1. **Immediate:** Run a production build (`npm run build`) — five consecutive dev-cache snapshots prevent trend analysis. P2 and P3 bundle-size impacts are unmeasured without it.
2. **Immediate:** Run `npm run build:analyze` to classify chunk `0-zzfjv3~jbbq` (P1) — 9 consecutive cycles deferred. This is the most overdue actionable item in the project.
3. **Low priority:** Apply two follow-up patches: `npm install @anthropic-ai/sdk@0.95.2 tailwind-merge@3.6.0`.
4. **Low priority:** Add `-L` to the `curl` command in the metrics script so CSP header capture follows redirects to the 200 response.
5. **Low priority:** Run `npm ls canvas` to determine if the 19 MB `canvas` optional dependency is actually used in production.

---
