# Performance Agent Report — 2026-06-04

## Summary

**Status: RED — total-JS budget BREACHED (confirmed, 2nd consecutive cycle).** The total JS is **3,398 KB against a 3,100 KB budget — a 298 KB (9.6%) overage.** This was first surfaced yesterday (Jun 3) by the only genuine production build in twelve cycles; today's run independently re-reads the same production artifacts and lands on the identical 3,398 KB, hardening the finding from "newly revealed" to "verified and stable."

### Provenance note — today's number is authoritative despite the dev-cache fallback

The metrics script again printed `Production build was skipped (dev server was running)` and reported 3,398 KB "from the dev cache." That label is misleading this cycle. The `.next/` directory was last written **Jun 3 10:03** — it still holds the real production build from yesterday's run, and no `next dev` process was active at read time. The dev server never recompiled those chunks. Confirmation:

- All 64 emitted JS chunks are present (a dev cache only contains visited routes — it would show far fewer).
- The top chunk hashes are byte-identical to yesterday's real-build report (`003bi2x1z1ykz.js` = 604,989 B, etc.).
- No commit has landed on `develop` since `5f0c6a03` (May 29), so the bundle could not have changed.

So today's 3,398 KB is a **second independent read of the Jun 3 production artifacts**, not a fresh dev-cache undercount. The breach is real and stable.

### Chunk identification re-verified this cycle (signature grep)

| Chunk | Size | Signature found | Verdict |
|---|---:|---|---|
| `003bi2x1z1ykz.js` | 605 KB | `elevenlabs`/`11labs` matched | ElevenLabs SDK |
| `0t~d~esdbfsi5.js` | 330 KB | `GoTrueClient`/`supabase` matched | Supabase JS client |
| `0lyyno-gee1wu.js` | 221 KB | `posthog` matched | PostHog |
| `0e_r8dj.mq~mp.js` | 212 KB | `micromark`/`mdast` matched | react-markdown family |

(The `@next/bundle-analyzer` treemap remains a no-op under Next 16's Turbopack/rolldown bundler — chunk contents are identified by grepping minified bytes for library signatures, as established last cycle.)

| Signal | Value | Status |
|---|---:|:---:|
| Total JS (real prod build, re-confirmed) | 3,398 KB | RED — 298 KB over budget |
| Total JS budget (total, incl. deferred) | 3,100 KB | Breached |
| Initial JS (estimated, deferred chunks subtracted) | ~2,022 KB | Pass (estimate) |
| Total CSS | 122 KB | Green |
| Production deps | 35 / 40 | Green (5 headroom) |
| node_modules disk | 1,043 MB | Watch (flat) |

## Key Metrics

### Bundle (real production build, re-read)

```
Total JS (real prod, re-confirmed 2026-06-04):  3,398 KB  (3,479,884 bytes)
Budget (split, since 2026-04-04):               2,100 KB initial / 3,100 KB total
Overage on total budget:                        +298 KB  (9.6% over)
Last genuine prod build (~May 21):              3,082 KB  → +316 KB growth
Total CSS:                                      122 KB
JS chunk files:                                 64
```

### Largest chunks (real prod build)

| Size | Chunk | Contents (evidence) | Loading |
|---:|---|---|---|
| 605 KB | `003bi2x1z1ykz.js` | ElevenLabs SDK (matched `elevenlabs`) | Deferred (click-to-mount, `bd833288`) |
| 330 KB | `0t~d~esdbfsi5.js` | Supabase JS client (matched `GoTrueClient`) | First paint (auth session) |
| 237 KB | `0422xq0sb~4g3.js` | React + Next framework vendor | First paint (required) |
| 221 KB | `0lyyno-gee1wu.js` | PostHog (matched `posthog`) | Deferred analytics |
| 212 KB | `0e_r8dj.mq~mp.js` | react-markdown / micromark / mdast | Deferred (`chat-message-list.tsx`) |
| 149 KB | `0a-pavpl4ggb0.js` | Unidentified app/shared chunk | First paint (likely) |
| 132 KB | `09k9sarjqmw54.js` | react-markdown family (remark/rehype) | Deferred |
| 118 KB | `0u4~hej3h-90o.js` | PostHog support | Deferred |
| 113 KB | `03~yq9q893hmn.js` | Stable shared chunk | First paint |
| 88 KB | `149pw4wm-wp~8.js` | react-markdown family | Deferred |

Deferred chunks that still count toward the **total** budget: ElevenLabs 605 KB + PostHog (221 + 118 =) 339 KB + react-markdown family (212 + 132 + 88 =) 432 KB = **~1,376 KB of deferred weight.** Subtracting these, first-paint/initial JS is roughly **~2,022 KB**, under the 2,100 KB initial budget. The breach is on **total**, driven by deferred chunks, not on initial load. (Estimate: Next 16 Turbopack does not emit per-route "First Load JS" columns.)

### Dependencies (heaviest on disk)

| Package | Disk MB | Bundled client-side? | Notes |
|---|---:|---|---|
| next | 169 | Build/runtime | Required |
| @next | 117 | Build/runtime | Required |
| @sentry | 71 | Yes (browser bundle) | First-paint cost; 10.55 |
| pdfjs-dist | 61 | No | devDependency |
| pdf-parse | 57 | No | devDependency |
| @opentelemetry | 41 | Server-only | Sentry transitive |
| lucide-react | 39 | Yes (tree-shaken) | `optimizePackageImports` active (`next.config.ts:19`) |
| posthog-js | 38 | Yes (deferred, ~339 KB) | `optimizePackageImports` active |
| @napi-rs | 30 | No | Native binding, server-only |
| typescript | 24 | No | Dev/build-time only |
| stripe | 19 | Server-only | Node SDK, 22.2.0 |
| canvas | 19 | No | optionalDependency, server-only |
| @rolldown | 19 | No | Turbopack bundler, build-time |
| @img | 16 | No | sharp native bindings, server-only |
| core-js | 15 | Build-time transitive | No client polyfills chunk ships (closed last cycle) |

Production dependency count is 35 / 40 (5 headroom), unchanged.

## Budget Status

| Budget | Limit | Current | Status |
|---|---:|---:|:---:|
| **Total JS** | **3,100 KB** | **3,398 KB** | **FAIL — 298 KB over** |
| Initial JS | 2,100 KB | ~2,022 KB (estimated) | Pass (estimate; not exactly measurable under Turbopack) |
| Production deps | 40 | 35 | Pass |
| Total CSS | (no hard budget) | 122 KB | Healthy |

The total-JS budget is exceeded. Per the script's violation logic (`performance-agent.sh:135-136`) this is a hard failure, not advisory. The breach is now confirmed across two consecutive reads of the production artifacts.

## Top Optimization Opportunities (prioritized by impact)

### 1. ElevenLabs SDK — 605 KB, serving 107 days of zero Paisaxe voice traffic (HIGHEST IMPACT)

The single ElevenLabs chunk is **605 KB — 20% of the bundle by itself.** Removing it alone (3,398 → ~2,793 KB) brings the project comfortably back under the 3,100 KB budget in one move. It is already click-to-mount-deferred (P3, `bd833288`), so it does not touch first paint, but it **counts toward the total budget that is now breached.**

Cost Analyst (2026-06-04) reports **Paisaxe voice silence at 107 days** (since Feb 17) and that the only ElevenLabs activity is a *personal* Coach/Archy agent — no Paisaxe agent traffic at all. Cost Analyst explicitly flags that shelving voice serves a **dual purpose**: it removes the 605 KB chunk (resolving this breach) AND advances the standing June tier-downgrade decision (~$45/mo savings). This is now both a budget lever and a cost lever, pointing the same direction.

Code path: the import lives behind the voice widget mount; removal means deleting the `@elevenlabs/react` dependency (`package.json:65`) and the voice-chat mount call once a shelving decision is made. **This is a product/business decision, not a pure-mechanical fix — it should be made jointly with the cost downgrade evaluation, not unilaterally.**

### 2. Re-baseline budget tracking on real builds, not the dev cache (PROCESS — still open)

The breach was invisible for twelve cycles because the script reported dev-cache undercounts as authoritative. This cycle got lucky: the dev server happened to be down at read time and the `.next/` cache held a real build. That luck is not a fix. Two concrete actions remain:

- The next triage (with the dev server reliably stopped) should run `npm run build` so the agent records a real number to `.performance-history.json`. **Note the history file still shows 2,850 KB for both Jun 3 and Jun 4 — the real 3,398 KB build has never been written to it.** The history is therefore still tracking the dev-cache fiction; it needs a real entry to reset the trend line.
- `performance-agent.sh` should suppress its GREEN/RED budget verdict (not just print a NOTE) when `.next` provenance cannot be confirmed as a fresh production build.

### 3. Attribute the +316 KB growth (last genuine build ~May 21 → now) (MEDIUM)

Between the last recorded real build (3,082 KB, May 15–21) and the current 3,398 KB, the only landed change is `5f0c6a03` (May 29: browserslist trim + production dep batch — anthropic-sdk 0.100.1, sentry 10.55, lucide-react 1.17, posthog-js 1.376.4, stripe pair, supabase-js 2.106.2). The browserslist trim should have *reduced* size, so the dep batch is the prime suspect for +316 KB. The two client-side growers to check first are **@sentry/nextjs 10.55** (71 MB on disk, ships a browser bundle at first paint) and **posthog-js 1.376** (~339 KB deferred). Attribution must come from before/after real builds per dependency — the treemap is unavailable under Turbopack.

### 4. react-markdown family — 432 KB across three deferred chunks (MEDIUM)

react-markdown + remark/rehype/micromark/mdast totals **~432 KB** across `0e_r8dj` (212 KB), `09k9` (132 KB), and `149pw4` (88 KB), all deferred to chat rendering. A large block of deferred weight counting toward the breached total. Options: (a) confirm a single lighter markdown renderer covers the chat's actual markdown surface (likely a small subset — bold/italic/links/lists), or (b) restrict the remark/rehype plugin set. A minimal markdown-to-JSX renderer could reclaim 150–250 KB. Investigate the actual markdown features the chat uses before swapping.

### 5. browserslist trim — confirmed no-op on bundle size (CLOSED)

`core-js` (15 MB) remains in `node_modules`, but the real build shows **no separate `polyfills`/`core-js` client chunk** among the 64 emitted chunks. Next 16 + Turbopack was already shipping minimal polyfills; the May 29 trim had no measurable bundle effect. Item stays closed.

## Recommendations Summary

1. **ElevenLabs 605 KB is the one lever that resolves the breach** — pursue the voice-shelving decision jointly with Cost Analyst's June tier-downgrade evaluation; removing `@elevenlabs/react` drops total to ~2,793 KB (under budget) and saves cost. Dual benefit.
2. **Write a real build number to `.performance-history.json`** — it still records 2,850 KB for Jun 3/Jun 4; the real 3,398 KB has never been persisted, so the trend line is still fictional.
3. **Stop emitting pass/fail verdicts from unverified `.next` provenance** in `performance-agent.sh`.
4. **Attribute the +316 KB growth** to the May 29 dep batch via before/after real builds; check @sentry 10.55 and posthog-js first.
5. **react-markdown (432 KB)** — evaluate a lighter renderer / trimmed plugin set for 150–250 KB of reclaimable deferred weight.
6. **browserslist trim is a no-op** — stays closed.

## Comparison to Previous Run (2026-06-03)

| Metric | Jun 3 (real build, revealed) | Jun 4 (real artifacts, re-read) | Change |
|---|---:|---:|:---:|
| Total JS | 3,398 KB | 3,398 KB | unchanged (confirmed) |
| vs last genuine build (3,082 KB, ~May 21) | +316 KB | +316 KB | stable |
| Total CSS | 122 KB | 122 KB | unchanged |
| Production deps | 35 / 40 | 35 / 40 | unchanged |
| Budget verdict | RED (298 KB over, newly revealed) | RED (298 KB over, confirmed) | held |
| Chunk signatures | identified by grep | re-verified by grep | confirmed |
| History JSON entry | 2,850 KB (not updated) | 2,850 KB (still not updated) | still fictional |

**Improvements:** The breach is now independently confirmed by a second read of the production artifacts — it is not a one-time measurement artifact. Chunk identification re-verified. No bundle growth this cycle (no new commits landed).

**Regressions:** None new. The headline persists — total JS is **3,398 KB, 298 KB over the 3,100 KB budget**, stable. Status stays **RED**. The `.performance-history.json` trend line is still tracking the dev-cache 2,850 KB fiction and needs a real-build entry written.
