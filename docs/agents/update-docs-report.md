# Documentation Update Report

> Generated on 2026-04-24 | Branch: develop | Changes since v1.2.0 (2026-02-03)

## Summary

- **11 documents updated**
- **2 new documents created**
- **3 version references corrected**
- **1 diagram flagged [NEEDS REVIEW]**
- **0 items blocked**

---

## Changes by File

### Version References Fixed

| File | Change |
|------|--------|
| `package.json` | `engines.node` `>=23.0.0` → `>=24.0.0` |
| `README.md` | TypeScript badge `5.7` → `6.0` |
| `docs/architecture/replication.md` | `Node.js 18+` → `Node.js 24+` |

---

### `docs/engineering/testing-guide.md`

**Reason**: Unit test count was wildly stale — showing 86 files/1,054 tests when the real count is 324 files/~6,000 tests. E2E suite grew from 6 specs to 16. Pre-commit hook referenced the old count.

**Changes:**
- Last updated date: 2026-01-27 → 2026-04-24
- Overview table: 86 files/1,054 tests → 324 files/~6,000 tests; 6 E2E specs/50 tests → 16 specs/32 configs
- Unit test inventory section: header updated with note that it's a representative sample; API routes section expanded with 12 new route test files (Stripe, webhooks, cron, checkout, health/db)
- Libs section: updated with new test files (csrf, request-context, logger, env, admin-api/*)
- E2E section: replaced fixed list of 5 specs with current 16-spec inventory with descriptions for each new spec (sse-abort, xss-canary, checkout, author-pill, pre-launch, qa-journey, interactive-controls, visual-regression, stripe-real-checkout)
- E2E file tree updated to show all 16 specs
- Pre-commit hook count corrected: `1,054 tests` → `~6,000 tests`
- Removed hardcoded test timing stat that referenced the old count

---

### `ROADMAP.md`

**Reason**: Embeddings model was wrong (voyage-3/1024-dim), shipped MCP tools were listed as future, and 3 months of major phases (Payments, Security Hardening, Content Pipeline) were undocumented.

**Changes:**
- Last updated: Feb 1, 2026 → Apr 24, 2026
- AI & Search Backend table: voyage-3/1024 dims → voyage-3.5/512 dims (Matryoshka)
- Infrastructure Vitest row: 1,247 tests/102 files → ~6,000 tests/324 files
- Verification checklist: test count updated
- Phase 9 "Future: MCP Tool Integrations": converted from planned to shipped (weather, places, booking, SMS all marked ✅; events/maps still planned)
- Added Phase 10: Payments & Monetization (Stripe, analytics, Lemon Squeezy removal)
- Added Phase 11: Security Hardening with audit remediation table (CSRF, request IDs, rate limiting, env validation, withAdmin HOF, SafeMarkdown, proxy decomposition, Sentry, structured logging, SSE abort, Zod)
- Added Phase 12: Content & Story Pipeline (translations, content discovery, WebP migration, author pill, about/privacy/terms pages)
- Version history: added v1.0.0 date (Feb 2026), v1.1.0, v1.2.0, v1.3.0

---

### `docs/operations/operations.md`

**Reason**: Test count said "~2000 tests" and cron route list was missing 4 new Vercel Cron jobs added during audit remediation.

**Changes:**
- Pre-launch checklist test count: ~2000 → ~6,000
- Added proxy architecture and ElevenLabs CLI cross-references before the ElevenLabs Voice Agents section
- Database Maintenance table: added 4 new Vercel Cron routes (content-discovery, fail-stale-translations, github-traffic-sync, subscription-optimizer)

---

### `docs/operations/quality-agents.md`

**Reason**: Jan 31, 2026 snapshot — missing 3 new local agents, all Vercel Cron jobs, Sentry integration, and request correlation ID infrastructure.

**Changes:**
- Last updated: Jan 31 → Apr 24, 2026
- Architecture overview block: added 3 new local agents, Vercel Cron block, Sentry entry, `e2e-stripe-integration.yml` and `preview-smoke.yml` CI workflows
- Local Automated Agents: 4 agents → 7 agents; table updated with QA, Localization, Cost Analyst
- Feature Flag Control section: added `scripts/agent-ctl.sh` CLI reference; expanded flag table with 4 new flags
- Launchd plists list: added 4 new plists including cc-rpi-update
- Agent Descriptions: added QA Agent, Localization Agent, Cost Analyst Agent sections
- Monitoring section: replaced stale health endpoint JSON example with accurate description; added Sentry Error Tracking subsection (3 runtimes, PII redaction, console guard); added Request Correlation IDs subsection
- Config reference: feature flags table expanded with all 11 flags; key files table doubled with new files (agent-ctl.sh, qa/localization/cost-analyst agents, Sentry configs, proxy/request-context files)
- Launchd plists table: added QA, Localization, Cost Analyst entries

---

### `docs/operations/logging.md`

**Reason**: Did not reflect the P3 console shim (ESLint guard on raw console.*), Sentry integration, or the new log keys added during audit remediation.

**Changes:**
- Overview section: added Console guard paragraph (ESLint rule blocks console.* in API routes) and Sentry integration paragraph (logger.error() → Sentry, PII stripped via beforeSend)
- Log key table: added 6 new keys: `[CSRF_VALIDATION_FAILURE]`, `[RATE_LIMIT_EXCEEDED]`, `[STRIPE_WEBHOOK_INVALID_SIG]`, `[TRANSLATION_STALE]`, `[ELEVENLABS_WEBHOOK_FAILURE]`

---

### `docs/operations/elevenlabs-pelayo-config.md`

**Reason**: Stale Guide agent ID (`agent_3101…` from Feb 4) — the agent was recreated on Feb 5 with ID `agent_1201kgqhsdzxfkk9x7m1bjaew9mv`. Confirmed against `agents.json`.

**Changes:**
- Last updated: 2026-02-04 → 2026-04-24
- Guide agent ID: `agent_3101kg5bvnf4f1r94f0cav0v9y61` → `agent_1201kgqhsdzxfkk9x7m1bjaew9mv`
- Added as-code workflow note and link to new `elevenlabs-agents-as-code.md` doc

---

### `docs/marketing/automation-setup.md`

**Reason**: X API tier section stated the free tier supports posting; in reality it returns `CreditsDepleted` (402) for our account. The current workflow is manual copy-paste.

**Changes:**
- API Tier section: rewrote free-tier description to document `CreditsDepleted` reality; added warning block with current status and current workaround (Xander drafts, manual post)

---

### `docs/architecture/replication.md`

**Reason**: Node.js minimum requirement listed as 18+ (project requires 24+).

**Changes:**
- Prerequisites: `Node.js 18+ installed` → `Node.js 24+`

---

### `scripts/launchd/README.md`

**Reason**: Schedule table listed only 5 agents; 3 new agents and cc-rpi-update were missing.

**Changes:**
- Schedule table: added cost-analyst-agent (Daily 3:00 AM), localization-agent (Sundays 7:00 AM), cc-rpi-update (Daily 3:30 AM); table now shows all 8 agents

---

## New Documents Created

### `docs/operations/elevenlabs-agents-as-code.md`

Documents the ElevenLabs CLI as-code workflow (previously only in MEMORY.md):
- File structure (`agents.json`, `tools.json`, `agent_configs/`, `tool_configs/`)
- All 5 agent IDs with names
- npm script reference table (agents:pull, push, push:dry, status; tools:pull, push)
- Step-by-step edit workflow
- Authentication setup
- Limitations (knowledge base PDFs, voice settings must use dashboard)
- Deprecated scripts and what replaced them

### `docs/operations/proxy-architecture.md`

Documents the proxy.ts module architecture (previously undocumented):
- Middleware chain order (8 steps with file paths)
- Key files table
- CSP policy rationale and PPR incompatibility explanation
- CSRF double-submit cookie pattern
- Request correlation ID propagation (AsyncLocalStorage → logs → Sentry → response headers)
- Migration note from middleware.ts

---

## Flagged for Review

### `docs/paisaxe-architecture.drawio` + `.drawio.png`

`<!-- [NEEDS REVIEW] The architecture diagram was created on Apr 3 and predates ~195 commits including proxy decomposition, CSRF layer, request-ID middleware, Pelayo Booking agent as a distinct node, /api/agent-run endpoint, and the Stripe atomicity fix. The drawio XML can be edited manually but PNG re-export requires Draw.io desktop app. Specific changes needed: (1) add proxy/middleware layer between Frontend and API; (2) split single ElevenLabs node into "Pelayo Guide" + "Pelayo Booking"; (3) add /api/agent-run to API layer; (4) rename "Supabase Sync" webhook label; (5) add CSRF + request-ID to Business Logic layer. -->`

---

## Next Steps

- Review the diagram (`docs/paisaxe-architecture.drawio`) in Draw.io desktop and update per the flagged items above, then re-export the PNG.
- Run `/pre-launch` before the next release to catch issues `/update-docs` does not cover (security, performance, accessibility, E2E).
- Consider running `/release` once the diagram is updated and CI is green.
