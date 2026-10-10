"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, AlertCircle } from "lucide-react";
import dynamic from "next/dynamic";
const VoiceAgentChat = dynamic(
  () => import("../voice-agent-chat").then(m => ({ default: m.VoiceAgentChat })),
  { ssr: false }
);
import { ELEVENLABS_AGENT_IDS } from "@/config/elevenlabs-agents";
import { csrfHeaders } from "@/lib/csrf-client";
import { clientLogger } from "@/lib/client-logger";
import type {
  MarketingDashboardSummary,
  MarketingPlatform,
} from "@/types/marketing";
import { PLATFORM_BADGES, PLATFORM_NAMES, DAY_NAMES } from "./constants";
import { AccountCard } from "./account-card";
import { AccountConfigDialog } from "./account-config-dialog";
import { PostRow } from "./post-row";
import { StatCard } from "./stat-card";
import { DraftsPanel } from "./drafts-panel";

export function MarketingDashboard() {
  const [data, setData] = useState<MarketingDashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [configuringPlatform, setConfiguringPlatform] = useState<MarketingPlatform | null>(null);

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

  const handleAccountSaved = () => {
    setConfiguringPlatform(null);
    loadData();
  };

  const handleToggleAccount = async (platform: MarketingPlatform, currentlyActive: boolean, hasCredentials: boolean) => {
    try {
      if (currentlyActive) {
        // Pause the account (keep credentials)
        const response = await fetch(`/api/admin/marketing/accounts?platform=${platform}&action=pause`, {
          method: "PATCH",
          headers: csrfHeaders(),
        });
        if (!response.ok) {
          const result = await response.json();
          throw new Error(result.error || "Failed to pause account");
        }
      } else if (hasCredentials) {
        // Resume the account (credentials still exist)
        const response = await fetch(`/api/admin/marketing/accounts?platform=${platform}&action=resume`, {
          method: "PATCH",
          headers: csrfHeaders(),
        });
        if (!response.ok) {
          const result = await response.json();
          throw new Error(result.error || "Failed to resume account");
        }
      } else {
        // No credentials - need to configure
        setConfiguringPlatform(platform);
        return;
      }
      loadData();
    } catch (err) {
      clientLogger.error("Toggle account error", { error: err instanceof Error ? err.message : String(err) });
    }
  };

  const handleDisconnectAccount = async (platform: MarketingPlatform) => {
    if (!confirm(`Disconnect ${PLATFORM_NAMES[platform]}? This will clear all stored credentials.`)) {
      return;
    }
    try {
      const response = await fetch(`/api/admin/marketing/accounts?platform=${platform}`, {
        method: "DELETE",
        headers: csrfHeaders(),
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Failed to disconnect account");
      }
      loadData();
    } catch (err) {
      clientLogger.error("Disconnect account error", { error: err instanceof Error ? err.message : String(err) });
    }
  };

  if (isLoading && !data) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <RefreshCw className="h-5 w-5 animate-spin text-admin-subtle" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-4">
        <AlertCircle className="h-6 w-6 text-red-500" />
        <p className="font-mono text-xs text-red-600">{error}</p>
        <button
          onClick={loadData}
          className="font-mono text-xs uppercase tracking-widest text-admin-subtle transition-colors hover:text-admin-ink dark:hover:text-admin-paper"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-16">
      {/* Header */}
      <header className="flex items-end justify-between border-b border-admin-line pb-6 dark:border-admin-depth">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-admin-subtle">Admin / Marketing</p>
          <h2 className="mt-2 text-4xl font-extralight tracking-tight text-admin-ink dark:text-admin-paper">
            Marketing Automation
          </h2>
        </div>
        <button
          onClick={loadData}
          disabled={isLoading}
          className="font-mono text-xs uppercase tracking-widest text-admin-subtle transition-colors hover:text-admin-ink disabled:opacity-50 dark:hover:text-admin-paper"
        >
          {isLoading ? "Loading..." : "Refresh"}
        </button>
      </header>

      {/* Connected Accounts */}
      <section>
        <h2 className="mb-6 font-mono text-xs uppercase tracking-widest text-admin-subtle">
          01 — Connected Accounts
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {(["x", "instagram", "pinterest"] as MarketingPlatform[]).map(
            (platform) => {
              const account = data.accounts.find((a) => a.platform === platform);
              return (
                <AccountCard
                  key={platform}
                  platform={platform}
                  account={account}
                  onConfigure={() => setConfiguringPlatform(platform)}
                  onToggle={() => handleToggleAccount(platform, account?.isActive ?? false, account?.hasCredentials ?? false)}
                  onDisconnect={() => handleDisconnectAccount(platform)}
                />
              );
            }
          )}
        </div>
      </section>

      {/* Stats Overview */}
      <section>
        <h2 className="mb-6 font-mono text-xs uppercase tracking-widest text-admin-subtle">
          02 — Performance Overview
        </h2>
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard number="01" value={data.stats.totalPosts} label="Total Posts" color="blue" />
          <StatCard number="02" value={data.stats.postsThisWeek} label="This Week" color="emerald" />
          <StatCard number="03" value={data.upcomingPosts.length} label="Scheduled" color="amber" />
          <StatCard number="04" value={data.stats.failedPosts} label="Failed" color="rose" isError={data.stats.failedPosts > 0} />
        </div>
      </section>

      {/* Two-column layout for posts */}
      <div className="grid gap-16 lg:grid-cols-2">
        {/* Upcoming Posts */}
        <section>
          <h2 className="mb-6 font-mono text-xs uppercase tracking-widest text-admin-subtle">
            03 — Upcoming Posts
          </h2>
          {data.upcomingPosts.length === 0 ? (
            <p className="py-8 text-center font-mono text-xs text-admin-subtle">
              No scheduled posts
            </p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-admin-line text-left dark:border-admin-depth">
                  <th className="pb-3 font-mono text-xs uppercase tracking-widest text-admin-subtle">#</th>
                  <th className="pb-3 font-mono text-xs uppercase tracking-widest text-admin-subtle">Platform</th>
                  <th className="pb-3 font-mono text-xs uppercase tracking-widest text-admin-subtle">Content</th>
                  <th className="pb-3 text-right font-mono text-xs uppercase tracking-widest text-admin-subtle">Scheduled</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-admin-paper dark:divide-admin-depth">
                {data.upcomingPosts.slice(0, 5).map((post, idx) => (
                  <PostRow key={post.id} post={post} index={idx} />
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Recent Posts */}
        <section>
          <h2 className="mb-6 font-mono text-xs uppercase tracking-widest text-admin-subtle">
            04 — Recent Posts
          </h2>
          {data.recentPosts.length === 0 ? (
            <p className="py-8 text-center font-mono text-xs text-admin-subtle">
              No posts yet
            </p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-admin-line text-left dark:border-admin-depth">
                  <th className="pb-3 font-mono text-xs uppercase tracking-widest text-admin-subtle">#</th>
                  <th className="pb-3 font-mono text-xs uppercase tracking-widest text-admin-subtle">Platform</th>
                  <th className="pb-3 font-mono text-xs uppercase tracking-widest text-admin-subtle">Content</th>
                  <th className="pb-3 text-right font-mono text-xs uppercase tracking-widest text-admin-subtle">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-admin-paper dark:divide-admin-depth">
                {data.recentPosts.slice(0, 5).map((post, idx) => (
                  <PostRow key={post.id} post={post} index={idx} />
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      {/* Posting Schedule */}
      <section>
        <h2 className="mb-6 font-mono text-xs uppercase tracking-widest text-admin-subtle">
          05 — Posting Schedule
        </h2>
        {data.schedules.length === 0 ? (
          <p className="py-8 text-center font-mono text-xs text-admin-subtle">
            No schedules configured
          </p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-admin-line text-left dark:border-admin-depth">
                <th className="pb-3 font-mono text-xs uppercase tracking-widest text-admin-subtle">Platform</th>
                <th className="pb-3 font-mono text-xs uppercase tracking-widest text-admin-subtle">Day</th>
                <th className="pb-3 text-right font-mono text-xs uppercase tracking-widest text-admin-subtle">Time (UTC)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-admin-paper dark:divide-admin-depth">
              {data.schedules
                .filter((s) => s.isActive)
                .map((schedule) => (
                  <tr key={schedule.id}>
                    <td className="py-3">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded border border-admin-line font-mono text-[10px] font-medium text-admin-muted dark:border-admin-secondary dark:text-admin-subtle">
                        {PLATFORM_BADGES[schedule.platform]}
                      </span>
                    </td>
                    <td className="py-3 text-sm text-admin-secondary dark:text-admin-subtle">
                      {schedule.dayOfWeek !== null ? DAY_NAMES[schedule.dayOfWeek] : "Daily"}
                    </td>
                    <td className="py-3 text-right font-mono text-sm tabular-nums text-admin-ink dark:text-admin-paper">
                      {schedule.timeUtc}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Marketing Agents Chat */}
      <section>
        <h2 className="mb-6 font-mono text-xs uppercase tracking-widest text-admin-subtle">
          06 — Marketing Agents
        </h2>
        <VoiceAgentChat agentIds={ELEVENLABS_AGENT_IDS} />
      </section>

      {/* Content Drafts */}
      <section>
        <h2 className="mb-6 font-mono text-xs uppercase tracking-widest text-admin-subtle">
          07 — Content Drafts
        </h2>
        <DraftsPanel onDraftPosted={loadData} />
      </section>

      {/* Setup Instructions */}
      {data.accounts.length === 0 && (
        <section className="border-t border-admin-line pt-8 text-center dark:border-admin-depth">
          <p className="text-lg font-extralight text-admin-subtle">
            No accounts connected
          </p>
          <p className="mt-2 font-mono text-xs uppercase tracking-widest text-admin-subtle">
            Click on any platform above to connect your social media accounts
          </p>
        </section>
      )}

      {/* Account Configuration Dialog */}
      <AccountConfigDialog
        platform={configuringPlatform}
        existingAccount={data.accounts.find((a) => a.platform === configuringPlatform)}
        onClose={() => setConfiguringPlatform(null)}
        onSaved={handleAccountSaved}
      />
    </div>
  );
}
