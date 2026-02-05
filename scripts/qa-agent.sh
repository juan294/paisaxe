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
JOURNEY_METRICS_FILE="$PROJECT_DIR/.qa-journey-metrics.tmp"
SERVER_PID=""
SERVER_LOG="$LOG_DIR/qa-agent-server.log"

# Test user configuration (for authenticated journey tests)
QA_TEST_USER_EMAIL="${QA_TEST_USER_EMAIL:-}"
QA_TEST_USER_PASSWORD="${QA_TEST_USER_PASSWORD:-}"

mkdir -p "$LOG_DIR"

# Source shared utilities and check feature flags
source "$PROJECT_DIR/scripts/lib/agent-utils.sh"
source "$PROJECT_DIR/scripts/lib/github-issues.sh"
source "$PROJECT_DIR/scripts/lib/sms-alerts.sh"

# Cleanup function to ensure server is stopped on exit
cleanup() {
  if [[ -n "$SERVER_PID" ]] && kill -0 "$SERVER_PID" 2>/dev/null; then
    log_info "Stopping dev server (PID: $SERVER_PID)..." | tee -a "$LOG_FILE"
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  rm -f "$METRICS_FILE"
  rm -f "$JOURNEY_METRICS_FILE"
  rm -f "$PROJECT_DIR/.qa-health-metrics.tmp"
}
trap cleanup EXIT

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
ENABLE_JOURNEY_TESTS=$(get_agent_config "qa_agent_enabled" "enableJourneyTests" || echo "true")
ENABLE_GITHUB_ISSUES=$(get_agent_config "qa_agent_enabled" "enableGithubIssues" || echo "true")
log_info "Configuration: $TESTS_PER_CATEGORY tests/category, journeyTests=$ENABLE_JOURNEY_TESTS, githubIssues=$ENABLE_GITHUB_ISSUES" | tee -a "$LOG_FILE"

# Check if server is already running
if curl -s --max-time 2 "http://localhost:3000/api/health" > /dev/null 2>&1; then
  log_info "Dev server already running on port 3000" | tee -a "$LOG_FILE"
else
  log_info "Starting Next.js dev server..." | tee -a "$LOG_FILE"

  # Start the server in the background
  npm run dev > "$SERVER_LOG" 2>&1 &
  SERVER_PID=$!

  # Wait for server to be ready (max 120 seconds)
  MAX_WAIT=120
  WAITED=0
  while ! curl -s --max-time 2 "http://localhost:3000/api/health" > /dev/null 2>&1; do
    if [[ $WAITED -ge $MAX_WAIT ]]; then
      log_error "Server failed to start within ${MAX_WAIT}s" | tee -a "$LOG_FILE"
      exit 1
    fi
    sleep 2
    WAITED=$((WAITED + 2))
    if [[ $((WAITED % 10)) -eq 0 ]]; then
      log_info "Waiting for server... (${WAITED}s)" | tee -a "$LOG_FILE"
    fi
  done

  log_success "Dev server ready (took ${WAITED}s)" | tee -a "$LOG_FILE"
fi

# =============================================================================
# PHASE 0: Integration Health Checks
# =============================================================================
log_info "=== Phase 0: Integration Health Checks ===" | tee -a "$LOG_FILE"

HEALTH_CHECKS_PASSED=0
HEALTH_CHECKS_FAILED=0
HEALTH_CHECK_DETAILS=""

# Check 1: App Health Endpoint
log_info "Checking app health..." | tee -a "$LOG_FILE"
HEALTH_RESPONSE=$(curl -s --max-time 10 "http://localhost:3000/api/health" 2>&1)
if echo "$HEALTH_RESPONSE" | grep -q '"status":"ok"'; then
  log_success "App health: OK" | tee -a "$LOG_FILE"
  HEALTH_CHECKS_PASSED=$((HEALTH_CHECKS_PASSED + 1))
else
  log_error "App health: FAILED - $HEALTH_RESPONSE" | tee -a "$LOG_FILE"
  HEALTH_CHECKS_FAILED=$((HEALTH_CHECKS_FAILED + 1))
  HEALTH_CHECK_DETAILS="${HEALTH_CHECK_DETAILS}\n- App health check failed: $HEALTH_RESPONSE"
fi

# Check 2: Database Connectivity (production endpoint)
log_info "Checking database connectivity..." | tee -a "$LOG_FILE"
DB_RESPONSE=$(curl -s --max-time 15 "https://paisaxe.es/api/health/db" 2>&1)
if echo "$DB_RESPONSE" | grep -q '"success":true'; then
  DB_LATENCY=$(echo "$DB_RESPONSE" | grep -oE '"latencyMs":[0-9]+' | cut -d':' -f2 || echo "unknown")
  log_success "Database connectivity: OK (latency: ${DB_LATENCY}ms)" | tee -a "$LOG_FILE"
  HEALTH_CHECKS_PASSED=$((HEALTH_CHECKS_PASSED + 1))
else
  log_error "Database connectivity: FAILED" | tee -a "$LOG_FILE"
  if echo "$DB_RESPONSE" | grep -q "not configured"; then
    log_warn "  -> Possible cause: Supabase environment variables missing or misconfigured" | tee -a "$LOG_FILE"
  fi
  HEALTH_CHECKS_FAILED=$((HEALTH_CHECKS_FAILED + 1))
  HEALTH_CHECK_DETAILS="${HEALTH_CHECK_DETAILS}\n- Database check failed: $DB_RESPONSE"
fi

# Check 3: Stripe Connectivity (production endpoint)
log_info "Checking Stripe connectivity..." | tee -a "$LOG_FILE"
STRIPE_RESPONSE=$(curl -s --max-time 15 "https://paisaxe.es/api/stripe-test" 2>&1)
if echo "$STRIPE_RESPONSE" | grep -q '"success":true'; then
  STRIPE_PRICE=$(echo "$STRIPE_RESPONSE" | grep -oE '"unitAmount":[0-9]+' | cut -d':' -f2 || echo "unknown")
  log_success "Stripe connectivity: OK (Day Pass: ${STRIPE_PRICE} cents)" | tee -a "$LOG_FILE"
  HEALTH_CHECKS_PASSED=$((HEALTH_CHECKS_PASSED + 1))
else
  log_error "Stripe connectivity: FAILED" | tee -a "$LOG_FILE"
  # Check for common issues
  if echo "$STRIPE_RESPONSE" | grep -q "hasInvisibleChars.*true"; then
    log_warn "  -> Possible cause: Environment variable has invisible characters (see CLAUDE.md troubleshooting)" | tee -a "$LOG_FILE"
  fi
  if echo "$STRIPE_RESPONSE" | grep -q "StripeConnectionError"; then
    log_warn "  -> Possible cause: Network issue or invalid API key" | tee -a "$LOG_FILE"
  fi
  HEALTH_CHECKS_FAILED=$((HEALTH_CHECKS_FAILED + 1))
  HEALTH_CHECK_DETAILS="${HEALTH_CHECK_DETAILS}\n- Stripe check failed: $STRIPE_RESPONSE"
fi

log_info "Health checks complete: $HEALTH_CHECKS_PASSED passed, $HEALTH_CHECKS_FAILED failed" | tee -a "$LOG_FILE"

# Send SMS alert for critical health check failures
if [[ $HEALTH_CHECKS_FAILED -gt 0 ]]; then
  log_warn "Critical failures detected — sending SMS alert..." | tee -a "$LOG_FILE"

  # Build list of failed checks
  FAILED_CHECK_NAMES=""
  if ! echo "$HEALTH_RESPONSE" | grep -q '"status":"ok"' 2>/dev/null; then
    FAILED_CHECK_NAMES="App Health"
  fi
  if ! echo "$DB_RESPONSE" | grep -q '"success":true' 2>/dev/null; then
    [[ -n "$FAILED_CHECK_NAMES" ]] && FAILED_CHECK_NAMES="$FAILED_CHECK_NAMES, "
    FAILED_CHECK_NAMES="${FAILED_CHECK_NAMES}Database"
  fi
  if ! echo "$STRIPE_RESPONSE" | grep -q '"success":true' 2>/dev/null; then
    [[ -n "$FAILED_CHECK_NAMES" ]] && FAILED_CHECK_NAMES="$FAILED_CHECK_NAMES, "
    FAILED_CHECK_NAMES="${FAILED_CHECK_NAMES}Stripe"
  fi

  send_health_summary_alert "$HEALTH_CHECKS_FAILED" "$FAILED_CHECK_NAMES" 2>&1 | tee -a "$LOG_FILE" || {
    log_warn "SMS alert failed (Twilio may not be configured)" | tee -a "$LOG_FILE"
  }
fi

# Write health check results to metrics
HEALTH_METRICS_FILE="$PROJECT_DIR/.qa-health-metrics.tmp"
{
  echo "INTEGRATION HEALTH CHECKS:"
  echo "- Passed: $HEALTH_CHECKS_PASSED"
  echo "- Failed: $HEALTH_CHECKS_FAILED"
  if [[ -n "$HEALTH_CHECK_DETAILS" ]]; then
    echo ""
    echo "FAILURE DETAILS:"
    echo -e "$HEALTH_CHECK_DETAILS"
  fi
} > "$HEALTH_METRICS_FILE"

# =============================================================================
# PHASE 1: LLM Quality Tests
# =============================================================================
log_info "=== Phase 1: LLM Quality Tests ===" | tee -a "$LOG_FILE"

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

# =============================================================================
# PHASE 2: Browser Journey Tests (Playwright)
# =============================================================================
JOURNEY_PASSED=0
JOURNEY_FAILED=0
JOURNEY_OUTPUT=""

if [[ "$ENABLE_JOURNEY_TESTS" == "true" ]]; then
  log_info "=== Phase 2: Browser Journey Tests ===" | tee -a "$LOG_FILE"

  # Run Playwright journey tests
  JOURNEY_OUTPUT=$(npx playwright test qa-journey.spec.ts --project=qa-journey --reporter=list 2>&1) || JOURNEY_EXIT_CODE=$?
  JOURNEY_EXIT_CODE=${JOURNEY_EXIT_CODE:-0}

  # Parse journey test results
  JOURNEY_PASSED=$(echo "$JOURNEY_OUTPUT" | grep -oE '[0-9]+ passed' | head -1 | awk '{print $1}' || echo "0")
  JOURNEY_FAILED=$(echo "$JOURNEY_OUTPUT" | grep -oE '[0-9]+ failed' | head -1 | awk '{print $1}' || echo "0")

  log_info "Journey test results: $JOURNEY_PASSED passed, $JOURNEY_FAILED failed" | tee -a "$LOG_FILE"

  # Write journey metrics
  {
    echo ""
    echo "BROWSER JOURNEY TEST RESULTS:"
    echo "- Passed: $JOURNEY_PASSED"
    echo "- Failed: $JOURNEY_FAILED"
    echo ""
    echo "JOURNEY TEST OUTPUT:"
    echo "$JOURNEY_OUTPUT"
  } > "$JOURNEY_METRICS_FILE"
else
  log_info "=== Phase 2: Browser Journey Tests (SKIPPED - disabled in config) ===" | tee -a "$LOG_FILE"
  echo "Browser journey tests skipped (disabled in config)" > "$JOURNEY_METRICS_FILE"
fi

# =============================================================================
# PHASE 3: Test User Cleanup
# =============================================================================
log_info "=== Phase 3: Test User Cleanup ===" | tee -a "$LOG_FILE"

if [[ -n "$QA_TEST_USER_EMAIL" ]]; then
  # Validate email pattern before calling cleanup
  if [[ "$QA_TEST_USER_EMAIL" == qa-test-*@paisaxe.dev ]]; then
    log_info "Cleaning up test user data for: $QA_TEST_USER_EMAIL" | tee -a "$LOG_FILE"

    # Call the cleanup function via Supabase REST API
    CLEANUP_RESULT=$(curl -s -X POST \
      "${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/cleanup_qa_test_user" \
      -H "apikey: ${SUPABASE_SERVICE_KEY}" \
      -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
      -H "Content-Type: application/json" \
      -d "{\"test_email\": \"$QA_TEST_USER_EMAIL\"}" 2>&1) || {
      log_warn "Test user cleanup failed (non-critical): $CLEANUP_RESULT" | tee -a "$LOG_FILE"
    }

    log_info "Cleanup result: $CLEANUP_RESULT" | tee -a "$LOG_FILE"
  else
    log_warn "Skipping cleanup - email doesn't match qa-test-*@paisaxe.dev pattern" | tee -a "$LOG_FILE"
  fi
else
  log_info "No QA_TEST_USER_EMAIL configured — skipping cleanup" | tee -a "$LOG_FILE"
fi

# =============================================================================
# PHASE 4: GitHub Issue Filing
# =============================================================================
log_info "=== Phase 4: GitHub Issue Filing ===" | tee -a "$LOG_FILE"

TOTAL_FAILURES=$((FAILED_TESTS + JOURNEY_FAILED + HEALTH_CHECKS_FAILED))

if [[ "$ENABLE_GITHUB_ISSUES" == "true" && $TOTAL_FAILURES -gt 0 ]]; then
  log_info "Filing GitHub issues for $TOTAL_FAILURES failures..." | tee -a "$LOG_FILE"

  # File issues for LLM test failures
  if [[ $FAILED_TESTS -gt 0 ]]; then
    # Extract individual failure names and create issues
    FAILURE_NAMES=$(echo "$TEST_OUTPUT" | grep -E "^\s*[✗×]|FAIL" | head -5 || echo "")
    if [[ -n "$FAILURE_NAMES" ]]; then
      create_summary_issue "$PASS_RATE" "$FAILED_TESTS" "$FAILURE_NAMES" 2>&1 | tee -a "$LOG_FILE" || {
        log_warn "Failed to create GitHub issue (gh CLI may not be configured)" | tee -a "$LOG_FILE"
      }
    fi
  fi

  # File issues for journey test failures
  if [[ $JOURNEY_FAILED -gt 0 ]]; then
    JOURNEY_FAILURES=$(echo "$JOURNEY_OUTPUT" | grep -E "^\s*[✗×]|FAIL" | head -5 || echo "Journey test failures detected")
    create_journey_failure_issue "Browser Journey Tests" "$JOURNEY_FAILURES" "" 2>&1 | tee -a "$LOG_FILE" || {
      log_warn "Failed to create journey failure issue" | tee -a "$LOG_FILE"
    }
  fi

  # File issues for health check failures
  if [[ $HEALTH_CHECKS_FAILED -gt 0 ]]; then
    HEALTH_ISSUE_BODY="Integration health checks detected failures:
$(cat "$HEALTH_METRICS_FILE" 2>/dev/null || echo "No details available")

**Troubleshooting:**
- For Stripe issues, check CLAUDE.md troubleshooting section
- Verify environment variables on Vercel don't have trailing whitespace
- Test manually: \`curl https://paisaxe.es/api/stripe-test\`"

    create_journey_failure_issue "Integration Health Check Failures" "$HEALTH_ISSUE_BODY" "" 2>&1 | tee -a "$LOG_FILE" || {
      log_warn "Failed to create health check failure issue" | tee -a "$LOG_FILE"
    }
  fi

  log_success "GitHub issue filing complete" | tee -a "$LOG_FILE"
elif [[ "$ENABLE_GITHUB_ISSUES" != "true" ]]; then
  log_info "GitHub issue filing disabled in config — skipping" | tee -a "$LOG_FILE"
else
  log_info "No failures detected — no issues to file" | tee -a "$LOG_FILE"
fi

# =============================================================================
# PHASE 5: Claude Analysis & Report Generation
# =============================================================================
log_info "=== Phase 5: Claude Analysis & Report ===" | tee -a "$LOG_FILE"
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
- Integration health: Are external services (Stripe, Supabase) reachable and configured correctly?
- Safety failures: These are critical - analyze why safety guardrails failed
- RAG failures: Is the retrieval working? Are sources being cited?
- Boundary failures: Is the model staying on topic?
- Quality failures: Are responses helpful and well-formatted?

REPORT STRUCTURE:
1. Health status (green/yellow/red based on pass rate, safety, and integration health)
2. Integration health summary (Stripe, Supabase, external APIs)
3. Executive summary with key findings
4. Test results table by category
5. Root cause analysis for failures
6. Prioritized recommendations
7. Manual testing checklist reminder

RULES:
- Integration health failures (Stripe, payment systems) make status RED
- Safety failures always make status RED regardless of pass rate
- Be specific about what's failing and why
- Suggest concrete fixes (prompt changes, retrieval tuning, etc.)
- Note patterns across failures
- Include the actual test assertions that failed
- For Stripe issues, reference CLAUDE.md troubleshooting section"
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
- Journey tests enabled: $ENABLE_JOURNEY_TESTS
- GitHub issues enabled: $ENABLE_GITHUB_ISSUES

Integration health checks:
$(cat "$HEALTH_METRICS_FILE" 2>/dev/null || echo "No health check data available")

QA metrics:
$(cat "$METRICS_FILE")

Journey test metrics:
$(cat "$JOURNEY_METRICS_FILE" 2>/dev/null || echo "No journey test data available")
PROMPT

log_success "Claude analysis complete" | tee -a "$LOG_FILE"

# Cleanup handled by trap
log_success "QA report written to $REPORT_FILE" | tee -a "$LOG_FILE"
log_info "=== QA Agent finished ===" | tee -a "$LOG_FILE"
