# Performance Agent Report — 2026-06-10

## Summary

Status: GREEN (advisory on bundle). The long-standing total-JS RED is resolved this cycle — not by a bundle change, but by an explicit budget decision: commit `93e7546e` (Jun 10) raised the total budget from 3,100 KB to 3,500 KB, acknowledging the ElevenLabs ConvAI SDK (~605 KB, click-to-mount deferred) as a deliberate, hard-dependency cost of keeping the voice feature. At 3,398 KB total JS, the bundle now sits **102 KB under budget**. The per-chunk budget was raised 500 → 650 KB in the same commit; the largest chunk (ElevenLabs, 605 KB) fits with 45 KB headroom.

The metrics script flagged the build STALE (.next mtime Jun 6 12:36:45 predates the Jun 10 dep commit `41892c69`) and suppressed its own budget verdict — the new provenance hardening from `5f3b1d18` working as designed on its first cycle. Manual verification shows the staleness is immaterial this cycle:

- Only two commits touch `src/` or `package.json` since the Jun 6 build: `5f3b1d18` (triage) and `41892c69` (Dependabot #595).
- `41892c69` bumps `@types/node` and `@types/react` only — devDependencies, zero client-bundle impact.
- `5f3b1d18` touches seed-only content (`content/translations/story-translations.ts`, not client-shipped per Localization Agent), a test file, the perf-agent script, and the posthog-js version pin (`^1.384.0` in package.json) — but `node_modules` still holds posthog-js **1.376.4** (npm install pending), so even a fresh build today would bundle the same PostHog code.
- 64 JS chunks on disk, top chunks byte-identical to the Jun 6 authoritative build (`003bi2x1z1ykz.js` = 604,989 B).

Per the provenance rule, the overall status verdict is based on the authoritative dimensions: production deps 35/40 (GREEN, 5 headroom) and node_modules disk 1,043 MB (GREEN, flat). The bundle figure of 3,398 KB vs 3,500 KB is reported as an advisory PASS pending the next fresh build.

### What the budget decision means

The Jun 7 report framed the honest options as: (a) ship voice and own the budget, or (b) shelve voice and clear the breach. The user chose (a). The voice-shelving lever flagged by Cost Analyst (113 days of zero Paisaxe voice traffic, ~$45/mo tier downgrade) remains available as a product decision — shelving would drop the total to ~2,793 KB — but it is no longer needed to satisfy the performance budget. The budget now honestly reflects the shipped feature set.

### Headroom is thin: 102 KB

3,500 − 3,398 = 102 KB. The pending Supabase pair bump (supabase-js 2.106.2 → 2.108.1 + ssr 0.10.3 → 0.12.0, flagged priority by Security Agent) touches the 330 KB first-paint Supabase chunk, and posthog-js 1.376.4 → 1.384.0 will materialize on the next `npm install` and may shift the ~339 KB PostHog chunks. Neither should move more than a few KB, but with 102 KB headroom the next fresh build after those land should be measured, not assumed.

## Key Metrics

| Signal | Value | Authoritative? | Status |
|---|---:|:---:|:---:|
| Total JS | 3,398 KB | Advisory (Jun 6 build; staleness verified immaterial) | PASS — 102 KB under 3,500 KB |
| Initial JS (deferred subtracted) | ~2,022 KB | Estimate | Within 2,100 KB budget |
| Largest chunk (ElevenLabs) | 605 KB | Advisory | Within new 650 KB per-chunk budget |
| Total CSS | 122 KB | Advisory | Healthy (no hard budget) |
| JS chunk files | 64 | Yes | Matches Jun 6 real-build signature |
| Production deps | 35 / 40 | Yes | GREEN (5 headroom) |
| Dev deps | 30 | Yes | Informational |
| node_modules disk | 1,043 MB | Yes | GREEN (flat) |
| .next disk | 60 MB | Yes | GREEN |

### Bundle (advisory — Jun 6 production build, staleness verified immaterial)

```
Total JS:                                         3,398 KB
Budget (total, raised 2026-06-10, 93e7546e):      3,500 KB    -> 102 KB UNDER (0.97x)
Budget (initial, unchanged):                      2,100 KB
Initial JS (deferred subtracted, estimate):       ~2,022 KB   -> within budget
Budget (per-chunk, raised 2026-06-10):            650 KB
Largest chunk (ElevenLabs):                       605 KB      -> within budget
Total CSS:                                        122 KB
JS chunk files:                                   64
Verdict:                                          GREEN advisory (provenance STALE but verified immaterial)
Change vs previous (Jun 7):                       0 KB (same artifacts)
```

### Largest chunks (Jun 6 production artifacts)

| Size | Chunk | Contents (evidence) | Loading | Budget impact |
|---:|---|---|---|---|
| 605 KB | `003bi2x1z1ykz.js` | ElevenLabs SDK (`elevenlabs` signature) | Deferred — click-to-mount (`bd833288`) | Total only |
| 330 KB | `0t~d~esdbfsi5.js` | Supabase JS client (`GoTrueClient` signature) | First paint (auth session) | Initial + total |
| 237 KB | `0422xq0sb~4g3.js` | React + Next framework vendor | First paint (required) | Initial + total |
| 221 KB | `0lyyno-gee1wu.js` | PostHog (`posthog` signature) | Deferred analytics | Total only |
| 212 KB | `0e_r8dj.mq~mp.js` | react-markdown / micromark / mdast | Deferred (chat rendering) | Total only |
| 149 KB | `0a-pavpl4ggb0.js` | Unidentified app/shared chunk | First paint (likely) | Initial + total |
| 132 KB | `09k9sarjqmw54.js` | react-markdown family (remark/rehype) | Deferred | Total only |
| 118 KB | `0u4~hej3h-90o.js` | PostHog support | Deferred | Total only |
| 113 KB | `03~yq9q893hmn.js` | Stable shared chunk | First paint | Initial + total |
| 88 KB | `149pw4wm-wp~8.js` | react-markdown family | Deferred | Total only |

Deferred weight (ElevenLabs 605 + PostHog 339 + react-markdown family 432) totals ~1,376 KB — 40% of the bundle never touches first paint.

### Dependencies (heaviest on disk)

| Package | Disk MB | Bundled client-side? | Notes |
|---|---:|---|---|
| next | 169 | Build/runtime | Required |
| @next | 117 | Build/runtime | Required |
| @sentry | 71 | Yes (browser bundle) | First-paint cost; 10.55 installed |
| pdfjs-dist | 61 | No | devDependency — never client-shipped |
| pdf-parse | 57 | No | devDependency — never client-shipped |
| @opentelemetry | 41 | Server-only | Sentry transitive |
| lucide-react | 39 | Yes (tree-shaken) | `optimizePackageImports` active (`next.config.ts:19`) |
| posthog-js | 38 | Yes (deferred, ~339 KB) | 1.376.4 installed; ^1.384.0 pinned, npm install pending |
| @napi-rs | 30 | No | Native binding, server-only |
| typescript | 24 | No | Dev/build-time only |
| stripe | 19 | Server-only | Node SDK, 22.2.0 |
| canvas | 19 | No | optionalDependency, server-only |
| @rolldown | 19 | No | Turbopack bundler, build-time |
| @img | 16 | No | sharp native bindings, server-only |
| core-js | 15 | Build-time transitive | No client polyfills chunk ships |

`optimizePackageImports` active for `lucide-react` and `posthog-js` (`next.config.ts:19`); `cacheComponents` (PPR) at `next.config.ts:16`. `voyageai` stays pinned at 0.1.0 (0.2.x has broken ESM).

## Budget Status

| Budget | Limit | Current | Status |
|---|---:|---:|:---:|
| Total JS | 3,500 KB (raised Jun 10) | 3,398 KB | PASS (advisory) — 102 KB headroom |
| Initial JS | 2,100 KB | ~2,022 KB (estimate) | PASS (estimate) |
| Per-chunk | 650 KB (raised Jun 10) | 605 KB max | PASS (advisory) — 45 KB headroom |
| Production deps | 40 | 35 | PASS (5 headroom) |
| node_modules disk | (soft) | 1,043 MB | PASS (flat) |
| Total CSS | (no hard budget) | 122 KB | Healthy |

No budgets exceeded. The bundle verdicts are advisory pending a fresh build, but the staleness was verified immaterial (no client-affecting changes since the Jun 6 build).

## Top Optimization Opportunities (prioritized by impact)

### 1. react-markdown family — ~432 KB across three deferred chunks (HIGHEST ACTIONABLE — top structural lever now that voice is retained)

With ElevenLabs accepted as a budgeted cost, react-markdown + remark/rehype/micromark/mdast (~432 KB across `0e_r8dj` 212 KB, `09k9` 132 KB, `149pw4` 88 KB, all deferred to chat rendering) is the largest remaining reducible weight. The chat surface almost certainly uses a small markdown subset (bold, italic, links, lists, code spans). Two paths:

- (a) Restrict the remark/rehype plugin set to only what the chat renders — drop unused GFM/raw-HTML/math plugins. `rehype-raw` in particular pulls in a full HTML parser.
- (b) Swap to a minimal markdown-to-JSX renderer if the feature surface is genuinely small.

Either could reclaim 150–250 KB, roughly tripling the current 102 KB headroom. Audit the chat component's `react-markdown` props and plugin list first:

```tsx
// If chat only needs GFM tables/strikethrough/links, keep remark-gfm and
// drop everything else; avoid rehype-raw unless raw HTML in Claude
// responses is actually required.
<ReactMarkdown remarkPlugins={[remarkGfm]} /* no rehypeRaw, no remark-math */>
  {content}
</ReactMarkdown>
```

### 2. Re-measure after the pending dependency materializations (MEDIUM — protects the thin 102 KB headroom)

Two queued changes touch bundled code and must be measured against the 102 KB headroom on the next fresh build:

- **posthog-js 1.376.4 → 1.384.0**: pinned in package.json (`5f3b1d18`) but not installed — Security Agent flags the pending `npm install`. Affects the ~339 KB deferred PostHog chunks.
- **Supabase pair** (supabase-js 2.106.2 → 2.108.1, ssr 0.10.3 → 0.12.0): Security Agent's priority production bump (auth surface). Affects the 330 KB first-paint Supabase chunk — this one also touches the initial-JS estimate (~2,022 / 2,100 KB, only 78 KB initial headroom).

Recommended sequence: `npm install`, apply the Supabase batch, then `npm run build:analyze` and compare chunk sizes before/after. With under ~100 KB of slack on both budgets, "minor bumps are probably fine" is no longer a safe assumption.

### 3. PostHog configuration audit — ~339 KB deferred (LOW–MEDIUM)

PostHog spans two deferred chunks (221 + 118 KB). Already deferred and tree-shaken via `optimizePackageImports`, so first paint is unaffected. The remaining lever is configuration: if session replay or autocapture are not actively used, a lighter init (autocapture off, replay lazy-loaded only when sampled) trims the deferred weight. Do this after the 1.384.0 upgrade lands so the measurement reflects the current version.

### 4. Voice-shelving remains available as a product lever (INFORMATIONAL — no longer budget-driven)

Cost Analyst (Jun 10) reports 113 days of zero Paisaxe voice traffic and continues to flag shelving as a dual lever (605 KB chunk + ~$45/mo tier downgrade). The Jun 10 budget raise (`93e7546e`) explicitly chose to keep voice and budget for it, so this is no longer a performance action item. If the business decision later flips, removal drops the total to ~2,793 KB and the 3,500 KB budget should be lowered back to ~3,100 KB to stay honest.

### 5. Identify the 149 KB first-paint chunk `0a-pavpl4ggb0.js` (LOW — carried)

The one remaining unidentified top-10 chunk is likely first-paint and counts against the tighter initial budget (78 KB estimated headroom). On the next `build:analyze` run, grep it for library signatures (same method that identified the others) to confirm it is app code rather than a vendorable/deferrable library.

## Recommendations Summary

1. Status GREEN. The bundle RED is resolved by the Jun 10 budget raise to 3,500 KB (`93e7546e`) — a deliberate decision to budget for the ElevenLabs voice SDK. Bundle: 3,398 KB, 102 KB headroom (advisory; staleness verified immaterial).
2. Headroom is thin on both budgets (102 KB total, ~78 KB initial). Measure the next fresh build after `npm install` (posthog-js 1.384.0) and the Supabase pair bump land — do not assume minor bumps are free.
3. react-markdown (~432 KB deferred) is now the top structural optimization: narrow the plugin set or adopt a minimal renderer for 150–250 KB. Audit chat markdown usage first.
4. Provenance hardening (`5f3b1d18`) worked on its first cycle: STALE verdict correctly suppressed the script's budget call; manual verification took minutes instead of git archaeology. No script changes needed.
5. Voice-shelving is no longer a performance action item — it remains a Cost Analyst product lever only.

## Comparison to Previous Run (2026-06-07)

| Metric | Jun 7 (RED, confirmed) | Jun 10 (GREEN advisory) | Change |
|---|---:|---:|:---:|
| Total JS | 3,398 KB | 3,398 KB | unchanged (same Jun 6 artifacts) |
| Total budget | 3,100 KB | 3,500 KB | raised (`93e7546e`) |
| Bundle verdict | RED — 298 KB over | PASS — 102 KB under (advisory) | resolved by budget decision |
| Per-chunk budget | 500 KB | 650 KB | raised; 605 KB max chunk now fits |
| Initial JS (est.) | ~2,022 KB | ~2,022 KB | within budget (unchanged) |
| Total CSS | 122 KB | 122 KB | unchanged |
| Production deps | 35 / 40 | 35 / 40 | unchanged |
| node_modules disk | 1,043 MB | 1,043 MB | unchanged (flat) |
| Build provenance | FRESH (Jun 6, verified) | STALE flag (verified immaterial) | provenance gate active |
| Overall status | RED | GREEN (advisory) | status change |

Improvements: The standing RED (present informally since April, authoritative since Jun 6) is closed via an explicit, documented budget decision rather than silent drift — the budget commit records the rationale (hard dependency, already deferred, no further reduction without dropping the feature). The new STALE/CACHED/FRESH provenance verdict shipped in `5f3b1d18` fired correctly on its first cycle.

Regressions: None. Every measured value is flat; the build artifacts are the same Jun 6 set, and the two commits since are verified to have zero client-bundle impact (type stubs + seed-only content + uninstalled version pin).
