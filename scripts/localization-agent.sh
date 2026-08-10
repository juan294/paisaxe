#!/usr/bin/env bash
# Localization Agent — Runs weekly (Sundays at 7:00 AM) via launchd (com.paisaxe.localization-agent StartCalendarInterval Weekday=0)
# Checks for missing translations across all locales and fills gaps automatically
set -euo pipefail

PROJECT_DIR="/Users/juan/code/paisaxe"
CLAUDE_BIN="/Users/juan/.local/bin/claude"
MODEL="claude-haiku-4-5-20251001"
LOG_DIR="$PROJECT_DIR/logs"
LOG_FILE="$LOG_DIR/localization-agent-$(date +%Y-%m-%d).log"
DOC_FILE="$PROJECT_DIR/docs/agents/localization-report.md"

mkdir -p "$LOG_DIR"

# Source shared utilities and check feature flags
source "$PROJECT_DIR/scripts/lib/agent-utils.sh"

# Check if agent is enabled via feature flags
log_info "=== Localization Agent starting ===" | tee -a "$LOG_FILE"
log_info "Checking feature flags..." | tee -a "$LOG_FILE"
if ! check_agent_enabled "localization_agent_enabled"; then
  log_info "=== Localization Agent disabled by feature flag — exiting gracefully ===" | tee -a "$LOG_FILE"
  exit 0
fi
log_success "Feature flags enabled — proceeding with Localization Agent" | tee -a "$LOG_FILE"

echo "=== Localization Agent started at $(date) ===" | tee -a "$LOG_FILE"

cd "$PROJECT_DIR"

# Load the agent prompt from shared TypeScript config
log_info "Loading agent prompt..." | tee -a "$LOG_FILE"
AGENT_PROMPT=$(get_default_prompt "localization_agent_enabled" 2>/dev/null) || {
  log_error "No prompt available for localization_agent_enabled" | tee -a "$LOG_FILE"
  exit 1
}

# Read shared context from other agents
log_info "Reading shared context..." | tee -a "$LOG_FILE"
SHARED_CONTEXT=$(read_shared_context "localization_agent_enabled")
SHARED_CONTEXT_READ=$(npx tsx "$PROJECT_DIR/scripts/lib/print-shared-context-instructions.ts" read 2>/dev/null || echo "")
SHARED_CONTEXT_WRITE=$(npx tsx "$PROJECT_DIR/scripts/lib/print-shared-context-instructions.ts" write 2>/dev/null || echo "")

# Run the localization agent via Claude CLI in non-interactive mode
"$CLAUDE_BIN" -p \
  --model "$MODEL" \
  --allowedTools 'Read,Write,Edit,Bash(npx tsc*),Bash(ls *),Bash(find *),Glob,Grep' \
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
  write_shared_context "localization_agent_enabled" "$CONTEXT_BLOCK"
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

echo "=== Localization Agent finished at $(date) ===" | tee -a "$LOG_FILE"
