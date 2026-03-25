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

# Configuration — local agent config (no HTTP dependency)
# Reads from scripts/agent-config.json, auto-creates from defaults if missing.

# Resolve the agent config file path
# Sets AGENT_CONFIG_FILE to the path of the local JSON config
resolve_agent_config() {
  local script_dir
  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  AGENT_CONFIG_FILE="$script_dir/agent-config.json"
  local defaults_file="$script_dir/agent-config.defaults.json"

  if [[ ! -f "$AGENT_CONFIG_FILE" ]]; then
    if [[ -f "$defaults_file" ]]; then
      cp "$defaults_file" "$AGENT_CONFIG_FILE"
      log_info "Auto-created agent config from defaults"
    else
      log_error "No agent config or defaults file found at $script_dir"
      return 1
    fi
  fi
}

# Check if an agent is enabled (checks both master toggle and individual flag)
# Usage: check_agent_enabled "agent_flag_key"
# Returns: 0 if both enabled, 1 if either disabled
check_agent_enabled() {
  local agent_flag="$1"

  if ! command -v jq &>/dev/null; then
    log_error "jq is required but not installed. Install with: brew install jq"
    return 1
  fi

  resolve_agent_config || return 1

  # Check master toggle first
  local master
  master=$(jq -r '.master_enabled' "$AGENT_CONFIG_FILE" 2>/dev/null)
  if [[ "$master" != "true" ]]; then
    log_info "Master toggle is disabled — all agents are off"
    return 1
  fi

  # Check individual agent flag
  local enabled
  enabled=$(jq -r --arg k "$agent_flag" '.agents[$k].enabled // empty' "$AGENT_CONFIG_FILE" 2>/dev/null)
  if [[ "$enabled" != "true" ]]; then
    log_info "Agent flag '$agent_flag' is disabled"
    return 1
  fi

  return 0
}

# Get a config value for an agent from local config
# Usage: get_agent_config "agent_flag_key" "config_key"
# Outputs: The config value, or empty if not found
get_agent_config() {
  local agent_flag="$1"
  local config_key="$2"

  if ! command -v jq &>/dev/null; then
    return 1
  fi

  resolve_agent_config || return 1

  local value
  value=$(jq -r --arg k "$agent_flag" --arg ck "$config_key" '.agents[$k].config[$ck] // empty' "$AGENT_CONFIG_FILE" 2>/dev/null)

  if [[ -n "$value" ]]; then
    echo "$value"
    return 0
  else
    return 1
  fi
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

# Get the default prompt for an agent from the shared TypeScript config
# Usage: get_default_prompt "agent_flag_key"
# Outputs: The default prompt string
# Falls back to this when the feature-flags API is unreachable
get_default_prompt() {
  local agent_flag="$1"
  local prompt

  prompt=$(npx tsx "$PROJECT_DIR/scripts/lib/print-default-prompt.ts" "$agent_flag" 2>/dev/null) || {
    log_error "Failed to read default prompt for '$agent_flag' from shared config" >&2
    return 1
  }

  if [[ -n "$prompt" ]]; then
    echo "$prompt"
    return 0
  else
    log_error "Empty default prompt for '$agent_flag'" >&2
    return 1
  fi
}

# Read shared context, excluding this agent's own entries
# Usage: read_shared_context "agent_flag_key"
# Outputs: The shared context minus own entries, suitable for injection into prompt
read_shared_context() {
  local agent_flag="$1"
  local shared_file="$PROJECT_DIR/docs/agents/shared-context.md"

  if [[ ! -f "$shared_file" ]]; then
    echo ""
    return 0
  fi

  # Use Python to filter out this agent's own entries
  python3 -c "
import sys, re

agent = sys.argv[1]
content = sys.stdin.read()

# Split into entries using the HTML comment delimiters
entries = re.split(r'(<!-- ENTRY:START[^>]*-->)', content)

result = []
skip = False
for i, part in enumerate(entries):
    if part.startswith('<!-- ENTRY:START'):
        if f'agent={agent}' in part:
            skip = True
        else:
            skip = False
            result.append(part)
    elif not skip:
        # Remove ENTRY:END markers from output
        cleaned = re.sub(r'<!-- ENTRY:END -->\n?', '', part)
        result.append(cleaned)

output = ''.join(result).strip()
if output:
    print(output)
" "$agent_flag" < "$shared_file"
}

# Write shared context entry for this agent
# Usage: write_shared_context "agent_flag_key" "summary_content"
write_shared_context() {
  local agent_flag="$1"
  local summary="$2"
  local shared_file="$PROJECT_DIR/docs/agents/shared-context.md"
  local timestamp
  timestamp=$(date -u '+%Y-%m-%dT%H:%M:%SZ')

  # Create file if it doesn't exist
  if [[ ! -f "$shared_file" ]]; then
    cat > "$shared_file" << 'HEADER'
# Agent Shared Context
> Cross-agent intelligence — agents read this before running and write findings after finishing.
> Pruned automatically to keep the last 3 entries per agent.

HEADER
  fi

  # Append the new entry
  {
    echo ""
    echo "<!-- ENTRY:START agent=$agent_flag timestamp=$timestamp -->"
    echo "$summary"
    echo "<!-- ENTRY:END -->"
  } >> "$shared_file"

  # Prune to keep only last 3 entries per agent
  prune_shared_context "$shared_file"
}

# Prune shared context to keep last 3 entries per agent
# Usage: prune_shared_context "/path/to/shared-context.md"
prune_shared_context() {
  local shared_file="$1"

  python3 -c "
import re, sys

filepath = sys.argv[1]
with open(filepath, 'r') as f:
    content = f.read()

# Extract header (everything before first ENTRY:START)
first_entry = content.find('<!-- ENTRY:START')
if first_entry == -1:
    sys.exit(0)

header = content[:first_entry]
body = content[first_entry:]

# Parse all entries
pattern = r'(<!-- ENTRY:START agent=(\S+) timestamp=(\S+) -->.*?<!-- ENTRY:END -->)'
entries = re.findall(pattern, body, re.DOTALL)

# Group by agent, keep last 3 per agent
from collections import defaultdict
agent_entries = defaultdict(list)
for full_match, agent, timestamp in entries:
    agent_entries[agent].append((timestamp, full_match))

# Sort each agent's entries by timestamp, keep last 3
pruned = []
for agent in agent_entries:
    sorted_entries = sorted(agent_entries[agent], key=lambda x: x[0])
    for ts, entry in sorted_entries[-3:]:
        pruned.append((ts, entry))

# Sort all pruned entries by timestamp
pruned.sort(key=lambda x: x[0])

# Write back
with open(filepath, 'w') as f:
    f.write(header)
    for ts, entry in pruned:
        f.write('\n' + entry + '\n')
" "$shared_file"
}
