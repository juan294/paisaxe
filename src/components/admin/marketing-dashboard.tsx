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
  Copy,
  Check,
  Trash2,
  Plus,
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
        <RefreshCw className="h-5 w-5 animate-spin text-[#a39e98]" />
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
          className="font-mono text-xs uppercase tracking-widest text-[#a39e98] transition-colors hover:text-[#2d2a26] dark:hover:text-[#f5f3ee]"
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
      <header className="flex items-end justify-between border-b border-[#e5e3de] pb-6 dark:border-[#3d3a36]">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-[#a39e98]">Admin / Marketing</p>
          <h1 className="mt-2 text-4xl font-extralight tracking-tight text-[#2d2a26] dark:text-[#f5f3ee]">
            Marketing Automation
          </h1>
        </div>
        <button
          onClick={loadData}
          disabled={isLoading}
          className="font-mono text-xs uppercase tracking-widest text-[#a39e98] transition-colors hover:text-[#2d2a26] disabled:opacity-50 dark:hover:text-[#f5f3ee]"
        >
          {isLoading ? "Loading..." : "Refresh"}
        </button>
      </header>

      {/* Connected Accounts */}
      <section>
        <h2 className="mb-6 font-mono text-xs uppercase tracking-widest text-[#a39e98]">
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
        <h2 className="mb-6 font-mono text-xs uppercase tracking-widest text-[#a39e98]">
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
          <h2 className="mb-6 font-mono text-xs uppercase tracking-widest text-[#a39e98]">
            03 — Upcoming Posts
          </h2>
          {data.upcomingPosts.length === 0 ? (
            <p className="py-8 text-center font-mono text-xs text-[#a39e98]">
              No scheduled posts
            </p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#e5e3de] text-left dark:border-[#3d3a36]">
                  <th className="pb-3 font-mono text-xs uppercase tracking-widest text-[#a39e98]">#</th>
                  <th className="pb-3 font-mono text-xs uppercase tracking-widest text-[#a39e98]">Platform</th>
                  <th className="pb-3 font-mono text-xs uppercase tracking-widest text-[#a39e98]">Content</th>
                  <th className="pb-3 text-right font-mono text-xs uppercase tracking-widest text-[#a39e98]">Scheduled</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f5f3ee] dark:divide-[#3d3a36]">
                {data.upcomingPosts.slice(0, 5).map((post, idx) => (
                  <PostRow key={post.id} post={post} index={idx} />
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Recent Posts */}
        <section>
          <h2 className="mb-6 font-mono text-xs uppercase tracking-widest text-[#a39e98]">
            04 — Recent Posts
          </h2>
          {data.recentPosts.length === 0 ? (
            <p className="py-8 text-center font-mono text-xs text-[#a39e98]">
              No posts yet
            </p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#e5e3de] text-left dark:border-[#3d3a36]">
                  <th className="pb-3 font-mono text-xs uppercase tracking-widest text-[#a39e98]">#</th>
                  <th className="pb-3 font-mono text-xs uppercase tracking-widest text-[#a39e98]">Platform</th>
                  <th className="pb-3 font-mono text-xs uppercase tracking-widest text-[#a39e98]">Content</th>
                  <th className="pb-3 text-right font-mono text-xs uppercase tracking-widest text-[#a39e98]">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f5f3ee] dark:divide-[#3d3a36]">
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
        <h2 className="mb-6 font-mono text-xs uppercase tracking-widest text-[#a39e98]">
          05 — Posting Schedule
        </h2>
        {data.schedules.length === 0 ? (
          <p className="py-8 text-center font-mono text-xs text-[#a39e98]">
            No schedules configured
          </p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#e5e3de] text-left dark:border-[#3d3a36]">
                <th className="pb-3 font-mono text-xs uppercase tracking-widest text-[#a39e98]">Platform</th>
                <th className="pb-3 font-mono text-xs uppercase tracking-widest text-[#a39e98]">Day</th>
                <th className="pb-3 text-right font-mono text-xs uppercase tracking-widest text-[#a39e98]">Time (UTC)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f5f3ee] dark:divide-[#3d3a36]">
              {data.schedules
                .filter((s) => s.isActive)
                .map((schedule) => (
                  <tr key={schedule.id}>
                    <td className="py-3">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded border border-[#e5e3de] font-mono text-[10px] font-medium text-[#6b6560] dark:border-[#4d4944] dark:text-[#a39e98]">
                        {PLATFORM_BADGES[schedule.platform]}
                      </span>
                    </td>
                    <td className="py-3 text-sm text-[#4d4944] dark:text-[#a39e98]">
                      {schedule.dayOfWeek !== null ? DAY_NAMES[schedule.dayOfWeek] : "Daily"}
                    </td>
                    <td className="py-3 text-right font-mono text-sm tabular-nums text-[#2d2a26] dark:text-[#f5f3ee]">
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
        <h2 className="mb-6 font-mono text-xs uppercase tracking-widest text-[#a39e98]">
          06 — Marketing Agents
        </h2>
        <VoiceAgentChat agentIds={ELEVENLABS_AGENT_IDS} />
      </section>

      {/* Content Drafts */}
      <section>
        <h2 className="mb-6 font-mono text-xs uppercase tracking-widest text-[#a39e98]">
          07 — Content Drafts
        </h2>
        <DraftsPanel onDraftPosted={loadData} />
      </section>

      {/* Setup Instructions */}
      {data.accounts.length === 0 && (
        <section className="border-t border-[#e5e3de] pt-8 text-center dark:border-[#3d3a36]">
          <p className="text-lg font-extralight text-[#a39e98]">
            No accounts connected
          </p>
          <p className="mt-2 font-mono text-xs uppercase tracking-widest text-[#a39e98]">
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
        "group relative border border-[#e5e3de] p-4 transition-all dark:border-[#3d3a36]",
        isActive
          ? "bg-[#f5f3ee] dark:bg-[#252320]/50"
          : isPaused
            ? "bg-amber-50/50 dark:bg-amber-900/10"
            : "cursor-pointer hover:border-[#a39e98] dark:hover:border-[#6b6560]"
      )}
      onClick={isNotConfigured ? onConfigure : undefined}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex h-8 w-8 items-center justify-center border font-mono text-xs font-medium",
            isActive
              ? "border-[#2d2a26] text-[#2d2a26] dark:border-[#f5f3ee] dark:text-[#f5f3ee]"
              : isPaused
                ? "border-amber-600 text-amber-600 dark:border-amber-400 dark:text-amber-400"
                : "border-[#a39e98] text-[#a39e98] dark:border-[#4d4944]"
          )}
        >
          {PLATFORM_BADGES[platform]}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-[#2d2a26] dark:text-[#f5f3ee]">
            {PLATFORM_NAMES[platform]}
          </p>
          {account?.accountHandle ? (
            <p className="truncate font-mono text-xs text-[#6b6560]">
              {account.accountHandle}
            </p>
          ) : (
            <p className="font-mono text-xs text-[#a39e98]">Click to connect</p>
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
          <span className="font-mono text-[10px] uppercase tracking-widest text-[#a39e98]">
            Not Connected
          </span>
        )}
      </div>

      {/* Action buttons for active accounts */}
      {isActive && (
        <div className="mt-3 flex items-center gap-2 border-t border-[#e5e3de] pt-3 dark:border-[#4d4944]">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onConfigure();
            }}
            className="flex-1 font-mono text-[10px] uppercase tracking-widest text-[#a39e98] transition-colors hover:text-[#2d2a26] dark:hover:text-[#f5f3ee]"
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
        <div className="mt-3 flex items-center gap-2 border-t border-[#e5e3de] pt-3 dark:border-[#4d4944]">
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
      <DialogContent className="max-w-md border-[#e5e3de] bg-white dark:border-[#3d3a36] dark:bg-[#252320]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-[#2d2a26] dark:text-[#f5f3ee]">
            <div className="flex h-8 w-8 items-center justify-center border border-[#2d2a26] font-mono text-xs font-medium dark:border-[#f5f3ee]">
              {PLATFORM_BADGES[platform]}
            </div>
            {existingAccount ? "Configure" : "Connect"} {PLATFORM_NAMES[platform]}
          </DialogTitle>
          <DialogDescription className="font-mono text-xs text-[#6b6560]">
            Enter your API credentials to enable automated posting
          </DialogDescription>
        </DialogHeader>

        <div className="mt-6 space-y-4">
          {/* Account Name */}
          <div>
            <label className="mb-2 block font-mono text-xs uppercase tracking-widest text-[#a39e98]">
              Account Name
            </label>
            <input
              type="text"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="Paisaxe"
              className="w-full border border-[#e5e3de] bg-transparent px-3 py-2 text-sm text-[#2d2a26] placeholder-[#a39e98] outline-none transition-colors focus:border-[#a39e98] dark:border-[#4d4944] dark:text-[#f5f3ee]"
            />
          </div>

          {/* Account Handle */}
          <div>
            <label className="mb-2 block font-mono text-xs uppercase tracking-widest text-[#a39e98]">
              Handle / Username
            </label>
            <input
              type="text"
              value={accountHandle}
              onChange={(e) => setAccountHandle(e.target.value)}
              placeholder="@paisaxe"
              className="w-full border border-[#e5e3de] bg-transparent px-3 py-2 text-sm text-[#2d2a26] placeholder-[#a39e98] outline-none transition-colors focus:border-[#a39e98] dark:border-[#4d4944] dark:text-[#f5f3ee]"
            />
          </div>

          {/* Credential Fields */}
          <div className="space-y-3 border-t border-[#e5e3de] pt-4 dark:border-[#3d3a36]">
            <p className="font-mono text-xs uppercase tracking-widest text-[#a39e98]">
              API Credentials
            </p>
            {credentialFields.map((field) => (
              <div key={field.key}>
                <label className="mb-2 flex items-center gap-1 font-mono text-xs uppercase tracking-widest text-[#a39e98]">
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
                    className="w-full border border-[#e5e3de] bg-transparent px-3 py-2 pr-10 text-sm text-[#2d2a26] placeholder-[#a39e98] outline-none transition-colors focus:border-[#a39e98] dark:border-[#4d4944] dark:text-[#f5f3ee]"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setShowSecrets((prev) => ({ ...prev, [field.key]: !prev[field.key] }))
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#a39e98] hover:text-[#6b6560]"
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
          <div className="flex items-center gap-3 border-t border-[#e5e3de] pt-4 dark:border-[#3d3a36]">
            <Button
              variant="ghost"
              onClick={onClose}
              className="flex-1 font-mono text-xs uppercase tracking-widest text-[#a39e98] hover:text-[#2d2a26] dark:hover:text-[#f5f3ee]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 bg-[#2d2a26] font-mono text-xs uppercase tracking-widest text-white hover:bg-[#3d3a36] dark:bg-[#f5f3ee] dark:text-[#2d2a26] dark:hover:bg-[#e5e3de]"
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
    draft: "text-[#a39e98]",
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
      <td className="py-3 font-mono text-sm tabular-nums text-[#a39e98]">
        {String(index + 1).padStart(2, '0')}
      </td>
      <td className="py-3">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded border border-[#e5e3de] font-mono text-[10px] font-medium text-[#6b6560] dark:border-[#4d4944] dark:text-[#a39e98]">
          {PLATFORM_BADGES[post.platform]}
        </span>
      </td>
      <td className="max-w-xs py-3">
        <p className="truncate text-sm text-[#4d4944] dark:text-[#a39e98]">
          {post.content}
        </p>
      </td>
      <td className="py-3 text-right">
        {post.status === "scheduled" && post.scheduledFor ? (
          <span className="font-mono text-xs text-[#6b6560]">
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
            className="ml-2 inline-block text-[#a39e98] hover:text-[#6b6560]"
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
      : "text-[#2d2a26] dark:text-[#f5f3ee]";

  return (
    <div>
      <p className="font-mono text-xs tabular-nums text-[#a39e98]">{number}</p>
      <p className={cn(
        "mt-2 text-5xl font-extralight tabular-nums tracking-tighter",
        colorClass
      )}>
        {value.toLocaleString()}
      </p>
      <p className="mt-2 font-mono text-xs uppercase tracking-widest text-[#a39e98]">{label}</p>
    </div>
  );
}

// Drafts Panel Component
function DraftsPanel({ onDraftPosted }: { onDraftPosted: () => void }) {
  const [drafts, setDrafts] = useState<MarketingPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const loadDrafts = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/admin/marketing/posts?status=draft");
      const result = await response.json();
      if (response.ok) {
        setDrafts(result.data || []);
      }
    } catch (error) {
      console.error("Failed to load drafts:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDrafts();
  }, [loadDrafts]);

  const handleCopy = async (content: string, id: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  const handleMarkAsPosted = async (postId: string) => {
    try {
      const response = await fetch(
        `/api/admin/marketing/posts?id=${postId}&action=mark-posted`,
        { method: "PATCH" }
      );
      if (response.ok) {
        loadDrafts();
        onDraftPosted();
      }
    } catch (error) {
      console.error("Failed to mark as posted:", error);
    }
  };

  const handleDelete = async (postId: string) => {
    if (!confirm("Delete this draft?")) return;
    try {
      const response = await fetch(`/api/admin/marketing/posts?id=${postId}`, {
        method: "DELETE",
      });
      if (response.ok) {
        loadDrafts();
      }
    } catch (error) {
      console.error("Failed to delete draft:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <RefreshCw className="h-5 w-5 animate-spin text-[#a39e98]" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with create button */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#6b6560]">
          {drafts.length === 0
            ? "No drafts yet. Chat with the marketing agents to create content."
            : `${drafts.length} draft${drafts.length === 1 ? "" : "s"} ready to post`}
        </p>
        <button
          onClick={() => setShowCreateDialog(true)}
          className="flex items-center gap-1 font-mono text-xs uppercase tracking-widest text-[#a39e98] transition-colors hover:text-[#2d2a26] dark:hover:text-[#f5f3ee]"
        >
          <Plus className="h-3 w-3" />
          New Draft
        </button>
      </div>

      {/* Drafts list */}
      {drafts.length > 0 && (
        <div className="divide-y divide-[#f5f3ee] border border-[#e5e3de] dark:divide-[#3d3a36] dark:border-[#3d3a36]">
          {drafts.map((draft) => (
            <div key={draft.id} className="p-4">
              <div className="flex items-start gap-3">
                {/* Platform badge */}
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center border border-[#e5e3de] font-mono text-xs font-medium text-[#6b6560] dark:border-[#4d4944] dark:text-[#a39e98]">
                  {PLATFORM_BADGES[draft.platform]}
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <p className="whitespace-pre-wrap text-sm text-[#4d4944] dark:text-[#a39e98]">
                    {draft.content}
                  </p>
                  {draft.hashtags.length > 0 && (
                    <p className="mt-2 text-xs text-[#a39e98]">
                      {draft.hashtags.join(" ")}
                    </p>
                  )}
                  <p className="mt-2 font-mono text-[10px] text-[#a39e98]">
                    Created {new Date(draft.createdAt).toLocaleDateString()}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex flex-shrink-0 items-center gap-1">
                  <button
                    onClick={() => handleCopy(draft.content, draft.id)}
                    className="flex h-8 w-8 items-center justify-center text-[#a39e98] transition-colors hover:text-[#6b6560]"
                    title="Copy content"
                  >
                    {copiedId === draft.id ? (
                      <Check className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    onClick={() => handleMarkAsPosted(draft.id)}
                    className="flex h-8 items-center gap-1 rounded px-2 font-mono text-[10px] uppercase tracking-widest text-emerald-600 transition-colors hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                    title="Mark as posted"
                  >
                    Posted
                  </button>
                  <button
                    onClick={() => handleDelete(draft.id)}
                    className="flex h-8 w-8 items-center justify-center text-[#a39e98] transition-colors hover:text-red-500"
                    title="Delete draft"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Draft Dialog */}
      <CreateDraftDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onCreated={() => {
          setShowCreateDialog(false);
          loadDrafts();
        }}
      />
    </div>
  );
}

// Create Draft Dialog
function CreateDraftDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [platform, setPlatform] = useState<MarketingPlatform>("x");
  const [content, setContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const maxLength = platform === "x" ? 280 : platform === "instagram" ? 2200 : 500;

  const handleSave = async () => {
    if (!content.trim()) {
      setError("Content is required");
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      const response = await fetch("/api/admin/marketing/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, content: content.trim() }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to create draft");
      }

      setContent("");
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-md border-[#e5e3de] bg-white dark:border-[#3d3a36] dark:bg-[#252320]">
        <DialogHeader>
          <DialogTitle className="text-[#2d2a26] dark:text-[#f5f3ee]">
            Create Draft
          </DialogTitle>
          <DialogDescription className="font-mono text-xs text-[#6b6560]">
            Create a new content draft for manual posting
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          {/* Platform selector */}
          <div>
            <label className="mb-2 block font-mono text-xs uppercase tracking-widest text-[#a39e98]">
              Platform
            </label>
            <div className="flex gap-2">
              {(["x", "instagram", "pinterest"] as MarketingPlatform[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPlatform(p)}
                  className={cn(
                    "flex h-10 w-10 items-center justify-center border font-mono text-xs font-medium transition-colors",
                    platform === p
                      ? "border-[#2d2a26] text-[#2d2a26] dark:border-[#f5f3ee] dark:text-[#f5f3ee]"
                      : "border-[#e5e3de] text-[#a39e98] hover:border-[#a39e98] dark:border-[#4d4944]"
                  )}
                >
                  {PLATFORM_BADGES[p]}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div>
            <label className="mb-2 flex items-center justify-between font-mono text-xs uppercase tracking-widest text-[#a39e98]">
              Content
              <span className={cn(
                "normal-case",
                content.length > maxLength ? "text-red-500" : ""
              )}>
                {content.length}/{maxLength}
              </span>
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={`Write your ${PLATFORM_NAMES[platform]} post...`}
              rows={5}
              className="w-full resize-none border border-[#e5e3de] bg-transparent px-3 py-2 text-sm text-[#2d2a26] placeholder-[#a39e98] outline-none transition-colors focus:border-[#a39e98] dark:border-[#4d4944] dark:text-[#f5f3ee]"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 font-mono text-xs text-red-600">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 border-t border-[#e5e3de] pt-4 dark:border-[#3d3a36]">
            <Button
              variant="ghost"
              onClick={onClose}
              className="flex-1 font-mono text-xs uppercase tracking-widest text-[#a39e98] hover:text-[#2d2a26] dark:hover:text-[#f5f3ee]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || content.length > maxLength}
              className="flex-1 bg-[#2d2a26] font-mono text-xs uppercase tracking-widest text-white hover:bg-[#3d3a36] dark:bg-[#f5f3ee] dark:text-[#2d2a26] dark:hover:bg-[#e5e3de]"
            >
              {isSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Save Draft"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
