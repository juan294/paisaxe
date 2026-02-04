"use client";

import { useState, useEffect, useCallback } from "react";
import { ExternalLink, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface TunnelStatus {
  running: boolean;
  url: string | null;
}

interface TunnelTableRowProps {
  rowNumber: number;
  onStatusChange?: (status: { available: boolean; running: boolean }) => void;
}

/**
 * Tunnel control rendered as a table row for the System category.
 * Development-only - returns null in production.
 */
export function TunnelTableRow({ rowNumber, onStatusChange }: TunnelTableRowProps) {
  const [status, setStatus] = useState<TunnelStatus>({ running: false, url: null });
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/tunnel");
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
        setError(null);
        onStatusChange?.({ available: true, running: data.running });
      } else if (response.status === 403) {
        // Production environment - tunnel control not available
        setError("Only available in development");
        onStatusChange?.({ available: false, running: false });
      }
    } catch {
      setError("Failed to check tunnel status");
      onStatusChange?.({ available: true, running: false });
    } finally {
      setIsLoading(false);
    }
  }, [onStatusChange]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleToggle = async () => {
    setIsUpdating(true);
    setError(null);

    try {
      const method = status.running ? "DELETE" : "POST";
      const response = await fetch("/api/admin/tunnel", { method });

      if (response.ok) {
        const data = await response.json();
        setStatus({ running: data.running, url: data.url });
        onStatusChange?.({ available: true, running: data.running });
      } else {
        const data = await response.json();
        setError(data.error || "Failed to toggle tunnel");
      }
    } catch {
      setError("Failed to toggle tunnel");
    } finally {
      setIsUpdating(false);
    }
  };

  // Don't render in production
  if (error === "Only available in development") {
    return null;
  }

  // Loading state as a table row
  if (isLoading) {
    return (
      <tr>
        <td className="py-5 text-center align-top font-mono text-sm tabular-nums text-[#a39e98]">
          {String(rowNumber).padStart(2, "0")}
        </td>
        <td className="py-5 align-top" colSpan={5}>
          <div className="flex items-center gap-2 text-[#a39e98]">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span className="text-sm">Checking tunnel...</span>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className={cn("group", status.running && "bg-[#f5f3ee]/50 dark:bg-[#252320]/50")}>
      <td className="py-5 text-center align-top font-mono text-sm tabular-nums text-[#a39e98]">
        {String(rowNumber).padStart(2, "0")}
      </td>
      <td className="py-5 align-top">
        <div className="flex items-center gap-2 text-sm font-medium text-[#2d2a26] dark:text-[#f5f3ee]">
          Dev Tunnel
          {status.running && status.url && (
            <a
              href={status.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-[#6b6560] hover:text-[#2d2a26] dark:text-[#a39e98] dark:hover:text-[#f5f3ee]"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </td>
      <td className="py-5 pr-4 align-top text-sm text-[#6b6560] dark:text-[#a39e98]">
        {status.running && status.url ? (
          <span>
            Exposes localhost:3000 at{" "}
            <a
              href={status.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#2d2a26] hover:underline dark:text-[#f5f3ee]"
            >
              {status.url.replace("https://", "")}
            </a>
          </span>
        ) : (
          "Start tunnel to test ElevenLabs webhooks locally"
        )}
        {error && <span className="ml-2 text-xs text-red-500">({error})</span>}
      </td>
      <td className="py-5 align-top">
        <span className="text-xs text-[#a39e98]">—</span>
      </td>
      <td className="py-5 text-center align-top">
        {status.running ? (
          <span className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest text-[#2d2a26] dark:text-[#f5f3ee]">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            On
          </span>
        ) : (
          <span className="font-mono text-xs uppercase tracking-widest text-[#a39e98]">
            Off
          </span>
        )}
      </td>
      <td className="py-5 text-center align-top">
        <button
          onClick={handleToggle}
          disabled={isUpdating}
          className={cn(
            "relative h-6 w-11 rounded-full transition-colors",
            status.running
              ? "bg-[#2d2a26] dark:bg-[#f5f3ee]"
              : "bg-[#e5e3de] dark:bg-[#3d3a36]",
            isUpdating && "cursor-wait opacity-50"
          )}
          role="switch"
          aria-checked={status.running}
          aria-label="Toggle dev tunnel"
        >
          <span
            className={cn(
              "absolute top-0.5 h-5 w-5 rounded-full transition-all",
              status.running
                ? "left-[22px] bg-white dark:bg-[#2d2a26]"
                : "left-0.5 bg-white dark:bg-[#6b6560]"
            )}
          />
        </button>
      </td>
    </tr>
  );
}
