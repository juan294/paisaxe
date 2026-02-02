#!/usr/bin/env bash
# Security Agent — Runs weekly on Monday at 9:00 AM via launchd (com.paisaxe.security-agent)
# Performs npm audit, license checks, analyzes vulnerabilities, and provides remediation guidance
set -euo pipefail

PROJECT_DIR="/Users/juan/Documents/GenAI_Projects/paisaxe"
CLAUDE_BIN="/Users/juan/.local/bin/claude"
LOG_DIR="$PROJECT_DIR/logs"
LOG_FILE="$LOG_DIR/security-agent-$(date +%Y-%m-%d).log"
REPORT_FILE="$PROJECT_DIR/docs/agents/security-report.md"
METRICS_FILE="$PROJECT_DIR/.security-metrics.tmp"

mkdir -p "$LOG_DIR"

# Source shared utilities and check feature flags
source "$PROJECT_DIR/scripts/lib/agent-utils.sh"

# Check if agent is enabled via feature flags
log_info "=== Security Agent starting ===" | tee -a "$LOG_FILE"
log_info "Checking feature flags..." | tee -a "$LOG_FILE"
if ! check_agent_enabled "security_agent_enabled"; then
  log_info "=== Security Agent disabled by feature flag — exiting gracefully ===" | tee -a "$LOG_FILE"
  exit 0
fi
log_success "Feature flags enabled — proceeding with Security Agent" | tee -a "$LOG_FILE"

cd "$PROJECT_DIR"

# Collect security metrics
log_info "Running npm audit..." | tee -a "$LOG_FILE"
AUDIT_OUTPUT=$(npm audit --json 2>/dev/null || true)
AUDIT_TEXT=$(npm audit 2>&1 || true)

# Parse vulnerability counts
CRITICAL=$(echo "$AUDIT_OUTPUT" | jq -r '.metadata.vulnerabilities.critical // 0' 2>/dev/null || echo "0")
HIGH=$(echo "$AUDIT_OUTPUT" | jq -r '.metadata.vulnerabilities.high // 0' 2>/dev/null || echo "0")
MODERATE=$(echo "$AUDIT_OUTPUT" | jq -r '.metadata.vulnerabilities.moderate // 0' 2>/dev/null || echo "0")
LOW=$(echo "$AUDIT_OUTPUT" | jq -r '.metadata.vulnerabilities.low // 0' 2>/dev/null || echo "0")
TOTAL_VULNS=$((CRITICAL + HIGH + MODERATE + LOW))

log_info "Found $TOTAL_VULNS vulnerabilities (critical: $CRITICAL, high: $HIGH, moderate: $MODERATE, low: $LOW)" | tee -a "$LOG_FILE"

# Run license check
log_info "Running license check..." | tee -a "$LOG_FILE"
LICENSE_SUMMARY=$(npx license-checker --production --summary 2>&1 || true)
LICENSE_FULL=$(npx license-checker --production --json 2>/dev/null || echo "{}")

# Check for copyleft licenses
COPYLEFT_CHECK=$(npx license-checker --production --failOn "GPL-2.0;GPL-3.0;AGPL-3.0;LGPL-2.0;LGPL-2.1;LGPL-3.0" 2>&1) && COPYLEFT_FOUND="false" || COPYLEFT_FOUND="true"

# Check for outdated packages
log_info "Checking for outdated packages..." | tee -a "$LOG_FILE"
OUTDATED_OUTPUT=$(npm outdated --json 2>/dev/null || echo "{}")
OUTDATED_COUNT=$(echo "$OUTDATED_OUTPUT" | jq 'keys | length' 2>/dev/null || echo "0")

# Check for packages with security updates available
SECURITY_UPDATES=$(echo "$AUDIT_OUTPUT" | jq -r '.vulnerabilities | to_entries | map(select(.value.fixAvailable == true)) | length' 2>/dev/null || echo "0")

# Check CI/CD security automation
log_info "Checking CI/CD security automation..." | tee -a "$LOG_FILE"
DEPENDABOT_EXISTS=$([[ -f ".github/dependabot.yml" || -f ".github/dependabot.yaml" ]] && echo "true" || echo "false")
RENOVATE_EXISTS=$([[ -f "renovate.json" || -f ".github/renovate.json" || -f "renovate.json5" ]] && echo "true" || echo "false")
GITLEAKS_IN_CI=$(grep -rql "gitleaks" .github/workflows/ 2>/dev/null && echo "true" || echo "false")
NPM_AUDIT_IN_CI=$(grep -rqlE "npm audit|npm run audit" .github/workflows/ 2>/dev/null && echo "true" || echo "false")

# Get named packages for flagged licenses (not just counts)
log_info "Identifying flagged license packages..." | tee -a "$LOG_FILE"
FLAGGED_LICENSES=$(npx license-checker --production --csv 2>/dev/null | grep -iE "MPL|LGPL|GPL|UNLICENSED|Unknown" | head -20 || echo "none")

# Check security headers (if server is running)
log_info "Checking security headers..." | tee -a "$LOG_FILE"
SECURITY_HEADERS="Server not running - skipped"
if curl -s --max-time 2 "http://localhost:3000/api/health" > /dev/null 2>&1; then
  SECURITY_HEADERS=$(curl -sI "http://localhost:3000" 2>/dev/null | grep -iE "^(content-security-policy|x-frame-options|x-content-type-options|strict-transport-security|referrer-policy|permissions-policy):" || echo "No security headers found")
fi

# Write metrics to temp file for Claude
{
  echo "SECURITY METRICS ($(date '+%Y-%m-%d'))"
  echo "======================================="
  echo ""
  echo "VULNERABILITY SUMMARY:"
  echo "- Critical: $CRITICAL"
  echo "- High: $HIGH"
  echo "- Moderate: $MODERATE"
  echo "- Low: $LOW"
  echo "- Total: $TOTAL_VULNS"
  echo "- Fixable via npm audit fix: $SECURITY_UPDATES"
  echo ""
  echo "NPM AUDIT OUTPUT:"
  echo "$AUDIT_TEXT"
  echo ""
  echo "LICENSE SUMMARY:"
  echo "$LICENSE_SUMMARY"
  echo ""
  echo "COPYLEFT LICENSES FOUND: $COPYLEFT_FOUND"
  if [[ "$COPYLEFT_FOUND" == "true" ]]; then
    echo "Copyleft details:"
    echo "$COPYLEFT_CHECK"
  fi
  echo ""
  echo "OUTDATED PACKAGES: $OUTDATED_COUNT"
  echo "$OUTDATED_OUTPUT" | jq -r 'to_entries | .[] | "\(.key): \(.value.current) -> \(.value.latest)"' 2>/dev/null || true
  echo ""
  echo "CI/CD SECURITY AUTOMATION:"
  echo "- Dependabot configured: $DEPENDABOT_EXISTS"
  echo "- Renovate configured: $RENOVATE_EXISTS"
  echo "- Gitleaks in CI: $GITLEAKS_IN_CI"
  echo "- npm audit in CI: $NPM_AUDIT_IN_CI"
  echo ""
  echo "FLAGGED LICENSE PACKAGES (MPL/LGPL/GPL/UNLICENSED):"
  echo "$FLAGGED_LICENSES"
  echo ""
  echo "SECURITY HEADERS:"
  echo "$SECURITY_HEADERS"
  echo ""
} > "$METRICS_FILE"

log_info "Metrics collected, invoking Claude for analysis..." | tee -a "$LOG_FILE"

# Fetch the prompt from the feature flag config
AGENT_PROMPT=$(get_agent_prompt "security_agent_enabled" 2>/dev/null) || {
  log_warn "Could not fetch prompt from config, using default" | tee -a "$LOG_FILE"
  AGENT_PROMPT="You are the Paisaxe Security Agent. Your job is to analyze security vulnerabilities and provide actionable remediation guidance.

STEPS:
1. Review the vulnerability scan results
2. Assess the severity and exploitability of each vulnerability
3. Check license compliance — list package names for any flagged licenses
4. Review CI/CD security automation status
5. Check security headers configuration
6. Identify outdated packages with security implications
7. Write a comprehensive report to docs/agents/security-report.md

ANALYSIS FOCUS:
- Exploitability first: Lead with whether vulnerabilities are actually exploitable in this codebase
- Critical/High vulnerabilities: What's the attack vector? Read the affected code to assess real risk
- Dependency chains: Which of our direct deps bring in vulnerable transitive deps?
- Fixable issues: What can be fixed with npm audit fix vs manual intervention?
- License risks: Name the specific packages with MPL/LGPL/GPL/UNLICENSED licenses
- Security headers: Are CSP, HSTS, X-Frame-Options, X-Content-Type-Options configured?
- CI/CD gaps: Is automated security scanning in place?

REPORT STRUCTURE:
1. Health status (green/yellow/red) — base on EXPLOITABLE vulnerabilities, not raw counts
2. Executive summary — lead with exploitability: 'X advisories detected, Y exploitable' not 'X vulnerabilities found'
3. Vulnerability table with: Severity, Package, Advisory (GHSA + CVE if available), Attack Vector, Fixable, Risk Assessment
4. Detailed exploitability analysis for high/critical issues
5. Prioritized remediation steps
6. License compliance — list actual package names, not just license types
7. Security headers status
8. CI/CD automation status (Dependabot, Renovate, Gitleaks, npm audit in pipelines)
9. Outdated packages with security implications

CVE CROSS-REFERENCE:
- When listing vulnerabilities, include both GHSA and CVE identifiers where available
- CVE format: CVE-YYYY-NNNNN (look up from GHSA advisory if not in npm audit output)

RULES:
- Exploitability trumps severity: A non-exploitable critical is less urgent than an exploitable moderate
- Be specific about attack vectors and why they do/don't apply to this codebase
- Include exact commands for fixes where possible
- Note if vulnerabilities are in dev-only dependencies (lower risk)
- Distinguish between fixable and unfixable issues
- Name packages explicitly — 'argon2 uses LGPL-3.0' not 'LGPL-3.0: 1 package'"
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

Security metrics:
$(cat "$METRICS_FILE")
PROMPT

log_success "Claude analysis complete" | tee -a "$LOG_FILE"

# Cleanup
rm -f "$METRICS_FILE"

log_success "Security report written to $REPORT_FILE" | tee -a "$LOG_FILE"
log_info "=== Security Agent finished ===" | tee -a "$LOG_FILE"
