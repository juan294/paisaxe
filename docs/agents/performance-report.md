# Performance Agent Report — 2026-06-17

## Summary

Status: GREEN, authoritative. Build provenance is CACHED-but-authoritative: `.next` mtime (2026-06-17 08:00:35) postdates the last source/dep commit (`72add372`, 2026-06-15 08:12:03 — "chore(deps): bump the production group with 9 updates"), so the on-disk bundle reflects the current source tree exactly. No rebuild was needed.

Total JS is **3,027 KB**, up +3 KB from Jun 16 (3,024 KB). The change is entirely attributable to the 9-package production dep bump in the Jun 15 commit — proportionate and expected. All budgets pass with comfortable margins.

**Opportunity 1 from Jun 16 is CLOSED**: `esbuild` and `protobufjs` have been moved from `dependencies` to `overrides` (package.json:141-142). Production dep count is now **34/40**, recovering two budget slots (was 36/40, 4 slots headroom; now 6 slots headroom). The Security and Triage agents independently requested this same move on Jun 16; it landed in the Jun 15 dep bump commit.

The three heaviest vendor chunks — ElevenLabs (605 KB), Supabase (332 KB), PostHog (347 KB across two chunks) — remain off the synchronous first-paint path (deferred or click-to-mount). That is roughly 1,284 KB — about 42% of total weight — that never loads on first paint. First paint is dominated by the ~532 KB framework shell.

One actionable item is carried: **`npm run build:analyze`** (webpack) for precise per-route initial-load budget measurement. Now 8+ cycles deferred. No other engineering-side lever remains until either that measurement surfaces a surprise or the voice-shelving product decision is made.

## Key Metrics

| Signal | Value | Authoritative? | Status |
|---|---:|:---:|:---:|
| Total JS | 3,027 KB | Yes (CACHED-authoritative) | PASS — 473 KB under 3,500 KB budget |
| Initial JS (split budget half) | est. ~700-900 KB first load | Estimate (no webpack manifest) | PASS — heaviest vendors deferred |
| Largest chunk (ElevenLabs) | 605 KB | Yes | PASS — 45 KB under 650 KB per-chunk budget |
| Total CSS | 121 KB | Yes | Healthy (no hard budget) |
| Production deps | 34 / 40 | Yes | PASS — 6 headroom (improved from 4) |
| Dev deps | 30 | Yes | Informational |
| node_modules disk | 1,022 MB | Yes | GREEN (flat) |
| .next disk | 111 MB | Yes | Informational (cache, not shipped) |

Note on Initial JS: the build uses Turbopack. The webpack-style `app-build-manifest.json` with per-route first-load totals is absent from cached artifacts, so the precise initial-load number cannot be confirmed without a `npm run build:analyze` (webpack) run. The three heaviest vendor chunks are confirmed deferred, putting realistic per-page first load around 700-900 KB — comfortably under the 2,100 KB initial budget half. To verify precisely, run `build:analyze` (Opportunity 2).

## Budget Status

| Budget | Limit | Current | Delta vs Jun 16 | Status |
|---|---:|---:|---:|:---:|
| Total JS | 3,500 KB | 3,027 KB | +3 KB | PASS — 473 KB headroom |
| Initial JS | 2,100 KB | est. ~700-900 KB | — | PASS — heaviest vendors deferred |
| Per-chunk | 650 KB | 605 KB max (ElevenLabs) | 0 KB | PASS — 45 KB headroom (tightest) |
| Production deps | 40 | 34 | -2 (IMPROVED) | PASS — 6 headroom |
| node_modules disk | (soft) | 1,022 MB | +5 MB | GREEN |
| Total CSS | (no hard budget) | 121 KB | -1 KB | Healthy |

No budgets exceeded.

## Largest Chunks Analysis

| Size (bytes) | Chunk | Contents (inferred) | Loading | Notes |
|---:|---|---|---|---|
| 605,485 | `3ok4a8oup1rkk.js` | ElevenLabs SDK (`elevenlabs`/`convai`) | Deferred — click-to-mount | Same weight as Jun 16; hash changed due to dep bump |
| 331,828 | `0ccjtfdj3941f.js` | Supabase client (`GoTrueClient`) | Deferred — lazy import() in auth-provider | +1,186 bytes vs Jun 16 (supabase-js patch bump) |
| 237,297 | `0273rfe8p5u4v.js` | React + Next framework vendor (`react-dom`/`scheduler`) | First paint (required) | Identical |
| 229,170 | `0x97hp5pq2jca.js` | PostHog core (`posthog`) | Deferred — post-hydration, prod-only | +1,280 bytes vs Jun 16 (posthog-js minor bump) |
| 148,880 | `3c-18qv58e7zi.js` | Next.js App Router client runtime | First paint (required framework) | Identical |
| 117,617 | `2f1alz9dhg520.js` | PostHog support chunk | Deferred | Identical |
| 112,594 | `0cz1d0mv5g_q7.js` | Shared app chunk | First paint | Identical |
| 76,897 | `3uwi2y7pkzyjg.js` | Shared runtime | First paint | Identical |
| 67,763 | `14q503fs3fh64.js` | Route chunk | Per-route | Identical |
| 56,058 | `3e64rfhwmn64h.js` | Route chunk | Per-route | Same size, hash changed (dep bump) |

Chunk hashes changed across multiple chunks due to the dep bump — this is normal content-addressed behavior. Only sizes matter for budgeting.

Deferred / lazy weight: ElevenLabs 605 + Supabase 332 + PostHog 347 = ~1,284 KB — about 42% of total weight never loads on synchronous first paint.

## Closed Since Previous Run

**Opportunity 1 (Jun 16) — CLOSED: `esbuild` + `protobufjs` security pins moved to `overrides`.**

Both packages were in `dependencies` solely to pin safe transitive versions (vite/tsx chain and PostHog/OTel chain respectively), consuming two production dep budget slots without shipping any client code. They are now correctly placed in `overrides` alongside the existing `qs`, `minimatch`, `brace-expansion`, `postcss`, and `uuid` pins:

```json
"overrides": {
  "qs": ">=6.15.2",
  "minimatch": ">=10.2.1",
  "brace-expansion": ">=5.0.6",
  "postcss": "^8.5.15",
  "uuid": ">=14.0.0",
  "esbuild": ">=0.28.1",
  "protobufjs": ">=8.6.3"
}
```

Impact: production dep count recovered from 36/40 to 34/40. Neither package appears in `src/` (confirmed by grep — 0 matches both cycles). The security agent confirmed `npm audit --omit=dev` is clean post-move.

## Top Optimization Opportunities (prioritized by impact)

The bundle remains lean at the application level. No large reducible app-side JS weight exists. The two remaining levers are measurement and a product decision.

### 1. Run `build:analyze` for precise initial-load budget measurement (LOW EFFORT, MEASUREMENT — ~8 CYCLES OVERDUE)

The split budget (initial 2,100 KB / total 3,500 KB, since 2026-04-04) has an authoritative total-half check (3,027 KB, 473 KB headroom) but no authoritative initial-half number. The Turbopack cached build does not produce `app-build-manifest.json` with per-route first-load breakdowns. A single `npm run build:analyze` (webpack flag) produces:

- Authoritative per-route first-load JS totals
- Webpack bundle tree for visual composition inspection
- Confirmation that the dep-pin cleanup is bundle-neutral (expected: ~0 delta)

This is the only outstanding engineering-side action with a concrete path to run. Pair it with any future dep batch to amortize the build time.

```bash
npm run build:analyze
# Opens .next/analyze/client.html and server.html
```

### 2. ElevenLabs voice-shelving — 605 KB, product lever only (HIGHEST RAW IMPACT, NON-ENGINEERING)

The single largest chunk (605 KB) is already deferred to click-to-mount (`bd833288`), so it has zero first-paint cost. It is also the tightest per-chunk margin: 605 / 650 KB, only 45 KB headroom. Cost Analyst (Jun 17) reports 120 days of zero Paisaxe voice traffic; the product case for shelving voice has been flagged for multiple consecutive cycles.

If voice is shelved:
- Total JS drops from 3,027 KB to approximately 2,420 KB
- The per-chunk margin concern disappears entirely
- Total budget should be re-lowered to ~3,100 KB to match actual footprint
- ~$45/mo ElevenLabs tier downgrade becomes available

This is a user/product decision. No agent action until the decision is made.

### 3. ElevenLabs per-chunk headroom watch (WATCH — no action yet)

The 605 / 650 KB per-chunk margin is the tightest budget. Any future `@elevenlabs/react` bump beyond patch level must include a fresh-build measurement before merge. Security (Jun 17) reports GREEN with 0 advisories — no forced ElevenLabs bump this cycle. But the margin is narrow enough that a feature minor (e.g., 1.6.7 → 1.7.x) could plausibly consume the remaining 45 KB. Measure before committing to any minor or major ElevenLabs upgrade.

### 4. PostHog — already optimal, no further lever (FOR THE RECORD, NO ACTION)

PostHog (347 KB across two chunks) is (a) lazy-loaded via dynamic `import()` after hydration, (b) production-only, (c) minimally configured — autocapture, pageview, and pageleave all off since the Jun 12 triage. The support chunk contains no rrweb / session-recording / surveys / web-vitals / toolbar signatures. Treat this chunk as settled unless a significant posthog-js major ships new default-enabled features.

## Comparison to Previous Run

| Metric | Jun 14 | Jun 16 | Jun 17 (this run) | Change (cycle) |
|---|---:|---:|---:|:---:|
| Total JS | 3,024 KB | 3,024 KB | 3,027 KB | +3 KB (dep bump) |
| Total budget | 3,500 KB | 3,500 KB | 3,500 KB | unchanged |
| Total headroom | 476 KB | 476 KB | 473 KB | -3 KB |
| ElevenLabs chunk | 605 KB | 605 KB | 605 KB | unchanged (deferred) |
| Supabase chunk | 331 KB | 331 KB | 332 KB | +1 KB (supabase-js bump) |
| PostHog chunks | 346 KB | 346 KB | 347 KB | +1 KB (posthog-js bump) |
| Total CSS | 122 KB | 122 KB | 121 KB | -1 KB |
| Production deps | 36 / 40 | 36 / 40 | 34 / 40 | -2 (IMPROVED — pins moved to overrides) |
| node_modules disk | 1,017 MB | 1,017 MB | 1,022 MB | +5 MB (9 pkg bump) |
| .next disk | 132 MB | 135 MB | 111 MB | -24 MB (cache flush) |
| Build provenance | CACHED-authoritative | CACHED-authoritative | CACHED-authoritative | — |

Improvements: production dep count reduced from 36/40 to 34/40 — the Opportunity 1 dep-pin cleanup landed. Total CSS shrank 1 KB.

Regressions: none in shipped weight. The +3 KB total JS is proportionate to a 9-package production dep bump and falls well within noise for routine maintenance.

## Recommendations Summary

1. Status GREEN, authoritative: 3,027 KB / 3,500 KB (473 KB headroom). +3 KB from a 9-package dep bump — within noise.
2. CLOSED: `esbuild` + `protobufjs` moved to `overrides` — production dep count now 34/40, recovering 2 budget slots. Well done.
3. ACTIONABLE (carried, ~8 cycles): run `npm run build:analyze` once to obtain authoritative per-route initial-load totals and verify the initial-half budget (2,100 KB). This is the only outstanding engineering action.
4. WATCH: ElevenLabs per-chunk margin is 45 KB (605/650 KB). Any `@elevenlabs/react` minor or major bump must measure before merge.
5. PRODUCT LEVER: ElevenLabs voice-shelving removes 605 KB, clears the per-chunk watch, and enables ~$45/mo tier downgrade. User decision only.
6. PostHog (347 KB, two chunks) and Supabase (332 KB) are both correctly deferred. No further structural lever on either.

---
