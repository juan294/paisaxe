"use client";

import { useState } from "react";
import { Loader2, AlertCircle, RotateCcw } from "lucide-react";
import { updateFeatureFlagConfig } from "@/lib/admin-api";
import type { FeatureFlag, FeatureFlagKey } from "@/types/feature-flags";

interface AgentConfig {
  prompt: string;
  schedule_description?: string;
  output_file?: string;
}
import { cn } from "@/lib/utils";
import { AGENT_PROMPT_DEFAULTS } from "@/config/agent-prompts";

// Derive lookup records from the shared config
const DEFAULT_PROMPTS: Record<string, string> = Object.fromEntries(
  Object.entries(AGENT_PROMPT_DEFAULTS).map(([k, v]) => [k, v.prompt])
);
const SCHEDULE_INFO: Record<string, string> = Object.fromEntries(
  Object.entries(AGENT_PROMPT_DEFAULTS).map(([k, v]) => [k, v.schedule])
);
const OUTPUT_FILES: Record<string, string> = Object.fromEntries(
  Object.entries(AGENT_PROMPT_DEFAULTS).map(([k, v]) => [k, v.outputFile])
);

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
          <span className="font-mono text-xs uppercase tracking-widest text-admin-muted dark:text-admin-subtle">
            Schedule
          </span>
          <p className="mt-1 text-admin-muted dark:text-admin-subtle">{scheduleInfo}</p>
        </div>
        <div>
          <span className="font-mono text-xs uppercase tracking-widest text-admin-muted dark:text-admin-subtle">
            Output
          </span>
          <p className="mt-1 font-mono text-xs text-admin-muted dark:text-admin-subtle">
            {outputFile}
          </p>
        </div>
      </div>

      {/* Prompt Editor */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label
            htmlFor={`prompt-${flag.flagKey}`}
            className="block font-mono text-xs uppercase tracking-widest text-admin-muted dark:text-admin-subtle"
          >
            Agent Prompt
          </label>
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1 text-xs text-admin-muted transition-colors hover:text-admin-muted dark:text-admin-subtle dark:hover:text-admin-subtle"
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
          className="w-full resize-y border border-admin-line bg-transparent px-4 py-3 font-mono text-xs leading-relaxed text-admin-ink placeholder-admin-subtle focus-visible:border-admin-warning focus-visible:outline-none dark:border-admin-depth dark:text-admin-paper"
          placeholder="Enter the prompt/instructions for this agent..."
        />
        <p className="text-xs text-admin-muted dark:text-admin-subtle">
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
              ? "cursor-not-allowed border-admin-line text-admin-subtle dark:border-admin-depth dark:text-admin-muted"
              : "border-admin-ink text-admin-ink hover:bg-admin-ink hover:text-white dark:border-admin-paper dark:text-admin-paper dark:hover:bg-admin-paper dark:hover:text-admin-ink"
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
          <span className="text-xs text-admin-muted dark:text-admin-subtle">No changes to save</span>
        )}
      </div>
    </div>
  );
}
