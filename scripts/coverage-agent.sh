#!/usr/bin/env bash
# Coverage Agent — Runs nightly at 2:00 AM via launchd (com.paisaxe.coverage-agent)
# Checks test coverage, writes missing tests, updates docs/coverage-report.md
set -euo pipefail

PROJECT_DIR="/Users/juan/Documents/code/paisaxe"
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

# Read shared context from other agents
log_info "Reading shared context..." | tee -a "$LOG_FILE"
SHARED_CONTEXT=$(read_shared_context "coverage_agent_enabled")
SHARED_CONTEXT_READ=$(npx tsx "$PROJECT_DIR/scripts/lib/print-shared-context-instructions.ts" read 2>/dev/null || echo "")
SHARED_CONTEXT_WRITE=$(npx tsx "$PROJECT_DIR/scripts/lib/print-shared-context-instructions.ts" write 2>/dev/null || echo "")

# Run the coverage agent via Claude CLI in non-interactive mode
"$CLAUDE_BIN" -p \
  --allowedTools 'Read,Write,Edit,Bash(npx vitest*),Bash(npm run typecheck*),Bash(ls *),Bash(find *),Glob,Grep' \
  >> "$LOG_FILE" 2>&1 <<PROMPT
$AGENT_PROMPT

Additional context:
- Project directory: $PROJECT_DIR
- Output file: $DOC_FILE
- Date: $(date '+%Y-%m-%d')

$SHARED_CONTEXT_READ

$SHARED_CONTEXT

$SHARED_CONTEXT_WRITE
PROMPT

# Extract and write shared context
REPORT_CONTENT=$(cat "$DOC_FILE")
CONTEXT_BLOCK=$(echo "$REPORT_CONTENT" | sed -n '/SHARED_CONTEXT_START/,/SHARED_CONTEXT_END/p' | sed '1d;$d')

if [[ -n "$CONTEXT_BLOCK" ]]; then
  write_shared_context "coverage_agent_enabled" "$CONTEXT_BLOCK"
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

echo "=== Coverage Agent finished at $(date) ===" | tee -a "$LOG_FILE"
