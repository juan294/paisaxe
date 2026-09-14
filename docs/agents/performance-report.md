# Performance Agent Report — 2026-09-03

## Summary

Status: **YELLOW**. All three *scripted* budget checks pass, but the largest single JS chunk (the ElevenLabs SDK, 729 KB) has silently exceeded its own defined 650 KB per-chunk budget by 79 KB (12%) — a real regression that `scripts/performance-agent.sh` does not currently check for (its `VIOLATIONS` logic only tests total JS, prod deps, and node_modules size). Total JS also grew 180 KB (5.6%) since the last fresh build (Aug 27), driven almost entirely by one dependency bump.

- **Total JS**: 3,394 KB vs 4,000 KB budget = **84.8% utilized** (up from 80.4% on Aug 27 — real bundle growth, not a budget change).
- **Root cause of growth, isolated by chunk-content grep**: `@elevenlabs/react` was bumped `1.13.0 -> 1.15.0` (commit `e76ce949`, "bump the production group with 18 updates", 2026-08-2x). The ElevenLabs chunk grew `586,584 B -> 746,426 B` (**+159,842 B, +27.2%**) — this single change accounts for **89% of the entire 180 KB total-JS increase**. The remaining ~20 KB traces to `posthog-js` (`1.418.6 -> 1.422.5`) plus `@sentry/core`/`@sentry/nextjs` (`10.70.0 -> 10.72.0`), which grew the PostHog+Sentry chunk by 23,523 B (+8.2%).
- **Build provenance**: fresh build, `.next` postdates the last src/package.json commit (`7ceb429e`, "fix(deps): keep Sentry on verified version", 2026-09-01). Numbers are authoritative.
- Production dependencies: 34/40 (unchanged). node_modules: 1,027 MB / 1,100 MB budget (93.4%), actually **down 6 MB** from Aug 27's 1,033 MB despite the version bumps above — improvement, not a concern.

## Key Metrics

| Metric | Value | Budget | Status |
|---|---|---|---|
| Total JS (raw, all chunks) | 3,394 KB | 4,000 KB | Pass (84.8%) |
| Total CSS | 135 KB | — | Pass |
| **Largest single chunk (ElevenLabs, deferred)** | **746,426 B (729 KB)** | **650 KB** | **FAIL (112%, +79 KB over)** — not caught by scripted checks |
| Production dependencies | 34 | 40 | Pass (85%) |
| node_modules | 1,027 MB | 1,100 MB | Pass (93.4%) — improved vs Aug 27 |
| Sentry+Supabase chunk | 343,150 B (335 KB) | — | Flat (+743 B vs Aug 27, negligible) |
| PostHog+Sentry chunk | 310,032 B (303 KB) | — | +23,523 B (+8.2%) vs Aug 27 |
| react-dom chunk | 238,815 B (233 KB) | — | Byte-identical to Aug 27 |
| framework-runtime chunk | 175,652 B (172 KB) | — | -159 B, negligible |
| polyfill chunk | 112,594 B (110 KB) | — | Byte-identical to Aug 27 |

Chunk-to-source mapping was independently verified this cycle by grepping each of the top-6 largest chunk files for library-identifying strings (`elevenlabs`, `sentry`, `posthog`, `supabase`, `stripe`, `react-dom`), not carried forward from memory.

## Budget Status

1. **Total JS budget (4,000 KB)** — Pass, 84.8% utilized. Headroom shrank from 786 KB to 606 KB this cycle; worth watching if another SDK-sized dependency bump lands before the next report.
2. **Production deps (40)** — Pass, unchanged at 34.
3. **node_modules (1,100 MB)** — Pass, 93.4%, improved 6 MB vs last cycle.
4. **Largest single chunk (650 KB, defined in `scripts/performance-agent.sh:61`)** — **FAIL**. The ElevenLabs chunk is now 729 KB, 79 KB over. This budget exists in the script's config and header comment but is never compared against `LARGEST_CHUNKS` in the `VIOLATIONS` logic (`scripts/performance-agent.sh:182-192` only checks `TOTAL_JS_KB`, `PROD_DEPS`, `NODE_MODULES_MB`) — so this regression produced no alert.

## Top Optimization Opportunities

### P1 (High impact, real regression) — ElevenLabs chunk exceeded its budget after a 2-minor-version bump

`@elevenlabs/react` went `1.13.0 -> 1.15.0` and added 159,842 B (156 KB) to its own chunk — a 27% jump for two minor releases, and enough on its own to push the chunk 79 KB past its documented 650 KB ceiling. This chunk remains fully deferred/click-to-mount (confirmed unchanged from the May 2026 optimization — it does not appear in any route's initial HTML), so it does not affect first-load performance for the ~100% of current sessions that never touch voice. But it does mean:

- Any user who *does* click into the voice widget now downloads 729 KB instead of 605 KB for that one interaction.
- Given the Cost Analyst's Sep 3 report describes an overdue decision on whether to keep, throttle, or shelve ElevenLabs entirely (overage crisis, Sep 1 deadline passed), it is worth sequencing: if the decision is to shelve/separate the service, this bundle growth becomes moot. If ElevenLabs stays, this bump should be diffed before the next dependency batch.

Recommended actions, in order:
1. Run `npm run build:analyze` (webpack analyzer) scoped to this chunk to see what `1.14.0`/`1.15.0` added — check the package's CHANGELOG for new default-imported features (new voice models, waveform visualizers, etc. are common sources of this kind of jump).
2. If the added code isn't used by Pelayo's current configuration, check whether `@elevenlabs/react` supports a narrower entry point/subpath import instead of the full package.
3. Coordinate with the pending ElevenLabs cost decision — don't invest further bundle-optimization effort here until that decision lands.

### P2 (Process gap, low effort, high leverage) — Wire up the missing largest-chunk budget check

`BUDGET_LARGEST_CHUNK_KB=650` has existed in `scripts/performance-agent.sh:61` since at least the May 2026 ElevenLabs optimization, but the script never actually compares it against `LARGEST_CHUNKS` (`scripts/performance-agent.sh:136-137`) in the `VIOLATIONS` block. This is why a 12%-over-budget regression shipped silently this cycle. Fix:

```bash
# after LARGEST_CHUNKS is computed (scripts/performance-agent.sh:137)
LARGEST_CHUNK_BYTES=$(echo "$LARGEST_CHUNKS" | head -1 | awk '{print $1}')
LARGEST_CHUNK_KB=$((LARGEST_CHUNK_BYTES / 1024))
if [[ $LARGEST_CHUNK_KB -gt $BUDGET_LARGEST_CHUNK_KB ]]; then
  VIOLATIONS="$VIOLATIONS\n- Largest chunk (${LARGEST_CHUNK_KB} KB) exceeds budget (${BUDGET_LARGEST_CHUNK_KB} KB)"
fi
```

This closes the gap for good — the same class of "budget exists in a comment but isn't enforced" issue should not recur for this metric.

### P3 (Low priority, dependency-driven) — PostHog+Sentry chunk +8.2%

`posthog-js` (`1.418.6 -> 1.422.5`, 3 patch/minor releases) and `@sentry/core`/`@sentry/nextjs` (`10.70.0 -> 10.72.0`) together added 23,523 B to their shared chunk. `optimizePackageImports: ["lucide-react", "posthog-js"]` (`next.config.ts:19`) is still active, so this is tree-shaken growth, not a regression in configuration. No action needed — flagging only because it's the second-largest mover this cycle.

### Closed items (confirmed still holding, no regression)

- ElevenLabs SDK remains fully deferred (click-to-mount) — not in any route's initial HTML despite the size increase.
- `pdfjs-dist`, `pdf-parse`, and `canvas` remain in `devDependencies` (`package.json:134-135,145`) — cannot leak into client bundles.
- `optimizePackageImports: ["lucide-react", "posthog-js"]` confirmed active in `next.config.ts:19`.
- react-dom, framework-runtime, and polyfill chunks are unchanged (byte-identical or within noise) — confirms the growth is isolated to the two dependency-bumped chunks, not a broad regression.
- node_modules trend is flat-to-improving (1,033 MB Aug 27 -> 1,027 MB today) despite the dependency bumps landing.

## Comparison to Previous Run (2026-08-27)

| Metric | Aug 27 | Sep 3 | Change |
|---|---|---|---|
| Total JS (raw) | 3,214 KB | 3,394 KB | **+180 KB (+5.6%)** |
| Total JS budget utilization | 80.4% | 84.8% | +4.4pp |
| Largest chunk (ElevenLabs) | 586,584 B (573 KB) | 746,426 B (729 KB) | **+159,842 B (+27.2%)** — now over its 650 KB budget |
| PostHog+Sentry chunk | 286,509 B (280 KB) | 310,032 B (303 KB) | +23,523 B (+8.2%) |
| Sentry+Supabase chunk | 342,407 B (334 KB) | 343,150 B (335 KB) | +743 B (negligible) |
| react-dom chunk | 238,815 B | 238,815 B | 0 (byte-identical) |
| Total CSS | 135 KB | 135 KB | 0 |
| Production dependencies | 34 | 34 | 0 |
| node_modules | 1,033 MB | 1,027 MB | -6 MB (improved) |

Regression this cycle: the ElevenLabs chunk crossed its 650 KB per-chunk budget, driven by the `@elevenlabs/react` 1.13.0->1.15.0 bump. This was not caught by automation because the per-chunk budget check was never wired up (see P2). No other metric regressed materially.

---
