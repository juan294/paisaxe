#!/usr/bin/env bash
# Docs Freshness Agent — Runs weekly on Sunday at 6:00 AM via launchd (com.paisaxe.docs-freshness-agent)
# Checks for stale documentation, outputs to docs/docs-freshness-report.md
set -euo pipefail

PROJECT_DIR="/Users/juan/Documents/GenAI_Projects/paisaxe"
LOG_DIR="$PROJECT_DIR/logs"
LOG_FILE="$LOG_DIR/docs-freshness-agent-$(date +%Y-%m-%d).log"
REPORT_FILE="$PROJECT_DIR/docs/agents/docs-freshness-report.md"
CLAUDE_MD="$PROJECT_DIR/CLAUDE.md"

mkdir -p "$LOG_DIR"

# Source shared utilities and check feature flags
source "$PROJECT_DIR/scripts/lib/agent-utils.sh"

# Check if agent is enabled via feature flags
log_info "=== Docs Freshness Agent starting ===" | tee -a "$LOG_FILE"
log_info "Checking feature flags..." | tee -a "$LOG_FILE"
if ! check_agent_enabled "docs_freshness_agent_enabled"; then
  log_info "=== Docs Freshness Agent disabled by feature flag — exiting gracefully ===" | tee -a "$LOG_FILE"
  exit 0
fi
log_success "Feature flags enabled — proceeding with Docs Freshness Agent" | tee -a "$LOG_FILE"

cd "$PROJECT_DIR"

# Initialize report
write_report_header "Documentation Freshness Report" "$REPORT_FILE"

# Get CLAUDE.md last modified time
CLAUDE_MD_MTIME=$(stat -f "%Sm" -t "%Y-%m-%d" "$CLAUDE_MD" 2>/dev/null || stat -c "%y" "$CLAUDE_MD" 2>/dev/null | cut -d' ' -f1)
log_info "CLAUDE.md last modified: $CLAUDE_MD_MTIME" | tee -a "$LOG_FILE"

{
  echo "## CLAUDE.md Status"
  echo ""
  echo "Last modified: **$CLAUDE_MD_MTIME**"
  echo ""
} >> "$REPORT_FILE"

# Find files modified since CLAUDE.md was last updated
log_info "Finding files modified since CLAUDE.md update..." | tee -a "$LOG_FILE"

{
  echo "## Files Modified Since Documentation Update"
  echo ""
  echo "These source files have been modified since CLAUDE.md was last updated and may need documentation updates."
  echo ""
} >> "$REPORT_FILE"

# Find modified TypeScript/JavaScript files
MODIFIED_FILES=$(find src -type f \( -name "*.ts" -o -name "*.tsx" \) -newer "$CLAUDE_MD" 2>/dev/null | sort)

if [[ -n "$MODIFIED_FILES" ]]; then
  {
    echo "### Source Files (src/)"
    echo ""
    echo "\`\`\`"
    echo "$MODIFIED_FILES"
    echo "\`\`\`"
    echo ""
  } >> "$REPORT_FILE"
  log_info "Found $(echo "$MODIFIED_FILES" | wc -l | tr -d ' ') modified source files" | tee -a "$LOG_FILE"
else
  echo "No source files modified since documentation update." >> "$REPORT_FILE"
  echo "" >> "$REPORT_FILE"
fi

# Find modified migration files
MODIFIED_MIGRATIONS=$(find supabase/migrations -type f -name "*.sql" -newer "$CLAUDE_MD" 2>/dev/null | sort)

if [[ -n "$MODIFIED_MIGRATIONS" ]]; then
  {
    echo "### Database Migrations"
    echo ""
    echo "\`\`\`"
    echo "$MODIFIED_MIGRATIONS"
    echo "\`\`\`"
    echo ""
  } >> "$REPORT_FILE"
  log_warn "$(echo "$MODIFIED_MIGRATIONS" | wc -l | tr -d ' ') new migrations may need documentation" | tee -a "$LOG_FILE"
else
  echo "No new migrations since documentation update." >> "$REPORT_FILE"
  echo "" >> "$REPORT_FILE"
fi

# Find modified scripts
MODIFIED_SCRIPTS=$(find scripts -type f \( -name "*.sh" -o -name "*.ts" \) -newer "$CLAUDE_MD" 2>/dev/null | sort)

if [[ -n "$MODIFIED_SCRIPTS" ]]; then
  {
    echo "### Scripts"
    echo ""
    echo "\`\`\`"
    echo "$MODIFIED_SCRIPTS"
    echo "\`\`\`"
    echo ""
  } >> "$REPORT_FILE"
  log_info "Found $(echo "$MODIFIED_SCRIPTS" | wc -l | tr -d ' ') modified scripts" | tee -a "$LOG_FILE"
fi

# Check for missing documentation patterns
log_info "Checking for potentially undocumented patterns..." | tee -a "$LOG_FILE"

{
  echo "## Documentation Gaps"
  echo ""
} >> "$REPORT_FILE"

# Check for new API routes not in CLAUDE.md
API_ROUTES=$(find src/app/api -type f -name "route.ts" 2>/dev/null | sed 's|src/app/api/||g' | sed 's|/route.ts||g' | sort)
UNDOCUMENTED_ROUTES=""

while IFS= read -r route; do
  if [[ -n "$route" ]] && ! grep -q "$route" "$CLAUDE_MD" 2>/dev/null; then
    UNDOCUMENTED_ROUTES="$UNDOCUMENTED_ROUTES$route"$'\n'
  fi
done <<< "$API_ROUTES"

if [[ -n "$UNDOCUMENTED_ROUTES" ]]; then
  {
    echo "### Potentially Undocumented API Routes"
    echo ""
    echo "These API routes may not be documented in CLAUDE.md:"
    echo ""
    echo "\`\`\`"
    echo "$UNDOCUMENTED_ROUTES"
    echo "\`\`\`"
    echo ""
  } >> "$REPORT_FILE"
  log_warn "Found potentially undocumented API routes" | tee -a "$LOG_FILE"
else
  echo "All API routes appear to be documented." >> "$REPORT_FILE"
  echo "" >> "$REPORT_FILE"
fi

# Check for new feature flags in types but not in CLAUDE.md
log_info "Checking feature flag documentation..." | tee -a "$LOG_FILE"

FEATURE_FLAGS=$(grep -o '"[a-z_]*"' src/types/feature-flags.ts 2>/dev/null | tr -d '"' | sort | uniq)
UNDOCUMENTED_FLAGS=""

while IFS= read -r flag; do
  if [[ -n "$flag" ]] && ! grep -q "$flag" "$CLAUDE_MD" 2>/dev/null; then
    UNDOCUMENTED_FLAGS="$UNDOCUMENTED_FLAGS$flag"$'\n'
  fi
done <<< "$FEATURE_FLAGS"

if [[ -n "$UNDOCUMENTED_FLAGS" ]]; then
  {
    echo "### Potentially Undocumented Feature Flags"
    echo ""
    echo "These feature flags may not be documented in CLAUDE.md:"
    echo ""
    echo "\`\`\`"
    echo "$UNDOCUMENTED_FLAGS"
    echo "\`\`\`"
    echo ""
  } >> "$REPORT_FILE"
fi

# Check age of documentation files
log_info "Checking documentation file ages..." | tee -a "$LOG_FILE"

{
  echo "## Documentation File Ages"
  echo ""
  echo "| File | Last Modified |"
  echo "|------|--------------|"
} >> "$REPORT_FILE"

for doc in docs/*.md CLAUDE.md README.md; do
  if [[ -f "$doc" ]]; then
    DOC_MTIME=$(stat -f "%Sm" -t "%Y-%m-%d" "$doc" 2>/dev/null || stat -c "%y" "$doc" 2>/dev/null | cut -d' ' -f1)
    echo "| $doc | $DOC_MTIME |" >> "$REPORT_FILE"
  fi
done

{
  echo ""
  echo "---"
  echo ""
  echo "*Report generated by Docs Freshness Agent*"
} >> "$REPORT_FILE"

log_success "Freshness report written to $REPORT_FILE" | tee -a "$LOG_FILE"
log_info "=== Docs Freshness Agent finished ===" | tee -a "$LOG_FILE"
