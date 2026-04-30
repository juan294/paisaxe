# Documentation Update Report
> Generated on 2026-04-29 | Branch: `develop` | Changes since `v1.4.0`

## Summary

- **12 documents updated**
- **1 diagram updated** (ASCII CI flow in testing-guide.md)
- **9 version references corrected** (test counts, migration count, dates, Last Updated)
- **0 inline doc blocks updated** (project has no JSDoc/docstrings in scope)
- **1 item flagged [NEEDS REVIEW]** — `docs/paisaxe-architecture.drawio`

## Changes by File

### `CHANGELOG.md`
- Added `[1.5.0] - 2026-04-29` section covering all 99 post-v1.4.0 commits (Wave 1 + Wave 2 remediation): Added, Fixed, Security, Performance, Changed, Removed, Testing subsections
- Fixed 4 date placeholders: `[1.3.0] 2026-04-20`, `[1.2.0] 2026-02-03`, `[1.1.0] 2026-01-31`, `[1.0.0] 2026-01-31`

### `ROADMAP.md`
- Updated `Last Updated` from April 24 → April 29, 2026
- Updated test count `~6,000 (324 files)` → `6,347 (341 files)` in two places
- Added `v1.5.0` row to release history table

### `README.md`
- Fixed migration count `17 migrations` → `83 migrations` in two places (setup instructions + directory tree)
- Added `Pino (structured JSON) + Sentry` and `Upstash Redis` rows to tech stack table

### `CLAUDE.md`
- Added `Pino (structured JSON) + Sentry` and `Upstash Redis` rows to tech stack table

### `docs/operations/operations.md`
- Replaced single "Health Check Endpoint" section with two-endpoint description (`/api/health/live` + `/api/health`)
- Updated test count `~6,000` → `~6,347`
- Updated pre-launch checklist "Health Endpoint" step to probe both endpoints

### `docs/operations/logging.md`
- Added 8 new event codes to the Key Conventions table:
  - `[RATE_LIMIT_DEGRADED]` — Redis fallback warning
  - `[CRON_SUCCESS]` — cron job completion with `job` + `duration_ms`
  - `[CRON_FAILURE]` — cron job error with `job` + `error`
  - `[CRON_AUTH_REJECTED]` — cron secret verification failure with `reason`
  - `[HONEYPOT_TRIGGERED]` — bot-triggered suggestion field
  - `[ADMIN_AUDIT]` — admin write action audit log
  - `[ADMIN_PROFILE_LOOKUP_FAILED]` — non-PGRST116 admin role lookup error

### `docs/operations/alerting-runbook.md`
- Added "Cron Auth Rejected" section with steps for `[CRON_AUTH_REJECTED]` events
- Added "Honeypot Triggered" section for `[HONEYPOT_TRIGGERED]` events

### `docs/operations/database-backup.md`
- Added HNSW index note to post-restore checklist: migration 086 dropped IVFFlat for HNSW and must be re-run if restoring to a pre-086 point

### `docs/engineering/testing-guide.md`
- Updated test counts: `332 files / 6,059 tests` → `341 files / 6,347 tests` in two places
- Updated CI flow ASCII diagram: added `E2E` and `develop-smoke` boxes; updated "All three must pass" → "All five must pass"
- Added `withAdminRead` HOF mock pattern code example
- Added `admin-auth.test.ts` and `use-sse-stream.test.ts` to test file inventory

### `docs/project/features.md`
- Updated Infrastructure health check entry to document both `/api/health/live` and `/api/health`
- Added `withAdminRead` / `withAdmin` + LRU role cache description to Admin Access section

### `docs/project/markdown-render-sinks.md`
- Updated react-markdown sink path: `voice-chat.tsx` → `voice-chat/chat-message-list.tsx` (FE-M1 monolith split)

### `docs/decisions/0015-service-layer.md`
- Updated consequences note: `src/services/.gitkeep` was removed during AR-M2; ADR remains Proposed

## Flagged for Review

### `docs/paisaxe-architecture.drawio` — [NEEDS REVIEW]

The DrawIO XML diagram has 7 stale elements that cannot be confidently auto-updated from text edits:

1. `/api/health` node — needs split into `/api/health` (diagnostics) and `/api/health/live` (liveness)
2. `lib-embed` → `ext-upstash` edge — embedding cache now Upstash Redis (not in-process LRU)
3. Parallel `feature-flags ‖ embedding` annotation on `api-chat` path
4. Admin path — add `withAdminRead` distinction (GET vs mutation)
5. Observability layer — Pino + Sentry + `x-request-id` correlation
6. ElevenLabs lane — Agents-as-Code workflow (`agent_configs/` in git)
7. Proxy lane — add `Canonical Domain Redirect` and `Story URL Rewrite` nodes

**Action:** Open `docs/paisaxe-architecture.drawio` in draw.io, apply changes, re-export PNG.

## What Was Not Updated

- `AGENTS.md` — Codex compatibility guide, no tech stack table
- `docs/operations/branch-protection.md` — Already correct; develop-smoke is not a required check for main merges
- Historical snapshots: `docs/research/`, `docs/plans/`, `docs/operations/pre-launch-audit.md` (immutable)
- `docs/agents/*-report.md` — Gitignored operational history (Rule #70)
- `content/prompts/` — No prompt changes since v1.4.0
- ADR-0016 (claude.ts modularization) — Still correctly Proposed
