"use client";

import { useState, useCallback } from "react";
import { fetchElevenLabsAnalytics } from "@/lib/admin-api";
import { useAnalyticsData } from "./analytics-cache-context";
import { AlertCircle, Mic, Clock, MessageSquare, Star } from "lucide-react";
import type {
  ElevenLabsAnalyticsDashboardData,
  ElevenLabsAgentBreakdown,
  ElevenLabsLanguageBreakdown,
  ElevenLabsStatusBreakdown,
} from "@/types/elevenlabs-analytics";

import { formatLanguage, formatStatus } from "./elevenlabs-analytics-panel/formatters";
import { StatCard } from "./elevenlabs-analytics-panel/stat-card";
import { BreakdownTable, RecentConversationsTable } from "./elevenlabs-analytics-panel/tables";
import { SkeletonVoiceDashboard } from "./elevenlabs-analytics-panel/skeletons";

export function ElevenLabsAnalyticsPanel() {
  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().replace(/T.*$/, ""),
    to: new Date().toISOString().replace(/T.*$/, ""),
  });

  const fromISO = new Date(dateRange.from).toISOString();
  const toISO = new Date(dateRange.to + "T23:59:59").toISOString();

  const params = JSON.stringify({ from: dateRange.from, to: dateRange.to });
  const { data, isLoading, isRefreshing, error, refresh } = useAnalyticsData(
    "voice",
    useCallback(() => fetchElevenLabsAnalytics(fromISO, toISO), [fromISO, toISO]),
    params
  );

  return (
    <div className="space-y-12">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-admin-ink dark:text-admin-paper">
          Voice Analytics
        </h2>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 font-mono text-xs text-admin-muted dark:text-admin-subtle">
            <input
              type="date"
              value={dateRange.from}
              onChange={(e) => setDateRange((prev) => ({ ...prev, from: e.target.value }))}
              className="bg-transparent outline-none rounded focus-visible:ring-1 focus-visible:ring-white/40"
            />
            <span>—</span>
            <input
              type="date"
              value={dateRange.to}
              onChange={(e) => setDateRange((prev) => ({ ...prev, to: e.target.value }))}
              className="bg-transparent outline-none rounded focus-visible:ring-1 focus-visible:ring-white/40"
            />
          </div>
          <button
            onClick={refresh}
            disabled={isLoading}
            className="font-mono text-xs uppercase tracking-widest text-admin-muted transition-colors hover:text-admin-ink disabled:opacity-50 dark:text-admin-subtle dark:hover:text-admin-paper"
          >
            {isLoading ? "Loading..." : isRefreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* Active Calls Widget */}
      {data && (
        <div className={`inline-flex items-center gap-3 rounded-full px-4 py-2 ${
          data.activeCalls > 0
            ? "bg-emerald-50 dark:bg-emerald-900/20"
            : "bg-admin-paper dark:bg-admin-depth"
        }`}>
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              data.activeCalls > 0 ? "animate-pulse bg-emerald-500" : "bg-admin-subtle"
            }`}
          />
          <span className={`font-mono text-sm font-medium ${
            data.activeCalls > 0
              ? "text-emerald-700 dark:text-emerald-400"
              : "text-admin-muted dark:text-admin-subtle"
          }`}>
            Active calls: {data.activeCalls}
          </span>
        </div>
      )}

      {isRefreshing && (
        <div className="h-0.5 w-full animate-pulse rounded-full bg-blue-500/30" />
      )}

      {error && (
        <div className="flex items-center gap-3 font-mono text-xs text-red-600">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {isLoading ? (
        <SkeletonVoiceDashboard />
      ) : data && isEmptyData(data) ? (
        <div className="flex min-h-[200px] flex-col items-center justify-center gap-4">
          <Mic className="h-8 w-8 text-admin-line" />
          <p className="text-xl font-extralight text-admin-subtle">No conversations yet</p>
          <p className="font-mono text-xs uppercase tracking-widest text-admin-subtle">
            Voice agent data will appear here once conversations begin
          </p>
        </div>
      ) : data ? (
        <>
          {/* Summary Stats */}
          <section className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-6">
            <StatCard
              value={data.summary.totalConversations}
              label="Total Conversations"
              icon={<MessageSquare className="h-4 w-4" />}
              color="blue"
            />
            <StatCard
              value={data.summary.completedConversations}
              label="Completed"
              icon={<Mic className="h-4 w-4" />}
              color="emerald"
            />
            <StatCard
              value={data.summary.failedConversations}
              label="Failed"
              icon={<AlertCircle className="h-4 w-4" />}
              color={data.summary.failedConversations > 0 ? "rose" : "stone"}
            />
            <StatCard
              value={data.summary.totalMinutesUsed}
              label="Minutes Used"
              suffix="min"
              icon={<Clock className="h-4 w-4" />}
              color="violet"
            />
            <StatCard
              value={data.summary.averageCallDuration}
              label="Avg Duration"
              suffix="sec"
              icon={<Clock className="h-4 w-4" />}
              color="amber"
            />
            <StatCard
              value={data.summary.averageRating ?? "—"}
              label="Avg Rating"
              suffix={data.summary.averageRating ? "/5" : ""}
              icon={<Star className="h-4 w-4" />}
              color="yellow"
            />
          </section>

          {/* Breakdown Tables */}
          <div className="grid gap-12 lg:grid-cols-2">
            <BreakdownTable
              number="01"
              title="By Agent"
              items={data.conversationsByAgent}
              renderItem={(item: ElevenLabsAgentBreakdown) => item.agentName}
              getCount={(item: ElevenLabsAgentBreakdown) => item.conversationCount}
              getSecondary={(item: ElevenLabsAgentBreakdown) => `${item.totalMinutes} min`}
            />
            <BreakdownTable
              number="02"
              title="By Language"
              items={data.conversationsByLanguage}
              renderItem={(item: ElevenLabsLanguageBreakdown) => formatLanguage(item.language)}
              getCount={(item: ElevenLabsLanguageBreakdown) => item.count}
            />
            <BreakdownTable
              number="03"
              title="By Status"
              items={data.conversationsByStatus}
              renderItem={(item: ElevenLabsStatusBreakdown) => formatStatus(item.status)}
              getCount={(item: ElevenLabsStatusBreakdown) => item.count}
            />
            <RecentConversationsTable
              number="04"
              conversations={data.recentConversations}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}

function isEmptyData(data: ElevenLabsAnalyticsDashboardData): boolean {
  return (
    data.summary.totalConversations === 0 &&
    data.conversationsByAgent.length === 0 &&
    data.recentConversations.length === 0
  );
}
