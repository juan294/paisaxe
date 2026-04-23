# Engineering Audit Remediation Plan

**Date:** 2026-04-20
**Source:** `docs/research/2026-04-18-deep-engineering-audit.md`
**Scope:** Full — Top 5 (§3.1–§3.5), confirmed bugs (§4), performance (§5), test gaps (§7), fastest wins (§8), second-stage proposals (§9).
**Estimated duration:** ~2 weeks wall-clock with parallel worktrees.

---

## Executive Summary

The audit identified one Critical Ship Blocker (non-atomic Stripe dedup → voice grant, §3.1) and four High-severity hardening tasks (§3.2–§3.5). This plan sequences the remediation in 10 phases: P1 is the ship blocker, P2–P6 run in parallel worktrees, and P7–P10 follow as dependencies allow.

## Implementation Status

- [x] P1 — Implemented and verified on 2026-04-22 in worktree `fix/stripe-webhook-atomicity`; `typecheck`, `lint`, targeted Stripe tests, full Vitest suite, and `npm run test:e2e` all passed. Local Supabase verification passed after freeing Docker port `54322`, running `supabase db reset`, and confirming `grant_day_pass_idempotent` exists as a `SECURITY DEFINER` function.
- [x] P2 — Implemented and verified on 2026-04-22 in worktree `fix/agent-runner-boundary`; the agent runner is now local-only via `VERCEL_ENV === undefined`, the legacy override is removed from live code paths, the route has regression coverage for the new gate and stale-entry cleanup, and CI now checks Vercel env config for the removed override. `typecheck`, `lint`, full Vitest, `build`, and `npm run test:e2e` all passed.
- [x] P3 — Implemented and verified on 2026-04-22 in worktree `fix/logging-sentry-hardening`; shared log redaction now covers the logger, console shim, and Sentry `beforeSend`, the planned high-PII API routes use structured logger calls, and the API-route lint guard now blocks new `console.*` usage outside a temporary legacy allowlist. `typecheck`, `lint`, full Vitest, `build`, and `npm run test:e2e` all passed after updating stale logger/Sentry expectations and hardening the affected E2E specs. `next build` still emits a non-fatal Next.js warning about `process.stdout` in the logger's dev/test branch when analyzing edge imports, but the production build and Playwright smoke paths are green.
- [x] P4 — Implemented and verified on 2026-04-23 in worktree `fix/p4-csp-xss`; CSP nonce scaffolding was removed, the ElevenLabs WebSocket wildcard was tightened to explicit hosts, the markdown sink registry was added, and a real XSS canary Playwright spec now verifies chat markdown does not execute injected HTML. `typecheck`, `lint`, full Vitest (`319` files, `5994` tests), and `npm run test:e2e -- xss-canary` all passed.
- [x] P5 — Implemented and verified on 2026-04-23 in worktree `fix/p5-sse-abort`; the chat SSE route now propagates `request.signal` into the Claude stream, the shared SSE event taxonomy lives in `src/types/sse.ts`, the client parser consumes that contract, and a new `e2e/sse-abort.spec.ts` regression covers in-flight aborts. `typecheck`, `lint`, full Vitest (`320` files, `6002` tests), targeted Playwright for chat/SSE abort, and the full Playwright suite (`144` passed, `32` skipped) all passed.
- [x] P6
- [x] P7
- [x] P8
- [ ] P9
- [ ] P10

## Design Decisions (from clarification pass)

| Question | Answer | Impact |
|---|---|---|
| Plan scope | **Full** (Top 5 + §4 + §5 + §7 + §8 + §9) | 10 phases, ~2 weeks |
| §3.2 CSP path | **Path B** — delete dead nonce scaffolding, SRI on Stripe, document `'unsafe-inline'` as intentional | S effort, no PPR interaction |
| §3.4 PII approach | **Hybrid (Option 3)** — console shim + migrate top 10 callsites + ESLint rule | Fast safety net, clean where it matters |

## Phase Index

| # | Title | File | Batch | Depends |
|---|---|---|---|---|
| 1 | Stripe webhook atomicity + unrecoverable codes | [phase-1.md](2026-04-20-engineering-audit-remediation-phases/phase-1.md) | No | — |
| 2 | Agent runner trust boundary | [phase-2.md](2026-04-20-engineering-audit-remediation-phases/phase-2.md) | `[batch-eligible]` | P1 |
| 3 | Logging + Sentry PII hardening | [phase-3.md](2026-04-20-engineering-audit-remediation-phases/phase-3.md) | `[batch-eligible]` | P1 |
| 4 | CSP simplification + XSS canary | [phase-4.md](2026-04-20-engineering-audit-remediation-phases/phase-4.md) | `[batch-eligible]` | P1 |
| 5 | SSE abort propagation + taxonomy | [phase-5.md](2026-04-20-engineering-audit-remediation-phases/phase-5.md) | `[batch-eligible]` | P1 |
| 6 | Quick wins bundle | [phase-6.md](2026-04-20-engineering-audit-remediation-phases/phase-6.md) | `[batch-eligible]` | P1 |
| 7 | Webhook idempotency pattern propagation | [phase-7.md](2026-04-20-engineering-audit-remediation-phases/phase-7.md) | No | P1 |
| 8 | Request correlation IDs | [phase-8.md](2026-04-20-engineering-audit-remediation-phases/phase-8.md) | No | P3 |
| 9 | Reliability hardening | [phase-9.md](2026-04-20-engineering-audit-remediation-phases/phase-9.md) | `[batch-eligible]` | P6 |
| 10 | Final hygiene + deep integration tests | [phase-10.md](2026-04-20-engineering-audit-remediation-phases/phase-10.md) | No | P1, P8 |

## Execution Strategy

**Wave 1 — Ship blocker (sequential):** P1.

**Wave 2 — Parallel worktrees (`[batch-eligible]`):** P2, P3, P4, P5, P6. Five worktrees run concurrently; each merges to `develop` independently once its gates pass.

**Wave 3 — Dependent follow-ups:** P7 (after P1 merged), P8 (after P3 merged). Can run concurrently with each other.

**Wave 4 — Final hardening:** P9 `[batch-eligible]` pair of reliability items.

**Wave 5 — Tail cleanup:** P10 (after P1, P8, ideally P9).

Each phase follows the project's atomic loop: implement → review → fix → approve → `/simplify` → verify → STOP for human confirmation.

## Cross-Phase File Map (to validate batch disjointness)

| Phase | Files touched |
|---|---|
| P1 | `supabase/migrations/078_*.sql`, `src/app/api/webhooks/stripe/route.ts`, `src/app/api/webhooks/stripe/route.test.ts` |
| P2 | `src/app/api/admin/agents/run/route.ts`, `src/app/api/admin/agents/run/route.test.ts` (new), `.github/workflows/security.yml` |
| P3 | `src/instrumentation.ts` (new or extended), `src/lib/logger.ts`, `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`, `eslint.config.mjs`, top-10 API route files for callsite migration |
| P4 | `src/lib/proxy/csp.ts`, `src/proxy.ts`, `src/app/layout.tsx` (or Stripe script loader), `e2e/xss-canary.spec.ts` (new) |
| P5 | `src/app/api/chat/stream/route.ts`, `src/app/api/chat/stream/route.test.ts`, `src/lib/claude/*`, `src/types/sse.ts` (new), `e2e/sse-abort.spec.ts` (new) |
| P6 | `src/app/auth/callback/route.ts`, `src/lib/rerank.ts`, `src/app/api/health/route.ts`, `src/lib/feature-flags-server.ts`, `e2e/visual-regression.spec.ts`, `e2e/author-pill.spec.ts`, `.github/workflows/*.yml` |
| P7 | `src/app/api/webhooks/elevenlabs/route.ts`, `src/app/api/webhooks/translate/route.ts`, `supabase/migrations/079_*.sql`, respective tests |
| P8 | `src/lib/proxy/request-id.ts` (new), `src/proxy.ts`, `src/lib/logger.ts`, `sentry.*.config.ts` |
| P9 | `src/app/api/health/route.ts` (probe timeouts), `src/app/api/cron/*` (new stale-translation cron), `supabase/migrations/080_*.sql` |
| P10 | `package.json` (lucide-react), `vercel.json` (region), `e2e/stripe-checkout.spec.ts` (replaces mocked E2E) |

Wave 2 batch conflicts: **none** — each phase's file set is disjoint from the others. P3 touches `webhooks/stripe/route.ts` for callsite migration, but P1 merges first in Wave 1.

## Global Success Criteria

Run at the end of every phase and before final merge:

```bash
npm run typecheck ; npm run lint ; npm run test
npm run test:e2e
```

## Rollback Strategy

Each phase is implemented in its own worktree with its own feature branch. Rollback = `git revert` the merge commit. No phase couples irreversibly to external state except P1's new migration (forward-only); migration 078 is additive (new function + optional grants), safe to leave in place even if the route code is reverted.

## References

- Audit: `docs/research/2026-04-18-deep-engineering-audit.md`
- Git workflow: `CLAUDE.md` → "Git Workflow", "Worktree-First Development"
- Production safety: `CLAUDE.md` → "Production Safety (MANDATORY)"
- TDD protocol: `CLAUDE.md` → "TDD Protocol", `.claude/rules/testing.md`
- Supabase migration rules: `.claude/rules/supabase.md`
