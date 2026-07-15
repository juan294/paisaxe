# Performance Agent Report — 2026-07-14

## Summary

Status: GREEN. This is the **seventh consecutive plateau cycle**. Every shipped-weight number is byte-identical to the Jul 8–13 post-dependency-batch baseline. No commit has touched `src/`, `package.json`, or `package-lock.json` since `92a4c42f` (Jul 10 08:08); the only commit after it (`c3d68e25`, the QA database-probe triage fold-in) modified `scripts/` and `e2e/` only. No client-code change could move a chunk, and none did.

Build provenance is clean and fresh. `.next` was recompiled today with a **new BUILD_ID (`u-a2HeWqzIhrP0XRCjCDP`, replacing Jul 13's `IdfhGFkcIn3dHhEWovuik`)**, and `.next/diagnostics/route-bundle-stats.json` is dated Jul 14 08:02 — it postdates the last source/dep commit by four days. The metrics script labels the build "CACHED" only because `.next` postdates that commit; the numbers below were re-derived directly from today's route-bundle-stats artifact (14 routes) and the on-disk chunk files, not copied forward. Same client source in, same bytes out — the numbers are authoritative for the current tree.

All optimization items of substance were closed in the Jul 8–9 cycles and re-verified holding on today's fresh build. Nothing is actionable this cycle. The only open items are watch-level and owned by other agents, plus one new low-priority watch: the Dependabot npm_and_yarn updater failed on Jul 13 (per QA and Security Jul 14) — if it keeps failing, the next routine dep batch (the only foreseeable source of bundle deltas) stops flowing.

## Key Metrics

| Signal | Value | Status |
|---|---:|:---:|
| Total JS | 3,057 KB (0 KB change) | PASS — 443 KB under 3,500 KB budget |
| First-load JS, `/immersive` (primary page) | 888 KB (908,821 B, measured) | PASS — flat |
| First-load JS, worst route (`/admin`) | 1,107 KB (1,133,572 B, measured) | PASS — admin-only surface |
| First-load JS, base routes (`/`, `/story/[slug]`) | 707 KB (724,443 B, measured) | PASS — flat |
| Total CSS | 134 KB | Stable — 9th consecutive cycle |
| Largest chunk — ElevenLabs + LiveKit | 591 KB (605,492 B, byte-identical) | PASS — deferred, in no first-load list |
| Supabase JS client chunk | 308 KB (315,234 B) | PASS — first-load only on /admin |
| PostHog chunk | 244 KB (249,535 B) | PASS — deferred |
| core-js via posthog-js | 110 KB (112,594 B) | PASS — async, loads with PostHog |
| React DOM + Next.js runtime | 232 KB (237,129 B) | Settled — framework chunk |
| Production deps | 34 / 40 | PASS — 6 headroom |
| node_modules disk | 1,031 MB | Stable |
| .next disk | 1,546 MB | Informational — down 32 MB vs Jul 13 (cache churn, not shipped weight) |

## Budget Status

| Budget | Limit | Current | Status |
|---|---:|---:|:---:|
| Total JS | 3,500 KB | 3,057 KB | PASS — 443 KB headroom (12.7% under) |
| Initial JS | 2,100 KB | 888 KB on /immersive; 1,107 KB worst (/admin) | PASS — 47.3% under on worst route |
| Per-chunk (informal 650 KB) | 650 KB | 591 KB max | PASS |
| Production deps | 40 | 34 | PASS |
| Total CSS | (no hard budget) | 134 KB | Baseline — stable 9th cycle |

No budgets exceeded. No budget moved a single byte this cycle.

## First-Load JS by Route (from `.next/diagnostics/route-bundle-stats.json`, Jul 14 08:02 build)

| Route | First-load JS | Delta vs Jul 13 | Carries Supabase chunk? | Carries ElevenLabs chunk? |
|---|---:|---:|:---:|:---:|
| /admin | 1,107 KB (1,133,572 B) | 0 | Yes (expected — eager auth) | No (deferred) |
| /immersive | 888 KB (908,821 B) | 0 | No | No (deferred, click-to-mount) |
| /favorites | 778 KB (797,017 B) | 0 | No | No |
| /pricing/checkout | 739 KB (756,582 B) | 0 | No | No |
| /pricing | 731 KB (748,513 B) | 0 | No | No |
| /pricing/checkout/return | 724 KB (740,868 B) | 0 | No | No |
| /pricing/success | 723 KB (740,519 B) | 0 | No | No |
| /about, /privacy, /terms | 718 KB (734,836 B) | 0 | No | No |
| /, /story/[slug], /coming-soon, /_not-found | 707 KB (724,443 B) | 0 | No | No |

Re-confirmed this cycle by direct chunk-identity check against today's fresh build: the 308 KB Supabase chunk (`2iccnjqtww60x.js`) appears in exactly one first-load list — `/admin`. The 591 KB ElevenLabs chunk (`3iklgkjh5uyog.js`) appears in **none**. The 244 KB PostHog chunk (`1zuww-tizgmla.js`) appears in none. All three deferral optimizations are holding. `optimizePackageImports` for `lucide-react` and `posthog-js` is confirmed active in `next.config.ts:19`.

## Chunk Classification (unchanged from Jul 9–13 — sizes byte-identical)

| Size | Chunk | Contents (evidence) | Loading |
|---:|---|---|---|
| 591 KB | `3iklgkjh5uyog.js` | ElevenLabs SDK + LiveKit (livekit x168, elevenlabs x11) | Deferred — click-to-mount, in no first-load list |
| 308 KB | `2iccnjqtww60x.js` | Supabase JS: GoTrue + Postgrest + Realtime + Storage | Async on public routes; first-load only on /admin |
| 244 KB | `1zuww-tizgmla.js` | PostHog (posthog x148) | Deferred — dynamic import in `posthog-provider.tsx` |
| 232 KB | `0hgypyft3yzsy.js` | React DOM + Next.js App Router runtime | First paint (required) |
| 145 KB | `33-ly4xjin9t2.js` | Shared vendor | First paint — in all first-load lists |
| 110 KB | `0cz1d0mv5g_q7.js` | core-js@3.48.0 polyfills, sole dependent posthog-js | Async — loads with PostHog chunk |
| 110 KB | `3su_i9204gfx5.js` | App code — service config/wrappers | Async — in no first-load list |
| 75 KB | `1-5gb9zqmqb7l.js` | Shared app/UI code | First paint — in all first-load lists |
| 64 KB | `1dnam7n9w7rav.js` | Supabase SSR/auth-helper side | First-load only on /admin |
| 52 KB | `445ry45b8bclp.js` | /immersive UI (story-info-panel, nav-hint, motion x24) | On /immersive first-load list |

node_modules disk sizes remain install footprints, not bundle weight: `pdfjs-dist` (61 MB) and `pdf-parse` (57 MB) are devDependencies; `canvas` (19 MB) is an optionalDependency, server-side only; `next`/`@next`/`@sentry`/`typescript` are tooling. `core-js` (15 MB on disk) ships only the ~110 KB subset posthog-js imports.

## Top Optimization Opportunities (prioritized by impact)

There are **no new actionable optimizations this cycle**. All substantive levers were closed Jul 8–9 and re-verified holding on today's fresh build. The list below is the standing watch/decision set, with one addition.

### 1. Dependabot npm_and_yarn updater failure — dep-pipeline watch (NEW, LOW)

The Jul 13 Dependabot npm_and_yarn run failed updater-side (run 29234361163, per QA and Security Jul 14; the github_actions run succeeded). This is not a bundle event, but the routine dep batch is the only foreseeable source of bundle deltas (single-digit KB in deferred chunks per Security's assessment of the pending 21-package drift). If the failure recurs, version PRs stop flowing and drift accumulates. Triage owns the recheck; this agent just watches for the eventual batch's bundle impact when it lands.

### 2. ElevenLabs voice-shelving — product/cost lever (WATCH, unchanged)

The single largest chunk (591 KB, byte-identical) is fully deferred (click-to-mount, in no first-load list); it costs current users nothing on any route. Per Cost Analyst (Jul 13), Paisaxe voice silence is at 146 days and the ElevenLabs annual renewal is 2027-02-07 (~$266). Shelving is a product/renewal decision, not a bundle lever — there is no first-paint cost to reclaim. No bundle action.

### 3. Total JS headroom watch (ONGOING)

443 KB headroom under the 3,500 KB budget (12.7% under), unchanged. Threshold unchanged: revisit only if headroom drops below 300 KB. The one foreseeable pressure is issue #721 (hydration-readiness UI work on /immersive) if it ever ships client code — QA owns that issue.

### 4. Housekeeping (LOW): .next cache footprint

`.next` sits at 1,546 MB, **down 32 MB** from Jul 13's 1,578 MB — Turbopack evicted some incremental cache during today's rebuild. Not shipped weight, no user impact, no action. If local disk ever becomes a concern: `rm -rf .next && npm run build`.

## Comparison to Previous Runs

| Metric | Jul 10 | Jul 11 | Jul 12 | Jul 13 | Jul 14 |
|---|---:|---:|---:|---:|---:|
| Total JS | 3,057 KB | 3,057 KB | 3,057 KB | 3,057 KB | 3,057 KB (flat) |
| vs 3,500 KB budget | -443 KB | -443 KB | -443 KB | -443 KB | -443 KB |
| /immersive first-load | 887 KB | 888 KB | 888 KB | 888 KB | 888 KB (flat) |
| /admin first-load | 1,107 KB | 1,107 KB | 1,107 KB | 1,107 KB | 1,107 KB (flat) |
| Total CSS | 134 KB | 134 KB | 134 KB | 134 KB | 134 KB (flat) |
| Supabase chunk | 308 KB (deferred) | 308 KB (deferred) | 308 KB (deferred) | 308 KB (deferred) | 308 KB (deferred) |
| ElevenLabs chunk | 591 KB | 591 KB | 591 KB | 591 KB | 591 KB (byte-identical) |
| PostHog chunk | 244 KB | 244 KB | 244 KB | 244 KB | 244 KB (flat) |
| Production deps | 34/40 | 34/40 | 34/40 | 34/40 | 34/40 |
| node_modules | 1,031 MB | 1,031 MB | 1,031 MB | 1,031 MB | 1,031 MB |
| .next disk | 1,639 MB | 1,544 MB | 1,560 MB | 1,578 MB | 1,546 MB |

No regressions, no improvements: every shipped-weight metric is flat because no client source changed since Jul 10 (and no first-load-relevant source since Jul 8). This is the expected steady state after the Jul 8 P1 deferral and #717/#718 dep batch settled. The /immersive first-load byte count (908,821 B) is unchanged; the historical 887 vs 888 KB reading remains a rounding artifact.

## Cross-Agent Observations This Cycle

**QA Jul 14 YELLOW** — LLM 12/12, journeys 10/10; the sole failure is the Stripe integration probe returning HTTP 000, root-caused as a curl transport flake (same class as the Jul 10 db-probe incident), with Stripe verified healthy on live re-check (~0.3s responses). No bundle or client-performance implication — the probe defect is in `scripts/qa-agent.sh:196`, shell-side only. QA also flags the failed Dependabot npm_and_yarn run — see Opportunity 1.

**Security Jul 14 GREEN** — 0 advisories, clean npm audit, all headers verified live this cycle. 21 outdated packages, zero CVEs; only major is dev-only TypeScript 6→7. Security confirms no package in the pending batch is first-load visible — posthog-js/supabase-js deltas land in deferred chunks only. Consistent with this agent's chunk map: posthog-js code lives in `1zuww-tizgmla.js` + core-js (both async), supabase-js in `2iccnjqtww60x.js` (admin-only first-load).

**Coverage Jul 14** — plateau at 98.84% stmts; zero source changes, no tests added, gap inventory now fully enumerated. Test-only cycle, zero bundle impact, no new dependencies. Their dead-code finding (`story-info-panel.tsx:35` `onToggleFavorite` dead prop and its closure at `story-viewer.tsx:240`) is bytes-level if removed — no meaningful bundle delta, but no objection.

**Localization Jul 14** — 100% coverage, 411 leaf keys per locale. i18n lazy-loading (es+en static, fr/de/pt/ast dynamic) unchanged. No bundle impact.

**Documentation Jul 14 GREEN** — no gaps, no edits. No bundle relevance.

**Cost Analyst Jul 13 WATCH** — 146-day Paisaxe voice silence; the 591 KB ElevenLabs chunk is fully deferred and costs current users nothing, so shelving remains purely a Feb 2027 renewal/cost decision they own.

## Open Items

| Item | Priority | Owner | Status |
|---|---|---|---|
| Dependabot npm_and_yarn updater failure — dep batch pipeline | Watch (new) | Triage | Open — recheck next scheduled run |
| Total JS headroom watch (443 KB; act below 300 KB) | Watch | Performance | Open — ongoing |
| Issue #721 hydration readiness — potential future client-code cost | Watch | QA | Open |
| ElevenLabs voice-shelving product decision | Decision | Cost Analyst | Open — Feb 2027 renewal window |

## Closed / No-Action Items (for the record)

| Item | Resolution |
|---|---|
| LLM suite +19% runtime — server/API side, not bundle-attributable | CLOSED — did not recur Jul 11–14; QA confirms non-bundle |
| Fresh post-#717/#718 baseline build | CLOSED (Jul 9) — +8 KB total, all deferred chunks, first-paint flat; re-confirmed byte-identical Jul 10–14 |
| Classify `0cz1d0mv5g_q7.js` (110 KB) | CLOSED (Jul 9) — core-js@3.48.0 via posthog-js (sole dependent), async with PostHog chunk |
| CSS 122 → 134 KB attribution | CLOSED — byte-identical 9 cycles; 134 KB is the baseline |
| P1: Supabase chunk off first paint | CLOSED (Jul 8) — re-verified today: chunk on /admin first-load only |
| P2: build:analyze artifact | CLOSED (Jul 8) — `docs/agents/bundle-analysis/2026-07-08.html` |
| PostHog deferral | CLOSED — dynamic-imported; full deferred cost 244 KB + 110 KB core-js; verified in no first-load list today |
| `optimizePackageImports` (lucide-react, posthog-js) | CLOSED — active in `next.config.ts:19` (verified today) |
| `pdfjs-dist` / `pdf-parse` client-bundle risk | CLOSED — devDependencies, never shipped |
| ElevenLabs click-to-mount | CLOSED — active, 591 KB in no first-load list (verified today) |

---
