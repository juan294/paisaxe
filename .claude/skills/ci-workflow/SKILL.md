---
name: "CI Workflow"
description: "Push accountability, CI monitoring after push, background agent CI verification, verification command sequencing."
---

# CI Workflow

## Push Accountability

Use the branch that is currently under CI verification. In a
`develop/main` topology this is often `develop`. In a `main-only` repo
it is usually the temporary branch or PR branch being validated before
merge.

Wrong -- push and move on:

```bash
git push origin <branch-under-test>
# Start next task immediately, never check CI
```

Right -- spawn background agent to monitor CI:

```bash
git push origin <branch-under-test>
# Background agent:
gh run list --branch <branch-under-test> --limit 1
# If CI fails: investigate with gh run view <id> --log-failed
# Fix and re-push. The push isn't done until CI is green.
```

## Verification Command Sequencing

Wrong -- run typecheck, lint, test as parallel tool calls:

```bash
# Parallel call 1: npm run typecheck
# Parallel call 2: npm run lint
# Parallel call 3: npm run test
# If one fails, all parallel calls are killed (Error #1)
```

Right -- chain sequentially with semicolons:

```bash
npm run typecheck 2>&1; npm run lint 2>&1; npm run test 2>&1
```

## Pre-Commit Verification

Wrong -- commit first, discover failures from pre-commit hook:

```bash
git commit -m "feat: add feature"
# Pre-commit hook fails: lint errors, type errors
```

Right -- run checks before committing:

```bash
npm run typecheck 2>&1; npm run lint 2>&1
git add <files> && git commit -m "feat: add feature"
```

## Config Change Blast Radius

Wrong -- change tsconfig and continue coding:

```bash
# Edit tsconfig.json
# Continue implementing next feature
# Discover 200 type errors at commit time
```

Right -- run full test suite immediately after config changes:

```bash
# Edit tsconfig.json
npm run typecheck 2>&1; npm run lint 2>&1; npm run test 2>&1
# Fix any breakage before proceeding
```
