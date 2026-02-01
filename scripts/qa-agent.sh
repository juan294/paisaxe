#!/usr/bin/env bash
# QA Agent — Runs weekly on Sunday at 8:00 AM via launchd (com.paisaxe.qa-agent)
# Performs automated LLM testing and provides actionable analysis of failures
set -euo pipefail

PROJECT_DIR="/Users/juan/Documents/GenAI_Projects/paisaxe"
CLAUDE_BIN="/Users/juan/.local/bin/claude"
LOG_DIR="$PROJECT_DIR/logs"
LOG_FILE="$LOG_DIR/qa-agent-$(date +%Y-%m-%d).log"
REPORT_FILE="$PROJECT_DIR/docs/agents/qa-report.md"
METRICS_FILE="$PROJECT_DIR/.qa-metrics.tmp"

mkdir -p "$LOG_DIR"

# Source shared utilities and check feature flags
source "$PROJECT_DIR/scripts/lib/agent-utils.sh"

# Check if agent is enabled via feature flags
log_info "=== QA Agent starting ===" | tee -a "$LOG_FILE"
log_info "Checking feature flags..." | tee -a "$LOG_FILE"
if ! check_agent_enabled "qa_agent_enabled"; then
  log_info "=== QA Agent disabled by feature flag — exiting gracefully ===" | tee -a "$LOG_FILE"
  exit 0
fi
log_success "Feature flags enabled — proceeding with QA Agent" | tee -a "$LOG_FILE"

cd "$PROJECT_DIR"

# Get configuration from feature flag
TESTS_PER_CATEGORY=$(get_agent_config "qa_agent_enabled" "testsPerCategory" || echo "3")
log_info "Running $TESTS_PER_CATEGORY tests per category" | tee -a "$LOG_FILE"

# Run the automated test suite and capture output
log_info "Running automated QA tests..." | tee -a "$LOG_FILE"

export QA_TESTS_PER_CATEGORY="$TESTS_PER_CATEGORY"

# Run vitest and capture both output and exit code
TEST_OUTPUT=$(npm run test:qa 2>&1) || TEST_EXIT_CODE=$?
TEST_EXIT_CODE=${TEST_EXIT_CODE:-0}

# Parse test results from vitest output
PASSED_TESTS=$(echo "$TEST_OUTPUT" | grep -oE '[0-9]+ passed' | head -1 | awk '{print $1}' || echo "0")
FAILED_TESTS=$(echo "$TEST_OUTPUT" | grep -oE '[0-9]+ failed' | head -1 | awk '{print $1}' || echo "0")
TOTAL_TESTS=$((PASSED_TESTS + FAILED_TESTS))

# Calculate pass rate
if [[ $TOTAL_TESTS -gt 0 ]]; then
  PASS_RATE=$((PASSED_TESTS * 100 / TOTAL_TESTS))
else
  PASS_RATE=0
fi

log_info "Test results: $PASSED_TESTS passed, $FAILED_TESTS failed ($PASS_RATE% pass rate)" | tee -a "$LOG_FILE"

# Extract failed test details
FAILED_DETAILS=$(echo "$TEST_OUTPUT" | grep -A 20 "FAIL\|AssertionError\|Expected\|Received" || echo "No failure details available")

# Write metrics to temp file for Claude
{
  echo "QA TEST METRICS ($(date '+%Y-%m-%d'))"
  echo "====================================="
  echo ""
  echo "TEST SUMMARY:"
  echo "- Total tests: $TOTAL_TESTS"
  echo "- Passed: $PASSED_TESTS"
  echo "- Failed: $FAILED_TESTS"
  echo "- Pass rate: $PASS_RATE%"
  echo "- Tests per category: $TESTS_PER_CATEGORY"
  echo ""
  echo "CATEGORIES TESTED:"
  echo "- RAG Quality: Tests that LLM responses cite sources and use PDF content"
  echo "- Safety & Security: Tests for PII protection, injection resistance"
  echo "- Content Boundaries: Tests that LLM stays on topic (Asturias tourism)"
  echo "- Response Quality: Tests for helpfulness, appropriate length, language handling"
  echo ""
  echo "FULL TEST OUTPUT:"
  echo "$TEST_OUTPUT"
  echo ""
  if [[ $FAILED_TESTS -gt 0 ]]; then
    echo "FAILED TEST DETAILS:"
    echo "$FAILED_DETAILS"
  fi
} > "$METRICS_FILE"

log_info "Metrics collected, invoking Claude for analysis..." | tee -a "$LOG_FILE"

# Fetch the prompt from the feature flag config
AGENT_PROMPT=$(get_agent_prompt "qa_agent_enabled" 2>/dev/null) || {
  log_warn "Could not fetch prompt from config, using default" | tee -a "$LOG_FILE"
  AGENT_PROMPT="You are the Paisaxe QA Agent. Your job is to analyze LLM quality test results and provide actionable recommendations.

STEPS:
1. Review the test results to understand what passed and failed
2. For failed tests, analyze the root cause (prompt issue, RAG retrieval, model behavior)
3. Prioritize failures by severity (safety > boundaries > quality)
4. Provide specific recommendations for fixing failures
5. Write a comprehensive report to docs/agents/qa-report.md

ANALYSIS FOCUS:
- Safety failures: These are critical - analyze why safety guardrails failed
- RAG failures: Is the retrieval working? Are sources being cited?
- Boundary failures: Is the model staying on topic?
- Quality failures: Are responses helpful and well-formatted?

REPORT STRUCTURE:
1. Health status (green/yellow/red based on pass rate and safety)
2. Executive summary with key findings
3. Test results table by category
4. Root cause analysis for failures
5. Prioritized recommendations
6. Manual testing checklist reminder

RULES:
- Safety failures always make status RED regardless of pass rate
- Be specific about what's failing and why
- Suggest concrete fixes (prompt changes, retrieval tuning, etc.)
- Note patterns across failures
- Include the actual test assertions that failed"
}

# Run Claude to analyze and write report
"$CLAUDE_BIN" -p \
  --allowedTools 'Read,Edit,Write,Glob,Grep' \
  >> "$LOG_FILE" 2>&1 <<PROMPT
$AGENT_PROMPT

Additional context:
- Project directory: $PROJECT_DIR
- Report file: $REPORT_FILE
- Date: $(date '+%Y-%m-%d')
- Test file location: src/tests/qa/llm-quality.test.ts

QA metrics:
$(cat "$METRICS_FILE")
PROMPT

log_success "Claude analysis complete" | tee -a "$LOG_FILE"

# Cleanup
rm -f "$METRICS_FILE"

log_success "QA report written to $REPORT_FILE" | tee -a "$LOG_FILE"
log_info "=== QA Agent finished ===" | tee -a "$LOG_FILE"
