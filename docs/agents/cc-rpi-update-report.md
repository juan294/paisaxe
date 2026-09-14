## cc-rpi sync report

**Status:** Cannot proceed — invocation controls prevent scheduled execution.

**Situation:**
- **Paisaxe current sync:** v1.29.0 (last synced 2026-09-03)
- **Blueprint current version:** v2.0.2
- **Version gap:** Major upgrade available (v1.29.0 → v2.0.2)

**Issue:**
The `/rpi-update` workflow (the new, recommended sync mechanism) has `disable-model-invocation: true`, which prevents scheduled agents from executing it. This is an intentional security control — the skill is reserved for explicit user invocation only.

**Next steps:**
Run `/rpi-update` in an interactive session to sync paisaxe to the latest blueprint.
