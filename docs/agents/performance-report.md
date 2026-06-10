# Performance Agent Report — 2026-06-07

## Summary

Status: RED — confirmed, authoritative bundle breach. Total JS is 3,398 KB against a 3,100 KB total budget: **298 KB over (1.10x)**. This is no longer an advisory or a suppressed figure. The breach is now backed by a real, post-dependency-batch production build.

The metrics script suppressed its own budget verdict this cycle (its provenance gate could not confirm a fresh build from its own run). That suppression is overly conservative and is overridden here on independent evidence:

- `.next` mtime is **Jun 6 12:36:45**, the fresh build produced by the Jun 6 triage run (`958d8311 fix(triage): confirm bundle breach, fix perf-agent dev-server detection`). This is post the Jun 4 production dep batch (#592, 11 updates).
- The only two commits on `develop` since that build — `958d8311` and `144ea892` — touch `docs/` and `scripts/performance-agent.sh` only. Zero source or dependency changes. `git show --stat` confirms: no `src/`, no `package.json`, no `package-lock.json` edits. The on-disk bundle is therefore authoritative for the current source tree.
- 64 JS chunks present; top two chunks byte-identical to the recorded build (`003bi2x1z1ykz.js` = 604,989 B, `0t~d~esdbfsi5.js` = 330,132 B). Real-build signature, not a dev cache.

So the long-running blocker — "no fresh build, so the verdict is suppressed" — is resolved. A fresh authoritative build exists, it post-dates the Jun 4 dep batch, and it confirms what every cycle has informally reported: the total JS budget is breached by ~298 KB.

The two genuinely authoritative health dimensions remain green: production dependency count (35 / 40, 5 headroom) and node_modules disk (1,043 MB, flat). The RED status is driven solely by the confirmed total-JS breach.

### The breach is total-only — initial JS is within budget

The split budget (since 2026-04-04) is 2,100 KB initial / 3,100 KB total. Subtracting the deferred chunks (ElevenLabs 605 KB click-to-mount, PostHog 339 KB deferred analytics, react-markdown family 432 KB deferred chat rendering = 1,376 KB deferred) leaves an initial load of approximately **2,022 KB — under the 2,100 KB initial budget**. The breach lives entirely in the total budget, and it is dominated by deferred weight. The single largest deferred chunk, ElevenLabs at 605 KB, is by itself larger than the 298 KB overage.

### Script provenance note — fresh build still not captured by the scheduled run

Despite the Jun 6 dev-server-detection fix (`144ea892`, scoping the check to port 3006), today's scheduled metrics run again emitted "Production build was skipped or failed." Verified at read time: paisaxe's port 3006 is free (no paisaxe dev server), but a sibling-project `next-server (v16.2.7)` process (PID 90288) is still running machine-wide. Either the port-scoped fix is not fully suppressing on the sibling process, or the scheduled build attempt failed and fell back to the Jun 6 cached artifacts. Because the cached artifacts ARE the authoritative Jun 6 build, the bundle numbers are still trustworthy this cycle — but the script's build-capture path should be checked so a future cycle without a recent triage build does not silently revert to stale data.

## Key Metrics

| Signal | Value | Authoritative? | Status |
|---|---:|:---:|:---:|
| Total JS | 3,398 KB | Yes (Jun 6 fresh build, post-dep-batch) | RED — 298 KB over 3,100 KB total |
| Initial JS (deferred subtracted) | ~2,022 KB | Estimate | Within 2,100 KB budget |
| Total CSS | 122 KB | Yes | Healthy (no hard budget) |
| JS chunk files | 64 | Yes | Real-build signature |
| Production deps | 35 / 40 | Yes | GREEN (5 headroom) |
| Dev deps | 30 | Yes | Informational |
| node_modules disk | 1,043 MB | Yes | GREEN (flat) |
| .next disk | 60 MB | Yes | GREEN |

### Bundle (authoritative — Jun 6 production build, post-dep-batch)

```
Total JS:                                         3,398 KB
Budget (total, split since 2026-04-04):           3,100 KB    -> 298 KB OVER (1.10x)
Budget (initial):                                 2,100 KB
Initial JS (deferred subtracted, estimate):       ~2,022 KB   -> within budget
Total CSS:                                        122 KB
JS chunk files:                                   64
Verdict:                                          RED (total breach, confirmed)
Change vs previous (Jun 6):                       0 KB (byte-identical build)
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

The `@next/bundle-analyzer` treemap is a no-op under Next 16's Turbopack/rolldown bundler, so chunk contents are identified by grepping minified bytes for library signatures (method established in prior cycles). The Jun 6 build is byte-identical to Jun 3 in its top chunks, confirming the Jun 4 production dep batch (#592, 11 updates) had **zero net bundle impact** — a useful result: the breach is structural, not a recent regression.

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
| posthog-js | 38 | Yes (deferred, ~339 KB) | `optimizePackageImports` active (`next.config.ts:19`) |
| @napi-rs | 30 | No | Native binding, server-only |
| typescript | 24 | No | Dev/build-time only |
| stripe | 19 | Server-only | Node SDK, 22.2.0 |
| canvas | 19 | No | optionalDependency, server-only |
| @rolldown | 19 | No | Turbopack bundler, build-time |
| @img | 16 | No | sharp native bindings, server-only |
| core-js | 15 | Build-time transitive | No client polyfills chunk ships |

`optimizePackageImports` confirmed active for `lucide-react` and `posthog-js` at `next.config.ts:19`; `cacheComponents` (PPR) at `next.config.ts:16`. `pdfjs-dist`/`pdf-parse` are devDependencies and never enter the client bundle. `voyageai` stays pinned at 0.1.0 (0.2.x has broken ESM).

## Budget Status

| Budget | Limit | Current | Status |
|---|---:|---:|:---:|
| Total JS | 3,100 KB | 3,398 KB | RED — 298 KB over (confirmed) |
| Initial JS | 2,100 KB | ~2,022 KB (estimate) | PASS (estimate) |
| Production deps | 40 | 35 | PASS (5 headroom) |
| node_modules disk | (soft) | 1,043 MB | PASS (flat) |
| Total CSS | (no hard budget) | 122 KB | Healthy |

The total-JS verdict is RED on a confirmed, post-dep-batch production build. The breach is total-only and dominated by deferred chunks; initial load is within budget.

## Top Optimization Opportunities (prioritized by impact)

### 1. ElevenLabs SDK — 605 KB, serving 110 days of zero Paisaxe voice traffic (HIGHEST IMPACT — clears the breach in one move)

The ElevenLabs chunk is 605 KB — 18% of the total bundle, and by itself larger than the full 298 KB overage. It is already click-to-mount-deferred (`bd833288`), so it does not touch first paint, but it counts toward the breached total budget. Removing it brings the total from 3,398 KB to approximately **2,793 KB — 307 KB under budget**, resolving the RED in a single change.

Cost Analyst (2026-06-07) reports Paisaxe voice silence at **110 days** (since Feb 17), all five Paisaxe voice agents at zero conversations, and flags voice-shelving as a dual lever: it removes the 605 KB chunk AND advances the standing June tier-downgrade decision (~$45/mo), pointing the same direction.

This is a product/business decision, not a mechanical fix. Removal means deleting `@elevenlabs/react` (`package.json:65`) and the voice-chat mount call. Decide jointly with the cost downgrade evaluation. If voice is being kept available "just in case," the chunk stays — but then the project should either (a) raise the total budget to acknowledge voice as a deliberate cost, or (b) accept a standing RED. The honest options are: ship voice and own the budget, or shelve voice and clear the breach.

### 2. react-markdown family — ~432 KB across three deferred chunks (MEDIUM — second-largest lever)

react-markdown + remark/rehype/micromark/mdast totals ~432 KB across `0e_r8dj` (212 KB), `09k9` (132 KB), and `149pw4` (88 KB), all deferred to chat rendering. The chat surface almost certainly uses a small markdown subset (bold, italic, links, lists, code spans). Two paths:

- (a) Restrict the remark/rehype plugin set to only what the chat renders, dropping unused GFM/raw-HTML/math plugins.
- (b) Swap to a minimal markdown-to-JSX renderer if the feature surface is genuinely small.

Either could reclaim 150–250 KB. Investigate the chat's actual markdown feature usage first (audit `react-markdown` props / plugin list in the chat component) before swapping renderers. This is the natural second lever if ElevenLabs is kept and the budget needs structural relief regardless.

Example — narrowing the plugin surface rather than swapping libraries:

```tsx
// Audit current usage first. If chat only needs GFM tables/strikethrough/links,
// keep remark-gfm and drop everything else; avoid rehype-raw (pulls in a full
// HTML parser) unless raw HTML in responses is actually required.
<ReactMarkdown remarkPlugins={[remarkGfm]} /* no rehypeRaw, no remark-math */>
  {content}
</ReactMarkdown>
```

### 3. PostHog — ~339 KB deferred, evaluate whether full SDK is needed (LOW–MEDIUM)

PostHog spans two deferred chunks (221 KB + 118 KB = 339 KB). It is already deferred and `optimizePackageImports`-tree-shaken (`next.config.ts:19`), so first paint is unaffected. The lever here is whether the project uses enough of PostHog's surface (session replay, autocapture, feature flags) to justify 339 KB, or whether a lighter init (autocapture off, replay lazy-loaded only when sampled) trims it. Security Agent (2026-06-07) also flags a posthog-js lockfile drift (1.376.4 installed vs ^1.378.1 in package.json; 1.382.0 available) — when that upgrade lands, re-measure this chunk. Lower priority than #1/#2; worth a look only if voice is retained and more total-budget relief is needed.

### 4. Confirm the Jun 6 dep batch had zero bundle impact — done, record it (INFORMATIONAL)

Resolved this cycle: the Jun 6 fresh build is byte-identical in its top chunks to the pre-dep-batch Jun 3 build, confirming the Jun 4 production group bump (#592, 11 updates incl. @sentry, posthog-js, supabase-js) did **not** move the bundle. No attribution action needed — the breach is pre-existing and structural, driven by the voice + markdown + analytics chunk weight, not by any recent dependency change.

### 5. Fix the metrics script's build-capture path (LOW — PROCESS)

Today's scheduled run still emitted "build skipped or failed" despite the Jun 6 port-3006 detection fix (`144ea892`), while a sibling `next-server` (PID 90288) ran machine-wide. The bundle numbers were salvaged only because the Jun 6 triage left a fresh authoritative build on disk. Without that, this cycle would have silently read stale data. Recommend verifying that `performance-agent.sh` either (a) reliably runs its own `build:analyze` regardless of sibling Next processes, or (b) explicitly records the `.next` mtime + the last `develop` commit touching `src/`/`package.json` so provenance is self-evident in the metrics file rather than requiring manual git archaeology each cycle.

## Recommendations Summary

1. RED is real and authoritative this cycle — total JS 3,398 KB vs 3,100 KB budget, 298 KB over, on a confirmed post-dep-batch build. The "run build:analyze" blocker is resolved (Jun 6 triage build).
2. ElevenLabs 605 KB is the single lever that clears the breach (3,398 -> ~2,793 KB). Pursue voice-shelving jointly with Cost Analyst's June tier-downgrade evaluation — 110 days of zero Paisaxe voice traffic. This is a product decision, not a unilateral fix.
3. If voice is retained, react-markdown (~432 KB deferred) is the next structural lever — narrow the plugin set or adopt a minimal renderer for 150–250 KB. Audit chat markdown usage first.
4. Initial JS (~2,022 KB) is within budget — the breach is total-only and deferred-dominated. No first-paint regression.
5. Harden `performance-agent.sh` build capture so future cycles do not silently fall back to stale `.next` when a sibling Next process is running.

## Comparison to Previous Run (2026-06-06)

| Metric | Jun 6 (GREEN advisory, suppressed) | Jun 7 (RED, confirmed) | Change |
|---|---:|---:|:---:|
| Total JS | 3,398 KB (Jun 3 artifacts, pre-dep-batch) | 3,398 KB (Jun 6 build, post-dep-batch) | unchanged value, now authoritative |
| Bundle verdict | SUPPRESSED (no fresh build) | RED — 298 KB over (fresh build verified) | verdict restored |
| Build provenance | Jun 3, predates dep batch #592 | Jun 6, post dep batch #592 | fresh build confirmed |
| Initial JS (est.) | ~2,022 KB | ~2,022 KB | within budget (unchanged) |
| Total CSS | 122 KB | 122 KB | unchanged |
| Production deps | 35 / 40 | 35 / 40 | unchanged |
| node_modules disk | 1,043 MB | 1,043 MB | unchanged (flat) |
| .next disk | 60 MB | 60 MB | unchanged |
| Overall status | GREEN (deps + disk only) | RED (confirmed total breach) | status change |

Improvements: The central open item — "run a fresh build:analyze to convert informational figures to authoritative" — is resolved. The Jun 6 triage produced the build, and independent verification (git log shows only doc/script commits since; `.next` mtime Jun 6; byte-identical top chunks) confirms the 3,398 KB figure is real and post-dep-batch. The Jun 4 dep batch (#592) is confirmed to have zero bundle impact.

Regressions: None in measured metrics — every value is flat. The status change to RED is not a regression in the bundle; it is the removal of the suppression that was masking a long-standing, now-confirmed breach. The breach has effectively been present every cycle; this is the first cycle it can be stated authoritatively.
