#!/bin/bash
# scripts/agents/cc-rpi-update.sh
#
# Scheduled agent that syncs this project with the latest cc-rpi blueprint.
# Designed to run nightly via launchd (macOS) or cron (Linux).
#
# The key trick: this script reads the update instructions from cc-rpi itself
# at runtime. When cc-rpi improves the /update command, all projects
# automatically get the new logic on the next scheduled run.

set -euo pipefail

# ── Configuration ──
CC_RPI_PATH="/Users/juan/code/cc-rpi"

# ── Environment setup (required for launchd) ──
# launchd provides a minimal environment — no PATH, no TERM, possibly no HOME.
# These lines are no-ops in a normal terminal but critical under launchd.
# Do NOT use `source ~/.zshrc` — too fragile for non-interactive shells.
export HOME="${HOME:-$(eval echo ~$(whoami))}"
export TERM="${TERM:-xterm-256color}"
export PATH="/usr/local/bin:/opt/homebrew/bin:$HOME/.local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

CLAUDE_BIN="${CLAUDE_BIN:-$HOME/.local/bin/claude}"
AGENT_NAME="cc-rpi-update"
REPORT_FILE="docs/agents/${AGENT_NAME}-report.md"
UPDATE_INSTRUCTIONS="$CC_RPI_PATH/templates/commands/update.md"

# ── File descriptor check ──
# launchd enforces a hard limit of 256 file descriptors by default.
# Claude CLI needs 100K+ for its Node.js runtime. The plist must set
# HardResourceLimits/SoftResourceLimits — ulimit alone can't exceed
# the hard limit. This check catches a missing plist configuration.
ulimit -n 122880 2>/dev/null
FD_LIMIT=$(ulimit -n)
if [ "$FD_LIMIT" -lt 10000 ]; then
  echo "[$(date)] FATAL: File descriptor limit too low ($FD_LIMIT)."
  echo "  launchd hard limit is 256 by default — ulimit can't raise above it."
  echo "  Fix: Add HardResourceLimits + SoftResourceLimits to your .plist:"
  echo "    <key>HardResourceLimits</key>"
  echo "    <dict><key>NumberOfFiles</key><integer>122880</integer></dict>"
  echo "    <key>SoftResourceLimits</key>"
  echo "    <dict><key>NumberOfFiles</key><integer>122880</integer></dict>"
  echo "  Then: launchctl unload + load the plist to apply."
  exit 1
fi

# ── Preflight checks ──

if [ ! -d "$CC_RPI_PATH" ]; then
  echo "[$(date)] ERROR: cc-rpi not found at $CC_RPI_PATH"
  exit 1
fi

if [ ! -f "$UPDATE_INSTRUCTIONS" ]; then
  echo "[$(date)] ERROR: Update command not found at $UPDATE_INSTRUCTIONS"
  exit 1
fi

if [ ! -x "$CLAUDE_BIN" ]; then
  echo "[$(date)] ERROR: claude binary not found at $CLAUDE_BIN"
  echo "[$(date)] Set CLAUDE_BIN in this script or export it as an env var."
  echo "[$(date)] Common locations: \$HOME/.local/bin/claude, /usr/local/bin/claude"
  exit 1
fi

# ── Authentication preflight ──
# Under launchd, there's no TTY and no browser for OAuth.
# Claude must be set up with a persistent token via `claude setup-token`.
if ! "$CLAUDE_BIN" -p "echo ok" --output-format text >/dev/null 2>&1; then
  echo "[$(date)] FATAL: Claude CLI auth failed in non-interactive mode."
  echo "  launchd has no TTY/browser — interactive OAuth won't work."
  echo "  Fix: Run 'claude setup-token' from an interactive terminal first."
  exit 1
fi

# ── Build the prompt ──
# The agent reads the update instructions from cc-rpi at runtime.
# This means when cc-rpi updates the /update command, this script
# automatically uses the new logic without any changes needed here.

PROMPT="You are the cc-rpi-update scheduled agent for this project.

Your job: sync this project with the latest cc-rpi blueprint.

Read and follow the instructions in: $UPDATE_INSTRUCTIONS

Important context:
- The cc-rpi blueprint is at: $CC_RPI_PATH
- This project is at: $PROJECT_ROOT
- Apply all updates non-interactively. Do not ask for confirmation.
- Commit changes when done.
- Write your final summary as your text output (it becomes the report).

If there are no changes needed, just output: 'cc-rpi sync: already up to date as of <version>.'"

# ── Run with retry ──

MAX_RETRIES=2
RETRY_COUNT=0

cd "$PROJECT_ROOT"
echo "[$(date)] Starting $AGENT_NAME agent..."
echo "[$(date)] Project: $PROJECT_ROOT"
echo "[$(date)] Blueprint: $CC_RPI_PATH"

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  if "$CLAUDE_BIN" -p "$PROMPT" \
    --allowedTools "Read,Write,Edit,Glob,Grep,Bash(git *)" \
    --output-format text \
    > "$REPORT_FILE" 2>&1; then
    echo "[$(date)] $AGENT_NAME complete. Report: $REPORT_FILE"
    exit 0
  fi
  RETRY_COUNT=$((RETRY_COUNT + 1))
  echo "[$(date)] Attempt $RETRY_COUNT failed. Retrying in 10s..."
  sleep 10
done

echo "[$(date)] $AGENT_NAME FAILED after $MAX_RETRIES attempts" | tee -a "$REPORT_FILE"
exit 1
