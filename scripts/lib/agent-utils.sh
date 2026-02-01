#!/usr/bin/env bash
# Agent Utilities — Shared functions for automated agents
# Provides feature flag checking, logging, and agent startup logic

set -euo pipefail

# Colors for logging (disabled if not in terminal)
if [[ -t 1 ]]; then
  RED='\033[0;31m'
  GREEN='\033[0;32m'
  YELLOW='\033[0;33m'
  BLUE='\033[0;34m'
  NC='\033[0m' # No Color
else
  RED=''
  GREEN=''
  YELLOW=''
  BLUE=''
  NC=''
fi

# Logging functions
log_info() {
  echo -e "${BLUE}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') $*"
}

log_success() {
  echo -e "${GREEN}[SUCCESS]${NC} $(date '+%Y-%m-%d %H:%M:%S') $*"
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $(date '+%Y-%m-%d %H:%M:%S') $*"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') $*" >&2
}

# Configuration
# Auto-detect local dev server for development testing
# Falls back to production if localhost is not running
if [[ -z "${FEATURE_FLAGS_URL:-}" ]]; then
  if curl -s --max-time 2 "http://localhost:3000/api/health" >/dev/null 2>&1; then
    FEATURE_FLAGS_URL="http://localhost:3000/api/feature-flags"
    log_info "Using local dev server for feature flags"
  else
    FEATURE_FLAGS_URL="https://paisaxe.es/api/feature-flags"
  fi
fi

# Check if a feature flag is enabled
# Usage: check_feature_flag "flag_key"
# Returns: 0 if enabled, 1 if disabled or error
check_feature_flag() {
  local flag_key="$1"
  local response
  local enabled

  # Fetch feature flags from API
  response=$(curl -s --max-time 10 "$FEATURE_FLAGS_URL" 2>/dev/null) || {
    log_error "Failed to fetch feature flags from $FEATURE_FLAGS_URL"
    return 1
  }

  # Check if jq is available
  if ! command -v jq &>/dev/null; then
    log_error "jq is required but not installed. Install with: brew install jq"
    return 1
  fi

  # Parse the response and check if flag is enabled (API returns camelCase flagKey)
  enabled=$(echo "$response" | jq -r --arg key "$flag_key" '.data[] | select(.flagKey == $key) | .enabled' 2>/dev/null | head -1) || {
    log_error "Failed to parse feature flags response"
    return 1
  }

  if [[ "$enabled" == "true" ]]; then
    return 0
  elif [[ "$enabled" == "false" ]]; then
    return 1
  else
    log_warn "Flag '$flag_key' not found in feature flags"
    return 1
  fi
}

# Check if an agent is enabled (checks both master toggle and individual flag)
# Usage: check_agent_enabled "agent_flag_key"
# Returns: 0 if both enabled, 1 if either disabled
check_agent_enabled() {
  local agent_flag="$1"

  # Check master toggle first
  if ! check_feature_flag "automated_agents"; then
    log_info "Master toggle 'automated_agents' is disabled — all agents are off"
    return 1
  fi

  # Check individual agent flag
  if ! check_feature_flag "$agent_flag"; then
    log_info "Agent flag '$agent_flag' is disabled"
    return 1
  fi

  return 0
}

# Standard agent startup sequence
# Usage: agent_startup "Agent Name" "agent_flag_key"
# Returns 0 if agent should run, returns 1 if disabled
# IMPORTANT: Caller must check return value and exit if needed
agent_startup() {
  local agent_name="$1"
  local agent_flag="$2"

  log_info "=== $agent_name starting ==="
  log_info "Checking feature flags..."

  if ! check_agent_enabled "$agent_flag"; then
    log_info "=== $agent_name disabled by feature flag — exiting gracefully ==="
    return 1
  fi

  log_success "Feature flags enabled — proceeding with $agent_name"
  return 0
}

# Ensure project directory exists and cd to it
# Usage: ensure_project_dir "/path/to/project"
ensure_project_dir() {
  local project_dir="$1"

  if [[ ! -d "$project_dir" ]]; then
    log_error "Project directory not found: $project_dir"
    exit 1
  fi

  cd "$project_dir"
  log_info "Working directory: $project_dir"
}

# Create log directory if it doesn't exist
# Usage: ensure_log_dir "/path/to/logs"
ensure_log_dir() {
  local log_dir="$1"
  mkdir -p "$log_dir"
}

# Write report header to a file
# Usage: write_report_header "Report Title" "/path/to/report.md"
write_report_header() {
  local title="$1"
  local output_file="$2"
  local date_str
  date_str=$(date '+%Y-%m-%d %H:%M:%S')

  cat > "$output_file" << EOF
# $title
> Auto-generated on $date_str

EOF
}

# Get the prompt for an agent from its feature flag config
# Usage: get_agent_prompt "agent_flag_key"
# Outputs: The prompt string, or empty if not found
get_agent_prompt() {
  local agent_flag="$1"
  local response
  local prompt

  # Fetch feature flags from API
  response=$(curl -s --max-time 10 "$FEATURE_FLAGS_URL" 2>/dev/null)
  if [[ -z "$response" ]]; then
    log_error "Failed to fetch feature flags from $FEATURE_FLAGS_URL" >&2
    return 1
  fi

  # Parse the response using Python (more reliable with multiline strings)
  # Falls back to jq if Python is not available
  if command -v python3 &>/dev/null; then
    prompt=$(AGENT_FLAG="$agent_flag" python3 -c "
import sys, json, os
flag_key = os.environ.get('AGENT_FLAG', '')
try:
    data = json.load(sys.stdin)
    for flag in data.get('data', []):
        if flag.get('flagKey') == flag_key:
            config = flag.get('config', {})
            prompt = config.get('prompt', '')
            if prompt:
                print(prompt)
                break
except Exception as e:
    pass
" <<< "$response" 2>/dev/null)
  elif command -v jq &>/dev/null; then
    prompt=$(echo "$response" | jq -r --arg key "$agent_flag" '.data[] | select(.flagKey == $key) | .config.prompt // empty' 2>/dev/null | head -1)
  else
    log_error "Either python3 or jq is required but neither is installed" >&2
    return 1
  fi

  if [[ -n "$prompt" ]]; then
    echo "$prompt"
    return 0
  else
    log_warn "No prompt found in config for '$agent_flag'" >&2
    return 1
  fi
}

# Get a config value for an agent from its feature flag config
# Usage: get_agent_config "agent_flag_key" "config_key"
# Outputs: The config value, or empty if not found
get_agent_config() {
  local agent_flag="$1"
  local config_key="$2"
  local response
  local value

  # Fetch feature flags from API
  response=$(curl -s --max-time 10 "$FEATURE_FLAGS_URL" 2>/dev/null) || {
    log_error "Failed to fetch feature flags from $FEATURE_FLAGS_URL"
    return 1
  }

  # Parse the response and extract the config value
  value=$(echo "$response" | jq -r --arg key "$agent_flag" --arg ckey "$config_key" '.data[] | select(.flagKey == $key) | .config[$ckey] // empty' 2>/dev/null | head -1) || {
    log_error "Failed to parse feature flags response"
    return 1
  }

  if [[ -n "$value" ]]; then
    echo "$value"
    return 0
  else
    return 1
  fi
}
