"use client";

import { useState, useCallback, useEffect } from "react";
import { ChevronDown, TrendingUp } from "lucide-react";
import { fetchCostsAnalytics } from "@/lib/admin-api";
import type { UsageMetrics, ForecastScenario } from "@/types/costs-analytics";
import { computeForecasts } from "@/lib/costs";
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
        className="flex w-full items-center justify-between rounded-lg px-1 py-2 transition-colors hover:bg-[#f5f3ee] dark:hover:bg-[#2d2a26]"
      >
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-[#a39e98]" />
          <h3 className="font-mono text-xs uppercase tracking-widest text-[#a39e98]">
            Scaling Forecast
          </h3>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-[#a39e98] transition-transform ${isExpanded ? "rotate-180" : ""}`}
        />
      </button>

      {isExpanded && (
        <div className="mt-4 space-y-8">
          {isLoadingUsage ? (
            <div className="flex items-center justify-center py-8">
              <p className="animate-pulse font-mono text-xs text-[#a39e98]">
                Loading usage data...
              </p>
            </div>
          ) : !usageMetrics ? (
            <div className="flex flex-col items-center justify-center gap-2 py-8">
              <p className="font-mono text-xs text-[#a39e98]">
                No usage data available yet
              </p>
              <p className="font-mono text-xs text-[#6b6560]">
                Chat events will appear after users interact with the chat
              </p>
            </div>
          ) : (
            <>
              {/* Reality Table */}
              <div>
                <h4 className="mb-3 font-mono text-xs uppercase tracking-widest text-[#6b6560] dark:text-[#a39e98]">
                  Current Period Reality
                  {usageMetrics.periodDays < 30 && (
                    <span className="ml-2 normal-case text-[#a39e98]">
                      (based on {usageMetrics.periodDays} days of data)
                    </span>
                  )}
                </h4>
                <table className="w-full max-w-lg">
                  <thead>
                    <tr className="border-b border-[#e5e3de] text-left dark:border-[#3d3a36]">
                      <th className="pb-2 font-mono text-xs uppercase tracking-widest text-[#a39e98]">
                        Metric
                      </th>
                      <th className="pb-2 text-right font-mono text-xs uppercase tracking-widest text-[#a39e98]">
                        This Period
                      </th>
                      <th className="pb-2 text-right font-mono text-xs uppercase tracking-widest text-[#a39e98]">
                        Monthly Rate
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f5f3ee] dark:divide-[#3d3a36]">
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
                  <h4 className="mb-3 font-mono text-xs uppercase tracking-widest text-[#6b6560] dark:text-[#a39e98]">
                    Growth Projections
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-[#e5e3de] text-left dark:border-[#3d3a36]">
                          <th className="pb-2 font-mono text-xs uppercase tracking-widest text-[#a39e98]" />
                          {forecasts.map((f) => (
                            <th
                              key={f.label}
                              className="pb-2 text-right font-mono text-xs uppercase tracking-widest text-[#a39e98]"
                            >
                              {f.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#f5f3ee] dark:divide-[#3d3a36]">
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
                        <tr className="border-t-2 border-[#e5e3de] dark:border-[#3d3a36]">
                          <td className="py-2 text-sm font-medium text-[#2d2a26] dark:text-[#f5f3ee]">
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
      <td className="py-2 text-sm text-[#4d4944] dark:text-[#a39e98]">
        {label}
      </td>
      <td className="py-2 text-right font-mono text-sm tabular-nums text-[#2d2a26] dark:text-[#f5f3ee]">
        {formatted}
      </td>
      <td className="py-2 text-right font-mono text-sm tabular-nums text-[#6b6560] dark:text-[#a39e98]">
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
      <td className="py-2 text-sm text-[#4d4944] dark:text-[#a39e98]">
        {label}
      </td>
      {values.map((v, i) => (
        <td
          key={i}
          className={`py-2 text-right font-mono text-sm tabular-nums ${
            isCost
              ? "text-rose-600 dark:text-rose-400"
              : "text-[#2d2a26] dark:text-[#f5f3ee]"
          }`}
        >
          {v}
        </td>
      ))}
    </tr>
  );
}
