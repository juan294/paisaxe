#!/usr/bin/env bash
# Coverage Agent — Runs nightly at 2:00 AM via launchd (com.paisaxe.coverage-agent)
# Checks test coverage, writes missing tests, updates docs/coverage-report.md
set -euo pipefail

PROJECT_DIR="/Users/juan/Documents/GenAI_Projects/paisaxe"
CLAUDE_BIN="/Users/juan/.local/bin/claude"
LOG_DIR="$PROJECT_DIR/logs"
LOG_FILE="$LOG_DIR/coverage-agent-$(date +%Y-%m-%d).log"
DOC_FILE="$PROJECT_DIR/docs/agents/coverage-report.md"

mkdir -p "$LOG_DIR"

# Source shared utilities and check feature flags
source "$PROJECT_DIR/scripts/lib/agent-utils.sh"

# Check if agent is enabled via feature flags
log_info "=== Coverage Agent starting ===" | tee -a "$LOG_FILE"
log_info "Checking feature flags..." | tee -a "$LOG_FILE"
if ! check_agent_enabled "coverage_agent_enabled"; then
  log_info "=== Coverage Agent disabled by feature flag — exiting gracefully ===" | tee -a "$LOG_FILE"
  exit 0
fi
log_success "Feature flags enabled — proceeding with Coverage Agent" | tee -a "$LOG_FILE"

echo "=== Coverage Agent started at $(date) ===" | tee -a "$LOG_FILE"

cd "$PROJECT_DIR"

# Fetch the prompt from the feature flag config
log_info "Fetching agent prompt from config..." | tee -a "$LOG_FILE"
AGENT_PROMPT=$(get_agent_prompt "coverage_agent_enabled" 2>/dev/null) || {
  log_warn "Could not fetch prompt from config, trying shared default" | tee -a "$LOG_FILE"
  AGENT_PROMPT=$(get_default_prompt "coverage_agent_enabled" 2>/dev/null) || {
    log_error "No prompt available for coverage_agent_enabled" | tee -a "$LOG_FILE"
    exit 1
  }
}

# Run the coverage agent via Claude CLI in non-interactive mode
"$CLAUDE_BIN" -p \
  --allowedTools 'Read,Write,Edit,Bash(npx vitest*),Bash(npm run typecheck*),Bash(ls *),Bash(find *),Glob,Grep' \
  >> "$LOG_FILE" 2>&1 <<PROMPT
$AGENT_PROMPT

Additional context:
- Project directory: $PROJECT_DIR
- Output file: $DOC_FILE
- Date: $(date '+%Y-%m-%d')
PROMPT

echo "=== Coverage Agent finished at $(date) ===" | tee -a "$LOG_FILE"
