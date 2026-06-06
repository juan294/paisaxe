# Performance Agent Report — 2026-06-06

## Summary

Status: GREEN (advisory). The two authoritative dimensions this cycle — production dependency count and disk usage — are both healthy: 35 / 40 production deps (5 headroom) and node_modules flat at 1,043 MB. Per the metrics script's provenance gate, the bundle-size budget verdict is suppressed this cycle (no fresh production build was made), so no RED/YELLOW/GREEN is emitted for total JS. The overall status is based on deps + disk only, exactly as the script instructs.

This is the second consecutive cycle (Jun 5 / Jun 6) where the suppression logic — added by the Jun 4 triage fix `e586fdad` — works as designed. The honest position is unchanged: the 3,398 KB number is informational, not a pass/fail signal, until a fresh build is run.

### New this cycle — the cached build is now DOUBLY stale (it predates the Jun 4 production dep batch)

The prior report (Jun 5) asserted "No commit has landed on develop since `5f0c6a03` (May 29), so the bundle could not have changed." That claim was wrong. Five commits landed on Jun 4 that the Jun 5 report missed:

```
01079491 2026-06-04 11:17  chore: pin dev server to port 3006
e33f2f71 2026-06-04 10:17  chore(deps-dev): bump the dev-and-types group (#593)
421e3994 2026-06-04 10:17  chore(deps): bump the production group with 11 updates (#592)
c2a4671d 2026-06-04 10:15  chore: triage Jun 4
e586fdad 2026-06-04 10:12  fix(agents): suppress bundle verdict when provenance unverified
```

The `.next/` artifacts are dated **Jun 3 10:03:41** — they predate `421e3994` (#592), which bumped **11 production dependencies** on Jun 4. So the cached bundle was built against the *previous* versions of those 11 production deps. It no longer matches the current dependency tree. This strengthens, not weakens, the case for a fresh build: the 3,398 KB figure is now stale by a full production dep batch, and any attribution work against it is unreliable.

### Provenance — what the 3,398 KB number actually is

The `.next/` directory holds the Jun 3 10:03 production build (verified, unchanged):

- `.next` mtime: Jun 3 10:03:41 — not rewritten since.
- 64 JS chunks present (a dev cache only holds visited routes; it would show far fewer). This is a real-build signature.
- Top chunks byte-identical to the recorded build: `003bi2x1z1ykz.js` = 604,989 B, `0t~d~esdbfsi5.js` = 330,132 B.

So 3,398 KB is a real production figure — but from Jun 3, before the Jun 4 dep batch. Reported below as informational only. No budget pass/fail is asserted.

### The "dev server was running" note is still a sibling-project false positive

The metrics script again reported `Production build was skipped (dev server was running)`. Paisaxe's dev server was NOT running. Verified at read time:

- Port 3006 (paisaxe's pinned dev port, per `01079491`) is free — no listener.
- No `next-server` / `next dev` processes are running at all this cycle.

A clean `npm run build:analyze` is available right now with nothing to stop. The script's dev-server detection matches any machine-wide `next-server` process rather than paisaxe's own port/path, which is why it false-triggers. This is now the 13th-plus consecutive cycle the fresh build has been deferred on a false premise.

## Key Metrics

| Signal | Value | Authoritative? | Status |
|---|---:|:---:|:---:|
| Production deps | 35 / 40 | Yes | GREEN (5 headroom) |
| Dev deps | 30 | Yes | Informational |
| node_modules disk | 1,043 MB | Yes | GREEN (flat) |
| .next disk | 60 MB | Yes | GREEN |
| Total JS (Jun 3 artifacts, pre-dep-batch) | 3,398 KB | No — verdict suppressed | Informational only |
| Total CSS | 122 KB | No (same build) | Informational |
| JS chunk files | 64 | — | (real-build signature) |

### Bundle (informational — Jun 3 production artifacts; NOT a fresh build, and now pre-dep-batch)

```
Total JS (Jun 3 prod build, re-read 2026-06-06):  3,398 KB
Budget (split, since 2026-04-04):                 2,100 KB initial / 3,100 KB total
Total CSS:                                        122 KB
JS chunk files:                                   64
Verdict:                                          SUPPRESSED — provenance unverified + pre-dep-batch
```

No budget pass/fail is emitted. For reference only: were this a fresh build, 3,398 KB would sit 298 KB over the 3,100 KB total budget — but that comparison is not authoritative, and is now further undermined because the artifacts predate the Jun 4 production dep batch (#592).

### Largest chunks (Jun 3 production artifacts; contents from prior signature grep)

| Size | Chunk | Contents (evidence) | Loading |
|---:|---|---|---|
| 605 KB | `003bi2x1z1ykz.js` | ElevenLabs SDK (matched `elevenlabs`) | Deferred (click-to-mount, `bd833288`) |
| 330 KB | `0t~d~esdbfsi5.js` | Supabase JS client (matched `GoTrueClient`) | First paint (auth session) |
| 237 KB | `0422xq0sb~4g3.js` | React + Next framework vendor | First paint (required) |
| 221 KB | `0lyyno-gee1wu.js` | PostHog (matched `posthog`) | Deferred analytics |
| 212 KB | `0e_r8dj.mq~mp.js` | react-markdown / micromark / mdast | Deferred (chat rendering) |
| 149 KB | `0a-pavpl4ggb0.js` | Unidentified app/shared chunk | First paint (likely) |
| 132 KB | `09k9sarjqmw54.js` | react-markdown family (remark/rehype) | Deferred |
| 118 KB | `0u4~hej3h-90o.js` | PostHog support | Deferred |
| 113 KB | `03~yq9q893hmn.js` | Stable shared chunk | First paint |
| 88 KB | `149pw4wm-wp~8.js` | react-markdown family | Deferred |

(The `@next/bundle-analyzer` treemap remains a no-op under Next 16's Turbopack/rolldown bundler. Chunk contents identified by grepping minified bytes for library signatures, as established in prior cycles. These signatures are from the Jun 3 build and may shift after the Jun 4 dep batch is built fresh.)

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

Production dependency count is 35 / 40 (5 headroom), unchanged. `optimizePackageImports` confirmed active for `lucide-react` and `posthog-js` at `next.config.ts:19`; `cacheComponents` (PPR) at `next.config.ts:16`.

## Budget Status

| Budget | Limit | Current | Status |
|---|---:|---:|:---:|
| Total JS | 3,100 KB | 3,398 KB (Jun 3 artifacts, pre-dep-batch, unverified) | SUPPRESSED — no fresh build |
| Initial JS | 2,100 KB | ~2,022 KB (estimated, deferred subtracted) | Informational (estimate) |
| Production deps | 40 | 35 | PASS |
| node_modules disk | (soft) | 1,043 MB | PASS (flat) |
| Total CSS | (no hard budget) | 122 KB | Healthy |

The total-JS verdict is intentionally suppressed: per the script's provenance gate, a pass/fail on bundle size requires a confirmed fresh production build, which did not happen. The authoritative budgets (deps, disk) both pass.

## Top Optimization Opportunities (prioritized by impact)

### 1. Run a fresh `npm run build:analyze` — unblocked, and now overdue for a concrete reason (HIGHEST PRIORITY, PROCESS)

This is the single action that converts every bundle number from "informational" to "authoritative" and restores a real verdict. The premise that has blocked it for 13-plus cycles — a running dev server — is false again this cycle: port 3006 is free and no `next-server` process is running. New this cycle: the cached build predates the Jun 4 production dep batch (#592, 11 updates), so the stale figure is no longer even a clean snapshot of current `develop`. A fresh build is needed to know whether the Jun 4 batch moved the bundle.

Secondary script fix: scope `performance-agent.sh`'s dev-server check to paisaxe's own port (3006) / project path rather than any machine-wide `next-server` process, so sibling Next.js projects stop false-triggering verdict suppression.

### 2. ElevenLabs SDK — 605 KB, serving 109 days of zero Paisaxe voice traffic (HIGHEST IMPACT, IF A BREACH IS CONFIRMED)

The single ElevenLabs chunk is 605 KB — 20% of the bundle by itself. It is already click-to-mount-deferred (`bd833288`), so it does not touch first paint, but it counts toward the total budget. If a fresh build confirms the total is over 3,100 KB, removing this chunk alone (3,398 to ~2,793 KB) brings the project back under budget in one move.

Cost Analyst (2026-06-06) reports Paisaxe voice silence at 109 days (since Feb 17), with the only ElevenLabs activity coming from a personal Coach agent — zero Paisaxe agent traffic. Cost Analyst flags this as a dual lever: shelving voice removes the 605 KB chunk AND advances the standing June tier-downgrade decision (~$45/mo), pointing the same direction.

This is a product/business decision, not a mechanical fix. Removal means deleting `@elevenlabs/react` (`package.json:65`) and the voice-chat mount call. Decide jointly with the cost downgrade evaluation, not unilaterally.

### 3. react-markdown family — ~432 KB across three deferred chunks (MEDIUM)

react-markdown + remark/rehype/micromark/mdast totals ~432 KB across `0e_r8dj` (212 KB), `09k9` (132 KB), and `149pw4` (88 KB), all deferred to chat rendering. Options: (a) confirm a single lighter markdown renderer covers the chat's actual markdown surface (likely a small subset — bold/italic/links/lists), or (b) restrict the remark/rehype plugin set. A minimal markdown-to-JSX renderer could reclaim 150–250 KB. Investigate the chat's actual markdown feature usage before swapping. Lower priority until a fresh build confirms whether the total is genuinely over budget.

### 4. Attribute bundle growth across the Jun 4 production dep batch (#592) (MEDIUM)

The Jun 4 production group bump (`421e3994`, 11 updates) has not been measured against the bundle — the cached build predates it. When a fresh build runs, compare total JS against the Jun 3 3,398 KB baseline to isolate the batch's effect. Prime suspects for first-paint weight: `@sentry/nextjs` (ships a browser bundle at first paint) and `posthog-js`. Attribution requires before/after real builds per dependency — the treemap is unavailable under Turbopack.

### 5. Pending dep hygiene (LOW — no CVEs)

Security Agent (2026-06-06) lists 27 outdated packages, zero CVEs: next 16.2.7, sentry 10.56, supabase-js 2.107, posthog-js 1.380.1 among them. Hygiene-only — let grouped Dependabot carry them. Verify `next 16.2.7` on a preview before any main release. `voyageai` stays pinned at 0.1.0 (0.2.x broken ESM); `pdfjs-dist` is devDependency-only. This batch is not expected to move the bundle materially.

## Recommendations Summary

1. Run `npm run build:analyze` — unblocked (port 3006 free, no dev server running) and now overdue because the cached build predates the Jun 4 dep batch. Converts all bundle figures to authoritative and restores the budget verdict.
2. Fix `performance-agent.sh` dev-server detection to scope to paisaxe (port 3006 / project path) so sibling Next.js projects stop false-triggering verdict suppression.
3. ElevenLabs 605 KB remains the one lever that resolves a confirmed breach — pursue voice-shelving jointly with Cost Analyst's June tier-downgrade evaluation. Only act once a fresh build confirms the total is over budget.
4. react-markdown (~432 KB) — evaluate a lighter renderer / trimmed plugin set for 150–250 KB of reclaimable deferred weight, after a fresh build confirms the budget picture.
5. Attribute any bundle change to the Jun 4 production dep batch (#592) via the next fresh build; check @sentry and posthog-js first.

## Comparison to Previous Run (2026-06-05)

| Metric | Jun 5 (GREEN advisory) | Jun 6 (GREEN advisory) | Change |
|---|---:|---:|:---:|
| Total JS | 3,398 KB | 3,398 KB (same Jun 3 artifacts) | unchanged |
| Total CSS | 122 KB | 122 KB | unchanged |
| Production deps | 35 / 40 | 35 / 40 | unchanged |
| node_modules disk | 1,043 MB | 1,043 MB | unchanged (flat) |
| .next disk | 60 MB | 60 MB | unchanged |
| Bundle verdict | SUPPRESSED | SUPPRESSED | unchanged |
| Overall status | GREEN (deps + disk) | GREEN (deps + disk) | unchanged |
| Build provenance | claimed "no commits since May 29" | corrected: 5 commits landed Jun 4; build predates dep batch #592 | corrected |
| Dev-server trigger | sibling-project false positive | confirmed false positive (no next-server running at all) | confirmed |

Improvements: Corrected a factual error in the prior report — five commits (including the #592 production dep batch) landed Jun 4 and were missed. The cached build is now known to predate the current dependency tree, sharpening the case for a fresh build. Suppression logic continues to work as designed.

Regressions: None in measured metrics (deps and disk flat). The only open item that matters is process: run one fresh `build:analyze` to restore an authoritative verdict and measure the Jun 4 dep batch. It is not blocked.
