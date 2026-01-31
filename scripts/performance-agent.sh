#!/usr/bin/env bash
# Performance Agent — Runs weekly on Saturday at 10:00 AM via launchd (com.paisaxe.performance-agent)
# Runs Lighthouse and bundle size analysis, outputs to docs/performance-report.md
set -euo pipefail

PROJECT_DIR="/Users/juan/Documents/GenAI_Projects/paisaxe"
LOG_DIR="$PROJECT_DIR/logs"
LOG_FILE="$LOG_DIR/performance-agent-$(date +%Y-%m-%d).log"
REPORT_FILE="$PROJECT_DIR/docs/agents/performance-report.md"

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

# Initialize report
write_report_header "Performance Report" "$REPORT_FILE"

# Build the app first to get accurate bundle sizes
log_info "Building application for analysis..." | tee -a "$LOG_FILE"

{
  echo "## Build Output"
  echo ""
  echo "\`\`\`"
} >> "$REPORT_FILE"

npm run build 2>&1 >> "$REPORT_FILE" || {
  log_error "Build failed" | tee -a "$LOG_FILE"
  echo "\`\`\`" >> "$REPORT_FILE"
  echo "" >> "$REPORT_FILE"
  echo "**Build failed — see logs for details.**" >> "$REPORT_FILE"
  exit 1
}

{
  echo "\`\`\`"
  echo ""
} >> "$REPORT_FILE"

log_success "Build completed" | tee -a "$LOG_FILE"

# Analyze bundle sizes
log_info "Analyzing bundle sizes..." | tee -a "$LOG_FILE"

{
  echo "## Bundle Size Analysis"
  echo ""
} >> "$REPORT_FILE"

# Get sizes from .next/static
if [[ -d ".next/static" ]]; then
  {
    echo "### JavaScript Bundles"
    echo ""
    echo "\`\`\`"
  } >> "$REPORT_FILE"

  # Find all JS files and their sizes
  find .next/static -name "*.js" -type f -exec du -h {} \; 2>/dev/null | sort -rh | head -20 >> "$REPORT_FILE"

  {
    echo "\`\`\`"
    echo ""
  } >> "$REPORT_FILE"

  # Total JS size
  TOTAL_JS_SIZE=$(find .next/static -name "*.js" -type f -exec stat -f%z {} + 2>/dev/null | awk '{s+=$1} END {printf "%.2f MB", s/(1024*1024)}')
  echo "**Total JS size:** $TOTAL_JS_SIZE" >> "$REPORT_FILE"
  echo "" >> "$REPORT_FILE"

  log_info "Total JS bundle size: $TOTAL_JS_SIZE" | tee -a "$LOG_FILE"

  {
    echo "### CSS Bundles"
    echo ""
    echo "\`\`\`"
  } >> "$REPORT_FILE"

  find .next/static -name "*.css" -type f -exec du -h {} \; 2>/dev/null | sort -rh | head -10 >> "$REPORT_FILE"

  {
    echo "\`\`\`"
    echo ""
  } >> "$REPORT_FILE"
else
  echo "No .next/static directory found — run \`npm run build\` first." >> "$REPORT_FILE"
  echo "" >> "$REPORT_FILE"
fi

# Run Lighthouse if available
log_info "Checking for Lighthouse CLI..." | tee -a "$LOG_FILE"

if command -v lighthouse &>/dev/null; then
  log_info "Running Lighthouse analysis..." | tee -a "$LOG_FILE"

  {
    echo "## Lighthouse Scores"
    echo ""
  } >> "$REPORT_FILE"

  # Start a production server in background
  PORT=3456
  log_info "Starting production server on port $PORT..." | tee -a "$LOG_FILE"

  npm run start -- -p $PORT &>/dev/null &
  SERVER_PID=$!

  # Wait for server to be ready
  sleep 10

  # Run Lighthouse
  LIGHTHOUSE_OUTPUT=$(lighthouse "http://localhost:$PORT" \
    --output=json \
    --quiet \
    --chrome-flags="--headless --no-sandbox" \
    2>/dev/null) || {
    log_warn "Lighthouse failed — server may not be ready" | tee -a "$LOG_FILE"
    LIGHTHOUSE_OUTPUT=""
  }

  # Kill the server
  kill $SERVER_PID 2>/dev/null || true

  if [[ -n "$LIGHTHOUSE_OUTPUT" ]]; then
    # Parse scores from JSON
    PERF=$(echo "$LIGHTHOUSE_OUTPUT" | jq -r '.categories.performance.score * 100 | floor' 2>/dev/null || echo "N/A")
    ACCESS=$(echo "$LIGHTHOUSE_OUTPUT" | jq -r '.categories.accessibility.score * 100 | floor' 2>/dev/null || echo "N/A")
    BP=$(echo "$LIGHTHOUSE_OUTPUT" | jq -r '.categories."best-practices".score * 100 | floor' 2>/dev/null || echo "N/A")
    SEO=$(echo "$LIGHTHOUSE_OUTPUT" | jq -r '.categories.seo.score * 100 | floor' 2>/dev/null || echo "N/A")

    {
      echo "| Metric | Score |"
      echo "|--------|-------|"
      echo "| Performance | $PERF% |"
      echo "| Accessibility | $ACCESS% |"
      echo "| Best Practices | $BP% |"
      echo "| SEO | $SEO% |"
      echo ""
    } >> "$REPORT_FILE"

    log_success "Lighthouse scores: Perf=$PERF%, A11y=$ACCESS%, BP=$BP%, SEO=$SEO%" | tee -a "$LOG_FILE"

    # Extract Core Web Vitals
    FCP=$(echo "$LIGHTHOUSE_OUTPUT" | jq -r '.audits."first-contentful-paint".displayValue' 2>/dev/null || echo "N/A")
    LCP=$(echo "$LIGHTHOUSE_OUTPUT" | jq -r '.audits."largest-contentful-paint".displayValue' 2>/dev/null || echo "N/A")
    CLS=$(echo "$LIGHTHOUSE_OUTPUT" | jq -r '.audits."cumulative-layout-shift".displayValue' 2>/dev/null || echo "N/A")
    TBT=$(echo "$LIGHTHOUSE_OUTPUT" | jq -r '.audits."total-blocking-time".displayValue' 2>/dev/null || echo "N/A")

    {
      echo "### Core Web Vitals"
      echo ""
      echo "| Metric | Value |"
      echo "|--------|-------|"
      echo "| First Contentful Paint (FCP) | $FCP |"
      echo "| Largest Contentful Paint (LCP) | $LCP |"
      echo "| Cumulative Layout Shift (CLS) | $CLS |"
      echo "| Total Blocking Time (TBT) | $TBT |"
      echo ""
    } >> "$REPORT_FILE"
  else
    echo "Lighthouse analysis failed — server may not have started correctly." >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
  fi
else
  {
    echo "## Lighthouse Scores"
    echo ""
    echo "Lighthouse CLI not installed. Install with:"
    echo ""
    echo "\`\`\`"
    echo "npm install -g lighthouse"
    echo "\`\`\`"
    echo ""
  } >> "$REPORT_FILE"
  log_warn "Lighthouse not installed — skipping" | tee -a "$LOG_FILE"
fi

# Dependency count
log_info "Counting dependencies..." | tee -a "$LOG_FILE"

{
  echo "## Dependencies"
  echo ""
} >> "$REPORT_FILE"

PROD_DEPS=$(jq -r '.dependencies | keys | length' package.json 2>/dev/null || echo "?")
DEV_DEPS=$(jq -r '.devDependencies | keys | length' package.json 2>/dev/null || echo "?")

{
  echo "| Type | Count |"
  echo "|------|-------|"
  echo "| Production | $PROD_DEPS |"
  echo "| Development | $DEV_DEPS |"
  echo "| **Total** | **$((PROD_DEPS + DEV_DEPS))** |"
  echo ""
} >> "$REPORT_FILE"

# Package size analysis using du
log_info "Analyzing node_modules size..." | tee -a "$LOG_FILE"

NODE_MODULES_SIZE=$(du -sh node_modules 2>/dev/null | cut -f1)

{
  echo "## Disk Usage"
  echo ""
  echo "| Directory | Size |"
  echo "|-----------|------|"
  echo "| node_modules | $NODE_MODULES_SIZE |"
} >> "$REPORT_FILE"

if [[ -d ".next" ]]; then
  NEXT_SIZE=$(du -sh .next 2>/dev/null | cut -f1)
  echo "| .next | $NEXT_SIZE |" >> "$REPORT_FILE"
fi

{
  echo ""
  echo "---"
  echo ""
  echo "*Report generated by Performance Agent*"
} >> "$REPORT_FILE"

log_success "Performance report written to $REPORT_FILE" | tee -a "$LOG_FILE"
log_info "=== Performance Agent finished ===" | tee -a "$LOG_FILE"
