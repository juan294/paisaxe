#!/usr/bin/env bash
set -euo pipefail

SCRIPT_ROOT=$(cd "$(dirname "$0")/../.." && pwd)
source "$SCRIPT_ROOT/scripts/lib/agent-utils.sh"
TEST_ROOT=$(mktemp -d)
trap 'rm -rf "$TEST_ROOT"' EXIT
PROJECT_DIR="$TEST_ROOT/project"
mkdir -p "$PROJECT_DIR/docs/agents"
REPORT_FILE="$PROJECT_DIR/docs/agents/check-report.md"
LOG_FILE="$PROJECT_DIR/agent.log"
CLAUDE_BIN="$TEST_ROOT/claude"
CODEX_BIN="$TEST_ROOT/codex"
export FAKE_REPORT_FILE="$REPORT_FILE" FAKE_CALLS="$TEST_ROOT/calls"
export CLAUDE_CODE_OAUTH_TOKEN=fixture ANTHROPIC_API_KEY=fixture OPENAI_API_KEY=fixture CODEX_API_KEY=fixture

cat > "$CLAUDE_BIN" <<'EOF'
#!/bin/bash
if [ -n "${ANTHROPIC_API_KEY:-}" ]; then exit 8; fi
case "$FAKE_CLAUDE_MODE" in
  quota) echo 'You have hit your weekly limit' >&2; exit 1 ;;
  quota_zero) echo 'You have hit your weekly limit'; exit 0 ;;
  auth) echo 'Failed to authenticate' >&2; exit 1 ;;
  error) echo 'unrelated provider failure' >&2; exit 1 ;;
  success) printf '# Check Report\n\nFresh Claude analysis.\n' > "$FAKE_REPORT_FILE" ;;
  wrongtitle) printf '# Other Title\n\nWrong heading.\n' > "$FAKE_REPORT_FILE" ;;
  nowrite) : ;;
  exit9) exit 9 ;;
esac
EOF
cat > "$CODEX_BIN" <<'EOF'
#!/bin/bash
if [ -n "${CLAUDE_CODE_OAUTH_TOKEN:-}" ] || [ -n "${ANTHROPIC_API_KEY:-}" ] || [ -n "${OPENAI_API_KEY:-}" ] || [ -n "${CODEX_API_KEY:-}" ]; then exit 7; fi
printf '%s\n' "$*" >> "$FAKE_CALLS"
while [ "$#" -gt 0 ]; do
  if [ "$1" = --output-last-message ]; then shift; output="$1"; fi
  shift
done
case "$FAKE_CODEX_MODE" in
  success) printf '# Check Report\n\nFresh Codex analysis.\n' > "$output" ;;
  empty) : > "$output" ;;
  error) printf '# Check Report\n' > "$output"; exit 1 ;;
esac
EOF
chmod +x "$CLAUDE_BIN" "$CODEX_BIN"

run_case() {
  printf '# Check Report\n\nOld report.\n' > "$REPORT_FILE"
  run_scheduled_analysis "$REPORT_FILE" "$LOG_FILE" '# Check Report' \
    sonnet 'Read,Glob,Grep' 'Analyze this fixture.' "${1:-0}"
}

export FAKE_CLAUDE_MODE=quota FAKE_CODEX_MODE=success
run_case
grep -q 'Fresh Codex analysis' "$REPORT_FILE"
grep -q -- '--sandbox workspace-write' "$FAKE_CALLS"
grep -q -- 'sandbox_workspace_write.network_access=true' "$FAKE_CALLS"

export FAKE_CODEX_MODE=empty
if run_case; then echo 'Empty Codex response was accepted' >&2; exit 1; fi
grep -q 'Old report' "$REPORT_FILE"

export FAKE_CLAUDE_MODE=quota_zero FAKE_CODEX_MODE=success
run_case
grep -q 'Fresh Codex analysis' "$REPORT_FILE"
run_case 1
grep -q 'Fresh Codex analysis' "$REPORT_FILE"

export FAKE_CODEX_MODE=error
if run_case; then echo 'Failed Codex response was accepted' >&2; exit 1; fi
grep -q 'Old report' "$REPORT_FILE"

export FAKE_CLAUDE_MODE=auth FAKE_CODEX_MODE=success
run_case
grep -q 'Fresh Codex analysis' "$REPORT_FILE"

export FAKE_CLAUDE_MODE=success FAKE_CODEX_MODE=error
run_case
grep -q 'Fresh Claude analysis' "$REPORT_FILE"

export FAKE_CLAUDE_MODE=error FAKE_CODEX_MODE=success
if run_case; then echo 'Unrelated Claude error fell back' >&2; exit 1; fi
grep -q 'Old report' "$REPORT_FILE"

# A rejection must say why and keep the rejected output for inspection.
REJECTED_FILE="${LOG_FILE%.log}.rejected.md"
ERR_FILE="$TEST_ROOT/err"

export FAKE_CLAUDE_MODE=wrongtitle FAKE_CODEX_MODE=success
rm -f "$REJECTED_FILE"
if run_case 2>"$ERR_FILE"; then echo 'Wrong-title report was accepted' >&2; exit 1; fi
grep -q 'Old report' "$REPORT_FILE" || { echo 'Old report not restored after wrong title' >&2; exit 1; }
grep -q "first line is '# Other Title'" "$ERR_FILE" || { echo 'Wrong-title reason missing' >&2; cat "$ERR_FILE" >&2; exit 1; }
grep -q 'Wrong heading' "$REJECTED_FILE" || { echo 'Rejected output not kept' >&2; exit 1; }

export FAKE_CLAUDE_MODE=nowrite
rm -f "$REJECTED_FILE"
if run_case 2>"$ERR_FILE"; then echo 'Unchanged report was accepted' >&2; exit 1; fi
grep -q 'report file unchanged' "$ERR_FILE" || { echo 'Unchanged reason missing' >&2; cat "$ERR_FILE" >&2; exit 1; }

export FAKE_CLAUDE_MODE=exit9
if run_case 2>"$ERR_FILE"; then echo 'Failed Claude run was accepted' >&2; exit 1; fi
grep -q 'Claude exited 9' "$ERR_FILE" || { echo 'Exit status reason missing' >&2; cat "$ERR_FILE" >&2; exit 1; }

echo 'agent-runtime tests passed'
