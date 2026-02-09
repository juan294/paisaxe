"use client";

import { useState, useCallback, useEffect } from "react";
import { ChevronDown, ExternalLink, ShieldAlert } from "lucide-react";
import { fetchCostsAnalytics } from "@/lib/admin-api";
import type { UsageMetrics } from "@/types/costs-analytics";
import { PLATFORM_SERVICES } from "@/types/costs-analytics";
import { computeTierAlerts } from "@/lib/costs";
import { SERVICE_TIERS } from "@/config/service-tiers";
import type { TierAlertsSectionProps, TierAlert, AlertLevel } from "./types";
import { formatDateShort } from "./chart";

export function TierAlertsSection({ dateRange }: TierAlertsSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [usageMetrics, setUsageMetrics] = useState<UsageMetrics | null>(null);
  const [alerts, setAlerts] = useState<TierAlert[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showAll, setShowAll] = useState(true);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await fetchCostsAnalytics(dateRange.from, dateRange.to, {
        includeUsage: true,
      });
      if (result.data?.usageMetrics) {
        const metrics = result.data.usageMetrics;
        setUsageMetrics(metrics);

        const usageMap: Record<string, number> = {
          voiceMinutes: metrics.voiceMinutes,
          visitors: metrics.visitors,
          posthogEvents: metrics.posthogEvents ?? 0,
        };

        setAlerts(
          computeTierAlerts(SERVICE_TIERS, usageMap, metrics.periodDays)
        );
      }
    } catch {
      // Tier alerts are optional — fail silently
    } finally {
      setIsLoading(false);
    }
  }, [dateRange.from, dateRange.to]);

  // Auto-load usage data on mount (expanded by default)
  useEffect(() => {
    if (!usageMetrics && !isLoading) {
      loadData();
    }
  }, [loadData]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggle = () => {
    const willExpand = !isExpanded;
    setIsExpanded(willExpand);
    if (willExpand && !usageMetrics && !isLoading) {
      loadData();
    }
  };

  const nonSafeAlerts = alerts?.filter((a) => a.alertLevel !== "safe") ?? [];
  const displayAlerts = showAll ? (alerts ?? []) : nonSafeAlerts;

  return (
    <section>
      <button
        onClick={handleToggle}
        className="flex w-full items-center justify-between rounded-lg px-1 py-2 transition-colors hover:bg-[#f5f3ee] dark:hover:bg-[#2d2a26]"
      >
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-[#a39e98]" />
          <h3 className="font-mono text-xs uppercase tracking-widest text-[#a39e98]">
            Tier Upgrade Alerts
          </h3>
          {!isExpanded && nonSafeAlerts.length > 0 && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 font-mono text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              {nonSafeAlerts.length}
            </span>
          )}
        </div>
        <ChevronDown
          className={`h-4 w-4 text-[#a39e98] transition-transform ${isExpanded ? "rotate-180" : ""}`}
        />
      </button>

      {isExpanded && (
        <div className="mt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <p className="animate-pulse font-mono text-xs text-[#a39e98]">
                Analyzing usage patterns...
              </p>
            </div>
          ) : !alerts ? (
            <div className="flex flex-col items-center justify-center gap-2 py-8">
              <p className="font-mono text-xs text-[#a39e98]">
                No usage data available yet
              </p>
            </div>
          ) : (
            <>
              {usageMetrics && usageMetrics.periodDays < 30 && (
                <p className="mb-3 font-mono text-xs text-[#a39e98]">
                  Based on {usageMetrics.periodDays} days of data
                </p>
              )}

              {displayAlerts.length === 0 && !showAll ? (
                <div className="flex flex-col items-center gap-2 py-6">
                  <p className="font-mono text-xs text-emerald-600 dark:text-emerald-400">
                    All services within safe limits
                  </p>
                  <button
                    onClick={() => setShowAll(true)}
                    className="font-mono text-xs text-[#a39e98] underline hover:text-[#6b6560]"
                  >
                    Show all services
                  </button>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-[#e5e3de] text-left dark:border-[#3d3a36]">
                          <th className="pb-2 font-mono text-xs uppercase tracking-widest text-[#a39e98]">
                            Service
                          </th>
                          <th className="pb-2 font-mono text-xs uppercase tracking-widest text-[#a39e98]">
                            Metric
                          </th>
                          <th className="pb-2 font-mono text-xs uppercase tracking-widest text-[#a39e98]">
                            Usage
                          </th>
                          <th className="pb-2 font-mono text-xs uppercase tracking-widest text-[#a39e98]">
                            Projected Limit
                          </th>
                          <th className="pb-2 font-mono text-xs uppercase tracking-widest text-[#a39e98]">
                            Status
                          </th>
                          <th className="pb-2 font-mono text-xs uppercase tracking-widest text-[#a39e98]">
                            Action
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#f5f3ee] dark:divide-[#3d3a36]">
                        {displayAlerts.map((alert) => (
                          <TierAlertRow
                            key={`${alert.serviceId}-${alert.metricLabel}`}
                            alert={alert}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {!showAll && alerts.length > nonSafeAlerts.length && (
                    <button
                      onClick={() => setShowAll(true)}
                      className="mt-3 font-mono text-xs text-[#a39e98] underline hover:text-[#6b6560]"
                    >
                      Show all ({alerts.length - nonSafeAlerts.length} safe)
                    </button>
                  )}
                  {showAll && nonSafeAlerts.length < (alerts?.length ?? 0) && (
                    <button
                      onClick={() => setShowAll(false)}
                      className="mt-3 font-mono text-xs text-[#a39e98] underline hover:text-[#6b6560]"
                    >
                      Hide safe services
                    </button>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}

function TierAlertRow({ alert }: { alert: TierAlert }) {
  const formatNum = (n: number) =>
    n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n.toLocaleString();

  const platformService = Object.values(PLATFORM_SERVICES).find(
    (s) => s.id === alert.serviceId
  );

  return (
    <tr>
      <td className="py-2 text-sm text-[#4d4944] dark:text-[#a39e98]">
        <div className="flex flex-col">
          <span className="flex items-center gap-1">
            {alert.serviceName}
            {platformService?.dashboardUrl && (
              <a
                href={platformService.dashboardUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#a39e98] hover:text-[#4d4944] dark:hover:text-[#f5f3ee]"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </span>
          <span className="text-xs text-[#a39e98]">{alert.currentTierName}</span>
        </div>
      </td>
      <td className="py-2 text-sm text-[#4d4944] dark:text-[#a39e98]">
        {alert.metricLabel}
      </td>
      <td className="py-2">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-xs tabular-nums text-[#4d4944] dark:text-[#a39e98]">
            {formatNum(alert.currentUsage)} / {formatNum(alert.monthlyLimit)}{" "}
            {alert.unit}
          </span>
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-[#e5e3de] dark:bg-[#3d3a36]">
            <div
              className={`h-full rounded-full transition-all ${alertBarColor(alert.alertLevel)}`}
              style={{ width: `${Math.min(alert.usagePercent, 100)}%` }}
            />
          </div>
        </div>
      </td>
      <td className="py-2 font-mono text-xs tabular-nums text-[#4d4944] dark:text-[#a39e98]">
        {alert.projectedDate ? (
          <span>
            {alert.projectedDaysToLimit === 0
              ? "Exceeded"
              : `~${alert.projectedDaysToLimit}d (${formatDateShort(alert.projectedDate)})`}
          </span>
        ) : (
          <span className="text-[#a39e98]">—</span>
        )}
      </td>
      <td className="py-2">
        <AlertLevelBadge level={alert.alertLevel} />
      </td>
      <td className="py-2 text-xs text-[#4d4944] dark:text-[#a39e98]">
        {alert.recommendation ? (
          <span>
            → {alert.recommendation.tierName} ($
            {alert.recommendation.monthlyCostUsd}/mo
            {alert.recommendation.costDelta > 0 &&
              `, +$${alert.recommendation.costDelta}`}
            )
          </span>
        ) : (
          <span className="text-[#a39e98]">—</span>
        )}
      </td>
    </tr>
  );
}

function alertBarColor(level: AlertLevel): string {
  switch (level) {
    case "critical":
      return "bg-rose-500 dark:bg-rose-400";
    case "warning":
      return "bg-amber-500 dark:bg-amber-400";
    case "watch":
      return "bg-blue-500 dark:bg-blue-400";
    case "safe":
      return "bg-emerald-500 dark:bg-emerald-400";
  }
}

function AlertLevelBadge({ level }: { level: AlertLevel }) {
  const styles: Record<AlertLevel, { bg: string; text: string }> = {
    critical: {
      bg: "bg-rose-100 dark:bg-rose-900/30",
      text: "text-rose-700 dark:text-rose-400",
    },
    warning: {
      bg: "bg-amber-100 dark:bg-amber-900/30",
      text: "text-amber-700 dark:text-amber-400",
    },
    watch: {
      bg: "bg-blue-100 dark:bg-blue-900/30",
      text: "text-blue-700 dark:text-blue-400",
    },
    safe: {
      bg: "bg-emerald-100 dark:bg-emerald-900/30",
      text: "text-emerald-700 dark:text-emerald-400",
    },
  };

  const style = styles[level];

  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 font-mono text-xs font-medium capitalize ${style.bg} ${style.text}`}
    >
      {level}
    </span>
  );
}
