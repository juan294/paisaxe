#!/usr/bin/env bash
# Performance Agent — Runs weekly on Saturday at 10:00 AM via launchd (com.paisaxe.performance-agent)
# Analyzes bundle sizes, identifies optimization opportunities, tracks regressions
set -euo pipefail

PROJECT_DIR="/Users/juan/code/paisaxe"
CLAUDE_BIN="/Users/juan/.local/bin/claude"
MODEL="sonnet"
LOG_DIR="$PROJECT_DIR/logs"
LOG_FILE="$LOG_DIR/performance-agent-$(date +%Y-%m-%d).log"
REPORT_FILE="$PROJECT_DIR/docs/agents/performance-report.md"
HISTORY_FILE="$PROJECT_DIR/.performance-history.json"
METRICS_FILE="$PROJECT_DIR/.performance-metrics.tmp"

mkdir -p "$LOG_DIR"
trap 'rm -f "$METRICS_FILE"' EXIT

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

restart_dev_server_if_needed() {
  if [[ "$RESTART_DEV_SERVER" == "true" ]]; then
    log_info "Restarting dev server..." | tee -a "$LOG_FILE"
    cd "$PROJECT_DIR" && nohup npm run dev > /dev/null 2>&1 &
    log_success "Dev server restarted" | tee -a "$LOG_FILE"
  fi
}

# Performance budgets (split budget adopted 2026-04-04 — single 2,500 KB budget retired)
# Raised 2026-05-02 to reflect structural growth since Apr 4 baseline (Wave 1+2 + dep bumps)
# Raised 2026-06-10: ElevenLabs ConvAI SDK (~605 KB deferred, click-to-mount) is a hard
# dependency and already fully lazy-loaded — no further reduction possible. Total budget
# raised to 3,500 KB (100 KB headroom over current 3,398 KB). Initial-load budget unchanged.
BUDGET_INITIAL_JS_KB=2100    # 2.1 MB initial load JS (static chunks only, excl. deferred)
BUDGET_TOTAL_JS_KB=3500      # 3.5 MB total JS (including deferred dynamic chunks)
BUDGET_LARGEST_CHUNK_KB=650  # 650 KB per chunk (ElevenLabs deferred chunk is 605 KB)
BUDGET_NODE_MODULES_MB=1100  # 1.1 GB node_modules (@sentry/nextjs 67 MB is permanent)
BUDGET_PROD_DEPS=40          # Max production dependencies

# Initialize metrics collection
log_info "Collecting performance metrics..." | tee -a "$LOG_FILE"

# Build the app to get accurate bundle sizes.
# If the dev server is running, stop it first, build, then restart it.
FRESH_BUILD=true
BUILD_OUTPUT=""
DEV_SERVER_PID=""
RESTART_DEV_SERVER=false

# Detect if THIS project's dev server is running on its pinned port (3006,
# per commit 01079491). Port-based check is immune to sibling Next.js projects
# running on other ports triggering false positives.
DEV_SERVER_PORT=3006
DEV_SERVER_PID=$(lsof -ti :${DEV_SERVER_PORT} -sTCP:LISTEN 2>/dev/null | head -1 || true)
if [[ -n "$DEV_SERVER_PID" ]]; then
  log_info "Dev server detected on port ${DEV_SERVER_PORT} (PID $DEV_SERVER_PID) — stopping for production build..." | tee -a "$LOG_FILE"
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
# macOS has no `timeout` binary — do not wrap this in `timeout N ...`.
# It silently exits 127, so the build step never actually runs and every
# cycle falls through to the (previously unguarded) cached-data branch below.
if BUILD_OUTPUT=$(npm run build 2>&1); then
  log_success "Build completed" | tee -a "$LOG_FILE"
else
  FRESH_BUILD=false
  # A cached .next tree is only a valid production build if BUILD_ID and a
  # non-empty static/chunks directory both exist. Directory mtime is NOT a
  # reliable signal — the dev server touches .next on every run, so a
  # dev-only tree always looks "fresh" even with zero production chunks.
  if [[ -f ".next/BUILD_ID" ]] && [[ -n "$(find .next/static/chunks -name '*.js' -type f 2>/dev/null | head -1)" ]]; then
    log_warn "Build failed. Using existing .next data for analysis." | tee -a "$LOG_FILE"
  else
    log_error "Build failed and no valid production build in .next to analyze (missing BUILD_ID or static/chunks)" | tee -a "$LOG_FILE"
    echo "$BUILD_OUTPUT" >> "$LOG_FILE"
    restart_dev_server_if_needed
    exit 1
  fi
fi

# Collect metrics
log_info "Analyzing bundle sizes..." | tee -a "$LOG_FILE"

# Get JS bundle sizes
TOTAL_JS_BYTES=$(find .next/static -name "*.js" -type f -exec stat -f%z {} + 2>/dev/null | awk '{s+=$1} END {print s}')
TOTAL_JS_KB=$((TOTAL_JS_BYTES / 1024))

# A 0 KB bundle is physically impossible for a built Next app — treat it as a
# harness error, never as a real measurement, and never write it to history.
if [[ "${TOTAL_JS_KB:-0}" -eq 0 ]]; then
  log_error "Measured 0 KB total JS — refusing to report or record this as a real reading" | tee -a "$LOG_FILE"
  restart_dev_server_if_needed
  exit 1
fi

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

# Build provenance — record .next mtime and last commit touching src/ or package.json
# so Claude can verify bundle authority without manual git archaeology.
NEXT_MTIME=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M:%S" .next 2>/dev/null || echo "unknown")
NEXT_MTIME_EPOCH=$(stat -f "%m" .next 2>/dev/null || echo "0")
LAST_SOURCE_COMMIT=$(git log -1 --format="%H %ai %s" -- src/ package.json package-lock.json 2>/dev/null || echo "unknown")
LAST_SOURCE_COMMIT_EPOCH=$(git log -1 --format="%ct" -- src/ package.json package-lock.json 2>/dev/null || echo "0")
BUILD_IS_STALE="false"
if [[ "$FRESH_BUILD" == "false" && "$NEXT_MTIME_EPOCH" -lt "$LAST_SOURCE_COMMIT_EPOCH" ]]; then
  BUILD_IS_STALE="true"
fi

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
  echo "BUILD PROVENANCE:"
  echo "- .next directory mtime: ${NEXT_MTIME}"
  echo "- Last commit touching src/ or package.json: ${LAST_SOURCE_COMMIT}"
  if [[ "$FRESH_BUILD" == "true" ]]; then
    echo "- Build status: FRESH (produced this run — bundle numbers are authoritative)"
  elif [[ "$BUILD_IS_STALE" == "true" ]]; then
    echo "- Build status: STALE — .next predates last source/dep commit. Bundle numbers are NOT authoritative."
    echo "  BUDGET VERDICT SUPPRESSED: cached build is older than the source tree."
    echo "  Base the overall status verdict on dependency and disk metrics only."
  else
    echo "- Build status: CACHED — .next postdates last source/dep commit. Bundle numbers are authoritative for current source tree."
  fi
  echo ""
  if [[ "$FRESH_BUILD" == "false" && "$BUILD_IS_STALE" == "true" ]]; then
    echo "NOTE: Production build was skipped or failed — cached .next is older than source."
    echo "Bundle sizes below are informational only."
    echo ""
  elif [[ "$FRESH_BUILD" == "false" ]]; then
    echo "NOTE: Production build was skipped (used existing .next). Bundle sizes are authoritative"
    echo "for the current source tree (build postdates all source/dep changes)."
    echo ""
  fi
  echo "BUNDLE SIZES:"
  echo "- Total JS: ${TOTAL_JS_KB} KB (previous: ${PREV_TOTAL_JS_KB} KB, change: ${JS_CHANGE_KB} KB)"
  echo "- Total CSS: ${TOTAL_CSS_KB} KB"
  echo "- Budget (split, since 2026-04-04): initial ${BUDGET_INITIAL_JS_KB} KB / total ${BUDGET_TOTAL_JS_KB} KB"
  echo ""
  if [[ "$FRESH_BUILD" == "true" ]]; then
    echo "FIRST LOAD JS (per-route split, from next build):"
    echo "$BUILD_OUTPUT" | grep -E "First Load JS" | head -10
    echo ""
  fi
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
  if [[ -n "$VIOLATIONS" ]] && [[ "$FRESH_BUILD" == "true" || "$BUILD_IS_STALE" == "false" ]]; then
    echo "BUDGET VIOLATIONS:"
    echo -e "$VIOLATIONS"
    echo ""
  fi
} > "$METRICS_FILE"

log_info "Metrics collected, invoking Claude for analysis..." | tee -a "$LOG_FILE"

# Load the agent prompt from shared TypeScript config
AGENT_PROMPT=$(get_default_prompt "performance_agent_enabled" 2>/dev/null) || {
  log_error "No prompt available for performance_agent_enabled" | tee -a "$LOG_FILE"
  exit 1
}

# Read shared context from other agents
log_info "Reading shared context..." | tee -a "$LOG_FILE"
SHARED_CONTEXT=$(read_shared_context "performance_agent_enabled")
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

Current metrics:
$(cat "$METRICS_FILE")

Build output summary:
$(if [[ "$FRESH_BUILD" == "true" ]]; then echo "$BUILD_OUTPUT" | grep -E "Route|○|ƒ|Size|First|modules" | head -30; else echo "(No build output — build was skipped or failed, used cached .next data)"; fi)

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

restart_dev_server_if_needed

log_success "Performance report written to $REPORT_FILE" | tee -a "$LOG_FILE"
log_info "=== Performance Agent finished ===" | tee -a "$LOG_FILE"
