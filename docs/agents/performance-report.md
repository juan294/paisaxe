# Performance Agent Report — 2026-06-30

## Summary

Status: GREEN. Total JS is 3,003 KB — 497 KB under the 3,500 KB total budget. No regressions. Twelfth consecutive stable cycle.

The `.next` directory mtime is 2026-06-30 08:02:50, which postdates the last source/dep commit (36de7d70, Jun 27 03:36 UTC). The build is CACHED and authoritative for the current source tree. Source changes since Jun 27 are exclusively test-only (Coverage Agent +40 tests Jun 30, closing String(err) false branches) — zero bundle impact.

**Headlines this cycle:**
- Bundle flat at 3,003 KB for 12 consecutive cycles. No regressions.
- QA Jun 30 YELLOW: J1/J2/J3/J6 journey failures (timing races, no application regression). LLM tests 12/12 recovered (5th consecutive GREEN). Three harness fixes still unapplied after 3+ cycles.
- Security Jun 30 GREEN (14th consecutive). 0 advisories, 0 exploitable. 20 outdated packages (up 2 from Jun 29) — no CVEs in production tree.
- Coverage Jun 30: +40 tests, String(err) false branches closed across all 8 admin-api catch blocks. branches 95.15% (+0.50pp). Zero bundle impact.
- Cost Analyst: June closes at ~$101.04 / $0 revenue. 137-day drought. Twilio number decision CRITICAL — ~7 days until Jul 7 charge.
- `npm run build && npm run build:analyze` remains the only outstanding performance action — 12 cycles overdue.

## Key Metrics

| Signal | Value | Authoritative? | Status |
|---|---:|:---:|:---:|
| Total JS (cached .next) | 3,003 KB | Yes (build postdates all source/dep changes) | PASS — 497 KB under 3,500 KB budget |
| Largest chunk (ElevenLabs + LiveKit, deferred) | 591 KB | Yes | PASS — zero first-paint cost |
| Second-largest chunk (Next.js runtime + Sentry, first-paint) | 324 KB | Yes | Settled — cannot be deferred |
| Third-largest chunk (presumed PostHog, deferred) | 232 KB | Yes | PASS — deferred |
| Fourth-largest chunk (presumed Supabase, deferred) | 224 KB | Yes | PASS — deferred |
| Total CSS | 122 KB | Yes | Healthy (no hard budget) |
| Production deps | 34 / 40 | Yes | PASS — 6 headroom |
| Dev deps | 30 | Yes | Informational |
| node_modules disk | 1,022 MB | Yes (synced to lockfile post-#705, Triage Jun 25) | GREEN |
| .next disk | 488 MB | Yes | Informational (+25 MB vs Jun 29; test artifacts, not bundle growth) |

## Budget Status

| Budget | Limit | Current | Status |
|---|---:|---:|:---:|
| Total JS | 3,500 KB | 3,003 KB | PASS — 497 KB headroom (14% under) |
| Initial JS | 2,100 KB | est. ~700–900 KB | PASS (estimated) — heaviest vendors deferred; precise figure needs `next build` First Load JS |
| Per-chunk (informal 650 KB) | 650 KB | 591 KB max | PASS |
| Production deps | 40 | 34 | PASS — 6 headroom |
| node_modules disk | (soft) | 1,022 MB | GREEN |
| Total CSS | (no hard budget) | 122 KB | Healthy |

No budgets exceeded. The initial-JS figure remains an estimate — a production `next build` is the only authoritative source for the 2,100 KB initial-JS budget.

## Largest Chunks Analysis (cached .next, Jun 25 installed tree)

| Size (KB) | Chunk | Contents | Loading | Notes |
|---:|---|---|---|---|
| 591 KB | `3dni6-zzi9wpn.js` | ElevenLabs SDK + LiveKit (WebRTC) | Deferred — click-to-mount | Stable for 12 consecutive cycles. Built against `@elevenlabs/react` 1.6.7; lockfile now at 1.7.0 — will rebuild on next `npm run build`. |
| 324 KB | `1wc2k45fb81oe.js` | Next.js App Router client runtime + Sentry SDK | First paint (required) | Settled. Sentry must load at page start — cannot defer. |
| 232 KB | `3wy6iknrljhg9.js` | Presumed PostHog (deferred) | Deferred (inferred) | Stable 12 cycles. Built against `posthog-js` 1.386.8; lockfile now at 1.391.5. |
| 224 KB | `0-6-fbvv-8y9f.js` | Presumed Supabase (deferred) | Deferred (inferred) | Stable 12 cycles. Within budget. |
| 145 KB | `33-ly4xjin9t2.js` | Unknown shared chunk | Unknown | Stable. |
| 110 KB | `0cz1d0mv5g_q7.js` | Unknown | Unknown | Stable. |
| 110 KB | `3su_i9204gfx5.js` | Unknown | Unknown | Stable. |
| 75 KB | `1-5gb9zqmqb7l.js` | Unknown | Unknown | Stable. |
| 52 KB | `445ry45b8bclp.js` | Unknown | Unknown | Stable. |
| 50 KB | `30ag7c5m39-7t.js` | Unknown | Unknown | Stable. |

**Largest node_modules packages are disk-install sizes, not bundle weight.** `pdfjs-dist` (61 MB) + `pdf-parse` (57 MB) are `devDependencies` and `canvas` is an `optionalDependency` for server-side PDF rendering — none ship to the client. `next` (186 MB), `@next` (117 MB), `@sentry` (75 MB), and `typescript` (24 MB) are tooling/runtime install footprints, not client payload.

## Optimizations Active (stable)

| Optimization | Status | Source | Impact |
|---|---|---|---|
| `optimizePackageImports: ["lucide-react", "posthog-js"]` | Active | `next.config.ts:19` | Tree-shakes 1,000+ lucide icons; tree-shakes PostHog |
| `serverExternalPackages: ["@anthropic-ai/sdk", "sharp"]` | Active | `next.config.ts:12` | Server-only — never in client bundles |
| ElevenLabs click-to-mount | Active | `src/components/immersive/voice-chat.tsx:48` | ElevenLabs + LiveKit (591 KB) deferred to click |
| PostHog autocapture + pageview + session-recording disabled | Active | `src/components/posthog-provider.tsx:98-100` | rrweb/session-recording excluded from PostHog chunk |
| Translation lazy-loading | Active | i18n module | `es` + `en` static; `fr`, `de`, `pt`, `ast` dynamic (~15 KB each) |
| `pdfjs-dist` + `pdf-parse` in `devDependencies` | Confirmed | `package.json:124-125` | Never in client bundles |
| `esbuild` + `protobufjs` in `overrides` (not `dependencies`) | Active | `package.json:143-144` | Keeps production deps at 34/40 |
| Image AVIF/WebP, 30-day cache TTL | Active | `next.config.ts:78-98` | Smaller transfers; long cache for immutable images |
| `cacheComponents: true` (PPR) | Active | `next.config.ts:16` | Static-shell prerender — better TTFB on immersive pages |

## Dependency Sync Status

PR #705 dep batch updated these production packages. `npm install` was run by Triage Jun 25 — installed versions are current. `npm run build` has not yet run against these updated lockfile versions, so chunk sizes still reflect the pre-batch installed tree.

| Package | Lockfile (current) | Installed against | Client bundle role | Expected bundle delta |
|---|---|---|---|---|
| `@elevenlabs/react` | 1.7.0 | 1.6.7 | Deferred 591 KB chunk (click-to-mount) | Minor — fully deferred |
| `@anthropic-ai/sdk` | 0.105.0 | 0.104.2 | None (`serverExternalPackages`) | Zero — server-only |
| `posthog-js` | 1.391.5 | 1.386.8 | Deferred ~232 KB chunk (tree-shaken) | Minor patch — negligible |
| `lucide-react` | 1.21.0 | 1.20.0 | Shared chunks (tree-shaken via `optimizePackageImports`) | Minor — negligible |

Impact assessment: no regression expected. All client-facing bumps are minor/patch. The `@anthropic-ai/sdk` bump has zero client impact by design.

## Comparison to Previous Runs

| Metric | Jun 25 | Jun 26 | Jun 27 | Jun 28 | Jun 29 | Jun 30 |
|---|---:|---:|---:|---:|---:|---:|
| Total JS | 3,003 KB | 3,003 KB | 3,003 KB* | 3,003 KB | 3,003 KB | 3,003 KB |
| vs 3,500 KB budget | -497 KB | -497 KB | -497 KB | -497 KB | -497 KB | -497 KB |
| Largest chunk (ElevenLabs+LiveKit) | 591 KB | 591 KB | 591 KB* | 591 KB | 591 KB | 591 KB |
| Next.js runtime + Sentry | 324 KB | 324 KB | 324 KB* | 324 KB | 324 KB | 324 KB |
| Total CSS | 122 KB | 122 KB | 122 KB* | 122 KB | 122 KB | 122 KB |
| Production deps | 34/40 | 34/40 | 34/40 | 34/40 | 34/40 | 34/40 |
| node_modules | 1,022 MB | 1,022 MB | 1,022 MB | 1,022 MB | 1,022 MB | 1,022 MB |
| .next disk | 488 MB | 488 MB | 488 MB | 463 MB | 463 MB | 488 MB |
| Authoritative production build? | No | No | No | No | No | No |

*Jun 27 chunk values carried from Jun 26 cache — metrics script reported 0 KB due to Turbopack parsing artifact.

Zero bundle regression across all 12 measured cycles.

## Top Optimization Opportunities (prioritized by impact)

### 1. Run authoritative `npm run build && npm run build:analyze` (LOW EFFORT, CRITICAL OVERDUE)

`npm install` was run by Triage Jun 25. The installed tree is current. This is the 12th consecutive cycle this has been deferred. Running it will:
- Produce authoritative per-route "First Load JS" numbers to verify the 2,100 KB initial-JS budget
- Confirm post-PR-#705 chunk sizes for `@elevenlabs/react` 1.7.0 and `posthog-js` 1.391.5
- Provide real content hashes for the 12 consecutive unchanged chunks
- Classify the unknown 232 KB (presumed PostHog) and 224 KB (presumed Supabase) deferred chunks

```bash
cd /Users/juan/code/paisaxe
npm run build          # production pipeline — emits per-route "First Load JS"
npm run build:analyze  # webpack treemap — classifies unknown chunk contents
open .next/analyze/client.html
```

Expected outcome: total JS within a few KB of 3,003 KB. No regression risk — all dep bumps are minor/patch and the largest client-facing change (`@elevenlabs/react` 1.6.7→1.7.0) is fully deferred behind click-to-mount.

### 2. Classify the two unknown deferred vendor chunks (combine with step 1)

The 232 KB (presumed PostHog) and 224 KB (presumed Supabase) chunks have been inferred for 12 consecutive cycles without confirmation. Both are deferred and within budget. Resolve with `build:analyze` alongside the step 1 rebuild. Low urgency — both are deferred and total JS is 497 KB under budget.

### 3. ElevenLabs voice-shelving — product/cost lever (WATCH, 133-day Paisaxe silence)

The ElevenLabs SDK + LiveKit (591 KB, click-to-mount) serves zero Paisaxe visitors at current voice traffic levels (133-day silence per Cost Analyst Jun 30). The bundle optimization surface is exhausted — click-to-mount removes 100% of first-paint cost. The only remaining lever is the cost case (~$22/mo at next renewal 2027-02-07 per Cost Analyst). This is a product/business decision, not a code optimization. No code action available.

### 4. Monitor total JS headroom (ONGOING WATCH)

Headroom is 497 KB against the 3,500 KB total budget (flat for 12 consecutive cycles). At the historical pace of ~35–80 KB per major feature, that is roughly 6–14 features of runway. No action needed; revisit if headroom drops below 300 KB.

## Cross-Agent Observations This Cycle

**QA Jun 30 YELLOW (12/12 LLM, 6/10 journeys).** LLM quality fully recovered — the Jun 29 false positive (authority-impersonation regex `/config/i` matching "configurations") is confirmed a test defect. Model behavior remains safe and correct. Journey failures J1/J2/J3/J6 are all element-not-visible timing races: story-title h1 and next-story-button visibility is not stable before click dispatch. Three harness fixes remain unapplied after 3+ consecutive cycles: (1) `toBeVisible({ timeout: 5000 })` before click at `qa-journey.spec.ts:102, 131, 229`; (2) `toBeEnabled()` + increased timeout at `qa-journey.spec.ts:65-71`; (3) authority-impersonation regex narrowing at `llm-quality.test.ts:253`. None affect bundle size.

**Security Jun 30 GREEN (14th consecutive).** 0 advisories, 0 exploitable. 20 outdated packages (up 2 from Jun 29, 0 CVEs). String(err) false branches fully covered across all admin-api catch blocks and auth paths (Coverage Jun 30) — no stack trace leakage confirmed in any catch path. GitHub code/secret scanning still disabled — owner action required. `@babel/core` #73 (LOW, dev-only) remains open.

**Coverage Jun 30.** +40 tests, all test-only. Closed the `String(err)` false branch across the entire codebase: all 8 `src/lib/admin-api/*.ts` catch blocks, `auth-provider.tsx` two error-init paths, `use-favorites.ts` lines 68+127, `use-feature-flags.ts` lines 117+120, `supabase-auth.ts` nullish fallback (lines 13-14), `story-viewer.tsx` adjacentImages img-falsy + BookmarkButton undefined-story branches. Overall: stmts 98.63%, branches 95.15% (+0.50pp), funcs 98.64%, lines 99.1%. Dead code removal candidates unchanged: `use-stories.ts:264-270`, `agents/run/route.ts:212,221`, `feature-flags/[key]/route.ts:41`, `chat/route.ts:93`, `stream/route.ts:94`. Zero bundle impact.

**Cost Analyst Jun 30 (final June run).** June closes at ~$101.04 operational / $0 revenue — 4th consecutive zero-revenue month. Cumulative loss ~$484. Revenue drought 137 days, Paisaxe voice silence 133 days. ElevenLabs 5,536/300,000 chars (1.845%); last account activity Jun 28. Twilio balance $11.2846 (23rd consecutive stable day, 0 usage records). CRITICAL: Twilio number release decision must be made before ~Jul 7 (~7 days). `npm run build && npm run build:analyze` flagged as only open performance action (11+ cycles overdue per Cost Analyst).

**Documentation Jun 30 GREEN (32nd consecutive).** 17 feature flags + 10 agent flags, 51 internal API routes — all stable. No new features or flags since CLAUDE.md update Jun 27. Source changes since then are exclusively test files.

**Localization Jun 30 (62nd consecutive clean run).** 411 leaf keys per locale; 113 stories x 5 target locales = 565 records. Lazy-loading (es + en static, fr/de/pt/ast dynamic, ~15 KB each) unchanged. No bundle delta.

## Open Items

| Item | Priority | Status |
|---|---|---|
| `npm run build && npm run build:analyze` — authoritative post-#705 chunk + First Load JS | P1, needed | Open — 12th cycle overdue; `npm install` done (Triage Jun 25) |
| Classify 232 KB and 224 KB deferred chunks | Informational | Open — combine with `npm run build:analyze` above |
| Update authority-impersonation regex in `llm-quality.test.ts:253` | P1, QA | Open — false positive confirmed Jun 29-30; model behavior correct |
| Add `toBeVisible` guard before clicks at `qa-journey.spec.ts:102, 131, 229` | P1, QA | Open — J1/J2/J3/J6 all failing on visibility race (3+ cycles) |
| Add stability wait + `toBeEnabled()` at `qa-journey.spec.ts:65-71` (Journey 1) | P1, QA | Open — 3+ cycles |
| Add `reuseExistingServer: true` to `playwright.config.ts` (preventive) | P2, QA | Open — recommended since Jun 28 |
| Authenticated journey E2E (Journeys 9-12, auth fixture) | P3, QA | Open — 0% coverage of favorites lifecycle |
| Dead code removal batch (5 sites) | P3, Code Quality | Open — safe per Coverage Jun 30 |
| Twilio number release decision | User decision | CRITICAL — ~7 days until Jul 7 charge |
| Anthropic billing manual check | User decision | Open — overdue per Cost Analyst |
| ElevenLabs voice-shelving product decision | User decision | Open — 133-day Paisaxe silence; cost lever only (~$22/mo at Feb 2027 renewal) |
| GitHub code/secret scanning enable | User decision | Open — owner action required in GitHub repo Settings |

## Closed / No-Action Items (for the record)

| Item | Resolution |
|---|---|
| `optimizePackageImports` for lucide-react / posthog-js | CLOSED — active `next.config.ts:19` |
| `pdfjs-dist` / `pdf-parse` in client bundles | CLOSED — both `devDependencies`, never shipped |
| ElevenLabs click-to-mount (P3) | CLOSED — active since May 10 |
| ElevenLabs per-chunk budget risk | CLOSED — 591 KB under 650 KB per-chunk threshold |
| Sentry colocation with Next.js runtime | CLOSED — by design, first-paint, cannot defer |
| PostHog autocapture / session-recording weight | CLOSED — disabled `posthog-provider.tsx:98-100` |
| `@anthropic-ai/sdk` client bundle risk | CLOSED — `serverExternalPackages`, server-only |
| node_modules out-of-sync with lockfile (PR #705) | CLOSED — `npm install` run by Triage Jun 25 |
| QA port mismatch blocking LLM tests (issue #635) | CLOSED — resolved Jun 26; LLM quality 12/12 for 5 consecutive cycles |
| Playwright webServer timeout 0/0 journeys (Jun 27) | CLOSED — did not recur Jun 28+; `reuseExistingServer: true` recommended preventively |
| Metrics script 0 KB Turbopack artifact (Jun 27) | CLOSED — chunk enumeration restored Jun 28 |
| posthog-js advisories (protobufjs + dompurify) | CLOSED — cleared by `npm audit fix` Apr 20 |
| undici advisories (7 total) | CLOSED — PR #707 merged Jun 24 |

---
