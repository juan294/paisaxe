#!/usr/bin/env bash
# Coverage Agent — Runs nightly at 2:00 AM via launchd (com.paisaxe.coverage-agent)
# Checks test coverage, writes missing tests, updates docs/coverage-report.md
set -euo pipefail

PROJECT_DIR="/Users/juan/Documents/GenAI_Projects/paisaxe"
CLAUDE_BIN="/Users/juan/.local/bin/claude"
LOG_DIR="$PROJECT_DIR/logs"
LOG_FILE="$LOG_DIR/coverage-agent-$(date +%Y-%m-%d).log"
DOC_FILE="$PROJECT_DIR/docs/coverage-report.md"

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
  log_warn "Could not fetch prompt from config, using default" | tee -a "$LOG_FILE"
  AGENT_PROMPT="You are the Paisaxe Coverage Agent. Your job is to maintain high test coverage.

STEPS:
1. Run: npx vitest run --coverage 2>&1
2. Parse the coverage table. Identify files below 100% statement coverage.
3. For each file under 100%:
   a. Read the source file and its test file (if one exists).
   b. Write or update tests to cover the missing lines.
   c. Run the specific test file to confirm it passes.
4. After writing all tests, run the full suite: npx vitest run --coverage 2>&1
5. Update $DOC_FILE with a coverage summary.

RULES:
- Do NOT modify source code, only test files.
- Do NOT break existing tests.
- If a line is genuinely untestable in jsdom/vitest, document it rather than forcing a brittle test.
- Commit nothing. The user will review and commit manually.
- Be thorough but pragmatic."
}

# Run the coverage agent via Claude CLI in non-interactive mode
"$CLAUDE_BIN" -p \
  --allowedTools 'Read,Write,Edit,Bash(npx vitest*),Bash(ls *),Bash(find *),Glob,Grep' \
  >> "$LOG_FILE" 2>&1 <<PROMPT
$AGENT_PROMPT

Additional context:
- Project directory: $PROJECT_DIR
- Output file: $DOC_FILE
- Date: $(date '+%Y-%m-%d')
PROMPT

echo "=== Coverage Agent finished at $(date) ===" | tee -a "$LOG_FILE"
