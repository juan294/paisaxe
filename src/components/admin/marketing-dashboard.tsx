"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
  Calendar,
  Send,
  BarChart3,
  Settings,
  ExternalLink,
  Zap,
} from "lucide-react";
import type {
  MarketingDashboardSummary,
  MarketingAccountPublic,
  MarketingPost,
  MarketingSchedule,
  MarketingPlatform,
} from "@/types/marketing";

// Platform icons (using text for now, can be replaced with proper icons)
const PLATFORM_ICONS: Record<MarketingPlatform, string> = {
  x: "𝕏",
  instagram: "📷",
  pinterest: "📌",
  tiktok: "🎵",
};

const PLATFORM_NAMES: Record<MarketingPlatform, string> = {
  x: "X (Twitter)",
  instagram: "Instagram",
  pinterest: "Pinterest",
  tiktok: "TikTok",
};

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function MarketingDashboard() {
  const [data, setData] = useState<MarketingDashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/marketing/dashboard");
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to fetch marketing data");
      }

      setData(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (isLoading && !data) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center rounded-3xl bg-white dark:bg-[#252320]">
        <RefreshCw className="h-6 w-6 animate-spin text-[#a39e98]" />
        <p className="mt-4 text-sm text-[#6b6560] dark:text-[#a39e98]">
          Loading marketing data...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center rounded-3xl bg-white dark:bg-[#252320]">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#c9a55c]/10 dark:bg-[#c9a55c]/20">
          <AlertCircle className="h-8 w-8 text-[#c9a55c]" />
        </div>
        <p className="mt-4 text-sm font-medium text-[#8b6c2e] dark:text-[#d4b876]">
          {error}
        </p>
        <button
          onClick={loadData}
          className="mt-4 flex items-center gap-2 rounded-xl bg-[#2d2a26] px-4 py-2 text-sm font-medium text-[#f5f3ee] transition-colors hover:bg-[#3d3a36] dark:bg-[#f5f3ee] dark:text-[#2d2a26] dark:hover:bg-[#e5e3de]"
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-[#2d2a26] dark:text-[#f5f3ee]">
            Marketing Automation
          </h1>
          <p className="mt-1 text-[#6b6560] dark:text-[#a39e98]">
            Manage social media accounts and scheduled posts
          </p>
        </div>
        <button
          onClick={loadData}
          disabled={isLoading}
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-xl transition-colors",
            "text-[#6b6560] hover:bg-white hover:text-[#2d2a26]",
            "dark:text-[#a39e98] dark:hover:bg-[#252320] dark:hover:text-[#f5f3ee]",
            "disabled:opacity-50"
          )}
        >
          <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
        </button>
      </div>

      {/* Connected Accounts */}
      <section>
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-[#2d2a26] dark:text-[#f5f3ee]">
          <Zap className="h-5 w-5 text-[#c9a55c]" />
          Connected Accounts
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(["x", "instagram", "pinterest", "tiktok"] as MarketingPlatform[]).map(
            (platform) => {
              const account = data.accounts.find((a) => a.platform === platform);
              return (
                <AccountCard key={platform} platform={platform} account={account} />
              );
            }
          )}
        </div>
      </section>

      {/* Stats Overview */}
      <section>
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-[#2d2a26] dark:text-[#f5f3ee]">
          <BarChart3 className="h-5 w-5 text-[#7a9e7a]" />
          Performance Overview
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={<Send className="h-5 w-5" />}
            value={data.stats.totalPosts}
            label="Total Posts"
            variant="default"
          />
          <StatCard
            icon={<Calendar className="h-5 w-5" />}
            value={data.stats.postsThisWeek}
            label="This Week"
            variant="default"
          />
          <StatCard
            icon={<Clock className="h-5 w-5" />}
            value={data.upcomingPosts.length}
            label="Scheduled"
            variant="warning"
          />
          <StatCard
            icon={<XCircle className="h-5 w-5" />}
            value={data.stats.failedPosts}
            label="Failed"
            variant={data.stats.failedPosts > 0 ? "error" : "default"}
          />
        </div>
      </section>

      {/* Two-column layout for posts and schedule */}
      <div className="grid gap-8 lg:grid-cols-2">
        {/* Upcoming Posts */}
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-[#2d2a26] dark:text-[#f5f3ee]">
            <Clock className="h-5 w-5 text-[#c9a55c]" />
            Upcoming Posts
          </h2>
          <div className="rounded-2xl bg-white p-4 dark:bg-[#252320]">
            {data.upcomingPosts.length === 0 ? (
              <p className="py-8 text-center text-sm text-[#a39e98]">
                No scheduled posts
              </p>
            ) : (
              <div className="space-y-3">
                {data.upcomingPosts.slice(0, 5).map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Recent Posts */}
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-[#2d2a26] dark:text-[#f5f3ee]">
            <CheckCircle2 className="h-5 w-5 text-[#7a9e7a]" />
            Recent Posts
          </h2>
          <div className="rounded-2xl bg-white p-4 dark:bg-[#252320]">
            {data.recentPosts.length === 0 ? (
              <p className="py-8 text-center text-sm text-[#a39e98]">
                No posts yet
              </p>
            ) : (
              <div className="space-y-3">
                {data.recentPosts.slice(0, 5).map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Posting Schedule */}
      <section>
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-[#2d2a26] dark:text-[#f5f3ee]">
          <Settings className="h-5 w-5 text-[#6b6560] dark:text-[#a39e98]" />
          Posting Schedule
        </h2>
        <div className="rounded-2xl bg-white p-6 dark:bg-[#252320]">
          {data.schedules.length === 0 ? (
            <p className="py-8 text-center text-sm text-[#a39e98]">
              No schedules configured
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {(["x", "instagram", "pinterest", "tiktok"] as MarketingPlatform[]).map(
                (platform) => {
                  const platformSchedules = data.schedules.filter(
                    (s) => s.platform === platform && s.isActive
                  );
                  return (
                    <ScheduleCard
                      key={platform}
                      platform={platform}
                      schedules={platformSchedules}
                    />
                  );
                }
              )}
            </div>
          )}
        </div>
      </section>

      {/* Setup Instructions */}
      {data.accounts.length === 0 && (
        <section className="rounded-2xl border-2 border-dashed border-[#e5e3de] bg-white/50 p-8 text-center dark:border-[#3d3a36] dark:bg-[#252320]/50">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#f5f3ee] dark:bg-[#2d2a26]">
            <Zap className="h-8 w-8 text-[#c9a55c]" />
          </div>
          <h3 className="text-lg font-semibold text-[#2d2a26] dark:text-[#f5f3ee]">
            Get Started with Marketing Automation
          </h3>
          <p className="mt-2 text-sm text-[#6b6560] dark:text-[#a39e98]">
            Connect your social media accounts to enable automated posting.
          </p>
          <p className="mt-4 text-xs text-[#a39e98]">
            See the marketing setup documentation for instructions on connecting
            each platform.
          </p>
        </section>
      )}
    </div>
  );
}

// Account Card Component
function AccountCard({
  platform,
  account,
}: {
  platform: MarketingPlatform;
  account: MarketingAccountPublic | undefined;
}) {
  const isConnected = account?.isActive;

  return (
    <div
      className={cn(
        "rounded-2xl p-4 transition-all",
        isConnected
          ? "bg-white dark:bg-[#252320]"
          : "border-2 border-dashed border-[#e5e3de] bg-white/50 dark:border-[#3d3a36] dark:bg-[#252320]/50"
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-xl text-lg",
            isConnected
              ? "bg-[#2d2a26] text-[#f5f3ee] dark:bg-[#f5f3ee] dark:text-[#2d2a26]"
              : "bg-[#f5f3ee] text-[#a39e98] dark:bg-[#2d2a26]"
          )}
        >
          {PLATFORM_ICONS[platform]}
        </div>
        <div className="flex-1">
          <p className="font-medium text-[#2d2a26] dark:text-[#f5f3ee]">
            {PLATFORM_NAMES[platform]}
          </p>
          {isConnected && account?.accountHandle ? (
            <p className="text-sm text-[#6b6560] dark:text-[#a39e98]">
              {account.accountHandle}
            </p>
          ) : (
            <p className="text-sm text-[#a39e98]">Not connected</p>
          )}
        </div>
        {isConnected ? (
          <CheckCircle2 className="h-5 w-5 text-[#7a9e7a]" />
        ) : (
          <div className="h-5 w-5 rounded-full border-2 border-[#e5e3de] dark:border-[#3d3a36]" />
        )}
      </div>
    </div>
  );
}

// Post Card Component
function PostCard({ post }: { post: MarketingPost }) {
  const statusColors = {
    draft: "text-[#a39e98]",
    scheduled: "text-[#c9a55c]",
    posting: "text-[#6b9bd2]",
    posted: "text-[#7a9e7a]",
    failed: "text-[#c95c5c]",
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  return (
    <div className="flex items-start gap-3 rounded-xl bg-[#f5f3ee]/50 p-3 dark:bg-[#2d2a26]/50">
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-white text-sm dark:bg-[#252320]">
        {PLATFORM_ICONS[post.platform]}
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm text-[#2d2a26] dark:text-[#f5f3ee]">
          {post.content}
        </p>
        <div className="mt-1 flex items-center gap-2 text-xs">
          <span className={statusColors[post.status]}>{post.status}</span>
          {post.scheduledFor && post.status === "scheduled" && (
            <span className="text-[#a39e98]">
              {formatDate(post.scheduledFor)}
            </span>
          )}
          {post.postedAt && post.status === "posted" && (
            <span className="text-[#a39e98]">{formatDate(post.postedAt)}</span>
          )}
        </div>
      </div>
      {post.postUrl && (
        <a
          href={post.postUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0 text-[#6b6560] hover:text-[#2d2a26] dark:text-[#a39e98] dark:hover:text-[#f5f3ee]"
        >
          <ExternalLink className="h-4 w-4" />
        </a>
      )}
    </div>
  );
}

// Schedule Card Component
function ScheduleCard({
  platform,
  schedules,
}: {
  platform: MarketingPlatform;
  schedules: MarketingSchedule[];
}) {
  if (schedules.length === 0) {
    return (
      <div className="rounded-xl bg-[#f5f3ee]/50 p-4 dark:bg-[#2d2a26]/50">
        <div className="mb-2 flex items-center gap-2">
          <span className="text-sm">{PLATFORM_ICONS[platform]}</span>
          <span className="text-sm font-medium text-[#6b6560] dark:text-[#a39e98]">
            {PLATFORM_NAMES[platform]}
          </span>
        </div>
        <p className="text-xs text-[#a39e98]">No schedule set</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-[#f5f3ee]/50 p-4 dark:bg-[#2d2a26]/50">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-sm">{PLATFORM_ICONS[platform]}</span>
        <span className="text-sm font-medium text-[#2d2a26] dark:text-[#f5f3ee]">
          {PLATFORM_NAMES[platform]}
        </span>
      </div>
      <div className="space-y-1">
        {schedules.map((schedule) => (
          <div
            key={schedule.id}
            className="flex items-center justify-between text-xs"
          >
            <span className="text-[#6b6560] dark:text-[#a39e98]">
              {schedule.dayOfWeek !== null
                ? DAY_NAMES[schedule.dayOfWeek]
                : "Daily"}
            </span>
            <span className="font-mono text-[#2d2a26] dark:text-[#f5f3ee]">
              {schedule.timeUtc} UTC
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Stat Card Component
function StatCard({
  icon,
  value,
  label,
  variant,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  variant: "default" | "warning" | "error";
}) {
  const variants = {
    default: {
      bg: "bg-white dark:bg-[#252320]",
      icon: "text-[#6b6560] dark:text-[#a39e98]",
      text: "text-[#2d2a26] dark:text-[#f5f3ee]",
      subtext: "text-[#6b6560] dark:text-[#a39e98]",
    },
    warning: {
      bg: "bg-white dark:bg-[#252320]",
      icon: "text-[#c9a55c]",
      text: "text-[#2d2a26] dark:text-[#f5f3ee]",
      subtext: "text-[#6b6560] dark:text-[#a39e98]",
    },
    error: {
      bg: "bg-[#c95c5c]/10 dark:bg-[#c95c5c]/20",
      icon: "text-[#c95c5c]",
      text: "text-[#c95c5c]",
      subtext: "text-[#c95c5c]/70",
    },
  };

  const v = variants[variant];

  return (
    <div className={cn("rounded-2xl p-5", v.bg)}>
      <div className={cn("mb-3", v.icon)}>{icon}</div>
      <p className={cn("text-3xl font-semibold tabular-nums", v.text)}>
        {value}
      </p>
      <p className={cn("mt-1 text-sm", v.subtext)}>{label}</p>
    </div>
  );
}
