---
name: "Large Refactoring"
description: "Multi-agent refactoring workflow. Auto-triggered when a refactoring touches 5+ files."
---

# Large Refactoring (Agent Team)

**Trigger:** Auto-detected when a refactoring operation will touch 5+ files. Claude proposes using a team; proceeds only with user agreement.

Create a team called "refactor" with 4 sequential specialists:

### Phase 1 (Parallel)
1. **architect** — Plan the refactoring: define target architecture, sequence of changes, identify risks. Produces a step-by-step plan.
2. **dependency-analyst** — Map all imports/exports of affected modules, trace all consumers, list all tests that cover the affected code. Produces a dependency map.

### Phase 2 (Sequential, after Phase 1)
3. **implementer** — Execute the refactoring changes following the architect's plan. After each file change, run `npm run typecheck` to catch errors early. Does NOT run tests (that's the test-updater's job).

### Phase 3 (Sequential, after Phase 2)
4. **test-updater** — Update all affected tests based on the dependency analyst's map. Run `npm run test` after each test file update. Fix any failures. Run the full suite at the end.

### Final Verification
After all specialists complete, the lead runs:
```bash
npm run test && npm run typecheck && npm run lint
```

**Do NOT commit** — present the full diff to the user for review. The user decides whether to commit.
