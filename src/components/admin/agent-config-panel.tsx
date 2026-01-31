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
5. Update docs/coverage-report.md with a coverage summary.

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
5. Update docs/security-report.md with findings and recommendations

FOCUS AREAS:
- Critical and high severity vulnerabilities
- Copyleft licenses (GPL, AGPL, LGPL)
- Outdated dependencies with security patches available
- Transitive dependency risks`,

  docs_freshness_agent_enabled: `You are the Paisaxe Docs Freshness Agent. Your job is to identify stale documentation.

STEPS:
1. Compare CLAUDE.md structure with actual codebase
2. Find files modified since docs were last updated
3. Check for undocumented API routes
4. Check for undocumented feature flags
5. Update docs/docs-freshness-report.md with findings

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
5. Update docs/performance-report.md with metrics

TRACK:
- Total JS bundle size
- Largest bundles
- Core Web Vitals (FCP, LCP, CLS, TBT)
- Dependency growth over time`,
};

const SCHEDULE_INFO: Record<string, string> = {
  coverage_agent_enabled: "Daily at 2:00 AM",
  security_agent_enabled: "Weekly on Monday at 9:00 AM",
  docs_freshness_agent_enabled: "Weekly on Sunday at 6:00 AM",
  performance_agent_enabled: "Weekly on Saturday at 10:00 AM",
};

const OUTPUT_FILES: Record<string, string> = {
  coverage_agent_enabled: "docs/coverage-report.md",
  security_agent_enabled: "docs/security-report.md",
  docs_freshness_agent_enabled: "docs/docs-freshness-report.md",
  performance_agent_enabled: "docs/performance-report.md",
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
          <span className="font-mono text-xs uppercase tracking-widest text-stone-400">
            Schedule
          </span>
          <p className="mt-1 text-stone-600 dark:text-stone-300">{scheduleInfo}</p>
        </div>
        <div>
          <span className="font-mono text-xs uppercase tracking-widest text-stone-400">
            Output
          </span>
          <p className="mt-1 font-mono text-xs text-stone-600 dark:text-stone-300">
            {outputFile}
          </p>
        </div>
      </div>

      {/* Prompt Editor */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label
            htmlFor={`prompt-${flag.flagKey}`}
            className="block font-mono text-xs uppercase tracking-widest text-stone-400"
          >
            Agent Prompt
          </label>
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1 text-xs text-stone-400 transition-colors hover:text-stone-600 dark:hover:text-stone-300"
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
          className="w-full resize-y border border-stone-200 bg-transparent px-4 py-3 font-mono text-xs leading-relaxed text-stone-900 placeholder-stone-400 focus:border-stone-400 focus:outline-none dark:border-stone-700 dark:text-stone-100"
          placeholder="Enter the prompt/instructions for this agent..."
        />
        <p className="text-xs text-stone-400">
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
              ? "cursor-not-allowed border-stone-200 text-stone-300 dark:border-stone-700 dark:text-stone-600"
              : "border-stone-900 text-stone-900 hover:bg-stone-900 hover:text-white dark:border-stone-100 dark:text-stone-100 dark:hover:bg-stone-100 dark:hover:text-stone-900"
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
          <span className="text-xs text-stone-400">No changes to save</span>
        )}
      </div>
    </div>
  );
}
