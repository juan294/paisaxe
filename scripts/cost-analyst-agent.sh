#!/usr/bin/env bash
# Cost Analyst Agent — Runs daily at 3:00 AM via launchd (com.paisaxe.cost-analyst-agent)
# Queries billing APIs, analyzes costs, writes docs/agents/cost-analyst-report.md
set -euo pipefail

PROJECT_DIR="/Users/juan/code/paisaxe"
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

# Load the agent prompt from shared TypeScript config
log_info "Loading agent prompt..." | tee -a "$LOG_FILE"
AGENT_PROMPT=$(get_default_prompt "cost_analyst_agent_enabled" 2>/dev/null) || {
  log_error "No prompt available for cost_analyst_agent_enabled" | tee -a "$LOG_FILE"
  exit 1
}

# Read shared context from other agents
log_info "Reading shared context..." | tee -a "$LOG_FILE"
SHARED_CONTEXT=$(read_shared_context "cost_analyst_agent_enabled")
SHARED_CONTEXT_READ=$(npx tsx "$PROJECT_DIR/scripts/lib/print-shared-context-instructions.ts" read 2>/dev/null || echo "")
SHARED_CONTEXT_WRITE=$(npx tsx "$PROJECT_DIR/scripts/lib/print-shared-context-instructions.ts" write 2>/dev/null || echo "")

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

$SHARED_CONTEXT_READ

$SHARED_CONTEXT

$SHARED_CONTEXT_WRITE
PROMPT

# Extract and write shared context
REPORT_CONTENT=$(cat "$DOC_FILE")
CONTEXT_BLOCK=$(echo "$REPORT_CONTENT" | sed -n '/SHARED_CONTEXT_START/,/SHARED_CONTEXT_END/p' | sed '1d;$d')

if [[ -n "$CONTEXT_BLOCK" ]]; then
  write_shared_context "cost_analyst_agent_enabled" "$CONTEXT_BLOCK"
  log_success "Shared context updated" | tee -a "$LOG_FILE"

  # Strip the shared context block from the report
  python3 -c "
import re, sys
content = sys.stdin.read()
cleaned = re.sub(r'\n?SHARED_CONTEXT_START\n.*?SHARED_CONTEXT_END\n?', '', content, flags=re.DOTALL)
sys.stdout.write(cleaned)
" < "$DOC_FILE" > "${DOC_FILE}.tmp"
  mv "${DOC_FILE}.tmp" "$DOC_FILE"
else
  log_info "No shared context block found in report" | tee -a "$LOG_FILE"
fi

echo "=== Cost Analyst Agent finished at $(date) ===" | tee -a "$LOG_FILE"
