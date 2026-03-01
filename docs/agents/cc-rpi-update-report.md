# cc-rpi Sync Report

> Generated: 2026-03-01 | Blueprint: v1.3.0 (`23c0b72`)

## Summary

Synced from **v1.2.1** → **v1.3.0** (5 commits).

## Blueprint Changes (v1.2.1 → v1.3.0)

- `feat: integrate /simplify and /batch into RPI workflow`
- `docs: add errors #39-#43 — gh deprecation, venv bypass, Python escaping, module imports, JSON indexing`
- `fix: quote $(whoami) in shell templates to pass shellcheck SC2046`
- `docs: add post-adoption /pre-launch recommendation to /adopt command`

## Commands Updated

| Command | Status | Key Changes |
|---------|--------|-------------|
| `implement.md` | **Updated** | Added `/batch` eligibility check (step 4), `/simplify` code quality pass (step 5e), reviewer now focused on plan compliance |
| `plan.md` | **Updated** | Added step 11: identify `[batch-eligible]` phases for parallel execution |
| `validate.md` | **Updated** | Added step 5: recommend `/simplify` for code quality issues |
| `pre-launch.md` | **Updated** | Replaced project-specific version with generic template; added "After the Audit" section recommending `/simplify` as first fix action |

## CLAUDE.md Sections Updated

| Section | Status | Changes |
|---------|--------|---------|
| `### Rules for Implementation` | **Updated** | Added `/simplify` to atomic loop, `/batch` for batch-eligible phases, `/simplify` explanation |
| `## Push Accountability` | Skipped | Heavily customized with project-specific production safety rules |
| `## TDD Protocol` | Skipped | Heavily customized (titled "Test-Driven Development (MANDATORY)") |
| `## Agent Autonomy` | Skipped | Heavily customized with project-specific tool lists |
| `## Agent Operational Rules` | No change needed | Already matches template |
| `## Memory Management` | No change needed | Already matches template |

## settings.json Changes

No changes needed. Project already has equivalent permissions (`npm` instead of `pnpm`).

## Notable New Content

### New Error Patterns (#39-#43)
- **#39**: Always run `/simplify` after reviewer approval during `/implement`
- **#40**: Mark independent plan phases as `[batch-eligible]`
- **#41**: Use `/batch` for bulk changes outside the RPI cycle
- **#42**: After `/pre-launch` audit, run `/simplify` first
- **#43**: `gh` fails with "Projects (classic) deprecated" GraphQL error — upgrade with `brew upgrade gh`
- **#44**: Always use `uv run python` — never bare `python3`
- **#45**: Don't escape `!=` inside single-quoted shell strings
- **#46**: Use `python -m` for scripts with package-relative imports
- **#47**: Inspect JSON structure before indexing

### Key Theme: `/simplify` and `/batch` Integration
v1.3.0's main feature is integrating two new native commands into the RPI workflow:
- `/simplify` — automated code quality pass (reuse, quality, efficiency) that runs after plan-compliance review
- `/batch` — parallel execution of independent plan phases in separate worktrees

## Note on .claude/ Directory

The `.claude/` directory is gitignored in this project. Command files, sync metadata, and settings.json are updated locally but not tracked in git. Only `CLAUDE.md` changes are committed.
