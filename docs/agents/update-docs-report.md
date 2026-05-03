# Documentation Update Report
> Generated on 2026-05-03 | Branch: chore/update-docs | Changes since v1.5.1

## Summary

- 7 documents updated
- 0 diagrams refreshed (1 flagged [NEEDS REVIEW])
- 12+ version/count references corrected
- 0 inline doc blocks updated
- 1 item flagged [NEEDS REVIEW]

## Changes by File

### `CHANGELOG.md`
Populated the `[Unreleased]` section with ~45 entries covering all commits since v1.5.1:
- **Added**: `retry-booking-sms` cron job, durable cron locking (`cron_job_locks`), `rate_limit` field in health endpoint, `check-verification-coverage` CI gate, `prelaunch:live` npm script, `FeatureFlagsProvider` `enabled` prop, ADR-0017 + ADR-0018, Playwright E2E specs for voice agents and MCP tools, migrations 087–088, `PublicStory`/`PublicStoryRow` types, `chat-route-utils.ts`, 30+ Spanish i18n keys.
- **Fixed**: `VERCEL_ENV` production detection fix, `NEXT_PUBLIC_*` static access fix, auth provider null-safe updates, checkout return URL encoding, SSRF hardening, chat per-stage timeouts, search rerank timeout, various a11y fixes, health endpoint HTTP 503→200.
- **Changed**: `npm run typecheck` now runs 4 sub-commands; `lint:scripts` added; `check-migrations` is now an npm script; Upptime liveness monitor moved to `/api/health/live`.

### `ROADMAP.md`
- Updated **Last Updated** date: May 1 → May 3, 2026
- Added migrations 087 (`restrict_operational_table_access`) and 088 (`voice_booking_durability`) to the database migrations table
- Added **SMS Retry Cron** row to Phase 9 (MCP Tool Integrations)

### `docs/operations/operations.md`
- Updated health endpoint description to include `rate_limit` field schema
- Added `retry-booking-sms` cron job row (every 10 min) to the Vercel cron jobs table
- Fixed `check-migrations` reference: `npx tsx scripts/check-migrations.ts` → `npm run check-migrations`

### `docs/operations/alerting-runbook.md`
- Updated "Health Endpoint Degraded" trigger: removed "returns non-200 HTTP status" (endpoint always returns 200 now); added check for `status != "healthy"` in JSON body
- Added `retry-booking-sms` to the cron job names table (every 10 min)
- Added new **Rate Limit Backend Degraded** runbook section covering `backend: "blocked"` and `reason: "upstash_unavailable"` scenarios

### `docs/operations/quality-agents.md`
- Updated **Last Updated** date: April 24 → May 3, 2026
- Updated E2E spec file count: 16 → 18 in the architecture overview
- Expanded `lint-and-typecheck` CI job description to include `check-verification-coverage`, `check-env`, and `check-migrations` steps
- Updated health endpoint description: now always returns HTTP 200; split into `/api/health/live` (liveness, used by Upptime) and `/api/health` (diagnostics); added `rate_limit` field to payload description
- Updated Upptime monitor: `paisaxe.es/api/health` → `paisaxe.es/api/health/live`

### `docs/engineering/testing-guide.md`
- Updated **Last updated** date: 2026-04-24 → 2026-05-03
- Updated overview table: 332 files / 6,059 tests → **353 files / 6,496 tests**; 16 E2E specs / 32 configs → **18 E2E specs / 36 configs**
- Updated inventory section heading: 341 files / 6,347 tests → **353 files / 6,496 tests**
- Updated E2E configuration sentence: `32 test configurations from 16 spec files` → `36 from 18`
- Updated "E2E suite has grown to N spec files": 16 → 18
- Added `voice-agents.spec.ts` and `mcp.spec.ts` entries (descriptions + file tree)
- Updated pre-commit hook test count: `~6,347` → `6,496`

### `docs/project/features.md`
- Updated `/api/health` description: removed "HTTP 503 when degraded" (endpoint now always returns HTTP 200); added `rate_limit.status` field to the payload description; clarified that `/api/health` is the diagnostics endpoint and Upptime uses `/api/health/live` for liveness.

## Flagged for Review

`docs/paisaxe-architecture.drawio` — The architecture diagram was not updated. It may show stale connections for the health endpoint (now split into `/live` and diagnostics) and is missing the `retry-booking-sms` cron job. Use the `/drawio` skill or update manually in draw.io before the next release.

<!-- [NEEDS REVIEW] docs/paisaxe-architecture.drawio — may not reflect recent changes to cron jobs (retry-booking-sms), health endpoint split (/api/health/live vs /api/health), and rate-limit backend. Requires the /drawio skill to update. -->
