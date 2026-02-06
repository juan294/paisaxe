#!/usr/bin/env bash
# Cost Analyst Agent — Runs daily at 3:00 AM via launchd (com.paisaxe.cost-analyst-agent)
# Queries billing APIs, analyzes costs, writes docs/agents/cost-analyst-report.md
set -euo pipefail

PROJECT_DIR="/Users/juan/Documents/GenAI_Projects/paisaxe"
CLAUDE_BIN="/Users/juan/.local/bin/claude"
LOG_DIR="$PROJECT_DIR/logs"
LOG_FILE="$LOG_DIR/cost-analyst-agent-$(date +%Y-%m-%d).log"
DOC_FILE="$PROJECT_DIR/docs/agents/cost-analyst-report.md"

mkdir -p "$LOG_DIR"

# Source shared utilities and check feature flags
source "$PROJECT_DIR/scripts/lib/agent-utils.sh"

# Check if agent is enabled via feature flags
log_info "=== Cost Analyst Agent starting ===" | tee -a "$LOG_FILE"
log_info "Checking feature flags..." | tee -a "$LOG_FILE"
if ! check_agent_enabled "cost_analyst_agent_enabled"; then
  log_info "=== Cost Analyst Agent disabled by feature flag — exiting gracefully ===" | tee -a "$LOG_FILE"
  exit 0
fi
log_success "Feature flags enabled — proceeding with Cost Analyst Agent" | tee -a "$LOG_FILE"

echo "=== Cost Analyst Agent started at $(date) ===" | tee -a "$LOG_FILE"

cd "$PROJECT_DIR"

# Fetch the prompt from the feature flag config
log_info "Fetching agent prompt from config..." | tee -a "$LOG_FILE"
AGENT_PROMPT=$(get_agent_prompt "cost_analyst_agent_enabled" 2>/dev/null) || {
  log_warn "Could not fetch prompt from config, trying shared default" | tee -a "$LOG_FILE"
  AGENT_PROMPT=$(get_default_prompt "cost_analyst_agent_enabled" 2>/dev/null) || {
    log_error "No prompt available for cost_analyst_agent_enabled" | tee -a "$LOG_FILE"
    exit 1
  }
}

# Run the cost analyst agent via Claude CLI in non-interactive mode
# No server startup needed — Claude curls external APIs directly
"$CLAUDE_BIN" -p \
  --allowedTools 'Read,Write,Edit,Bash(curl*),Bash(date*),Bash(jq*),Glob,Grep' \
  >> "$LOG_FILE" 2>&1 <<PROMPT
$AGENT_PROMPT

Additional context:
- Project directory: $PROJECT_DIR
- Output file: $DOC_FILE
- Date: $(date '+%Y-%m-%d')
- Environment variables available for API access:
  ELEVENLABS_API_KEY, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN
- Note: Anthropic usage is NOT available via API (personal account). Use config file values only.
- Config files to read:
  src/config/service-tiers.ts (tier limits and pricing)
  src/config/recurring-costs.ts (fixed subscription costs)
  src/lib/costs/forecast.ts (forecast logic reference)
PROMPT

echo "=== Cost Analyst Agent finished at $(date) ===" | tee -a "$LOG_FILE"
