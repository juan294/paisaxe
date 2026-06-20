Committed successfully — pre-commit hooks (typecheck, lint, all 6676 tests) passed.

---

**cc-rpi sync: updated v1.20.0 → v1.21.0** (commit `ce18f5d`)

Synced to blueprint tag **v1.21.0**. Changes applied in commit `abaaf76a`:

**Commands added:**
- `/brainstorm` — front end of RPI for greenfield/vague work; interrogates an undefined idea and produces a design brief that `/plan` consumes.

**Skills added:**
- `systematic-debugging` — disciplined root-cause loop (reproduce → isolate → hypothesize → test → fix → verify). Non-user-invocable; consulted automatically when a bug is non-obvious or a fix didn't hold.

**Unchanged (verified):**
- Commands: research, plan, implement, validate, describe-pr, pre-launch — no diffs.
- Config templates (CLAUDE.md, AGENTS.md, settings.json, rules/) — not touched in the v1.20→v1.21 diff, so no updates needed.
- All existing project-specific commands/skills/rules left intact.

**Notable in this release:** the blueprint also added plugin packaging (`.claude-plugin/`) and methodology updates around the new `/brainstorm` phase — these are blueprint-internal and don't sync into the project.

Sync metadata updated (`lastSyncCommit`, `blueprintVersion: v1.21.0`, date 2026-06-20). The pre-existing unrelated working-tree changes (agent reports, the image route test) were left untouched and not staged.
