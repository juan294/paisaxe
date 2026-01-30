"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchElevenLabsAnalytics } from "@/lib/admin-api";
import { RefreshCw, AlertCircle, Mic, Clock, MessageSquare, Star } from "lucide-react";
import type {
  ElevenLabsAnalyticsDashboardData,
  ElevenLabsAgentBreakdown,
  ElevenLabsLanguageBreakdown,
  ElevenLabsStatusBreakdown,
  ElevenLabsConversation,
} from "@/types/elevenlabs-analytics";

export function ElevenLabsAnalyticsPanel() {
  const [data, setData] = useState<ElevenLabsAnalyticsDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    to: new Date().toISOString().split("T")[0],
  });

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError("");

    const fromISO = new Date(dateRange.from).toISOString();
    const toISO = new Date(dateRange.to + "T23:59:59").toISOString();

    const result = await fetchElevenLabsAnalytics(fromISO, toISO);
    if (result.error) {
      setError(result.error);
    } else if (result.data) {
      setData(result.data);
    }
    setIsLoading(false);
  }, [dateRange]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="space-y-12">
      {/* Header */}
      <header className="border-b border-stone-200 pb-6 dark:border-stone-800">
        <div className="flex items-end justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-stone-400">
              Voice Agents
            </p>
            <h2 className="mt-2 text-2xl font-extralight tracking-tight text-stone-900 dark:text-stone-100">
              ElevenLabs Analytics
            </h2>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 font-mono text-xs text-stone-400">
              <input
                type="date"
                value={dateRange.from}
                onChange={(e) => setDateRange((prev) => ({ ...prev, from: e.target.value }))}
                className="bg-transparent outline-none"
              />
              <span>—</span>
              <input
                type="date"
                value={dateRange.to}
                onChange={(e) => setDateRange((prev) => ({ ...prev, to: e.target.value }))}
                className="bg-transparent outline-none"
              />
            </div>
            <button
              onClick={loadData}
              disabled={isLoading}
              className="font-mono text-xs uppercase tracking-widest text-stone-400 transition-colors hover:text-stone-900 disabled:opacity-50 dark:hover:text-stone-100"
            >
              {isLoading ? "Loading..." : "Refresh"}
            </button>
          </div>
        </div>
      </header>

      {/* Active Calls Widget */}
      {data && (
        <div className={`inline-flex items-center gap-3 rounded-full px-4 py-2 ${
          data.activeCalls > 0
            ? "bg-emerald-50 dark:bg-emerald-900/20"
            : "bg-stone-100 dark:bg-stone-800"
        }`}>
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              data.activeCalls > 0 ? "animate-pulse bg-emerald-500" : "bg-stone-400"
            }`}
          />
          <span className={`font-mono text-sm font-medium ${
            data.activeCalls > 0
              ? "text-emerald-700 dark:text-emerald-400"
              : "text-stone-500 dark:text-stone-400"
          }`}>
            Active calls: {data.activeCalls}
          </span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-3 font-mono text-xs text-red-600">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {isLoading && !data ? (
        <div className="flex min-h-[200px] items-center justify-center">
          <RefreshCw className="h-5 w-5 animate-spin text-stone-300" />
        </div>
      ) : data && isEmptyData(data) ? (
        <div className="flex min-h-[200px] flex-col items-center justify-center gap-4">
          <Mic className="h-8 w-8 text-stone-200" />
          <p className="text-xl font-extralight text-stone-300">No conversations yet</p>
          <p className="font-mono text-xs uppercase tracking-widest text-stone-400">
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

function formatLanguage(lang: string): string {
  const languageNames: Record<string, string> = {
    en: "English",
    es: "Spanish",
    de: "German",
    fr: "French",
    pt: "Portuguese",
    it: "Italian",
    Unknown: "Unknown",
  };
  return languageNames[lang] || lang;
}

function formatStatus(status: string): string {
  const statusNames: Record<string, string> = {
    done: "Completed",
    failed: "Failed",
    "in-progress": "In Progress",
    initiated: "Initiated",
    processing: "Processing",
  };
  return statusNames[status] || status;
}

function formatTime(unix: number | undefined): string {
  if (!unix) return "—";
  const date = new Date(unix * 1000);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface StatCardProps {
  value: number | string;
  label: string;
  suffix?: string;
  icon: React.ReactNode;
  color?: "blue" | "emerald" | "amber" | "rose" | "violet" | "yellow" | "stone";
}

const statColorClasses: Record<string, { value: string; icon: string }> = {
  blue: {
    value: "text-blue-600 dark:text-blue-400",
    icon: "text-blue-500 dark:text-blue-400",
  },
  emerald: {
    value: "text-emerald-600 dark:text-emerald-400",
    icon: "text-emerald-500 dark:text-emerald-400",
  },
  amber: {
    value: "text-amber-600 dark:text-amber-400",
    icon: "text-amber-500 dark:text-amber-400",
  },
  rose: {
    value: "text-rose-600 dark:text-rose-400",
    icon: "text-rose-500 dark:text-rose-400",
  },
  violet: {
    value: "text-violet-600 dark:text-violet-400",
    icon: "text-violet-500 dark:text-violet-400",
  },
  yellow: {
    value: "text-yellow-600 dark:text-yellow-400",
    icon: "text-yellow-500 dark:text-yellow-400",
  },
  stone: {
    value: "text-stone-500 dark:text-stone-400",
    icon: "text-stone-400",
  },
};

function StatCard({ value, label, suffix, icon, color = "stone" }: StatCardProps) {
  const colors = statColorClasses[color] || statColorClasses.stone;
  return (
    <div className="space-y-2">
      <div className={`flex items-center gap-2 ${colors.icon}`}>
        {icon}
        <span className="font-mono text-xs uppercase tracking-widest text-stone-400">{label}</span>
      </div>
      <p className={`text-3xl font-extralight tabular-nums tracking-tight ${colors.value}`}>
        {typeof value === "number" ? value.toLocaleString() : value}
        {suffix && <span className="ml-1 text-lg text-stone-400">{suffix}</span>}
      </p>
    </div>
  );
}

interface BreakdownTableProps<T> {
  number: string;
  title: string;
  items: T[];
  renderItem: (item: T) => string;
  getCount: (item: T) => number;
  getSecondary?: (item: T) => string;
}

function BreakdownTable<T>({
  number,
  title,
  items,
  renderItem,
  getCount,
  getSecondary,
}: BreakdownTableProps<T>) {
  if (items.length === 0) {
    return (
      <section>
        <h3 className="mb-4 font-mono text-xs uppercase tracking-widest text-stone-400">
          {number} — {title}
        </h3>
        <p className="py-6 text-center font-mono text-xs text-stone-300">No data available</p>
      </section>
    );
  }

  return (
    <section>
      <h3 className="mb-4 font-mono text-xs uppercase tracking-widest text-stone-400">
        {number} — {title}
      </h3>
      <table className="w-full">
        <thead>
          <tr className="border-b border-stone-200 text-left dark:border-stone-800">
            <th className="pb-2 font-mono text-xs uppercase tracking-widest text-stone-400">#</th>
            <th className="pb-2 font-mono text-xs uppercase tracking-widest text-stone-400">Name</th>
            {getSecondary && (
              <th className="pb-2 text-right font-mono text-xs uppercase tracking-widest text-stone-400">
                Time
              </th>
            )}
            <th className="pb-2 text-right font-mono text-xs uppercase tracking-widest text-stone-400">
              Count
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
          {items.map((item, idx) => (
            <tr key={idx}>
              <td className="py-2 font-mono text-sm tabular-nums text-stone-400">
                {String(idx + 1).padStart(2, "0")}
              </td>
              <td className="py-2 text-sm capitalize text-stone-700 dark:text-stone-300">
                {renderItem(item)}
              </td>
              {getSecondary && (
                <td className="py-2 text-right font-mono text-xs tabular-nums text-violet-500 dark:text-violet-400">
                  {getSecondary(item)}
                </td>
              )}
              <td className="py-2 text-right font-mono text-sm font-medium tabular-nums text-sky-600 dark:text-sky-400">
                {getCount(item).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

interface RecentConversationsTableProps {
  number: string;
  conversations: ElevenLabsConversation[];
}

function RecentConversationsTable({ number, conversations }: RecentConversationsTableProps) {
  if (conversations.length === 0) {
    return (
      <section>
        <h3 className="mb-4 font-mono text-xs uppercase tracking-widest text-stone-400">
          {number} — Recent Conversations
        </h3>
        <p className="py-6 text-center font-mono text-xs text-stone-300">No conversations yet</p>
      </section>
    );
  }

  return (
    <section>
      <h3 className="mb-4 font-mono text-xs uppercase tracking-widest text-stone-400">
        {number} — Recent Conversations
      </h3>
      <table className="w-full">
        <thead>
          <tr className="border-b border-stone-200 text-left dark:border-stone-800">
            <th className="pb-2 font-mono text-xs uppercase tracking-widest text-stone-400">Time</th>
            <th className="pb-2 font-mono text-xs uppercase tracking-widest text-stone-400">Status</th>
            <th className="pb-2 text-right font-mono text-xs uppercase tracking-widest text-stone-400">
              Duration
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
          {conversations.map((conv) => (
            <tr key={conv.conversation_id}>
              <td className="py-2 font-mono text-xs tabular-nums text-stone-500">
                {formatTime(conv.start_time_unix)}
              </td>
              <td className="py-2">
                <span
                  className={`inline-block rounded-full px-2 py-0.5 font-mono text-xs font-medium ${
                    conv.status === "done"
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                      : conv.status === "failed"
                      ? "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
                      : "bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400"
                  }`}
                >
                  {formatStatus(conv.status)}
                </span>
              </td>
              <td className="py-2 text-right font-mono text-sm font-medium tabular-nums text-amber-600 dark:text-amber-400">
                {conv.call_duration_secs ? `${conv.call_duration_secs}s` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
