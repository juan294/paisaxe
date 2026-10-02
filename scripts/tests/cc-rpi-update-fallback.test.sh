#!/usr/bin/env bash
set -euo pipefail

SOURCE_ROOT=$(cd "$(dirname "$0")/../.." && pwd)
TEST_ROOT=$(mktemp -d)
trap 'rm -rf "$TEST_ROOT"' EXIT
PROJECT_ROOT="$TEST_ROOT/project"
mkdir -p "$PROJECT_ROOT/scripts/agents" "$PROJECT_ROOT/docs/agents" "$TEST_ROOT/cc-rpi/templates/scripts"
cp "$SOURCE_ROOT/scripts/agents/cc-rpi-update.sh" "$PROJECT_ROOT/scripts/agents/cc-rpi-update.sh"
REPORT_FILE="$PROJECT_ROOT/docs/agents/cc-rpi-update-report.md"
LAUNCHER="$TEST_ROOT/cc-rpi/templates/scripts/cc-rpi-update-agent.sh"
export CC_RPI_PATH="$TEST_ROOT/cc-rpi" FAKE_CALLS="$TEST_ROOT/calls"

cat > "$LAUNCHER" <<'LAUNCHER_EOF'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$RPI_UPDATE_ENABLED|$CC_RPI_PATH|$RPI_PROJECT_ROOT|$RPI_HARNESS|$RPI_ROUTE|$RPI_UPDATE_SKILL_DIR|$RPI_UPDATE_CODEX_SKILL_DIR" >> "$FAKE_CALLS"
[[ $RPI_UPDATE_ENABLED == 1 && $RPI_HARNESS == both && $RPI_ROUTE == direct ]]
[[ $CC_RPI_PATH == /* && $RPI_PROJECT_ROOT == /* ]]
[[ $RPI_UPDATE_SKILL_DIR == /* && $RPI_UPDATE_CODEX_SKILL_DIR == /* ]]
[[ $FAKE_LAUNCH_MODE == success ]]
LAUNCHER_EOF
chmod +x "$LAUNCHER"

run_case() {
  printf 'previous valid report\n' > "$REPORT_FILE"
  bash "$PROJECT_ROOT/scripts/agents/cc-rpi-update.sh" > "$TEST_ROOT/run.log" 2>&1
}

export FAKE_LAUNCH_MODE=success
run_case
[ "$(wc -l < "$FAKE_CALLS")" -eq 1 ]
grep -Fq "|$(cd "$PROJECT_ROOT" && pwd -P)|both|direct|" "$FAKE_CALLS"
grep -q 'previous valid report' "$REPORT_FILE"

export FAKE_LAUNCH_MODE=fail
if run_case; then echo 'failed launcher accepted' >&2; exit 1; fi
[ "$(wc -l < "$FAKE_CALLS")" -eq 2 ] || { echo 'failed launcher retried' >&2; exit 1; }
grep -q 'previous valid report' "$REPORT_FILE"

mv "$LAUNCHER" "$LAUNCHER.disabled"
if run_case; then echo 'missing canonical launcher accepted' >&2; exit 1; fi
[ "$(wc -l < "$FAKE_CALLS")" -eq 2 ]
grep -q 'previous valid report' "$REPORT_FILE"

echo 'cc-rpi updater delegation tests passed'
