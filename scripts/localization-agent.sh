#!/usr/bin/env bash
# Localization Agent — Runs weekly (Sundays at 7:00 AM) via launchd (com.paisaxe.localization-agent)
# Checks for missing translations across all locales and fills gaps automatically
set -euo pipefail

PROJECT_DIR="/Users/juan/Documents/GenAI_Projects/paisaxe"
CLAUDE_BIN="/Users/juan/.local/bin/claude"
LOG_DIR="$PROJECT_DIR/logs"
LOG_FILE="$LOG_DIR/localization-agent-$(date +%Y-%m-%d).log"
DOC_FILE="$PROJECT_DIR/docs/agents/localization-report.md"

mkdir -p "$LOG_DIR"

# Source shared utilities and check feature flags
source "$PROJECT_DIR/scripts/lib/agent-utils.sh"

# Check if agent is enabled via feature flags
log_info "=== Localization Agent starting ===" | tee -a "$LOG_FILE"
log_info "Checking feature flags..." | tee -a "$LOG_FILE"
if ! check_agent_enabled "localization_agent_enabled"; then
  log_info "=== Localization Agent disabled by feature flag — exiting gracefully ===" | tee -a "$LOG_FILE"
  exit 0
fi
log_success "Feature flags enabled — proceeding with Localization Agent" | tee -a "$LOG_FILE"

echo "=== Localization Agent started at $(date) ===" | tee -a "$LOG_FILE"

cd "$PROJECT_DIR"

# Fetch the prompt from the feature flag config
log_info "Fetching agent prompt from config..." | tee -a "$LOG_FILE"
AGENT_PROMPT=$(get_agent_prompt "localization_agent_enabled" 2>/dev/null) || {
  log_warn "Could not fetch prompt from config, using default" | tee -a "$LOG_FILE"
  AGENT_PROMPT="You are the Paisaxe Localization Agent. Your job is to ensure 100% translation coverage across all supported locales.

SUPPORTED LOCALES: es (Spanish - default), en (English), fr (French), de (German), pt (Portuguese)

TRANSLATION FILES:
- UI strings: src/lib/i18n/{es,en,fr,de,pt}.ts
- Story translations: content/translations/story-translations.ts (stored in story.metadata.translations)

STEPS:

1. ANALYZE UI TRANSLATIONS:
   a. Read all 5 locale files in src/lib/i18n/
   b. Extract all translation keys from the Spanish (es.ts) file as the source of truth
   c. For each other locale (en, fr, de, pt), identify missing keys
   d. Note any keys that exist in other locales but NOT in Spanish (potential orphans)

2. ANALYZE STORY TRANSLATIONS:
   a. Read content/translations/story-translations.ts
   b. List all story slugs that have translations
   c. For each story, identify which locales are missing translations

3. FIX MISSING UI TRANSLATIONS:
   For each missing key in each locale:
   a. Get the Spanish source text
   b. Translate it to the target language (maintain same tone, technical terms, and placeholders like {current})
   c. Add the translation to the appropriate locale file
   d. Preserve the exact same nested structure

4. FIX MISSING STORY TRANSLATIONS:
   For each story missing translations:
   a. Get the Spanish title, subtitle, and description from the story data
   b. Translate to all missing locales
   c. Update content/translations/story-translations.ts

5. GENERATE REPORT:
   Write a report to $DOC_FILE with:
   - Summary: total keys per locale, completion percentage
   - Fixed: list of translations added
   - Remaining gaps: any translations that could not be auto-generated
   - Orphaned keys: keys in non-Spanish locales without Spanish source

RULES:
- Spanish (es) is the source of truth. Never delete Spanish strings.
- Maintain exact key structure and nesting in all locale files.
- Preserve placeholders like {current}, {total}, {title} exactly as-is.
- For location-specific content (marked with LOCATION-SPECIFIC comments), ensure proper localization of place names.
- Run TypeScript check after edits: npx tsc --noEmit src/lib/i18n/*.ts
- Commit nothing. The user will review and commit manually.
- Be thorough but pragmatic about edge cases."
}

# Run the localization agent via Claude CLI in non-interactive mode
"$CLAUDE_BIN" -p \
  --allowedTools 'Read,Write,Edit,Bash(npx tsc*),Bash(ls *),Bash(find *),Glob,Grep' \
  >> "$LOG_FILE" 2>&1 <<PROMPT
$AGENT_PROMPT

Additional context:
- Project directory: $PROJECT_DIR
- Output file: $DOC_FILE
- Date: $(date '+%Y-%m-%d')
PROMPT

echo "=== Localization Agent finished at $(date) ===" | tee -a "$LOG_FILE"
