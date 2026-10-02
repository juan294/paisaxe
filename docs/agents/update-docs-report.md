# Documentation Update Report
> Generated on 2026-08-18 | Branch: chore/update-docs-2026-08-18 | Changes since v1.6.0

## Summary
- 5 documents updated
- 1 diagram refreshed (1 confident edit, 1 flagged `[NEEDS REVIEW]`)
- 1 version reference corrected
- 0 inline JSDoc blocks updated (none found stale)
- 1 item flagged `[NEEDS REVIEW]`

## Framing note

The naive `v1.6.0..HEAD` git range (289 commits) is misleading: the `v1.6.0` tag lives on `main` and is not an ancestor of `develop` — the real merge-base is 2026-07-23. Nearly all of that range's content is already captured in `CHANGELOG.md`'s `[1.6.0]` section (backfilled 2026-08-18). The genuinely new work past that backfill was 4 commits (2 Dependabot bumps, one test-only fix, one report commit) — nothing doc-worthy. So this run was a **targeted correction pass**: specific, source-verified mismatches between docs and current code, most predating v1.6.0 and never caught by the last `/update-docs` run (2026-06-20, itself two releases stale).

## Changes by File

### `ROADMAP.md`
The v1.6.0 roadmap row said "Jun 2026". `CHANGELOG.md` dates the release 2026-08-04 and the actual tag/merge commit (`784aa0d5`) is 2026-08-10. Corrected to "Aug 2026".

### `docs/operations/operations.md`
Two fixes:
1. Localization Agent description said "5 locales (es, en, fr, de, pt)" — missing Asturian (`ast`). Code (`src/lib/translation-locales.ts`) and every other doc that states the count (quality-agents.md, localization reports) say 6. Corrected.
2. Stripe Payments section only documented the single Day Pass tier (€1.99, `STRIPE_DAY_PASS_PRICE_ID`). Verified against `src/lib/pricing.ts` (single source of truth for pricing) and `src/lib/stripe.ts` (`PRICE_ENV_NAMES`) that there are three live tiers — Day Pass €1.99/24h, Weekly Pass €4.99/7d, Monthly Pass €9.99/30d — requiring `STRIPE_WEEKLY_PRICE_ID` and `STRIPE_MONTHLY_PRICE_ID` in addition to the day-pass var. An operator following the old runbook would have misconfigured Stripe (weekly/monthly checkout would 500 with "STRIPE_WEEKLY_PRICE_ID not configured"). Added a tier table, updated setup steps, and the three env vars.

### `.env.example`
Added `STRIPE_WEEKLY_PRICE_ID` and `STRIPE_MONTHLY_PRICE_ID` next to the existing `STRIPE_DAY_PASS_PRICE_ID` — same gap as above. Verified with `npm run check-env`: after this fix, `check-env` reports "All process.env vars in src/ and scripts/ are documented in .env.example". (No test-mode variants needed — `scripts/run-stripe-e2e.ts` and the Stripe E2E CI workflow only ever exercise the day_pass tier.)

### `docs/operations/elevenlabs-pelayo-config.md`
Two factual corrections, verified against source:
1. "Budget Tier: ElevenLabs Starter ($5/month)" contradicted the cost-analyst agent's live-verified data (Creator tier, $22.18/mo effective, annual billing). Corrected.
2. "Primary LLM: Gemini 2.5 Flash" — the actual configured model in `agent_configs/Paisaxe-Pelayo-(Visitor-Guide).json` (`"llm": "gemini-2.5-flash-lite"`) is the Lite variant, not full Flash. Corrected the section header and reordered the comparison table so the configured default is listed first with an explicit pointer to the config file.

Also added a `<!-- contract:allow-emoji -->` marker (with an explanatory comment) at the top of the file. The repo's `verify-edit.sh` hook flags emoji in docs by policy, but this file's SMS Templates section reproduces literal message content sent by `src/lib/twilio-sms.ts` (verified against `twilio-sms.test.ts`) — the check/cross/phone/calendar/people glyphs are required, accurate examples of real customer-facing text, not decoration, which is exactly the case the hook's own escape hatch describes. No template text was altered.

### `docs/paisaxe-architecture.drawio`
This is the only diagram in the repo — no Mermaid diagrams exist anywhere in the project. Two verified mismatches found:
1. **Fixed (confident, deletion-only):** removed the `cleanup-analytics` Edge Function node and its one connecting edge. That function was deleted from `supabase/functions/` on 2026-01-28 (commit `ce634316`) — the diagram had already been stale on this point since before its last edit (2026-05-03).
2. **Flagged `[NEEDS REVIEW]`, not edited:** the MCP Tool Endpoints box is missing `/api/mcp/save-favorite`, added 2026-06-20 (commit `e06a17d8`, issue #34). Adding a new node correctly requires a layout decision (widen the `swim-api` swimlane, which would need every downstream swimlane shifted to stay visually consistent, or find/create room within the existing bounds) that a blind XML coordinate edit risks getting visibly wrong without the ability to render and check it. Left a `[NEEDS REVIEW]` XML comment at the top of the file with the specific node ID, commit, and issue reference. Confirmed the file is still well-formed XML after editing (`python3 -m xml.etree.ElementTree`) — my first attempt at the comment accidentally included a bare double-hyphen, which is illegal inside an XML comment; caught and fixed before finalizing.

One additional diagram-analyzer finding I deliberately did **not** touch: the diagram labels the OAuth callback route under the `/api/...` naming convention, but the real route (`src/app/auth/callback/route.ts`) has no `/api` prefix and has been at that path since 2026-01-25 — this predates the recent change window and reads as a pre-existing simplification, not new drift. No edit made; not re-flagging beyond this note.

## Not touched (checked, found current or out of traceable scope)

- README.md, CLAUDE.md, CHANGELOG.md, `docs/project/features.md`, `docs/runbooks/release-checklist.md`, `docs/operations/quality-agents.md`, all ADRs (`docs/decisions/`), all agent persona docs, `docs/operations/database-backup.md`, `docs/project/license-exceptions.md`, `docs/project/markdown-render-sinks.md`.
- Inline JSDoc: `src/lib` (87% coverage) and API routes (66%) were sampled; no stale `@param`/`@returns` blocks found against current signatures. `src/components` has sparse JSDoc (23%) but per the skill's "refresh, not expand" rule, undocumented functions were left as-is rather than given new docstrings.
- markdownlint: the project has no `.markdownlint.json`/`.yaml`/`.yml`/`.rc` config and does not run markdownlint in CI or any npm script — the repo's own `verify-edit.sh` hook explicitly skips markdownlint for this exact reason ("otherwise default rules flood false positives on repos that never opted into linting"). Running it ad hoc against the changed files confirmed that: hundreds of pre-existing line-length/table-style/bare-URL violations unrelated to these edits, in files unrelated to my changes too. Treated as inapplicable rather than a real gate; not fixed (out of scope — would be a repo-wide style migration, not a doc-content refresh).

## Verification

- [x] `python3 -m xml.etree.ElementTree` — `docs/paisaxe-architecture.drawio` is well-formed XML after edits
- [x] `npm run check-env` — all `process.env` vars in `src/`/`scripts/` documented in `.env.example` (confirms the Stripe var fix was a real, now-closed gap)
- [x] `npm run lint` — clean (no source files touched)
- [x] Manual grep for dangling `edge-cleanup`/`e-edge-db-2` references after the drawio deletion — none found
- [x] Full diff reviewed line-by-line (5 files, 34 insertions, 18 deletions)

## Flagged for Review

- `docs/paisaxe-architecture.drawio` — MCP Tool Endpoints box needs `/api/mcp/save-favorite` added, requires a human pass in the drawio editor for layout (see comment at top of file for full context: node IDs, commit, issue #34).
