# Performance Agent Report — 2026-06-16

## Summary

Status: GREEN, authoritative. Build provenance is CACHED-but-authoritative: `.next` mtime (2026-06-16 08:00:41) postdates the last source/dep commit (`0ea0fbf1`, 2026-06-14 07:38:25), so the on-disk bundle reflects the current source tree exactly. No rebuild was required, and no source or dependency commit has landed since the last run — this is a fully flat cycle.

Total JS is **3,024 KB**, byte-identical to the Jun 14 run (change 0 KB), leaving **476 KB of headroom under the 3,500 KB total budget**. Production dependency count is unchanged at **36 / 40**. The ten largest chunk filenames and sizes are identical to last cycle, so no chunk composition changed. There is nothing new to optimize in shipped weight this cycle.

The three heaviest vendor chunks — ElevenLabs (605 KB), Supabase (331 KB), PostHog (346 KB across two chunks) — all remain OFF the synchronous first-paint path (deferred or click-to-mount). That is ~1,282 KB, about 42% of total weight, that never loads on first paint. First paint is dominated by the ~532 KB framework shell.

The one actionable carry-over is unchanged from Jun 14 and remains unactioned: **`esbuild` and `protobufjs` are still in `dependencies` (package.json:85, 91) when they should be in `overrides`.** They are security/audit version pins, not application code — `grep` confirms (again, this cycle) that neither is imported anywhere in `src/`. Moving them to `overrides` recovers two production-dep budget slots (36/40 -> 34/40). The Security agent (Jun 16) independently re-raised this same ask, so the two reports agree.

Actions taken by this agent: read-only analysis only. No source changes, no rebuild (existing artifacts are authoritative per provenance).

## Key Metrics

| Signal | Value | Authoritative? | Status |
|---|---:|:---:|:---:|
| Total JS | 3,024 KB | Yes (cached build postdates last src commit) | PASS — 476 KB under 3,500 KB |
| Initial JS (split budget half) | est. ~700-900 KB first load | Estimate (see note) | PASS — heaviest vendors deferred |
| Largest chunk (ElevenLabs) | 605 KB | Yes | Within 650 KB per-chunk budget (45 KB headroom) |
| Total CSS | 122 KB | Yes | Healthy (no hard budget) |
| Production deps | 36 / 40 | Yes | PASS but tight (4 headroom) |
| Dev deps | 30 | Yes | Informational |
| node_modules disk | 1,017 MB | Yes | GREEN (flat) |
| .next disk | 135 MB | Yes | Informational (cache, not shipped) |

Note on Initial JS: this is a Turbopack production build (`build:analyze` uses `--webpack`). The webpack-style `app-build-manifest.json` with per-route first-load totals is absent from the on-disk artifacts, so the precise initial-load number cannot be derived without a `npm run build:analyze` (webpack) run. What IS measurable: the three heaviest vendor chunks are all confirmed deferred, so a realistic per-page first load is roughly the framework shell (~532 KB) + shared app chunk (113 KB) + the route's own chunk — on the order of ~700-900 KB, comfortably under the 2,100 KB initial budget. To verify the split budget's initial half precisely, run `build:analyze` (carried recommendation, Opportunity 3).

Note on .next disk: 135 MB (Jun 14: 132 MB). This is build-cache/artifact growth (Turbopack incremental cache), not shipped bundle weight, and there is no hard budget. Informational only.

### Largest chunks (authoritative cached build)

| Size (bytes) | Chunk | Contents (evidence) | Loading | Notes |
|---:|---|---|---|---|
| 605,485 | `3l7h0thz1bbdh.js` | ElevenLabs SDK (`elevenlabs`/`convai`) | Deferred — click-to-mount (`bd833288`) | Tightest per-chunk margin (45 KB) |
| 330,642 | `0cx7amjxnog2y.js` | Supabase client (`GoTrueClient`) | Deferred — lazy `import()` in auth-provider | Off first paint since Jun 13 |
| 237,297 | `0273rfe8p5u4v.js` | React + Next framework vendor (`react-dom`/`scheduler`) | First paint (required) | Identical |
| 227,890 | `0gcbkw8dl4r9-.js` | PostHog core (`posthog`) | Deferred — post-hydration, prod-only | Identical |
| 148,880 | `3c-18qv58e7zi.js` | Next.js App Router client runtime | First paint (required framework) | No app-level lever |
| 117,617 | `2f1alz9dhg520.js` | PostHog support (no rrweb/replay/surveys signatures) | Deferred | Identical |
| 112,594 | `0cz1d0mv5g_q7.js` | Shared app chunk (no vendor signatures) | First paint | Identical |
| 76,897 | `3uwi2y7pkzyjg.js` | Shared runtime | First paint | Identical |
| 67,763 | `14q503fs3fh64.js` | Route chunk | Per-route | Identical |
| 56,058 | `3g-njyekx_z2d.js` | Route chunk | Per-route | Identical |

Deferred / lazy weight: ElevenLabs 605 + Supabase 331 + PostHog 346 = ~1,282 KB — about 42% of the bundle never loads on synchronous first paint. No chunk composition changed this cycle (all filenames and sizes byte-identical to Jun 14).

### Dependencies

Production deps at 36 / 40 (4 headroom). The two pins that occupy slots without shipping client code:

- `esbuild` (^0.28.1) — added to force a non-vulnerable transitive esbuild (vite/tsx chain). Build-time only — zero client bundle impact. Does not belong in `dependencies`.
- `protobufjs` (^7.6.4) — transitive via PostHog/OpenTelemetry; pinned earlier to clear a critical advisory. Only loads inside the already-deferred PostHog chunks. Zero first-paint impact.

Neither is imported in `src/` (re-verified by grep this cycle — 0 matches). Both are version pins masquerading as first-class deps. See Opportunity 1.

Unchanged: `pdfjs-dist` and `pdf-parse` remain `devDependencies` (never client-shipped). `lucide-react` and `posthog-js` remain covered by `optimizePackageImports` (`next.config.ts:19`). `voyageai` stays pinned at 0.1.0 (0.2.x has broken ESM) — exclude from any dep batch.

## Budget Status

| Budget | Limit | Current | Status |
|---|---:|---:|:---:|
| Total JS | 3,500 KB | 3,024 KB | PASS — 476 KB headroom |
| Initial JS | 2,100 KB | est. ~700-900 KB first load | PASS — heaviest vendors deferred |
| Per-chunk | 650 KB | 605 KB max (ElevenLabs) | PASS — 45 KB headroom (tightest) |
| Production deps | 40 | 36 | PASS — 4 headroom |
| node_modules disk | (soft) | 1,017 MB | PASS |
| Total CSS | (no hard budget) | 122 KB | Healthy |

No budgets exceeded. Two margins remain worth watching: per-chunk (ElevenLabs 605/650, 45 KB) and production deps (36/40, 4 slots).

## Top Optimization Opportunities (prioritized by impact)

The bundle is lean at the application level — react-markdown gone, PostHog minimal, the three vendor giants all deferred. There is no large reducible app-level JS weight remaining. The levers are dependency-hygiene, measurement, and one product decision.

### 1. Move `esbuild` + `protobufjs` security pins from `dependencies` to `overrides` (LOW EFFORT, RECOVERS BUDGET — HIGHEST ACTIONABLE IMPACT)

Carried from Jun 14, still unactioned. Both packages were promoted to direct `dependencies` solely to pin a safe version, but that charges them against the 40-slot production dep budget (now 36/40). The project already uses `overrides` for exactly this purpose (`qs`, `minimatch`, `brace-expansion`, `postcss`, `uuid` in `package.json:137-143`). Pinning these transitive deps via `overrides` instead keeps the production dep count clean and recovers two budget slots (back to 34/40).

```jsonc
// package.json — remove from "dependencies":
//   "esbuild": "^0.28.1",
//   "protobufjs": "^7.6.4",

// add to "overrides":
"overrides": {
  "qs": ">=6.15.2",
  "minimatch": ">=10.2.1",
  "brace-expansion": ">=5.0.6",
  "postcss": "^8.5.15",
  "uuid": ">=14.0.0",
  "esbuild": ">=0.28.1",      // dev/build-only transitive pin (vite/tsx)
  "protobufjs": ">=7.6.4"     // transitive PostHog/OTel pin
}
```

Security agent (Jun 16) independently asked for the same move and confirmed `npm audit --omit=dev` is the gate. Verify with `npm audit` + `npm ls esbuild protobufjs` after the change, then a fresh `build:analyze` to confirm zero bundle delta (expected — neither ships to the client). If the audit pin only holds when declared as a direct dep on this npm version, leave them in place and instead annotate them as budget-exempt "security pins" so future cycles don't read 36/40 as genuine app growth.

### 2. ElevenLabs voice-shelving — 605 KB, product lever only (HIGHEST RAW IMPACT, NON-ENGINEERING)

The single largest chunk (605 KB) is already deferred to click-to-mount, so it costs nothing at first paint — but it is also the tightest per-chunk margin (45 KB under the 650 KB budget). The only way to remove it from the bundle is the product decision to shelve voice. Cost Analyst (Jun 16) reports 119 days of zero Paisaxe voice traffic and frames shelving as a ~$45/mo tier-downgrade lever. If voice is shelved, total JS drops to ~2,420 KB, the per-chunk budget concern disappears, and the total budget should be re-lowered to ~3,100 KB. This is a user/product decision; no agent action.

### 3. Initial-load precision — run `build:analyze` to verify the split budget's initial half (LOW EFFORT, MEASUREMENT)

The split budget (initial 2,100 / total 3,500) has been in force since 2026-04-04, but the initial half cannot be verified from the current Turbopack cached artifacts — `app-build-manifest.json` with per-route first-load totals is absent. The total half is authoritative and green (476 KB headroom); the initial half is only estimable. One webpack `npm run build:analyze` run produces the authoritative per-route first-load numbers AND would double as the verification for Opportunity 1's zero-delta claim. Pair it with the dep-pin cleanup. (This recommendation is several cycles old; pairing gives it a concrete reason to run.)

### 4. PostHog — already optimal, no further structural lever (NO ACTION — for the record)

PostHog (346 KB across two chunks) is already (a) lazy-loaded via dynamic `import()` after hydration, (b) production-only, and (c) minimally configured — autocapture/pageview/pageleave all off (the Jun 12 triage disabled autocapture and pageleave). The 118 KB support chunk contains no rrweb / session-recording / surveys / web-vitals / toolbar signatures, so there is no replay weight to cut. Treat this chunk as settled.

### 5. Per-chunk headroom watch — `@elevenlabs/react` and `sharp` bumps (WATCH)

The ElevenLabs SDK (605 / 650 KB) leaves only 45 KB of per-chunk headroom — the tightest of all budgets. Security (Jun 16) notes 14 outdated packages, zero CVEs (routine), and that `npm audit fix` for the 9 detected advisories is lockfile/patch-only with ~zero bundle delta. Any `@elevenlabs/react` bump beyond patch level must get a fresh-build measurement BEFORE merge, not after — a minor feature release could plausibly consume the remaining 45 KB. `sharp` is `serverExternalPackages` (`next.config.ts:12`) so it is server-only and bundle-neutral, but measure if bumped alongside ElevenLabs.

## Recommendations Summary

1. Status GREEN, authoritative: 3,024 KB / 3,500 KB (476 KB headroom). Fully flat cycle (0 KB change), no source or dep commits since Jun 14, all chunk sizes byte-identical.
2. ACTIONABLE (carried, still open): move `esbuild` + `protobufjs` from `dependencies` to `overrides` to recover two production-dep budget slots (36/40 -> 34/40). Security agent re-raised the same ask Jun 16. Verify the audit gate still holds after the move.
3. Production dep margin is tight at 4 slots — both pins are security/audit pins, not app growth. Don't let 36/40 read as genuine bloat.
4. No large app-level reducible JS remains. The three vendor giants (ElevenLabs 605, Supabase 331, PostHog 346 = ~1,282 KB) are all deferred/click-to-mount.
5. Run `npm run build:analyze` once to (a) verify the initial-load budget half and (b) confirm the dep-pin move is bundle-neutral — two birds, and it would also fold in the pending Security `npm audit fix`.
6. Remaining raw lever is non-engineering: ElevenLabs voice-shelving (product/cost decision, 605 KB, also clears the 45 KB per-chunk margin).

## Comparison to Previous Run

| Metric | Jun 13 | Jun 14 | Jun 16 (this run) | Net change (cycle) |
|---|---:|---:|---:|:---:|
| Total JS | 3,025 KB | 3,024 KB | 3,024 KB | 0 KB |
| Total budget | 3,500 KB | 3,500 KB | 3,500 KB | unchanged |
| Total headroom | 475 KB | 476 KB | 476 KB | 0 KB |
| ElevenLabs chunk | 605 KB | 605 KB | 605 KB | unchanged (deferred) |
| Supabase chunk | 330 KB | 331 KB | 331 KB | unchanged (deferred) |
| PostHog chunks | 344 KB | 346 KB | 346 KB | unchanged (deferred) |
| Total CSS | 122 KB | 122 KB | 122 KB | unchanged |
| Production deps | 34 / 40 | 36 / 40 | 36 / 40 | 0 |
| node_modules disk | 1,018 MB | 1,017 MB | 1,017 MB | 0 MB |
| .next disk | 84 MB | 132 MB | 135 MB | +3 MB (cache, not bundle) |
| Build provenance | CACHED-authoritative | CACHED-authoritative | CACHED-authoritative | — |

Improvements: none needed — bundle stable at its best position in months for a third consecutive cycle. Regressions: none in shipped weight. The only movement is +3 MB of `.next` cache growth (not shipped). The Opportunity 1 dep-pin cleanup remains the only open engineering action, and it is bundle-neutral by design.
