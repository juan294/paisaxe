"use client";

import { cn } from "@/lib/utils";
import { ExternalLink } from "lucide-react";
import type { MarketingPost } from "@/types/marketing";
import { PLATFORM_BADGES } from "./constants";

export function PostRow({ post, index }: { post: MarketingPost; index: number }) {
  const statusStyles = {
    draft: "text-[#a39e98]",
    scheduled: "text-amber-600",
    posting: "text-blue-600",
    posted: "text-emerald-600",
    failed: "text-red-600",
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "\u2014";
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
