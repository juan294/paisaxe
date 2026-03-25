Commit succeeded. All 303 test files (5605 tests) passed. Now let me write the report.

## cc-rpi sync report — 2026-03-24

**Blueprint version:** v1.10.0 (commit `4df170e`)
**Previous sync:** 2026-03-21 (commit `7909f35`)
**Status:** Metadata-only sync — no project file changes needed.

### What changed in cc-rpi

One commit since last sync:
- `4df170e` — `feat: errors #54-55, rules #60-61 — git conflict resolution patterns`

**New error patterns (internalized, not templated):**
- **Error #54**: Run the full test suite after config or infrastructure changes — config changes have broader blast radius than code changes
- **Error #55**: Only the main agent pushes — worktree agents commit locally to avoid N×M CI runs

**New rules (internalized, not templated):**
- **Rule #60**: `git checkout --` doesn't work on unmerged files — use `--ours`/`--theirs` or abort
- **Rule #61**: Remove conflicting untracked files before `git merge` — common in multi-agent workflows

### Changes applied

| Area | Changes |
|------|---------|
| Commands | None — no template changes |
| CLAUDE.md | None — template unchanged |
| settings.json | None — template unchanged |
| Sync metadata | Updated `lastSyncCommit` to `4df170e`, date to `2026-03-24` |

### Notable

The new patterns (#54-55, #60-61) are reference knowledge in `patterns/quick-reference.md` and `patterns/agent-errors.md`. They are not reflected in the CLAUDE.md template sections, so no project file updates were required. These patterns are now internalized for this session.
