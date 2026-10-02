#!/usr/bin/env bash
# Paisaxe's scheduled update uses the canonical cc-rpi lifecycle launcher.
# The launcher owns quota preflight, Codex subscription fallback, validation,
# and one-attempt mutation safety. Keep this wrapper project-scoped.
set -euo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
CC_RPI_PATH=${CC_RPI_PATH:-/Users/juan/code/cc-rpi}
RPI_PROJECT_ROOT=$(cd -- "$SCRIPT_DIR/../.." && pwd -P)
RPI_UPDATE_ENABLED=1
RPI_HARNESS=both
RPI_ROUTE=direct
RPI_UPDATE_SKILL_DIR=${RPI_UPDATE_SKILL_DIR:-/Users/juan/.claude/skills/rpi-update}
RPI_UPDATE_CODEX_SKILL_DIR=${RPI_UPDATE_CODEX_SKILL_DIR:-/Users/juan/.agents/skills/rpi-update}
export CC_RPI_PATH RPI_PROJECT_ROOT RPI_UPDATE_ENABLED RPI_HARNESS RPI_ROUTE
export RPI_UPDATE_SKILL_DIR RPI_UPDATE_CODEX_SKILL_DIR

LAUNCHER="$CC_RPI_PATH/templates/scripts/cc-rpi-update-agent.sh"
if [[ ! -f "$LAUNCHER" ]]; then
  printf 'BLOCKED / WHY: canonical cc-rpi update launcher is missing: %s\n' "$LAUNCHER" >&2
  exit 1
fi
exec /bin/bash "$LAUNCHER"
