# Release evidence

One file per release candidate, named for its **tree hash**: `<candidate-tree>.yaml`.

Evidence is committed to the repo deliberately — zero infrastructure, durable, reviewable in git
history, no artifact retention cost. `scripts/release/analyze-release-run.ts` reads these files
and decides whether a release may proceed; see `docs/runbooks/release-checklist.md` step 6.

The manifest records what actually happened. It is not a plan or an intention: writing `passed`
for a probe that did not run is the failure mode this whole mechanism exists to prevent.

## Shape

```yaml
version: 1

# All three must be present and identical, or the release is blocked (D06).
candidate_tree: <40-hex>   # git rev-parse <tested-ref>^{tree}
shipped_tree:   <40-hex>   # git rev-parse origin/main^{tree}
deployed_tree:  <40-hex>   # tree of the commit the deployment reports
deployed_commit: <40-hex>  # what /api/health reported
target_url: https://paisaxe.es
generated_at: "2026-07-28T20:00:00Z"

probes:
  - id: health-status        # must match an id in quality/required-probes.yaml
    status: passed           # passed | failed | skipped — skipped blocks, like failed
    oracles: [http]          # evidence actually collected; must cover what the probe declared
  - id: favorite-roundtrip
    status: passed
    oracles: [ui, datastore, cleanup]
    cleanup: removed         # required whenever the probe declares the cleanup oracle

# Optional. An exception NEVER excuses a required probe, and an expired one blocks
# outright — remove it rather than shipping with it.
exceptions:
  - probe: some-optional-probe
    reason: "why this is tolerated"
    expires: 2026-12-31
```

## Blocking conditions

The analyzer fails the release when any of these hold:

- no probe passed (a run that verified nothing is not a green run)
- a required probe is `failed`, `skipped`, or absent from the manifest
- `candidate_tree`, `shipped_tree` and `deployed_tree` are not all present and equal
- a required probe reports no evidence for an oracle it declared
- a probe declaring the `cleanup` oracle does not show `cleanup: removed`
- an exception covers a required probe, or any exception has expired
