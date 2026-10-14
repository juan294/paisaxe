"use client";

import { useState, useCallback, useEffect } from "react";
import { ChevronDown, TrendingUp } from "lucide-react";
import { fetchCostsAnalytics } from "@/lib/admin-api";
import type { UsageMetrics, ForecastScenario } from "@/types/costs-analytics";
import { computeForecasts } from "@/lib/costs/forecast";
import type { ScalingForecastSectionProps } from "./types";

export function ScalingForecastSection({ services, dateRange }: ScalingForecastSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [usageMetrics, setUsageMetrics] = useState<UsageMetrics | null>(null);
  const [forecasts, setForecasts] = useState<ForecastScenario[] | null>(null);
  const [isLoadingUsage, setIsLoadingUsage] = useState(false);

  const loadUsageData = useCallback(async () => {
    setIsLoadingUsage(true);
    try {
      const result = await fetchCostsAnalytics(dateRange.from, dateRange.to, {
        includeUsage: true,
      });
      if (result.data?.usageMetrics) {
        setUsageMetrics(result.data.usageMetrics);
        setForecasts(computeForecasts(services, result.data.usageMetrics));
      }
    } catch {
      // Silently fail — forecast is optional
    } finally {
      setIsLoadingUsage(false);
    }
  }, [dateRange.from, dateRange.to, services]);

  // Auto-load usage data on mount (expanded by default)
  useEffect(() => {
    if (!usageMetrics && !isLoadingUsage) {
      loadUsageData();
    }
  }, [loadUsageData]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggle = () => {
    const willExpand = !isExpanded;
    setIsExpanded(willExpand);
    if (willExpand && !usageMetrics && !isLoadingUsage) {
      loadUsageData();
    }
  };

  const formatNum = (n: number) => n.toLocaleString();
  const formatUsd = (n: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(n);

  return (
    <section>
      <button
        onClick={handleToggle}
        className="flex w-full items-center justify-between rounded-lg px-1 py-2 transition-colors hover:bg-admin-paper dark:hover:bg-admin-ink"
      >
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-admin-subtle" />
          <h3 className="font-mono text-xs uppercase tracking-widest text-admin-subtle">
            Scaling Forecast
          </h3>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-admin-subtle transition-transform ${isExpanded ? "rotate-180" : ""}`}
        />
      </button>

      {isExpanded && (
        <div className="mt-4 space-y-8">
          {isLoadingUsage ? (
            <div className="flex items-center justify-center py-8">
              <p className="animate-pulse font-mono text-xs text-admin-subtle">
                Loading usage data...
              </p>
            </div>
          ) : !usageMetrics ? (
            <div className="flex flex-col items-center justify-center gap-2 py-8">
              <p className="font-mono text-xs text-admin-subtle">
                No usage data available yet
              </p>
              <p className="font-mono text-xs text-admin-muted">
                Chat events will appear after users interact with the chat
              </p>
            </div>
          ) : (
            <>
              {/* Reality Table */}
              <div>
                <h4 className="mb-3 font-mono text-xs uppercase tracking-widest text-admin-muted dark:text-admin-subtle">
                  Current Period Reality
                  {usageMetrics.periodDays < 30 && (
                    <span className="ml-2 normal-case text-admin-subtle">
                      (based on {usageMetrics.periodDays} days of data)
                    </span>
                  )}
                </h4>
                <table className="w-full max-w-lg">
                  <thead>
                    <tr className="border-b border-admin-line text-left dark:border-admin-depth">
                      <th className="pb-2 font-mono text-xs uppercase tracking-widest text-admin-subtle">
                        Metric
                      </th>
                      <th className="pb-2 text-right font-mono text-xs uppercase tracking-widest text-admin-subtle">
                        This Period
                      </th>
                      <th className="pb-2 text-right font-mono text-xs uppercase tracking-widest text-admin-subtle">
                        Monthly Rate
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-admin-paper dark:divide-admin-depth">
                    <RealityRow
                      label="Visitors"
                      actual={usageMetrics.visitors}
                      periodDays={usageMetrics.periodDays}
                    />
                    <RealityRow
                      label="Chat Conversations"
                      actual={usageMetrics.chatConversations}
                      periodDays={usageMetrics.periodDays}
                    />
                    <RealityRow
                      label="Voice Sessions"
                      actual={usageMetrics.voiceConversations}
                      periodDays={usageMetrics.periodDays}
                    />
                    <RealityRow
                      label="Voice Minutes"
                      actual={usageMetrics.voiceMinutes}
                      periodDays={usageMetrics.periodDays}
                      decimals={1}
                    />
                  </tbody>
                </table>
              </div>

              {/* Forecast Table */}
              {forecasts && forecasts.length > 0 && (
                <div>
                  <h4 className="mb-3 font-mono text-xs uppercase tracking-widest text-admin-muted dark:text-admin-subtle">
                    Growth Projections
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-admin-line text-left dark:border-admin-depth">
                          <th className="pb-2 font-mono text-xs uppercase tracking-widest text-admin-subtle" />
                          {forecasts.map((f) => (
                            <th
                              key={f.label}
                              className="pb-2 text-right font-mono text-xs uppercase tracking-widest text-admin-subtle"
                            >
                              {f.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-admin-paper dark:divide-admin-depth">
                        <ForecastRow
                          label="Monthly Visitors"
                          values={forecasts.map((f) => formatNum(f.visitors))}
                        />
                        <ForecastRow
                          label="Chats"
                          values={forecasts.map((f) => formatNum(f.chats))}
                        />
                        <ForecastRow
                          label="Voice Minutes"
                          values={forecasts.map((f) => formatNum(f.voiceMinutes))}
                        />
                        <ForecastRow
                          label="Infrastructure"
                          values={forecasts.map((f) =>
                            formatUsd(f.breakdown.infrastructure)
                          )}
                          isCost
                        />
                        <ForecastRow
                          label="AI (Claude)"
                          values={forecasts.map((f) =>
                            formatUsd(f.breakdown.ai)
                          )}
                          isCost
                        />
                        <ForecastRow
                          label="Voice (ElevenLabs)"
                          values={forecasts.map((f) =>
                            formatUsd(f.breakdown.voice)
                          )}
                          isCost
                        />
                        <tr className="border-t-2 border-admin-line dark:border-admin-depth">
                          <td className="py-2 text-sm font-medium text-admin-ink dark:text-admin-paper">
                            Est. Monthly
                          </td>
                          {forecasts.map((f) => (
                            <td
                              key={f.label}
                              className="py-2 text-right font-mono text-sm font-medium tabular-nums text-rose-600 dark:text-rose-400"
                            >
                              {formatUsd(f.estimatedMonthlyCost)}
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}

function RealityRow({
  label,
  actual,
  periodDays,
  decimals = 0,
}: {
  label: string;
  actual: number;
  periodDays: number;
  decimals?: number;
}) {
  const monthlyRate = Math.round((actual * (30 / Math.max(periodDays, 1))) * Math.pow(10, decimals)) / Math.pow(10, decimals);
  const formatted = decimals > 0 ? actual.toFixed(decimals) : actual.toLocaleString();
  const monthlyFormatted = decimals > 0 ? monthlyRate.toFixed(decimals) : monthlyRate.toLocaleString();

  return (
    <tr>
      <td className="py-2 text-sm text-admin-secondary dark:text-admin-subtle">
        {label}
      </td>
      <td className="py-2 text-right font-mono text-sm tabular-nums text-admin-ink dark:text-admin-paper">
        {formatted}
      </td>
      <td className="py-2 text-right font-mono text-sm tabular-nums text-admin-muted dark:text-admin-subtle">
        {monthlyFormatted}
      </td>
    </tr>
  );
}

function ForecastRow({
  label,
  values,
  isCost = false,
}: {
  label: string;
  values: string[];
  isCost?: boolean;
}) {
  return (
    <tr>
      <td className="py-2 text-sm text-admin-secondary dark:text-admin-subtle">
        {label}
      </td>
      {values.map((v, i) => (
        <td
          key={i}
          className={`py-2 text-right font-mono text-sm tabular-nums ${
            isCost
              ? "text-rose-600 dark:text-rose-400"
              : "text-admin-ink dark:text-admin-paper"
          }`}
        >
          {v}
        </td>
      ))}
    </tr>
  );
}
