# Performance Agent Report — 2026-07-07

## Summary

Status: GREEN. Total JS is 3,022 KB — 478 KB under the 3,500 KB total budget, byte-for-byte identical to every cycle since Jul 1 (same ten chunk sizes). No `src/` or `package.json` commit has landed since 9f61331a (Jul 1 08:20); every intervening change is docs, agent reports, or uncommitted test files. Build provenance: `.next` (Jul 7 08:02) postdates the last source/dep commit, so cached bundle numbers are authoritative for the current source tree.

The CSS watch item from Jul 6 has one new data point: **Total CSS is holding at 134 KB for a 2nd consecutive cycle**, and the two on-disk chunks are byte-identical to yesterday (`0c2nogbb481gq.css` = 135,679 B, `1vpmbl4hekwi8.css` = 2,111 B, both mtime Jul 7 08:02). The 122 KB → 134 KB step happened once (between Jul 4 and Jul 6) and is now stable — this looks like a one-time build-environment shift rather than ongoing growth. Cause remains unattributed; `build:analyze` (P2) is still the one-run way to resolve it.

Both standing action items re-verified open this cycle:

1. **P1: defer the ~324 KB Supabase chunk off first paint — NOT landed.** `src/lib/stories-data.ts:4-5` still statically imports `supabase` and `createSupabaseBrowserClient`, and `getClient()` (lines 11-16) is still synchronous. `src/lib/realtime.ts:1` still statically imports the browser client. Unchanged since Jul 2.
2. **P2: no `build:analyze` artifact exists.** `.next/analyze/` and `docs/agents/bundle-analysis/` both absent.

**New sequencing constraint on P1 (from QA Jul 7):** QA filed issue #720 — Journey 1's next-button click is swallowed by a PPR pre-hydration race in the E2E harness. QA explicitly asks that the #720 fix (a `toPass()` retry around click+assert) land BEFORE the P1 Supabase deferral, because making `getClient()` async widens the dev-server hydration window that caused the failure. P1 is therefore blocked-by-preference on #720, in addition to the standing `webServer.timeout` bump and `stories-data.ssr.test.ts` mock coordination. None of this changes the production value of P1; it only sequences the landing.

## Key Metrics

| Signal | Value | Authoritative? | Status |
|---|---:|:---:|:---:|
| Total JS | 3,022 KB | Yes (cached build postdates all source/dep changes) | PASS — 478 KB under 3,500 KB budget |
| Total CSS | 134 KB | Yes (byte-identical to Jul 6 on disk) | Watch — stable at new level for 2nd cycle, cause unattributed |
| Largest chunk — ElevenLabs + LiveKit, deferred | 591 KB (605,492 B) | Yes | PASS — click-to-mount, zero first-paint cost |
| Second — Supabase JS client | 324 KB (331,533 B) | Yes | OPEN — statically imported into first-paint graph via `stories-data.ts`; deferrable (P1) |
| Third — PostHog | 241 KB (247,124 B) | Yes | PASS — dynamically imported (`posthog-provider.tsx:86`), deferred |
| Fourth — React DOM + Next.js App Router runtime | 232 KB (237,128 B) | Yes | Settled — framework chunk, cannot be deferred |
| Production deps | 34 / 40 | Yes | PASS — 6 headroom |
| node_modules disk | 1,029 MB | Yes | GREEN — flat |
| .next disk | 1,100 MB | Yes | Informational — within normal cache fluctuation (1,088–1,172 MB range) |

## Budget Status

| Budget | Limit | Current | Status |
|---|---:|---:|:---:|
| Total JS | 3,500 KB | 3,022 KB | PASS — 478 KB headroom (13.7% under) |
| Initial JS | 2,100 KB | est. ~900–1,100 KB (includes the 324 KB Supabase chunk on /immersive) | PASS (estimated) — a fresh `next build` First Load JS table would confirm precisely |
| Per-chunk (informal 650 KB) | 650 KB | 591 KB max | PASS |
| Production deps | 40 | 34 | PASS |
| Total CSS | (no hard budget) | 134 KB | Watch — flat this cycle; one-time step from 122 KB, unattributed |

No budgets exceeded.

## Chunk Classification (unchanged since Jul 2 content-signature analysis; verified byte-identical again)

| Size | Chunk | Contents (evidence) | Loading |
|---:|---|---|---|
| 591 KB | `3iklgkjh5uyog.js` | ElevenLabs SDK + LiveKit (`livekit` x168, `elevenlabs` x11) | Deferred — click-to-mount |
| 324 KB | `1wc2k45fb81oe.js` | Supabase JS: GoTrue + Postgrest + Realtime + Storage (`supabase` x91, `storage` x197, `websocket` x31) | First-paint on /immersive via static import chain (see Opportunity 1) |
| 241 KB | `3i6-rmo-y6p32.js` | PostHog (`posthog` x147, `$feature_flag` x21) | Deferred — dynamic import in `posthog-provider.tsx:86-87` |
| 232 KB | `3wy6iknrljhg9.js` | React DOM + Next.js App Router runtime | First paint (required) |
| 145 KB | `33-ly4xjin9t2.js` | Shared vendor incl. pino browser build + scheduler | Shared |
| 110 KB | `0cz1d0mv5g_q7.js` | No library signatures — likely app code / Next.js internals | Unknown (only remaining JS mystery, low priority) |
| 110 KB | `3su_i9204gfx5.js` | App code (references supabase/posthog/elevenlabs config, not the SDKs) | App code |
| 75 KB | `1-5gb9zqmqb7l.js` | App/UI code (`cva`, storage refs) | App code |
| 52 KB | `445ry45b8bclp.js` | App code | App code |
| 50 KB | `30ag7c5m39-7t.js` | App shell + web vitals | App shell + speed-insights |

**node_modules disk sizes are install footprints, not bundle weight.** `pdfjs-dist` (61 MB) and `pdf-parse` (57 MB) are devDependencies — never shipped to the client. `canvas` (19 MB) is an optional server-side dep. `next` (186 MB), `@next` (117 MB), `@sentry` (79 MB), `typescript` (24 MB) are tooling/runtime install sizes.

## Top Optimization Opportunities (prioritized by impact)

### 1. Defer the 324 KB Supabase chunk off the first-paint path (MEDIUM EFFORT, HIGHEST REMAINING IMPACT) — STILL OPEN, now sequenced after QA #720

Confirmed still unimplemented this cycle. The chain pulling the Supabase JS client onto the /immersive first-paint graph:

- `use-stories.ts` → `stories-data.ts:4-5` (static `import { supabase }` + `import { createSupabaseBrowserClient }`)
- `use-realtime-feature-flags.ts` → `realtime.ts:1` (static `import { createSupabaseBrowserClient }`)
- `use-admin-role.ts` (admin-only surface — lower priority)

The correct pattern already exists in `auth-provider.tsx`, which dynamic-imports the client inside an async function. Every Supabase call site in `stories-data.ts` already sits inside an async function, so `getClient()` can become async with no architectural change:

```ts
// stories-data.ts — replace the two static imports (lines 4-5) with:
async function getClient() {
  if (typeof window !== "undefined") {
    const { createSupabaseBrowserClient } = await import("./supabase-browser");
    const browser = createSupabaseBrowserClient();
    if (browser) return browser;
  }
  const { supabase } = await import("./supabase");
  return supabase;
}
// call sites: getClient().from(...) → (await getClient()).from(...)
```

Apply the same treatment to `realtime.ts` — a single remaining static import in the initial graph keeps the whole chunk in it.

Honest framing: the 324 KB does not disappear — it moves off the hydration critical path and loads in parallel right after mount (the data fetch happens on mount anyway). The gain is deferred parse/execute of ~324 KB during the LCP window on the primary page, plus it stops counting against the 2,100 KB initial budget. Verify with the First Load JS table from a fresh `next build` before/after.

**Landing checklist (updated this cycle):**
1. QA #720 fix first — `toPass()` retry around the Journey 1 click+assert in `qa-journey.spec.ts` (the async chunk widens the hydration window that already caused a flake on Jul 7).
2. `playwright.config.ts` `webServer.timeout` bump (dev-server cold-compile risk for on-demand chunks; not a production concern).
3. Update `stories-data.ssr.test.ts` mocks for the async `getClient()` conversion — note this file is still UNCOMMITTED in the working tree (4 days old, per Coverage Jul 6/QA Jul 7); it should be committed before P1 touches it.

### 2. Persist a `build:analyze` artifact (LOW EFFORT) — P2, still open, still the CSS-delta resolver

`.next/analyze/` is absent again. One run answers three questions: module-level breakdown of the 145 KB and 110 KB unclassified JS chunks, and what module accounts for the 122 KB → 134 KB CSS step (now stable, so a single artifact fully characterizes the new baseline):

```bash
cd /Users/juan/code/paisaxe   # main repo, NOT a worktree
npm run build:analyze
mkdir -p docs/agents/bundle-analysis && cp .next/analyze/client.html docs/agents/bundle-analysis/2026-07-07.html
```

### 3. ElevenLabs voice-shelving — product/cost lever (WATCH, unchanged)

The 591 KB ElevenLabs + LiveKit chunk remains fully deferred (click-to-mount) and serves zero users (140-day Paisaxe voice silence per Cost Analyst Jul 7; the ElevenLabs cycle closed today at 3.4% utilization, all of it non-Paisaxe). Nothing further to optimize in the bundle; the remaining lever is the cost decision at the Feb 2027 renewal, which Cost Analyst notes now converges with Twilio balance depletion into a single voice-stack decision point.

### 4. Monitor total JS headroom (ONGOING WATCH)

478 KB headroom, flat for the 7th consecutive tracked cycle. If Opportunity 1 lands, initial-path JS drops by ~324 KB while total stays constant. Revisit only if headroom drops below 300 KB. The routine dependency-freshness batch (28 outdated packages per Security Jul 7, all minor/patch, zero CVEs — largest gaps `@anthropic-ai/sdk` 0.106→0.110, `posthog-js` 1.395→1.398, `@supabase/supabase-js` 2.108→2.110) is expected to have zero bundle impact: posthog is deferred, `@anthropic-ai/sdk` is server-only via `serverExternalPackages`, and the rest are patch-level. The new `eslint` 10 major is dev-only. When the batch merges, the next fresh build will confirm.

## Comparison to Previous Runs

| Metric | Jul 1 | Jul 2 | Jul 3 | Jul 4 | Jul 6 | Jul 7 |
|---|---:|---:|---:|---:|---:|---:|
| Total JS | 3,022 KB | 3,022 KB | 3,022 KB | 3,022 KB | 3,022 KB | 3,022 KB |
| vs 3,500 KB budget | -478 KB | -478 KB | -478 KB | -478 KB | -478 KB | -478 KB |
| Total CSS | 122 KB | 122 KB | 122 KB | 122 KB | 134 KB | 134 KB |
| ElevenLabs + LiveKit chunk | 591 KB | 591 KB | 591 KB | 591 KB | 591 KB | 591 KB |
| Supabase chunk | 324 KB | 324 KB | 324 KB | 324 KB | 324 KB | 324 KB |
| PostHog chunk | 241 KB | 241 KB | 241 KB | 241 KB | 241 KB | 241 KB |
| Production deps | 34/40 | 34/40 | 34/40 | 34/40 | 34/40 | 34/40 |
| node_modules | 1,029 MB | 1,029 MB | 1,024 MB | 1,029 MB | 1,029 MB | 1,029 MB |
| .next disk | 1,127 MB | 1,154 MB | 1,126 MB | 1,172 MB | 1,088 MB | 1,100 MB |

No regressions, no improvements — JS flat for the 7th consecutive cycle, CSS stable at its new 134 KB level for the 2nd. The entire JS optimization backlog (P1 Supabase deferral, P2 analyze artifact) remains unchanged and unactioned since Jul 2.

## Cross-Agent Observations This Cycle

**QA Jul 7 YELLOW (GREEN streak ends at 2).** Both failures are harness-level, not app-level: #719 (test retry loop misses network errors) and #720 (PPR pre-hydration click race in Journey 1). #720 directly affects P1 sequencing — see Opportunity 1. No production performance signal in either failure.

**Security Jul 7 GREEN (9th consecutive).** 0 advisories, npm audit clean full-tree. 28 outdated packages, all minor/patch, 0 CVEs; batch confirmed zero-bundle-impact per prior analysis. eslint 10 major is dev-only, deferred.

**Cost Analyst Jul 7 WATCH.** Twilio July base rental posted — the number-release window is closed for July; next gate ~Aug 7. ElevenLabs cycle closed at 3.4% utilization, all non-Paisaxe. Confirms no bundle lever remains on voice; it is a Feb 2027 renewal decision.

**Coverage Jul 6 GREEN.** Plateau holds (98.84% stmts), 4th consecutive identical cycle. The 4 uncommitted Jul 3 test files — including `stories-data.ssr.test.ts`, which P1 must update — are still uncommitted (4 days old).

**Localization Jul 7.** i18n bundles stable (~15 KB each), es+en static, others lazy — no action. Also flags a local-env issue: stale `.next/dev/types/` artifacts break local `npm run typecheck` (not CI, not bundle-related).

## Open Items

| Item | Priority | Status |
|---|---|---|
| Defer Supabase chunk (324 KB) via async import in `stories-data.ts` + `realtime.ts` | P1 | Open — verified unimplemented this cycle; land AFTER QA #720 fix, with `webServer.timeout` bump and `stories-data.ssr.test.ts` coordination |
| Persist `build:analyze` output to `docs/agents/bundle-analysis/` | P2 | Open — resolves the CSS-step attribution and the two unclassified JS chunks in one run |
| Explain the CSS step (122 KB → 134 KB, now stable) | Medium | Open — verified byte-identical for 2nd cycle; one-time step, not ongoing growth; resolve via P2 |
| Classify `0cz1d0mv5g_q7.js` (110 KB, no library signatures) | Informational | Open — likely app code; resolve with P2 treemap |
| ElevenLabs voice-shelving product decision | User decision | Open — cost lever only (Feb 2027 renewal, converging with Twilio runway per Cost Analyst) |

## Closed / No-Action Items (for the record)

| Item | Resolution |
|---|---|
| Twilio number release decision (July window) | CLOSED for July (Jul 7) — base rental posted, charge sunk; next decision gate ~Aug 7 (Cost Analyst owns) |
| Classify all top-10 JS chunks | CLOSED (Jul 2) — signature-grepping resolved identity; verified flat this cycle |
| PostHog deferral | CLOSED — dynamic-imported at `posthog-provider.tsx:86-87` |
| `optimizePackageImports` (lucide-react, posthog-js) | CLOSED — active in `next.config.ts` |
| `pdfjs-dist` / `pdf-parse` client-bundle risk | CLOSED — devDependencies, never shipped |
| ElevenLabs click-to-mount | CLOSED — active, 591 KB fully deferred |

---
