# Phase 1 — Canonical agents, tools, and clean test baseline `[batch-eligible]`

**Depends on:** nothing
**Worktree:** isolated from `origin/develop`; preserve current report-file edits.

## Outcome

Paisaxe holds exact server-normalized configs for five agents, one authoritative tool registry, current branch/version IDs, and a zero-hard-failure baseline.

## Steps

1. GET all five Main configs, traffic, tests/evaluators, auth/privacy, webhooks, knowledge, and attached tools. Save secret-redacted rollback snapshots.
2. Targeted-pull each agent individually and merge normalized state; never use `agents pull --all`.
3. Update `agents.json:4-25` with current branch/version IDs.
4. Reconcile Pelayo Visitor tools:
   - GET weather/place/booking tool IDs and safe auth-header names;
   - test the `save_favorite` endpoint and authorization contract;
   - create/push its remote tool only after authorization;
   - attach it only after readback proves the intended schema;
   - remove obsolete/tunnel tools from writable registry without deleting account objects in this phase.
5. Replace broad operational scripts at `package.json:55-62` with per-agent `status`, `push:dry`, and explicit branch/version arguments.
6. Update `docs/operations/elevenlabs-agents-as-code.md`.
7. Reconcile the 47 test IDs, extend `scripts/run-paisaxe-tests.py` with `--agent`, `--branch`, and `--repeat-count`, and keep billed runs outside CI.
8. Run:

   ```bash
   python3 scripts/run-paisaxe-tests.py
   python3 scripts/run-paisaxe-tests.py --section 9
   python3 scripts/run-paisaxe-tests.py --section 11
   ```

9. Resolve existing language and booking-integrity hard failures before Phase 2. Modernization does not redefine a failing baseline as acceptable.

## Automated success criteria

- Five manifests and tool attachments equal live readback.
- Scoped dry run selects one agent.
- `save_favorite` is either fully registered/contract-tested or absent from both prompt and config; no half-attached state.
- 47/47 tests pass with zero failures in security/booking sections.
- JSON, test, typecheck, and lint gates pass.

## Manual success criteria

- Existing Spanish/English Pelayo audio, weather/place lookup, booking initiation, callback/SMS, and admin social-agent sessions have recorded baselines.

## Rollback

Repository revert only; no live agent mutation is required except separately authorized tool creation/attachment, which rolls back by restoring the captured tool list as a new version.
