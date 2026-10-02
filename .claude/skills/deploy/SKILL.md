# Deploy to Production

**STOP. Production is live. This skill does not authorize itself.**

Releasing to production is a user-initiated process. Agents prepare; the user authorizes.
CI being green is necessary but **not** sufficient — it is not authorization.

The single procedural authority is `docs/runbooks/release-checklist.md`. Follow it. Do not
restate or improvise a different sequence here.

## What you may do without asking

- Run the full verification suite and report results.
- Determine the candidate and summarise what would be released (`git log main..develop --oneline`).
- Report CI status (`gh run list --branch develop`).

## What requires the user to say "do it" / "go ahead" / "merge it" in this conversation

Per `CLAUDE.md` Production Safety — none of these may be performed on your own initiative,
and authorization does **not** carry over from a previous conversation:

1. Creating a PR targeting `main`
2. Merging a PR into `main`
3. Pushing to `main`
4. Running production `vercel` deploy commands
5. Modifying production Supabase data, Vercel env vars, DNS, or external service config

"Fix this bug" is not authorization. "Ship it" about a feature means merge to `develop`, not `main`.

## Sequence

1. Prepare the release summary and present it. **Stop.**
2. On explicit authorization, create the release PR (`--base main --head develop`).
3. Report check status. **Stop.**
4. On explicit authorization to merge, `gh pr merge --merge`. Never squash a
   `develop` -> `main` release PR; feature PRs into `develop` may still squash.
5. Verify the deployed identity against the expected tree, then run the required probes.
6. **Tag last** — only after evidence is complete and authorization is recorded.

## If production is broken

Roll back first, investigate second. Use `vercel rollback <id>` — see
`docs/operations/rollback.md`. Never `vercel deploy --prod` to "fix forward" during an incident;
that triggers a fresh build and prolonged the 2026-03-24 outage twice.
