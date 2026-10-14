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
        <h4 className="font-mono text-xs uppercase tracking-widest text-admin-muted dark:text-admin-subtle">
          Service Registry
        </h4>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-admin-paper dark:border-admin-depth">
                <th className="pb-2 pr-4 text-left font-medium text-admin-muted dark:text-admin-subtle">Service</th>
                <th className="pb-2 pr-4 text-left font-medium text-admin-muted dark:text-admin-subtle">Plan</th>
                <th className="pb-2 pr-4 text-right font-medium text-admin-muted dark:text-admin-subtle">Cost/mo</th>
                <th className="pb-2 text-right font-medium text-admin-muted dark:text-admin-subtle">Dashboard</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-admin-paper dark:divide-admin-depth">
              {SERVICE_REGISTRY.map((service) => (
                <tr key={service.serviceId}>
                  <td className="py-2 pr-4 text-admin-ink dark:text-admin-paper">
                    {service.serviceName}
                  </td>
                  <td className="py-2 pr-4 text-admin-muted dark:text-admin-subtle">
                    {service.currentPlan}
                  </td>
                  <td className="py-2 pr-4 text-right font-mono text-admin-muted dark:text-admin-subtle">
                    ${service.monthlyCostUsd.toFixed(2)}
                  </td>
                  <td className="py-2 text-right">
                    <a
                      href={service.dashboardUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-admin-subtle transition-colors hover:text-admin-muted"
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
        <h4 className="font-mono text-xs uppercase tracking-widest text-admin-muted dark:text-admin-subtle">
          Usage Metrics
        </h4>
        <p className="mt-1 text-xs text-admin-subtle dark:text-admin-muted">
          Override default usage estimates. These values are passed to the optimizer when it runs.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {(Object.keys(METRIC_LABELS) as (keyof UsageMetricsForm)[]).map((key) => (
            <div key={key}>
              <label
                htmlFor={`metric-${key}`}
                className="block text-xs text-admin-muted dark:text-admin-subtle"
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
                className="mt-1 w-full border border-admin-line bg-transparent px-3 py-1.5 font-mono text-xs text-admin-ink focus-visible:border-admin-warning focus-visible:outline-none dark:border-admin-depth dark:text-admin-paper"
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
              ? "cursor-not-allowed border-admin-line text-admin-subtle dark:border-admin-depth dark:text-admin-muted"
              : "border-admin-ink text-admin-ink hover:bg-admin-ink hover:text-white dark:border-admin-paper dark:text-admin-paper dark:hover:bg-admin-paper dark:hover:text-admin-ink"
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
          <span className="text-xs text-admin-muted dark:text-admin-subtle">No changes to save</span>
        )}
      </div>
    </div>
  );
}
