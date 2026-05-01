# Remediation Report — 2026-04-27
> Pre-launch audit: `docs/agents/pre-launch-report.md` (generated 2026-04-26)
> Branch: `develop` | Wave 1 complete | Wave 2 pending user approval

---

## Executive Status

| Wave | Findings | Status |
|------|----------|--------|
| Wave 1 (Before launch) | 52 findings | ✅ Implemented + tests green |
| Wave 2 (After launch) | 39 findings | ⏳ Issues filed — awaiting user approval |
| Wave 3 (Later/strategic) | 21 findings | ⏳ Issues filed — no fix agents |

**Tests after Wave 1:** 6285 passing (341 files)
**Final commit:** `00f1c608` — fix: update tests to match Wave 1 behavioral changes
**Wave 2 issues filed:** #485–#523 (39 issues)
**Wave 3 issues filed:** #524–#544 (21 issues)

---

## Wave 1: Before Launch — COMPLETE

All 52 Wave 1 findings resolved across 5 implementation commits + 1 test-fix commit.

### Implementation Commits

| Commit | Description | Findings |
|--------|-------------|---------|
| `92023fbc` | fix: split health endpoint into liveness and diagnostics | BE-H5, DO-H1 |
| `d1cbec52` | fix: frontend component quality improvements | FE-H1–H6, UX-B1–B4, UX-H1–H7, UX-M1–M8, AR-M1–M3 |
| `4c3cf4e6` | fix: parallelize chat embedding + feature flag lookup | PE-H3, PE-M3, PE-M6 |
| `7af7d381` | chore: config improvements and architectural decisions | DO-M1, DO-M4, DO-M6, BE-M1, BE-M5, BE-M6, SE-M5 |
| `5cc21453` | fix: add Zod runtime validation to remaining API routes | BE-H1, BE-H2, BE-H3, BE-H4, BE-H6, SE-H1, SE-H2, SE-M1, SE-M2, QA-H1–H3, QA-M1, QA-M2, AR-H1, AR-H2, PE-H1, DO-H2 |
| `00f1c608` | fix: update tests to match Wave 1 behavioral changes | Test alignment for SE-M2, AR-H2, FE-H5, FE-H6 behavioral changes |

### Behavioral Changes Introduced (affects tests)

- **SE-M2 (Origin required):** POST with no Origin header now returns 403 before CSRF check. Tests must supply `origin: "https://paisaxe.es"` for CSRF tests.
- **AR-H2 (pino logger):** `logger.error("msg", meta)` → single JSON string argument to `console.error`. Tests must use `expect.stringContaining("msg")` instead of two-arg matchers.
- **FE-H5 (Admin shell URL state):** Tab state derived from `searchParams` with local state for instant responsiveness. `router.push(url, { scroll: false })` called with two args on tab change.
- **FE-H6 (analytics-cache useEffect):** Staleness check moved from render phase to `useEffect([cacheKey, enabled])`. Tests must toggle `enabled` false→true to trigger the effect.

---

## Wave 2: After Launch — PENDING

Issues filed for all 39 findings. Wave 2 implementation requires explicit user approval.

### Findings (ordered by priority)

| ID | Title | Domain | Effort |
|----|-------|--------|--------|
| DO-H3 | Console lint ignore-list undermines logging | DevOps | M |
| PE-H2 | Embedding cache in-process — cold lambdas pay Voyage RTT | Performance | M |
| PE-H3 | Search pipeline rerank/image-fetch serialized | Performance | S |
| PE-H4 | Anthropic SDK dynamic import per request | Performance | S |
| BE-M2 | Admin auth double round-trips with no caching | Backend | S |
| BE-M3 | Service-role client recreated per call | Backend | S |
| BE-M4 | Feature flags cache no Vary header | Backend | S |
| BE-M7 | Suggestion POST no spam mitigation | Backend | M |
| FE-M1 | voice-chat.tsx 423-line monolith | Frontend | M |
| FE-M2 | admin-shell.tsx 806-line monolith | Frontend | M |
| FE-M3 | Bespoke fetch-cache duplicated across 5+ hooks | Frontend | L |
| FE-M4 | Providers remounts AuthProvider on nav | Frontend | S |
| FE-M5 | PostHog provider reshapes tree on init | Frontend | S |
| FE-M6 | Unconditional idle voice-chat prefetch | Frontend | S |
| FE-M7 | Manual SSE buffer parsing not abstracted | Frontend | M |
| DO-M2 | Cron jobs lack telemetry | DevOps | M |
| DO-M3 | No regional failover documentation | DevOps | S |
| DO-M5 | CI runtime gap on develop | DevOps | M |
| DO-M7 | No log drain confirmed | DevOps | S |
| DO-L1 | npm audit only at high level | DevOps | S |
| AR-M4 | proxy.ts re-exports for tests only | Architecture | S |
| AR-M5 | Hook imports type from route file | Architecture | S |
| AR-L1 | Three outdated minor deps | Architecture | S |
| AR-L2 | Two moderate audit findings | Architecture | S |
| SE-M3 | Service-role bypasses RLS for reads | Security | M |
| SE-M4 | CSP unsafe-inline no SRI | Security | L |
| SE-L2 | Bearer precedence implicit and untested | Security | S |
| SE-L3 | Stripe API version unpinned | Security | S |
| PE-M1 | Streaming SSE on Node lambda | Performance | M |
| PE-M5 | Admin loads all stories with no pagination | Performance | M |
| QA-M3 | Data pipeline scripts untested | QA | M |
| QA-L1 | No test.skip lint rule | QA | S |
| BE-L1 | console.* in API routes | Backend | S |
| BE-L2 | Stripe unrecoverable events no audit trail | Backend | S |
| UX-M9 | Glassmorphism button pattern not abstracted | UX | M |
| UX-M10 | Progress bar segments 4px — poor touch affordance | UX | S |
| UX-L1 | role=region redundant on section with aria-label | UX | S |
| UX-L2 | alt text repeats visible heading | UX | S |
| UX-L3 | Clipboard failure silent to user | UX | S |

---

## Wave 3: Later / Strategic — ISSUES FILED

21 findings filed as GitHub issues. No fix agents spawned — requires human architectural judgment.

| ID | Title | Domain |
|----|-------|--------|
| BE-L3 | Duplicate validation in chat routes | Backend |
| BE-S1 | No dedicated background worker | Backend |
| AR-S1 | Flat src/lib/ lacks layering | Architecture |
| AR-S2 | Optional TypeScript strict flags not enabled | Architecture |
| DO-L2 | withTimeout leaks promise after timeout fires | DevOps |
| DO-S1 | Solo escalation single point of failure | DevOps |
| FE-L1 | console.* in 16+ client component paths | Frontend |
| FE-L2 | navigator.standalone any cast | Frontend |
| FE-L3 | Share URL logic duplicated | Frontend |
| FE-S1 | No state management library decision | Frontend |
| PE-M2 | Curl-spawn dev/prod parity gap | Performance |
| PE-M4 | Marketing dashboard JS aggregation vs SQL | Performance |
| PE-M7 | Sentry sourcemap upload on every build | Performance |
| PE-L1 | 1-second setInterval for elapsed timer | Performance |
| PE-L2 | story/[slug] prerenders for redirect only | Performance |
| PE-L3 | console.* on chat hot path | Performance |
| PE-L4 | EmbeddingCache SHA-256 overhead | Performance |
| PE-S1 | Single-region deployment observability | Performance |
| SE-L1 | Child process exposes full process.env | Security |
| SE-S1 | Single admin role, no fine-grained RBAC | Security |
| UX-S1 | Bookmark vs favourite metaphor conflict | UX |

---

## Previous Remediation (2026-04-20 audit)

The prior remediation cycle (documented in git history) resolved Wave 1 + Wave 2 from the April 20 pre-launch audit. The April 26 audit re-audited the codebase and found new/remaining findings above.
