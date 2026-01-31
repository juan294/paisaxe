"use client";

import { useState } from "react";
import { Loader2, AlertCircle, RotateCcw } from "lucide-react";
import { updateFeatureFlagConfig } from "@/lib/admin-api";
import type { FeatureFlag, MaintenanceConfig } from "@/types/feature-flags";
import { cn } from "@/lib/utils";

const DEFAULT_CONFIG: MaintenanceConfig = {
  title: "Próximamente",
  message: "",
  show_tagline: true,
};

interface MaintenanceConfigPanelProps {
  flag: FeatureFlag;
  onUpdate: (updatedFlag: FeatureFlag) => void;
}

export function MaintenanceConfigPanel({
  flag,
  onUpdate,
}: MaintenanceConfigPanelProps) {
  // Extract config with safe defaults
  const config = flag.config as Partial<MaintenanceConfig> | undefined;
  const initialTitle = config?.title ?? DEFAULT_CONFIG.title;
  const initialMessage = config?.message ?? DEFAULT_CONFIG.message;
  const initialShowTagline = config?.show_tagline ?? DEFAULT_CONFIG.show_tagline;

  const [title, setTitle] = useState(initialTitle);
  const [message, setMessage] = useState(initialMessage);
  const [showTagline, setShowTagline] = useState(initialShowTagline);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const handleReset = () => {
    setTitle(DEFAULT_CONFIG.title);
    setMessage(DEFAULT_CONFIG.message);
    setShowTagline(DEFAULT_CONFIG.show_tagline);
    setSaved(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError("");
    setSaved(false);

    const result = await updateFeatureFlagConfig("maintenance_mode", {
      title,
      message,
      show_tagline: showTagline,
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

  const hasChanges =
    title !== (config?.title ?? DEFAULT_CONFIG.title) ||
    message !== (config?.message ?? DEFAULT_CONFIG.message) ||
    showTagline !== (config?.show_tagline ?? DEFAULT_CONFIG.show_tagline);

  return (
    <div className="space-y-6 pt-6">
      {/* Title */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label
            htmlFor="maintenance-title"
            className="block font-mono text-xs uppercase tracking-widest text-stone-400"
          >
            Display Title
          </label>
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1 text-xs text-stone-400 transition-colors hover:text-stone-600 dark:hover:text-stone-300"
            title="Reset to defaults"
          >
            <RotateCcw className="h-3 w-3" />
            Reset
          </button>
        </div>
        <input
          id="maintenance-title"
          type="text"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setSaved(false);
          }}
          placeholder="Próximamente"
          className="w-full border border-stone-200 bg-transparent px-4 py-2 text-sm text-stone-900 placeholder-stone-400 focus:border-stone-400 focus:outline-none dark:border-stone-700 dark:text-stone-100"
        />
        <p className="text-xs text-stone-400">
          The main text shown on the maintenance page (e.g., &quot;Próximamente&quot;, &quot;We&apos;ll be back soon&quot;)
        </p>
      </div>

      {/* Additional Message */}
      <div className="space-y-2">
        <label
          htmlFor="maintenance-message"
          className="block font-mono text-xs uppercase tracking-widest text-stone-400"
        >
          Additional Message (optional)
        </label>
        <textarea
          id="maintenance-message"
          value={message}
          onChange={(e) => {
            setMessage(e.target.value);
            setSaved(false);
          }}
          rows={3}
          placeholder="Under maintenance. Check back soon!"
          className="w-full resize-y border border-stone-200 bg-transparent px-4 py-3 text-sm leading-relaxed text-stone-900 placeholder-stone-400 focus:border-stone-400 focus:outline-none dark:border-stone-700 dark:text-stone-100"
        />
        <p className="text-xs text-stone-400">
          Optional additional message displayed below the title
        </p>
      </div>

      {/* Show Tagline Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <span className="block font-mono text-xs uppercase tracking-widest text-stone-400">
            Show Tagline
          </span>
          <p className="mt-1 text-xs text-stone-400">
            Display &quot;Look. Ask. Explore.&quot; on the page
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowTagline(!showTagline);
            setSaved(false);
          }}
          className={cn(
            "relative h-6 w-11 rounded-full transition-colors",
            showTagline
              ? "bg-stone-900 dark:bg-stone-100"
              : "bg-stone-200 dark:bg-stone-800"
          )}
          role="switch"
          aria-checked={showTagline}
        >
          <span
            className={cn(
              "absolute top-0.5 h-5 w-5 rounded-full transition-all",
              showTagline
                ? "left-[22px] bg-white dark:bg-stone-900"
                : "left-0.5 bg-white dark:bg-stone-600"
            )}
          />
        </button>
      </div>

      {/* Preview */}
      <div className="space-y-2">
        <span className="block font-mono text-xs uppercase tracking-widest text-stone-400">
          Preview
        </span>
        <div className="rounded-lg bg-[#030303] p-8 text-center">
          <p className="text-sm tracking-[0.3em] uppercase text-white/80">
            {title || "Próximamente"}
          </p>
          {message && (
            <p className="mt-3 text-xs text-white/50">{message}</p>
          )}
          {showTagline && (
            <p className="mt-4 text-xs tracking-widest uppercase text-white/30">
              Look. Ask. Explore.
            </p>
          )}
        </div>
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
