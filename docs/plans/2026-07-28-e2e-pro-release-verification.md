# Plan: E2E Pro Release Verification — Wave A

- **Date**: 2026-07-28
- **Research**: `docs/research/2026-07-28-e2e-pro-release-verification.md`
- **Template**: `docs/release/e2e-pro-playbook.md` (cc-rpi template v1.0, unadapted seed)
- **Branch**: `feature/e2e-pro-release-verification`
- **Scope**: Wave A only (the template's mandatory floor). Waves B–H deferred; see §Deferred.

---

## Decisions Taken

### D-A — Candidate identity: bind to the tree hash

The repo permits squash merges only, so the commit SHA that CI tested never reaches `main`.
**But the tree does.** Verified on PR #738: head `9411eada` and landed `a6f51f67` share tree
`95a62c4be18d9b222187b88a450ba02bcc664365`. `strict: true` on `main` branch protection forces the
PR branch to be up to date before merging, which is what makes that equality hold.

Therefore release evidence identifies the candidate by **tree hash**, not commit SHA:

```
candidate_tree = git rev-parse <tested-sha>^{tree}
shipped_tree   = git rev-parse <main-head>^{tree}
release_ok requires candidate_tree == shipped_tree
```

Rejected alternatives: restoring merge-commits (production still builds a tree nobody tested);
Vercel deployment promotion (requires extra preview builds → cost).

### D-B — Safety and cost boundary

Per explicit user direction: **no second Supabase project, and nothing that adds cost in any form.**

- Deployed-environment probes (Preview, Production) are **read-only**. Never mutating.
  This is mandatory, not stylistic: Preview shares the production Supabase project and holds
  live-mode Stripe keys (research §4.1).
- All state-changing verification runs **locally against Docker Postgres**
  (`supabase/config.toml`, port 54322), matching the existing pre-migration workflow.
- The release analyzer runs **locally** as part of the release procedure, not as a CI job, so it
  consumes no CI minutes.
- No new always-on workflows. Phase 5 only *repairs* existing workflow logic; it adds no runs.

### D-C — Initial required probe set

Chosen from Paisaxe's own critical paths, constrained by D-B. See Phase 3.

### D-D — Evidence storage

`docs/release/evidence/<tree-hash>.yaml`, committed to the repo. Zero infrastructure, durable,
reviewable in git history. No artifact retention costs.

### D-E — Wave scope

Wave A only. This is a solo-maintainer, pre-traction site; the template explicitly states Wave A is
the floor and C–H are adopted by risk.

### D-F — Vacuous-pass holes

Fixed as part of Wave A (Phase 5). They directly violate template D03/D04 and would render the
analyzer's guarantees hollow.

---

## Phases

| # | Phase | Batch | Depends on | Status |
|---|---|---|---|---|
| 1 | Reconcile release instructions | `[batch-eligible]` | — | ✅ `2da0d09e` |
| 2 | Candidate identity: app self-identification + tree binding | `[batch-eligible]` | — | ✅ `4746d7f5` |
| 3 | Release-required probe set | — | 2 | ✅ `a57b5ca6` |
| 4 | Release analyzer (fail-closed) | — | 3 | ✅ `c40ede8d` |
| 5 | Close the vacuous-pass holes | `[batch-eligible]` | — | ✅ `d1a4e829` |
| 6 | Release procedure + delegation | — | 1, 4, 5 | ✅ `c9697861` |

Phases 1, 2, and 5 are mutually independent and may run in parallel worktrees.

### Deviations from the plan as written

- **Phase 2** — the plan called for an unconditional `build` object on `/api/health`. An existing
  security regression test (`src/app/api/health/route.test.ts:376`, SE-M1) deliberately
  allow-lists the public top-level fields and deny-lists version-like recon data, and the repo is
  private. On the user's decision, `build` is returned only to a caller presenting
  `Authorization: Bearer <CRON_SECRET>`; the public response shape is unchanged.
- **Phase 5** — un-skipping the 16 MCP probes surfaced a real defect (issue #744): `POST`
  `/api/mcp/places` and `/api/mcp/weather` checked their upstream API key before validating the
  request body, returning 500 where the matching `GET` handlers return 400. Fixed in the same
  phase.
- **Phase 6** — the dry-run rehearsal correctly **blocks**: production predates build-identity
  reporting, so no deployed tree can be established, and the mutating probe was not run (the local
  Docker stack was not started). The six deployed read-only probes passed against `paisaxe.es` and
  `check-migrations` validated 96 files. A passing end-to-end rehearsal is only possible after this
  work is itself released.

---

### Phase 1 — Reconcile release instructions `[batch-eligible]`

Template A1. Resolves the 10 contradictions in research §9.2. Documentation and agent-instruction
changes only; no runtime code.

**Safety-critical (do these first):**

1. `.claude/skills/deploy/SKILL.md` — currently 6 lines that create *and merge* a PR to `main` on
   green CI with no authorization gate. Rewrite to delegate to the release runbook and require
   explicit authorization, matching `CLAUDE.md:48-56`.
2. `.claude/commands/incident.md:64` — replace `vercel deploy --prod [deployment-url]` with
   `vercel rollback <id>`, matching `rollback.md:24-35` and `deployment-safety/SKILL.md:84-97`.
   The current command is what failed twice during the 2026-03-24 recovery.

**Correctness:**

3. `CLAUDE.md:113-117` — `gh pr merge --merge` cannot succeed (`allow_merge_commit: false`).
   Change to `--squash`. Do **not** adopt `release.md`'s `--auto`, which merges unattended and
   bypasses the "merge it" gate; `release.md:224-227` changes to plain `--squash`.
4. `CLAUDE.md:75` and `docs/operations/branch-protection.md:6` — replace job ids with the actual
   required contexts: `Lint & Typecheck`, `Test`, `Build`, `Playwright E2E`,
   `Smoke test Vercel preview`.
5. Six files hardcoding `pnpm` → `npm`: `.claude/commands/fix-ci.md:29`,
   `.claude/skills/{ci-workflow,deployment-safety,git-workflow,multi-agent,error-patterns}/SKILL.md`.
6. `operations.md:345` and `quality-agents.md:36,45,306` — `gitleaks.yml` does not exist; gitleaks
   is a job in `security.yml:17-34` on `0 8 * * *`.
7. `operations.md:344`, `README.md:220` — `security.yml` is daily, `--omit=dev
   --audit-level=moderate`, and has a third job `vercel-env-safety`.
8. `pre-launch-security-checklist.md:9-10` — either add the reference to `CLAUDE.md` Step 2 or drop
   the false claim. Prefer adding it; the six gates are real.
9. Stale counts: `README.md:107,205` 83→96 migrations; `README.md:207-208` 9→11 workflows;
   `quality-agents.md:33` 18→20 specs; `operations.md:33` test count → cite the source of truth
   rather than a frozen number; `operations.md:324` add the `madge --circular` step.
10. Link `docs/operations/rollback.md` from `operations.md` and from `CLAUDE.md:383-391`.

**Verification**: `npm run lint` passes; `grep -rn "pnpm" .claude/` returns only intentional
matches; every claimed count re-derived by command in the phase file.

---

### Phase 2 — Candidate identity `[batch-eligible]`

Template A4 step 4 ("verify the deployed identity"). Today nothing in the app reports what it was
built from (research §3.3).

1. Surface build identity in `src/app/api/health/route.ts`, additively — a `build` object carrying
   the commit SHA from `process.env.VERCEL_GIT_COMMIT_SHA` and the short tree hash if available.
   Must degrade to `"unknown"` locally rather than throwing. **The existing response shape must not
   change** — `/api/health` is monitored 24/7 by Upptime and `scripts/check-health-readiness.mjs`
   asserts `status === "healthy"`; adding a key is safe, renaming or removing one is not.
2. `scripts/release/candidate-identity.ts` — resolves and compares tree hashes:
   - `--tree <ref>` prints `git rev-parse <ref>^{tree}`
   - `--verify --expected <tree> --url <deployed-url>` fetches `/api/health`, reads the reported
     commit, resolves its tree, and exits non-zero on mismatch or on a missing/unknown identity.
3. Unit tests for the resolver, including the fail-closed path when the app reports no identity.

**Verification**: `npm run typecheck && npm run test`; script run against production returns the
real deployed commit; a deliberately wrong `--expected` exits non-zero.

---

### Phase 3 — Release-required probe set

Template A3. No requiredness metadata exists today (research §5.2), and Playwright's smallest
addressable unit is currently the spec file.

1. Introduce a `@release-required` tag in test titles plus a `release-required` Playwright project
   using `grep: /@release-required/`, so requiredness becomes selectable and machine-readable
   (template D05) without restructuring files.
2. `quality/required-probes.yaml` — the machine-readable manifest: probe id, owner, environment
   tier (`local-docker` | `deployed-readonly`), runner selector, expected oracles, safety class.
3. Initial required set, chosen by risk and constrained by D-B:

| Probe | Tier | Oracle |
|---|---|---|
| Deployed candidate identity matches expected tree | deployed-readonly | http |
| `/api/health` returns 200 + `status: healthy` | deployed-readonly | http |
| `/api/health/db` reachable and well-formed | deployed-readonly | http |
| Homepage renders and client JS executes (CSP canary) | deployed-readonly | ui |
| Story read path returns real content | deployed-readonly | http + ui |
| Admin route denies an unauthenticated caller | deployed-readonly | http |
| Webhook rejects an unsigned payload | deployed-readonly | http |
| Favorite create → datastore readback → cleanup | **local-docker** | ui + datastore + cleanup |
| Migration posture lint (`check-migrations`) | local | static |

Every probe must fail closed when its prerequisites are absent — the `mcp.spec.ts` pattern
(silently skipping on a missing env var) is explicitly forbidden; use the
`e2e/fixtures/auth.ts:139-143` throw-loudly pattern instead.

**Verification**: the `release-required` project selects exactly the manifest's probes; removing a
prerequisite makes the probe fail rather than skip.

---

### Phase 4 — Release analyzer

Template A2. `scripts/release/analyze-release-run.ts`, run locally.

Invariants, all of which MUST fail the run:

```
passed_count > 0                                    # D03 — zero-pass is never a pass
no required probe with status != passed             # D04 — required skip or fail blocks
candidate_tree == shipped_tree == deployed_tree     # D06 — identity
every required probe has its declared oracle evidence
every fixture record shows cleanup: removed
no unexpired exception covers a required probe      # quarantine cannot excuse
```

Consumes `quality/required-probes.yaml` plus an evidence manifest written to
`docs/release/evidence/<tree-hash>.yaml`.

**Regression tests are the deliverable here**, one per blocking case: zero passes; required skipped;
required failed but quarantined; candidate/deployment mismatch; missing oracle evidence; missing
cleanup evidence; expired exception. Plus one positive case that passes.

**Verification**: `npm run test` — all eight cases assert the expected exit code.

---

### Phase 5 — Close the vacuous-pass holes `[batch-eligible]`

Repairs only; adds no CI runs.

1. `preview-smoke.yml:98-105,118-125` — a **required** check exits 0 without probing on Dependabot
   PRs. Replace the silent pass with an explicit `skipped`-and-blocking outcome, or gate Dependabot
   PRs so the check is not claimed as passed. Requiredness must not be satisfiable without evidence.
2. `e2e-stripe-integration.yml:70-77` — can report success having run zero tests. Make a zero-test
   outcome fail, independent of the `require_live_gate` input.
3. `MCP_API_SECRET` — 16 of 31 `mcp.spec.ts` probes have never run in CI. Either supply the secret
   in `e2e.yml` or convert the skips to explicit fail-closed assertions. Do not leave them silent.

**Verification**: workflow logic exercised via `act` or by reasoning through each branch in the
phase file with the exact condition quoted; no new scheduled runs introduced.

---

### Phase 6 — Release procedure and delegation

Template D01/D02 and §8.

1. `docs/runbooks/release-checklist.md` — **≤200 lines**, the single procedural authority. Ordering
   per template A4: identify candidate → pre-deployment gates → merge/deploy → verify deployed
   identity → run required probes → analyze evidence → obtain authorization → **tag last**.
2. `CLAUDE.md`, `.claude/commands/release.md`, `.claude/skills/deploy/SKILL.md`, and
   `docs/operations/rollback.md` delegate to it rather than restating a divergent process.
3. `/release` gates on analyzer success: no tag without a passing evidence manifest for the shipped
   tree.

**Verification**: a full dry-run rehearsal against the current `develop` tree producing a real
evidence manifest, plus the deliberate blocking rehearsals from Phase 4.

---

## Deferred (with reasons)

| Wave | Status | Reason |
|---|---|---|
| B — exploratory charters | Deferred | No `/explore-release` command exists here. Valuable but not the floor; revisit after Wave A proves out. |
| C — capability registry | Deferred | 28 tables and 56 routes make this a large build; template says adopt by risk. |
| D — combination engine | Deferred | Depends on C. |
| E — plan compiler | Deferred | Depends on C. |
| F — vendor fidelity | Partially blocked | Real-seam probes cost money and Preview cannot host safe mutating tests (D-B). The existing Stripe test-mode path is retained as-is. |
| G — model-based tests | Deferred | Three unconstrained `text` status columns would need `CHECK` constraints first. |
| H — cadence/TTL | Deferred | No manual or hardware arcs exist today. |

## Out of scope but tracked

- Issue #734 (Anthropic credit exhaustion) is still open and affecting production chat.
- `Security Scan` is currently failing on `main`.
- `/api/mcp/make-booking/status` has no Twilio signature verification.
- `develop` has zero required status checks.

These are real, but none is release-verification plumbing. File separately.
