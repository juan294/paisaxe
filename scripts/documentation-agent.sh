#!/usr/bin/env bash
# Documentation Agent — Runs weekly on Sunday at 6:00 AM via launchd (com.paisaxe.documentation-agent)
# Checks for stale documentation, updates CLAUDE.md, outputs to docs/agents/documentation-report.md
set -euo pipefail

PROJECT_DIR="/Users/juan/Documents/GenAI_Projects/paisaxe"
CLAUDE_BIN="/Users/juan/.local/bin/claude"
LOG_DIR="$PROJECT_DIR/logs"
LOG_FILE="$LOG_DIR/documentation-agent-$(date +%Y-%m-%d).log"
REPORT_FILE="$PROJECT_DIR/docs/agents/documentation-report.md"
CLAUDE_MD="$PROJECT_DIR/CLAUDE.md"
GAPS_FILE="$PROJECT_DIR/.docs-gaps.tmp"

mkdir -p "$LOG_DIR"

# Source shared utilities and check feature flags
source "$PROJECT_DIR/scripts/lib/agent-utils.sh"

# Check if agent is enabled via feature flags
log_info "=== Documentation Agent starting ===" | tee -a "$LOG_FILE"
log_info "Checking feature flags..." | tee -a "$LOG_FILE"
if ! check_agent_enabled "documentation_agent_enabled"; then
  log_info "=== Documentation Agent disabled by feature flag — exiting gracefully ===" | tee -a "$LOG_FILE"
  exit 0
fi
log_success "Feature flags enabled — proceeding with Documentation Agent" | tee -a "$LOG_FILE"

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

# Collect gaps into a temp file for Claude to process
log_info "Collecting documentation gaps for Claude..." | tee -a "$LOG_FILE"
{
  echo "UNDOCUMENTED_API_ROUTES:"
  echo "$UNDOCUMENTED_ROUTES"
  echo ""
  echo "UNDOCUMENTED_FEATURE_FLAGS:"
  echo "$UNDOCUMENTED_FLAGS"
} > "$GAPS_FILE"

# Only invoke Claude if there are actual gaps to fix
if [[ -n "$UNDOCUMENTED_ROUTES" ]] || [[ -n "$UNDOCUMENTED_FLAGS" ]]; then
  log_info "Documentation gaps found — invoking Claude to update CLAUDE.md..." | tee -a "$LOG_FILE"

  # Fetch the prompt from the feature flag config
  AGENT_PROMPT=$(get_agent_prompt "documentation_agent_enabled" 2>/dev/null) || {
    log_warn "Could not fetch prompt from config, trying shared default" | tee -a "$LOG_FILE"
    AGENT_PROMPT=$(get_default_prompt "documentation_agent_enabled" 2>/dev/null) || {
      log_error "No prompt available for documentation_agent_enabled" | tee -a "$LOG_FILE"
      exit 1
    }
  }

  # Read shared context from other agents
  log_info "Reading shared context..." | tee -a "$LOG_FILE"
  SHARED_CONTEXT=$(read_shared_context "documentation_agent_enabled")
  SHARED_CONTEXT_READ=$(npx tsx "$PROJECT_DIR/scripts/lib/print-shared-context-instructions.ts" read 2>/dev/null || echo "")
  SHARED_CONTEXT_WRITE=$(npx tsx "$PROJECT_DIR/scripts/lib/print-shared-context-instructions.ts" write 2>/dev/null || echo "")

  # Capture docs state before (check both CLAUDE.md and features.md)
  FEATURES_MD="$PROJECT_DIR/docs/project/features.md"
  DOCS_STATE_BEFORE=$(cat "$CLAUDE_MD" "$FEATURES_MD" 2>/dev/null | md5 -q)

  # Run Claude to update documentation
  "$CLAUDE_BIN" -p \
    --allowedTools 'Read,Edit,Glob,Grep' \
    >> "$LOG_FILE" 2>&1 <<PROMPT
$AGENT_PROMPT

Additional context:
- Project directory: $PROJECT_DIR
- CLAUDE.md location: $CLAUDE_MD
- Features doc: $FEATURES_MD
- Gaps file: $GAPS_FILE
- Report file: $REPORT_FILE
- Date: $(date '+%Y-%m-%d')

Contents of gaps file:
$(cat "$GAPS_FILE")

$SHARED_CONTEXT_READ

$SHARED_CONTEXT

$SHARED_CONTEXT_WRITE
PROMPT

  # Check if any documentation was modified
  DOCS_STATE_AFTER=$(cat "$CLAUDE_MD" "$FEATURES_MD" 2>/dev/null | md5 -q)
  if [[ "$DOCS_STATE_BEFORE" != "$DOCS_STATE_AFTER" ]]; then
    log_success "Claude updated documentation" | tee -a "$LOG_FILE"
  else
    log_info "No documentation changes made" | tee -a "$LOG_FILE"
  fi

  # Extract and write shared context
  REPORT_CONTENT=$(cat "$REPORT_FILE")
  CONTEXT_BLOCK=$(echo "$REPORT_CONTENT" | sed -n '/SHARED_CONTEXT_START/,/SHARED_CONTEXT_END/p' | sed '1d;$d')

  if [[ -n "$CONTEXT_BLOCK" ]]; then
    write_shared_context "documentation_agent_enabled" "$CONTEXT_BLOCK"
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

  # Cleanup temp file
  rm -f "$GAPS_FILE"
else
  log_info "No documentation gaps found — skipping Claude invocation" | tee -a "$LOG_FILE"
fi

{
  echo ""
  echo "---"
  echo ""
  echo "*Report generated by Documentation Agent*"
} >> "$REPORT_FILE"

log_success "Documentation report written to $REPORT_FILE" | tee -a "$LOG_FILE"
log_info "=== Documentation Agent finished ===" | tee -a "$LOG_FILE"
