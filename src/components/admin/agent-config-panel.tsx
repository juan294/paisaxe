"use client";

import { useState } from "react";
import { Loader2, AlertCircle, RotateCcw } from "lucide-react";
import { updateFeatureFlagConfig } from "@/lib/admin-api";
import type { FeatureFlag, AgentConfig, FeatureFlagKey } from "@/types/feature-flags";
import { cn } from "@/lib/utils";

// Default prompts for each agent
const DEFAULT_PROMPTS: Record<string, string> = {
  coverage_agent_enabled: `You are the Paisaxe Coverage Agent. Your job is to maintain high test coverage.

STEPS:
1. Run: npx vitest run --coverage 2>&1
2. Parse the coverage table. Identify files below 100% statement coverage.
3. For each file under 100%:
   a. Read the source file and its test file (if one exists).
   b. Write or update tests to cover the missing lines.
   c. Run the specific test file to confirm it passes.
4. After writing all tests, run the full suite: npx vitest run --coverage 2>&1
5. Update docs/agents/coverage-report.md with a coverage summary.

RULES:
- Do NOT modify source code, only test files.
- Do NOT break existing tests.
- If a line is genuinely untestable in jsdom/vitest, document it rather than forcing a brittle test.
- Commit nothing. The user will review and commit manually.
- Be thorough but pragmatic.`,

  security_agent_enabled: `You are the Paisaxe Security Agent. Your job is to identify security vulnerabilities and license issues.

STEPS:
1. Run npm audit and analyze the results
2. Run license-checker to verify no copyleft licenses
3. Check for outdated packages with known vulnerabilities
4. Review any high or critical severity issues
5. Update docs/agents/security-report.md with findings and recommendations

FOCUS AREAS:
- Critical and high severity vulnerabilities
- Copyleft licenses (GPL, AGPL, LGPL)
- Outdated dependencies with security patches available
- Transitive dependency risks`,

  documentation_agent_enabled: `You are the Paisaxe Documentation Agent. Your job is to identify stale documentation.

STEPS:
1. Compare CLAUDE.md structure with actual codebase
2. Find files modified since docs were last updated
3. Check for undocumented API routes
4. Check for undocumented feature flags
5. Update docs/agents/documentation-report.md with findings

CHECK FOR:
- New migrations not documented
- New API endpoints missing from docs
- Feature flags added but not described
- Modified scripts without doc updates`,

  performance_agent_enabled: `You are the Paisaxe Performance Agent. Your job is to monitor performance metrics.

STEPS:
1. Build the application for production
2. Analyze bundle sizes in .next/static
3. Run Lighthouse if available
4. Check dependency counts
5. Update docs/agents/performance-report.md with metrics

TRACK:
- Total JS bundle size
- Largest bundles
- Core Web Vitals (FCP, LCP, CLS, TBT)
- Dependency growth over time`,

  cost_analyst_agent_enabled: `You are the Paisaxe Cost Analyst Agent. Your job is to monitor platform costs, detect anomalies, and produce a daily financial health report.

STEPS:

1. COLLECT DATA — Query external billing APIs for current usage and spend:
   a. Anthropic Admin API: curl -H "Authorization: Bearer $ANTHROPIC_ADMIN_API_KEY" -H "anthropic-version: 2023-06-01" "https://api.anthropic.com/v1/organizations/usage" to get token/cost data for the current billing period.
   b. ElevenLabs API: curl -H "xi-api-key: $ELEVENLABS_API_KEY" "https://api.elevenlabs.io/v1/usage/character-stats" for voice usage stats.
   c. Twilio API: curl -u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN" "https://api.twilio.com/2010-04-01/Accounts/$TWILIO_ACCOUNT_SID/Usage/Records/ThisMonth.json" for SMS/call costs.
   d. Read src/config/service-tiers.ts for current tier limits and pricing.
   e. Read src/config/recurring-costs.ts for fixed subscription costs.

2. READ PREVIOUS REPORT — Read docs/agents/cost-analyst-report.md for trend comparison with yesterday's data.

3. ANALYZE — Compute:
   - Total monthly spend (fixed + variable)
   - Daily burn rate (total spend / days elapsed this month)
   - Per-service cost breakdown (Anthropic, ElevenLabs, Twilio, Supabase, Vercel, domains)
   - Cost efficiency metrics: cost per chat conversation, cost per voice minute, cost per visitor
   - Month-over-month change percentages vs previous report

4. DETECT ANOMALIES — Flag any of:
   - >20% cost increase vs previous report period
   - Daily spend spike >2x the rolling average
   - Any service approaching tier limit within 30 days at current usage rate
   - Unexpected new charges or services

5. FORECAST — Project costs at 1x (current), 3x, and 10x growth using the same logic as src/lib/costs/forecast.ts:
   - Fixed costs stay constant
   - Variable costs (AI, voice) scale linearly with multiplier
   - Include estimated tier upgrade costs when growth exceeds current limits

6. WRITE REPORT — Output a structured markdown report to docs/agents/cost-analyst-report.md:

   # Cost Analyst Report
   > Auto-generated on YYYY-MM-DD HH:MM:SS

   ## Executive Summary
   One-paragraph financial health overview with key findings.

   ## Current Costs (This Month)
   | Service | Cost (USD) | % of Total | Trend |
   Table of all services with costs, percentage, and up/down/flat trend arrows.

   **Total**: $X.XX | **Daily Burn Rate**: $X.XX/day

   ## Usage Metrics
   | Metric | Current | Previous | Change |
   Chat conversations, voice minutes, visitors, SMS sent, etc.

   ## Cost Efficiency
   | Metric | Value | Trend |
   Cost per chat, cost per voice minute, cost per visitor.

   ## Tier Proximity Alerts
   For each service approaching limits: usage vs limit, days until breach, recommended action.

   ## Scaling Forecast
   | Scenario | Visitors | Chats | Voice Min | Est. Monthly Cost |
   1x / 3x / 10x projections.

   ## Anomalies
   List any detected anomalies with severity and recommended action. "None detected" if clean.

   ## Trend Analysis
   Comparison with previous report: what changed, direction of key metrics.

   ## Recommendations
   Actionable suggestions: tier changes, cost optimizations, budget alerts.

RULES:
- If an API call fails (auth error, rate limit), note it in the report as "Data unavailable" — do not abort.
- Use actual API data when available; fall back to config file values for services without APIs.
- All dollar amounts in USD, rounded to 2 decimal places.
- Commit nothing. The user will review and commit manually.
- Be precise with numbers and conservative with forecasts.`,
};

const SCHEDULE_INFO: Record<string, string> = {
  coverage_agent_enabled: "Daily at 2:00 AM",
  security_agent_enabled: "Weekly on Monday at 9:00 AM",
  documentation_agent_enabled: "Weekly on Sunday at 6:00 AM",
  performance_agent_enabled: "Weekly on Saturday at 10:00 AM",
  cost_analyst_agent_enabled: "Daily at 3:00 AM",
};

const OUTPUT_FILES: Record<string, string> = {
  coverage_agent_enabled: "docs/agents/coverage-report.md",
  security_agent_enabled: "docs/agents/security-report.md",
  documentation_agent_enabled: "docs/agents/documentation-report.md",
  performance_agent_enabled: "docs/agents/performance-report.md",
  cost_analyst_agent_enabled: "docs/agents/cost-analyst-report.md",
};

interface AgentConfigPanelProps {
  flag: FeatureFlag;
  onUpdate: (updatedFlag: FeatureFlag) => void;
}

export function AgentConfigPanel({ flag, onUpdate }: AgentConfigPanelProps) {
  // Extract config with safe defaults
  const config = flag.config as Partial<AgentConfig> | undefined;
  const defaultPrompt = DEFAULT_PROMPTS[flag.flagKey] ?? "";
  const initialPrompt = config?.prompt ?? defaultPrompt;

  const [prompt, setPrompt] = useState(initialPrompt);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const scheduleInfo = SCHEDULE_INFO[flag.flagKey] ?? "Not scheduled";
  const outputFile = OUTPUT_FILES[flag.flagKey] ?? "docs/agent-report.md";

  const handleReset = () => {
    setPrompt(defaultPrompt);
    setSaved(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError("");
    setSaved(false);

    const result = await updateFeatureFlagConfig(flag.flagKey as FeatureFlagKey, {
      prompt,
      schedule_description: scheduleInfo,
      output_file: outputFile,
    });

    setIsSaving(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    if (result.data) {
      onUpdate(result.data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  const hasChanges = prompt !== (config?.prompt ?? defaultPrompt);

  return (
    <div className="space-y-6 pt-6">
      {/* Schedule Info */}
      <div className="flex items-center gap-8 text-sm">
        <div>
          <span className="font-mono text-xs uppercase tracking-widest text-[#6b6560] dark:text-[#a39e98]">
            Schedule
          </span>
          <p className="mt-1 text-[#6b6560] dark:text-[#a39e98]">{scheduleInfo}</p>
        </div>
        <div>
          <span className="font-mono text-xs uppercase tracking-widest text-[#6b6560] dark:text-[#a39e98]">
            Output
          </span>
          <p className="mt-1 font-mono text-xs text-[#6b6560] dark:text-[#a39e98]">
            {outputFile}
          </p>
        </div>
      </div>

      {/* Prompt Editor */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label
            htmlFor={`prompt-${flag.flagKey}`}
            className="block font-mono text-xs uppercase tracking-widest text-[#6b6560] dark:text-[#a39e98]"
          >
            Agent Prompt
          </label>
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1 text-xs text-[#6b6560] transition-colors hover:text-[#6b6560] dark:text-[#a39e98] dark:hover:text-[#a39e98]"
            title="Reset to default prompt"
          >
            <RotateCcw className="h-3 w-3" />
            Reset
          </button>
        </div>
        <textarea
          id={`prompt-${flag.flagKey}`}
          value={prompt}
          onChange={(e) => {
            setPrompt(e.target.value);
            setSaved(false);
          }}
          rows={12}
          className="w-full resize-y border border-[#e5e3de] bg-transparent px-4 py-3 font-mono text-xs leading-relaxed text-[#2d2a26] placeholder-[#a39e98] focus:border-[#c9a55c] focus:outline-none dark:border-[#3d3a36] dark:text-[#f5f3ee]"
          placeholder="Enter the prompt/instructions for this agent..."
        />
        <p className="text-xs text-[#6b6560] dark:text-[#a39e98]">
          This prompt is passed to Claude when the agent runs. Modify it to change the agent&apos;s behavior.
        </p>
      </div>

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* Save button */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || !hasChanges}
          className={cn(
            "flex items-center gap-2 border px-6 py-2 font-mono text-xs uppercase tracking-widest transition-all",
            isSaving || !hasChanges
              ? "cursor-not-allowed border-[#e5e3de] text-[#a39e98] dark:border-[#3d3a36] dark:text-[#6b6560]"
              : "border-[#2d2a26] text-[#2d2a26] hover:bg-[#2d2a26] hover:text-white dark:border-[#f5f3ee] dark:text-[#f5f3ee] dark:hover:bg-[#f5f3ee] dark:hover:text-[#2d2a26]"
          )}
        >
          {isSaving ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              Saving...
            </>
          ) : (
            "Save"
          )}
        </button>
        {saved && (
          <span className="text-sm text-emerald-600 dark:text-emerald-400">
            Saved successfully
          </span>
        )}
        {!hasChanges && !saved && (
          <span className="text-xs text-[#6b6560] dark:text-[#a39e98]">No changes to save</span>
        )}
      </div>
    </div>
  );
}
