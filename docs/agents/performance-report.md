# Performance Agent Report — 2026-06-11

## Summary

Status: GREEN (fully authoritative — first fresh-build verdict since Jun 6). The metrics script correctly flagged the cached Jun 6 build STALE (it predates this morning's production dep batch #597, 19 packages), and this cycle the staleness was material, not cosmetic: local `node_modules` was also behind the lockfile (next 16.2.7 vs 16.2.9 pinned, @supabase/ssr 0.10.3 vs 0.12.0, Sentry 10.55 vs 10.57). The agent therefore ran the pending `npm install` (the top hygiene action flagged by Security and Triage on Jun 10-11) and a fresh production build, restoring authoritative numbers.

Result: the 19-package production batch is effectively bundle-neutral. Total JS moved 3,398 KB -> **3,393 KB (-5 KB)**, now **107 KB under the 3,500 KB budget**. The two chunks that were expected to move did, by small amounts: Supabase +1.8 KB (ssr 0.10.3->0.12.0 + supabase-js 2.106.2->2.108.1) and PostHog +6.9 KB (posthog-js 1.376.4->1.384.0); small shrinkage elsewhere more than offset both. The "minor bumps must be measured, not assumed" concern from the Jun 10 report is now answered with a measurement: they were fine.

Second resolution this cycle: the unidentified 149 KB first-paint chunk (carried as an open item for 8+ cycles, formerly `0a-pavpl4ggb0.js`, now `0y03utgnbz7gz.js`, byte-identical at 149,221 B across builds) is now **identified as the Next.js App Router client runtime** — RSC client, router, prefetch and segment-cache machinery (`createHrefFromUrl`, `app-pages-browser`, `server-patch`, segment RSC strings; zero third-party library signatures). It is required framework code, not app code and not vendorable or deferrable. The item is closed: no optimization is available at the application level.

Actions taken by this agent: `npm install` (sync to committed lockfile, materializing #597 locally — found 0 vulnerabilities) and `npm run build` (fresh production artifacts). No source changes.

## Key Metrics

| Signal | Value | Authoritative? | Status |
|---|---:|:---:|:---:|
| Total JS | 3,393 KB | Yes (fresh Jun 11 build, post-#597) | PASS — 107 KB under 3,500 KB |
| Initial JS (deferred subtracted) | ~2,011 KB | Estimate | Within 2,100 KB budget (~89 KB headroom) |
| Largest chunk (ElevenLabs) | 605 KB | Yes | Within 650 KB per-chunk budget (44 KB headroom) |
| Total CSS | 122 KB | Yes | Healthy (no hard budget) |
| JS chunk files | 64 | Yes | Unchanged |
| Production deps | 35 / 40 | Yes | GREEN (5 headroom) |
| Dev deps | 30 | Yes | Informational |
| node_modules disk | 1,030 MB | Yes (post-install) | GREEN (1,013 pre-install; within normal range) |
| .next disk | 60 MB | Yes | GREEN |

### Largest chunks (fresh Jun 11 production build)

| Size | Chunk | Contents (evidence) | Loading | vs Jun 6 |
|---:|---|---|---|---:|
| 605 KB | `244bxdtp1a5ia.js` | ElevenLabs SDK (`elevenlabs`, `convai` signatures) | Deferred — click-to-mount (`bd833288`) | +0.5 KB |
| 332 KB | `3szfbb85tmc06.js` | Supabase client (`GoTrueClient` signature) | First paint (auth session) | +1.8 KB |
| 237 KB | `2jglji8gqc2sh.js` | React + Next framework vendor | First paint (required) | identical |
| 228 KB | `0pd1uh9e-xev8.js` | PostHog (`posthog` signature) | Deferred analytics | +6.9 KB |
| 212 KB | `2yobf1f26xfes.js` | react-markdown / micromark / mdast | Deferred (chat rendering) | identical |
| 149 KB | `0y03utgnbz7gz.js` | **Next.js App Router client runtime** (RSC/router/prefetch — identified this cycle) | First paint (required framework) | identical |
| 132 KB | `3e8nmwgwkiq-t.js` | react-markdown family (remark/rehype) | Deferred | identical |
| 118 KB | `3cnlbapfh5tyx.js` | PostHog support | Deferred | identical |
| 113 KB | `0cz1d0mv5g_q7.js` | Stable shared app chunk (no vendor signatures) | First paint | identical |
| 87 KB | `3yw7iexa-ylic.js` | react-markdown family | Deferred | -0.4 KB |

Deferred weight: ElevenLabs 605 + PostHog 346 + react-markdown family 431 = ~1,382 KB — 41% of the bundle never touches first paint.

### Dependencies (heaviest on disk — unchanged ranking)

pdfjs-dist (61 MB) and pdf-parse (57 MB) remain devDependencies, never client-shipped. lucide-react and posthog-js remain covered by `optimizePackageImports` (`next.config.ts`). voyageai stays pinned at 0.1.0 (0.2.x broken ESM) — exclude from any batch. Installed versions now match the lockfile across the board: next 16.2.9, @supabase/ssr 0.12.0, @supabase/supabase-js 2.108.1, @sentry/nextjs 10.57.0, @elevenlabs/react 1.6.5, posthog-js 1.384.0.

## Budget Status

| Budget | Limit | Current | Status |
|---|---:|---:|:---:|
| Total JS | 3,500 KB (raised Jun 10, `93e7546e`) | 3,393 KB | PASS (authoritative) — 107 KB headroom |
| Initial JS | 2,100 KB | ~2,011 KB (estimate) | PASS — ~89 KB headroom |
| Per-chunk | 650 KB | 605 KB max | PASS — 44 KB headroom |
| Production deps | 40 | 35 | PASS (5 headroom) |
| node_modules disk | (soft) | 1,030 MB | PASS |
| Total CSS | (no hard budget) | 122 KB | Healthy |

No budgets exceeded. All bundle verdicts are authoritative this cycle (fresh build on synced node_modules including #597).

## Top Optimization Opportunities (prioritized by impact)

### 1. react-markdown family — ~431 KB across three deferred chunks (HIGHEST ACTIONABLE)

Unchanged by #597 and still the largest reducible weight (212 + 132 + 87 KB, all deferred to chat rendering). The chat surface almost certainly uses a small markdown subset (bold, italic, links, lists, code spans). Two paths:

- (a) Restrict the remark/rehype plugin set to only what the chat renders — drop unused GFM/raw-HTML/math plugins. `rehype-raw` in particular pulls in a full HTML parser.
- (b) Swap to a minimal markdown-to-JSX renderer if the feature surface is genuinely small.

Either could reclaim 150–250 KB, roughly tripling the 107 KB headroom. Audit the chat component's `react-markdown` props and plugin list first:

```tsx
// If chat only needs GFM tables/strikethrough/links, keep remark-gfm and
// drop everything else; avoid rehype-raw unless raw HTML in Claude
// responses is actually required.
<ReactMarkdown remarkPlugins={[remarkGfm]} /* no rehypeRaw, no remark-math */>
  {content}
</ReactMarkdown>
```

### 2. PostHog configuration audit — ~346 KB deferred, grew +7 KB this cycle (LOW–MEDIUM)

posthog-js 1.384.0 added ~7 KB to the main PostHog chunk (228 KB; support chunk 118 KB unchanged). Already deferred and tree-shaken via `optimizePackageImports`, so first paint is unaffected — but PostHog is now the second-largest vendor weight after ElevenLabs and creeps a few KB per upgrade. The lever is configuration: if session replay or autocapture are not actively used, a lighter init (autocapture off, replay lazy-loaded only when sampled) trims the deferred weight. Measurement baseline is now current (1.384.0), so this audit can proceed any time.

### 3. Voice-shelving remains a product lever only (INFORMATIONAL)

ElevenLabs chunk: 605 KB, deferred click-to-mount, 114 days of zero Paisaxe voice traffic per Cost Analyst (Jun 11). The Jun 10 budget raise deliberately keeps voice; shelving stands purely on the cost case (~$45/mo tier downgrade). If the decision flips, removal drops the total to ~2,788 KB and the budget should be lowered back to ~3,100 KB.

### 4. Per-chunk headroom is the tightest budget — watch ElevenLabs SDK growth (WATCH)

44 KB headroom (605 / 650 KB) is the thinnest margin of the three bundle budgets. The ElevenLabs SDK grew +0.5 KB on a patch bump (1.6.4 -> 1.6.5); a minor-version feature release could plausibly consume tens of KB. Any `@elevenlabs/react` bump beyond patch level should get a fresh-build measurement before merge, not after.

### 5. CLOSED THIS CYCLE — for the record

- **149 KB unidentified chunk (carried 8+ cycles)**: identified as Next.js App Router client runtime. Required framework code; no app-level action exists. Item closed.
- **Pending dep materialization (Jun 10 item 2)**: `npm install` run, #597 materialized, fresh build measured. Net bundle impact of posthog-js 1.384.0 + Supabase pair + 17 other production bumps: -5 KB total. Item closed.

## Recommendations Summary

1. Status GREEN, fully authoritative: 3,393 KB / 3,500 KB (107 KB headroom) on a fresh post-#597 build. The 19-package production batch cost nothing (-5 KB net).
2. The long-standing P1 mystery chunk is Next.js framework runtime — stop tracking it as an optimization target.
3. react-markdown plugin-set reduction (~150–250 KB potential) is the only remaining structural lever worth engineering effort while voice is retained.
4. Treat `@elevenlabs/react` minor bumps as measure-before-merge: per-chunk headroom is only 44 KB.
5. Local environment is now synced (npm install done, 0 vulnerabilities) — Triage's and Security's top hygiene action is complete; local test/build baselines can be re-run on current deps.

## Comparison to Previous Run (2026-06-10)

| Metric | Jun 10 (advisory, Jun 6 artifacts) | Jun 11 (fresh build, post-#597) | Change |
|---|---:|---:|:---:|
| Total JS | 3,398 KB | 3,393 KB | -5 KB |
| Total budget | 3,500 KB | 3,500 KB | unchanged |
| Bundle verdict | PASS (advisory) | PASS (authoritative) | provenance restored |
| Largest chunk (ElevenLabs) | 605 KB | 605 KB | +0.5 KB |
| Supabase chunk | 330 KB | 332 KB | +1.8 KB (ssr 0.12.0 + js 2.108.1) |
| PostHog chunks | 339 KB | 346 KB | +6.9 KB (1.384.0) |
| react-markdown family | 432 KB | 431 KB | -0.4 KB |
| Initial JS (est.) | ~2,022 KB | ~2,011 KB | -11 KB |
| Total CSS | 122 KB | 122 KB | unchanged |
| Production deps | 35 / 40 | 35 / 40 | unchanged |
| node_modules disk | 1,043 MB | 1,030 MB | -13 MB (lockfile sync) |
| Unidentified 149 KB chunk | open (8+ cycles) | identified: Next App Router runtime | closed |
| Build provenance | STALE (verified immaterial) | FRESH | authoritative |

Improvements: authoritative measurement restored; #597 measured at -5 KB net; the oldest open item on the books (149 KB chunk identification) closed; local node_modules synced to lockfile (-13 MB).

Regressions: none. PostHog +6.9 KB and Supabase +1.8 KB are absorbed by shrinkage elsewhere; every budget passes with more headroom than the advisory estimate.
