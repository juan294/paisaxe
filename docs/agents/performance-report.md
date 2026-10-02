# Performance Agent Report — 2026-10-01

## Summary

Status: **GREEN (with one watch item)**. Every scripted budget passes on a fresh build. The only metric near its limit is node_modules at 95.5%. Bundle bytes are identical to the 2026-09-24 report.

- **Total JS**: 3,463 KB vs 4,000 KB budget = 86.6% utilized. Change vs Sep 24: 0 KB. The top-10 chunk byte sizes match the Sep 24 report exactly.
- **Why nothing moved**: the only commit touching `src/` or `package.json` since the Sep 24 build is `86e61b15` (patch of `next`, `fast-uri`, `brace-expansion`). Per the Sep 24 report, the Sep 14 batch already carried `next` 16.3.4. `fast-uri` and `brace-expansion` are build/server-side. This is INFERRED from the identical chunk sizes and the commit subject; I did not diff the lockfile in this run.
- **Build provenance**: VERIFIED. The metrics state a fresh build (`.next` mtime 2026-10-01 10:00:23, after the last source-touching commit of 2026-09-30 19:09). Numbers are authoritative.
- **Per-chunk budget now passes**: the largest chunk is 750,835 B (733 KB) against `BUDGET_LARGEST_CHUNK_KB=800` (`scripts/performance-agent.sh:62`). The Sep 26 triage raised it from 650. The two-cycle FAIL in the previous report is closed by a budget change, not by a size reduction. The chunk is the same size as before.
- **First-load data is available after all**: the metrics say per-route First Load JS was not emitted by `next build`, but `.next/diagnostics/route-bundle-stats.json` (read this run) holds `firstLoadUncompressedJsBytes` for 13 routes. The initial-load budget (2,100 KB) can therefore be verified. See below.
- Production dependencies: 34/40 (unchanged). node_modules: 1,051 MB / 1,100 MB (95.5%, unchanged, 49 MB headroom).

## Key Metrics

| Metric | Value | Budget | Status |
|---|---|---|---|
| Total JS (raw, all chunks) | 3,463 KB | 4,000 KB | Pass (86.6%) |
| Largest route First Load JS (`/admin`, uncompressed) | 1,031,065 B (1,007 KB) | 2,100 KB initial | Pass (48%) |
| Largest public-route First Load JS (`/immersive`) | 789,377 B (771 KB) | 2,100 KB initial | Pass (37%) |
| Baseline First Load JS (`/`, `/coming-soon`, `/_not-found`) | 640,920 B (626 KB) | 2,100 KB initial | Pass (30%) |
| Total CSS | 135 KB | none | Unchanged |
| Largest single chunk (ElevenLabs/LiveKit, deferred) | 750,835 B (733 KB) | 800 KB | Pass (91.6%) |
| Production dependencies | 34 | 40 | Pass (85%) |
| node_modules | 1,051 MB | 1,100 MB | Pass, tightest yet (95.5%) |
| .next disk | 1,026 MB | none | Informational |

Note on the First Load figures: the JSON reports uncompressed bytes of the chunks loaded at route entry. They are comparable to the "initial" budget, which is defined on static non-deferred chunks. I did not confirm that the script's definition of "initial" matches this JSON's definition exactly, so treat the 2,100 KB comparison as approximate. It passes by a wide margin either way.

## Chunk Attribution (VERIFIED by string-count grep of chunk files this run)

| Chunk | Bytes | Dominant content (grep) | In any route's first load? |
|---|---|---|---|
| `3_gogtj7pxhna.js` | 750,835 | `livekit` (190 hits), `elevenlabs` (17) | No (not listed in any of the 13 routes) |
| `3rawgoxvjwdpn.js` | 352,621 | `supabase` (97) | `/admin` only |
| `30jo97nxm2cox.js` | 347,973 | `posthog` (72) | No (not in any route's first-load list) |
| `1fvfimpu31nt1.js` | 238,815 | `react-dom` | `/admin` (others not tested by name) |
| `3aslpx73xrgfs.js` | 175,652 | framework runtime (no library string hits; classification from size match with previous report) | `/admin` |
| `06tracsalsj1l.js` | 112,804 | mixed (posthog, stripe, supabase, elevenlabs, anthropic strings, each in single digits) | not checked |
| `0cz1d0mv5g_q7.js` | 112,594 | polyfills (classification from size match with previous report; not grepped) | not checked |

Caveat: the Sentry attribution made in the Sep 24 report for the 347,973 B chunk is not reproduced by this run's grep, which found `posthog` strings but did not count `@sentry`. I only verified PostHog content. The "Sentry+PostHog" label from Sep 24 is INFERRED.

## Budget Status

1. Total JS (4,000 KB): Pass, 537 KB headroom.
2. Initial/First Load (2,100 KB): Pass. The heaviest route, `/admin`, is about 1,007 KB.
3. Largest chunk (800 KB): Pass with 67 KB headroom. The chunk was already 733 KB under the old 650 KB budget, so the verdict changed only because the threshold moved.
4. Production deps (40): Pass.
5. node_modules (1,100 MB): Pass, 95.5%. The next large batch is likely to cross it.

## Top Optimization Opportunities

### P1: Watch item, node_modules at 95.5% (49 MB headroom)

Largest contributors from the metrics: `next` 199 MB, `@sentry` 99 MB, `@next` 86 MB, `pdfjs-dist` 60 MB, `pdf-parse` 57 MB, `lucide-react` 44 MB, `posthog-js` 27 MB, `canvas` 19 MB.

- `pdfjs-dist` (60 MB), `pdf-parse` (57 MB) and `canvas` (19 MB) total 136 MB. The 2026-05-09 report concluded `pdfjs-dist` and `pdf-parse` are in `devDependencies`, so they cost local disk and CI install time, not client or serverless bundles. I did not re-verify that this run.
- The budget measures a developer-machine directory. The Vercel deploy uses `outputFileTracingExcludes` (`next.config.ts:30-40`), not the node_modules directory. Exceeding 1,100 MB would not slow the site.
- Action: do not try to shrink the packages above. When the budget trips, raise `BUDGET_NODE_MODULES_MB` in `scripts/performance-agent.sh:63` with a note, or count only production deps. The Security agent's Oct 1 undici override change and the dompurify lockfile update are small and should not change this.

### P2: Replace the global chunk-budget raise with a named exemption

Triage raised `BUDGET_LARGEST_CHUNK_KB` 650 to 800 on Sep 26. That also relaxes the limit for any new unrelated chunk, which could now grow to 800 KB unnoticed. Suggested change in `scripts/performance-agent.sh`: keep 650 as the default and add a separate 800 KB cap only for the chunk containing `livekit`. Triage already identified this as a design candidate. This is a script tweak, not a bundle change.

```bash
# default budget for every chunk except the voice SDK chunk
BUDGET_LARGEST_CHUNK_KB=650
BUDGET_VOICE_CHUNK_KB=800
# classify by content: grep -l livekit .next/static/chunks/*.js
```

### P3: ElevenLabs/LiveKit chunk (733 KB), no first-load impact today

- The chunk is absent from every route's first-load list in `route-bundle-stats.json`, so it loads only on demand. Source importers of `@elevenlabs/react` are `src/components/immersive/voice-chat-elevenlabs.tsx` and `src/components/admin/voice-agent-chat.tsx`. Whether the immersive import sits behind `next/dynamic` and a click was not re-read this run. The May and September cost and performance reports record click-to-mount.
- Removing or shrinking this chunk has no user-visible benefit while voice traffic is shelved. Re-evaluate only if the voice feature flag `visitor_voice_agent` is enabled for visitors.

### P4: `/admin` First Load is 1,007 KB, 380 KB above the baseline route

`/admin` pulls the Supabase chunk (352,621 B) and react-dom/framework chunks into first load. It is admin-only, so impact on visitors is nil. If admin responsiveness ever matters, check why the Supabase client chunk is in the entry set. The Feb 2026 work on lazy-mounting admin tabs is the existing pattern to extend. I did not trace the import path.

### P5: `/immersive` is the heaviest visitor route at 771 KB first load

It is 145 KB above the 626 KB baseline shared by every route. This is the primary public experience. Identify the route-specific chunks with `npm run build:analyze` (webpack analyzer, `package.json` script `build:analyze`). I did not run it this cycle, so no per-library attribution of those 145 KB is claimed.

## Comparison to Previous Run (2026-09-24)

| Item | Sep 24 | Oct 1 | Change |
|---|---|---|---|
| Total JS | 3,463 KB | 3,463 KB | 0 |
| ElevenLabs chunk | 750,835 B | 750,835 B | 0 |
| Supabase chunk | 352,621 B | 352,621 B | 0 |
| PostHog (and Sentry?) chunk | 347,973 B | 347,973 B | 0 |
| Prod deps | 34 | 34 | 0 |
| node_modules | 1,051 MB | 1,051 MB | 0 |
| Chunk budget verdict | FAIL (650 KB) | Pass (800 KB) | Budget changed Sep 26, size did not |

No regressions and no improvements in bytes.

## Cross-Agent Notes

- Security (Oct 1): the proposed undici override bump (dev-only via jsdom/vitest) and the dompurify lockfile update should not alter client chunks. dompurify is a PostHog transitive, so if it is updated, re-check the 347,973 B chunk size afterward.
- QA (Oct 1): the transient `degraded` health reading at 06:00Z was not investigated by this agent. I did not have Vercel runtime logs in this run; the Vercel MCP tools exist in this environment but were not used.
- Metrics script gap: `scripts/performance-agent.sh` reports "FIRST LOAD JS not present". It could read `.next/diagnostics/route-bundle-stats.json` instead (fields `route`, `firstLoadUncompressedJsBytes`). That would make the 2,100 KB initial budget checkable every cycle.
