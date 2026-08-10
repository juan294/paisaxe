# Performance Agent Report — 2026-07-17

## Summary

Status: **GREEN (bundle)**. All budgets pass with comfortable headroom, and the build is effectively byte-identical to Jul 16 — the four largest chunks match to the byte.

Status: **RED (harness)**. The `performance-agent.sh` fixes specified in full on Jul 15 — BUILD_ID authority check, zero-reading suppression, missing `timeout` binary — are still not applied. This is the **3rd consecutive cycle** the agent's own build step is known-broken, and this cycle is the one where it finally produced a materially false headline instead of an accidentally-correct one.

The metrics block handed to this agent read:

```
- Total JS: 0 KB (previous: 3091 KB, change: -3091 KB)
- Build status: CACHED — .next postdates last source/dep commit.
  Bundle numbers are authoritative for current source tree.
```

Both claims are false, and the failure mode is worse than a wrong number: **a fabricated -3091 KB would read as the largest optimization win in the project's history.** A fail-open that invents an improvement is more dangerous than one that invents a pass, because nobody investigates good news.

There was no production build in `.next` at all — not stale, not cached. Only dev-server artifacts:

| Evidence | Finding |
|---|---|
| `.next/BUILD_ID` | Absent — a production build always writes this |
| `.next/static/chunks/` | Did not exist |
| `.next/server/` | Empty directory |
| `.next/dev/` | 903 MB — dev server output |
| `.next/cache/` | 673 MB — dev/Turbopack cache |

**Root cause** (this is what the Jul 15/16 reports described but did not pin down): the provenance check compares `.next` **directory mtime** against the last source commit. The dev server touches `.next` on every run, so a dev-only tree always looks newer than the last commit and always passes as "CACHED — authoritative". The check cannot distinguish "fresh production build" from "no production build, dev server ran recently."

Jul 16's report noted its own "CACHED — authoritative" label *"happens to be correct today, but only because QA's safety net returned."* That dependency is now proven: QA's Jul 17 journey suite never ran (`webServer` 240s timeout), so no Playwright build materialized, so the harness had nothing real to read — and asserted authority anyway. QA called this precisely this morning: *"Your bundle data source did NOT run this cycle — treat any cached reading today as unauthoritative."* QA was right; the harness contradicted QA and was wrong.

**This agent ran `npm run build` directly** (exit 0, compiled 6.8s, 137 static pages, BUILD_ID `jMWgkaH-n2Ehlv99_M--9`). Every number below is from that build, measured by exact byte-sum.

## Key Metrics

| Metric | Value | Budget | Status |
|---|---|---|---|
| Initial JS — `/` (homepage) | 709 KB | 2100 KB | Pass (34% of budget) |
| Initial JS — `/immersive` | 889 KB | 2100 KB | Pass (42%) |
| Initial JS — `/admin` | 1110 KB | 2100 KB | Pass (53%) |
| Total JS | 3,144,232 B = **3071 KB** | 3500 KB | Pass (88%) |
| Total CSS | 137,790 B = 135 KB | — | Pass |
| Production dependencies | 34 | 40 | Pass |
| `node_modules` | 1036 MB | — | Informational |
| `.next` | 1578 MB | — | 96% dev cache, see Notes |

## Budget Status

No budget is exceeded. Initial load has the most headroom — the homepage uses roughly a third of its allowance.

## Measurement Correction (worth recording)

This agent's first pass measured total JS at **3232 KB** using `du -k`, and nearly reported a +141 KB regression. That number was wrong. `du` reports **disk block allocation**, rounding all 75 files up to 4 KB boundaries; the exact byte-sum is 3071 KB. The ~161 KB gap is pure block-rounding artifact.

The error was caught by cross-checking against Jul 16's byte-level chunk table, which is why that report's rigor mattered. The lesson generalizes to the harness fix below: **`du`-based totals are not comparable across builds with different file counts.** Any future harness must byte-sum (`stat -f '%z'` on macOS), not `du`.

Related trap hit during this analysis: `find -printf` is GNU-only and fails on macOS's BSD `find`, but exits *successfully* with empty output — so `find ... -printf | awk` silently yields `0 B`. That is the same fail-open shape as the bug being investigated, in the investigating tooling. Any replacement script must use `-exec stat -f '%z' {} +`.

## Top Optimization Opportunities

**There are no material first-paint wins left.** This is a verified finding, not a shrug — the three largest chunks are all already deferred correctly, checked against the prerendered HTML rather than assumed:

| Chunk | Exact size | Contents | In any route's initial HTML? |
|---|---|---|---|
| `1psbcxe01ifvv.js` | 605,634 B | ElevenLabs | **No** — fully deferred |
| `03ngi84ocd4i3.js` | 316,908 B | Supabase | Only `/admin` |
| `0w4uw_-sku3je.js` | 260,405 B | PostHog + Sentry | **No** — deferred |
| `0hgypyft3yzsy.js` | 237,129 B | react-dom | Yes — expected, unavoidable |

All four are **byte-identical to Jul 16's build**, confirming zero drift. The ElevenLabs click-to-mount deferral (landed 2026-05-10) is still holding: the 592 KB chunk appears in zero route HTML files. Supabase's 312 KB is what makes `/admin` the heaviest route — admin-only, authenticated, still half its budget. Not worth acting on.

### Closing a long-carried false lead: the 110 KB polyfill chunk

Prior cycles tracked a "Browserslist P1 optimization still pending" item. **It should be closed — there was never anything to fix.** Two independent reasons:

1. `package.json` already targets modern browsers (`last 2 Chrome/Firefox/Safari/Edge versions`).
2. Decisively, Next serves the polyfill `nomodule`-gated. From the prerendered HTML:

```html
<script src="/_next/static/chunks/0cz1d0mv5g_q7.js" noModule=""></script>
```

Every browser supporting ES modules — i.e. every browser in the target list — **never downloads or executes it.** Its cost to modern users is exactly zero, and it is not browserslist-tunable regardless. This is why it is excluded from the initial-JS figures above.

### The one real action: fix the harness (P1, 3rd cycle)

The bundle is healthy and static. The measurement path is what is broken.

```bash
# A production build is proven by its artifacts, not by a directory timestamp.
# The dev server touches .next constantly, so mtime ALWAYS looks fresh —
# this is why a dev-only tree passed as "CACHED — authoritative".
if [ ! -f .next/BUILD_ID ] || [ ! -d .next/static/chunks ]; then
  echo "No production build present — building."
  npm run build || { echo "BUILD FAILED — metrics unavailable"; exit 1; }
fi

# Byte-sum, not du: du rounds each file up to a 4 KB block (~+160 KB over 75 files).
# BSD stat on macOS; find -printf is GNU-only and fails open with empty output.
TOTAL_JS=$(find .next/static -name '*.js' -type f -exec stat -f '%z' {} + \
           | awk '{s+=$1} END {printf "%d", s/1024}')

# A 0 KB bundle is physically impossible for a Next app — treat as harness error,
# never as a measurement, and never write it to history.
if [ "${TOTAL_JS:-0}" -eq 0 ]; then
  echo "ERROR: measured 0 KB — refusing to write history entry"
  exit 1
fi
```

The zero-guard matters independently of the provenance fix, and is what would have prevented both the poisoned history rows and this cycle's phantom -3091 KB.

## Comparison to Previous Run

| Date | Total JS | Note |
|---|---|---|
| 2026-07-14 | 3057 KB | |
| 2026-07-15 | ~~0 KB~~ | Poisoned — no build existed |
| 2026-07-16 | 3091 KB | |
| 2026-07-17 | **3071 KB** | This build (authoritative) |

**-20 KB vs Jul 16 — no regression, no improvement, nothing to act on.** This sits exactly inside the ±20 KB build-to-build variance band the Jul 16 report characterized, and today's data independently confirms that band from the other direction: the top-4 chunks are byte-identical across the two builds, so the entire delta lives in small async/route chunks. With zero source commits between the builds (last `src/`/`package.json` commit remains `5956d953`, Jul 15), variance is the only available explanation.

Practical consequence, unchanged from Jul 16: **"Total JS" carries roughly ±20 KB of build-context noise.** Relevant only when headroom approaches a threshold; at 88% of budget it is not.

### History file correction (disclosed)

`.performance-history.json` (local, gitignored, agent-owned) contained **two** `total_js_kb: 0` rows. Both are provably false — no build produced them. Left in place, every future cycle computes its delta against a fabricated zero, exactly as this cycle's `-3091 KB` did.

Action taken: dropped the 2 invalid rows, recorded the real Jul 17 entry (3071 KB / 135 KB). The invalid rows were **removed, not back-filled with invented numbers** — the true Jul 15 value is unknowable because no build ran. Backup at `/tmp/perf-history.bak`.

## Notes

- **`.next` at 1578 MB is not a build-size signal.** It is 903 MB `dev/` + 673 MB `cache/`; actual production `static/` output is ~3.3 MB. Worth `rm -rf .next` before any measurement run.
- **Heavy `node_modules` packages are not shipped** — verified, not assumed: `pdfjs-dist` (61 MB), `pdf-parse` (57 MB), `typescript` (24 MB) are `devDependencies`; `canvas` (19 MB) is transitive via `jsdom` (dev-only); `core-js` (15 MB) is transitive via `posthog-js`, which lives entirely in the deferred 256 KB chunk. None can reach a client bundle. The `node_modules` table in the metrics block is a disk stat, not a bundle stat, and should not be read as an optimization backlog.
- Jul 15 dep batch (posthog-js, supabase-js, stripe) confirmed bundle-neutral on first paint, as Security pre-cleared.
- Production dependency count stable at 34/40.
