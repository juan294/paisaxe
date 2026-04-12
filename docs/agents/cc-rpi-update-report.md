File writes are being blocked in this session. Let me report the findings without making further modification attempts.

---

## cc-rpi sync: update needed but write permissions blocked

**Blueprint version:** v1.15.0 (commit `7ef063d`)
**Previous sync:** v1.14.5 (commit `9e20d4d`, 2026-04-08)

### What changed in cc-rpi since last sync

3 commits landed in v1.15.0:
- `bd54a13` feat: pre-launch deep-audit restructure — 8 specialists, 16 sections, 3-wave remediation
- `f2ab57c` fix: simplify pass on pre-launch and remediate commands
- `7ef063d` release: v1.15.0

**Template files changed:**
- `templates/commands/pre-launch.md` — major restructure
- `templates/commands/remediate.md` — 3-wave structure added

### Updates required (could not apply — write permissions blocked)

**`.claude/commands/pre-launch.md`** — needs full replacement:
- 6 specialists → 8 specialists (adds Staff Frontend, Staff Backend, splits architect/ux)
- Simple 6-section report → 16-section deep-dive with Finding IDs (format: `SE-B1`, `UX-M3`, etc.)
- Opus model tier specified (`model: "opus"` for all specialists)
- System-map-first preamble per specialist
- 3-wave remediation handoff via Section 14 index
- Rule #73 (only QA runs full test suite) made explicit
- Evidence/inference labeling added to finding format

**`.claude/commands/remediate.md`** — needs full replacement:
- Single-wave → 3-wave structure (Wave 1: Before launch, Wave 2: After launch, Wave 3: Later/strategic)
- Wave 3 exception: low/strategic findings get GitHub issues filed but no fix agents
- 16-section report parser contract added (finding ID regex: `(AR|FE|BE|PE|DO|SE|QA|UX)-(B|H|M|L|S)[0-9]+`)
- Per-wave cleanup (remove worktrees + branches after each wave, not just at end)
- `wave=N` argument to resume at a specific wave
- Wave 3 "file-only" path explicit (no worktree agents for Later/strategic)

**No other changes needed:**
- Skills: unchanged since last sync
- Rules: unchanged since last sync
- CLAUDE.md: unchanged since last sync
- `settings.json`: unchanged since last sync

### To apply manually

```bash
# Replace pre-launch.md
cp /Users/juan/code/cc-rpi/templates/commands/pre-launch.md \
   /Users/juan/code/paisaxe/.claude/commands/pre-launch.md

# Replace remediate.md
cp /Users/juan/code/cc-rpi/templates/commands/remediate.md \
   /Users/juan/code/paisaxe/.claude/commands/remediate.md

# Update sync metadata
cat > /Users/juan/code/paisaxe/.claude/cc-rpi-sync.json <<'EOF'
{
  "lastSyncCommit": "7ef063d48008b473f7ffcc5868cef3916d474ee9",
  "lastSyncDate": "2026-04-12",
  "blueprintVersion": "v1.15.0",
  "rulesSynced": [
    "rpi-details.md",
    "push-accountability.md",
    "testing.md",
    "deployment-safety.md",
    "supabase.md"
  ],
  "rulesCustom": []
}
EOF

# Commit
cd /Users/juan/code/paisaxe
git add .claude/commands/pre-launch.md .claude/commands/remediate.md .claude/cc-rpi-sync.json
git commit -m "chore: sync with cc-rpi blueprint v1.15.0"
```
