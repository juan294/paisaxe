# Dependency Upgrade

Coordinate a major dependency upgrade with compatibility analysis, implementation, and testing.

## Usage
- `/upgrade-deps` — runs `npm outdated` and proposes candidates
- `/upgrade-deps next` — upgrades the `next` package specifically

## Instructions

### Step 1: Identify Upgrade Targets

If an argument is provided, focus on that specific package. Otherwise:
```bash
npm outdated --json
```

Present the list to the user and ask which packages to upgrade. Group by:
- **Major updates** (breaking changes likely)
- **Minor updates** (new features, usually safe)
- **Patch updates** (bug fixes, very safe)

### Step 2: Create Team

Create a team called "dep-upgrade" with 3 specialists running SEQUENTIALLY:

1. **compatibility-analyst** (subagent_type: general-purpose, runs FIRST)
   - Research breaking changes in the target version
   - Read changelogs (check CHANGELOG.md in node_modules or GitHub)
   - Check if the package's peer dependencies conflict with other installed packages
   - Identify files in the codebase that import/use the package
   - List specific breaking changes that affect this codebase
   - Produce a compatibility report with risk assessment (LOW/MEDIUM/HIGH)

2. **implementer** (subagent_type: general-purpose, runs SECOND, after compatibility-analyst)
   - Perform the upgrade: `npm install package@version`
   - Fix any TypeScript errors introduced by the upgrade
   - Update import paths if the package changed its API
   - Fix any breaking changes identified by the compatibility analyst
   - Run `npm run typecheck` to verify no type errors remain

3. **test-runner** (subagent_type: general-purpose, runs THIRD, after implementer)
   - Run `npm run test` — report any failures
   - Run `npm run lint` — report any new lint errors
   - Run `npm run build` — verify the build succeeds
   - If tests fail, report which tests and likely causes
   - Provide a pass/fail summary

### Step 3: Write Report

Write the final report to `docs/agents/upgrade-report.md`:

```
# Dependency Upgrade Report
> Generated on [date]

## Packages Upgraded
| Package | From | To | Risk |
|---------|------|-----|------|
| [name] | [old] | [new] | [LOW/MEDIUM/HIGH] |

## Breaking Changes Applied
- [List of changes made to accommodate the upgrade]

## Test Results
- Unit tests: [pass/fail count]
- Lint: [pass/fail]
- Build: [pass/fail]

## Remaining Issues
- [Any unresolved problems]
```

Present the report to the user. Do NOT commit — the user will review the changes and commit manually.
