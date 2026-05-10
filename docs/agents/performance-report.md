# Performance Agent Report — 2026-05-10

## Summary

**Status: YELLOW (advisory)** — bundle health remains within budget, but this run's data was sampled from the **dev server's `.next` cache** for the **third consecutive cycle** (dev server was running, production build skipped). Dev-cache totals (2,999 KB) include HMR/RSC scaffolding not present in production builds. Treat bundle numbers as upper-bound noise; dependency and chunk-name signals remain valid.

The last known production-build state (May 7) was the **13th consecutive GREEN** with healthy headroom (+208 KB total, +128 KB initial). No package.json changes have landed since, so production bundle size is presumed unchanged at **2,892 KB / 3,100 KB**.

P4 and P5 remain closed from the May 9 config audit:
- **P4 closed**: `optimizePackageImports` active for `lucide-react` and `posthog-js` in `next.config.ts`.
- **P5 closed**: `pdfjs-dist` and `pdf-parse` are `devDependencies` — excluded from production bundles by design.

| Signal | Value | Status |
|--------|------:|:------:|
| Total JS (dev cache, May 10) | 2,999 KB | Yellow (cache, not prod) |
| Total JS (last prod, May 7) | 2,892 KB / 3,100 KB | Green |
| Initial load (last prod) | ~1,972 KB / 2,100 KB | Green |
| Total CSS | 126 KB | Green |
| Production deps | 35 / 40 | Green |
| node_modules disk | 1,047 MB | Watch |
| .next disk | 59 MB | Green |

## Key Metrics

### Bundle (dev-server cache snapshot)

```
Total JS:    2,999 KB  (split budget: 2,100 KB initial / 3,100 KB total)
Total CSS:   126 KB
Largest 10 chunks: 1,797 KB (60% of total)
```

### Largest chunks (dev-server names — chunk hashes change every build)

| Size | File | Likely contents |
|------:|------|------|
| 493 KB | `1206~6g7o__rc.js` | ElevenLabs SDK (deferred, consistent with prior 482–493 KB readings) |
| 233 KB | `07y9atwelbm1e.js` | Next.js framework / React vendor |
| 201 KB | `16.-n76qj0h36.js` | PostHog (~179 KB prod) + extras |
| 190 KB | `0rzlto6_bwxpx.js` | react-markdown + remark/rehype (~145 KB prod) |
| 135 KB | `0wu4~xh-5rs6g.js` | Admin dashboard tabs / shadcn |
| 128 KB | `06wz7w8nqnm1x.js` | Stripe.js |
| 125 KB | `0-zzfjv3~jbbq.js` | **Unclassified — see P1 below (7th cycle deferred)** |
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
| lucide-react | 39 | Yes (tree-shaken) | `optimizePackageImports` confirmed active |
| posthog-js | 37 | Yes (~179 KB, deferred) | `optimizePackageImports` confirmed active |
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

**No budget exceeded.** Dev-cache total (2,999 KB) is under the 3,100 KB limit even with HMR overhead — production is presumed safely under budget. Headroom is healthy but narrowing: 128 KB initial headroom leaves room for roughly 1–2 medium-sized new features before the initial budget needs attention.

## Top Optimization Opportunities

### P1 — Classify and split chunk `0-zzfjv3~jbbq` (125 KB) — 7th cycle deferred

The 125 KB unclassified chunk is the only top-10 entry whose contents remain unknown. This is now the single most overdue actionable item across all agents (triage has called it out for 6 consecutive cycles). Without a production build and bundle analyzer, it cannot be identified or reduced.

Likely candidates: Supabase Realtime client (not tree-shaken), a Stripe utility pulled outside the paywall gate, or an admin-panel dependency missing a lazy-load boundary. P5 closing (pdfjs-dist is dev-only) rules out PDF library leakage.

**Action:**

```bash
ANALYZE=true npm run build
open .next/analyze/client.html
```

**Estimated savings:** 30–100 KB initial load if splittable. **Effort:** 30 min to identify, 1–4 h to fix.

### P2 — Dep batch: upgrade 8 packages and measure chunk deltas

Security agent (May 10) confirmed 16th consecutive GREEN with 23 outdated packages, zero CVEs. Client-bundle-critical packages needing before/after chunk measurement:

- `@elevenlabs/react` 1.3.0 → 1.6.0 — measure the 493 KB deferred ElevenLabs chunk
- `posthog-js` → latest — measure the ~201 KB deferred PostHog chunk
- `@supabase/supabase-js` → 2.105.4 (patch)
- `tailwindcss` / `@tailwindcss/postcss` → 4.3.0 (build-time only, no client impact)
- `next` 16.2.4 → 16.2.5 (patch)
- `react` / `react-dom` 19.2.5 → 19.2.6 (patch)
- `stripe` 22.1.0 → 22.1.1 (patch)
- `resend` 6.12.2 → 6.12.3 (patch)

Do NOT include `voyageai` — hard-pinned at 0.1.0 (0.2.x is breaking). Review `@anthropic-ai/sdk` 0.93.0 → 0.95.1 changelog separately before including (3 minor versions, requires vetting).

**Estimated savings:** 0–25 KB per chunk (likely small). **Effort:** 1 session, separate from triage.

### P3 — Click-to-mount voice widget (493 KB chunk, 82 days zero traffic)

ElevenLabs is the single largest bundle chunk. It is correctly deferred (gated by `visitor_voice_agent` feature flag), so it does not block initial load. However, the cost analyst has confirmed zero Paisaxe voice traffic for 82 consecutive days and zero full-account ElevenLabs activity for 24 days. The 493 KB chunk is shipped on every immersive page load for users who will never click "Hablar con Pelayo."

**Action:** gate the component mount on an explicit user interaction rather than only on the feature flag:

```tsx
// src/app/immersive/page.tsx (sketch)
const VoiceAgentChat = dynamic(
  () => import('@/components/voice/voice-agent-chat'),
  { ssr: false, loading: () => null }
);

// Only mount — and only fetch the 493 KB chunk — after the user clicks the button
{voiceOpened && <VoiceAgentChat />}
```

This eliminates the ElevenLabs chunk download for 100% of current non-voice visitors.

**Estimated savings:** 493 KB eliminated from non-voice user sessions (0 change to initial parse score — already deferred). **Effort:** 1–2 h.

### ~~P4 — Verify lucide-react tree-shaking via `optimizePackageImports`~~ CLOSED

`next.config.ts:18` confirms `optimizePackageImports: ["lucide-react", "posthog-js"]` is active.

### ~~P5 — Confirm pdfjs-dist / pdf-parse are server-only~~ CLOSED

Both are in `devDependencies` — excluded from the production bundle. The combined 118 MB disk footprint is build-tooling only.

### P6 — node_modules disk growth (stable at 1,047 MB, up +117 MB vs Apr 17)

node_modules grew from 930 MB (Apr 17) to 1,047 MB (May 9), a 12.6% increase over three weeks with only minor patch-level dep changes. The figure has been flat across May 8–10, suggesting the growth is settled, not actively expanding. Transitive dependency churn from patch releases is the likely cause.

**Action:**

```bash
npm dedupe
du -sh node_modules
npm ls canvas  # canvas (19 MB disk) — confirm it is needed
```

**Effort:** 10 min to investigate, 5 min to fix if deduplication works.

## Comparison vs Prior Runs

| Metric | Apr 17 (prod) | May 7 (prod) | May 8 (dev cache) | May 9 (dev cache) | May 10 (dev cache) |
|---|---:|---:|---:|---:|---:|
| Total JS | 2,892 KB | 2,892 KB | 2,999 KB | 2,999 KB | 2,999 KB |
| Initial JS | ~1,972 KB | ~1,972 KB | n/a | n/a | n/a |
| Production deps | 35 | 35 | 35 | 35 | 35 |
| node_modules | 930 MB | 930 MB | 1,046 MB | 1,047 MB | 1,047 MB |
| ElevenLabs chunk | 487 KB | 487 KB | 482 KB | 493 KB | 493 KB |
| PostHog chunk | 179 KB | 179 KB | ~196 KB | ~201 KB | ~201 KB |

**Regressions:** None confirmed in production (unchanged since May 7). ElevenLabs and PostHog chunk readings fluctuate in dev cache — not meaningful without a production build.

**Improvements this cycle:** None — no code or dep changes landed. P4 and P5 remain closed from May 9 audit.

**Open items:** unclassified P1 chunk (7th cycle deferred), dep batch (P2), voice click-to-mount (P3), node_modules growth investigation (P6).

## Cross-Agent Coordination

- **Security agent (2026-05-10)** confirmed GREEN (16th consecutive), 23 outdated packages, zero CVEs. `voyageai` stays hard-pinned at 0.1.0. CSP header absent from automated live capture for multiple cycles — source confirmed correct; manual curl recommended.
- **Cost analyst (2026-05-10)** confirmed 82 days of zero Paisaxe voice traffic and 24 days of full-account ElevenLabs silence. P3 click-to-mount case strengthens further — 493 KB serving zero users.
- **Coverage agent (2026-05-10)** at 98.55% statements / 95.14% branches — test-only additions this cycle, zero bundle impact.
- **Triage (2026-05-09)** identified P1 `build:analyze` as highest-priority outstanding technical action (6 cycles overdue at that point, now 7).
- **Localization agent (2026-05-10)** confirmed i18n bundles stable at ~15 KB each; lazy-loading split (es+en static, fr/de/pt/ast dynamic) unchanged.
- **Documentation agent (2026-05-10)** GREEN for 23rd consecutive run — no doc-impacting changes.

## Recommendation

1. **Immediate:** Run a real production build (`npm run build`) in the next cycle. Three consecutive dev-cache snapshots break the bundle size trendline and make trend analysis unreliable.
2. **Immediate:** Run `npm run build:analyze` to classify chunk `0-zzfjv3~jbbq` (P1) — 7th consecutive cycle deferred. This is the most overdue actionable item in the project.
3. **This week:** Schedule the dep batch (P2) with before/after chunk measurement for `@elevenlabs/react` 1.3.0 → 1.6.0 and `posthog-js`.
4. **Consider:** Implement P3 (click-to-mount voice widget) given 82-day zero-traffic reality — eliminates 493 KB from every current visitor session with minimal effort.
5. **Low priority:** Investigate node_modules growth with `npm dedupe` (P6) — 10-minute task.

---
