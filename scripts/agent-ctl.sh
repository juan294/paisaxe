#!/usr/bin/env bash
# agent-ctl.sh — CLI tool for managing local agent feature flags
# Usage: scripts/agent-ctl.sh <command> [args]
#
# Commands:
#   status                  Show current agent config
#   enable  <key|all>       Enable an agent (or all agents)
#   disable <key|all>       Disable an agent (or all agents)
#   master  on|off          Toggle the master switch
#   reset                   Reset config to defaults
#   init                    Create config from defaults if missing

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/agent-config.json"
DEFAULTS_FILE="$SCRIPT_DIR/agent-config.defaults.json"

# Colors (disabled if not in terminal)
if [[ -t 1 ]]; then
  GREEN='\033[0;32m'
  RED='\033[0;31m'
  YELLOW='\033[0;33m'
  BLUE='\033[0;34m'
  NC='\033[0m'
else
  GREEN='' RED='' YELLOW='' BLUE='' NC=''
fi

die() { echo -e "${RED}Error:${NC} $*" >&2; exit 1; }

ensure_jq() {
  command -v jq &>/dev/null || die "jq is required. Install with: brew install jq"
}

# Create config from defaults if it doesn't exist
init_config() {
  if [[ ! -f "$CONFIG_FILE" ]]; then
    if [[ ! -f "$DEFAULTS_FILE" ]]; then
      die "Defaults file not found: $DEFAULTS_FILE"
    fi
    cp "$DEFAULTS_FILE" "$CONFIG_FILE"
    echo -e "${GREEN}Created${NC} $CONFIG_FILE from defaults"
  else
    echo -e "${YELLOW}Config already exists:${NC} $CONFIG_FILE"
  fi
}

# Ensure config exists, auto-create from defaults if missing
ensure_config() {
  if [[ ! -f "$CONFIG_FILE" ]]; then
    if [[ ! -f "$DEFAULTS_FILE" ]]; then
      die "No config or defaults file found. Run: scripts/agent-ctl.sh init"
    fi
    cp "$DEFAULTS_FILE" "$CONFIG_FILE"
    echo -e "${YELLOW}Auto-created${NC} config from defaults" >&2
  fi
}

cmd_status() {
  ensure_jq
  ensure_config

  local master
  master=$(jq -r '.master_enabled' "$CONFIG_FILE")

  if [[ "$master" == "true" ]]; then
    echo -e "${GREEN}Master toggle: ON${NC}"
  else
    echo -e "${RED}Master toggle: OFF${NC} (all agents disabled)"
  fi

  echo ""
  printf "%-38s %s\n" "Agent" "Status"
  printf "%-38s %s\n" "------" "------"

  jq -r '.agents | to_entries[] | "\(.key) \(.value.enabled)"' "$CONFIG_FILE" | while read -r key enabled; do
    if [[ "$enabled" == "true" ]]; then
      printf "  %-36s ${GREEN}enabled${NC}\n" "$key"
    else
      printf "  %-36s ${RED}disabled${NC}\n" "$key"
    fi
  done
}

cmd_enable() {
  ensure_jq
  ensure_config
  local key="${1:-}"
  [[ -z "$key" ]] && die "Usage: agent-ctl.sh enable <key|all>"

  if [[ "$key" == "all" ]]; then
    jq '.agents |= with_entries(.value.enabled = true)' "$CONFIG_FILE" > "$CONFIG_FILE.tmp" && mv "$CONFIG_FILE.tmp" "$CONFIG_FILE"
    echo -e "${GREEN}All agents enabled${NC}"
  else
    # Verify key exists
    if ! jq -e ".agents[\"$key\"]" "$CONFIG_FILE" >/dev/null 2>&1; then
      die "Unknown agent key: $key"
    fi
    jq --arg k "$key" '.agents[$k].enabled = true' "$CONFIG_FILE" > "$CONFIG_FILE.tmp" && mv "$CONFIG_FILE.tmp" "$CONFIG_FILE"
    echo -e "${GREEN}Enabled:${NC} $key"
  fi
}

cmd_disable() {
  ensure_jq
  ensure_config
  local key="${1:-}"
  [[ -z "$key" ]] && die "Usage: agent-ctl.sh disable <key|all>"

  if [[ "$key" == "all" ]]; then
    jq '.agents |= with_entries(.value.enabled = false)' "$CONFIG_FILE" > "$CONFIG_FILE.tmp" && mv "$CONFIG_FILE.tmp" "$CONFIG_FILE"
    echo -e "${RED}All agents disabled${NC}"
  else
    if ! jq -e ".agents[\"$key\"]" "$CONFIG_FILE" >/dev/null 2>&1; then
      die "Unknown agent key: $key"
    fi
    jq --arg k "$key" '.agents[$k].enabled = false' "$CONFIG_FILE" > "$CONFIG_FILE.tmp" && mv "$CONFIG_FILE.tmp" "$CONFIG_FILE"
    echo -e "${RED}Disabled:${NC} $key"
  fi
}

cmd_master() {
  ensure_jq
  ensure_config
  local state="${1:-}"

  case "$state" in
    on)
      jq '.master_enabled = true' "$CONFIG_FILE" > "$CONFIG_FILE.tmp" && mv "$CONFIG_FILE.tmp" "$CONFIG_FILE"
      echo -e "${GREEN}Master toggle: ON${NC}"
      ;;
    off)
      jq '.master_enabled = false' "$CONFIG_FILE" > "$CONFIG_FILE.tmp" && mv "$CONFIG_FILE.tmp" "$CONFIG_FILE"
      echo -e "${RED}Master toggle: OFF${NC}"
      ;;
    *)
      die "Usage: agent-ctl.sh master on|off"
      ;;
  esac
}

cmd_reset() {
  ensure_jq
  if [[ ! -f "$DEFAULTS_FILE" ]]; then
    die "Defaults file not found: $DEFAULTS_FILE"
  fi
  cp "$DEFAULTS_FILE" "$CONFIG_FILE"
  echo -e "${GREEN}Config reset to defaults${NC}"
}

# Main
case "${1:-}" in
  status)  cmd_status ;;
  enable)  cmd_enable "${2:-}" ;;
  disable) cmd_disable "${2:-}" ;;
  master)  cmd_master "${2:-}" ;;
  reset)   cmd_reset ;;
  init)    init_config ;;
  *)
    echo "Usage: agent-ctl.sh <command> [args]"
    echo ""
    echo "Commands:"
    echo "  status                Show current agent config"
    echo "  enable  <key|all>     Enable an agent (or all agents)"
    echo "  disable <key|all>     Disable an agent (or all agents)"
    echo "  master  on|off        Toggle the master switch"
    echo "  reset                 Reset config to defaults"
    echo "  init                  Create config from defaults if missing"
    exit 1
    ;;
esac
