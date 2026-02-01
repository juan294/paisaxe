#!/usr/bin/env bash
# Performance Agent — Runs weekly on Saturday at 10:00 AM via launchd (com.paisaxe.performance-agent)
# Analyzes bundle sizes, identifies optimization opportunities, tracks regressions
set -euo pipefail

PROJECT_DIR="/Users/juan/Documents/GenAI_Projects/paisaxe"
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

# Build the app to get accurate bundle sizes
log_info "Building application..." | tee -a "$LOG_FILE"
BUILD_OUTPUT=$(npm run build 2>&1) || {
  log_error "Build failed" | tee -a "$LOG_FILE"
  echo "$BUILD_OUTPUT" >> "$LOG_FILE"
  exit 1
}
log_success "Build completed" | tee -a "$LOG_FILE"

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
  log_warn "Could not fetch prompt from config, using default" | tee -a "$LOG_FILE"
  AGENT_PROMPT="You are the Paisaxe Performance Agent. Your job is to analyze performance metrics and provide actionable optimization recommendations.

STEPS:
1. Read the metrics file to understand current performance state
2. Identify the largest bundles and what might be causing them
3. Check package.json to understand which dependencies might be heavy
4. Look for optimization opportunities (lazy loading, tree shaking, code splitting)
5. Write a comprehensive report to docs/agents/performance-report.md

ANALYSIS FOCUS:
- Large JS chunks: What's in them? Can they be split or lazy-loaded?
- Heavy dependencies: Are there lighter alternatives?
- Bundle growth: Is the bundle getting larger over time?
- Quick wins: What can be optimized with minimal effort?

REPORT STRUCTURE:
1. Summary with health status (green/yellow/red based on budgets)
2. Key metrics table
3. Budget status (which are exceeded)
4. Top optimization opportunities (prioritized by impact)
5. Specific recommendations with code examples where helpful
6. Comparison to previous run (regressions/improvements)

RULES:
- Be specific: 'framer-motion adds 150KB' not 'some packages are large'
- Be actionable: 'Add dynamic import for ElevenLabs' not 'consider lazy loading'
- Prioritize by impact: Biggest savings first
- Include code snippets for complex recommendations"
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

Current metrics:
$(cat "$METRICS_FILE")

Build output summary:
$(echo "$BUILD_OUTPUT" | grep -E "Route|○|ƒ|Size|First|modules" | head -30)
PROMPT

log_success "Claude analysis complete" | tee -a "$LOG_FILE"

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

log_success "Performance report written to $REPORT_FILE" | tee -a "$LOG_FILE"
log_info "=== Performance Agent finished ===" | tee -a "$LOG_FILE"
