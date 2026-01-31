"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { VoiceAgentChat } from "./voice-agent-chat";
import { ELEVENLABS_AGENT_IDS } from "@/config/elevenlabs-agents";
import {
  RefreshCw,
  AlertCircle,
  ExternalLink,
  Eye,
  EyeOff,
} from "lucide-react";
import type {
  MarketingDashboardSummary,
  MarketingAccountPublic,
  MarketingPost,
  MarketingPlatform,
} from "@/types/marketing";

// Platform letter badges for Swiss Minimal aesthetic
const PLATFORM_BADGES: Record<MarketingPlatform, string> = {
  x: "X",
  instagram: "IG",
  pinterest: "Pi",
};

const PLATFORM_NAMES: Record<MarketingPlatform, string> = {
  x: "X (Twitter)",
  instagram: "Instagram",
  pinterest: "Pinterest",
};

// Credential fields for each platform
const PLATFORM_CREDENTIALS: Record<
  MarketingPlatform,
  { key: string; label: string; placeholder: string; required: boolean }[]
> = {
  x: [
    { key: "apiKey", label: "Consumer Key", placeholder: "Your X Consumer Key", required: true },
    { key: "apiSecret", label: "Consumer Secret", placeholder: "Your X Consumer Secret", required: true },
    { key: "accessToken", label: "Access Token", placeholder: "Your Access Token", required: true },
    { key: "refreshToken", label: "Access Token Secret", placeholder: "Your Access Token Secret", required: true },
  ],
  instagram: [
    { key: "accessToken", label: "Long-Lived Access Token", placeholder: "Your Instagram access token", required: true },
    { key: "clientId", label: "App ID", placeholder: "Facebook App ID", required: false },
    { key: "clientSecret", label: "App Secret", placeholder: "Facebook App Secret", required: false },
  ],
  pinterest: [
    { key: "accessToken", label: "Access Token", placeholder: "Your Pinterest access token", required: true },
    { key: "refreshToken", label: "Refresh Token", placeholder: "Your refresh token", required: false },
    { key: "clientId", label: "App ID", placeholder: "Pinterest App ID", required: false },
    { key: "clientSecret", label: "App Secret", placeholder: "Pinterest App Secret", required: false },
  ],
};

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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
        });
        if (!response.ok) {
          const result = await response.json();
          throw new Error(result.error || "Failed to pause account");
        }
      } else if (hasCredentials) {
        // Resume the account (credentials still exist)
        const response = await fetch(`/api/admin/marketing/accounts?platform=${platform}&action=resume`, {
          method: "PATCH",
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
      console.error("Toggle account error:", err);
    }
  };

  const handleDisconnectAccount = async (platform: MarketingPlatform) => {
    if (!confirm(`Disconnect ${PLATFORM_NAMES[platform]}? This will clear all stored credentials.`)) {
      return;
    }
    try {
      const response = await fetch(`/api/admin/marketing/accounts?platform=${platform}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Failed to disconnect account");
      }
      loadData();
    } catch (err) {
      console.error("Disconnect account error:", err);
    }
  };

  if (isLoading && !data) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <RefreshCw className="h-5 w-5 animate-spin text-stone-300" />
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
          className="font-mono text-xs uppercase tracking-widest text-stone-400 transition-colors hover:text-stone-900 dark:hover:text-stone-100"
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
      <header className="flex items-end justify-between border-b border-stone-200 pb-6 dark:border-stone-800">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-stone-400">Admin / Marketing</p>
          <h1 className="mt-2 text-4xl font-extralight tracking-tight text-stone-900 dark:text-stone-100">
            Marketing Automation
          </h1>
        </div>
        <button
          onClick={loadData}
          disabled={isLoading}
          className="font-mono text-xs uppercase tracking-widest text-stone-400 transition-colors hover:text-stone-900 disabled:opacity-50 dark:hover:text-stone-100"
        >
          {isLoading ? "Loading..." : "Refresh"}
        </button>
      </header>

      {/* Connected Accounts */}
      <section>
        <h2 className="mb-6 font-mono text-xs uppercase tracking-widest text-stone-400">
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
        <h2 className="mb-6 font-mono text-xs uppercase tracking-widest text-stone-400">
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
          <h2 className="mb-6 font-mono text-xs uppercase tracking-widest text-stone-400">
            03 — Upcoming Posts
          </h2>
          {data.upcomingPosts.length === 0 ? (
            <p className="py-8 text-center font-mono text-xs text-stone-300">
              No scheduled posts
            </p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-stone-200 text-left dark:border-stone-800">
                  <th className="pb-3 font-mono text-xs uppercase tracking-widest text-stone-400">#</th>
                  <th className="pb-3 font-mono text-xs uppercase tracking-widest text-stone-400">Platform</th>
                  <th className="pb-3 font-mono text-xs uppercase tracking-widest text-stone-400">Content</th>
                  <th className="pb-3 text-right font-mono text-xs uppercase tracking-widest text-stone-400">Scheduled</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                {data.upcomingPosts.slice(0, 5).map((post, idx) => (
                  <PostRow key={post.id} post={post} index={idx} />
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Recent Posts */}
        <section>
          <h2 className="mb-6 font-mono text-xs uppercase tracking-widest text-stone-400">
            04 — Recent Posts
          </h2>
          {data.recentPosts.length === 0 ? (
            <p className="py-8 text-center font-mono text-xs text-stone-300">
              No posts yet
            </p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-stone-200 text-left dark:border-stone-800">
                  <th className="pb-3 font-mono text-xs uppercase tracking-widest text-stone-400">#</th>
                  <th className="pb-3 font-mono text-xs uppercase tracking-widest text-stone-400">Platform</th>
                  <th className="pb-3 font-mono text-xs uppercase tracking-widest text-stone-400">Content</th>
                  <th className="pb-3 text-right font-mono text-xs uppercase tracking-widest text-stone-400">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
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
        <h2 className="mb-6 font-mono text-xs uppercase tracking-widest text-stone-400">
          05 — Posting Schedule
        </h2>
        {data.schedules.length === 0 ? (
          <p className="py-8 text-center font-mono text-xs text-stone-300">
            No schedules configured
          </p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-stone-200 text-left dark:border-stone-800">
                <th className="pb-3 font-mono text-xs uppercase tracking-widest text-stone-400">Platform</th>
                <th className="pb-3 font-mono text-xs uppercase tracking-widest text-stone-400">Day</th>
                <th className="pb-3 text-right font-mono text-xs uppercase tracking-widest text-stone-400">Time (UTC)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
              {data.schedules
                .filter((s) => s.isActive)
                .map((schedule) => (
                  <tr key={schedule.id}>
                    <td className="py-3">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded border border-stone-200 font-mono text-[10px] font-medium text-stone-600 dark:border-stone-700 dark:text-stone-400">
                        {PLATFORM_BADGES[schedule.platform]}
                      </span>
                    </td>
                    <td className="py-3 text-sm text-stone-700 dark:text-stone-300">
                      {schedule.dayOfWeek !== null ? DAY_NAMES[schedule.dayOfWeek] : "Daily"}
                    </td>
                    <td className="py-3 text-right font-mono text-sm tabular-nums text-stone-900 dark:text-stone-100">
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
        <h2 className="mb-6 font-mono text-xs uppercase tracking-widest text-stone-400">
          06 — Marketing Agents
        </h2>
        <VoiceAgentChat agentIds={ELEVENLABS_AGENT_IDS} />
      </section>

      {/* Setup Instructions */}
      {data.accounts.length === 0 && (
        <section className="border-t border-stone-200 pt-8 text-center dark:border-stone-800">
          <p className="text-lg font-extralight text-stone-400">
            No accounts connected
          </p>
          <p className="mt-2 font-mono text-xs uppercase tracking-widest text-stone-300">
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

// Account Card Component
function AccountCard({
  platform,
  account,
  onConfigure,
  onToggle,
  onDisconnect,
}: {
  platform: MarketingPlatform;
  account: MarketingAccountPublic | undefined;
  onConfigure: () => void;
  onToggle: () => void;
  onDisconnect: () => void;
}) {
  const isActive = account?.isActive;
  const hasCredentials = account?.hasCredentials;
  const isPaused = !isActive && hasCredentials;
  const isNotConfigured = !account || !hasCredentials;

  return (
    <div
      className={cn(
        "group relative border border-stone-200 p-4 transition-all dark:border-stone-800",
        isActive
          ? "bg-stone-50 dark:bg-stone-900/50"
          : isPaused
            ? "bg-amber-50/50 dark:bg-amber-900/10"
            : "cursor-pointer hover:border-stone-400 dark:hover:border-stone-600"
      )}
      onClick={isNotConfigured ? onConfigure : undefined}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex h-8 w-8 items-center justify-center border font-mono text-xs font-medium",
            isActive
              ? "border-stone-900 text-stone-900 dark:border-stone-100 dark:text-stone-100"
              : isPaused
                ? "border-amber-600 text-amber-600 dark:border-amber-400 dark:text-amber-400"
                : "border-stone-300 text-stone-400 dark:border-stone-700"
          )}
        >
          {PLATFORM_BADGES[platform]}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-stone-900 dark:text-stone-100">
            {PLATFORM_NAMES[platform]}
          </p>
          {account?.accountHandle ? (
            <p className="truncate font-mono text-xs text-stone-500">
              {account.accountHandle}
            </p>
          ) : (
            <p className="font-mono text-xs text-stone-400">Click to connect</p>
          )}
        </div>
        {isActive ? (
          <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-emerald-600">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Active
          </span>
        ) : isPaused ? (
          <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-amber-600">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            Paused
          </span>
        ) : (
          <span className="font-mono text-[10px] uppercase tracking-widest text-stone-300">
            Not Connected
          </span>
        )}
      </div>

      {/* Action buttons for active accounts */}
      {isActive && (
        <div className="mt-3 flex items-center gap-2 border-t border-stone-200 pt-3 dark:border-stone-700">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onConfigure();
            }}
            className="flex-1 font-mono text-[10px] uppercase tracking-widest text-stone-400 transition-colors hover:text-stone-900 dark:hover:text-stone-100"
          >
            Configure
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            className="font-mono text-[10px] uppercase tracking-widest text-amber-600 transition-colors hover:text-amber-700"
            title="Pause posting (keeps credentials)"
          >
            Pause
          </button>
        </div>
      )}

      {/* Action buttons for paused accounts */}
      {isPaused && (
        <div className="mt-3 flex items-center gap-2 border-t border-stone-200 pt-3 dark:border-stone-700">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            className="flex-1 font-mono text-[10px] uppercase tracking-widest text-emerald-600 transition-colors hover:text-emerald-700"
          >
            Resume
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDisconnect();
            }}
            className="font-mono text-[10px] uppercase tracking-widest text-red-500 transition-colors hover:text-red-700"
            title="Disconnect and clear credentials"
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}

// Account Configuration Dialog
function AccountConfigDialog({
  platform,
  existingAccount,
  onClose,
  onSaved,
}: {
  platform: MarketingPlatform | null;
  existingAccount: MarketingAccountPublic | undefined;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [accountName, setAccountName] = useState("");
  const [accountHandle, setAccountHandle] = useState("");
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  // Reset form when platform changes
  useEffect(() => {
    if (platform) {
      setAccountName(existingAccount?.accountName || "Paisaxe");
      setAccountHandle(existingAccount?.accountHandle || "");
      setCredentials({});
      setShowSecrets({});
      setError("");
    }
  }, [platform, existingAccount]);

  const handleSave = async () => {
    if (!platform) return;

    // Validate required fields
    const requiredFields = PLATFORM_CREDENTIALS[platform].filter((f) => f.required);
    const missingFields = requiredFields.filter((f) => !credentials[f.key]?.trim());

    if (missingFields.length > 0) {
      setError(`Please fill in: ${missingFields.map((f) => f.label).join(", ")}`);
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      const response = await fetch("/api/admin/marketing/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform,
          accountName: accountName.trim() || "Paisaxe",
          accountHandle: accountHandle.trim() || undefined,
          credentials,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to save account");
      }

      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsSaving(false);
    }
  };

  if (!platform) return null;

  const credentialFields = PLATFORM_CREDENTIALS[platform];

  return (
    <Dialog open={!!platform} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-stone-900 dark:text-stone-100">
            <div className="flex h-8 w-8 items-center justify-center border border-stone-900 font-mono text-xs font-medium dark:border-stone-100">
              {PLATFORM_BADGES[platform]}
            </div>
            {existingAccount ? "Configure" : "Connect"} {PLATFORM_NAMES[platform]}
          </DialogTitle>
          <DialogDescription className="font-mono text-xs text-stone-500">
            Enter your API credentials to enable automated posting
          </DialogDescription>
        </DialogHeader>

        <div className="mt-6 space-y-4">
          {/* Account Name */}
          <div>
            <label className="mb-2 block font-mono text-xs uppercase tracking-widest text-stone-400">
              Account Name
            </label>
            <input
              type="text"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="Paisaxe"
              className="w-full border border-stone-200 bg-transparent px-3 py-2 text-sm text-stone-900 placeholder-stone-300 outline-none transition-colors focus:border-stone-400 dark:border-stone-700 dark:text-stone-100"
            />
          </div>

          {/* Account Handle */}
          <div>
            <label className="mb-2 block font-mono text-xs uppercase tracking-widest text-stone-400">
              Handle / Username
            </label>
            <input
              type="text"
              value={accountHandle}
              onChange={(e) => setAccountHandle(e.target.value)}
              placeholder="@paisaxe"
              className="w-full border border-stone-200 bg-transparent px-3 py-2 text-sm text-stone-900 placeholder-stone-300 outline-none transition-colors focus:border-stone-400 dark:border-stone-700 dark:text-stone-100"
            />
          </div>

          {/* Credential Fields */}
          <div className="space-y-3 border-t border-stone-200 pt-4 dark:border-stone-800">
            <p className="font-mono text-xs uppercase tracking-widest text-stone-400">
              API Credentials
            </p>
            {credentialFields.map((field) => (
              <div key={field.key}>
                <label className="mb-2 flex items-center gap-1 font-mono text-xs uppercase tracking-widest text-stone-400">
                  {field.label}
                  {field.required && <span className="text-red-500">*</span>}
                </label>
                <div className="relative">
                  <input
                    type={showSecrets[field.key] ? "text" : "password"}
                    value={credentials[field.key] || ""}
                    onChange={(e) =>
                      setCredentials((prev) => ({ ...prev, [field.key]: e.target.value }))
                    }
                    placeholder={field.placeholder}
                    className="w-full border border-stone-200 bg-transparent px-3 py-2 pr-10 text-sm text-stone-900 placeholder-stone-300 outline-none transition-colors focus:border-stone-400 dark:border-stone-700 dark:text-stone-100"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setShowSecrets((prev) => ({ ...prev, [field.key]: !prev[field.key] }))
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                  >
                    {showSecrets[field.key] ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 font-mono text-xs text-red-600">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 border-t border-stone-200 pt-4 dark:border-stone-800">
            <Button
              variant="ghost"
              onClick={onClose}
              className="flex-1 font-mono text-xs uppercase tracking-widest text-stone-400 hover:text-stone-900 dark:hover:text-stone-100"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 bg-stone-900 font-mono text-xs uppercase tracking-widest text-white hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-200"
            >
              {isSaving ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : existingAccount ? (
                "Update"
              ) : (
                "Connect"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Post Row Component (for table layout)
function PostRow({ post, index }: { post: MarketingPost; index: number }) {
  const statusStyles = {
    draft: "text-stone-400",
    scheduled: "text-amber-600",
    posting: "text-blue-600",
    posted: "text-emerald-600",
    failed: "text-red-600",
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  return (
    <tr>
      <td className="py-3 font-mono text-sm tabular-nums text-stone-300">
        {String(index + 1).padStart(2, '0')}
      </td>
      <td className="py-3">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded border border-stone-200 font-mono text-[10px] font-medium text-stone-600 dark:border-stone-700 dark:text-stone-400">
          {PLATFORM_BADGES[post.platform]}
        </span>
      </td>
      <td className="max-w-xs py-3">
        <p className="truncate text-sm text-stone-700 dark:text-stone-300">
          {post.content}
        </p>
      </td>
      <td className="py-3 text-right">
        {post.status === "scheduled" && post.scheduledFor ? (
          <span className="font-mono text-xs text-stone-500">
            {formatDate(post.scheduledFor)}
          </span>
        ) : (
          <span className={cn("font-mono text-xs uppercase", statusStyles[post.status])}>
            {post.status}
          </span>
        )}
        {post.postUrl && (
          <a
            href={post.postUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-2 inline-block text-stone-400 hover:text-stone-600"
          >
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </td>
    </tr>
  );
}

// Stat Card Component (Swiss Minimal style with color accents)
const statColorClasses = {
  blue: "text-blue-600 dark:text-blue-400",
  emerald: "text-emerald-600 dark:text-emerald-400",
  amber: "text-amber-600 dark:text-amber-400",
  rose: "text-rose-600 dark:text-rose-400",
};

function StatCard({
  number,
  value,
  label,
  color,
  isError = false,
}: {
  number: string;
  value: number;
  label: string;
  color?: "blue" | "emerald" | "amber" | "rose";
  isError?: boolean;
}) {
  const colorClass = isError && value > 0
    ? "text-red-500"
    : color
      ? statColorClasses[color]
      : "text-stone-900 dark:text-stone-100";

  return (
    <div>
      <p className="font-mono text-xs tabular-nums text-stone-300">{number}</p>
      <p className={cn(
        "mt-2 text-5xl font-extralight tabular-nums tracking-tighter",
        colorClass
      )}>
        {value.toLocaleString()}
      </p>
      <p className="mt-2 font-mono text-xs uppercase tracking-widest text-stone-400">{label}</p>
    </div>
  );
}
