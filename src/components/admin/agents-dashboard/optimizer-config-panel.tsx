"use client";

import { useState } from "react";
import { Loader2, AlertCircle, ExternalLink } from "lucide-react";
import { updateFeatureFlagConfig } from "@/lib/admin-api";
import type { FeatureFlag, FeatureFlagKey } from "@/types/feature-flags";
import { SERVICE_REGISTRY } from "@/config/service-registry";
import { cn } from "@/lib/utils";

interface OptimizerConfigPanelProps {
  flag: FeatureFlag;
  onUpdate: (updatedFlag: FeatureFlag) => void;
}

interface UsageMetricsForm {
  voiceMinutes: number;
  visitors: number;
  chatConversations: number;
  voiceConversations: number;
  posthogEvents: number;
  supabaseStorageGb: number;
  periodDays: number;
}

const DEFAULT_METRICS: UsageMetricsForm = {
  voiceMinutes: 15,
  visitors: 5000,
  chatConversations: 200,
  voiceConversations: 30,
  posthogEvents: 10000,
  supabaseStorageGb: 1.5,
  periodDays: 30,
};

const METRIC_LABELS: Record<keyof UsageMetricsForm, string> = {
  voiceMinutes: "Voice Minutes",
  visitors: "Visitors",
  chatConversations: "Chat Conversations",
  voiceConversations: "Voice Conversations",
  posthogEvents: "PostHog Events",
  supabaseStorageGb: "Supabase Storage (GB)",
  periodDays: "Period (days)",
};

export function OptimizerConfigPanel({ flag, onUpdate }: OptimizerConfigPanelProps) {
  const savedMetrics = (flag.config as Record<string, unknown>)?.optimizer as
    | { usageMetrics?: Partial<UsageMetricsForm> }
    | undefined;

  const initialMetrics: UsageMetricsForm = {
    ...DEFAULT_METRICS,
    ...(savedMetrics?.usageMetrics ?? {}),
  };

  const [metrics, setMetrics] = useState<UsageMetricsForm>(initialMetrics);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const hasChanges = (Object.keys(DEFAULT_METRICS) as (keyof UsageMetricsForm)[]).some(
    (key) => metrics[key] !== initialMetrics[key]
  );

  const handleMetricChange = (key: keyof UsageMetricsForm, value: string) => {
    const num = parseFloat(value);
    if (!isNaN(num)) {
      setMetrics((prev) => ({ ...prev, [key]: num }));
      setSaved(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError("");
    setSaved(false);

    const result = await updateFeatureFlagConfig(
      flag.flagKey as FeatureFlagKey,
      {
        ...flag.config,
        optimizer: { usageMetrics: metrics },
      }
    );

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

  return (
    <div className="space-y-6 pt-6">
      {/* Service Registry — Read-only */}
      <div>
        <h4 className="font-mono text-xs uppercase tracking-widest text-[#6b6560] dark:text-[#a39e98]">
          Service Registry
        </h4>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#f5f3ee] dark:border-[#3d3a36]">
                <th className="pb-2 pr-4 text-left font-medium text-[#6b6560] dark:text-[#a39e98]">Service</th>
                <th className="pb-2 pr-4 text-left font-medium text-[#6b6560] dark:text-[#a39e98]">Plan</th>
                <th className="pb-2 pr-4 text-right font-medium text-[#6b6560] dark:text-[#a39e98]">Cost/mo</th>
                <th className="pb-2 text-right font-medium text-[#6b6560] dark:text-[#a39e98]">Dashboard</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f5f3ee] dark:divide-[#3d3a36]">
              {SERVICE_REGISTRY.map((service) => (
                <tr key={service.serviceId}>
                  <td className="py-2 pr-4 text-[#2d2a26] dark:text-[#f5f3ee]">
                    {service.serviceName}
                  </td>
                  <td className="py-2 pr-4 text-[#6b6560] dark:text-[#a39e98]">
                    {service.currentPlan}
                  </td>
                  <td className="py-2 pr-4 text-right font-mono text-[#6b6560] dark:text-[#a39e98]">
                    ${service.monthlyCostUsd.toFixed(2)}
                  </td>
                  <td className="py-2 text-right">
                    <a
                      href={service.dashboardUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[#a39e98] transition-colors hover:text-[#6b6560]"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Usage Metrics — Editable */}
      <div>
        <h4 className="font-mono text-xs uppercase tracking-widest text-[#6b6560] dark:text-[#a39e98]">
          Usage Metrics
        </h4>
        <p className="mt-1 text-xs text-[#a39e98] dark:text-[#6b6560]">
          Override default usage estimates. These values are passed to the optimizer when it runs.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {(Object.keys(METRIC_LABELS) as (keyof UsageMetricsForm)[]).map((key) => (
            <div key={key}>
              <label
                htmlFor={`metric-${key}`}
                className="block text-xs text-[#6b6560] dark:text-[#a39e98]"
              >
                {METRIC_LABELS[key]}
              </label>
              <input
                id={`metric-${key}`}
                type="number"
                value={metrics[key]}
                onChange={(e) => handleMetricChange(key, e.target.value)}
                step={key === "supabaseStorageGb" ? "0.1" : "1"}
                min={0}
                className="mt-1 w-full border border-[#e5e3de] bg-transparent px-3 py-1.5 font-mono text-xs text-[#2d2a26] focus-visible:border-[#c9a55c] focus-visible:outline-none dark:border-[#3d3a36] dark:text-[#f5f3ee]"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* Save */}
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
          aria-label="Save"
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
