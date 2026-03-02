#!/usr/bin/env bash
# Performance Agent — Runs weekly on Saturday at 10:00 AM via launchd (com.paisaxe.performance-agent)
# Analyzes bundle sizes, identifies optimization opportunities, tracks regressions
set -euo pipefail

PROJECT_DIR="/Users/juan/Documents/code/paisaxe"
CLAUDE_BIN="/Users/juan/.local/bin/claude"
LOG_DIR="$PROJECT_DIR/logs"
LOG_FILE="$LOG_DIR/performance-agent-$(date +%Y-%m-%d).log"
REPORT_FILE="$PROJECT_DIR/docs/agents/performance-report.md"
HISTORY_FILE="$PROJECT_DIR/.performance-history.json"
METRICS_FILE="$PROJECT_DIR/.performance-metrics.tmp"

mkdir -p "$LOG_DIR"

# Source shared utilities and check feature flags
source "$PROJECT_DIR/scripts/lib/agent-utils.sh"

# Check if agent is enabled via feature flags
log_info "=== Performance Agent starting ===" | tee -a "$LOG_FILE"
log_info "Checking feature flags..." | tee -a "$LOG_FILE"
if ! check_agent_enabled "performance_agent_enabled"; then
  log_info "=== Performance Agent disabled by feature flag — exiting gracefully ===" | tee -a "$LOG_FILE"
  exit 0
fi
log_success "Feature flags enabled — proceeding with Performance Agent" | tee -a "$LOG_FILE"

cd "$PROJECT_DIR"

# Performance budgets (thresholds for warnings)
BUDGET_TOTAL_JS_KB=2500      # 2.5 MB total JS
BUDGET_LARGEST_CHUNK_KB=500  # 500 KB per chunk
BUDGET_NODE_MODULES_MB=1000  # 1 GB node_modules
BUDGET_PROD_DEPS=40          # Max production dependencies

# Initialize metrics collection
log_info "Collecting performance metrics..." | tee -a "$LOG_FILE"

# Build the app to get accurate bundle sizes.
# If the dev server is running, stop it first, build, then restart it.
FRESH_BUILD=true
BUILD_OUTPUT=""
DEV_SERVER_PID=""
RESTART_DEV_SERVER=false

# Detect if the dev server is running on port 3000
DEV_SERVER_PID=$(lsof -ti :3000 2>/dev/null | head -1)
if [[ -n "$DEV_SERVER_PID" ]]; then
  log_info "Dev server detected (PID $DEV_SERVER_PID) — stopping for production build..." | tee -a "$LOG_FILE"
  kill "$DEV_SERVER_PID" 2>/dev/null
  # Wait for the process to exit (up to 10 seconds)
  for i in $(seq 1 20); do
    if ! kill -0 "$DEV_SERVER_PID" 2>/dev/null; then
      break
    fi
    sleep 0.5
  done
  # Force kill if still alive
  if kill -0 "$DEV_SERVER_PID" 2>/dev/null; then
    kill -9 "$DEV_SERVER_PID" 2>/dev/null
    sleep 1
  fi
  RESTART_DEV_SERVER=true
  log_success "Dev server stopped" | tee -a "$LOG_FILE"
fi

log_info "Building application..." | tee -a "$LOG_FILE"
if BUILD_OUTPUT=$(npm run build 2>&1); then
  log_success "Build completed" | tee -a "$LOG_FILE"
else
  FRESH_BUILD=false
  if [[ -d ".next/static" ]]; then
    log_warn "Build failed. Using existing .next data for analysis." | tee -a "$LOG_FILE"
  else
    log_error "Build failed and no existing .next/static data to analyze" | tee -a "$LOG_FILE"
    echo "$BUILD_OUTPUT" >> "$LOG_FILE"
    # Still try to restart dev server before exiting
    if [[ "$RESTART_DEV_SERVER" == "true" ]]; then
      log_info "Restarting dev server..." | tee -a "$LOG_FILE"
      cd "$PROJECT_DIR" && nohup npm run dev > /dev/null 2>&1 &
      log_success "Dev server restarted" | tee -a "$LOG_FILE"
    fi
    exit 1
  fi
fi

# Collect metrics
log_info "Analyzing bundle sizes..." | tee -a "$LOG_FILE"

# Get JS bundle sizes
TOTAL_JS_BYTES=$(find .next/static -name "*.js" -type f -exec stat -f%z {} + 2>/dev/null | awk '{s+=$1} END {print s}')
TOTAL_JS_KB=$((TOTAL_JS_BYTES / 1024))

# Get largest chunks with their sizes
LARGEST_CHUNKS=$(find .next/static -name "*.js" -type f -exec stat -f "%z %N" {} \; 2>/dev/null | sort -rn | head -10)

# Get CSS size
TOTAL_CSS_BYTES=$(find .next/static -name "*.css" -type f -exec stat -f%z {} + 2>/dev/null | awk '{s+=$1} END {print s}')
TOTAL_CSS_KB=$((TOTAL_CSS_BYTES / 1024))

# Dependency counts
PROD_DEPS=$(jq -r '.dependencies | keys | length' package.json 2>/dev/null || echo "0")
DEV_DEPS=$(jq -r '.devDependencies | keys | length' package.json 2>/dev/null || echo "0")

# Disk usage
NODE_MODULES_MB=$(du -sm node_modules 2>/dev/null | cut -f1)
NEXT_DIR_MB=$(du -sm .next 2>/dev/null | cut -f1)

# Get largest node_modules packages
LARGEST_PACKAGES=$(du -sm node_modules/*/ 2>/dev/null | sort -rn | head -15)

# Check for heavy dependencies that could be optimized
HEAVY_DEPS=""
if [[ -d "node_modules/moment" ]]; then HEAVY_DEPS="$HEAVY_DEPS moment"; fi
if [[ -d "node_modules/lodash" ]] && [[ ! -d "node_modules/lodash-es" ]]; then HEAVY_DEPS="$HEAVY_DEPS lodash"; fi
if [[ -d "node_modules/@mui" ]]; then HEAVY_DEPS="$HEAVY_DEPS @mui"; fi

# Load previous metrics for comparison
PREV_TOTAL_JS_KB=0
PREV_PROD_DEPS=0
if [[ -f "$HISTORY_FILE" ]]; then
  PREV_TOTAL_JS_KB=$(jq -r '.[-1].total_js_kb // 0' "$HISTORY_FILE" 2>/dev/null || echo "0")
  PREV_PROD_DEPS=$(jq -r '.[-1].prod_deps // 0' "$HISTORY_FILE" 2>/dev/null || echo "0")
fi

# Calculate changes
JS_CHANGE_KB=$((TOTAL_JS_KB - PREV_TOTAL_JS_KB))
DEPS_CHANGE=$((PROD_DEPS - PREV_PROD_DEPS))

# Determine budget violations
VIOLATIONS=""
if [[ $TOTAL_JS_KB -gt $BUDGET_TOTAL_JS_KB ]]; then
  VIOLATIONS="$VIOLATIONS\n- Total JS ($TOTAL_JS_KB KB) exceeds budget ($BUDGET_TOTAL_JS_KB KB)"
fi
if [[ $PROD_DEPS -gt $BUDGET_PROD_DEPS ]]; then
  VIOLATIONS="$VIOLATIONS\n- Production deps ($PROD_DEPS) exceeds budget ($BUDGET_PROD_DEPS)"
fi
if [[ $NODE_MODULES_MB -gt $BUDGET_NODE_MODULES_MB ]]; then
  VIOLATIONS="$VIOLATIONS\n- node_modules (${NODE_MODULES_MB}MB) exceeds budget (${BUDGET_NODE_MODULES_MB}MB)"
fi

# Write metrics to temp file for Claude
{
  echo "PERFORMANCE METRICS ($(date '+%Y-%m-%d'))"
  echo "========================================="
  echo ""
  if [[ "$FRESH_BUILD" == "false" ]]; then
    echo "NOTE: Production build was skipped (dev server was running)."
    echo "Bundle sizes below are from the dev server's .next cache — they may"
    echo "differ from a production build. Dependency and disk metrics are still accurate."
    echo ""
  fi
  echo "BUNDLE SIZES:"
  echo "- Total JS: ${TOTAL_JS_KB} KB (previous: ${PREV_TOTAL_JS_KB} KB, change: ${JS_CHANGE_KB} KB)"
  echo "- Total CSS: ${TOTAL_CSS_KB} KB"
  echo "- Budget: ${BUDGET_TOTAL_JS_KB} KB"
  echo ""
  echo "LARGEST JS CHUNKS:"
  echo "$LARGEST_CHUNKS"
  echo ""
  echo "DEPENDENCIES:"
  echo "- Production: $PROD_DEPS (previous: $PREV_PROD_DEPS, change: $DEPS_CHANGE)"
  echo "- Development: $DEV_DEPS"
  echo "- Budget: $BUDGET_PROD_DEPS production deps"
  echo ""
  echo "LARGEST NODE_MODULES PACKAGES:"
  echo "$LARGEST_PACKAGES"
  echo ""
  echo "DISK USAGE:"
  echo "- node_modules: ${NODE_MODULES_MB} MB"
  echo "- .next: ${NEXT_DIR_MB} MB"
  echo ""
  if [[ -n "$HEAVY_DEPS" ]]; then
    echo "POTENTIALLY HEAVY DEPENDENCIES DETECTED:"
    echo "$HEAVY_DEPS"
    echo ""
  fi
  if [[ -n "$VIOLATIONS" ]]; then
    echo "BUDGET VIOLATIONS:"
    echo -e "$VIOLATIONS"
    echo ""
  fi
} > "$METRICS_FILE"

log_info "Metrics collected, invoking Claude for analysis..." | tee -a "$LOG_FILE"

# Fetch the prompt from the feature flag config
AGENT_PROMPT=$(get_agent_prompt "performance_agent_enabled" 2>/dev/null) || {
  log_warn "Could not fetch prompt from config, trying shared default" | tee -a "$LOG_FILE"
  AGENT_PROMPT=$(get_default_prompt "performance_agent_enabled" 2>/dev/null) || {
    log_error "No prompt available for performance_agent_enabled" | tee -a "$LOG_FILE"
    exit 1
  }
}

# Read shared context from other agents
log_info "Reading shared context..." | tee -a "$LOG_FILE"
SHARED_CONTEXT=$(read_shared_context "performance_agent_enabled")
SHARED_CONTEXT_READ=$(npx tsx "$PROJECT_DIR/scripts/lib/print-shared-context-instructions.ts" read 2>/dev/null || echo "")
SHARED_CONTEXT_WRITE=$(npx tsx "$PROJECT_DIR/scripts/lib/print-shared-context-instructions.ts" write 2>/dev/null || echo "")

# Run Claude to analyze and write report
"$CLAUDE_BIN" -p \
  --allowedTools 'Read,Edit,Write,Glob,Grep' \
  >> "$LOG_FILE" 2>&1 <<PROMPT
$AGENT_PROMPT

Additional context:
- Project directory: $PROJECT_DIR
- Report file: $REPORT_FILE
- Date: $(date '+%Y-%m-%d')

Current metrics:
$(cat "$METRICS_FILE")

Build output summary:
$(if [[ "$FRESH_BUILD" == "true" ]]; then echo "$BUILD_OUTPUT" | grep -E "Route|○|ƒ|Size|First|modules" | head -30; else echo "(No build output — dev server was running, used cached .next data)"; fi)

$SHARED_CONTEXT_READ

$SHARED_CONTEXT

$SHARED_CONTEXT_WRITE
PROMPT

log_success "Claude analysis complete" | tee -a "$LOG_FILE"

# Extract and write shared context
REPORT_CONTENT=$(cat "$REPORT_FILE")
CONTEXT_BLOCK=$(echo "$REPORT_CONTENT" | sed -n '/SHARED_CONTEXT_START/,/SHARED_CONTEXT_END/p' | sed '1d;$d')

if [[ -n "$CONTEXT_BLOCK" ]]; then
  write_shared_context "performance_agent_enabled" "$CONTEXT_BLOCK"
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

# Update history file
log_info "Updating performance history..." | tee -a "$LOG_FILE"
NEW_ENTRY=$(jq -n \
  --arg date "$(date '+%Y-%m-%d')" \
  --argjson total_js_kb "$TOTAL_JS_KB" \
  --argjson total_css_kb "$TOTAL_CSS_KB" \
  --argjson prod_deps "$PROD_DEPS" \
  --argjson node_modules_mb "$NODE_MODULES_MB" \
  '{date: $date, total_js_kb: $total_js_kb, total_css_kb: $total_css_kb, prod_deps: $prod_deps, node_modules_mb: $node_modules_mb}')

if [[ -f "$HISTORY_FILE" ]]; then
  # Append to existing history (keep last 52 weeks)
  jq --argjson new "$NEW_ENTRY" '. + [$new] | .[-52:]' "$HISTORY_FILE" > "${HISTORY_FILE}.tmp"
  mv "${HISTORY_FILE}.tmp" "$HISTORY_FILE"
else
  # Create new history file
  echo "[$NEW_ENTRY]" > "$HISTORY_FILE"
fi

# Cleanup
rm -f "$METRICS_FILE"

# Restart dev server if we stopped it
if [[ "$RESTART_DEV_SERVER" == "true" ]]; then
  log_info "Restarting dev server..." | tee -a "$LOG_FILE"
  cd "$PROJECT_DIR" && nohup npm run dev > /dev/null 2>&1 &
  log_success "Dev server restarted" | tee -a "$LOG_FILE"
fi

log_success "Performance report written to $REPORT_FILE" | tee -a "$LOG_FILE"
log_info "=== Performance Agent finished ===" | tee -a "$LOG_FILE"
