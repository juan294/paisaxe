"use client";

import { cn } from "@/lib/utils";
import type { MarketingPlatform, MarketingAccountPublic } from "@/types/marketing";
import { PLATFORM_BADGES, PLATFORM_NAMES } from "./constants";

export function AccountCard({
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
