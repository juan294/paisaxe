# Plan: Open-Issue Backlog Remediation (2026-06-20)

Triaged all 56 open issues. Closed 15 (11 stale + 4 duplicate). Remaining **41 valid** issues
are grouped below into non-overlapping work-packages so they can be implemented in parallel
git worktrees off `develop` without file conflicts, then merged centrally.

All work is TDD (Red→Green→Refactor), merged to `develop` only. **No production / `main` / live
Stripe / live ElevenLabs / Supabase-prod actions** — code + migrations land on develop; any
external step (Stripe product creation, `agents:push`) is flagged for the user.

## Consolidations / dispositions

- **#451 + #539 + #530** → one logger-migration pass (all are `console.* → logger`, different scopes).
- **#623** absorbs #576's dev-dep license-scan point (already closed #576 as consolidated).
- **#619** absorbs #574 (already closed #574 as duplicate).
- **#625** absorbs #577 (already closed #577 as duplicate).
- **#538** → close as wontfix: `story/[slug]` page is intentionally retained for per-story OG
  metadata (social sharing); #573 optimizes its metadata query instead of removing the page.
- **#526** (flat `src/lib/` restructure) → ADR only this cycle; mass 56-file move deferred (high
  churn / low value / conflicts with every other WP). Tracked, not executed.

## Wave 1 — independent file areas (parallel worktrees)

- **WP-A `logger-migration`** — #451, #539, #530. `src/lib/**`, `src/hooks/**`, client
  `src/components/**` console→logger; extend eslint `no-console` beyond `api/**`.
- **WP-C `immersive-frontend`** — #634 (panel click scope), #615 (adjacent-image prefetch),
  #569 (dynamic-import flag-gated comps), #479 (index-as-key), #564 (AdminShell Suspense),
  #531 (Navigator.standalone ambient type), #537 (pause timer when tab hidden).
- **WP-D `config-docs`** — #614 (MCP POST Cache-Control), #620 (cron doc drift), #541
  (cache-miss metric), #536 (Sentry sourcemap gating), #624 (knip coverage), #623 (license
  exceptions + dev-dep scan), #529 (on-call doc).
- **WP-F `adr-and-tsconfig`** — #543 (role_scopes ADR), #533 (state-mgmt ADR), #525 (bg-worker
  ADR), #526 (lib-structure ADR), #527 (enable safe tsconfig strict flags + fix fallout).

## Wave 2 — route/DB heavy + risky (after Wave 1 merges; strict file ownership)

- **WP-B `route-hygiene`** — #619 (request-id binding via wrappers), #570 (validation helpers),
  #524 (dedupe chat validation), #631 (SSE idle timeout), #626 (admin-auth wrapper consistency),
  #528 (health withTimeout AbortController). Owns `request-context.ts`, `validation.ts`,
  `chat-stream-timeouts.ts`, `admin-api/**`, and the non-story API route bodies it edits.
- **WP-E `story-backend`** — #573 (slim metadata query), #572 (atomic story-from-suggestion RPC),
  #571 (stripe webhook audit table match), #535 (marketing SQL aggregation), #138 (Anthropic
  spend tracking). Owns `story/[slug]/page.tsx`, `admin/stories/route.ts`, stripe webhook,
  marketing dashboard, + new migrations.
- **WP-H `sdk-upgrade`** — #627 (voyageai 0.1.0→0.4.x). Isolated; verify `build` + embeddings/
  rerank tests; revert package if it breaks.
- **WP-I `service-layer`** — #625 extract make-booking + elevenlabs-webhook logic into
  `src/lib/services/`.
- **WP-J `misc-safe`** — #534 (curl-spawn parity), #542 (child-env allowlist + log sanitize),
  #34 (Pelayo save_favorite tool config + webhook endpoint; `agents:push` is a user step),
  #137 (weekly/monthly pass code behind env price IDs; live Stripe product creation is a user step).

## Verification gate per WP

In each worktree: `npm install` → write failing test → implement → `npm run typecheck && npm run
lint && npm run test` green. Merge to develop centrally; full suite once at the end; single push;
monitor CI.
