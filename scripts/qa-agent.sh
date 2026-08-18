#!/usr/bin/env bash
# QA Agent — Runs weekly on Sunday at 8:00 AM via launchd (com.paisaxe.qa-agent)
# Performs automated LLM testing and provides actionable analysis of failures
set -euo pipefail

PROJECT_DIR="/Users/juan/code/paisaxe"
CLAUDE_BIN="/Users/juan/.local/bin/claude"
MODEL="sonnet"
LOG_DIR="$PROJECT_DIR/logs"
LOG_FILE="$LOG_DIR/qa-agent-$(date +%Y-%m-%d).log"
REPORT_FILE="$PROJECT_DIR/docs/agents/qa-report.md"
METRICS_FILE="$PROJECT_DIR/.qa-metrics.tmp"
JOURNEY_METRICS_FILE="$PROJECT_DIR/.qa-journey-metrics.tmp"
SERVER_PID=""
SERVER_LOG="$LOG_DIR/qa-agent-server.log"
VOYAGE_API_KEY_VALUE=""
ANTHROPIC_API_KEY_VALUE=""
RUN_COMPLETED=false
CURRENT_PHASE="startup"

# Test user configuration (for authenticated journey tests)
QA_TEST_USER_EMAIL="${QA_TEST_USER_EMAIL:-}"
QA_TEST_USER_PASSWORD="${QA_TEST_USER_PASSWORD:-}"

mkdir -p "$LOG_DIR"

trim_value() {
  local value="${1:-}"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  printf '%s' "$value"
}

read_env_file_value() {
  local key="$1"
  local env_file="$PROJECT_DIR/.env.local"
  local line=""
  local value=""

  [[ -f "$env_file" ]] || return 0

  line=$(grep -E "^[[:space:]]*${key}=" "$env_file" | tail -n 1 || true)
  [[ -n "$line" ]] || return 0

  value="$(trim_value "${line#*=}")"
  if [[ "${value:0:1}" == '"' && "${value: -1}" == '"' ]]; then
    value="${value:1:${#value}-2}"
  elif [[ "${value:0:1}" == "'" && "${value: -1}" == "'" ]]; then
    value="${value:1:${#value}-2}"
  fi

  trim_value "$value"
}

# Run a curl GET against a remote host, retrying once after a short pause if
# the initial attempt fails to connect (curl exit != 0). Prints curl's
# stdout and returns curl's exit code — callers keep their own response
# parsing. Extra args after the URL are passed through to curl (e.g.
# `-o /dev/null -w "%{http_code}"` for a status-only probe).
retry_curl_probe() {
  local url="$1"
  shift
  local exit_code=0
  local output
  output=$(curl -s --max-time 15 "$url" "$@") || exit_code=$?
  if [[ "$exit_code" -ne 0 ]]; then
    log_warn "Probe failed for $url (curl exit code $exit_code) — retrying once after 3s" | tee -a "$LOG_FILE"
    sleep 3
    exit_code=0
    output=$(curl -s --max-time 15 "$url" "$@") || exit_code=$?
  fi
  printf '%s' "$output"
  return "$exit_code"
}

get_config_value() {
  local key="$1"
  local value=""

  value="$(trim_value "${!key:-}")"
  if [[ -z "$value" ]]; then
    value="$(read_env_file_value "$key")"
  fi

  trim_value "$value"
}

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
  rm -f "$PROJECT_DIR/.qa-gap-metrics.tmp"
  rm -f "${REPORT_FILE}.aborted.tmp"
}

write_abnormal_exit_report() {
  local exit_status="$1"
  local aborted_report="${REPORT_FILE}.aborted.tmp"
  local context="QA agent aborted during ${CURRENT_PHASE} with exit status ${exit_status}. See ${REPORT_FILE} for the preserved failure report."

  mkdir -p "$(dirname "$REPORT_FILE")"
  {
    echo "# QA Agent Report"
    echo ""
    echo "**Status:** ABORTED"
    echo "**Date:** $(date '+%Y-%m-%d %H:%M:%S %Z')"
    echo "**Exit status:** $exit_status"
    echo "**Last phase:** $CURRENT_PHASE"
    echo ""
    echo "The QA wrapper exited before its normal report-generation step. Review $LOG_FILE for the underlying failure."
  } > "$aborted_report"
  mv "$aborted_report" "$REPORT_FILE"
  write_shared_context "qa_agent_enabled" "$context" || true
}

handle_exit() {
  local exit_status="$1"
  set +e
  if [[ "$exit_status" -ne 0 && "$RUN_COMPLETED" != "true" ]]; then
    write_abnormal_exit_report "$exit_status"
  fi
  cleanup
}

trap 'handle_exit $?' EXIT

# Check if agent is enabled via feature flags
log_info "=== QA Agent starting ===" | tee -a "$LOG_FILE"
log_info "Checking feature flags..." | tee -a "$LOG_FILE"
if ! check_agent_enabled "qa_agent_enabled"; then
  log_info "=== QA Agent disabled by feature flag — exiting gracefully ===" | tee -a "$LOG_FILE"
  exit 0
fi
log_success "Feature flags enabled — proceeding with QA Agent" | tee -a "$LOG_FILE"

cd "$PROJECT_DIR"

# Get configuration from local agent config
TESTS_PER_CATEGORY=$(get_agent_config "qa_agent_enabled" "testsPerCategory" || echo "3")
ENABLE_JOURNEY_TESTS=$(get_agent_config "qa_agent_enabled" "enableJourneyTests" || echo "true")
ENABLE_GITHUB_ISSUES=$(get_agent_config "qa_agent_enabled" "enableGithubIssues" || echo "true")
ENABLE_GAP_ANALYSIS=$(get_agent_config "qa_agent_enabled" "enableGapAnalysis" || echo "true")
log_info "Configuration: $TESTS_PER_CATEGORY tests/category, journeyTests=$ENABLE_JOURNEY_TESTS, githubIssues=$ENABLE_GITHUB_ISSUES, gapAnalysis=$ENABLE_GAP_ANALYSIS" | tee -a "$LOG_FILE"

VOYAGE_API_KEY_VALUE="$(get_config_value "VOYAGE_API_KEY")"
if [[ -n "$VOYAGE_API_KEY_VALUE" ]]; then
  export VOYAGE_API_KEY="$VOYAGE_API_KEY_VALUE"
fi

ANTHROPIC_API_KEY_VALUE="$(get_config_value "ANTHROPIC_API_KEY")"
if [[ -n "$ANTHROPIC_API_KEY_VALUE" ]]; then
  export ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY_VALUE"
fi

# Check if server is already running (any HTTP response = server is up)
CURRENT_PHASE="server startup"
PRECHECK_CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 http://localhost:3006/api/health 2>/dev/null || true)
[[ -z "$PRECHECK_CODE" ]] && PRECHECK_CODE="000"
if [[ "$PRECHECK_CODE" != "000" ]]; then
  log_info "Server already running on port 3006 (HTTP $PRECHECK_CODE)" | tee -a "$LOG_FILE"
else
  # QA-H3 (#870): this used to run `npm run dev`, which forces
  # NODE_ENV=development and routes every Anthropic call through the curl
  # subprocess transport (see src/lib/claude.ts USE_CURL) instead of the
  # Anthropic SDK production actually uses — different prompt structure (no
  # cache_control) and different retry semantics. The only weekly gate that
  # talks to a live model was validating a code path no real request takes.
  # Build and run the same production artifact `next start` serves in prod.
  log_info "Building production bundle (QA-H3: run the QA gate against a production build for parity with real traffic)..." | tee -a "$LOG_FILE"

  # VOYAGE_API_KEY (and ANTHROPIC_API_KEY) are already exported above when
  # present — no need to re-prefix them per-command.
  npm run build > "$SERVER_LOG" 2>&1
  BUILD_EXIT=$?
  if [[ $BUILD_EXIT -ne 0 ]]; then
    log_error "Production build failed (exit $BUILD_EXIT) — see $SERVER_LOG" | tee -a "$LOG_FILE"
    exit 1
  fi
  log_success "Production build complete" | tee -a "$LOG_FILE"

  log_info "Starting Next.js production server..." | tee -a "$LOG_FILE"

  # Start the server in the background
  npm run start -- --port 3006 >> "$SERVER_LOG" 2>&1 &
  SERVER_PID=$!

  # Wait for server to respond.
  # Accept any HTTP response (200 or 503) — both mean the server is up.
  # A 503 from /api/health means Supabase is degraded, not that the server failed to start.
  # Phase 0 health checks below will properly report Supabase degradation.
  #
  # QA-H3 (#870): MAX_WAIT only bounds the `next start` boot itself — the
  # build above already completed synchronously and is not part of this
  # budget. 240s was previously enough for `npm run dev`'s lazy/incremental
  # compile-on-first-request. This repo already runs the exact "build then
  # start, poll a health endpoint" pattern locally for Playwright E2E (see
  # `getWebServerCommand()` in playwright.config.ts: `npm run build && npm
  # run start`, 240_000ms webServer timeout, same machine class) — that
  # combined build+start budget is proven sufficient at 240s. `next start`
  # itself boots in seconds once built, so 120s here is a comfortable margin
  # above that precedent for the boot step alone.
  MAX_WAIT=120
  WAITED=0
  while true; do
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 2 "http://localhost:3006/api/health" 2>/dev/null || true)
    [[ -z "$HTTP_CODE" ]] && HTTP_CODE="000"
    [[ "$HTTP_CODE" != "000" ]] && break
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

  log_success "Production server ready (HTTP $HTTP_CODE, took ${WAITED}s)" | tee -a "$LOG_FILE"
fi

# =============================================================================
# PHASE 0: Integration Health Checks
# =============================================================================
log_info "=== Phase 0: Integration Health Checks ===" | tee -a "$LOG_FILE"
CURRENT_PHASE="phase 0 integration health checks"

HEALTH_CHECKS_PASSED=0
HEALTH_CHECKS_FAILED=0
HEALTH_CHECK_DETAILS=""
VOYAGE_HEALTH_STATUS="unknown"
VOYAGE_HEALTH_DETAILS=""
ANTHROPIC_HEALTH_STATUS="unknown"
ANTHROPIC_HEALTH_DETAILS=""
# Declare CI_E2E_STATUS/RUN_ID early so they are never unbound under set -u
# (Phase 0.5 re-assigns them after Phase 0 health metrics are written)
CI_E2E_STATUS="unknown"
CI_E2E_RUN_ID=""

# Check 1: App Health Endpoint
log_info "Checking app health..." | tee -a "$LOG_FILE"
HEALTH_RESPONSE=$(curl -s --max-time 10 "http://localhost:3006/api/health" 2>&1 || true)
if echo "$HEALTH_RESPONSE" | grep -q '"status":"healthy"'; then
  log_success "App health: OK" | tee -a "$LOG_FILE"
  HEALTH_CHECKS_PASSED=$((HEALTH_CHECKS_PASSED + 1))
else
  log_error "App health: FAILED - $HEALTH_RESPONSE" | tee -a "$LOG_FILE"
  HEALTH_CHECKS_FAILED=$((HEALTH_CHECKS_FAILED + 1))
  HEALTH_CHECK_DETAILS="${HEALTH_CHECK_DETAILS}\n- App health check failed: $HEALTH_RESPONSE"
fi

# Check 2: Database Connectivity (production endpoint)
log_info "Checking database connectivity..." | tee -a "$LOG_FILE"
DB_CURL_EXIT=0
DB_RESPONSE=$(retry_curl_probe "https://paisaxe.es/api/health/db") || DB_CURL_EXIT=$?
if [[ "$DB_CURL_EXIT" -eq 0 ]] && echo "$DB_RESPONSE" | grep -q '"success":true'; then
  DB_LATENCY=$(echo "$DB_RESPONSE" | grep -oE '"latencyMs":[0-9]+' | cut -d':' -f2 || echo "unknown")
  log_success "Database connectivity: OK (latency: ${DB_LATENCY}ms)" | tee -a "$LOG_FILE"
  HEALTH_CHECKS_PASSED=$((HEALTH_CHECKS_PASSED + 1))
else
  if [[ -z "$DB_RESPONSE" ]]; then
    DB_RESPONSE="empty response (curl exit code $DB_CURL_EXIT after retry — likely timeout or connection failure reaching https://paisaxe.es/api/health/db)"
  fi
  log_error "Database connectivity: FAILED - $DB_RESPONSE" | tee -a "$LOG_FILE"
  if echo "$DB_RESPONSE" | grep -q "not configured"; then
    log_warn "  -> Possible cause: Supabase environment variables missing or misconfigured" | tee -a "$LOG_FILE"
  fi
  HEALTH_CHECKS_FAILED=$((HEALTH_CHECKS_FAILED + 1))
  HEALTH_CHECK_DETAILS="${HEALTH_CHECK_DETAILS}\n- Database check failed: $DB_RESPONSE"
fi

# Check 3: Stripe Connectivity (checkout health endpoint — requires admin auth)
# The /api/checkout/health endpoint requires admin authentication (Supabase session cookies).
# From an unauthenticated context we can only verify the route is reachable and auth is enforced.
log_info "Checking Stripe endpoint reachability..." | tee -a "$LOG_FILE"
STRIPE_CURL_EXIT=0
STRIPE_HTTP_CODE=$(retry_curl_probe "https://paisaxe.es/api/checkout/health" -o /dev/null -w "%{http_code}") || STRIPE_CURL_EXIT=$?
if [[ "$STRIPE_CURL_EXIT" -ne 0 ]]; then
  STRIPE_HTTP_CODE="000 (curl exit code $STRIPE_CURL_EXIT after retry — likely timeout or connection failure reaching https://paisaxe.es/api/checkout/health)"
fi
if [[ "$STRIPE_HTTP_CODE" == "401" ]]; then
  log_success "Stripe endpoint: reachable, auth enforced (HTTP 401 — expected without admin session)" | tee -a "$LOG_FILE"
  HEALTH_CHECKS_PASSED=$((HEALTH_CHECKS_PASSED + 1))
elif [[ "$STRIPE_HTTP_CODE" == "200" ]]; then
  log_success "Stripe endpoint: OK (HTTP 200)" | tee -a "$LOG_FILE"
  HEALTH_CHECKS_PASSED=$((HEALTH_CHECKS_PASSED + 1))
else
  log_error "Stripe endpoint: unexpected response (HTTP $STRIPE_HTTP_CODE)" | tee -a "$LOG_FILE"
  HEALTH_CHECKS_FAILED=$((HEALTH_CHECKS_FAILED + 1))
  HEALTH_CHECK_DETAILS="${HEALTH_CHECK_DETAILS}\n- Stripe endpoint returned HTTP $STRIPE_HTTP_CODE (expected 401 or 200)"
fi

# Check 4: Voyage AI Embedding Availability
log_info "Checking Voyage AI embedding availability..." | tee -a "$LOG_FILE"
if [[ -z "$VOYAGE_API_KEY_VALUE" ]]; then
  VOYAGE_HEALTH_STATUS="FAIL"
  VOYAGE_HEALTH_DETAILS="VOYAGE_API_KEY is not set in the shell environment or .env.local"
  log_error "Voyage AI: FAILED - VOYAGE_API_KEY missing" | tee -a "$LOG_FILE"
  HEALTH_CHECKS_FAILED=$((HEALTH_CHECKS_FAILED + 1))
  HEALTH_CHECK_DETAILS="${HEALTH_CHECK_DETAILS}\n- Voyage AI check failed: $VOYAGE_HEALTH_DETAILS"
else
  export VOYAGE_API_KEY="$VOYAGE_API_KEY_VALUE"
  VOYAGE_HTTP_CODE=$(
    node <<'NODE' 2>/dev/null || true
const key = process.env.VOYAGE_API_KEY;
const body = {
  input: ["qa preflight"],
  model: "voyage-3.5",
  input_type: "query",
  output_dimension: 512,
};

fetch("https://api.voyageai.com/v1/embeddings", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(body),
  signal: AbortSignal.timeout(15_000),
})
  .then((response) => console.log(response.status))
  .catch(() => console.log("000"));
NODE
  )
  [[ -z "$VOYAGE_HTTP_CODE" ]] && VOYAGE_HTTP_CODE="000"

  if [[ "$VOYAGE_HTTP_CODE" == "200" ]]; then
    VOYAGE_HEALTH_STATUS="PASS"
    VOYAGE_HEALTH_DETAILS="Voyage AI embeddings endpoint reachable"
    log_success "Voyage AI: OK" | tee -a "$LOG_FILE"
    HEALTH_CHECKS_PASSED=$((HEALTH_CHECKS_PASSED + 1))
  else
    VOYAGE_HEALTH_STATUS="FAIL"
    VOYAGE_HEALTH_DETAILS="Voyage AI embeddings endpoint returned HTTP $VOYAGE_HTTP_CODE"
    log_error "Voyage AI: FAILED - HTTP $VOYAGE_HTTP_CODE" | tee -a "$LOG_FILE"
    HEALTH_CHECKS_FAILED=$((HEALTH_CHECKS_FAILED + 1))
    HEALTH_CHECK_DETAILS="${HEALTH_CHECK_DETAILS}\n- Voyage AI check failed: $VOYAGE_HEALTH_DETAILS"
  fi
fi

# Check 5: Anthropic Generation Availability
log_info "Checking Anthropic generation availability..." | tee -a "$LOG_FILE"
if [[ -z "$ANTHROPIC_API_KEY_VALUE" ]]; then
  ANTHROPIC_HEALTH_STATUS="FAIL"
  ANTHROPIC_HEALTH_DETAILS="ANTHROPIC_API_KEY is not set in the shell environment or .env.local"
  log_error "Anthropic: FAILED - ANTHROPIC_API_KEY missing" | tee -a "$LOG_FILE"
  HEALTH_CHECKS_FAILED=$((HEALTH_CHECKS_FAILED + 1))
  HEALTH_CHECK_DETAILS="${HEALTH_CHECK_DETAILS}\n- Anthropic check failed: $ANTHROPIC_HEALTH_DETAILS"
else
  ANTHROPIC_HTTP_CODE=$(
    node <<'NODE' 2>/dev/null || true
const key = process.env.ANTHROPIC_API_KEY;
const body = {
  model: "claude-sonnet-5",
  max_tokens: 1,
  messages: [{ role: "user", content: "Reply with OK" }],
};

fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: {
    "x-api-key": key,
    "anthropic-version": "2023-06-01",
    "Content-Type": "application/json",
  },
  body: JSON.stringify(body),
  signal: AbortSignal.timeout(15_000),
})
  .then((response) => console.log(response.status))
  .catch(() => console.log("000"));
NODE
  )
  [[ -z "$ANTHROPIC_HTTP_CODE" ]] && ANTHROPIC_HTTP_CODE="000"

  if [[ "$ANTHROPIC_HTTP_CODE" == "200" ]]; then
    ANTHROPIC_HEALTH_STATUS="PASS"
    ANTHROPIC_HEALTH_DETAILS="Anthropic messages endpoint accepted a minimal generation"
    log_success "Anthropic: OK" | tee -a "$LOG_FILE"
    HEALTH_CHECKS_PASSED=$((HEALTH_CHECKS_PASSED + 1))
  else
    ANTHROPIC_HEALTH_STATUS="FAIL"
    ANTHROPIC_HEALTH_DETAILS="Anthropic messages endpoint returned HTTP $ANTHROPIC_HTTP_CODE"
    log_error "Anthropic: FAILED - HTTP $ANTHROPIC_HTTP_CODE" | tee -a "$LOG_FILE"
    HEALTH_CHECKS_FAILED=$((HEALTH_CHECKS_FAILED + 1))
    HEALTH_CHECK_DETAILS="${HEALTH_CHECK_DETAILS}\n- Anthropic check failed: $ANTHROPIC_HEALTH_DETAILS"
  fi
fi

log_info "Health checks complete: $HEALTH_CHECKS_PASSED passed, $HEALTH_CHECKS_FAILED failed" | tee -a "$LOG_FILE"

# Send SMS alert for critical health check failures
if [[ $HEALTH_CHECKS_FAILED -gt 0 ]]; then
  log_warn "Critical failures detected — sending SMS alert..." | tee -a "$LOG_FILE"

  # Build list of failed checks
  FAILED_CHECK_NAMES=""
  if ! echo "$HEALTH_RESPONSE" | grep -q '"status":"healthy"' 2>/dev/null; then
    FAILED_CHECK_NAMES="App Health"
  fi
  if ! echo "$DB_RESPONSE" | grep -q '"success":true' 2>/dev/null; then
    [[ -n "$FAILED_CHECK_NAMES" ]] && FAILED_CHECK_NAMES="$FAILED_CHECK_NAMES, "
    FAILED_CHECK_NAMES="${FAILED_CHECK_NAMES}Database"
  fi
  if [[ "$STRIPE_HTTP_CODE" != "401" && "$STRIPE_HTTP_CODE" != "200" ]]; then
    [[ -n "$FAILED_CHECK_NAMES" ]] && FAILED_CHECK_NAMES="$FAILED_CHECK_NAMES, "
    FAILED_CHECK_NAMES="${FAILED_CHECK_NAMES}Stripe"
  fi
  if [[ "$VOYAGE_HEALTH_STATUS" != "PASS" ]]; then
    [[ -n "$FAILED_CHECK_NAMES" ]] && FAILED_CHECK_NAMES="$FAILED_CHECK_NAMES, "
    FAILED_CHECK_NAMES="${FAILED_CHECK_NAMES}Voyage AI"
  fi
  if [[ "$ANTHROPIC_HEALTH_STATUS" != "PASS" ]]; then
    [[ -n "$FAILED_CHECK_NAMES" ]] && FAILED_CHECK_NAMES="$FAILED_CHECK_NAMES, "
    FAILED_CHECK_NAMES="${FAILED_CHECK_NAMES}Anthropic"
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
  echo "- Voyage AI Status: $VOYAGE_HEALTH_STATUS"
  echo "- Anthropic Status: $ANTHROPIC_HEALTH_STATUS"
  echo "- CI E2E Status: ${CI_E2E_STATUS:-unknown}"
  if [[ -n "$HEALTH_CHECK_DETAILS" ]]; then
    echo ""
    echo "FAILURE DETAILS:"
    echo -e "$HEALTH_CHECK_DETAILS"
  fi
  if [[ "${CI_E2E_STATUS:-unknown}" == "FAIL" ]]; then
    echo ""
    echo "CI E2E REGRESSION: E2E tests are failing on develop (run ${CI_E2E_RUN_ID:-})."
    echo "This blocks production releases. Investigate immediately:"
    echo "  gh run view ${CI_E2E_RUN_ID:-} --log-failed"
  fi
} > "$HEALTH_METRICS_FILE"

# =============================================================================
# PHASE 0.5: CI E2E Status Check
# =============================================================================
log_info "=== Phase 0.5: CI E2E Status Check ===" | tee -a "$LOG_FILE"
CURRENT_PHASE="phase 0.5 CI E2E status check"

CI_E2E_STATUS="unknown"
CI_E2E_CONCLUSION=""
if command -v gh &>/dev/null; then
  # Get the latest E2E workflow run on develop
  CI_E2E_JSON=$(gh run list --workflow=e2e.yml --branch=develop --limit=1 --json conclusion,status,databaseId 2>/dev/null || echo "[]")
  CI_E2E_CONCLUSION=$(echo "$CI_E2E_JSON" | jq -r '.[0].conclusion // "unknown"' 2>/dev/null || echo "unknown")
  CI_E2E_RUN_ID=$(echo "$CI_E2E_JSON" | jq -r '.[0].databaseId // ""' 2>/dev/null || echo "")

  if [[ "$CI_E2E_CONCLUSION" == "success" ]]; then
    CI_E2E_STATUS="PASS"
    log_success "CI E2E: PASS (run $CI_E2E_RUN_ID)" | tee -a "$LOG_FILE"
  elif [[ "$CI_E2E_CONCLUSION" == "failure" ]]; then
    CI_E2E_STATUS="FAIL"
    log_error "CI E2E: FAIL (run $CI_E2E_RUN_ID) — E2E tests are failing on develop!" | tee -a "$LOG_FILE"
    log_error "  -> This means production-blocking regressions may exist." | tee -a "$LOG_FILE"
    log_error "  -> Investigate: gh run view $CI_E2E_RUN_ID --log-failed" | tee -a "$LOG_FILE"
  else
    CI_E2E_STATUS="$CI_E2E_CONCLUSION"
    log_warn "CI E2E: $CI_E2E_CONCLUSION (run $CI_E2E_RUN_ID)" | tee -a "$LOG_FILE"
  fi
else
  log_warn "CI E2E: gh CLI not available — skipping check" | tee -a "$LOG_FILE"
fi

# =============================================================================
# PHASE 1: LLM Quality Tests
# =============================================================================
log_info "=== Phase 1: LLM Quality Tests ===" | tee -a "$LOG_FILE"
CURRENT_PHASE="phase 1 LLM quality tests"

export QA_TESTS_PER_CATEGORY="$TESTS_PER_CATEGORY"
export NEXT_PUBLIC_SITE_URL="http://localhost:3006"

# Run vitest and capture both output and exit code
TEST_EXIT_CODE=0
if [[ "$VOYAGE_HEALTH_STATUS" != "PASS" ]]; then
  TEST_OUTPUT="QA PREFLIGHT: Voyage AI embedding availability failed - ${VOYAGE_HEALTH_DETAILS}. Set VOYAGE_API_KEY in the QA environment or .env.local before running npm run test:qa."
  TEST_EXIT_CODE=1
elif [[ "$ANTHROPIC_HEALTH_STATUS" != "PASS" ]]; then
  TEST_OUTPUT="QA PREFLIGHT: Anthropic generation availability failed - ${ANTHROPIC_HEALTH_DETAILS}. Set ANTHROPIC_API_KEY in the QA environment or .env.local before running npm run test:qa."
  TEST_EXIT_CODE=1
else
  TEST_OUTPUT=$(NO_COLOR=1 npm run test:qa 2>&1) || TEST_EXIT_CODE=$?
fi
TEST_EXIT_CODE=${TEST_EXIT_CODE:-0}

# Strip ANSI escapes defensively before parsing. Vitest's summary line can
# begin with a color escape (e.g. ESC[2m) before the leading whitespace, which
# breaks an anchored `^ *Tests ` grep even with NO_COLOR set upstream (some
# terminals/CI force color regardless) and silently parses every count as 0.
TEST_OUTPUT_PLAIN=$(printf '%s' "$TEST_OUTPUT" | sed -E 's/\x1b\[[0-9;]*m//g')

# Parse test results from vitest output. Vitest's summary block has both a
# "Test Files  N passed" line and a "Tests  M passed" line; without anchoring
# to "Tests" specifically, grep matches the Test Files line first and reports
# the file count instead of the test count.
PASSED_TESTS=$(printf '%s' "$TEST_OUTPUT_PLAIN" | grep -E '^ *Tests ' | grep -oE '[0-9]+ passed' | head -1 | awk '{print $1}')
FAILED_TESTS=$(printf '%s' "$TEST_OUTPUT_PLAIN" | grep -E '^ *Tests ' | grep -oE '[0-9]+ failed' | head -1 | awk '{print $1}')
PASSED_TESTS=${PASSED_TESTS:-0}
FAILED_TESTS=${FAILED_TESTS:-0}
TOTAL_TESTS=$((PASSED_TESTS + FAILED_TESTS))

# A 0-test result is ambiguous: it could be a real empty run, or a parser that
# failed to match the summary line. Preflight failures aside, a non-zero
# vitest exit code with zero parsed tests means the parser broke, not that
# nothing ran — flag it distinctly so a 0% pass rate never masquerades as a
# real measurement.
PARSE_FAILURE=false
if [[ $TOTAL_TESTS -eq 0 && $TEST_EXIT_CODE -ne 0 && "$VOYAGE_HEALTH_STATUS" == "PASS" && "$ANTHROPIC_HEALTH_STATUS" == "PASS" ]]; then
  PARSE_FAILURE=true
  log_error "Parsed 0 tests from a failed run (exit $TEST_EXIT_CODE) — likely a test-count parser failure, not a real 0-test result" | tee -a "$LOG_FILE"
fi

# Calculate pass rate
if [[ $TOTAL_TESTS -gt 0 ]]; then
  PASS_RATE=$((PASSED_TESTS * 100 / TOTAL_TESTS))
else
  PASS_RATE=0
fi

log_info "Test results: $PASSED_TESTS passed, $FAILED_TESTS failed ($PASS_RATE% pass rate)" | tee -a "$LOG_FILE"

# Extract failed test details
FAILED_DETAILS=$(echo "$TEST_OUTPUT_PLAIN" | grep -A 20 "FAIL\|AssertionError\|Expected\|Received" || echo "No failure details available")

# Write metrics to temp file for Claude
{
  echo "QA TEST METRICS ($(date '+%Y-%m-%d'))"
  echo "====================================="
  echo ""
  echo "TEST SUMMARY:"
  if [[ "$PARSE_FAILURE" == "true" ]]; then
    echo "- PARSE FAILURE: vitest exited non-zero but 0 tests were parsed from its output."
    echo "  Treat this as a broken measurement, not a real 0-test/0% result."
  fi
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
  echo "$TEST_OUTPUT_PLAIN"
  echo ""
  if [[ $FAILED_TESTS -gt 0 ]]; then
    echo "FAILED TEST DETAILS:"
    echo "$FAILED_DETAILS"
  fi
} > "$METRICS_FILE"

# =============================================================================
# PHASE 2: Browser Journey Tests (Playwright)
# =============================================================================
CURRENT_PHASE="phase 2 browser journey tests"
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
CURRENT_PHASE="phase 3 test user cleanup"

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
CURRENT_PHASE="phase 4 GitHub issue filing"

TOTAL_FAILURES=$((FAILED_TESTS + JOURNEY_FAILED + HEALTH_CHECKS_FAILED))

if [[ "$ENABLE_GITHUB_ISSUES" == "true" && $TOTAL_FAILURES -gt 0 ]]; then
  log_info "Filing GitHub issues for $TOTAL_FAILURES failures..." | tee -a "$LOG_FILE"

  # File issues for LLM test failures
  if [[ $FAILED_TESTS -gt 0 ]]; then
    # Extract individual failure names and create issues
    FAILURE_NAMES=$(echo "$TEST_OUTPUT_PLAIN" | grep -E "^\s*[✗×]|FAIL" | head -5 || echo "")
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
- Test manually: \`curl -I https://paisaxe.es/api/checkout/health\` (expects 401 without admin session)"

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
# PHASE 6: Test Gap Analysis
# =============================================================================
CURRENT_PHASE="phase 6 test gap analysis"
GAP_METRICS_FILE="$PROJECT_DIR/.qa-gap-metrics.tmp"

if [[ "$ENABLE_GAP_ANALYSIS" == "true" ]]; then
  log_info "=== Phase 6: Test Gap Analysis ===" | tee -a "$LOG_FILE"

  GAP_HIGH=""
  GAP_MEDIUM=""
  GAP_LOW=""

  # --- 6a: Feature flags in type definition vs mock fixture ---
  log_info "Checking feature flag coverage in E2E mocks..." | tee -a "$LOG_FILE"

  TYPE_FLAGS=$(sed -n '/^export type FeatureFlagKey/,/;$/p' "$PROJECT_DIR/src/types/feature-flags.ts" | grep -oE '"[a-z_]+"' | tr -d '"' | sort)
  MOCK_FLAGS=$(grep -oE 'flagKey: "[a-z_]+"' "$PROJECT_DIR/e2e/fixtures/mock-data.ts" | grep -oE '"[a-z_]+"' | tr -d '"' | sort)

  # Agent/internal flags don't belong in the E2E mock fixture
  INTERNAL_FLAG_PATTERN="_agent_enabled$|^automated_agents$|^maintenance_mode$"
  MISSING_FLAGS=$(comm -23 <(echo "$TYPE_FLAGS") <(echo "$MOCK_FLAGS") | grep -vE "$INTERNAL_FLAG_PATTERN" || true)

  if [[ -n "$MISSING_FLAGS" ]]; then
    while IFS= read -r flag; do
      [[ -z "$flag" ]] && continue
      GAP_MEDIUM="${GAP_MEDIUM}\n- Feature flag \`${flag}\` — missing from MOCK_FEATURE_FLAGS in \`e2e/fixtures/mock-data.ts\`"
    done <<< "$MISSING_FLAGS"
    FLAG_COUNT=$(echo "$MISSING_FLAGS" | grep -c . || true)
    log_warn "Found $FLAG_COUNT feature flags missing from E2E mocks" | tee -a "$LOG_FILE"
  else
    log_success "All user-facing feature flags present in E2E mocks" | tee -a "$LOG_FILE"
  fi

  # --- 6b: API routes vs E2E smoke tests ---
  log_info "Checking API route E2E coverage..." | tee -a "$LOG_FILE"

  API_ROUTES=$(ls -d "$PROJECT_DIR"/src/app/api/*/ 2>/dev/null | xargs -I{} basename {} | sort)

  for route in $API_ROUTES; do
    if ! grep -rq "/api/${route}" "$PROJECT_DIR"/e2e/*.spec.ts 2>/dev/null; then
      GAP_HIGH="${GAP_HIGH}\n- \`/api/${route}\` — no E2E spec references this route"
    fi
  done

  # --- 6c: Pages vs E2E load tests ---
  log_info "Checking page E2E coverage..." | tee -a "$LOG_FILE"

  PAGES=$(find "$PROJECT_DIR/src/app" -name "page.tsx" -not -path "*/api/*" | sed "s|$PROJECT_DIR/src/app||" | sed 's|/page.tsx||' | sed 's|^$|/|' | sort)

  for page_path in $PAGES; do
    # Skip dynamic routes like [slug] — too hard to match reliably
    [[ "$page_path" == *"["* ]] && continue
    # Root page "/" would match everything — search for explicit root navigation
    if [[ "$page_path" == "/" ]]; then
      if ! grep -rqE "goto\(['\"]/" "$PROJECT_DIR"/e2e/*.spec.ts 2>/dev/null; then
        GAP_LOW="${GAP_LOW}\n- Page \`/\` — no E2E load/render test found"
      fi
    else
      if ! grep -rq "${page_path}" "$PROJECT_DIR"/e2e/*.spec.ts 2>/dev/null; then
        GAP_LOW="${GAP_LOW}\n- Page \`${page_path}\` — no E2E load/render test found"
      fi
    fi
  done

  # --- 6d: data-testid in source vs E2E specs ---
  log_info "Checking data-testid coverage..." | tee -a "$LOG_FILE"

  SOURCE_TESTIDS=$(grep -roh 'data-testid="[^"]*"' "$PROJECT_DIR/src/" 2>/dev/null | grep -oE '"[^"]*"' | tr -d '"' | sort -u || true)
  E2E_TESTIDS=$(grep -rohE "data-testid=['\"][^'\"]+['\"]|getByTestId\(['\"][^'\"]+['\"]\)" "$PROJECT_DIR/e2e/" 2>/dev/null | grep -oE "['\"][a-zA-Z0-9_-]+['\"]" | tr -d "'" | tr -d '"' | sort -u || true)

  if [[ -n "$SOURCE_TESTIDS" && -n "$E2E_TESTIDS" ]]; then
    UNTESTED_TESTIDS=$(comm -23 <(echo "$SOURCE_TESTIDS") <(echo "$E2E_TESTIDS") 2>/dev/null || true)
  elif [[ -n "$SOURCE_TESTIDS" ]]; then
    UNTESTED_TESTIDS="$SOURCE_TESTIDS"
  else
    UNTESTED_TESTIDS=""
  fi

  if [[ -n "$UNTESTED_TESTIDS" ]]; then
    UNTESTED_COUNT=$(echo "$UNTESTED_TESTIDS" | grep -c . || true)
    if [[ $UNTESTED_COUNT -le 10 ]]; then
      while IFS= read -r testid; do
        [[ -z "$testid" ]] && continue
        GAP_LOW="${GAP_LOW}\n- \`data-testid=\"${testid}\"\` — defined in source but not referenced in E2E specs"
      done <<< "$UNTESTED_TESTIDS"
    else
      GAP_LOW="${GAP_LOW}\n- ${UNTESTED_COUNT} \`data-testid\` attributes in source are not referenced in any E2E spec"
    fi
    log_info "Found $UNTESTED_COUNT untested data-testid attributes" | tee -a "$LOG_FILE"
  fi

  # --- Write gap analysis results ---
  {
    echo ""
    echo "E2E TEST GAP ANALYSIS:"
    echo "======================"
    if [[ -n "$GAP_HIGH" ]]; then
      echo ""
      echo "HIGH PRIORITY (untested API routes):"
      echo -e "$GAP_HIGH"
    fi
    if [[ -n "$GAP_MEDIUM" ]]; then
      echo ""
      echo "MEDIUM PRIORITY (missing mock fixtures):"
      echo -e "$GAP_MEDIUM"
    fi
    if [[ -n "$GAP_LOW" ]]; then
      echo ""
      echo "LOW PRIORITY (pages and test IDs without E2E coverage):"
      echo -e "$GAP_LOW"
    fi
    if [[ -z "$GAP_HIGH" && -z "$GAP_MEDIUM" && -z "$GAP_LOW" ]]; then
      echo ""
      echo "No test gaps detected. All features, routes, and pages have E2E coverage."
    fi
  } > "$GAP_METRICS_FILE"

  TOTAL_GAPS=0
  [[ -n "$GAP_HIGH" ]] && TOTAL_GAPS=$((TOTAL_GAPS + $(echo -e "$GAP_HIGH" | grep -c "^-" || true)))
  [[ -n "$GAP_MEDIUM" ]] && TOTAL_GAPS=$((TOTAL_GAPS + $(echo -e "$GAP_MEDIUM" | grep -c "^-" || true)))
  [[ -n "$GAP_LOW" ]] && TOTAL_GAPS=$((TOTAL_GAPS + $(echo -e "$GAP_LOW" | grep -c "^-" || true)))

  if [[ $TOTAL_GAPS -gt 0 ]]; then
    log_warn "Found $TOTAL_GAPS test coverage gaps" | tee -a "$LOG_FILE"
  else
    log_success "No test coverage gaps detected" | tee -a "$LOG_FILE"
  fi
else
  log_info "=== Phase 6: Test Gap Analysis (SKIPPED - disabled in config) ===" | tee -a "$LOG_FILE"
  echo "Test gap analysis skipped (disabled in config)" > "$GAP_METRICS_FILE"
fi

# =============================================================================
# PHASE 5: Claude Analysis & Report Generation
# =============================================================================
log_info "=== Phase 5: Claude Analysis & Report ===" | tee -a "$LOG_FILE"
CURRENT_PHASE="phase 5 report generation"
log_info "Metrics collected, invoking Claude for analysis..." | tee -a "$LOG_FILE"

# Load the agent prompt from shared TypeScript config
AGENT_PROMPT=$(get_default_prompt "qa_agent_enabled" 2>/dev/null) || {
  log_error "No prompt available for qa_agent_enabled" | tee -a "$LOG_FILE"
  exit 1
}

# Read shared context from other agents
log_info "Reading shared context..." | tee -a "$LOG_FILE"
SHARED_CONTEXT=$(read_shared_context "qa_agent_enabled")
SHARED_CONTEXT_READ=$(npx tsx "$PROJECT_DIR/scripts/lib/print-shared-context-instructions.ts" read 2>/dev/null || echo "")
SHARED_CONTEXT_WRITE=$(npx tsx "$PROJECT_DIR/scripts/lib/print-shared-context-instructions.ts" write 2>/dev/null || echo "")

# Run Claude to analyze and write report
"$CLAUDE_BIN" -p \
  --model "$MODEL" \
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

Test gap analysis:
$(cat "$GAP_METRICS_FILE" 2>/dev/null || echo "No gap analysis data available")

$SHARED_CONTEXT_READ

$SHARED_CONTEXT

$SHARED_CONTEXT_WRITE
PROMPT

log_success "Claude analysis complete" | tee -a "$LOG_FILE"

# Extract and write shared context
REPORT_CONTENT=$(cat "$REPORT_FILE")
CONTEXT_BLOCK=$(echo "$REPORT_CONTENT" | sed -n '/SHARED_CONTEXT_START/,/SHARED_CONTEXT_END/p' | sed '1d;$d')

if [[ -n "$CONTEXT_BLOCK" ]]; then
  write_shared_context "qa_agent_enabled" "$CONTEXT_BLOCK"
  log_success "Shared context updated" | tee -a "$LOG_FILE"

  # Strip the shared context block from the report
  python3 -c "
import re, sys
content = sys.stdin.read()
cleaned = re.sub(r'\n?SHARED_CONTEXT_START\n.*?SHARED_CONTEXT_END\n?', '', content, flags=re.DOTALL)
sys.stdout.write(cleaned)
" < "$REPORT_FILE" > "${REPORT_FILE}.tmp"
  mv "${REPORT_FILE}.tmp" "$REPORT_FILE"
else
  log_info "No shared context block found in report" | tee -a "$LOG_FILE"
fi

# Cleanup handled by trap
CURRENT_PHASE="complete"
RUN_COMPLETED=true
log_success "QA report written to $REPORT_FILE" | tee -a "$LOG_FILE"
log_info "=== QA Agent finished ===" | tee -a "$LOG_FILE"
