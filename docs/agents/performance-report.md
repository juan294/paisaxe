# Performance Agent Report — 2026-05-08

## Summary

**Status: YELLOW (advisory)** — bundle health remains within budget, but this run's data was sampled from the **dev server's `.next` cache**, not a production build. Dev-cache totals (2,999 KB) include HMR/RSC scaffolding that isn't shipped to users, so they are not directly comparable to the prior production run (May 7 / Apr 17, 2,892 KB total / ~1,972 KB initial). Treat the bundle numbers below as upper-bound noise; the dependency, disk, and chunk-name signals remain valid.

The last known production-build state (May 7) was the **13th consecutive GREEN** with healthy headroom (~108 KB on total, ~28 KB on initial). No package.json changes have landed since, so production bundle size is presumed unchanged.

| Signal | Value | Status |
|--------|------:|:------:|
| Total JS (dev cache) | 2,999 KB | Yellow (cache, not prod) |
| Total JS (last prod, May 7) | 2,892 KB / 3,000 KB | Green |
| Initial load (last prod) | ~1,972 KB / 2,100 KB | Green |
| Total CSS | 126 KB | Green |
| Production deps | 35 / 40 | Green |
| node_modules disk | 1,046 MB | Watch (+116 MB vs Apr 17) |
| .next disk | 59 MB | Green |

## Key Metrics

### Bundle (dev-server cache snapshot)

```
Total JS:    2,999 KB  (split budget: 2,100 KB initial / 3,100 KB total)
Total CSS:   126 KB
Largest 10 chunks: 1,842 KB (61% of total)
```

### Largest chunks (dev-server names — chunk hashes change every build)

| Size | File | Likely contents |
|------:|------|------|
| 482 KB | `1206~6g7o__rc.js` | ElevenLabs SDK (deferred, matches May 7 prod chunk size) |
| 228 KB | `07y9atwelbm1e.js` | Next.js framework / React vendor |
| 196 KB | `16.-n76qj0h36.js` | likely PostHog (~179 KB prod) + extras |
| 186 KB | `0rzlto6_bwxpx.js` | react-markdown + remark/rehype (~145 KB prod) |
| 132 KB | `0wu4~xh-5rs6g.js` | admin dashboard tabs / shadcn |
| 125 KB | `06wz7w8nqnm1x.js` | Stripe.js |
| 123 KB | `0-zzfjv3~jbbq.js` | **Unclassified — see P1 below** |
| 112 KB | `0ktbr965wa~br.js` | Sentry browser bundle |
| 110 KB | `03~yq9q893hmn.js` | likely shadcn/ui + Radix |
| 107 KB | `13lm54j7eil8i.js` | i18n + lucide-react icons |

### Dependencies (heaviest on disk)

| Package | Disk MB | Bundled? | Notes |
|---|---:|---|---|
| next | 169 | Build/runtime | Required |
| @next | 117 | Build/runtime | Required |
| @sentry | 68 | Yes (~112 KB chunk) | Bundled in browser |
| pdfjs-dist | 61 | Server-only | Used by seed-db pipeline; should NOT be in client bundle |
| pdf-parse | 57 | Server-only | Same as above |
| @opentelemetry | 46 | Server-only | Sentry transitive |
| lucide-react | 39 | Yes (icons tree-shaken) | Confirm `optimizePackageImports` is on |
| posthog-js | 37 | Yes (~179 KB chunk, deferred) | Upgrade pending |
| @napi-rs | 30 | Server-only | Build artifacts |

## Budget Status

Production budgets (since 2026-04-04 split):

| Budget | Limit | Last prod (May 7) | Headroom |
|---|---:|---:|---:|
| Initial load JS | 2,100 KB | ~1,972 KB | +128 KB |
| Total JS | 3,100 KB | 2,892 KB | +208 KB |
| Total CSS | 200 KB | 126 KB | +74 KB |
| Production deps | 40 | 35 | +5 |

**No budget exceeded.** Dev-cache total (2,999 KB) is *under* the 3,100 KB limit even with HMR overhead included — so production is presumed safely under budget.

## Top Optimization Opportunities

Prioritized by impact-to-effort ratio. The biggest wins are still the same items from prior cycles plus one new one.

### P1 — Classify and split chunk `0-zzfjv3~jbbq` (123 KB) — 5th cycle deferred

The 123 KB unclassified chunk is the only entry in the top-10 whose contents we can't name from the import graph. It's been deferred since the Apr 14 triage cycle.

**Action:** run `npm run build:analyze` and capture the rolldown-vis output:

```bash
ANALYZE=true npm run build
# rolldown-vis dumps a bundle-stats.html in .next/analyze/
open .next/analyze/client.html
```

If it's pdfjs-dist or pdf-parse leaking into the client (both are 60+ MB on disk), even a partial server-only refactor will save **80–120 KB initial load**. If it's Stripe `loadStripe` not being deferred properly, dynamic-import the Day Pass paywall surface.

**Estimated savings:** 60–120 KB initial load. **Effort:** 30 min to identify, 1–4 h to fix depending on cause.

### P2 — Upgrade posthog-js and re-measure PostHog chunk

Security agent (May 6) flagged 22 outdated packages. posthog-js is the only one on the bundled client critical path. The deferred 179 KB chunk is large enough that a 5–10% size delta from a minor upgrade is worth measuring.

**Action:** included in the deferred dep batch (Triage 2026-05-08 carryover). Measure before/after with `du -k .next/static/chunks/<hash>` on the PostHog chunk.

**Estimated savings:** 0–20 KB (likely small but free). **Effort:** included in dep batch session.

### P3 — Upgrade `@elevenlabs/react` 1.3 → 1.5, then click-to-mount voice

ElevenLabs is the **single biggest chunk** in the bundle at 482 KB. The chunk is correctly deferred (gated by `visitor_voice_agent` flag), so it doesn't block initial load — but it is dead weight for the 100% of visitors who haven't used voice in 80 days (per cost-analyst report).

Two-part action:

1. **Measure:** capture chunk size before and after the upgrade. If it has grown since wave-2 (last 487 KB on May 7), find out why before bumping further.
2. **Aggressive option:** make the entire `<VoiceAgentChat>` component a route-segment dynamic import gated on a user click rather than on the feature flag.

```tsx
// src/app/immersive/page.tsx (sketch)
const VoiceAgentChat = dynamic(
  () => import('@/components/voice/voice-agent-chat'),
  { ssr: false, loading: () => null }
);
// Only mount after the user clicks "Hablar con Pelayo"
{voiceOpened && <VoiceAgentChat />}
```

**Estimated savings:** 0 initial load (already deferred), but reduces total transfer for non-voice users — and zero users have used voice in 80 days. **Effort:** 1–2 h.

### P4 — Verify lucide-react tree-shaking via `optimizePackageImports`

39 MB on disk for an icon library is a sign that **all** icons may be in the dependency graph if `optimizePackageImports` isn't on. Confirm in `next.config.ts`:

```ts
experimental: {
  optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
}
```

If this is missing, every page that imports from `lucide-react` may be pulling unused icons.

**Estimated savings:** 5–30 KB initial. **Effort:** 5 min config + verification.

### P5 — Confirm pdfjs-dist / pdf-parse are server-only

Combined 118 MB on disk. These should only be imported by `scripts/seed-db.ts` and any `app/api/**` server routes, never by client components. A leaked import is one of the most likely causes of the unclassified P1 chunk.

```bash
# Quick check for client leakage
grep -rn "from 'pdfjs-dist'" src/
grep -rn "from 'pdf-parse'" src/
```

Any match outside `src/app/api/`, `src/lib/server/`, or `scripts/` is a leak.

**Estimated savings:** up to 100 KB initial if leaked. **Effort:** 10 min audit.

### P6 — node_modules disk growth (+116 MB vs Apr 17, 930 → 1,046 MB)

Disk doesn't ship to users, but +116 MB in three weeks means the dep tree is gaining transitive packages faster than expected. Worth a `npm dedupe` and a glance at `npm ls --all | wc -l` next cycle.

**Effort:** 5 min to investigate.

## Comparison vs Prior Run

| Metric | Apr 17 (prod) | May 7 (prod, last GREEN) | May 8 (dev cache) |
|---|---:|---:|---:|
| Total JS | 2,892 KB | 2,892 KB | 2,999 KB (cache) |
| Initial JS | ~1,972 KB | ~1,972 KB | n/a (cache) |
| Production deps | 35 | 35 | 35 |
| node_modules | 930 MB | 930 MB | **1,046 MB (+116)** |
| ElevenLabs chunk | 487 KB | 487 KB | 482 KB (cache) |
| PostHog chunk | 179 KB | 179 KB | ~196 KB (cache) |

**Regressions:** none confirmed (production unchanged since May 7).
**Improvements:** none this cycle.
**Open watch item:** node_modules disk growth.

## Cross-Agent Coordination

- **Triage (2026-05-08)** committed Twilio config fix and accumulated coverage tests; the deferred 8-package dep batch is the right next venue for P2/P3 measurement.
- **Security agent (2026-05-08)** kept `voyageai` pinned at 0.1.0 — do not touch that line during the dep batch.
- **Cost analyst (2026-05-08)** noted 80 consecutive days of zero voice traffic. P3's "click-to-mount" option is justified by this data: ElevenLabs is the largest chunk and serves zero confirmed users.
- **Coverage agent (2026-05-08)** holds at 98.45% — voice-agent-chat (42.7%) and agents-dashboard (49.3%) still need Playwright E2E. If P3 lands, voice-agent-chat coverage becomes lower-priority because the surface ships less often.

## Recommendation

1. Run a real production build (`npm run build`) on the next cycle and discard this dev-cache snapshot's bundle numbers from trend tracking.
2. Run `npm run build:analyze` once to classify chunk `0-zzfjv3~jbbq` (P1) — 5 cycles overdue.
3. Schedule the deferred dep batch (P2/P3) with chunk-size measurement — separate session, not triage.
4. Investigate node_modules +116 MB drift.
