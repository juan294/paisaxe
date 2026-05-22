# Performance Agent Report — 2026-05-21

## Summary

**Status: YELLOW** — total JS is **3,082 KB / 3,100 KB budget** (18 KB headroom), **unchanged for the 7th consecutive cycle**. The largest 10 chunk hashes are byte-identical to May 15, 16, 17, 18, 19, and 20 (`144d3bae.2652f904bbcc62ad.js`, `7644-509cebe606f4f574.js`, `4bd1b696-4eb1eca0fdc48acb.js`, ...). The metrics script is still inspecting the `.next` cache produced by the running dev server — same "dev cache, not prod build" caveat as the prior seven cycles.

No source, dependency, or lockfile changes landed in the last 24 hours. Security agent (2026-05-21) again flags the same `brace-expansion@5.0.5` advisory (GHSA-jxxr-4gwj-5jf2, not exploitable). Fix continues to be a one-line override bump (`">=5.0.5"` → `">=5.0.6"`) plus `npm install` — lockfile-only, zero expected bundle impact, naturally batched with the long-overdue `build:analyze`.

The +190 KB regression vs the last confirmed prod build (May 7, 2,892 KB → dev-cache 3,082 KB) is now in its **eighth consecutive cycle without verification**. With 18 KB of headroom, any silent regression from the next dep upgrade will breach the 3,100 KB total-JS budget.

P3 (ElevenLabs click-to-mount, `bd833288`, May 10) remains the most recent applied optimization. The 463 KB ElevenLabs chunk is deferred from first paint but still counts toward total JS. Cost analyst (2026-05-21) confirms **93 days of zero Paisaxe voice traffic** and **35 days of full ElevenLabs account silence** — that chunk currently serves no one.

| Signal | Value | Status |
|---|---:|:---:|
| Total JS (May 21) | 3,082 KB | Yellow — 18 KB to budget |
| Total JS (May 15 – May 21) | 3,082 KB | (unchanged 7th cycle) |
| Total JS (May 7 prod) | 2,892 KB | (+190 KB vs last confirmed prod) |
| Total CSS | 121 KB | Green |
| Production deps | 35 / 40 | Green |
| node_modules disk | 1,049 MB | Watch (flat 10th cycle) |
| .next disk | 1,126 MB | Watch (build cache, not bundle) |

## Key Metrics

### Bundle

```
Total JS:    3,082 KB  (split budget: 2,100 KB initial / 3,100 KB total)
Total CSS:   121 KB
Largest 10 chunks: 2,171 KB (70.4% of total)
Headroom to total budget: 18 KB
```

### Largest chunks (hashes identical to May 15 / 16 / 17 / 18 / 19 / 20)

| Size | File | Likely contents |
|---:|---|---|
| 463 KB | `144d3bae.2652f904bbcc62ad.js` | ElevenLabs SDK (deferred via click-to-mount) |
| 452 KB | `7644-509cebe606f4f574.js` | Admin route bundle (analytics + dialogs) |
| 196 KB | `4bd1b696-4eb1eca0fdc48acb.js` | PostHog (~179 KB) + overhead |
| 186 KB | `9da6db1e.66956ed91cfbda8a.js` | react-markdown + remark/rehype |
| 186 KB | `framework-65be2e97b05e8401.js` | Next.js framework / React vendor |
| 165 KB | `9831-33dc756f68778806.js` | Stripe.js + shadcn/Radix overflow |
| 144 KB | `main-94a0d1d204c02158.js` | App entry / proxy bootstrap |
| 111 KB | `6444.d06fbb22973e0124.js` | Sentry browser bundle |
| 110 KB | `polyfills-42372ed130431b0a.js` | Browserslist polyfills |
| 107 KB | `5283.af26141bd96b8e53.js` | i18n + lucide-react icons |

### Dependencies (heaviest on disk)

| Package | Disk MB | Bundled? | Notes |
|---|---:|---|---|
| next | 169 | Build/runtime | Required |
| @next | 117 | Build/runtime | Required |
| @sentry | 68 | Yes (~111 KB chunk) | Bundled in browser |
| pdfjs-dist | 61 | No | devDependency — excluded |
| pdf-parse | 57 | No | devDependency — excluded |
| @opentelemetry | 46 | Server-only | Sentry transitive |
| lucide-react | 39 | Yes (tree-shaken) | `optimizePackageImports` active |
| posthog-js | 36 | Yes (~196 KB deferred) | `optimizePackageImports` active |
| @napi-rs | 30 | Server-only | Build artifacts |
| typescript | 24 | No | devDependency |
| canvas | 19 | No | Optional dep, server-side only |

## Budget Status

| Budget | Limit | May 21 | Headroom |
|---|---:|---:|---:|
| Total JS | 3,100 KB | 3,082 KB | +18 KB |
| Total CSS | 200 KB | 121 KB | +79 KB |
| Initial load JS | 2,100 KB | unmeasured | — (needs prod build) |
| Production deps | 40 | 35 | +5 |

**No budget exceeded**, but 18 KB of headroom is one icon import or one minor dep upgrade away from breaching the 3,100 KB total-JS budget. The cumulative dep batch (P7) below carries a non-trivial probability of pushing past the budget — running it without `build:analyze` is risky.

## Top Optimization Opportunities

### P1 — Run a clean production build (17+ cycles overdue)

This is the highest-priority action and it is now blocking every measurement-dependent item below. Eight consecutive cycles have run against stale dev-server `.next` cache, so:

- The +190 KB regression vs the last confirmed prod build (May 7) is unverified.
- The "translation-locales extraction" claim from triage `d7328def` (May 14) is still unverified at chunk level — webpack analyzer hasn't been re-run in this report's data.

Procedure:

```bash
# Stop dev server first (kill -TERM <pid> or Ctrl+C), then:
rm -rf .next
npm run build
npm run build:analyze   # opens analyzer.html for chunk attribution
```

Compare the analyzer output to the baseline established by triage commit `d7328def`. **Effort:** 10 min build + 30 min comparison. **Information value:** unblocks every other P-item below.

### P2 — Admin route chunk (452 KB) splitting

The `7644-*` chunk is the second-largest payload and the largest non-deferred one. Tabs are already lazy-mounted (Speed Insights P1, Feb 9) but the entry chunk itself still includes the dashboard shell and all dialog imports.

Move the dialog and analytics-panel imports out of the route entry and into per-tab dynamic imports:

```ts
// src/app/admin/page.tsx — instead of static import
const StoryEditorDialog = dynamic(() => import("@/components/admin/story-editor-dialog"), {
  ssr: false,
});
const AnalyticsPanel = dynamic(() => import("@/components/admin/analytics-panel"), {
  ssr: false,
});
```

**Estimated savings:** 150–250 KB off the admin route, zero impact on public routes. **Effort:** 2–4 h. Cannot be measured without P1 first.

### P3 — ElevenLabs click-to-mount — CLOSED (commit `bd833288`, May 10)

The 463 KB chunk is deferred from first paint. Given 93 days of zero Paisaxe voice traffic and 35 days of full ElevenLabs account silence, this chunk currently serves no one. No further action; revisit only if voice usage returns.

### P4 — `optimizePackageImports` — CLOSED

`next.config.ts` confirms `optimizePackageImports: ["lucide-react", "posthog-js"]` is active.

### P5 — pdfjs-dist / pdf-parse — CLOSED

Both are in `devDependencies` — confirmed excluded from production bundle.

### P6 — Translation-locale extraction — CLOSED (triage `d7328def`, May 14)

Constants moved out of the `@anthropic-ai/sdk` import path into `src/lib/translation-locales.ts`. Verified at source level; chunk-level verification still pending the overdue `build:analyze` (P1).

### P7 — Outstanding minor patches (low priority — batch with P1)

Per security agent (2026-05-21) and cost analyst (2026-05-21), the following non-CVE production patches are pending. Pair them with the P1 `build:analyze` session in one worktree commit so any chunk-size delta is attributable. Note: security agent's May 21 batch list adds `@sentry/core` and `@elevenlabs/react`, bumping the batch to 10 packages.

- `@anthropic-ai/sdk` → 0.96.0
- `posthog-js` → 1.374.3 (may shift the deferred ~196 KB PostHog chunk)
- `@stripe/stripe-js` → 9.6.0
- `@stripe/react-stripe-js` → 6.4.0
- `@supabase/supabase-js` → 2.106.0
- `@sentry/nextjs` → 10.53.1
- `@sentry/core` → 10.53.1 (added May 21)
- `@elevenlabs/react` → latest minor (added May 21)
- `lucide-react` → 1.16.0 (may add icon variants affecting 107 KB i18n+icons chunk)
- `tailwind-merge` → 3.6.0 (CSS-only; expected zero JS impact)

Do NOT include `voyageai` (0.1.0 pin is intentional per security agent).

```bash
npm install @anthropic-ai/sdk@0.96.0 posthog-js@1.374.3 \
            @stripe/stripe-js@9.6.0 @stripe/react-stripe-js@6.4.0 \
            @supabase/supabase-js@2.106.0 \
            @sentry/nextjs@10.53.1 @sentry/core@10.53.1 \
            @elevenlabs/react@latest \
            lucide-react@1.16.0 tailwind-merge@3.6.0
npm run build:analyze
```

**Effort:** 10 min install + analyzer comparison. **Pairs naturally with P1.**

### P8 — `brace-expansion` advisory fix (carried from May 19)

Security agent (May 19/20/21) flags `brace-expansion@5.0.5` (GHSA-jxxr-4gwj-5jf2, moderate regex DoS). Not exploitable (build/test-only via minimatch/glob), but the existing override matches the vulnerable range. Lockfile-only change, zero expected bundle impact, naturally batches with P1/P7:

```json
// package.json overrides
"brace-expansion": ">=5.0.6"
```

```bash
npm install
npm audit
```

### P9 — node_modules disk (1,049 MB, flat 10th cycle)

Not blocking. `canvas` (19 MB optional) remains a removal candidate pending `npm ls canvas` confirmation that nothing imports it.

## Comparison vs Prior Runs

| Metric | May 7 (prod) | May 10 (dev) | May 15 | May 17 | May 19 | May 20 | May 21 |
|---|---:|---:|---:|---:|---:|---:|---:|
| Total JS | 2,892 KB | 2,999 KB | 3,082 KB | 3,082 KB | 3,082 KB | 3,082 KB | 3,082 KB |
| Production deps | 35 | 35 | 35 | 35 | 35 | 35 | 35 |
| node_modules | 930 MB | 1,047 MB | 1,049 MB | 1,049 MB | 1,049 MB | 1,049 MB | 1,049 MB |
| ElevenLabs chunk | 487 KB | 493 KB | 475 KB (def) | 475 KB (def) | 463 KB (def) | 463 KB (def) | 463 KB (def) |
| PostHog chunk | ~179 KB | ~201 KB | ~200 KB | ~200 KB | ~196 KB | ~196 KB | ~196 KB |
| Unclassified chunk | 125 KB | 125 KB | gone | gone | gone | gone | gone |
| Headroom (total) | +208 KB | +101 KB | +18 KB | +18 KB | +18 KB | +18 KB | +18 KB |

**Seventh consecutive cycle of zero change.** All chunk hashes are byte-identical to May 15 through May 20. The +190 KB regression vs May 7 prod has neither been verified nor refuted for eight cycles — it could be a genuine regression, a dev-vs-prod build artifact, or both.

**Outstanding from prior cycles:**
- P1: clean `npm run build` + `build:analyze` (17+ cycles overdue, blocking P2 / P6 / P7 measurement)
- P2: admin route chunk split (452 KB → target <200 KB)
- P7: 10 minor dep patches (expanded from 8 per security agent May 21)
- P8: `brace-expansion` override bump (carried from May 19, lockfile-only)

## Cross-Agent Coordination

- **Security agent (2026-05-21)** YELLOW — same single moderate advisory (`brace-expansion@5.0.5`), still not exploitable. Same recommendation: bundle the override bump + the now-10-package prod-dep batch into one worktree session with the long-overdue `build:analyze`.
- **Cost analyst (2026-05-21)** WATCH — 97-day revenue drought, 93-day Paisaxe voice silence, 35-day ElevenLabs full-account silence. Explicitly recommends the same single worktree session to close three open actions (brace-expansion override, 10-package dep batch, build:analyze). May certain to close at $0 revenue (fourth consecutive zero-revenue month, ~$366 cumulative loss since launch).
- **Coverage agent (2026-05-21)** 98.66% statements / 95.40% branches — plateau holds for the third consecutive cycle. Three uncommitted test deltas still safe to commit. Zero bundle impact.
- **Localization agent (2026-05-21)** 55th consecutive clean run; i18n locale chunks stable at ~15 KB each. No bundle-driven changes recommended.
- **Triage (2026-05-14)** ran the previous webpack analyzer, removed `@anthropic-ai/sdk` client-bundle leak via `src/lib/translation-locales.ts`, ran `npm audit fix`. Triage commit `d7328def` remains the last point where chunk attribution was fresh.

## Recommendation

1. **Immediate (P1 + P7 + P8, one worktree session):** Stop the dev server, `rm -rf .next`, apply the `brace-expansion` override and the 10 dep patches with one `npm install`, then run `npm run build:analyze`. This is the only way to (a) verify the +190 KB regression, (b) measure the cumulative effect of the pending patches, and (c) clear the brace-expansion advisory. **17+ cycles overdue** — the longer this slips, the larger the dep-batch surprise will be.
2. **Next sprint (P2):** Split the admin route chunk (452 KB) via per-tab dynamic imports — largest remaining gain on a non-deferred path. Cannot be measured without P1 first.
3. **Low (P9):** `npm ls canvas` to confirm the 19 MB optional dep is still reachable; remove if unused.

---
